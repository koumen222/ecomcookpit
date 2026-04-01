/**
 * trialExpiryCronService.js
 * 
 * Cron qui vérifie toutes les 30 min :
 * 1. Essais qui expirent dans < 12h → email + push "trial_expiring"
 * 2. Essais expirés (trialEndsAt < now) → email + push "trial_expired"
 * 3. Plans payants expirés (planExpiresAt < now) → email + push "plan_expired"
 */

import Workspace from '../models/Workspace.js';
import EcomUser from '../models/EcomUser.js';
import { sendNotificationEmail } from '../core/notifications/email.service.js';
import { sendPushNotification, sendPushNotificationToUser } from './pushService.js';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const EXPIRY_WARNING_HOURS = 12; // Notifier 12h avant l'expiration

async function checkTrialExpiry() {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + EXPIRY_WARNING_HOURS * 60 * 60 * 1000);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // 1) Essais qui expirent dans < 12h (pas encore notifiés)
    // ═══════════════════════════════════════════════════════════════════════
    const expiringTrials = await Workspace.find({
      trialEndsAt: { $gt: now, $lte: warningThreshold },
      trialExpiryNotifiedAt: null,
    }).lean();

    for (const ws of expiringTrials) {
      try {
        const hoursLeft = Math.max(1, Math.round((new Date(ws.trialEndsAt) - now) / (60 * 60 * 1000)));
        const owner = await EcomUser.findById(ws.owner).select('email name').lean();
        if (!owner?.email) continue;

        const trialEndsStr = new Date(ws.trialEndsAt).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Email
        await sendNotificationEmail({
          to: owner.email,
          templateKey: 'trial_expiring',
          data: {
            name: owner.name || '',
            workspaceName: ws.name,
            hoursLeft,
            trialEndsAt: trialEndsStr,
          },
          userId: String(ws.owner),
          workspaceId: String(ws._id),
          eventType: 'trial_expiring',
        });

        // Push notification
        await sendPushNotification(String(ws._id), {
          title: '⏰ Essai gratuit expire bientôt',
          body: `Plus que ${hoursLeft}h — vos agents IA seront désactivés. Passez à Pro !`,
          icon: '/icons/icon-192x192.png',
          tag: 'trial-expiring',
          data: { type: 'trial_expiring', url: '/ecom/billing' },
        });

        // Aussi notifier le owner directement
        await sendPushNotificationToUser(String(ws.owner), {
          title: '⏰ Essai gratuit expire bientôt',
          body: `Plus que ${hoursLeft}h — vos agents IA seront désactivés. Passez à Pro !`,
          icon: '/icons/icon-192x192.png',
          tag: 'trial-expiring',
          data: { type: 'trial_expiring', url: '/ecom/billing' },
        });

        // Marquer comme notifié
        await Workspace.updateOne({ _id: ws._id }, { trialExpiryNotifiedAt: now });
        console.log(`📧 [TrialCron] trial_expiring envoyé → ${owner.email} (${ws.name}, ${hoursLeft}h restantes)`);

      } catch (e) {
        console.error(`❌ [TrialCron] Erreur trial_expiring pour ws=${ws._id}:`, e.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2) Essais expirés (pas encore notifiés "expired")
    // ═══════════════════════════════════════════════════════════════════════
    const expiredTrials = await Workspace.find({
      trialEndsAt: { $lte: now },
      trialExpiredNotifiedAt: null,
      // Only trials that were actually used
      trialUsed: true,
      // Only workspaces still on free plan (not upgraded during trial)
      plan: 'free',
    }).lean();

    for (const ws of expiredTrials) {
      try {
        const owner = await EcomUser.findById(ws.owner).select('email name').lean();
        if (!owner?.email) continue;

        // Email
        await sendNotificationEmail({
          to: owner.email,
          templateKey: 'trial_expired',
          data: {
            name: owner.name || '',
            workspaceName: ws.name,
          },
          userId: String(ws.owner),
          workspaceId: String(ws._id),
          eventType: 'trial_expired',
        });

        // Push notification
        await sendPushNotification(String(ws._id), {
          title: '🚫 Essai terminé — Agents IA désactivés',
          body: 'Vos agents ne répondent plus. Passez à Pro pour les réactiver !',
          icon: '/icons/icon-192x192.png',
          tag: 'trial-expired',
          data: { type: 'trial_expired', url: '/ecom/billing' },
        });

        await sendPushNotificationToUser(String(ws.owner), {
          title: '🚫 Essai terminé — Agents IA désactivés',
          body: 'Vos agents ne répondent plus. Passez à Pro pour les réactiver !',
          icon: '/icons/icon-192x192.png',
          tag: 'trial-expired',
          data: { type: 'trial_expired', url: '/ecom/billing' },
        });

        // Marquer comme notifié
        await Workspace.updateOne({ _id: ws._id }, { trialExpiredNotifiedAt: now });
        console.log(`📧 [TrialCron] trial_expired envoyé → ${owner.email} (${ws.name})`);

      } catch (e) {
        console.error(`❌ [TrialCron] Erreur trial_expired pour ws=${ws._id}:`, e.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3) Plans payants expirés (planExpiresAt passé, pas encore notifié)
    // ═══════════════════════════════════════════════════════════════════════
    const expiredPlans = await Workspace.find({
      plan: { $in: ['pro', 'ultra'] },
      planExpiresAt: { $lte: now },
      trialExpiredNotifiedAt: null, // Reuse field to avoid double notif
    }).lean();

    for (const ws of expiredPlans) {
      try {
        const owner = await EcomUser.findById(ws.owner).select('email name').lean();
        if (!owner?.email) continue;

        const planName = ws.plan === 'pro' ? 'Pro' : 'Ultra';

        // Email
        await sendNotificationEmail({
          to: owner.email,
          templateKey: 'plan_expired',
          data: {
            name: owner.name || '',
            workspaceName: ws.name,
            planName,
          },
          userId: String(ws.owner),
          workspaceId: String(ws._id),
          eventType: 'plan_expired',
        });

        // Push notification
        await sendPushNotification(String(ws._id), {
          title: `🚫 Plan ${planName} expiré`,
          body: 'Vos agents IA sont désactivés. Renouvelez pour continuer à vendre !',
          icon: '/icons/icon-192x192.png',
          tag: 'plan-expired',
          data: { type: 'plan_expired', url: '/ecom/billing' },
        });

        await sendPushNotificationToUser(String(ws.owner), {
          title: `🚫 Plan ${planName} expiré`,
          body: 'Vos agents IA sont désactivés. Renouvelez pour continuer à vendre !',
          icon: '/icons/icon-192x192.png',
          tag: 'plan-expired',
          data: { type: 'plan_expired', url: '/ecom/billing' },
        });

        // Marquer et remettre au plan free
        await Workspace.updateOne({ _id: ws._id }, {
          plan: 'free',
          trialExpiredNotifiedAt: now,
        });
        console.log(`📧 [TrialCron] plan_expired envoyé → ${owner.email} (${ws.name}, plan ${planName})`);

      } catch (e) {
        console.error(`❌ [TrialCron] Erreur plan_expired pour ws=${ws._id}:`, e.message);
      }
    }

    const total = expiringTrials.length + expiredTrials.length + expiredPlans.length;
    if (total > 0) {
      console.log(`✅ [TrialCron] Cycle terminé: ${expiringTrials.length} avertissements, ${expiredTrials.length} essais expirés, ${expiredPlans.length} plans expirés`);
    }

  } catch (err) {
    console.error('❌ [TrialCron] Erreur globale:', err.message);
  }
}

export function startTrialExpiryCron() {
  console.log('✅ Trial expiry cron démarré (check toutes les 30 min)');
  // Run once at startup
  setTimeout(() => checkTrialExpiry(), 10_000);
  // Then every 30 min
  setInterval(checkTrialExpiry, INTERVAL_MS);
}
