import Notification from '../models/Notification.js';

const SUBSCRIPTION_WARNING_VARIANTS = {
  renewal: 'renewal',
  downgraded: 'downgraded',
  planUpdated: 'plan_updated'
};

const RENEWAL_WARNING_MESSAGE = 'Votre abonnement expire bientot. Vous avez 24h pour renouveler afin de conserver l\'acces a votre compte.';
const DOWNGRADED_TO_FREE_MESSAGE = 'Votre compte est repasse au plan gratuit.';

function buildPlanUpdatedWarning({
  message,
  activatedBy = null
} = {}) {
  return {
    active: true,
    variant: SUBSCRIPTION_WARNING_VARIANTS.planUpdated,
    message: message || 'Votre plan a ete mis a jour.',
    deadline: null,
    activatedAt: new Date(),
    activatedBy: activatedBy || null
  };
}

function clearSubscriptionWarning() {
  return {
    active: false,
    variant: SUBSCRIPTION_WARNING_VARIANTS.renewal,
    message: '',
    deadline: null,
    activatedAt: null,
    activatedBy: null
  };
}

function buildRenewalSubscriptionWarning({
  message = RENEWAL_WARNING_MESSAGE,
  activatedBy = null,
  deadline = null
} = {}) {
  return {
    active: true,
    variant: SUBSCRIPTION_WARNING_VARIANTS.renewal,
    message,
    deadline: deadline || new Date(Date.now() + 24 * 60 * 60 * 1000),
    activatedAt: new Date(),
    activatedBy: activatedBy || null
  };
}

function buildFreePlanDowngradeWarning({
  message = DOWNGRADED_TO_FREE_MESSAGE,
  activatedBy = null
} = {}) {
  return {
    active: true,
    variant: SUBSCRIPTION_WARNING_VARIANTS.downgraded,
    message,
    deadline: null,
    activatedAt: new Date(),
    activatedBy: activatedBy || null
  };
}

async function createFreePlanNotification(workspaceId, reason, message) {
  try {
    return await Notification.create({
      workspaceId,
      userId: null,
      type: 'system',
      title: 'Compte repasse au plan gratuit',
      message,
      icon: 'system',
      link: '/ecom/billing',
      metadata: {
        reason,
        downgradedTo: 'free'
      }
    });
  } catch (error) {
    console.warn('[workspacePlanService] notification creation failed:', error.message);
    return null;
  }
}

async function downgradeWorkspaceToFree(workspace, {
  actorId = null,
  reason = 'manual',
  announcementMessage = DOWNGRADED_TO_FREE_MESSAGE,
  createSystemNotification = true
} = {}) {
  if (!workspace) {
    return { workspace: null, notification: null, changed: false };
  }

  const wasFree = workspace.plan === 'free';
  const sameAnnouncement = workspace.subscriptionWarning?.active
    && workspace.subscriptionWarning?.variant === SUBSCRIPTION_WARNING_VARIANTS.downgraded
    && workspace.subscriptionWarning?.message === announcementMessage;

  workspace.plan = 'free';
  workspace.planExpiresAt = null;
  workspace.subscriptionWarning = buildFreePlanDowngradeWarning({
    message: announcementMessage,
    activatedBy: actorId
  });

  await workspace.save();

  let notification = null;
  if (createSystemNotification && (!wasFree || !sameAnnouncement)) {
    notification = await createFreePlanNotification(workspace._id, reason, announcementMessage);
  }

  return {
    workspace,
    notification,
    changed: !wasFree || !sameAnnouncement
  };
}

export {
  SUBSCRIPTION_WARNING_VARIANTS,
  RENEWAL_WARNING_MESSAGE,
  DOWNGRADED_TO_FREE_MESSAGE,
  clearSubscriptionWarning,
  buildRenewalSubscriptionWarning,
  buildFreePlanDowngradeWarning,
  buildPlanUpdatedWarning,
  downgradeWorkspaceToFree
};