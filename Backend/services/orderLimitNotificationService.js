/**
 * orderLimitNotificationService.js
 *
 * Notifie l'admin quand la limite de commandes du plan gratuit est atteinte.
 * Canaux : push + email + WhatsApp.
 * Déduplication : une seule notification par workspace et par mois calendaire.
 */

import Workspace from '../models/Workspace.js';
import EcomUser from '../models/EcomUser.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import { sendPushNotification, sendPushNotificationToUser } from './pushService.js';
import { sendNotificationEmail } from '../core/notifications/email.service.js';
import { sendWhatsAppMessage } from './whatsappService.js';

// Clé = workspaceId + YYYY-MM, valeur = timestamp de l'envoi
const _notifiedThisMonth = new Map();

function _monthKey(workspaceId) {
  const now = new Date();
  return `${workspaceId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Envoie push + email + WhatsApp à l'admin du workspace pour signaler
 * que la limite mensuelle de commandes est atteinte.
 * Idempotent : n'envoie qu'une fois par workspace par mois.
 */
export async function notifyOrderLimitReached(workspaceId, { used, limit }) {
  const key = _monthKey(String(workspaceId));
  if (_notifiedThisMonth.has(key)) return; // déjà envoyé ce mois
  _notifiedThisMonth.set(key, Date.now());

  try {
    const ws = await Workspace.findById(workspaceId).select('name owner').lean();
    if (!ws) return;

    const owner = await EcomUser.findById(ws.owner).select('email name phone').lean();
    const wsName = ws.name || 'Votre boutique';
    const ownerName = owner?.name || '';

    // ── Push (workspace + owner) ───────────────────────────────────────────
    const pushPayload = {
      title: '🚫 Boutique bloquée — limite atteinte',
      body: `${used}/${limit} commandes ce mois. Votre boutique ne reçoit plus de commandes. Passez à Scalor pour débloquer.`,
      icon: '/icons/icon-192x192.png',
      tag: 'order-limit-reached',
      data: { type: 'order_limit_reached', url: '/ecom/billing' },
    };
    await sendPushNotification(String(workspaceId), pushPayload).catch(() => {});
    if (ws.owner) {
      await sendPushNotificationToUser(String(ws.owner), pushPayload).catch(() => {});
    }

    // ── Email ──────────────────────────────────────────────────────────────
    if (owner?.email) {
      await sendNotificationEmail({
        to: owner.email,
        templateKey: 'order_limit_reached',
        data: { name: ownerName, workspaceName: wsName, used, limit },
        userId: String(ws.owner),
        workspaceId: String(workspaceId),
        eventType: 'order_limit_reached',
      }).catch(() => {});
    }

    // ── WhatsApp (numéros closeuses/notif configurés + phone de l'owner) ──
    const settings = await WorkspaceSettings.findOne({ workspaceId }).select('closeuseNotifNumbers').lean();
    const notifNumbers = (settings?.closeuseNotifNumbers || []).filter(n => n.isActive && n.phoneNumber);

    // Ajouter le téléphone du owner s'il est renseigné
    const ownerPhone = owner?.phone?.replace(/\D/g, '');
    if (ownerPhone && ownerPhone.length >= 7) {
      const alreadyIn = notifNumbers.some(n => n.phoneNumber.replace(/\D/g, '') === ownerPhone);
      if (!alreadyIn) notifNumbers.push({ phoneNumber: ownerPhone });
    }

    if (notifNumbers.length > 0) {
      const waMsg = `🚫 *Boutique bloquée — limite de commandes atteinte*\n\nBonjour${ownerName ? ` ${ownerName}` : ''},\n\nVotre boutique *${wsName}* a atteint la limite de *${limit} commandes/mois* du plan Gratuit.\n\n❌ Votre boutique ne peut plus recevoir de nouvelles commandes ce mois-ci.\n\nPassez au plan Scalor pour débloquer immédiatement 👉 scalor.net/ecom/billing`;
      for (const target of notifNumbers) {
        sendWhatsAppMessage({ to: target.phoneNumber, message: waMsg, workspaceId: String(workspaceId) })
          .catch(() => {});
      }
    }

    console.log(`📣 [orderLimit] Notifications envoyées → workspace ${workspaceId} (${used}/${limit})`);
  } catch (err) {
    console.error(`❌ [orderLimit] Erreur notification:`, err.message);
  }
}
