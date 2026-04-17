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
import { downgradeWorkspaceToFree } from './workspacePlanService.js';

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const EXPIRY_WARNING_HOURS = 12; // Notifier 12h avant l'expiration (essai)
// Stages de rappel pré-expiration pour les plans payants
const PLAN_REMINDER_STAGES = [
  { key: '7d', days: 7 },
  { key: '3d', days: 3 },
  { key: '1d', days: 1 },
];

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

        const workspace = await Workspace.findById(ws._id);
        if (!workspace) continue;
        workspace.trialExpiredNotifiedAt = now;
        await downgradeWorkspaceToFree(workspace, {
          reason: 'plan_expired_cron',
          createSystemNotification: true
        });
        console.log(`📧 [TrialCron] plan_expired envoyé → ${owner.email} (${ws.name}, plan ${planName})`);

      } catch (e) {
        console.error(`❌ [TrialCron] Erreur plan_expired pour ws=${ws._id}:`, e.message);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4) Rappels pré-expiration pour plans payants (J-7, J-3, J-1)
    // ═══════════════════════════════════════════════════════════════════════
    const planLabels = { starter: 'Scalor', pro: 'Scalor + IA', ultra: 'Scalor IA Pro' };
    let planRemindersSent = 0;

    for (const stage of PLAN_REMINDER_STAGES) {
      const stageThreshold = new Date(now.getTime() + stage.days * 24 * 60 * 60 * 1000);
      // Fenêtre : plan qui expire entre maintenant et J+N jours, qui n'a pas
      // encore reçu ce stage de rappel
      const expiringPlans = await Workspace.find({
        plan: { $in: ['starter', 'pro', 'ultra'] },
        planExpiresAt: { $gt: now, $lte: stageThreshold },
        planExpiryReminderStages: { $ne: stage.key },
      }).lean();

      for (const ws of expiringPlans) {
        try {
          const owner = await EcomUser.findById(ws.owner).select('email name').lean();
          if (!owner?.email) continue;

          const expiresAtDate = new Date(ws.planExpiresAt);
          const daysLeft = Math.max(1, Math.ceil((expiresAtDate - now) / (24 * 60 * 60 * 1000)));
          const planName = planLabels[ws.plan] || ws.plan;
          const expiresAtStr = expiresAtDate.toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'
          });

          // Email
          await sendNotificationEmail({
            to: owner.email,
            templateKey: 'plan_expiring_soon',
            data: {
              name: owner.name || '',
              workspaceName: ws.name,
              planName,
              daysLeft,
              expiresAt: expiresAtStr,
            },
            userId: String(ws.owner),
            workspaceId: String(ws._id),
            eventType: `plan_expiring_${stage.key}`,
          });

          // Push
          await sendPushNotification(String(ws._id), {
            title: `⏰ Abonnement ${planName} expire dans ${daysLeft}j`,
            body: `Renouvelez avant le ${expiresAtStr} pour garder vos agents IA actifs.`,
            icon: '/icons/icon-192x192.png',
            tag: `plan-expiring-${stage.key}`,
            data: { type: 'plan_expiring_soon', url: '/ecom/billing' },
          });

          await sendPushNotificationToUser(String(ws.owner), {
            title: `⏰ Abonnement ${planName} expire dans ${daysLeft}j`,
            body: `Renouvelez avant le ${expiresAtStr} pour garder vos agents IA actifs.`,
            icon: '/icons/icon-192x192.png',
            tag: `plan-expiring-${stage.key}`,
            data: { type: 'plan_expiring_soon', url: '/ecom/billing' },
          });

          // Marquer le stage comme envoyé
          await Workspace.updateOne(
            { _id: ws._id },
            { $addToSet: { planExpiryReminderStages: stage.key } }
          );

          planRemindersSent++;
          console.log(`📧 [TrialCron] plan_expiring_${stage.key} → ${owner.email} (${ws.name}, ${daysLeft}j restants)`);
        } catch (e) {
          console.error(`❌ [TrialCron] Erreur plan_expiring_${stage.key} pour ws=${ws._id}:`, e.message);
        }
      }
    }

    const total = expiringTrials.length + expiredTrials.length + expiredPlans.length + planRemindersSent;
    if (total > 0) {
      console.log(`✅ [TrialCron] Cycle terminé: ${expiringTrials.length} avertissements essai, ${expiredTrials.length} essais expirés, ${expiredPlans.length} plans expirés, ${planRemindersSent} rappels pré-expiration`);
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
