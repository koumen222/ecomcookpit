// ─────────────────────────────────────────────────────────────────────────────
//  postponedReminderCron — rappel automatique des commandes REPORTÉES.
//
//  Quand une commande passe en statut « postponed » avec une date de rappel
//  (postponedUntil), ce cron notifie à l'échéance : la closeuse affectée
//  (closerId) si elle existe, sinon les admins du workspace. Une notification
//  par report (postponeReminderSentAt évite les doublons ; une nouvelle date
//  de report réarme le rappel).
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import EcomUser from '../models/EcomUser.js';
import { createNotification } from './notificationHelper.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // toutes les 5 minutes
const BATCH_LIMIT = 100;

async function processDuePostponedOrders() {
  // Base indisponible → on saute le cycle sans polluer les logs.
  if (mongoose.connection.readyState !== 1) return;

  const now = new Date();
  const dueOrders = await Order.find({
    status: 'postponed',
    postponedUntil: { $ne: null, $lte: now },
    postponeReminderSentAt: null,
  })
    .select('_id orderId workspaceId clientName clientPhone product city closerId postponedUntil deliveryTime')
    .limit(BATCH_LIMIT)
    .lean();

  for (const order of dueOrders) {
    try {
      // Verrou atomique : un seul rappel même avec plusieurs instances.
      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, postponeReminderSentAt: null },
        { $set: { postponeReminderSentAt: now } },
        { new: true }
      ).lean();
      if (!claimed) continue;

      const title = '⏰ Commande reportée à rappeler';
      const message = `#${order.orderId || order._id} — ${order.clientName || 'Client'} (${order.clientPhone || 'tél. inconnu'}) · ${order.product || ''} · ${order.city || ''}. La date de rappel est arrivée.`;
      const link = `/ecom/orders/${order._id}`;

      // Destinataires : la closeuse affectée, sinon les admins du workspace.
      let recipients = [];
      if (order.closerId) {
        recipients = [order.closerId];
      } else {
        const admins = await EcomUser.find({
          workspaceId: order.workspaceId,
          role: { $in: ['ecom_admin', 'super_admin'] },
          isActive: true,
        }).select('_id').lean();
        recipients = admins.map((a) => a._id);
      }

      await Promise.allSettled(recipients.map((userId) => createNotification({
        workspaceId: order.workspaceId,
        userId,
        type: 'order_postponed_due',
        title,
        message,
        icon: 'clock',
        link,
        metadata: { orderId: String(order._id), postponedUntil: order.postponedUntil },
      })));

      console.log(`⏰ [POSTPONED] Rappel envoyé pour la commande ${order.orderId || order._id} (${recipients.length} destinataire(s))`);
    } catch (err) {
      console.error(`❌ [POSTPONED] Rappel raté pour ${order._id}:`, err.message);
    }
  }
}

export function startPostponedReminderCron() {
  setInterval(() => {
    processDuePostponedOrders().catch((err) => console.error('❌ [POSTPONED] Erreur cycle rappels:', err.message));
  }, CHECK_INTERVAL_MS).unref?.();
  // Premier passage peu après le démarrage (laisse la DB se connecter).
  setTimeout(() => {
    processDuePostponedOrders().catch(() => {});
  }, 30 * 1000).unref?.();
  console.log('⏰ Cron rappels commandes reportées démarré (toutes les 5 min)');
}

export default { startPostponedReminderCron };
