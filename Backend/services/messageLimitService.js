import WhatsAppInstance from '../models/WhatsAppInstance.js';

/**
 * Service de gestion des limites de messages WhatsApp
 * Plan gratuit: 50 messages/jour, 100 messages/mois
 */

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
  
  const usage = {
    plan: instance.plan || 'free',
    dailyUsed: instance.messagesSentToday || 0,
    dailyLimit: instance.dailyLimit || 50,
    monthlyUsed: instance.messagesSentThisMonth || 0,
    monthlyLimit: instance.monthlyLimit || 100,
    dailyRemaining: Math.max(0, (instance.dailyLimit || 50) - (instance.messagesSentToday || 0)),
    monthlyRemaining: Math.max(0, (instance.monthlyLimit || 100) - (instance.messagesSentThisMonth || 0))
  };
  
  // Plan illimité
  if (instance.plan === 'unlimited') {
    return { allowed: true, reason: 'Plan illimité', usage };
  }
  
  // Vérifier limite quotidienne
  if (instance.messagesSentToday >= instance.dailyLimit) {
    return {
      allowed: false,
      reason: `Limite quotidienne atteinte (${instance.dailyLimit} messages/jour). Passez au plan Premium pour continuer.`,
      usage
    };
  }
  
  // Vérifier limite mensuelle
  if (instance.messagesSentThisMonth >= instance.monthlyLimit) {
    return {
      allowed: false,
      reason: `Limite mensuelle atteinte (${instance.monthlyLimit} messages/mois). Passez au plan Premium pour continuer.`,
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
    
    // Incrémenter les compteurs
    instance.messagesSentToday = (instance.messagesSentToday || 0) + count;
    instance.messagesSentThisMonth = (instance.messagesSentThisMonth || 0) + count;
    
    // Vérifier si les limites sont dépassées
    if (instance.plan === 'free') {
      if (instance.messagesSentToday >= instance.dailyLimit || 
          instance.messagesSentThisMonth >= instance.monthlyLimit) {
        instance.limitExceeded = true;
        instance.limitExceededAt = new Date();
        console.warn(`⚠️ [LIMIT] Instance "${instance.customName || instance.instanceName}" a atteint sa limite`);
      }
    }
    
    await instance.save();
    
    console.log(`📊 [LIMIT] Instance "${instance.customName || instance.instanceName}": ${instance.messagesSentToday}/${instance.dailyLimit} aujourd'hui, ${instance.messagesSentThisMonth}/${instance.monthlyLimit} ce mois`);
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
    await instance.save();
    
    return {
      plan: instance.plan || 'free',
      dailyUsed: instance.messagesSentToday || 0,
      dailyLimit: instance.dailyLimit || 50,
      dailyRemaining: Math.max(0, (instance.dailyLimit || 50) - (instance.messagesSentToday || 0)),
      monthlyUsed: instance.messagesSentThisMonth || 0,
      monthlyLimit: instance.monthlyLimit || 100,
      monthlyRemaining: Math.max(0, (instance.monthlyLimit || 100) - (instance.messagesSentThisMonth || 0)),
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
