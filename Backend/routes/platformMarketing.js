import express from 'express';
import PlatformCampaign from '../models/PlatformCampaign.js';
import PlatformRecipient from '../models/PlatformRecipient.js';
import PlatformSubscriber from '../models/PlatformSubscriber.js';
import EmailSuppression from '../models/EmailSuppression.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import { previewAudience } from '../services/platformAudienceService.js';
import dispatch from '../services/platformDispatchService.js';
import marketingAi from '../services/marketingAiService.js';
import deliverability from '../services/deliverabilityService.js';
import marketingAgent from '../services/marketingAgentService.js';

/**
 * Espace marketing du super admin.
 *
 * Trois routes de ce fichier sont VOLONTAIREMENT publiques — pixel
 * d'ouverture, redirection de clic, désinscription. Elles sont appelées depuis
 * la boîte mail du destinataire, qui n'a évidemment pas de session : les
 * protéger reviendrait à n'avoir ni statistiques ni lien de désinscription
 * fonctionnel, et un lien de désinscription cassé est un signalement spam.
 * Leur seul secret est le token du destinataire, qui n'expose aucune donnée.
 */

const router = express.Router();
const admin = [requireEcomAuth, requireSuperAdmin];
// requireEcomAuth pose le document utilisateur sur req.ecomUser ; req.user est
// le JWT décodé et ne porte qu'un `id`.
const authorOf = (req) => req.ecomUser?._id || req.user?.id || null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://scalor.site';

// GIF transparent 1×1 — réponse du pixel d'ouverture.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const oops = (res, error, code = 500) => {
  console.error('[marketing]', error);
  return res.status(code).json({ success: false, error: String(error?.message || error) });
};

// ─── Traçage public ──────────────────────────────────────────────────────────

router.get('/t/open/:campaignId/:token', async (req, res) => {
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, private' });
  res.end(PIXEL);
  try {
    const { campaignId, token } = req.params;
    // Première ouverture seulement : sans ce garde, un client mail qui recharge
    // l'image dix fois transforme un lecteur en dix.
    const updated = await PlatformRecipient.updateOne(
      { campaignId, token, openedAt: null },
      { $set: { openedAt: new Date() } },
    );
    if (updated.modifiedCount) {
      await PlatformCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.byChannel.email.opened': 1 } });
    }
  } catch { /* le pixel est déjà parti, l'échec de comptage ne regarde personne */ }
});

router.get('/t/click/:campaignId/:token', async (req, res) => {
  const target = String(req.query.url || '');
  const safe = /^https?:\/\//i.test(target) ? target : FRONTEND_URL;
  res.redirect(302, safe);
  try {
    const { campaignId, token } = req.params;
    const recipient = await PlatformRecipient.findOne({ campaignId, token });
    if (!recipient) return;
    const first = !recipient.clickedAt;
    recipient.clickedAt = recipient.clickedAt || new Date();
    recipient.clickCount += 1;
    // Un clic prouve l'ouverture, même si le pixel a été bloqué — cas courant
    // sur Gmail avec images désactivées.
    if (!recipient.openedAt) recipient.openedAt = new Date();
    await recipient.save();
    const inc = { 'stats.byChannel.email.clicked': first ? 1 : 0 };
    if (first) await PlatformCampaign.updateOne({ _id: campaignId }, { $inc: inc });
  } catch { /* la redirection est déjà envoyée */ }
});

// GET pour le lien humain, POST pour le One-Click de Gmail et Yahoo.
async function handleUnsubscribe(req, res) {
  try {
    const { campaignId, token } = req.params;
    const result = await dispatch.registerUnsubscribe({ campaignId, token });
    if (req.method === 'POST') return res.status(200).send('OK');
    return res.status(200).send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Désinscription</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f5f7;">
<div style="max-width:460px;margin:14vh auto;background:#fff;border-radius:14px;padding:30px;text-align:center;">
<div style="font-size:17px;font-weight:800;color:#0D9488;margin-bottom:10px;">Scalor</div>
<h1 style="font-size:19px;margin:0 0 10px;">${result.ok ? "C'est fait" : 'Lien expiré'}</h1>
<p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0;">${result.ok
  ? "Tu ne recevras plus d'emails marketing de notre part. Les emails de service — connexion, facturation — continueront d'arriver."
  : "Ce lien de désinscription n'est plus valide. Écris-nous et on s'en occupe."}</p>
<a href="${FRONTEND_URL}" style="display:inline-block;margin-top:18px;font-size:13px;color:#0D9488;">Retour sur Scalor</a>
</div></body></html>`);
  } catch (error) { return oops(res, error); }
}
router.get('/u/:campaignId/:token', handleUnsubscribe);
router.post('/u/:campaignId/:token', handleUnsubscribe);

// ─── Campagnes ───────────────────────────────────────────────────────────────

router.get('/campaigns', ...admin, async (req, res) => {
  try {
    const q = {};
    if (req.query.kind) q.kind = req.query.kind;
    if (req.query.status) q.status = req.query.status;
    const items = await PlatformCampaign.find(q).sort({ createdAt: -1 }).limit(Number(req.query.limit) || 100).lean();
    return res.json({ success: true, items });
  } catch (error) { return oops(res, error); }
});

router.get('/campaigns/:id', ...admin, async (req, res) => {
  try {
    const item = await PlatformCampaign.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    return res.json({ success: true, item });
  } catch (error) { return oops(res, error); }
});

router.post('/campaigns', ...admin, async (req, res) => {
  try {
    const item = await PlatformCampaign.create({ ...req.body, createdBy: req.ecomUser?._id || req.user?.id || null, status: 'draft' });
    return res.status(201).json({ success: true, item });
  } catch (error) { return oops(res, error, 400); }
});

router.put('/campaigns/:id', ...admin, async (req, res) => {
  try {
    const current = await PlatformCampaign.findById(req.params.id);
    if (!current) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    // Modifier une campagne en cours d'envoi ferait recevoir deux contenus
    // différents à deux moitiés de la liste.
    if (['sending', 'sent'].includes(current.status)) {
      return res.status(409).json({ success: false, error: 'Campagne déjà envoyée ou en cours — duplique-la pour la modifier' });
    }
    const { status, stats, progress, ...safe } = req.body;
    Object.assign(current, safe);
    await current.save();
    return res.json({ success: true, item: current });
  } catch (error) { return oops(res, error, 400); }
});

router.delete('/campaigns/:id', ...admin, async (req, res) => {
  try {
    await PlatformCampaign.deleteOne({ _id: req.params.id });
    await PlatformRecipient.deleteMany({ campaignId: req.params.id });
    return res.json({ success: true });
  } catch (error) { return oops(res, error); }
});

router.post('/campaigns/:id/duplicate', ...admin, async (req, res) => {
  try {
    const src = await PlatformCampaign.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    const { _id, createdAt, updatedAt, stats, progress, startedAt, finishedAt, ...rest } = src;
    const copy = await PlatformCampaign.create({
      ...rest, name: `${src.name} (copie)`, status: 'draft',
      createdBy: req.ecomUser?._id || req.user?.id || null,
    });
    return res.status(201).json({ success: true, item: copy });
  } catch (error) { return oops(res, error); }
});

// ─── Audience ────────────────────────────────────────────────────────────────

router.post('/audience-preview', ...admin, async (req, res) => {
  try {
    return res.json({ success: true, ...(await previewAudience(req.body?.audience || req.body || {})) });
  } catch (error) { return oops(res, error); }
});

router.get('/segment-options', ...admin, async (_req, res) => {
  try {
    const [plans, acquisitionSources, instances] = await Promise.all([
      (async () => {
        const PlanConfig = (await import('../models/PlanConfig.js')).default;
        return PlanConfig.find({}).select('key name').lean().catch(() => []);
      })().catch(() => []),
      (await import('../models/EcomUser.js')).default.distinct('acquisitionSource').catch(() => []),
      WhatsAppInstance.find({ isActive: true }).select('_id instanceName customName status').lean().catch(() => []),
    ]);
    return res.json({
      success: true,
      plans: (plans || []).map((p) => ({ key: p.key, name: p.name || p.key })),
      acquisitionSources: (acquisitionSources || []).filter(Boolean),
      whatsappInstances: instances || [],
      roles: ['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', 'service_client', 'marketing'],
    });
  } catch (error) { return oops(res, error); }
});

// ─── Envoi ───────────────────────────────────────────────────────────────────

router.post('/campaigns/:id/test', ...admin, async (req, res) => {
  try {
    const campaign = await PlatformCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    const results = await dispatch.sendTest(campaign, {
      emails: req.body?.emails || campaign.audience?.testEmails || [],
      phones: req.body?.phones || campaign.audience?.testPhones || [],
    });
    return res.json({ success: true, results });
  } catch (error) { return oops(res, error); }
});

router.post('/campaigns/:id/send', ...admin, async (req, res) => {
  try {
    const campaign = await PlatformCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'Campagne introuvable' });
    if (campaign.status === 'sending') return res.status(409).json({ success: false, error: 'Envoi déjà en cours' });
    if (!campaign.channels?.length) return res.status(400).json({ success: false, error: 'Aucun canal sélectionné' });

    // Réponse immédiate : une liste de plusieurs milliers ne tient pas dans le
    // délai d'une requête HTTP. La suite se suit via /campaigns/:id.
    res.json({ success: true, started: true });
    dispatch.runCampaign(campaign._id).catch((e) => console.error('[marketing] run:', e));
  } catch (error) { return oops(res, error); }
});

router.post('/campaigns/:id/pause', ...admin, async (req, res) => {
  try { await dispatch.pauseCampaign(req.params.id); return res.json({ success: true }); }
  catch (error) { return oops(res, error); }
});

router.post('/campaigns/:id/resume', ...admin, async (req, res) => {
  try { await dispatch.resumeCampaign(req.params.id); return res.json({ success: true }); }
  catch (error) { return oops(res, error); }
});

router.post('/campaigns/:id/cancel', ...admin, async (req, res) => {
  try { await dispatch.cancelCampaign(req.params.id); return res.json({ success: true }); }
  catch (error) { return oops(res, error); }
});

router.get('/campaigns/:id/recipients', ...admin, async (req, res) => {
  try {
    const q = { campaignId: req.params.id };
    if (req.query.channel) q.channel = req.query.channel;
    if (req.query.status) q.status = req.query.status;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const [items, total] = await Promise.all([
      PlatformRecipient.find(q).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit)
        .select('channel email phone name status skipReason error sentAt openedAt clickedAt unsubscribedAt').lean(),
      PlatformRecipient.countDocuments(q),
    ]);
    return res.json({ success: true, items, total, page, limit });
  } catch (error) { return oops(res, error); }
});

// ─── Liste de suppression ────────────────────────────────────────────────────

router.get('/suppressions', ...admin, async (req, res) => {
  try {
    const q = {};
    if (req.query.reason) q.reason = req.query.reason;
    if (req.query.search) q.email = { $regex: String(req.query.search), $options: 'i' };
    const items = await EmailSuppression.find(q).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, items, total: await EmailSuppression.countDocuments(q) });
  } catch (error) { return oops(res, error); }
});

router.post('/suppressions', ...admin, async (req, res) => {
  try {
    const emails = (Array.isArray(req.body?.emails) ? req.body.emails : [req.body?.email])
      .map((e) => String(e || '').toLowerCase().trim()).filter(Boolean);
    await Promise.all(emails.map((email) => EmailSuppression.updateOne(
      { email },
      { $set: { reason: req.body?.reason || 'manual', hard: true, detail: req.body?.detail || 'Ajout manuel' } },
      { upsert: true },
    )));
    return res.json({ success: true, added: emails.length });
  } catch (error) { return oops(res, error, 400); }
});

router.delete('/suppressions/:id', ...admin, async (req, res) => {
  try { await EmailSuppression.deleteOne({ _id: req.params.id }); return res.json({ success: true }); }
  catch (error) { return oops(res, error); }
});

// ─── Inscrits plateforme ─────────────────────────────────────────────────────

router.get('/subscribers', ...admin, async (req, res) => {
  try {
    const q = {};
    if (req.query.search) q.email = { $regex: String(req.query.search), $options: 'i' };
    if (req.query.source) q.source = req.query.source;
    const items = await PlatformSubscriber.find(q).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, items, total: await PlatformSubscriber.countDocuments(q) });
  } catch (error) { return oops(res, error); }
});

router.post('/subscribers', ...admin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    let added = 0;
    for (const row of rows) {
      const email = String(row?.email || '').toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      await PlatformSubscriber.updateOne(
        { email },
        { $set: { name: row.name || '', phone: row.phone || '', country: row.country || '', source: row.source || 'import', isActive: true } },
        { upsert: true },
      );
      added += 1;
    }
    return res.json({ success: true, added, ignored: rows.length - added });
  } catch (error) { return oops(res, error, 400); }
});

// ─── Agent de campagne ───────────────────────────────────────────────────────
// L'agent écrit, cible, mesure et corrige lui-même. Il ne DÉCLENCHE pas
// l'envoi : /campaigns/:id/send reste la seule porte, derrière un clic humain.
// Un envoi de masse ne se rattrape pas, et lire « ok » dans une phrase ne
// suffit pas à engager plusieurs milliers de messages.
router.post('/ai/agent', ...admin, async (req, res) => {
  try {
    const { campaignId, history } = req.body || {};
    if (!campaignId) return res.status(400).json({ success: false, error: 'Campagne manquante' });
    return res.json({ success: true, ...(await marketingAgent.runAgent({ campaignId, history })) });
  } catch (error) { return oops(res, error, 502); }
});

// ─── Assistant IA ────────────────────────────────────────────────────────────

router.post('/ai/draft', ...admin, async (req, res) => {
  try { return res.json({ success: true, ...(await marketingAi.draftCampaign(req.body || {})) }); }
  catch (error) { return oops(res, error, 502); }
});

router.post('/ai/subject-variants', ...admin, async (req, res) => {
  try { return res.json({ success: true, variants: await marketingAi.subjectVariants(req.body || {}) }); }
  catch (error) { return oops(res, error, 502); }
});

router.post('/ai/spam-audit', ...admin, async (req, res) => {
  try { return res.json({ success: true, ...(await marketingAi.spamAudit(req.body || {})) }); }
  catch (error) { return oops(res, error, 502); }
});

// Corrige au lieu de se contenter de signaler. La partie mécanique aboutit
// toujours ; la réécriture est un bonus qui n'empêche jamais le reste.
router.post('/ai/spam-fix', ...admin, async (req, res) => {
  try { return res.json({ success: true, ...(await marketingAi.applyFixes(req.body || {})) }); }
  catch (error) { return oops(res, error, 502); }
});

// ─── Délivrabilité ───────────────────────────────────────────────────────────

router.get('/deliverability', ...admin, async (_req, res) => {
  try { return res.json({ success: true, ...(await deliverability.fullReport()) }); }
  catch (error) { return oops(res, error); }
});

export default router;
