import crypto from 'crypto';
import PlatformCampaign from '../models/PlatformCampaign.js';
import PlatformRecipient from '../models/PlatformRecipient.js';
import EmailSuppression from '../models/EmailSuppression.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import { sendMail, marketingFrom, marketingReplyTo } from '../core/notifications/mailer.js';
import { sendPushNotificationToUser } from './pushService.js';
import { resolveAudience } from './platformAudienceService.js';
import { renderCampaignEmail, htmlToPlainText } from './platformEmailTemplate.js';

/**
 * Exécution d'une campagne plateforme, canal par canal.
 *
 * Trois choix structurent le fichier :
 *
 *  1. L'audience est FIGÉE au démarrage dans PlatformRecipient. Recalculer le
 *     segment à chaque reprise ferait entrer des inscrits arrivés entre-temps
 *     au milieu d'un envoi, et sortir ceux dont le plan a changé — impossible
 *     de savoir alors qui a reçu quoi.
 *  2. Chaque envoi est marqué AVANT sa tentative réseau. Si le process meurt
 *     entre l'appel et l'écriture, on préfère un manquant à un doublon.
 *  3. La cadence est lue depuis la base à chaque tour, pas capturée au départ :
 *     ça permet de ralentir ou de mettre en pause une campagne déjà lancée.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newToken = () => crypto.randomBytes(16).toString('hex');

// Registre des campagnes en cours dans CE process — évite qu'un double clic
// sur « Envoyer » lance deux boucles sur la même campagne.
const running = new Set();

// ─── Constitution de l'audience ──────────────────────────────────────────────

export async function buildRecipients(campaign) {
  const { recipients } = await resolveAudience(campaign.audience);
  const channels = campaign.channels || [];
  const docs = [];

  for (const r of recipients) {
    for (const channel of channels) {
      let skipReason = '';
      if (channel === 'email') {
        if (!r.email) skipReason = 'no_email';
        else if (r.emailSuppressed) skipReason = 'suppressed';
      } else if (channel === 'whatsapp') {
        if (!r.phone) skipReason = 'no_phone';
      } else if (channel === 'push') {
        // Sans compte utilisateur il n'y a pas d'appareil enregistré : un
        // inscrit newsletter n'a jamais installé l'app.
        if (!r.userId) skipReason = 'no_push_token';
      }

      docs.push({
        campaignId: campaign._id,
        channel,
        userId: r.userId,
        subscriberId: r.subscriberId,
        email: r.email || '',
        phone: r.phone || '',
        name: r.name || '',
        token: newToken(),
        status: skipReason ? 'skipped' : 'pending',
        skipReason,
      });
    }
  }

  if (docs.length) await PlatformRecipient.insertMany(docs, { ordered: false }).catch(() => {});

  const targeted = docs.filter((d) => !d.skipReason).length;
  const byChannel = {};
  for (const channel of channels) {
    byChannel[`stats.byChannel.${channel}.targeted`] = docs.filter((d) => d.channel === channel && !d.skipReason).length;
  }
  await PlatformCampaign.updateOne({ _id: campaign._id }, { $set: { 'stats.targeted': targeted, ...byChannel } });

  return { total: docs.length, targeted };
}

// ─── Envois unitaires ────────────────────────────────────────────────────────

async function sendEmailTo(campaign, recipient) {
  const { html, text, headers } = renderCampaignEmail({ campaign, recipient });
  const fromName = String(campaign.content?.email?.fromName || '').trim();
  const from = fromName
    ? marketingFrom().replace(/^[^<]*</, `${fromName} <`)
    : marketingFrom();

  const result = await sendMail({
    from,
    to: recipient.email,
    subject: String(campaign.content?.email?.subject || '')
      .replace(/\{firstName\}/g, String(recipient.name || '').trim().split(/\s+/)[0] || ''),
    html,
    text,
    headers,
    replyTo: marketingReplyTo() || undefined,
    source: 'platform_campaign',
    meta: { campaignId: String(campaign._id), recipientId: String(recipient._id) },
  });

  if (!result.success) throw new Error(result.error || 'Envoi email refusé');
  return result.id || '';
}

async function resolveWhatsappInstance(campaign) {
  if (campaign.whatsappInstanceId) {
    const inst = await WhatsAppInstance.findById(campaign.whatsappInstanceId).lean();
    if (inst) return inst;
  }
  // À défaut, l'instance active de celui qui a créé la campagne.
  const owned = await WhatsAppInstance.findOne({
    userId: String(campaign.createdBy || ''),
    isActive: true,
    status: { $in: ['connected', 'active'] },
  }).lean();
  return owned || null;
}

async function sendWhatsappTo(campaign, recipient, instance) {
  if (!instance) throw new Error('Aucune instance WhatsApp connectée');
  const firstName = String(recipient.name || '').trim().split(/\s+/)[0] || '';
  const body = String(campaign.content?.whatsapp?.text || '')
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{name\}/g, recipient.name || '');

  const media = campaign.content?.whatsapp;
  // evolutionApiService renvoie { success, data } — l'identifiant du message
  // est dans data.key.id, pas dans un champ messageId.
  const res = (media?.mediaUrl && media.mediaType === 'image')
    ? await evolutionApiService.sendMedia(instance.instanceName, instance.instanceToken, recipient.phone, media.mediaUrl, body)
    : await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, recipient.phone, body);

  if (!res?.success) throw new Error(res?.error || 'Envoi WhatsApp refusé');
  return res?.data?.key?.id || '';
}

async function sendPushTo(campaign, recipient) {
  const push = campaign.content?.push || {};
  await sendPushNotificationToUser(String(recipient.userId), {
    title: push.title || campaign.name,
    body: push.body || '',
    url: push.url || '/ecom/dashboard',
    icon: push.icon || undefined,
    data: { campaignId: String(campaign._id), kind: campaign.kind },
  });
  return '';
}

// ─── Boucle d'exécution ──────────────────────────────────────────────────────

async function runChannel(campaignId, channel, instance) {
  const perMinuteField = channel === 'whatsapp' ? 'whatsappPerMinute' : 'emailPerMinute';

  for (;;) {
    const campaign = await PlatformCampaign.findById(campaignId);
    if (!campaign) return;
    if (campaign.status !== 'sending') return; // pause, annulation, terminé

    const recipient = await PlatformRecipient.findOne({ campaignId, channel, status: 'pending' });
    if (!recipient) return;

    // Marqué avant la tentative : un crash laisse un manquant, jamais un doublon.
    recipient.status = 'sent';
    recipient.sentAt = new Date();
    await recipient.save();

    try {
      let messageId = '';
      if (channel === 'email') messageId = await sendEmailTo(campaign, recipient);
      else if (channel === 'whatsapp') messageId = await sendWhatsappTo(campaign, recipient, instance);
      else if (channel === 'push') messageId = await sendPushTo(campaign, recipient);

      recipient.providerMessageId = messageId || '';
      await recipient.save();
      await PlatformCampaign.updateOne({ _id: campaignId }, { $inc: { [`stats.byChannel.${channel}.sent`]: 1 } });
    } catch (error) {
      recipient.status = 'failed';
      recipient.error = String(error?.message || error).slice(0, 400);
      await recipient.save();
      await PlatformCampaign.updateOne({ _id: campaignId }, { $inc: { [`stats.byChannel.${channel}.failed`]: 1 } });
      console.warn(`⚠️ [marketing] ${channel} → ${recipient.email || recipient.phone}: ${recipient.error}`);
    }

    // Cadence relue à chaque tour : ralentir une campagne en vol doit marcher.
    const perMinute = Math.max(1, Number(campaign.schedule?.[perMinuteField]) || (channel === 'whatsapp' ? 6 : 60));
    await sleep(Math.round(60000 / perMinute));
  }
}

export async function runCampaign(campaignId) {
  const key = String(campaignId);
  if (running.has(key)) return { alreadyRunning: true };
  running.add(key);

  try {
    const campaign = await PlatformCampaign.findById(campaignId);
    if (!campaign) return { error: 'Campagne introuvable' };

    const existing = await PlatformRecipient.countDocuments({ campaignId });
    if (!existing) await buildRecipients(campaign);

    await PlatformCampaign.updateOne({ _id: campaignId }, {
      $set: { status: 'sending', startedAt: campaign.startedAt || new Date(), lastError: '' },
    });

    const channels = campaign.channels || [];
    const instance = channels.includes('whatsapp') ? await resolveWhatsappInstance(campaign) : null;
    if (channels.includes('whatsapp') && !instance) {
      await PlatformCampaign.updateOne({ _id: campaignId }, {
        $set: { lastError: 'Aucune instance WhatsApp connectée — le canal WhatsApp a été ignoré' },
      });
    }

    // Les canaux tournent en parallèle : un email lent ne doit pas retarder
    // une notification push, qui est instantanée.
    await Promise.all(channels
      .filter((c) => c !== 'whatsapp' || instance)
      .map((c) => runChannel(campaignId, c, instance)));

    const fresh = await PlatformCampaign.findById(campaignId);
    if (fresh?.status === 'sending') {
      const left = await PlatformRecipient.countDocuments({ campaignId, status: 'pending' });
      await PlatformCampaign.updateOne({ _id: campaignId }, {
        $set: { status: left ? 'paused' : 'sent', finishedAt: left ? null : new Date() },
      });
    }
    return { ok: true };
  } catch (error) {
    await PlatformCampaign.updateOne({ _id: campaignId }, {
      $set: { status: 'failed', lastError: String(error?.message || error).slice(0, 400) },
    });
    return { error: String(error?.message || error) };
  } finally {
    running.delete(key);
  }
}

/** Envoi d'essai — n'écrit aucun destinataire et ne bouge aucune statistique. */
export async function sendTest(campaign, { emails = [], phones = [] } = {}) {
  const results = [];

  for (const email of emails.filter(Boolean)) {
    const fake = { _id: 'test', email, name: 'Test', token: `test-${newToken()}` };
    try {
      const { html, text, headers } = renderCampaignEmail({ campaign, recipient: fake });
      const r = await sendMail({
        from: marketingFrom(),
        to: email,
        subject: `[TEST] ${campaign.content?.email?.subject || campaign.name}`,
        html, text, headers,
        replyTo: marketingReplyTo() || undefined,
        source: 'platform_campaign_test',
        meta: { campaignId: String(campaign._id), test: true },
      });
      results.push({ channel: 'email', target: email, ok: !!r.success, error: r.error || '' });
    } catch (error) {
      results.push({ channel: 'email', target: email, ok: false, error: String(error?.message || error) });
    }
  }

  if (phones.filter(Boolean).length) {
    const instance = await resolveWhatsappInstance(campaign);
    for (const phone of phones.filter(Boolean)) {
      try {
        await sendWhatsappTo(campaign, { name: 'Test', phone }, instance);
        results.push({ channel: 'whatsapp', target: phone, ok: true, error: '' });
      } catch (error) {
        results.push({ channel: 'whatsapp', target: phone, ok: false, error: String(error?.message || error) });
      }
    }
  }

  return results;
}

export async function pauseCampaign(campaignId) {
  await PlatformCampaign.updateOne({ _id: campaignId, status: 'sending' }, { $set: { status: 'paused' } });
}

export async function resumeCampaign(campaignId) {
  await PlatformCampaign.updateOne({ _id: campaignId, status: 'paused' }, { $set: { status: 'sending' } });
  runCampaign(campaignId).catch(() => {});
}

export async function cancelCampaign(campaignId) {
  await PlatformCampaign.updateOne(
    { _id: campaignId, status: { $in: ['sending', 'paused', 'scheduled'] } },
    { $set: { status: 'cancelled', finishedAt: new Date() } },
  );
}

/** Enregistre une désinscription : liste de suppression + trace destinataire. */
export async function registerUnsubscribe({ campaignId, token, reason = 'unsubscribe' }) {
  const recipient = await PlatformRecipient.findOne({ campaignId, token });
  if (!recipient) return { ok: false };

  recipient.unsubscribedAt = new Date();
  await recipient.save();

  if (recipient.email) {
    await EmailSuppression.updateOne(
      { email: recipient.email },
      { $set: { reason, hard: true, campaignId, detail: 'Désinscription depuis un email marketing' } },
      { upsert: true },
    );
  }
  await PlatformCampaign.updateOne({ _id: campaignId }, { $inc: { 'stats.byChannel.email.unsubscribed': 1 } });
  return { ok: true, email: recipient.email };
}

export default {
  buildRecipients, runCampaign, sendTest,
  pauseCampaign, resumeCampaign, cancelCampaign, registerUnsubscribe,
};
