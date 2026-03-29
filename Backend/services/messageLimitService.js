import WhatsAppInstance from '../models/WhatsAppInstance.js';

/**
 * Service de gestion des limites de messages WhatsApp
 * Plan gratuit: 100 messages/jour, 5000 messages/mois
 */

const PLAN_LIMITS = {
  free: { daily: 1000, monthly: 5000 },
  pro: { daily: 5000, monthly: 50000 },
  plus: { daily: 10000, monthly: 200000 },
};

const LEGACY_PLAN_MAP = {
  premium: 'pro',
  unlimited: 'plus',
};

function normalizePlan(plan) {
  const rawPlan = String(plan || 'free').toLowerCase();
  return LEGACY_PLAN_MAP[rawPlan] || (PLAN_LIMITS[rawPlan] ? rawPlan : 'free');
}

function getPlanLimits(plan) {
  const normalized = normalizePlan(plan);
  return PLAN_LIMITS[normalized] || PLAN_LIMITS.free;
}

function ensureInstancePlanAndLimits(instance) {
  const normalizedPlan = normalizePlan(instance.plan);
  const expected = getPlanLimits(normalizedPlan);

  const invalidLimits = !Number.isFinite(instance.dailyLimit) || instance.dailyLimit <= 0 || !Number.isFinite(instance.monthlyLimit) || instance.monthlyLimit <= 0;
  const legacyFreeLimits = normalizedPlan === 'free' && (instance.dailyLimit === 50 || instance.dailyLimit === 100 || instance.monthlyLimit === 100);

  if (instance.plan !== normalizedPlan) {
    instance.plan = normalizedPlan;
  }

  if (invalidLimits || legacyFreeLimits) {
    instance.dailyLimit = expected.daily;
    instance.monthlyLimit = expected.monthly;
  }

  return {
    plan: normalizedPlan,
    dailyLimit: instance.dailyLimit,
    monthlyLimit: instance.monthlyLimit,
  };
}

/**
 * Réinitialise les compteurs quotidiens si nécessaire
 */
async function resetDailyCountersIfNeeded(instance) {
  const now = new Date();
  const lastReset = new Date(instance.lastDailyReset);
  
  // Vérifier si on est un nouveau jour
  if (now.getDate() !== lastReset.getDate() || 
      now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()) {
    
    instance.messagesSentToday = 0;
    instance.lastDailyReset = now;
    
    console.log(`🔄 [LIMIT] Compteur quotidien réinitialisé pour instance "${instance.customName || instance.instanceName}"`);
  }
}

/**
 * Réinitialise les compteurs mensuels si nécessaire
 */
async function resetMonthlyCountersIfNeeded(instance) {
  const now = new Date();
  const lastReset = new Date(instance.lastMonthlyReset);
  
  // Vérifier si on est un nouveau mois
  if (now.getMonth() !== lastReset.getMonth() || 
      now.getFullYear() !== lastReset.getFullYear()) {
    
    instance.messagesSentThisMonth = 0;
    instance.lastMonthlyReset = now;
    instance.limitExceeded = false;
    instance.limitExceededAt = null;
    
    console.log(`🔄 [LIMIT] Compteur mensuel réinitialisé pour instance "${instance.customName || instance.instanceName}"`);
  }
}

/**
 * Vérifie si l'instance peut envoyer un message (limites non dépassées)
 * @param {Object} instance - Instance WhatsApp
 * @returns {Object} { allowed: boolean, reason: string, usage: object }
 */
export async function checkMessageLimit(instance) {
  // Réinitialiser les compteurs si nécessaire
  await resetDailyCountersIfNeeded(instance);
  await resetMonthlyCountersIfNeeded(instance);

  const normalized = ensureInstancePlanAndLimits(instance);
  
  const usage = {
    plan: normalized.plan,
    dailyUsed: instance.messagesSentToday || 0,
    dailyLimit: normalized.dailyLimit,
    monthlyUsed: instance.messagesSentThisMonth || 0,
    monthlyLimit: normalized.monthlyLimit,
    dailyRemaining: Math.max(0, normalized.dailyLimit - (instance.messagesSentToday || 0)),
    monthlyRemaining: Math.max(0, normalized.monthlyLimit - (instance.messagesSentThisMonth || 0))
  };
  
  // Vérifier limite quotidienne
  if (instance.messagesSentToday >= normalized.dailyLimit) {
    return {
      allowed: false,
      reason: `Limite quotidienne atteinte (${normalized.dailyLimit} messages/jour). Passez au plan Pro ou Plus pour continuer.`,
      usage
    };
  }
  
  // Vérifier limite mensuelle
  if (instance.messagesSentThisMonth >= normalized.monthlyLimit) {
    return {
      allowed: false,
      reason: `Limite mensuelle atteinte (${normalized.monthlyLimit} messages/mois). Passez au plan Pro ou Plus pour continuer.`,
      usage
    };
  }
  
  return { allowed: true, reason: 'OK', usage };
}

/**
 * Incrémente les compteurs de messages après un envoi réussi
 * @param {String} instanceId - ID de l'instance
 * @param {Number} count - Nombre de messages envoyés (défaut: 1)
 */
export async function incrementMessageCount(instanceId, count = 1) {
  try {
    const instance = await WhatsAppInstance.findById(instanceId);
    if (!instance) {
      console.error(`❌ [LIMIT] Instance ${instanceId} introuvable`);
      return;
    }
    
    // Réinitialiser les compteurs si nécessaire
    await resetDailyCountersIfNeeded(instance);
    await resetMonthlyCountersIfNeeded(instance);
    const normalized = ensureInstancePlanAndLimits(instance);
    
    // Incrémenter les compteurs
    instance.messagesSentToday = (instance.messagesSentToday || 0) + count;
    instance.messagesSentThisMonth = (instance.messagesSentThisMonth || 0) + count;
    
    // Vérifier si les limites sont dépassées
    if (instance.messagesSentToday >= normalized.dailyLimit || 
        instance.messagesSentThisMonth >= normalized.monthlyLimit) {
      instance.limitExceeded = true;
      instance.limitExceededAt = new Date();
      console.warn(`⚠️ [LIMIT] Instance "${instance.customName || instance.instanceName}" a atteint sa limite`);
    } else {
      instance.limitExceeded = false;
      instance.limitExceededAt = null;
    }
    
    await instance.save();
    
    console.log(`📊 [LIMIT] Instance "${instance.customName || instance.instanceName}": ${instance.messagesSentToday}/${normalized.dailyLimit} aujourd'hui, ${instance.messagesSentThisMonth}/${normalized.monthlyLimit} ce mois`);
  } catch (error) {
    console.error(`❌ [LIMIT] Erreur lors de l'incrémentation:`, error.message);
  }
}

/**
 * Récupère les statistiques d'utilisation d'une instance
 * @param {String} instanceId - ID de l'instance
 * @returns {Object} Statistiques d'utilisation
 */
export async function getInstanceUsage(instanceId) {
  try {
    const instance = await WhatsAppInstance.findById(instanceId);
    if (!instance) {
      throw new Error('Instance introuvable');
    }
    
    // Réinitialiser les compteurs si nécessaire
    await resetDailyCountersIfNeeded(instance);
    await resetMonthlyCountersIfNeeded(instance);
    const normalized = ensureInstancePlanAndLimits(instance);
    await instance.save();
    
    return {
      plan: normalized.plan,
      dailyUsed: instance.messagesSentToday || 0,
      dailyLimit: normalized.dailyLimit,
      dailyRemaining: Math.max(0, normalized.dailyLimit - (instance.messagesSentToday || 0)),
      monthlyUsed: instance.messagesSentThisMonth || 0,
      monthlyLimit: normalized.monthlyLimit,
      monthlyRemaining: Math.max(0, normalized.monthlyLimit - (instance.messagesSentThisMonth || 0)),
      limitExceeded: instance.limitExceeded || false,
      limitExceededAt: instance.limitExceededAt,
      lastDailyReset: instance.lastDailyReset,
      lastMonthlyReset: instance.lastMonthlyReset
    };
  } catch (error) {
    console.error(`❌ [LIMIT] Erreur lors de la récupération des stats:`, error.message);
    throw error;
  }
}

/**
 * Réinitialise manuellement les limites d'une instance (admin)
 * @param {String} instanceId - ID de l'instance
 */
export async function resetInstanceLimits(instanceId) {
  try {
    const instance = await WhatsAppInstance.findById(instanceId);
    if (!instance) {
      throw new Error('Instance introuvable');
    }
    
    instance.messagesSentToday = 0;
    instance.messagesSentThisMonth = 0;
    instance.limitExceeded = false;
    instance.limitExceededAt = null;
    instance.lastDailyReset = new Date();
    instance.lastMonthlyReset = new Date();
    
    await instance.save();
    
    console.log(`✅ [LIMIT] Limites réinitialisées pour instance "${instance.customName || instance.instanceName}"`);
    return instance;
  } catch (error) {
    console.error(`❌ [LIMIT] Erreur lors de la réinitialisation:`, error.message);
    throw error;
  }
}

export default {
  checkMessageLimit,
  incrementMessageCount,
  getInstanceUsage,
  resetInstanceLimits
};
