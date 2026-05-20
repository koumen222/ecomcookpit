/**
 * Plan limit enforcement middleware.
 *
 * Reads PlanConfig from DB, resolves the workspace's effective plan
 * (null/missing → 'free'), and blocks the request when the relevant limit
 * is reached. Feature flags block based on features.hasX booleans.
 *
 * Limit convention: a limit value of -1 means "unlimited".
 */

import Workspace from '../models/Workspace.js';
import PlanConfig from '../models/PlanConfig.js';
import Order from '../models/Order.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import StoreProduct from '../models/StoreProduct.js';
import Store from '../models/Store.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';

const PLAN_LABELS = {
  free: 'Gratuit',
  starter: 'Scalor',
  pro: 'Scalor + IA',
  ultra: 'Scalor IA Pro',
  trial: 'Essai gratuit'
};

const DEFAULT_RUNTIME_LIMITS = {
  free: {
    agents: 0,
    instances: 0,
    messagesPerDay: 0,
    messagesPerMonth: 0,
    generationCredits: 0,
    whatsappAgent: false,
    maxOrders: 50,
    maxClients: 50,
    maxProducts: 10,
    maxStores: 1,
    maxUsers: 1,
  },
  starter: {
    agents: 0,
    instances: 0,
    messagesPerDay: 0,
    messagesPerMonth: 0,
    generationCredits: 0,
    whatsappAgent: false,
    maxOrders: null,
    maxClients: null,
    maxProducts: null,
    maxStores: 3,
    maxUsers: 3,
  },
  pro: {
    agents: 1,
    instances: 1,
    messagesPerDay: 1000,
    messagesPerMonth: 50000,
    generationCredits: 0,
    whatsappAgent: true,
    maxOrders: null,
    maxClients: null,
    maxProducts: null,
    maxStores: 3,
    maxUsers: 5,
  },
  ultra: {
    agents: 5,
    instances: 5,
    messagesPerDay: null,
    messagesPerMonth: null,
    generationCredits: 10,
    whatsappAgent: true,
    maxOrders: null,
    maxClients: null,
    maxProducts: null,
    maxStores: null,
    maxUsers: null,
  }
};

const RESOURCE_LABELS = {
  orders: 'commandes',
  customers: 'clients',
  products: 'produits',
  stores: 'boutiques',
  whatsappInstances: 'instances WhatsApp',
  users: 'membres d\'équipe'
};

const FEATURE_LABELS = {
  hasAiAgent: 'L\'agent WhatsApp IA',
  hasAdvancedAnalytics: 'Les analyses avancees',
  hasAutomation: 'Les automatisations',
  hasCustomDomain: 'Le domaine personnalise',
  hasMultiUser: 'La gestion multi-utilisateurs'
};

const planCache = { data: null, ts: 0 };
const CACHE_MS = 10_000;

async function getPlanConfigs() {
  const now = Date.now();
  if (planCache.data && now - planCache.ts < CACHE_MS) return planCache.data;
  await PlanConfig.seedDefaults();
  const rows = await PlanConfig.find().lean();
  const map = {};
  for (const p of rows) map[p.key] = p;
  planCache.data = map;
  planCache.ts = now;
  return map;
}

function getPlanLabel(planKey, config = null) {
  return config?.displayName || PLAN_LABELS[planKey] || planKey || 'Gratuit';
}

function toRuntimeLimit(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed === -1 ? null : parsed;
}

function getEnabledAgentLimit(planKey, hasAiAgent, fallbackAgents) {
  if (!hasAiAgent) return 0;
  if (fallbackAgents > 0) return fallbackAgents;
  return planKey === 'ultra' ? 5 : 1;
}

export function buildRuntimePlanLimits(planKey, config = null) {
  const normalizedPlanKey = planKey || 'free';
  const defaults = DEFAULT_RUNTIME_LIMITS[normalizedPlanKey] || DEFAULT_RUNTIME_LIMITS.free;
  const limits = config?.limits || {};
  const features = config?.features || {};
  const hasAiAgent = features.hasAiAgent ?? defaults.whatsappAgent;

  return {
    agents: getEnabledAgentLimit(normalizedPlanKey, hasAiAgent, defaults.agents),
    instances: toRuntimeLimit(limits.maxWhatsappInstances, defaults.instances),
    messagesPerDay: toRuntimeLimit(limits.maxWhatsappMessagesPerDay, defaults.messagesPerDay),
    messagesPerMonth: toRuntimeLimit(limits.maxWhatsappMessagesPerMonth, defaults.messagesPerMonth),
    generationCredits: toRuntimeLimit(limits.maxAiPageCredits, defaults.generationCredits),
    whatsappAgent: !!hasAiAgent,
    maxOrders: toRuntimeLimit(limits.maxOrders, defaults.maxOrders),
    maxClients: toRuntimeLimit(limits.maxCustomers, defaults.maxClients),
    maxProducts: toRuntimeLimit(limits.maxProducts, defaults.maxProducts),
    maxStores: toRuntimeLimit(limits.maxStores, defaults.maxStores),
    maxUsers: toRuntimeLimit(limits.maxUsers, defaults.maxUsers),
    label: getPlanLabel(normalizedPlanKey, config)
  };
}

export async function getPlanRuntimeSnapshot(planKey) {
  const plans = await getPlanConfigs();
  const normalizedPlanKey = plans[planKey] ? planKey : 'free';
  const config = plans[normalizedPlanKey] || plans.free || null;

  return {
    planKey: normalizedPlanKey,
    config,
    limits: buildRuntimePlanLimits(normalizedPlanKey, config)
  };
}

function getResourceLabel(resource) {
  return RESOURCE_LABELS[resource] || 'ressources';
}

function getFeatureLabel(featureKey) {
  return FEATURE_LABELS[featureKey] || 'Cette fonctionnalite';
}

function getSortedPlans(plans) {
  return Object.values(plans || {})
    .filter(Boolean)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

function findNextPlanForLimit(plans, resource, currentMax) {
  const limitKey = LIMIT_KEY_BY_RESOURCE[resource];
  if (!limitKey) return null;

  return getSortedPlans(plans).find((plan) => {
    const nextMax = plan?.limits?.[limitKey];
    if (nextMax == null) return false;
    if (nextMax === -1) return true;
    if (currentMax === -1) return false;
    return Number(nextMax) > Number(currentMax);
  }) || null;
}

function findRequiredPlanForFeature(plans, featureKey) {
  return getSortedPlans(plans).find((plan) => plan?.features?.[featureKey] === true) || null;
}

function buildLimitReachedMessage({ resource, planLabel, current, limit, requiredPlanLabel }) {
  const resourceLabel = getResourceLabel(resource);
  const baseMessage = `Votre plan ${planLabel} autorise jusqu'a ${limit} ${resourceLabel}. Vous avez deja atteint cette limite (${current}/${limit}).`;
  if (requiredPlanLabel) {
    return `${baseMessage} Passez au plan ${requiredPlanLabel} pour continuer.`;
  }
  return `${baseMessage} Passez a un plan superieur pour continuer.`;
}

function buildFeatureUnavailableMessage({ featureKey, planLabel, requiredPlanLabel }) {
  const featureLabel = getFeatureLabel(featureKey);
  if (requiredPlanLabel) {
    return `${featureLabel} n'est pas disponible sur votre plan ${planLabel}. Cette fonctionnalite necessite le plan ${requiredPlanLabel} ou superieur.`;
  }
  return `${featureLabel} n'est pas disponible sur votre plan ${planLabel}. Passez a un plan superieur pour y acceder.`;
}

export function invalidatePlanCache() {
  planCache.data = null;
  planCache.ts = 0;
}

/** Resolve workspace's effective plan key ('free' if none/expired). */
async function resolveEffectivePlan(workspaceId) {
  if (!workspaceId) return { planKey: 'free', workspace: null };
  const ws = await Workspace.findById(workspaceId).select('plan planExpiresAt trialEndsAt');
  if (!ws) return { planKey: 'free', workspace: null };
  const now = Date.now();
  let planKey = ws.plan || 'free';
  if (planKey !== 'free' && ws.planExpiresAt && new Date(ws.planExpiresAt).getTime() < now) {
    planKey = 'free';
  }
  // During an active trial (no paid plan), grant Scalor (starter) benefits
  if (planKey === 'free' && ws.trialEndsAt && new Date(ws.trialEndsAt).getTime() > now) {
    planKey = 'starter';
  }
  return { planKey, workspace: ws };
}

async function countByResource(resource, workspaceId) {
  const filter = { workspaceId };
  switch (resource) {
    case 'orders': {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      return Order.countDocuments({ ...filter, createdAt: { $gte: startOfMonth } });
    }
    case 'customers': return Client.countDocuments(filter);
    case 'products': {
      const [p, sp] = await Promise.all([
        Product.countDocuments(filter).catch(() => 0),
        StoreProduct.countDocuments(filter).catch(() => 0)
      ]);
      return p + sp;
    }
    case 'stores': return Store.countDocuments(filter).catch(() => 0);
    case 'whatsappInstances': return WhatsAppInstance.countDocuments(filter).catch(() => 0);
    case 'users': {
      // Count invited members only (exclude the workspace owner).
      // The owner is stored as workspace.owner — fetch it to exclude them.
      const ws = await (await import('../models/Workspace.js')).default
        .findById(workspaceId).select('owner').lean().catch(() => null);
      const ownerId = ws?.owner;
      const query = { 'workspaces.workspaceId': workspaceId, isActive: true };
      if (ownerId) query._id = { $ne: ownerId };
      return EcomUser.countDocuments(query).catch(() => 0);
    }
    default: return 0;
  }
}

const LIMIT_KEY_BY_RESOURCE = {
  orders: 'maxOrders',
  customers: 'maxCustomers',
  products: 'maxProducts',
  stores: 'maxStores',
  whatsappInstances: 'maxWhatsappInstances',
  users: 'maxUsers'
};

/**
 * Block POST/create when the resource count reaches the plan limit.
 * Usage: router.post('/', requireEcomAuth, checkPlanLimit('orders'), handler)
 */
export function checkPlanLimit(resource) {
  return async function planLimitMiddleware(req, res, next) {
    try {
      if (req.method === 'GET') return next();
      const workspaceId = req.workspaceId || req.user?.workspaceId || req.body?.workspaceId;
      if (!workspaceId) return next();

      const { planKey } = await resolveEffectivePlan(workspaceId);
      const plans = await getPlanConfigs();
      const cfg = plans[planKey] || plans.free;
      const limitKey = LIMIT_KEY_BY_RESOURCE[resource];
      const max = cfg?.limits?.[limitKey];
      const planLabel = getPlanLabel(planKey, cfg);

      if (max == null || max === -1) return next();

      const current = await countByResource(resource, workspaceId);
      if (current >= max) {
        const requiredPlanConfig = findNextPlanForLimit(plans, resource, max);
        const requiredPlan = requiredPlanConfig?.key || null;
        return res.status(403).json({
          success: false,
          error: 'PLAN_LIMIT_REACHED',
          restrictionType: 'plan_limit',
          resource,
          resourceLabel: getResourceLabel(resource),
          plan: planKey,
          planLabel,
          limit: max,
          current,
          requiredPlan,
          requiredPlanLabel: requiredPlan ? getPlanLabel(requiredPlan, requiredPlanConfig) : null,
          message: buildLimitReachedMessage({
            resource,
            planLabel,
            current,
            limit: max,
            requiredPlanLabel: requiredPlan ? getPlanLabel(requiredPlan, requiredPlanConfig) : null
          }),
          upgradeUrl: '/ecom/tarifs'
        });
      }
      return next();
    } catch (err) {
      console.error('[planLimits] error:', err.message);
      return next();
    }
  };
}

/**
 * Block access when a feature flag is off on the plan.
 * Usage: router.post('/...', requireEcomAuth, requireFeature('hasAiAgent'), handler)
 */
export function requireFeature(featureKey) {
  return async function featureGateMiddleware(req, res, next) {
    try {
      const workspaceId = req.workspaceId || req.user?.workspaceId || req.body?.workspaceId;
      const { planKey } = await resolveEffectivePlan(workspaceId);
      const plans = await getPlanConfigs();
      const cfg = plans[planKey] || plans.free;
      if (!cfg?.features?.[featureKey]) {
        const planLabel = getPlanLabel(planKey, cfg);
        const requiredPlanConfig = findRequiredPlanForFeature(plans, featureKey);
        const requiredPlan = requiredPlanConfig?.key || null;
        return res.status(403).json({
          success: false,
          error: 'FEATURE_NOT_AVAILABLE',
          restrictionType: 'feature_gate',
          feature: featureKey,
          featureLabel: getFeatureLabel(featureKey),
          plan: planKey,
          planLabel,
          requiredPlan,
          requiredPlanLabel: requiredPlan ? getPlanLabel(requiredPlan, requiredPlanConfig) : null,
          message: buildFeatureUnavailableMessage({
            featureKey,
            planLabel,
            requiredPlanLabel: requiredPlan ? getPlanLabel(requiredPlan, requiredPlanConfig) : null
          }),
          upgradeUrl: '/ecom/tarifs'
        });
      }
      return next();
    } catch (err) {
      console.error('[planLimits] featureGate error:', err.message);
      return next();
    }
  };
}

export { getPlanConfigs, getPlanLabel };

export default { checkPlanLimit, requireFeature, invalidatePlanCache, getPlanConfigs, getPlanLabel, buildRuntimePlanLimits, getPlanRuntimeSnapshot };
