import express from 'express';
import { Resend } from 'resend';
import EmailCampaign from '../models/EmailCampaign.js';
import Campaign from '../models/Campaign.js';
import Client from '../models/Client.js';
import evolutionApiService from '../services/evolutionApiService.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import externalWhatsappApi from '../services/externalWhatsappApiService.js';

// ─── WhatsApp helpers (shared with campaigns.js) ─────────────────────────────
const sanitizePhoneNumber = (phone) => phone?.replace(/\D/g, '') || null;

function renderMessage(template, client, orderData = null) {
  const orderInfo = orderData || client;
  return template
    .replace(/\{firstName\}/g, client.firstName || orderInfo.clientName?.split(' ')[0] || '')
    .replace(/\{lastName\}/g, client.lastName || orderInfo.clientName?.split(' ').slice(1).join(' ') || '')
    .replace(/\{fullName\}/g, client.firstName && client.lastName ? [client.firstName, client.lastName].join(' ') : (orderInfo.clientName || ''))
    .replace(/\{phone\}/g, client.phone || orderInfo.clientPhone || '')
    .replace(/\{city\}/g, client.city || orderInfo.city || '')
    .replace(/\{product\}/g, (client.products || []).join(', ') || orderInfo.product || '')
    .replace(/\{totalOrders\}/g, String(client.totalOrders || 1))
    .replace(/\{totalSpent\}/g, String(client.totalSpent || 0))
    .replace(/\{status\}/g, client._orderStatus || orderInfo.status || '')
    .replace(/\{price\}/g, String(orderInfo.price || 0))
    .replace(/\{quantity\}/g, String(orderInfo.quantity || 1));
}

function toMongoIn(v) {
  const arr = Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
  if (!arr.length) return null;
  return arr.length === 1 ? arr[0] : { $in: arr };
}

function buildClientFilter(workspaceId, targetFilters) {
  const filter = { workspaceId };
  const clientStatus = toMongoIn(targetFilters.clientStatus);
  if (clientStatus) filter.status = clientStatus;
  if (targetFilters.city) {
    const cities = Array.isArray(targetFilters.city) ? targetFilters.city : [targetFilters.city];
    filter.$or = cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } }));
  }
  if (targetFilters.product) {
    const prods = Array.isArray(targetFilters.product) ? targetFilters.product : [targetFilters.product];
    filter.products = prods.length > 1 ? { $in: prods } : prods[0];
  }
  if (targetFilters.minOrders > 0) filter.totalOrders = { $gte: targetFilters.minOrders };
  return filter;
}

const router = express.Router();

const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY non configuré');
  return new Resend(key);
};

const FROM_DEFAULT = process.env.EMAIL_FROM || 'contact@infomania.store';
const FROM_NAME_DEFAULT = process.env.EMAIL_FROM_NAME || 'Ecom Cockpit';

// ─── Middleware: super_admin OR ecom_admin ───────────────────────────────────
const requireMarketingAccess = [requireEcomAuth, (req, res, next) => {
  const role = req.ecomUser?.role;
  if (role === 'super_admin' || role === 'ecom_admin') return next();
  return res.status(403).json({ success: false, message: 'Accès refusé' });
}];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHtml(campaign, user = null) {
  const brandColor = '#4f46e5';
  const fromName = campaign.fromName || FROM_NAME_DEFAULT;
  let body = campaign.bodyHtml || `<p>${(campaign.bodyText || '').replace(/\n/g, '<br/>')}</p>`;
  
  // Substitution de variables personnalisées
  if (user) {
    body = body
      .replace(/\{\{prenom\}\}/g, user.name || '')
      .replace(/\{\{name\}\}/g, user.name || '')
      .replace(/\{\{email\}\}/g, user.email || '')
      .replace(/\{\{workspace\}\}/g, user.workspaceName || '')
      .replace(/\{\{role\}\}/g, user.role || '');
  } else {
    // Valeurs par défaut si pas d'utilisateur
    body = body
      .replace(/\{\{prenom\}\}/g, 'Bonjour')
      .replace(/\{\{name\}\}/g, 'Bonjour')
      .replace(/\{\{email\}\}/g, '')
      .replace(/\{\{workspace\}\}/g, '')
      .replace(/\{\{role\}\}/g, '');
  }
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${campaign.subject}</title>
  <style>
    body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .wrapper{max-width:600px;margin:0 auto;padding:32px 16px}
    .card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:${brandColor};padding:24px 32px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:20px;font-weight:700}
    .body{padding:32px;color:#374151;font-size:15px;line-height:1.7}
    .footer{padding:16px 32px;text-align:center;background:#f8f9ff;border-top:1px solid #eee}
    .footer p{color:#aaa;font-size:12px;margin:4px 0}
    @media(max-width:600px){.body{padding:20px}}
  </style>
</head>
<body>
  ${campaign.previewText ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#fff">${campaign.previewText}</div>` : ''}
  <div class="wrapper"><div class="card">
    <div class="header"><h1>${fromName}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${fromName}</p>
      <p><a href="https://ecomcookpit.site/" style="color:#888;text-decoration:none">Accéder à la plateforme</a></p>
    </div>
  </div></div>
</body>
</html>`;
}

async function resolveRecipients(campaign) {
  const recipients = [];

  if (campaign.audienceType === 'custom_list') {
    (campaign.customEmails || []).forEach(e => e && recipients.push({ 
      email: e.toLowerCase().trim(), 
      name: '', 
      workspaceName: '', 
      role: '' 
    }));
  } else if (campaign.audienceType === 'all_users') {
    const users = await EcomUser.find({ isActive: true })
      .populate('workspaceId', 'name')
      .select('email name role workspaceId')
      .lean();
    users.forEach(u => u.email && recipients.push({ 
      email: u.email, 
      name: u.name || '', 
      workspaceName: u.workspaceId?.name || '', 
      role: u.role || '' 
    }));
  } else if (campaign.audienceType === 'workspace_users') {
    const query = { isActive: true };
    if (campaign.workspaceId) query.workspaceId = campaign.workspaceId;
    if (campaign.segmentFilter?.roles?.length) query.role = { $in: campaign.segmentFilter.roles };
    if (campaign.segmentFilter?.hasWorkspace === true) query.workspaceId = { $ne: null };
    if (campaign.segmentFilter?.hasWorkspace === false) query.workspaceId = null;
    const users = await EcomUser.find(query)
      .populate('workspaceId', 'name')
      .select('email name role workspaceId')
      .lean();
    users.forEach(u => u.email && recipients.push({ 
      email: u.email, 
      name: u.name || '', 
      workspaceName: u.workspaceId?.name || '', 
      role: u.role || '' 
    }));
  }

  return recipients;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns — list all campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns', requireMarketingAccess, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) {
      query.workspaceId = req.workspaceId;
    }
    if (status) query.status = status;

    const total = await EmailCampaign.countDocuments(query);
    const campaigns = await EmailCampaign.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select('-results -bodyHtml -bodyText')
      .lean();

    res.json({ success: true, data: { campaigns, total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('marketing/campaigns GET:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns/:id — get one campaign
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns — create campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns', requireMarketingAccess, async (req, res) => {
  try {
    const {
      name, subject, previewText, fromName, fromEmail, replyTo,
      bodyHtml, bodyText, audienceType, customEmails, segmentFilter,
      scheduledAt, tags
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Nom requis' });
    if (!subject?.trim()) return res.status(400).json({ success: false, message: 'Sujet requis' });
    if (!bodyHtml?.trim() && !bodyText?.trim()) return res.status(400).json({ success: false, message: 'Contenu requis' });

    const campaign = new EmailCampaign({
      name: name.trim(),
      subject: subject.trim(),
      previewText: previewText?.trim() || '',
      fromName: fromName?.trim() || FROM_NAME_DEFAULT,
      fromEmail: fromEmail?.trim() || FROM_DEFAULT,
      replyTo: replyTo?.trim() || '',
      bodyHtml: bodyHtml || '',
      bodyText: bodyText || '',
      audienceType: audienceType || 'custom_list',
      customEmails: (customEmails || []).map(e => e.toLowerCase().trim()).filter(Boolean),
      segmentFilter: segmentFilter || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'draft',
      workspaceId: req.ecomUser.role === 'ecom_admin' ? (req.workspaceId || null) : null,
      createdBy: req.ecomUser._id,
      tags: tags || []
    });

    await campaign.save();
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    console.error('marketing/campaigns POST:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/ecom/marketing/campaigns/:id — update campaign (draft only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      return res.status(400).json({ success: false, message: 'Impossible de modifier une campagne déjà envoyée' });
    }

    const fields = ['name', 'subject', 'previewText', 'fromName', 'fromEmail', 'replyTo',
      'bodyHtml', 'bodyText', 'audienceType', 'customEmails', 'segmentFilter', 'scheduledAt', 'tags'];
    fields.forEach(f => { if (req.body[f] !== undefined) campaign[f] = req.body[f]; });
    if (req.body.scheduledAt) campaign.status = 'scheduled';

    await campaign.save();
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/ecom/marketing/campaigns/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/campaigns/:id', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer une campagne en cours d\'envoi' });
    }
    await campaign.deleteOne();
    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/send — send campaign now
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/send', requireMarketingAccess, async (req, res) => {
  try {
    console.log(`🔍 [marketing] Request body:`, JSON.stringify(req.body, null, 2));
    
    // ── Tentative 1 : campagne email ──────────────────────────────────────────
    const emailCampaign = await EmailCampaign.findById(req.params.id);

    // ── Tentative 2 : campagne WhatsApp avec SSE streaming ─────────────────────
    if (!emailCampaign) {
      const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

      // Utiliser l'instance sélectionnée par l'utilisateur ou la première par défaut
      let instance;
      if (req.body.instanceId) {
        instance = await externalWhatsappApi.getInstance(req.body.instanceId, req.ecomUser._id);
        if (!instance || !instance.isActive) {
          return res.status(400).json({ success: false, message: 'Instance WhatsApp sélectionnée introuvable ou inactive.' });
        }
        console.log(`🎯 Instance sélectionnée par l'utilisateur: "${instance.customName || instance.instanceName}"`);
      } else {
        let instances = await externalWhatsappApi.findInstances({ 
          workspaceId: req.workspaceId, 
          isActive: true, 
          status: ['connected', 'active'] 
        });
        if (instances.length === 0) {
          instances = await externalWhatsappApi.findInstances({ 
            userId: req.ecomUser._id, 
            isActive: true, 
            status: ['connected', 'active'] 
          });
        }
        if (instances.length === 0) return res.status(400).json({ success: false, message: 'Aucune instance WhatsApp connectée. Configurez une instance dans "Connexion WhatsApp".' });
        instance = instances.sort((a, b) => (b.defaultPart || 50) - (a.defaultPart || 50))[0];
        console.log(`🎯 Instance par défaut: "${instance.customName || instance.instanceName}" (defaultPart: ${instance.defaultPart || 50}%)`);
      }

      const instanceStatus = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
      if (!instanceStatus || !instanceStatus.instance || instanceStatus.instance.state !== 'open') {
        return res.status(400).json({ success: false, message: `L'instance "${instance.customName || instance.instanceName}" n'est pas connectée à WhatsApp. Scannez le QR code pour vous connecter.` });
      }

      if (campaign.status === 'sending') return res.status(400).json({ success: false, message: 'Envoi déjà en cours' });

      // Résoudre les destinataires
      let recipients = [];
      if (campaign.recipientSnapshotIds?.length > 0) {
        const clients = await Client.find({ _id: { $in: campaign.recipientSnapshotIds } }).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').lean();
        recipients = clients.filter(c => c.phone).map(c => ({ phone: c.phone, client: c }));
      } else if (campaign.selectedClientIds?.length > 0) {
        const clients = await Client.find({ _id: { $in: campaign.selectedClientIds } }).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').lean();
        recipients = clients.filter(c => c.phone).map(c => ({ phone: c.phone, client: c }));
      } else if (campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
        const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
        filter.phone = { $exists: true, $ne: '' };
        const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').limit(1000).lean();
        recipients = clients.map(c => ({ phone: c.phone, client: c }));
      }

      if (recipients.length === 0) return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé pour cette campagne' });

      // Debug: vérifier les médias de la campagne
      console.log('📸 [Campaign Media Debug]:', {
        hasMedia: !!campaign.media,
        mediaType: campaign.media?.type,
        mediaUrl: campaign.media?.url,
        mediaFileName: campaign.media?.fileName
      });

      // ══ SSE : diffusion temps réel ════════════════════════════════════════════
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const emit = (event, data) => {
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (res.flush) res.flush();
        } catch (_) {}
      };

      let interrupted = false;
      req.on('close', () => { interrupted = true; });

      campaign.status = 'sending';
      campaign.pauseRequested = false;
      await campaign.save();

      emit('start', { total: recipients.length, campaignName: campaign.name, instance: instance.customName || instance.instanceName });
      console.log(`📤 Envoi SSE "${campaign.name}" → ${recipients.length} destinataires via ${instance.instanceName}`);

      let sent = 0, failed = 0, skipped = 0;

      for (const { phone, client } of recipients) {
        // Vérifier interruption client
        if (interrupted) {
          campaign.status = 'interrupted';
          campaign.sendProgress = { sent, failed, skipped, targeted: recipients.length };
          await campaign.save();
          return;
        }

        // Vérifier demande de pause
        const fresh = await Campaign.findById(campaign._id).select('pauseRequested').lean();
        if (fresh?.pauseRequested) {
          campaign.status = 'paused';
          campaign.pauseRequested = false;
          campaign.sendProgress = { sent, failed, skipped, targeted: recipients.length };
          await campaign.save();
          emit('paused', { sent, failed, skipped, total: recipients.length });
          res.end();
          return;
        }

        const cleanNumber = sanitizePhoneNumber(phone);
        const clientName = [client.firstName, client.lastName].filter(Boolean).join(' ') || phone;

        if (!cleanNumber) {
          skipped++;
          emit('progress', { sent, failed, skipped, total: recipients.length, current: { name: clientName, phone, status: 'skipped', reason: 'Numéro invalide' } });
          continue;
        }

        const message = renderMessage(campaign.messageTemplate, client, null);
        
        // Envoyer le média si présent (image ou vocal)
        let result;
        if (campaign.media?.type === 'image' && campaign.media?.url) {
          // Envoyer l'image avec le message en caption
          result = await evolutionApiService.sendMedia(
            instance.instanceName, 
            instance.instanceToken, 
            cleanNumber, 
            campaign.media.url,
            message, // Le message devient la légende de l'image
            campaign.media.fileName || 'image.jpg'
          );
        } else if (campaign.media?.type === 'audio' && campaign.media?.url) {
          // Envoyer le vocal d'abord, puis le message texte
          const audioResult = await evolutionApiService.sendAudio(
            instance.instanceName, 
            instance.instanceToken, 
            cleanNumber, 
            campaign.media.url
          );
          
          // Si le vocal est envoyé avec succès et qu'il y a un message texte, l'envoyer aussi
          if (audioResult.success && message.trim()) {
            await new Promise(r => setTimeout(r, 2000)); // Petit délai entre vocal et texte
            result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
          } else {
            result = audioResult;
          }
        } else {
          // Message texte simple
          result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
        }

        const index = sent + failed + skipped + 1;
        if (result.success) {
          sent++;
          emit('progress', { sent, failed, skipped, total: recipients.length, index, current: { name: clientName, phone: cleanNumber, status: 'sent', reason: 'Envoyé' } });
        } else if (result.noWhatsApp) {
          skipped++;
          emit('progress', { sent, failed, skipped, total: recipients.length, index, current: { name: clientName, phone: cleanNumber, status: 'skipped', reason: 'Pas sur WhatsApp' } });
        } else {
          failed++;
          emit('progress', { sent, failed, skipped, total: recipients.length, index, current: { name: clientName, phone: cleanNumber, status: 'failed', reason: String(result.error || 'Erreur inconnue') } });
        }

        await new Promise(r => setTimeout(r, 10000));
      }

      campaign.status = (sent === 0 && failed > 0) ? 'failed' : 'sent';
      campaign.sentAt = new Date();
      campaign.sendProgress = { sent, failed, skipped, targeted: recipients.length };
      campaign.stats = { ...(campaign.stats?.toObject?.() || campaign.stats || {}), sent, failed, targeted: recipients.length };
      await campaign.save();

      emit('done', { sent, failed, skipped, total: recipients.length, campaignName: campaign.name });
      console.log(`✅ Campagne SSE terminée : ${sent} envoyés, ${failed} échecs, ${skipped} ignorés`);
      res.end();
      return;
    }

    // ── Suite du traitement email normal ──────────────────────────────────────
    const campaign = emailCampaign;
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Envoi déjà en cours' });
    }
    if (campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Campagne déjà envoyée' });
    }

    const recipients = await resolveRecipients(campaign);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé' });
    }

    // Mark as sending immediately
    campaign.status = 'sending';
    campaign.stats.targeted = recipients.length;
    campaign.results = [];
    await campaign.save();

    // Respond immediately, send in background
    res.json({ success: true, message: `Envoi démarré vers ${recipients.length} destinataires`, data: { targeted: recipients.length } });

    // Background send
    const resend = getResend();
    const from = `${campaign.fromName || FROM_NAME_DEFAULT} <${campaign.fromEmail || FROM_DEFAULT}>`;

    let sent = 0;
    let failed = 0;
    const results = [];

    // Send emails one by one with delay and personalization
    for (const recipient of recipients) {
      try {
        // Generate personalized HTML for each recipient
        const personalizedHtml = buildHtml(campaign, recipient);
        
        // Personalize subject too
        let personalizedSubject = campaign.subject;
        if (recipient.name) {
          personalizedSubject = personalizedSubject.replace(/\{\{prenom\}\}/g, recipient.name).replace(/\{\{name\}\}/g, recipient.name);
        } else {
          personalizedSubject = personalizedSubject.replace(/\{\{prenom\}\}/g, 'Bonjour').replace(/\{\{name\}\}/g, 'Bonjour');
        }
        
        const resp = await resend.emails.send({
          from,
          to: [recipient.email],
          subject: personalizedSubject,
          html: personalizedHtml,
          text: campaign.bodyText || undefined,
          reply_to: campaign.replyTo || undefined,
          headers: { 'X-Campaign-Id': campaign._id.toString() }
        });
        sent++;
        results.push({ email: recipient.email, status: 'sent', sentAt: new Date(), resendId: resp?.data?.id || null });
      } catch (err) {
        failed++;
        results.push({ email: recipient.email, status: 'failed', error: err.message, sentAt: new Date() });
      }
      
      // Delay between 3 and 5 seconds before next email
      const delay = 3000 + Math.random() * 2000; // 3000ms to 5000ms
      await new Promise(r => setTimeout(r, delay));
    }

    campaign.status = failed === recipients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats.sent = sent;
    campaign.stats.failed = failed;
    campaign.results = results.slice(0, 500); // cap stored results
    await campaign.save();

    console.log(`✅ Campagne email "${campaign.name}" envoyée: ${sent} ok, ${failed} échecs`);
  } catch (err) {
    console.error('marketing/send:', err);
    // Try to mark as failed
    try {
      await EmailCampaign.findByIdAndUpdate(req.params.id, { status: 'failed' });
    } catch (_) {}
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/test — send test email
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/test', requireMarketingAccess, async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) return res.status(400).json({ success: false, message: 'Email de test requis' });

    const campaign = await EmailCampaign.findById(req.params.id).lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

    const resend = getResend();
    const html = buildHtml(campaign);
    const from = `${campaign.fromName || FROM_NAME_DEFAULT} <${campaign.fromEmail || FROM_DEFAULT}>`;

    await resend.emails.send({
      from,
      to: [testEmail],
      subject: `[TEST] ${campaign.subject}`,
      html,
      text: campaign.bodyText || undefined
    });

    res.json({ success: true, message: `Email de test envoyé à ${testEmail}` });
  } catch (err) {
    console.error('marketing/test:', err);
    res.status(500).json({ success: false, message: `Erreur d'envoi: ${err.message}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/duplicate — duplicate a campaign
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/duplicate', requireMarketingAccess, async (req, res) => {
  try {
    const original = await EmailCampaign.findById(req.params.id).lean();
    if (!original) return res.status(404).json({ success: false, message: 'Campagne introuvable' });

    const { _id, createdAt, updatedAt, sentAt, results, stats, ...rest } = original;
    const copy = new EmailCampaign({
      ...rest,
      name: `${original.name} (copie)`,
      status: 'draft',
      scheduledAt: null,
      sentAt: null,
      stats: { targeted: 0, sent: 0, failed: 0, opened: 0, clicked: 0 },
      results: [],
      createdBy: req.ecomUser._id
    });
    await copy.save();
    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/campaigns/:id/results — get send results
// ─────────────────────────────────────────────────────────────────────────────
router.get('/campaigns/:id/results', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await EmailCampaign.findById(req.params.id).select('name stats results status sentAt').lean();
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/stats — global marketing stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', requireMarketingAccess, async (req, res) => {
  try {
    const query = {};
    if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) {
      query.workspaceId = req.workspaceId;
    }

    const [total, byStatus, totals] = await Promise.all([
      EmailCampaign.countDocuments(query),
      EmailCampaign.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      EmailCampaign.aggregate([
        { $match: { ...query, status: 'sent' } },
        { $group: {
          _id: null,
          totalSent: { $sum: '$stats.sent' },
          totalFailed: { $sum: '$stats.failed' },
          totalTargeted: { $sum: '$stats.targeted' }
        }}
      ])
    ]);

    const statusMap = {};
    byStatus.forEach(s => { statusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        total,
        byStatus: statusMap,
        totals: totals[0] || { totalSent: 0, totalFailed: 0, totalTargeted: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/marketing/variables — list available substitution variables
// ─────────────────────────────────────────────────────────────────────────────
router.get('/variables', requireMarketingAccess, async (req, res) => {
  try {
    const variables = [
      { tag: '{{prenom}}', description: 'Prénom de l\'utilisateur', example: 'Jean' },
      { tag: '{{name}}', description: 'Nom complet de l\'utilisateur', example: 'Jean Dupont' },
      { tag: '{{email}}', description: 'Email de l\'utilisateur', example: 'jean@example.com' },
      { tag: '{{workspace}}', description: 'Nom du workspace', example: 'Ma Boutique' },
      { tag: '{{role}}', description: 'Rôle de l\'utilisateur', example: 'admin' }
    ];
    
    res.json({ success: true, data: { variables } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/audience-preview — preview audience count
// ─────────────────────────────────────────────────────────────────────────────
router.post('/audience-preview', requireMarketingAccess, async (req, res) => {
  try {
    const { audienceType, customEmails, segmentFilter } = req.body;
    let count = 0;

    if (audienceType === 'custom_list') {
      count = (customEmails || []).filter(e => e?.includes('@')).length;
    } else if (audienceType === 'all_users') {
      count = await EcomUser.countDocuments({ isActive: true });
    } else if (audienceType === 'workspace_users') {
      const query = { isActive: true };
      if (req.ecomUser.role === 'ecom_admin' && req.workspaceId) query.workspaceId = req.workspaceId;
      if (segmentFilter?.roles?.length) query.role = { $in: segmentFilter.roles };
      if (segmentFilter?.hasWorkspace === true) query.workspaceId = { $ne: null };
      if (segmentFilter?.hasWorkspace === false) query.workspaceId = null;
      count = await EcomUser.countDocuments(query);
    }

    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/pause
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/pause', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId, status: 'sending' },
      { pauseRequested: true },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée ou pas en cours d\'envoi' });
    res.json({ success: true, message: 'Pause demandée, arrêt après le message en cours...' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/resume  (remet en draft pour relancer)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/resume', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId, status: { $in: ['paused', 'interrupted', 'failed'] } },
      { status: 'draft', pauseRequested: false },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée ou ne peut pas être reprise' });
    res.json({ success: true, message: 'Campagne prête. Cliquez sur Envoyer pour relancer.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ecom/marketing/campaigns/:id/restart  (relancer depuis le début)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/campaigns/:id/restart', requireMarketingAccess, async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { status: 'draft', pauseRequested: false, sendProgress: { sent: 0, failed: 0, skipped: 0, targeted: 0 }, sentAt: null },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne introuvable' });
    res.json({ success: true, message: 'Campagne réinitialisée. Prête à être relancée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
