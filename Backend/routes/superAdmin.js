import express from 'express';
import mongoose from 'mongoose';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import FeatureUsageLog from '../models/FeatureUsageLog.js';
import PlanPayment from '../models/PlanPayment.js';
import PlanConfig, { PLAN_KEYS } from '../models/PlanConfig.js';
import GenerationPricingConfig from '../models/GenerationPricingConfig.js';
import CreativePricingConfig from '../models/CreativePricingConfig.js';
import { CREATIVE_PRICING } from '../config/creativePricing.js';
import { invalidateCreativePricingCache } from '../services/creativeCredits.js';
import GenerationPayment from '../models/GenerationPayment.js';
import ProductPageGenerationLog from '../models/ProductPageGenerationLog.js';
import CreativeAsset from '../models/CreativeAsset.js';
import GeneratedMedia from '../models/GeneratedMedia.js';
import AutoMontageJob from '../models/AutoMontageJob.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import SupportConversation from '../models/SupportConversation.js';
import StoreProduct from '../models/StoreProduct.js';
import Order from '../models/Order.js';
import StoreOrder from '../models/StoreOrder.js';
import Store from '../models/Store.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import ScalorUser from '../models/ScalorUser.js';
import { requireEcomAuth, requireSuperAdmin, requireServiceClient } from '../middleware/ecomAuth.js';
import bcrypt from 'bcryptjs';
import { invalidatePlanCache } from '../middleware/planLimits.js';
import { logAudit, auditSensitiveAccess, AuditLog } from '../middleware/security.js';
import AnalyticsSession from '../models/AnalyticsSession.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import PushScheduledNotification from '../models/PushScheduledNotification.js';
import { sendCustomNotificationEmail, sendNotificationEmail } from '../core/notifications/email.service.js';
import { sendPushNotification, sendPushNotificationToUser } from '../services/pushService.js';
import { buildPlanUpdatedWarning, buildRenewalSubscriptionWarning, clearSubscriptionWarning, downgradeWorkspaceToFree } from '../services/workspacePlanService.js';
import { emitSupportConversationUpdate } from '../services/socketService.js';
import { formatInternationalPhone, getSupportedCountries } from '../utils/phoneUtils.js';
import evolutionApiService from '../services/evolutionApiService.js';

const router = express.Router();

function sumPaymentAggRows(rows = []) {
  return rows.reduce((acc, row) => {
    acc.totalRevenue += row.totalRevenue || 0;
    acc.totalFees += row.totalFees || 0;
    acc.count += row.count || 0;
    acc.amountSum += row.amountSum || 0;
    return acc;
  }, { totalRevenue: 0, totalFees: 0, count: 0, amountSum: 0 });
}

function mergeGroupedTotals(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id;
    if (!key) return;
    const current = merged.get(key) || { _id: key, count: 0, total: 0 };
    current.count += item.count || 0;
    current.total += item.total || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values());
}

function mergeGroupedLabelTotals(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id || 'unknown';
    const current = merged.get(key) || { _id: key, count: 0, total: 0 };
    current.count += item.count || 0;
    current.total += item.total || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values()).sort((a, b) => (b.total || 0) - (a.total || 0));
}

function normalizePlanPayment(payment) {
  return {
    ...payment,
    paymentType: 'plan',
    paymentLabel: 'Abonnement',
    appliedAt: payment.activatedAt || null,
  };
}

function normalizeGenerationPayment(payment) {
  return {
    ...payment,
    paymentType: 'generation',
    paymentLabel: 'Credits pages produits',
    appliedAt: payment.creditedAt || null,
  };
}

function mergeRevenueByMonth(...groups) {
  const merged = new Map();
  groups.flat().forEach((item) => {
    const key = item?._id;
    if (!key) return;
    const current = merged.get(key) || { _id: key, total: 0, count: 0 };
    current.total += item.total || 0;
    current.count += item.count || 0;
    merged.set(key, current);
  });
  return Array.from(merged.values()).sort((a, b) => String(a._id).localeCompare(String(b._id)));
}

const WORKSPACE_COLLECTION = Workspace.collection.name;
const USER_COLLECTION = EcomUser.collection.name;

// ─── Concurrency-limited parallel executor ────────────────────────────────────
// Runs all async thunks in parallel but at most `limit` at the same time.
// Returns an array of allSettled-style results: { status, value } or { status, reason }
async function runCapped(thunks, limit = 10) {
  const results = new Array(thunks.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < thunks.length) {
      const idx = nextIdx++;
      try {
        results[idx] = { status: 'fulfilled', value: await thunks[idx]() };
      } catch (e) {
        results[idx] = { status: 'rejected', reason: e };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, thunks.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ─── Simple in-memory cache factory ──────────────────────────────────────────
function makeCache(ttlMs = 60_000) {
  const store = new Map();
  return {
    get: (k) => { const e = store.get(k); return e && Date.now() - e.ts < ttlMs ? e.data : null; },
    set: (k, data) => store.set(k, { ts: Date.now(), data }),
    del: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

// ─── Agents Service Client ────────────────────────────────────────────────────

// GET /api/ecom/super-admin/service-agents — liste des agents service client
router.get('/service-agents', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const agents = await EcomUser.find({ role: 'service_client' })
      .select('name email isActive createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/service-agents — créer un agent service client
router.post('/service-agents', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Nom, email et mot de passe requis' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Mot de passe minimum 8 caractères' });
    }
    const exists = await EcomUser.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Un compte avec cet email existe déjà' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const agent = new EcomUser({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      password: hashed,
      role: 'service_client',
      isActive: true,
    });
    await agent.save();
    await logAudit(req, 'CREATE_SERVICE_AGENT', `Agent service client créé: ${agent.email}`, 'user', agent._id);
    res.json({ success: true, data: { _id: agent._id, name: agent.name, email: agent.email, isActive: agent.isActive, createdAt: agent.createdAt } });
  } catch (err) {
    console.error('[SuperAdmin] POST /service-agents error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/service-agents/:id — modifier (nom, email, mot de passe, statut)
router.patch('/service-agents/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, password, isActive } = req.body;
    const agent = await EcomUser.findOne({ _id: req.params.id, role: 'service_client' });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent introuvable' });
    if (name !== undefined) agent.name = name.trim();
    if (email !== undefined) agent.email = email.toLowerCase().trim();
    if (password !== undefined) {
      if (password.length < 8) return res.status(400).json({ success: false, message: 'Mot de passe minimum 8 caractères' });
      agent.password = await bcrypt.hash(password, 10);
    }
    if (isActive !== undefined) agent.isActive = Boolean(isActive);
    await agent.save();
    await logAudit(req, 'UPDATE_SERVICE_AGENT', `Agent service client modifié: ${agent.email}`, 'user', agent._id);
    res.json({ success: true, data: { _id: agent._id, name: agent.name, email: agent.email, isActive: agent.isActive } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/super-admin/service-agents/:id — supprimer un agent
router.delete('/service-agents/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const agent = await EcomUser.findOneAndDelete({ _id: req.params.id, role: 'service_client' });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent introuvable' });
    await logAudit(req, 'DELETE_SERVICE_AGENT', `Agent service client supprimé: ${agent.email}`, 'user', agent._id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Service Client — accès restreint (service_client + super_admin) ──────────

// GET /api/ecom/service-client/search — recherche users (pour les agents)
router.get('/service-client/search', requireEcomAuth, requireServiceClient, async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    if (!q.trim()) return res.json({ success: true, data: [] });
    const users = await EcomUser.find({
      role: { $nin: ['super_admin', 'service_client'] },
      $or: [
        { email: { $regex: q.trim(), $options: 'i' } },
        { name:  { $regex: q.trim(), $options: 'i' } },
      ],
    })
      .select('name email isActive role workspaceId createdAt lastLogin')
      .populate('workspaceId', 'name plan planExpiresAt')
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/ecom/super-admin/users - Tous les utilisateurs de toutes les workspaces
router.get('/users',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role, workspaceId, isActive, search, page = 1, limit = 100 } = req.query;
      const filter = {};

      if (role) filter.role = role;
      if (workspaceId) filter.workspaceId = workspaceId;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (search) filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name:  { $regex: search, $options: 'i' } },
      ];

      await logAudit(req, 'VIEW_USERS', `Consultation liste utilisateurs`, 'user');

      // Run user list + stats in parallel — previously sequential (4 round trips → 2)
      const [users, total, statsAgg] = await Promise.all([
        EcomUser.find(filter)
          .select('-password')
          .populate('workspaceId', 'name slug')
          .sort({ createdAt: -1 })
          .limit(Number(limit))
          .skip((Number(page) - 1) * Number(limit))
          .lean(),
        EcomUser.countDocuments(filter),
        EcomUser.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } } } }
        ]),
      ]);

      let totalActive = 0, totalInactive = 0;
      const byRole = statsAgg.map(r => { totalActive += r.active; totalInactive += (r.count - r.active); return { _id: r._id, count: r.count }; });

      res.json({
        success: true,
        data: {
          users,
          stats: { byRole, totalUsers: total, totalActive, totalInactive },
          pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
        }
      });
    } catch (error) {
      console.error('Erreur super-admin get users:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/users-growth — dashboard croissance utilisateurs
// KPIs inscriptions (jour/7j/30j + deltas), série journalière (inscriptions,
// cumul, actifs), DAU/WAU/MAU (sessions analytics), temps moyen par session
// et par utilisateur, top utilisateurs par temps passé.
router.get('/users-growth', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const now = new Date();
    const DAY = 86400000;
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - DAY);
    const seriesStart = new Date(startOfToday.getTime() - (days - 1) * DAY);
    const since = (n) => new Date(now.getTime() - n * DAY);

    // Durée de session : champ duration (secondes) sinon lastActivityAt - startedAt
    const durationSecExpr = {
      $cond: [
        { $gt: [{ $ifNull: ['$duration', 0] }, 0] },
        { $ifNull: ['$duration', 0] },
        { $divide: [{ $subtract: [{ $ifNull: ['$lastActivityAt', '$startedAt'] }, '$startedAt'] }, 1000] },
      ],
    };
    // ══ TOUTES les stats de ce dashboard sont calculées sur les MARCHANDS
    // (role ecom_admin) uniquement : les comptes staff (livreurs, closeuses,
    // comptables) créés par les marchands pollueraient inscriptions, activité,
    // temps passé et churn. ══
    const ADMIN = { role: 'ecom_admin' };
    const allUsersLight = await EcomUser.find(ADMIN, { lastLogin: 1, createdAt: 1, role: 1, isActive: 1 }).lean();
    const adminIds = allUsersLight.map((u) => u._id);
    const adminSessionScope = { userId: { $in: adminIds } };

    const sessionMatch = { startedAt: { $gte: since(days) }, ...adminSessionScope };

    const [
      lastSessionByUser,
      signupsToday, signupsYesterday, signups7, signupsPrev7, signups30, signupsPrev30,
      dauIds, wauIds, mauIds,
      signupSeriesRaw, activeSeriesRaw, usersBeforeSeries,
      engagementFacets,
    ] = await Promise.all([
      AnalyticsSession.aggregate([
        { $match: adminSessionScope },
        { $addFields: { activityAt: { $ifNull: ['$lastActivityAt', '$startedAt'] } } },
        { $group: {
          _id: '$userId',
          lastActivityAt: { $max: '$activityAt' },
          // Présence par fenêtre pour le churn période-sur-période (standard SaaS)
          activePrevWindow: { $max: { $cond: [{ $and: [{ $gte: ['$activityAt', new Date(now.getTime() - 60 * DAY)] }, { $lt: ['$activityAt', new Date(now.getTime() - 30 * DAY)] }] }, 1, 0] } },
          activeRecentWindow: { $max: { $cond: [{ $gte: ['$activityAt', new Date(now.getTime() - 30 * DAY)] }, 1, 0] } },
        } },
      ]),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: startOfToday } }),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: startOfYesterday, $lt: startOfToday } }),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: since(7) } }),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: since(14), $lt: since(7) } }),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: since(30) } }),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $gte: since(60), $lt: since(30) } }),
      AnalyticsSession.distinct('userId', { lastActivityAt: { $gte: startOfToday }, ...adminSessionScope }),
      AnalyticsSession.distinct('userId', { lastActivityAt: { $gte: since(7) }, ...adminSessionScope }),
      AnalyticsSession.distinct('userId', { lastActivityAt: { $gte: since(30) }, ...adminSessionScope }),
      EcomUser.aggregate([
        { $match: { ...ADMIN, createdAt: { $gte: seriesStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      ]),
      AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: seriesStart }, ...adminSessionScope } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } }, users: { $addToSet: '$userId' } } },
        { $project: { count: { $size: '$users' } } },
      ]),
      EcomUser.countDocuments({ ...ADMIN, createdAt: { $lt: seriesStart } }),
      AnalyticsSession.aggregate([
        { $match: sessionMatch },
        { $project: { userId: 1, lastActivityAt: 1, durationSec: durationSecExpr } },
        {
          $facet: {
            overall: [
              { $group: { _id: null, sessions: { $sum: 1 }, totalSec: { $sum: '$durationSec' }, avgSec: { $avg: '$durationSec' }, users: { $addToSet: '$userId' } } },
              { $project: { sessions: 1, totalSec: 1, avgSec: 1, usersTracked: { $size: '$users' } } },
            ],
            perUser: [
              { $group: { _id: '$userId', sessions: { $sum: 1 }, totalSec: { $sum: '$durationSec' }, lastActivityAt: { $max: '$lastActivityAt' } } },
              { $sort: { totalSec: -1 } },
              { $limit: 15 },
            ],
          },
        },
      ]),
    ]);

    // ── Activité réelle par utilisateur : max(lastLogin, dernière session) ──
    const lastSessionMap = new Map(lastSessionByUser.map((r) => [String(r._id), r.lastActivityAt]));
    const sessionWindowMap = new Map(lastSessionByUser.map((r) => [String(r._id), r]));
    const totalUsers = allUsersLight.length;
    let neverActive = 0;

    // ── Churn 30 j PÉRIODE SUR PÉRIODE (standard SaaS) ──
    // Base = marchands non bloqués actifs dans la fenêtre [-60 j, -30 j[
    // Churnés = ceux sans AUCUNE activité (session ou login) sur [-30 j, now]
    let eligible30 = 0;
    let churned30 = 0;
    const d30ms = since(30).getTime();
    const d60ms = since(60).getTime();
    for (const u of allUsersLight) {
      const key = String(u._id);
      const sessInfo = sessionWindowMap.get(key);
      const lastActivity = Math.max(
        u.lastLogin ? new Date(u.lastLogin).getTime() : 0,
        sessInfo?.lastActivityAt ? new Date(sessInfo.lastActivityAt).getTime() : 0,
      );
      if (!lastActivity) { neverActive += 1; continue; }
      if (u.isActive === false) continue;

      const loginMs = u.lastLogin ? new Date(u.lastLogin).getTime() : 0;
      const activePrev = Boolean(sessInfo?.activePrevWindow)
        || (loginMs >= d60ms && loginMs < d30ms);
      if (!activePrev) continue; // pas actif dans la fenêtre précédente → hors base
      eligible30 += 1;
      const activeRecent = Boolean(sessInfo?.activeRecentWindow) || loginMs >= d30ms;
      if (!activeRecent) churned30 += 1;
    }
    const churnRate30 = eligible30 > 0 ? Math.round((churned30 / eligible30) * 1000) / 10 : 0;

    const overall = engagementFacets?.[0]?.overall?.[0] || { sessions: 0, totalSec: 0, avgSec: 0, usersTracked: 0 };
    const perUser = engagementFacets?.[0]?.perUser || [];

    // Enrichir le top utilisateurs (nom / email)
    const topIds = perUser.map((u) => u._id).filter(Boolean);
    const topDocs = topIds.length
      ? await EcomUser.find({ _id: { $in: topIds } }, { name: 1, email: 1, role: 1 }).lean()
      : [];
    const topMap = new Map(topDocs.map((u) => [String(u._id), u]));
    const topUsers = perUser.map((u) => {
      const doc = topMap.get(String(u._id)) || {};
      return {
        id: String(u._id),
        name: doc.name || '—',
        email: doc.email || null,
        role: doc.role || null,
        sessions: u.sessions,
        totalMin: Math.round((u.totalSec || 0) / 60),
        avgSessionMin: u.sessions ? Math.round((u.totalSec || 0) / u.sessions / 60) : 0,
        lastActivityAt: u.lastActivityAt || null,
      };
    });

    // Série journalière continue (inscriptions + cumul + actifs)
    const signupMap = new Map(signupSeriesRaw.map((r) => [r._id, r.count]));
    const activeMap = new Map(activeSeriesRaw.map((r) => [r._id, r.count]));
    const series = [];
    let cumulative = usersBeforeSeries;
    for (let i = 0; i < days; i++) {
      const d = new Date(seriesStart.getTime() + i * DAY);
      const key = d.toISOString().slice(0, 10);
      const signups = signupMap.get(key) || 0;
      cumulative += signups;
      series.push({ date: key, signups, cumulative, active: activeMap.get(key) || 0 });
    }

    res.json({
      success: true,
      data: {
        generatedAt: now,
        days,
        totals: {
          users: totalUsers,
          // « Jamais actifs » : ni login ni session analytics — mesure d'activation honnête
          neverConnected: neverActive,
          connectedRate: totalUsers ? Math.round(((totalUsers - neverActive) / totalUsers) * 100) : 0,
        },
        churn: {
          // Churn 30 j : éligibles = inscrits ≥ 30 j ET actifs au moins une fois ;
          // churned = aucune activité (login ou session) sur les 30 derniers jours.
          rate30: churnRate30,
          churned30,
          eligible30,
          retention30: Math.round((100 - churnRate30) * 10) / 10,
        },
        signups: {
          today: signupsToday, yesterday: signupsYesterday,
          last7: signups7, prev7: signupsPrev7,
          last30: signups30, prev30: signupsPrev30,
        },
        activity: { dau: dauIds.length, wau: wauIds.length, mau: mauIds.length },
        engagement: {
          sessions: overall.sessions,
          usersTracked: overall.usersTracked,
          avgSessionMin: Math.round((overall.avgSec || 0) / 60 * 10) / 10,
          avgTimePerUserMin: overall.usersTracked ? Math.round((overall.totalSec || 0) / overall.usersTracked / 60) : 0,
          avgSessionsPerUser: overall.usersTracked ? Math.round((overall.sessions / overall.usersTracked) * 10) / 10 : 0,
        },
        series,
        topUsers,
      },
    });
  } catch (error) {
    console.error('[SuperAdmin] GET /users-growth error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul des statistiques utilisateurs' });
  }
});

// GET /api/ecom/super-admin/users/:id - Détails d'un utilisateur spécifique
router.get('/users/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      console.log(`🔍 [SuperAdmin] Récupération utilisateur ${id}...`);
      await logAudit(req, 'VIEW_USER_DETAIL', `Consultation détails utilisateur ${id}`, 'user', id);

      const user = await EcomUser.findById(id)
        .select('-password')
        .populate('workspaceId', 'name slug')
        .populate('workspaces.workspaceId', 'name slug')
        .populate('workspaces.invitedBy', 'email name');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      console.log(`✅ [SuperAdmin] Utilisateur ${user.email} trouvé`);

      res.json({
        success: true,
        data: { user }
      });
    } catch (error) {
      console.error('Erreur super-admin get user detail:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/workspaces - Toutes les workspaces (optimisé)
router.get('/workspaces',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      // ── Les deux requêtes en parallèle ───────────────────────────────────
      const [workspaces, memberCounts] = await Promise.all([

        // Workspace + owner en une seule aggregate ($lookup remplace populate N+1)
        Workspace.aggregate([
          { $sort: { createdAt: -1 } },
          {
            $lookup: {
              from: 'ecom_users',
              localField: 'owner',
              foreignField: '_id',
              as: '_ownerArr',
              pipeline: [{ $project: { email: 1, role: 1 } }],
            },
          },
          {
            $addFields: {
              owner: { $arrayElemAt: ['$_ownerArr', 0] },
            },
          },
          // Projeter uniquement les champs utilisés par le frontend
          {
            $project: {
              _ownerArr: 0,
              __v: 0,
              // champs lourds non affichés
              storeSettings: 0,
              shopifyWebhookToken: 0,
              whatsappAutoProductMediaRules: 0,
            },
          },
        ]),

        // Comptage membres par workspace
        EcomUser.aggregate([
          { $match: { workspaceId: { $ne: null } } },
          { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
        ]),
      ]);

      // Construire la map memberCount
      const memberMap = {};
      memberCounts.forEach(m => { memberMap[String(m._id)] = m.count; });

      const workspacesWithCounts = workspaces.map(ws => ({
        ...ws,
        memberCount: memberMap[String(ws._id)] || 0,
      }));

      res.json({
        success: true,
        data: {
          workspaces: workspacesWithCounts,
          totalWorkspaces: workspacesWithCounts.length,
          totalActive: workspacesWithCounts.filter(w => w.isActive).length,
        },
      });
    } catch (error) {
      console.error('Erreur super-admin get workspaces:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/role - Changer le rôle d'un utilisateur
router.put('/users/:id/role',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;
      if (!['super_admin', 'ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Rôle invalide' });
      }

      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      const oldRole = user.role;
      user.role = role;
      await user.save();
      await logAudit(req, 'CHANGE_ROLE', `Changement rôle: ${user.email} ${oldRole} → ${role}`, 'user', user._id);

      res.json({
        success: true,
        message: 'Rôle mis à jour',
        data: { id: user._id, email: user.email, role: user.role }
      });
    } catch (error) {
      console.error('Erreur super-admin update role:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/toggle - Activer/désactiver un utilisateur
router.put('/users/:id/toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (user._id.toString() === req.ecomUser._id.toString()) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous désactiver vous-même' });
      }

      user.isActive = !user.isActive;
      await user.save();
      await logAudit(req, 'TOGGLE_USER', `${user.isActive ? 'Activation' : 'Désactivation'} de ${user.email}`, 'user', user._id);

      res.json({
        success: true,
        message: user.isActive ? 'Utilisateur activé' : 'Utilisateur désactivé',
        data: { id: user._id, email: user.email, isActive: user.isActive }
      });
    } catch (error) {
      console.error('Erreur super-admin toggle user:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/users/:id/rita-toggle - Activer/désactiver Rita IA pour un utilisateur
router.put('/users/:id/rita-toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const user = await EcomUser.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      if (user.role !== 'ecom_admin') {
        return res.status(400).json({ success: false, message: 'Rita IA ne peut être activé que pour les admins' });
      }
      user.canAccessRitaAgent = !user.canAccessRitaAgent;
      await user.save();
      await logAudit(req, 'TOGGLE_RITA', `Rita IA ${user.canAccessRitaAgent ? 'activé' : 'désactivé'} pour ${user.email}`, 'user', user._id);
      res.json({
        success: true,
        message: user.canAccessRitaAgent ? 'Rita IA activé' : 'Rita IA désactivé',
        data: { id: user._id, email: user.email, canAccessRitaAgent: user.canAccessRitaAgent }
      });
    } catch (error) {
      console.error('Erreur super-admin toggle rita:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/ecom/super-admin/users/:id - Supprimer un utilisateur
router.delete('/users/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      if (req.ecomUser._id.toString() === req.params.id) {
        return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      const user = await EcomUser.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      await logAudit(req, 'DELETE_USER', `Suppression de ${user.email} (rôle: ${user.role})`, 'user', req.params.id);

      res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (error) {
      console.error('Erreur super-admin delete user:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/workspaces/:id/toggle - Activer/désactiver un workspace
router.put('/workspaces/:id/toggle',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Espace non trouvé' });
      }

      workspace.isActive = !workspace.isActive;
      await workspace.save();
      await logAudit(req, 'TOGGLE_WORKSPACE', `${workspace.isActive ? 'Activation' : 'Désactivation'} de l'espace ${workspace.name}`, 'workspace', workspace._id);

      res.json({
        success: true,
        message: workspace.isActive ? 'Espace activé' : 'Espace désactivé',
        data: workspace
      });
    } catch (error) {
      console.error('Erreur super-admin toggle workspace:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/workspaces/:id/subscription-warning - Toggle subscription warning banner
router.put('/workspaces/:id/subscription-warning',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Espace non trouvé' });
      }

      const { active, message } = req.body || {};
      const isActive = active !== undefined ? Boolean(active) : !workspace.subscriptionWarning?.active;

      workspace.subscriptionWarning = isActive
        ? buildRenewalSubscriptionWarning({
            message: message || workspace.subscriptionWarning?.message,
            activatedBy: req.ecomUser._id
          })
        : clearSubscriptionWarning();

      await workspace.save();
      await logAudit(req, 'SUBSCRIPTION_WARNING', `${isActive ? 'Activation' : 'Désactivation'} alerte abonnement pour ${workspace.name}`, 'workspace', workspace._id);

      res.json({
        success: true,
        message: isActive ? 'Alerte abonnement activée (24h)' : 'Alerte abonnement désactivée',
        data: workspace
      });
    } catch (error) {
      console.error('Erreur super-admin subscription-warning:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/audit-logs - Consulter les logs d'audit (immuables)
router.get('/audit-logs',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { action, userId, page = 1, limit = 100 } = req.query;
      const filter = {};
      if (action) filter.action = action;
      if (userId) filter.userId = userId;

      await logAudit(req, 'VIEW_SENSITIVE_DATA', 'Consultation des logs d\'audit', 'audit_log');

      const logs = await AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean();

      const total = await AuditLog.countDocuments(filter);

      // Stats par action
      const actionStats = await AuditLog.aggregate([
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          logs,
          stats: { actionStats, total },
          pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
        }
      });
    } catch (error) {
      console.error('Erreur audit-logs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/security-info - Infos sécurité (public pour les utilisateurs connectés)
router.get('/security-info',
  requireEcomAuth,
  async (req, res) => {
    try {
      const totalLogs = await AuditLog.countDocuments();
      const last24h = await AuditLog.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } });
      const failedLogins = await AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: new Date(Date.now() - 86400000) } });
      const lastActivity = await AuditLog.findOne().sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        data: {
          measures: [
            { id: 'encryption', name: 'Chiffrement mots de passe', status: 'active', type: 'bcrypt (12 rounds)', desc: 'Irréversible — même les admins ne peuvent pas lire les mots de passe' },
            { id: 'tls', name: 'Chiffrement en transit', status: 'active', type: 'HTTPS/TLS', desc: 'Toutes les communications sont chiffrées' },
            { id: 'aes', name: 'Chiffrement données sensibles', status: 'active', type: 'AES-256-GCM', desc: 'Données sensibles chiffrées dans la base de données' },
            { id: 'isolation', name: 'Isolation des workspaces', status: 'active', type: 'Filtrage MongoDB', desc: 'Chaque espace est cloisonné au niveau de la base de données' },
            { id: 'rbac', name: 'Contrôle d\'accès par rôle', status: 'active', type: 'RBAC', desc: 'Principe du moindre privilège appliqué' },
            { id: 'audit', name: 'Journalisation d\'audit', status: 'active', type: 'Logs immuables', desc: 'Chaque action est tracée et ne peut être ni modifiée ni supprimée' },
            { id: 'headers', name: 'Headers de sécurité HTTP', status: 'active', type: 'HSTS, CSP, XSS', desc: 'Protection contre XSS, clickjacking, sniffing' },
            { id: 'ratelimit', name: 'Protection brute force', status: 'active', type: 'Rate limiting', desc: 'Limitation des tentatives de connexion' },
            { id: 'nocookies', name: 'Zéro cookie tracking', status: 'active', type: 'JWT uniquement', desc: 'Aucun cookie publicitaire ni outil de suivi tiers' },
            { id: 'masking', name: 'Masquage des données', status: 'active', type: 'Data masking', desc: 'Les données sensibles sont masquées dans les réponses API' }
          ],
          stats: {
            totalAuditLogs: totalLogs,
            last24hActions: last24h,
            failedLoginsLast24h: failedLogins,
            lastActivity: lastActivity?.createdAt || null
          }
        }
      });
    } catch (error) {
      console.error('Erreur security-info:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/whatsapp-postulations - Toutes les postulations WhatsApp
router.get('/whatsapp-postulations',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { status } = req.query;

      console.log('🔍 [SuperAdmin] Récupération des postulations WhatsApp...');

      // Filtrer côté DB les workspaces qui ont une postulation WhatsApp
      const validStatuses = ['pending', 'active', 'rejected'];
      const statusFilter = status && validStatuses.includes(status) ? status : { $in: validStatuses };
      const allWorkspaces = await Workspace.aggregate([
        {
          $match: {
            'settings.whatsappConfig.status': statusFilter,
          }
        },
        { $lookup: { from: EcomUser.collection.name, localField: 'owner', foreignField: '_id', as: '_owner', pipeline: [{ $project: { email: 1, name: 1, role: 1 } }] } },
        { $addFields: { owner: { $ifNull: [{ $arrayElemAt: ['$_owner', 0] }, '$owner'] } } },
        { $project: { _owner: 0 } },
      ]);

      console.log(`📊 [SuperAdmin] ${allWorkspaces.length} workspaces avec postulation WhatsApp`);

      // Collecter tous les requestedBy IDs pour un seul batch fetch
      const requestedByIds = [...new Set(
        allWorkspaces
          .map(ws => ws.settings?.whatsappConfig?.requestedBy)
          .filter(Boolean)
          .map(id => id.toString())
      )];
      const requestedByUsers = requestedByIds.length > 0
        ? await EcomUser.find({ _id: { $in: requestedByIds } }).select('email name role').lean()
        : [];
      const requestedByMap = Object.fromEntries(requestedByUsers.map(u => [u._id.toString(), u]));

      const postulations = allWorkspaces.map(ws => {
        const config = ws.settings?.whatsappConfig || {};
        return {
          _id: ws._id,
          workspaceName: ws.name,
          workspaceSlug: ws.slug,
          owner: ws.owner,
          isActive: ws.isActive,
          phoneNumber: config.phoneNumber || '',
          status: config.status || 'none',
          requestedAt: config.requestedAt || null,
          activatedAt: config.activatedAt || null,
          note: config.note || '',
          businessName: config.businessName || '',
          contactName: config.contactName || '',
          email: config.email || '',
          currentWhatsappNumber: config.currentWhatsappNumber || '',
          businessType: config.businessType || '',
          monthlyMessages: config.monthlyMessages || '',
          reason: config.reason || '',
          requestedBy: config.requestedBy ? (requestedByMap[config.requestedBy.toString()] || null) : null,
        };
      });

      // Trier par date de demande (plus récent en premier)
      postulations.sort((a, b) => {
        const dateA = a.requestedAt ? new Date(a.requestedAt) : new Date(0);
        const dateB = b.requestedAt ? new Date(b.requestedAt) : new Date(0);
        return dateB - dateA;
      });

      const stats = {
        total: postulations.length,
        pending: postulations.filter(p => p.status === 'pending').length,
        active: postulations.filter(p => p.status === 'active').length,
        rejected: postulations.filter(p => p.status === 'rejected').length
      };

      console.log(`✅ [SuperAdmin] ${postulations.length} postulations WhatsApp trouvées`);
      console.log(`📊 [SuperAdmin] Stats: ${stats.pending} pending, ${stats.active} active, ${stats.rejected} rejected`);

      res.json({
        success: true,
        data: { postulations, stats }
      });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-postulations:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/super-admin/whatsapp-postulations/:id - Approuver/rejeter une postulation
router.put('/whatsapp-postulations/:id',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { status, note } = req.body;

      if (!['active', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide (active, rejected, pending)' });
      }

      const workspace = await Workspace.findById(req.params.id);
      if (!workspace) {
        return res.status(404).json({ success: false, message: 'Workspace non trouvé' });
      }

      // Mettre à jour dans settings.whatsappConfig (où le formulaire sauvegarde)
      if (!workspace.settings) workspace.settings = {};
      if (!workspace.settings.whatsappConfig) {
        // Peut-être que c'est dans whatsappConfig directement
        if (workspace.whatsappConfig && workspace.whatsappConfig.status !== 'none') {
          workspace.settings.whatsappConfig = { ...workspace.whatsappConfig.toObject() };
        } else {
          return res.status(400).json({ success: false, message: 'Aucune postulation WhatsApp trouvée pour ce workspace' });
        }
      }

      workspace.settings.whatsappConfig.status = status;
      if (note !== undefined) workspace.settings.whatsappConfig.note = note;
      if (status === 'active') {
        workspace.settings.whatsappConfig.activatedAt = new Date();
        workspace.settings.whatsappConfig.note = note || 'Approuvé par le Super Admin';
        workspace.whatsappConfig = {
          phoneNumber: workspace.settings.whatsappConfig.phoneNumber,
          status: 'active',
          requestedAt: workspace.settings.whatsappConfig.requestedAt,
          activatedAt: new Date(),
          note: note || 'Approuvé par le Super Admin'
        };
      } else if (status === 'rejected') {
        workspace.settings.whatsappConfig.note = note || 'Rejeté par le Super Admin';
      }

      workspace.markModified('settings');
      await workspace.save();
      await logAudit(req, 'WHATSAPP_POSTULATION_UPDATE', `${status === 'active' ? 'Approbation' : 'Rejet'} postulation WhatsApp pour ${workspace.name} (tel: ${workspace.settings.whatsappConfig.phoneNumber})`, 'workspace', workspace._id);

      console.log(`📱 [SuperAdmin] Postulation WhatsApp ${status}: ${workspace.name} (${workspace.settings.whatsappConfig.phoneNumber})`);

      res.json({
        success: true,
        message: status === 'active' ? '✅ Postulation approuvée' : status === 'rejected' ? '❌ Postulation rejetée' : '⏳ Postulation remise en attente',
        data: {
          workspaceId: workspace._id,
          status,
          phoneNumber: workspace.settings.whatsappConfig.phoneNumber
        }
      });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-postulation update:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/super-admin/whatsapp-logs - Logs d'envoi WhatsApp
router.get('/whatsapp-logs',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { workspaceId, status, page = 1, limit = 100 } = req.query;
      const filter = {};
      if (workspaceId) filter.workspaceId = workspaceId;
      if (status) filter.status = status;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [logs, total] = await Promise.all([
        WhatsAppLog.find(filter)
          .sort({ sentAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('workspaceId', 'name slug')
          .populate('userId', 'email name')
          .populate('campaignId', 'name')
          .lean(),
        WhatsAppLog.countDocuments(filter)
      ]);

      const stats = {
        total,
        sent: await WhatsAppLog.countDocuments({ ...filter, status: 'sent' }),
        delivered: await WhatsAppLog.countDocuments({ ...filter, status: 'delivered' }),
        failed: await WhatsAppLog.countDocuments({ ...filter, status: 'failed' }),
        pending: await WhatsAppLog.countDocuments({ ...filter, status: 'pending' }),
      };

      res.json({ success: true, data: { logs, stats, page: parseInt(page), total } });
    } catch (error) {
      console.error('Erreur super-admin whatsapp-logs:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// SUPPORT CHAT — Admin endpoints
// ═══════════════════════════════════════════════════════════════

// GET /api/ecom/super-admin/support/config — Support notification settings
router.get('/support/config', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const adminUserId = req.ecomUser?._id?.toString();
    const [admin, availableInstances] = await Promise.all([
      EcomUser.findById(req.ecomUser._id)
        .select('supportNotificationPhone supportNotificationInstanceId supportNotificationEnabled phone')
        .lean(),
      WhatsAppInstance.find({
        userId: adminUserId,
        isActive: true,
      })
        .select('_id instanceName customName status lastSeen workspaceId')
        .sort({ lastSeen: -1 })
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        supportNotificationPhone: admin?.supportNotificationPhone || '',
        supportNotificationInstanceId: admin?.supportNotificationInstanceId ? String(admin.supportNotificationInstanceId) : '',
        supportNotificationEnabled: admin?.supportNotificationEnabled === true,
        fallbackPhone: admin?.phone || '',
        availableInstances,
      }
    });
  } catch (err) {
    console.error('[Support Admin] GET /support/config:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/super-admin/support/config — Update WhatsApp notification destination
router.put('/support/config', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const adminUserId = req.ecomUser?._id?.toString();
    const { supportNotificationPhone, supportNotificationEnabled, supportNotificationInstanceId } = req.body || {};
    let cleanPhone = '';
    let cleanInstanceId = null;

    if (supportNotificationPhone) {
      const phoneCheck = formatInternationalPhone(supportNotificationPhone);
      if (!phoneCheck.success) {
        return res.status(400).json({ success: false, message: phoneCheck.error || 'Numero WhatsApp invalide' });
      }
      cleanPhone = phoneCheck.formatted;
    }

    if (supportNotificationInstanceId) {
      const instance = await WhatsAppInstance.findOne({
        _id: supportNotificationInstanceId,
        userId: adminUserId,
        isActive: true,
        status: { $in: ['connected', 'active', 'configured'] },
      }).select('_id status');

      if (!instance) {
        return res.status(400).json({ success: false, message: 'Instance WhatsApp support introuvable' });
      }

      cleanInstanceId = instance._id;
    }

    if (supportNotificationEnabled === true && !cleanPhone) {
      return res.status(400).json({ success: false, message: 'Numero WhatsApp requis pour activer les alertes support' });
    }

    if (supportNotificationEnabled === true && !cleanInstanceId) {
      return res.status(400).json({ success: false, message: 'Selectionnez une instance WhatsApp dediee au support' });
    }

    const admin = await EcomUser.findByIdAndUpdate(
      req.ecomUser._id,
      {
        $set: {
          supportNotificationPhone: cleanPhone,
          supportNotificationInstanceId: cleanInstanceId,
          supportNotificationEnabled: supportNotificationEnabled === true && !!cleanPhone,
        },
      },
      { new: true }
    ).select('supportNotificationPhone supportNotificationInstanceId supportNotificationEnabled');

    const availableInstances = await WhatsAppInstance.find({
      userId: adminUserId,
      isActive: true,
    })
      .select('_id instanceName customName status lastSeen workspaceId')
      .sort({ lastSeen: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        supportNotificationPhone: admin?.supportNotificationPhone || '',
        supportNotificationInstanceId: admin?.supportNotificationInstanceId ? String(admin.supportNotificationInstanceId) : '',
        supportNotificationEnabled: admin?.supportNotificationEnabled === true,
        availableInstances,
      }
    });
  } catch (err) {
    console.error('[Support Admin] PUT /support/config:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/super-admin/support — Liste des conversations
router.get('/support', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, workflowStatus, priority, workspaceId, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    const workflowFilter = workflowStatus || status;
    if (workflowFilter && workflowFilter !== 'all') {
      if (['ai', 'pending_admin', 'resolved'].includes(workflowFilter)) {
        filter.workflowStatus = workflowFilter;
      } else {
        filter.status = workflowFilter;
      }
    }
    if (priority && priority !== 'all') filter.priority = priority;
    if (workspaceId && workspaceId !== 'all') filter.workspaceId = workspaceId;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { subject: regex },
        { userName: regex },
        { userEmail: regex },
        { visitorName: regex },
        { visitorEmail: regex },
        { aiSummary: regex },
      ];
    }

    const conversations = await SupportConversation.find(filter)
      .select('sessionId userId userName userEmail visitorName visitorEmail workspaceId subject category priority status workflowStatus handledBy aiConfidence aiSummary escalationReason unreadAdmin unreadUser lastMessageAt createdAt messages')
      .populate('workspaceId', 'name slug subdomain')
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await SupportConversation.countDocuments(filter);
    const unreadTotal = await SupportConversation.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$unreadAdmin' } } }
    ]);
    const workspaceOptions = await Workspace.find({}, { name: 1, slug: 1, subdomain: 1 })
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        conversations,
        workspaceOptions,
        total,
        unreadTotal: unreadTotal[0]?.total || 0,
        page: Number(page),
      }
    });
  } catch (err) {
    console.error('[Support Admin] GET /support:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/super-admin/support/:sessionId — Détail + mark as read
router.get('/support/:sessionId', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: { unreadAdmin: 0 } },
      { new: true }
    ).populate('workspaceId', 'name slug subdomain');
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] GET /support/:id:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/support/:sessionId/reply — Agent réplique
router.post('/support/:sessionId/reply', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, agentName } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      {
        $push: { messages: { from: 'agent', senderType: 'admin', text: text.trim().slice(0, 2000), agentName: agentName || 'Support' } },
        $set:  {
          status: 'replied',
          workflowStatus: 'pending_admin',
          handledBy: 'admin',
          lastMessageAt: new Date(),
          unreadAdmin: 0,
        },
        $inc:  { unreadUser: 1 },
      },
      { new: true }
    );

    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    emitSupportConversationUpdate(conv, { eventType: 'admin_reply', initiator: 'admin' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] POST /support/:id/reply:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/super-admin/support/:sessionId/status — Changer le statut
router.put('/support/:sessionId/status', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, workflowStatus } = req.body;
    const update = {};

    if (workflowStatus !== undefined) {
      if (!['ai', 'pending_admin', 'resolved'].includes(workflowStatus)) {
        return res.status(400).json({ success: false, message: 'workflowStatus invalide' });
      }
      update.workflowStatus = workflowStatus;
      update.status = workflowStatus === 'resolved' ? 'closed' : 'replied';
      if (workflowStatus === 'resolved' && !update.handledBy) {
        update.handledBy = 'admin';
      }
    }

    if (status !== undefined) {
      if (!['open', 'replied', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide' });
      }
      update.status = status;
      if (status === 'closed') update.workflowStatus = 'resolved';
      if (status === 'open' && !update.workflowStatus) update.workflowStatus = 'pending_admin';
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'Aucune mise a jour fournie' });
    }

    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId },
      { $set: update },
      { new: true }
    );
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    emitSupportConversationUpdate(conv, { eventType: 'status_changed', initiator: 'admin' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] PUT /support/:id/status:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/support/send-to-user — Envoyer un message à un utilisateur spécifique
router.post('/support/send-to-user', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { userId, text, subject, agentName } = req.body;
    if (!userId || !text?.trim()) {
      return res.status(400).json({ success: false, message: 'userId et text requis' });
    }
    const user = await EcomUser.findById(userId).select('name email workspaceId');
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    const sessionId = `admin_to_${userId}_${Date.now()}`;
    const conv = await SupportConversation.create({
      sessionId,
      userId: user._id,
      userName: user.name || '',
      userEmail: user.email || '',
      workspaceId: user.workspaceId || null,
      subject: (subject || '').trim().slice(0, 200) || 'Message du support',
      category: 'general',
      priority: 'normal',
      workflowStatus: 'resolved',
      handledBy: 'admin',
      messages: [{ from: 'agent', senderType: 'admin', text: text.trim().slice(0, 2000), agentName: agentName || 'Scalor' }],
      unreadUser: 1,
      status: 'replied',
      lastMessageAt: new Date(),
    });

    emitSupportConversationUpdate(conv, { eventType: 'admin_outbound', initiator: 'admin' });

    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support Admin] POST /support/send-to-user:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/support/broadcast — Envoyer un message à tous les utilisateurs actifs
router.post('/support/broadcast', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { text, subject, agentName } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    const users = await EcomUser.find({ isActive: true, role: { $ne: 'super_admin' } })
      .select('_id name email workspaceId')
      .lean();

    const safeText = text.trim().slice(0, 2000);
    const safeSubject = (subject || '').trim().slice(0, 200) || 'Message de Scalor';
    const agent = agentName || 'Scalor';
    const now = new Date();

    const docs = users.map(u => ({
      sessionId: `broadcast_${u._id}_${now.getTime()}`,
      userId: u._id,
      userName: u.name || '',
      userEmail: u.email || '',
      workspaceId: u.workspaceId || null,
      subject: safeSubject,
      category: 'general',
      priority: 'normal',
      workflowStatus: 'resolved',
      handledBy: 'admin',
      messages: [{ from: 'agent', senderType: 'admin', text: safeText, agentName: agent, createdAt: now }],
      unreadUser: 1,
      status: 'replied',
      lastMessageAt: now,
    }));

    await SupportConversation.insertMany(docs, { ordered: false });

    docs.forEach((doc) => {
      emitSupportConversationUpdate(doc, { eventType: 'admin_broadcast', initiator: 'admin' });
    });

    res.json({ success: true, data: { sent: docs.length } });
  } catch (err) {
    console.error('[Support Admin] POST /support/broadcast:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Plan management ─────────────────────────────────────────────────────────

// GET /api/ecom/super-admin/workspaces — list workspaces with plan info
router.get('/workspaces', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { search, plan, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (plan) filter.plan = plan;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const workspaces = await Workspace.find(filter)
      .select('name slug plan planExpiresAt trialStartedAt trialEndsAt trialUsed owner freeGenerationsRemaining paidGenerationsRemaining creativeCreditsRemaining totalGenerations')
      .populate('owner', 'email name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Workspace.countDocuments(filter);
    res.json({ success: true, data: { workspaces, total } });
  } catch (err) {
    console.error('[SuperAdmin] GET /workspaces error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/workspaces/:id/plan — manually set plan
router.patch('/workspaces/:id/plan', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { plan, durationMonths = 1 } = req.body;
    if (!['free', 'starter', 'pro', 'ultra'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Plan invalide (free/starter/pro/ultra)' });
    }

    const parsedDurationMonths = plan === 'free' ? 1 : Number.parseInt(String(durationMonths), 10);
    if (plan !== 'free' && ![1, 3, 6, 12].includes(parsedDurationMonths)) {
      return res.status(400).json({ success: false, message: 'Durée invalide (1/3/6/12 mois)' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    await logAudit(req, 'SET_PLAN', `Plan set to ${plan} for workspace ${workspace.name}`, 'workspace', workspace._id);

    if (plan === 'free') {
      await downgradeWorkspaceToFree(workspace, {
        actorId: req.ecomUser._id,
        reason: 'super_admin_manual',
        createSystemNotification: true
      });
    } else {
      const planLabels = {
        starter: 'Scalor',
        pro: 'Pro',
        ultra: 'Ultra'
      };
      const now = new Date();
      const base = workspace.planExpiresAt && workspace.planExpiresAt > now ? workspace.planExpiresAt : now;
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + parsedDurationMonths);
      workspace.plan = plan;
      workspace.planExpiresAt = newExpiry;
      workspace.subscriptionWarning = buildPlanUpdatedWarning({
        message: `Votre plan a ete mis a jour vers ${planLabels[plan] || plan}.`,
        activatedBy: req.ecomUser._id
      });
      await workspace.save();
    }

    res.json({ success: true, workspace: { _id: workspace._id, plan: workspace.plan, planExpiresAt: workspace.planExpiresAt, durationMonths: parsedDurationMonths } });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /workspaces/:id/plan error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Plan configuration (pricing, limits, features) ─────────────────────────

// GET /api/ecom/super-admin/plans — list all plan configs
router.get('/plans', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    await PlanConfig.seedDefaults();
    const plans = await PlanConfig.find().sort({ order: 1 }).lean();
    res.json({ success: true, plans });
  } catch (err) {
    console.error('[SuperAdmin] GET /plans error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/plans/:key — update one plan config
router.patch('/plans/:key', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    if (!PLAN_KEYS.includes(key)) {
      return res.status(400).json({ success: false, message: 'Clé de plan invalide' });
    }
    const allowed = [
      'displayName', 'tagline', 'priceRegular', 'pricePromo', 'promoActive',
      'promoExpiresAt', 'currency', 'limits', 'features', 'featuresList',
      'highlighted', 'ctaLabel', 'order'
    ];
    const update = {};
    for (const k of allowed) {
      if (k in req.body) update[k] = req.body[k];
    }
    const plan = await PlanConfig.findOneAndUpdate(
      { key },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    invalidatePlanCache();
    await logAudit(req, 'UPDATE_PLAN_CONFIG', `Plan config ${key} updated`, 'plan', plan._id);
    res.json({ success: true, plan });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /plans/:key error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/super-admin/generation-pricing — AI credit tariffs config
router.get('/generation-pricing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await GenerationPricingConfig.getSingleton();
    res.json({ success: true, pricing: config.getSnapshot() });
  } catch (err) {
    console.error('[SuperAdmin] GET /generation-pricing error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/generation-pricing — update AI credit tariffs config
router.patch('/generation-pricing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await GenerationPricingConfig.getSingleton();
    const allowed = [
      'currency',
      'unitPriceRegular',
      'unitPricePromo',
      'packPriceRegular',
      'packPricePromo',
      'promoActive',
      'promoExpiresAt',
    ];

    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }

    const updated = await GenerationPricingConfig.findByIdAndUpdate(
      config._id,
      { $set: update },
      { new: true, runValidators: true }
    );

    await logAudit(req, 'UPDATE_GENERATION_PRICING', 'AI generation pricing config updated', 'generation_pricing', updated._id);
    res.json({ success: true, pricing: updated.getSnapshot() });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /generation-pricing error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Tarifs Creative Center (crédits par fonctionnalité) ─────────────────────
// GET /api/ecom/super-admin/creative-pricing — grille effective (défauts + overrides)
router.get('/creative-pricing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await CreativePricingConfig.getSingleton();
    res.json({ success: true, pricing: config.getSnapshot() });
  } catch (err) {
    console.error('[SuperAdmin] GET /creative-pricing error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/creative-pricing
// Body : { pricePerCreditFcfa?, features?: { video: 3, voice: 0, … } } (crédits, 0 = gratuit)
router.patch('/creative-pricing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await CreativePricingConfig.getSingleton();

    if ('pricePerCreditFcfa' in req.body) {
      const v = Number(req.body.pricePerCreditFcfa);
      if (!Number.isFinite(v) || v < 1 || v > 1_000_000) {
        return res.status(400).json({ success: false, message: 'Prix du crédit invalide (min 1 FCFA)' });
      }
      config.pricePerCreditFcfa = Math.round(v);
    }

    const feats = req.body.features && typeof req.body.features === 'object' ? req.body.features : {};
    for (const [key, raw] of Object.entries(feats)) {
      if (!(key in CREATIVE_PRICING)) {
        return res.status(400).json({ success: false, message: `Fonctionnalité inconnue : ${key}` });
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 1000) {
        return res.status(400).json({ success: false, message: `Coût invalide pour « ${CREATIVE_PRICING[key].label} » (0 à 1000 crédits)` });
      }
      config.featureCredits.set(key, Math.round(n));
    }

    await config.save();
    invalidateCreativePricingCache(); // les débits utilisent la nouvelle grille immédiatement
    await logAudit(req, 'UPDATE_CREATIVE_PRICING', 'Creative Center pricing updated', 'creative_pricing', config._id);
    res.json({ success: true, pricing: config.getSnapshot() });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /creative-pricing error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── Creative Center : mode gratuit global ────────────────────────────────────
// GET /api/ecom/super-admin/creative-free-mode — état du toggle
router.get('/creative-free-mode', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const config = await CreativePricingConfig.getSingleton();
    res.json({ success: true, enabled: !!config.freeMode });
  } catch (err) {
    console.error('[SuperAdmin] GET /creative-free-mode error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/creative-free-mode — Body : { enabled: bool }
// true = toutes les fonctionnalités du Creative Center gratuites (aucun débit).
router.patch('/creative-free-mode', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Champ « enabled » (booléen) requis' });
    }
    const config = await CreativePricingConfig.getSingleton();
    config.freeMode = req.body.enabled;
    await config.save();
    invalidateCreativePricingCache(); // effectif immédiatement sur les débits
    await logAudit(req, 'UPDATE_CREATIVE_FREE_MODE', `Creative free mode ${config.freeMode ? 'enabled' : 'disabled'}`, 'creative_pricing', config._id);
    res.json({ success: true, enabled: !!config.freeMode });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /creative-free-mode error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── Creative Center : toutes les générations (tous utilisateurs) ────────────
// GET /api/ecom/super-admin/creative-generations?page=&limit=&search=&scope=
// Agrège 3 sources : CreativeAsset (affiches/textes/vidéos/voix du générateur),
// GeneratedMedia (images/GIF/vidéos du builder) et AutoMontageJob (montages,
// TTL 2 h). Réponse : { items, total, page, pages }.
//
// scope=final-videos retourne uniquement les CreativeAsset vidéo durables,
// enregistrés avec leur auteur à la fin des jobs. Les GeneratedMedia (GIF et
// clips de scène) ainsi que les documents de suivi temporaires sont exclus.
router.get('/creative-generations', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const search = String(req.query.search || '').trim().slice(0, 80);
    const finalVideosOnly = String(req.query.scope || '') === 'final-videos';

    const finalVideoUrlFilter = () => ({
      $type: 'string',
      $nin: [''],
      $not: /\.gif(?:$|[?#])/i,
    });
    const intermediateVideoKinds = [
      'scene', 'scene-video', 'segment', 'video-segment', 'clip',
      'preview', 'broll', 'b-roll',
    ];

    // Recherche : texte (produit, label, prompt) OU utilisateur (nom, email).
    const filters = finalVideosOnly
      ? {
          asset: {
            type: 'video',
            videoUrl: finalVideoUrlFilter(),
            'meta.kind': { $nin: intermediateVideoKinds },
            'meta.isSegment': { $ne: true },
            'meta.final': { $ne: false },
          },
          // Les GeneratedMedia sont des images, GIF ou clips de scène. Ils ne
          // constituent pas des rendus finaux, même lorsque type=video.
          media: { _id: { $in: [] } },
          // AutoMontageJob est un suivi temporaire (TTL). Les rendus finaux
          // sont copiés dans CreativeAsset avec le userId exact.
          montage: { _id: { $in: [] } },
        }
      : { asset: {}, media: {}, montage: {} };

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [users, workspaces] = await Promise.all([
        EcomUser.find({ $or: [{ name: rx }, { email: rx }] })
          .select('_id').limit(300).lean(),
        Workspace.find({ name: rx }).select('_id').limit(300).lean(),
      ]);
      const userIds = users.map((u) => u._id);
      const workspaceIds = workspaces.map((w) => w._id);
      filters.asset = {
        $and: [
          filters.asset,
          { $or: [
            { productName: rx }, { label: rx },
            { userId: { $in: userIds } },
            { workspaceId: { $in: workspaceIds } },
          ] },
        ],
      };
      filters.media = finalVideosOnly
        ? filters.media
        : { $or: [{ prompt: rx }, { kind: rx }, { userId: { $in: userIds } }, { workspaceId: { $in: workspaceIds } }] };
      filters.montage = { _id: { $in: [] } };
    }

    // Chaque source triée par date, bornée à page*limit : le merge trié + slice
    // donne une pagination correcte sans charger les collections entières.
    const fetchCount = page * limit;
    const [assets, medias, montages, cAssets, cMedias, cMontages] = await Promise.all([
      CreativeAsset.find(filters.asset).sort({ createdAt: -1 }).limit(fetchCount)
        .select('workspaceId userId productName type formatId label imageUrl videoUrl audioUrl meta createdAt').lean(),
      GeneratedMedia.find(filters.media).sort({ createdAt: -1 }).limit(fetchCount)
        .select('workspaceId storeId userId type url prompt kind createdAt').lean(),
      AutoMontageJob.find(filters.montage).sort({ createdAt: -1 }).limit(fetchCount)
        .select('workspaceId userId status outputs report createdAt').lean(),
      CreativeAsset.countDocuments(filters.asset),
      GeneratedMedia.countDocuments(filters.media),
      AutoMontageJob.countDocuments(filters.montage),
    ]);

    const items = [
      ...assets.map((a) => ({
        id: String(a._id),
        type: a.type === 'audio' ? 'voice' : (a.type === 'launch' ? 'text' : (a.type || 'image')),
        title: a.label || a.productName || '',
        productName: a.productName || '',
        mediaUrl: a.imageUrl || a.videoUrl || a.audioUrl || '',
        thumbnailUrl: a.imageUrl || '',
        cost: a.type === 'image' ? 1 : undefined,
        kind: a.meta?.kind || a.meta?.source || '',
        format: a.meta?.format || '',
        durationSec: Number(a.meta?.durationSec) || undefined,
        final: a.type === 'video',
        userId: a.userId || null,
        storeId: null,
        workspaceId: a.workspaceId || null,
        createdAt: a.createdAt,
      })),
      ...medias.map((m) => ({
        id: String(m._id),
        type: m.type === 'gif' ? 'video' : (m.type || 'image'),
        title: (m.prompt || '').slice(0, 90) || m.kind || '',
        productName: '',
        mediaUrl: m.url || '',
        thumbnailUrl: m.type === 'image' ? (m.url || '') : '',
        userId: m.userId || null,
        storeId: m.storeId || null,
        workspaceId: m.workspaceId || null,
        createdAt: m.createdAt,
      })),
      ...montages.flatMap((j) => {
        const outputs = finalVideosOnly ? (j.outputs || []) : (j.outputs || []).slice(0, 1);
        return outputs
          .filter((output) => output?.url && !/\.gif(?:$|[?#])/i.test(output.url))
          .map((output, outputIndex) => ({
            id: `${String(j._id)}:${output.format || outputIndex}`,
            type: 'montage',
            title: `Montage automatique IA${output.format ? ` · ${output.format}` : ''}`,
            productName: '',
            mediaUrl: output.url,
            thumbnailUrl: '',
            cost: 4,
            kind: 'auto-montage',
            format: output.format || '',
            durationSec: Number(output.durationSec) || undefined,
            final: true,
            userId: j.userId || null,
            storeId: null,
            workspaceId: j.workspaceId || null,
            createdAt: j.createdAt,
          }));
      }),
    ]
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
      .slice((page - 1) * limit, page * limit);

    // Enrichissement user/store/workspace sur la page servie uniquement.
    const userIds = [...new Set(items.map((i) => i.userId).filter(Boolean).map(String))];
    const storeIds = [...new Set(items.map((i) => i.storeId).filter(Boolean).map(String))];
    const workspaceIds = [...new Set(items.map((i) => i.workspaceId).filter(Boolean).map(String))];
    const [userDocs, storeDocs, workspaceDocs] = await Promise.all([
      userIds.length ? EcomUser.find({ _id: { $in: userIds } }).select('name email').lean() : [],
      storeIds.length ? Store.find({ _id: { $in: storeIds } }).select('name').lean() : [],
      workspaceIds.length ? Workspace.find({ _id: { $in: workspaceIds } }).select('name').lean() : [],
    ]);
    const userMap = new Map(userDocs.map((u) => [String(u._id), u]));
    const storeMap = new Map(storeDocs.map((s) => [String(s._id), s]));
    const workspaceMap = new Map(workspaceDocs.map((w) => [String(w._id), w]));
    for (const it of items) {
      const u = it.userId ? userMap.get(String(it.userId)) : null;
      const s = it.storeId ? storeMap.get(String(it.storeId)) : null;
      const w = it.workspaceId ? workspaceMap.get(String(it.workspaceId)) : null;
      it.user = u ? { name: u.name || '', email: u.email || '' } : null;
      it.store = s ? { name: s.name || '' } : null;
      it.workspace = w ? { name: w.name || '' } : null;
      delete it.userId; delete it.storeId; delete it.workspaceId;
    }

    const total = cAssets + cMedias + cMontages;
    res.json({
      success: true,
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      scope: finalVideosOnly ? 'final-videos' : 'all',
    });
  } catch (err) {
    console.error('[SuperAdmin] GET /creative-generations error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/super-admin/workspaces/:id/generations — manually update generations
// Accepte aussi `creativeCredits` (crédits images génératives type Meta/Google Ads).
router.patch('/workspaces/:id/generations', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { freeGenerations, paidGenerations, creativeCredits } = req.body;

    // Validation : au moins un des 3 champs doit être un nombre
    const fields = { freeGenerations, paidGenerations, creativeCredits };
    const provided = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (provided.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ fourni (freeGenerations / paidGenerations / creativeCredits)' });
    }
    for (const [key, val] of provided) {
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        return res.status(400).json({ success: false, message: `${key} doit être un nombre` });
      }
      if (val < 0) {
        return res.status(400).json({ success: false, message: `${key} doit être positif` });
      }
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace introuvable' });

    // Construit le message d'audit avec les diffs (avant → après) pour chaque champ modifié
    const changes = [];
    if (typeof freeGenerations === 'number') {
      changes.push(`free ${workspace.freeGenerationsRemaining || 0}→${freeGenerations}`);
      workspace.freeGenerationsRemaining = freeGenerations;
    }
    if (typeof paidGenerations === 'number') {
      changes.push(`paid ${workspace.paidGenerationsRemaining || 0}→${paidGenerations}`);
      workspace.paidGenerationsRemaining = paidGenerations;
    }
    if (typeof creativeCredits === 'number') {
      changes.push(`creative ${workspace.creativeCreditsRemaining || 0}→${creativeCredits}`);
      workspace.creativeCreditsRemaining = creativeCredits;
    }

    await logAudit(
      req,
      'UPDATE_GENERATIONS',
      `Updated credits for workspace ${workspace.name}: ${changes.join(', ')}`,
      'workspace',
      workspace._id
    );

    await workspace.save();

    res.json({
      success: true,
      message: 'Crédits mis à jour avec succès',
      workspace: {
        _id: workspace._id,
        freeGenerationsRemaining: workspace.freeGenerationsRemaining,
        paidGenerationsRemaining: workspace.paidGenerationsRemaining,
        creativeCreditsRemaining: workspace.creativeCreditsRemaining || 0,
        totalGenerations: workspace.totalGenerations || 0,
      }
    });
  } catch (err) {
    console.error('[SuperAdmin] PATCH /workspaces/:id/generations error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Growth & re-engagement console (Super Admin) ────────────────────────────
// Segments workspaces by REAL engagement (max lastLogin across members + owner)
// crossed with billing state, and returns an MRR table + owner contacts.
// Powers the super-admin "Croissance & Relances" page.
const GROWTH_FALLBACK_PRICES = { free: 0, starter: 6900, pro: 14900, ultra: 29899 };

// GET /api/ecom/super-admin/growth?activeDays=30
router.get('/growth', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();
    const activeDays = Math.min(365, Math.max(1, Number(req.query.activeDays) || 30));
    const activeThreshold = new Date(now.getTime() - activeDays * 86400000);
    const paidPlans = ['starter', 'pro', 'ultra'];

    const yearAgo = new Date(now.getTime() - 365 * 86400000);
    const [workspaces, planConfigs, memberActivity, ordersByCountryRaw] = await Promise.all([
      Workspace.find({}, {
        name: 1, slug: 1, plan: 1, planExpiresAt: 1, trialEndsAt: 1, trialUsed: 1,
        isActive: 1, owner: 1, createdAt: 1
      }).lean(),
      PlanConfig.find({}, { key: 1, displayName: 1, priceRegular: 1, pricePromo: 1, promoActive: 1, promoExpiresAt: 1, currency: 1 }).lean(),
      // Latest login across all members of each workspace
      EcomUser.aggregate([
        { $match: { workspaceId: { $ne: null } } },
        { $group: { _id: '$workspaceId', lastLogin: { $max: '$lastLogin' }, members: { $sum: 1 } } }
      ]),
      // GMV by country signal (last 12 months) — grouped by dial code + country field
      StoreOrder.aggregate([
        { $match: { createdAt: { $gte: yearAgo } } },
        { $group: { _id: { phoneCode: '$phoneCode', country: '$country' }, revenue: { $sum: { $ifNull: ['$total', 0] } }, orders: { $sum: 1 } } }
      ])
    ]);

    // Owner contact lookup (email / name / phone + owner lastLogin)
    const ownerIds = workspaces.map((w) => w.owner).filter(Boolean);
    const owners = ownerIds.length
      ? await EcomUser.find({ _id: { $in: ownerIds } }, { email: 1, name: 1, phone: 1, lastLogin: 1 }).lean()
      : [];
    const ownerMap = new Map(owners.map((u) => [String(u._id), u]));
    const activityMap = new Map(memberActivity.map((m) => [String(m._id), m]));

    // Pricing (promo-aware, PlanConfig with fallback)
    const configByPlan = new Map(planConfigs.map((p) => [p.key, p]));
    const priceForPlan = (planKey) => {
      const c = configByPlan.get(planKey);
      const promoLive = c?.promoActive && (!c.promoExpiresAt || new Date(c.promoExpiresAt).getTime() > now.getTime());
      return Number((promoLive ? c?.pricePromo : c?.priceRegular) ?? GROWTH_FALLBACK_PRICES[planKey] ?? 0);
    };
    const currency = configByPlan.get('starter')?.currency || 'FCFA';

    const planTally = new Map(); // plan -> counts
    const bump = (plan, key) => {
      if (!planTally.has(plan)) planTally.set(plan, { total: 0, activePaid: 0, expiredPaid: 0, trialActive: 0 });
      planTally.get(plan)[key] += 1;
    };

    const paying = [], dormant = [], active = [];
    for (const w of workspaces) {
      const plan = w.plan || 'free';
      const owner = ownerMap.get(String(w.owner)) || {};
      const act = activityMap.get(String(w._id)) || {};
      const times = [act.lastLogin, owner.lastLogin].filter(Boolean).map((d) => new Date(d).getTime());
      const lastActivityAt = times.length ? new Date(Math.max(...times)) : null;
      const isPaid = paidPlans.includes(plan);
      const isPaying = isPaid && w.planExpiresAt && new Date(w.planExpiresAt) > now;
      const isActiveEng = lastActivityAt && lastActivityAt >= activeThreshold;
      const monthlyPrice = priceForPlan(plan);

      bump(plan, 'total');
      if (isPaying) bump(plan, 'activePaid');
      else if (isPaid) bump(plan, 'expiredPaid');
      if (w.trialEndsAt && new Date(w.trialEndsAt) > now) bump(plan, 'trialActive');

      const row = {
        id: String(w._id),
        name: w.name || w.slug || '—',
        plan,
        planExpiresAt: w.planExpiresAt || null,
        enabled: w.isActive !== false,
        lastActivityAt,
        members: act.members || 0,
        monthlyPrice,
        owner: { email: owner.email || null, name: owner.name || null, phone: owner.phone || null },
        createdAt: w.createdAt || null,
      };
      if (isPaying) paying.push(row);
      if (isActiveEng) active.push(row); else dormant.push(row);
    }

    // paying: highest value first · dormant: most stale first · active: freshest first
    paying.sort((a, b) => b.monthlyPrice - a.monthlyPrice);
    dormant.sort((a, b) => new Date(a.lastActivityAt || 0) - new Date(b.lastActivityAt || 0));
    active.sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0));

    const mrrByPlan = paidPlans.map((plan) => {
      const t = planTally.get(plan) || { activePaid: 0, expiredPaid: 0 };
      const monthlyPrice = priceForPlan(plan);
      return {
        plan,
        label: configByPlan.get(plan)?.displayName || plan,
        monthlyPrice,
        activePaid: t.activePaid || 0,
        expiredPaid: t.expiredPaid || 0,
        mrr: (t.activePaid || 0) * monthlyPrice,
      };
    });
    const mrrTotal = mrrByPlan.reduce((s, r) => s + r.mrr, 0);
    const activePaidWorkspaces = mrrByPlan.reduce((s, r) => s + r.activePaid, 0);

    // ── Revenue (GMV) by country ──
    const dialMap = {}, codeMap = {};
    for (const c of getSupportedCountries()) {
      dialMap[String(c.prefix).replace(/[^\d]/g, '')] = c.name;
      if (c.code) codeMap[String(c.code).toUpperCase()] = c.name;
    }
    const resolveCountry = (phoneCode, country) => {
      const pc = String(phoneCode || '').replace(/[^\d]/g, '');
      if (pc && dialMap[pc]) return dialMap[pc];
      const raw = String(country || '').trim();
      if (raw) {
        const up = raw.toUpperCase();
        if (codeMap[up]) return codeMap[up];   // 'CM' → Cameroun
        if (raw.length > 3) return raw;         // already a country name
      }
      if (pc) return `+${pc}`;                  // unknown dial code
      return 'Inconnu';
    };
    const countryMap = new Map();
    for (const g of (ordersByCountryRaw || [])) {
      const label = resolveCountry(g._id?.phoneCode, g._id?.country);
      const cur = countryMap.get(label) || { country: label, revenue: 0, orders: 0 };
      cur.revenue += g.revenue || 0;
      cur.orders += g.orders || 0;
      countryMap.set(label, cur);
    }
    const revenueByCountry = [...countryMap.values()].sort((a, b) => b.revenue - a.revenue);
    const gmvTotal = revenueByCountry.reduce((s, r) => s + r.revenue, 0);

    res.json({
      success: true,
      data: {
        generatedAt: now,
        activeDays,
        currency,
        activityBasis: 'lastLogin',
        gmv: { total: gmvTotal, currency: 'XAF', byCountry: revenueByCountry },
        mrr: {
          total: mrrTotal,
          arpu: activePaidWorkspaces > 0 ? Math.round(mrrTotal / activePaidWorkspaces) : 0,
          byPlan: mrrByPlan,
          activePaidWorkspaces,
          totalWorkspaces: workspaces.length,
        },
        counts: {
          total: workspaces.length,
          paying: paying.length,
          active: active.length,
          dormant: dormant.length,
        },
        segments: { paying, active, dormant },
      },
    });
  } catch (err) {
    console.error('[SuperAdmin] GET /growth error:', err);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul de la croissance' });
  }
});

// ─── Billing tracking (Super Admin) ──────────────────────────────────────────

// GET /api/ecom/super-admin/billing — full billing overview for all users
router.get('/billing', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    console.log('[SuperAdmin] GET /billing starting...');
    const { status, plan, search, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 50);
    const fetchWindow = pageNumber * limitNumber;

    // 1) All payments with user + workspace info
    console.log('[SuperAdmin] Fetching payments...');
    const sharedPaymentFilter = {};
    if (status) sharedPaymentFilter.status = status;

    const planPaymentFilter = { ...sharedPaymentFilter };
    if (plan) planPaymentFilter.plan = plan;

    const generationPaymentFilter = { ...sharedPaymentFilter };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const userLookup = { from: EcomUser.collection.name, localField: 'userId', foreignField: '_id', as: '_u', pipeline: [{ $project: { email: 1, name: 1, phone: 1 } }] };
    const wsLookup = { from: Workspace.collection.name, localField: 'workspaceId', foreignField: '_id', as: '_w', pipeline: [{ $project: { name: 1, slug: 1, plan: 1, planExpiresAt: 1, trialEndsAt: 1, trialUsed: 1 } }] };
    const flattenLookups = { $addFields: { userId: { $ifNull: [{ $arrayElemAt: ['$_u', 0] }, '$userId'] }, workspaceId: { $ifNull: [{ $arrayElemAt: ['$_w', 0] }, '$workspaceId'] } } };
    const dropTmp = { $project: { _u: 0, _w: 0 } };

    const [
      planPayments,
      generationPayments,
      totalPlanPayments,
      totalGenerationPayments,
      planRevenueAgg,
      generationRevenueAgg,
      planRevenueByMonth,
      generationRevenueByMonth,
      planStatusBreakdown,
      generationStatusBreakdown,
      planRecent30d,
      generationRecent30d,
      planRevenueByPlan,
      generationRevenueByType,
      planPaymentsByType,
      generationPaymentsByType,
      planPaymentMethods,
      generationPaymentMethods,
    ] = await Promise.all([
      PlanPayment.aggregate([
        { $match: planPaymentFilter },
        { $sort: { createdAt: -1 } },
        { $limit: fetchWindow },
        { $lookup: userLookup },
        { $lookup: wsLookup },
        flattenLookups,
        dropTmp,
      ]),
      GenerationPayment.aggregate([
        { $match: generationPaymentFilter },
        { $sort: { createdAt: -1 } },
        { $limit: fetchWindow },
        { $lookup: userLookup },
        { $lookup: wsLookup },
        flattenLookups,
        dropTmp,
      ]),
      PlanPayment.countDocuments(planPaymentFilter),
      GenerationPayment.countDocuments(generationPaymentFilter),
      PlanPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalFees: { $sum: '$fees' },
          count: { $sum: 1 },
          amountSum: { $sum: '$amount' }
        }}
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalFees: { $sum: '$fees' },
          count: { $sum: 1 },
          amountSum: { $sum: '$amount' }
        }}
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: twelveMonthsAgo } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      PlanPayment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]),
      GenerationPayment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: '$plan', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: 'generation', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $group: { _id: 'plan', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $group: { _id: 'generation', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      PlanPayment.aggregate([
        { $match: { status: 'paid', paymentMethod: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$paymentMethod' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      GenerationPayment.aggregate([
        { $match: { status: 'paid', paymentMethod: { $nin: [null, ''] } } },
        { $group: { _id: { $toLower: '$paymentMethod' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
    ]);

    const payments = [
      ...planPayments.map(normalizePlanPayment),
      ...generationPayments.map(normalizeGenerationPayment),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber);

    const totalPayments = totalPlanPayments + totalGenerationPayments;

    // 2) Revenue stats
    console.log('[SuperAdmin] Calculating revenue stats...');
    const revenueTotals = sumPaymentAggRows(planRevenueAgg, generationRevenueAgg);
    const revenueByMonth = mergeRevenueByMonth(planRevenueByMonth, generationRevenueByMonth);
    const recent30d = sumPaymentAggRows(
      planRecent30d.map(item => ({ ...item, totalRevenue: item.total, totalFees: 0, amountSum: item.total })),
      generationRecent30d.map(item => ({ ...item, totalRevenue: item.total, totalFees: 0, amountSum: item.total }))
    );
    const revenueByType = [
      ...planRevenueByPlan,
      ...generationRevenueByType,
    ];
    const paymentsByType = mergeGroupedLabelTotals(planPaymentsByType, generationPaymentsByType);
    const paymentMethods = mergeGroupedLabelTotals(planPaymentMethods, generationPaymentMethods);

    // 3) Payment status breakdown
    const statusBreakdown = mergeGroupedTotals(planStatusBreakdown, generationStatusBreakdown);

    const ownerLookup = { from: EcomUser.collection.name, localField: 'owner', foreignField: '_id', as: '_owner', pipeline: [{ $project: { email: 1, name: 1, phone: 1 } }] };
    const flatOwner = { $addFields: { owner: { $ifNull: [{ $arrayElemAt: ['$_owner', 0] }, '$owner'] } } };
    const dropOwner = { $project: { _owner: 0 } };
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const wsFilter = {};
    if (search) wsFilter.name = { $regex: search, $options: 'i' };

    // 4-9) Workspace stats — all parallel
    console.log('[SuperAdmin] Calculating workspace stats...');
    const [
      planDistributionRaw,
      activeSubscriptions,
      expiringSoon,
      activeTrials,
      expiredTrials,
      expiredPaid,
      allWorkspaces,
    ] = await Promise.all([
      Workspace.aggregate([{ $group: { _id: '$plan', count: { $sum: 1 } } }]),
      Workspace.countDocuments({ plan: { $in: ['pro', 'ultra'] }, planExpiresAt: { $gt: now } }),
      Workspace.aggregate([
        { $match: { plan: { $in: ['pro', 'ultra'] }, planExpiresAt: { $gt: now, $lte: sevenDaysFromNow } } },
        { $project: { name: 1, slug: 1, plan: 1, planExpiresAt: 1, owner: 1 } },
        { $lookup: ownerLookup }, flatOwner, dropOwner,
      ]),
      Workspace.aggregate([
        { $match: { trialEndsAt: { $gt: now }, trialUsed: true } },
        { $sort: { trialEndsAt: 1 } },
        { $project: { name: 1, slug: 1, trialStartedAt: 1, trialEndsAt: 1, trialExpiryNotifiedAt: 1, trialExpiredNotifiedAt: 1, owner: 1, plan: 1 } },
        { $lookup: ownerLookup }, flatOwner, dropOwner,
      ]),
      Workspace.aggregate([
        { $match: { trialUsed: true, trialEndsAt: { $lte: now }, plan: 'free' } },
        { $sort: { trialEndsAt: -1 } },
        { $limit: 50 },
        { $project: { name: 1, slug: 1, trialStartedAt: 1, trialEndsAt: 1, trialExpiryNotifiedAt: 1, trialExpiredNotifiedAt: 1, owner: 1, plan: 1 } },
        { $lookup: ownerLookup }, flatOwner, dropOwner,
      ]),
      Workspace.aggregate([
        { $match: { plan: { $in: ['pro', 'ultra'] }, planExpiresAt: { $lte: now } } },
        { $project: { name: 1, slug: 1, plan: 1, planExpiresAt: 1, owner: 1 } },
        { $lookup: ownerLookup }, flatOwner, dropOwner,
      ]),
      Workspace.aggregate([
        { $match: wsFilter },
        { $sort: { createdAt: -1 } },
        { $project: { name: 1, slug: 1, plan: 1, planExpiresAt: 1, trialStartedAt: 1, trialEndsAt: 1, trialUsed: 1, owner: 1, createdAt: 1 } },
        { $lookup: ownerLookup }, flatOwner, dropOwner,
      ]),
    ]);

    const planDistribution = planDistributionRaw.filter(p => p._id && p.count > 0);

    console.log('[SuperAdmin] Billing request completed successfully');
    res.json({
      success: true,
      data: {
        payments,
        totalPayments,
        revenue: {
          total: revenueTotals.totalRevenue,
          fees: revenueTotals.totalFees,
          paidCount: revenueTotals.count,
          avgAmount: revenueTotals.count > 0 ? Math.round((revenueTotals.amountSum || 0) / revenueTotals.count) : 0,
          byType: revenueByType,
          byMonth: revenueByMonth,
          last30d: { total: recent30d.totalRevenue || 0, count: recent30d.count || 0 }
        },
        paymentsByType,
        paymentMethods,
        statusBreakdown,
        planDistribution,
        activeSubscriptions,
        expiringSoon,
        activeTrials,
        expiredTrials,
        expiredPaid,
        workspaces: allWorkspaces,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total: totalPayments,
          pages: Math.ceil(totalPayments / limitNumber)
        }
      }
    });
  } catch (err) {
    console.error('[SuperAdmin] GET /billing error:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ── Migration : nettoyer les descriptions HTML des produits ──────────────────
function cleanProductHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let s = html;

  // Supprimer liens/boutons WhatsApp (wa.me)
  s = s.replace(/<a[^>]*href=["'][^"']*wa\.me[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '');
  // Supprimer boutons contenant "WhatsApp"
  s = s.replace(/<a[^>]*>[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/a>/gi, '');
  s = s.replace(/<button[^>]*>[\s\S]*?[Ww]hat[sS]?[Aa]pp[\s\S]*?<\/button>/gi, '');
  // Supprimer liens "Retour"
  s = s.replace(/<a[^>]*>[^<]*[Rr]etour[^<]*<\/a>/gi, '');
  s = s.replace(/<a[^>]*>[^<]*←[^<]*<\/a>/gi, '');
  // Supprimer border-radius sur les images
  s = s.replace(/(<img[^>]+style=["'][^"']*)border-radius\s*:\s*[^;'"]+;?\s*/gi, '$1');
  // Ajouter aspect-ratio + object-fit si absent sur images
  s = s.replace(/<img([^>]+style=["'])([^"']*)(["'][^>]*)>/gi, (match, before, styles, after) => {
    let st = styles;
    if (!st.includes('aspect-ratio')) st += ';aspect-ratio:1 / 1';
    if (!st.includes('object-fit')) st += ';object-fit:cover';
    st = st.replace(/border-radius\s*:\s*[^;]+;?/gi, '').replace(/;;+/g, ';').replace(/^;|;$/g, '');
    return `<img${before}${st}${after}>`;
  });

  return s.trim();
}

router.post('/migrate-product-descriptions', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const products = await StoreProduct.find({
      description: { $exists: true, $ne: '', $regex: /<[^>]+>/ }
    }).select('_id name description').lean();

    let updated = 0, skipped = 0;
    for (const p of products) {
      const cleaned = cleanProductHtml(p.description);
      if (cleaned === p.description) { skipped++; continue; }
      await StoreProduct.updateOne({ _id: p._id }, { $set: { description: cleaned } });
      updated++;
    }

    res.json({ success: true, updated, skipped, total: products.length });
  } catch (err) {
    console.error('[SuperAdmin] migrate-product-descriptions error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /super-admin/notify-workspace — Envoyer email/push manuellement ────
router.post('/notify-workspace', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { workspaceId, channel, templateKey, customEmail } = req.body;
    // channel: 'email' | 'push' | 'both'
    // templateKey: 'trial_expiring' | 'trial_expired' | 'plan_expired'
    if (!workspaceId || !channel || !templateKey) {
      return res.status(400).json({ success: false, message: 'workspaceId, channel et templateKey requis' });
    }

    const allowedTemplates = ['trial_expiring', 'trial_expired', 'plan_expired'];
    if (!allowedTemplates.includes(templateKey)) {
      return res.status(400).json({ success: false, message: `Template invalide. Autorisés: ${allowedTemplates.join(', ')}` });
    }

    const workspace = await Workspace.findById(workspaceId).populate('owner', 'email name phone').lean();
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    const owner = workspace.owner;
    if (!owner?.email) {
      return res.status(400).json({ success: false, message: 'Propriétaire sans email' });
    }

    const results = { email: null, push: null };

    // Build data for templates
    const hoursLeft = workspace.trialEndsAt
      ? Math.max(1, Math.round((new Date(workspace.trialEndsAt) - new Date()) / (60 * 60 * 1000)))
      : 0;
    const trialEndsStr = workspace.trialEndsAt
      ? new Date(workspace.trialEndsAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';
    const planName = workspace.plan === 'pro' ? 'Pro' : workspace.plan === 'ultra' ? 'Ultra' : 'Gratuit';

    const templateData = {
      name: owner.name || '',
      workspaceName: workspace.name,
      hoursLeft,
      trialEndsAt: trialEndsStr,
      planName,
    };

    const pushTitles = {
      trial_expiring: { title: '⏰ Essai gratuit expire bientôt', body: `Plus que ${hoursLeft}h — vos agents IA seront désactivés. Passez à Pro !` },
      trial_expired: { title: '🚫 Essai terminé — Agents IA désactivés', body: 'Vos agents ne répondent plus. Passez à Pro pour les réactiver !' },
      plan_expired: { title: `🚫 Plan ${planName} expiré`, body: 'Vos agents IA sont désactivés. Renouvelez pour continuer à vendre !' },
    };

    const hasCustomEmail = !!(customEmail?.subject?.trim() && customEmail?.message?.trim());

    // Email
    if (channel === 'email' || channel === 'both') {
      try {
        const emailResult = hasCustomEmail
          ? await sendCustomNotificationEmail({
              to: owner.email,
              subject: customEmail.subject,
              message: customEmail.message,
              userId: String(workspace.owner._id),
              workspaceId: String(workspace._id),
              eventType: `manual_custom_${templateKey}`,
            })
          : await sendNotificationEmail({
              to: owner.email,
              templateKey,
              data: templateData,
              userId: String(workspace.owner._id),
              workspaceId: String(workspace._id),
              eventType: `manual_${templateKey}`,
            });
        results.email = emailResult;
      } catch (e) {
        results.email = { success: false, error: e.message };
      }
    }

    // Push
    if (channel === 'push' || channel === 'both') {
      try {
        const pushData = {
          ...pushTitles[templateKey],
          icon: '/icons/icon-192x192.png',
          tag: `manual-${templateKey}`,
          data: { type: templateKey, url: '/ecom/billing' },
        };
        const pushResult = await sendPushNotificationToUser(String(workspace.owner._id), pushData);
        results.push = pushResult || { success: true };
      } catch (e) {
        results.push = { success: false, error: e.message };
      }
    }

    // Vérifier si au moins un canal a réussi
    const emailOk = results.email ? results.email.success : true;
    const pushOk = results.push ? results.push.success : true;
    const allSuccess = emailOk && pushOk;

    await logAudit(req, 'NOTIFY_WORKSPACE', `Manual ${templateKey}${hasCustomEmail ? ' custom-email' : ''} (${channel}) sent to ${owner.email} — ${allSuccess ? 'OK' : 'FAILED'}`, 'workspace', workspace._id);
    res.json({ success: allSuccess, results, email: owner.email, message: allSuccess ? undefined : (results.email?.error || results.push?.error || 'Échec envoi') });
  } catch (err) {
    console.error('[SuperAdmin] POST /notify-workspace error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /super-admin/deactivate-trial — Désactiver l'essai gratuit d'un workspace ────
router.post('/deactivate-trial', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }

    const workspace = await Workspace.findById(workspaceId).populate('owner', 'email name').lean();
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Vérifier si un trial existe
    if (!workspace.trialStartedAt && !workspace.trialEndsAt && !workspace.trialUsed) {
      return res.status(400).json({ success: false, message: 'Aucun essai gratuit trouvé sur ce compte' });
    }

    // Désactiver le trial
    await Workspace.updateOne(
      { _id: workspaceId },
      {
        $set: {
          trialStartedAt: null,
          trialEndsAt: null,
          trialUsed: false,
          trialExpiryNotifiedAt: null,
          trialExpiredNotifiedAt: null,
        }
      }
    );

    await logAudit(req, 'DEACTIVATE_TRIAL', `Trial désactivé pour ${workspace.owner?.email} (${workspace.name})`, 'workspace', workspace._id);
    res.json({ 
      success: true, 
      message: `Essai désactivé pour ${workspace.name}`,
      workspace: { id: workspace._id, name: workspace.name, owner: workspace.owner?.email }
    });
  } catch (err) {
    console.error('[SuperAdmin] POST /deactivate-trial error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/ecom/super-admin/feature-analytics
router.get('/feature-analytics',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { days = 30, workspaceId } = req.query;
      const since = new Date(Date.now() - Number(days) * 24 * 3600 * 1000);
      const matchBase = { createdAt: { $gte: since } };
      if (workspaceId) matchBase.workspaceId = new mongoose.Types.ObjectId(workspaceId);

      const [
        topFeatures,
        dailyActivity,
        perWorkspace,
        topUsers,
        recentGenerations,
        generationOverview,
        generationUsers,
        generationContentTypes,
        generationHistory
      ] = await Promise.all([
        // Top features by usage count
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: '$feature', count: { $sum: 1 }, successCount: { $sum: { $cond: ['$meta.success', 1, 0] } } } },
          { $sort: { count: -1 } }
        ]),

        // Daily usage per feature (last N days)
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: {
            _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, feature: '$feature' },
            count: { $sum: 1 }
          }},
          { $sort: { '_id.date': 1 } }
        ]),

        // Per workspace: which features they use most
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: { workspaceId: '$workspaceId', feature: '$feature' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 100 },
          { $lookup: { from: WORKSPACE_COLLECTION, localField: '_id.workspaceId', foreignField: '_id', as: 'ws' } },
          { $addFields: { workspaceName: { $arrayElemAt: ['$ws.name', 0] } } },
          { $project: { ws: 0 } }
        ]),

        // Top users by usage
        FeatureUsageLog.aggregate([
          { $match: matchBase },
          { $group: { _id: '$userId', count: { $sum: 1 }, features: { $addToSet: '$feature' } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
          { $lookup: { from: USER_COLLECTION, localField: '_id', foreignField: '_id', as: 'user' } },
          { $addFields: { email: { $arrayElemAt: ['$user.email', 0] }, name: { $arrayElemAt: ['$user.name', 0] } } },
          { $project: { user: 0 } }
        ]),

        // Recent product page generations with details
        FeatureUsageLog.find({ ...matchBase, feature: 'product_page_generator' })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate('workspaceId', 'name')
          .populate('userId', 'email name')
          .lean(),

        ProductPageGenerationLog.aggregate([
          { $match: matchBase },
          {
            $group: {
              _id: null,
              totalGenerations: { $sum: 1 },
              totalCreditsUsed: { $sum: '$creditsUsed' },
              completedCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              processingCount: { $sum: { $cond: [{ $eq: ['$status', 'processing_images'] }, 1, 0] } },
              partialFailureCount: { $sum: { $cond: [{ $eq: ['$status', 'partial_failure'] }, 1, 0] } },
              failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
              uniqueUsers: { $addToSet: '$userId' },
              uniqueWorkspaces: { $addToSet: '$workspaceId' },
            }
          },
          {
            $project: {
              _id: 0,
              totalGenerations: 1,
              totalCreditsUsed: 1,
              completedCount: 1,
              processingCount: 1,
              partialFailureCount: 1,
              failedCount: 1,
              uniqueUsers: { $size: '$uniqueUsers' },
              uniqueWorkspaces: { $size: '$uniqueWorkspaces' },
            }
          }
        ]),

        ProductPageGenerationLog.aggregate([
          { $match: matchBase },
          {
            $group: {
              _id: '$userId',
              generationCount: { $sum: 1 },
              creditsUsed: { $sum: '$creditsUsed' },
              lastGeneratedAt: { $max: '$createdAt' },
              successfulCount: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              failedCount: { $sum: { $cond: [{ $in: ['$status', ['failed', 'partial_failure']] }, 1, 0] } },
              contentTypes: { $push: '$generatedContentTypes' },
              workspaceIds: { $addToSet: '$workspaceId' },
              userSnapshot: { $last: '$userSnapshot' },
            }
          },
          { $sort: { generationCount: -1, lastGeneratedAt: -1 } },
          { $limit: 50 },
          { $lookup: { from: USER_COLLECTION, localField: '_id', foreignField: '_id', as: 'user' } },
          {
            $project: {
              _id: 1,
              generationCount: 1,
              creditsUsed: 1,
              lastGeneratedAt: 1,
              successfulCount: 1,
              failedCount: 1,
              workspaceCount: { $size: '$workspaceIds' },
              contentTypes: {
                $reduce: {
                  input: '$contentTypes',
                  initialValue: [],
                  in: { $setUnion: ['$$value', '$$this'] }
                }
              },
              email: {
                $ifNull: [
                  { $arrayElemAt: ['$user.email', 0] },
                  '$userSnapshot.email'
                ]
              },
              name: {
                $ifNull: [
                  { $arrayElemAt: ['$user.name', 0] },
                  '$userSnapshot.name'
                ]
              },
            }
          }
        ]),

        ProductPageGenerationLog.aggregate([
          { $match: matchBase },
          { $unwind: { path: '$generatedContentTypes', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$generatedContentTypes', count: { $sum: 1 } } },
          { $sort: { count: -1, _id: 1 } }
        ]),

        ProductPageGenerationLog.find(matchBase)
          .sort({ createdAt: -1 })
          .limit(250)
          .populate('workspaceId', 'name plan')
          .populate('userId', 'email name')
          .lean()
      ]);

      res.json({
        success: true,
        topFeatures,
        dailyActivity,
        perWorkspace,
        topUsers,
        recentGenerations,
        generationOverview: generationOverview?.[0] || {
          totalGenerations: 0,
          totalCreditsUsed: 0,
          completedCount: 0,
          processingCount: 0,
          partialFailureCount: 0,
          failedCount: 0,
          uniqueUsers: 0,
          uniqueWorkspaces: 0,
        },
        generationUsers,
        generationContentTypes,
        generationHistory,
      });
    } catch (err) {
      console.error('[SuperAdmin] feature-analytics error:', err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// SCALOR USERS — WhatsApp messaging (via instance du super admin)
// ═══════════════════════════════════════════════════════════════

// GET /api/ecom/super-admin/scalor-users/whatsapp — liste des users Scalor + état de l'instance
router.get('/scalor-users/whatsapp', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { search, plan, hasPhone } = req.query;

    // Charger l'instance configurée du super admin
    const admin = await EcomUser.findById(req.ecomUser._id)
      .select('supportNotificationInstanceId supportNotificationEnabled')
      .lean();
    let adminInstance = null;
    if (admin?.supportNotificationInstanceId) {
      adminInstance = await WhatsAppInstance.findById(admin.supportNotificationInstanceId)
        .select('instanceName instanceToken customName status')
        .lean();
    }

    const users = await ScalorUser.find({})
      .select('_id name email phone plan isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(0)
      .lean();

    res.json({ success: true, data: { users, adminInstance } });
  } catch (err) {
    console.error('[SuperAdmin] GET /scalor-users/whatsapp:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/super-admin/scalor-users/whatsapp/send — envoi via l'instance du super admin
router.post('/scalor-users/whatsapp/send', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { userIds, message, allUsers, plan } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    // Récupérer l'instance configurée du super admin
    const admin = await EcomUser.findById(req.ecomUser._id)
      .select('supportNotificationInstanceId')
      .lean();
    if (!admin?.supportNotificationInstanceId) {
      return res.status(400).json({ success: false, message: 'Aucune instance WhatsApp configurée. Configurez-en une dans les paramètres support.' });
    }
    const instance = await WhatsAppInstance.findById(admin.supportNotificationInstanceId)
      .select('instanceName instanceToken status isActive')
      .lean();
    if (!instance || !instance.isActive || !['connected', 'active', 'configured'].includes(instance.status)) {
      return res.status(400).json({ success: false, message: `Instance WhatsApp non connectée (statut: ${instance?.status || 'introuvable'})` });
    }

    // Construire la liste des destinataires
    let targets = [];
    if (allUsers) {
      const filter = { phone: { $exists: true, $ne: '' }, isActive: true };
      if (plan) filter.plan = plan;
      targets = await ScalorUser.find(filter).select('_id name phone').lean();
    } else {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, message: 'userIds requis (ou allUsers: true)' });
      }
      targets = await ScalorUser.find({
        _id: { $in: userIds },
        phone: { $exists: true, $ne: '' }
      }).select('_id name phone').lean();
    }

    if (targets.length === 0) {
      return res.json({ success: true, data: { sent: 0, failed: 0, skipped: 0, results: [] } });
    }

    const safeMessage = message.trim().slice(0, 4000);
    const sendResults = [];
    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < targets.length; i++) {
      const user = targets[i];
      const phoneResult = formatInternationalPhone(user.phone);
      if (!phoneResult.success) {
        skipped++;
        sendResults.push({ userId: user._id, name: user.name, phone: user.phone, status: 'skipped', error: phoneResult.error });
        continue;
      }

      try {
        const apiResult = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, phoneResult.formatted, safeMessage);
        if (apiResult.success) {
          sent++;
          sendResults.push({ userId: user._id, name: user.name, phone: phoneResult.display, status: 'sent' });
        } else {
          failed++;
          sendResults.push({ userId: user._id, name: user.name, phone: phoneResult.display, status: 'failed', error: apiResult.error });
        }
      } catch (e) {
        failed++;
        sendResults.push({ userId: user._id, name: user.name, phone: phoneResult.display, status: 'failed', error: e.message });
      }

      if (i < targets.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    await logAudit(req, 'SCALOR_WHATSAPP_SEND', `WhatsApp envoyé à ${sent}/${targets.length} users Scalor via ${instance.instanceName}`, 'system', null);

    res.json({ success: true, data: { sent, failed, skipped, total: targets.length, results: sendResults } });
  } catch (err) {
    console.error('[SuperAdmin] POST /scalor-users/whatsapp/send:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/ecom/super-admin/dashboard-summary
// All queries run in true parallel, capped at 10 concurrent connections.
// This is 2-3× faster than the old 3-wave sequential approach.
// Cache: 5 minutes server-side (data doesn't change that fast).
// ══════════════════════════════════════════════════════════════════════════════

const _dashCache = makeCache(300_000); // 5-minute TTL

function dashDateFilter(range = '30d') {
  const now = new Date();
  const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
  return { since: new Date(now.getTime() - (ms[range] || ms['30d'])), until: now };
}

// Helper: safely extract value from capped result
function settled(r, fallback = null) {
  return r && r.status === 'fulfilled' ? r.value : fallback;
}

router.get('/dashboard-summary',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d' } = req.query;

      // ── Serve from cache ───────────────────────────────────────────────────
      const bypassCache = req.query._bypassCache === 'true' || req.query._bypassCache === true;
      const cached = !bypassCache ? _dashCache.get(range) : null;
      if (cached) return res.json({ success: true, data: cached, cached: true });

      const { since, until } = dashDateFilter(range);
      const now   = new Date();
      const day1  = new Date(now.getTime() - 86400000);
      const day7  = new Date(now.getTime() - 604800000);
      const day10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const day30 = new Date(now.getTime() - 2592000000);

      // ── Dashboard queries in one parallel pool (≤10 concurrent) ────────────
      // Previously 3 sequential waves — each wave waited for the prior to finish.
      // Now they all start together; total time ≈ slowest single query, not their sum.
      const r = await runCapped([
        // [0] User role aggregate (byRole, active, neverLoggedIn)
        () => EcomUser.aggregate([
          { $group: { _id: '$role', total: { $sum: 1 }, active: { $sum: { $cond: ['$isActive', 1, 0] } }, neverLoggedIn: { $sum: { $cond: [{ $eq: ['$lastLogin', null] }, 1, 0] } } } }
        ]),
        // [1] Total users
        () => EcomUser.estimatedDocumentCount(),
        // [2] Users with workspace
        () => EcomUser.countDocuments({ workspaceId: { $ne: null } }),
        // [3] Signups in range
        () => EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until } }),
        // [4] Activated in range
        () => EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until }, workspaceId: { $ne: null } }),
        // [5] Users signed up >7d ago (for retention denominator)
        () => EcomUser.countDocuments({ createdAt: { $lte: day7 } }),
        // [6] Workspaces list (top 200 by recency, with owner info)
        () => Workspace.aggregate([
          { $sort: { createdAt: -1 } },
          { $limit: 200 },
          { $lookup: { from: 'ecom_users', localField: 'owner', foreignField: '_id', as: '_ownerArr', pipeline: [{ $project: { email: 1, role: 1 } }] } },
          { $addFields: { owner: { $arrayElemAt: ['$_ownerArr', 0] } } },
          { $project: { _ownerArr: 0, __v: 0, storeSettings: 0, shopifyWebhookToken: 0, whatsappAutoProductMediaRules: 0 } },
        ]),
        // [7] Member counts per workspace
        () => EcomUser.aggregate([{ $match: { workspaceId: { $ne: null } } }, { $group: { _id: '$workspaceId', count: { $sum: 1 } } }]),
        // [8] Workspaces created in range
        () => Workspace.countDocuments({ createdAt: { $gte: since, $lte: until } }),
        // [9] Audit log total
        () => AuditLog.estimatedDocumentCount(),
        // [10] Audit logs last 24h
        () => AuditLog.countDocuments({ createdAt: { $gte: day1 } }),
        // [11] Failed logins last 24h
        () => AuditLog.countDocuments({ action: 'LOGIN_FAILED', createdAt: { $gte: day1 } }),
        // [12] Last audit log timestamp
        () => AuditLog.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
        // [13] Push notifications total
        () => PushScheduledNotification.estimatedDocumentCount(),
        // [14] Push sent
        () => PushScheduledNotification.countDocuments({ status: 'sent' }),
        // [15] Push failed
        () => PushScheduledNotification.countDocuments({ status: 'failed' }),
        // [16] Push scheduled
        () => PushScheduledNotification.countDocuments({ status: 'scheduled' }),
        // [17] Session KPIs
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: null, totalSessions: { $sum: 1 }, uniqueUsers: { $addToSet: '$userId' }, totalPageViews: { $sum: '$pageViews' }, avgDuration: { $avg: '$duration' }, bounces: { $sum: { $cond: ['$isBounce', 1, 0] } } } }
        ]),
        // [18] Daily sessions trend
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } }, sessions: { $sum: 1 }, pageViews: { $sum: '$pageViews' }, uniqueUsers: { $addToSet: '$userId' } } },
          { $sort: { _id: 1 } },
          { $project: { date: '$_id', sessions: 1, pageViews: 1, uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } } } }
        ]),
        // [19] Daily signups trend
        () => EcomUser.aggregate([
          { $match: { createdAt: { $gte: since, $lte: until } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        // [20] DAU
        () => AnalyticsEvent.aggregate([{ $match: { createdAt: { $gte: day1 }, userId: { $ne: null } } }, { $group: { _id: null, users: { $addToSet: '$userId' } } }]),
        // [21] WAU
        () => AnalyticsEvent.aggregate([{ $match: { createdAt: { $gte: day7 }, userId: { $ne: null } } }, { $group: { _id: null, users: { $addToSet: '$userId' } } }]),
        // [22] MAU
        () => AnalyticsEvent.aggregate([{ $match: { createdAt: { $gte: day30 }, userId: { $ne: null } } }, { $group: { _id: null, users: { $addToSet: '$userId' } } }]),
        // [23] Retained users (7d retention) — uses $lookup, kept separate so it doesn't block fast queries
        () => AnalyticsEvent.aggregate([
          { $match: { createdAt: { $gte: day7 }, userId: { $ne: null } } },
          { $lookup: { from: 'ecom_users', localField: 'userId', foreignField: '_id', as: 'u', pipeline: [{ $project: { createdAt: 1 } }] } },
          { $unwind: '$u' },
          { $match: { 'u.createdAt': { $lte: day7 } } },
          { $group: { _id: null, users: { $addToSet: '$userId' } } }
        ]),
        // [24] Funnel: verified users in range
        () => EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until }, lastLogin: { $ne: null } }),
        // [25] Funnel: active users (business events)
        () => AnalyticsEvent.aggregate([
          { $match: { createdAt: { $gte: since, $lte: until }, eventType: { $in: ['order_created','order_updated','delivery_completed','transaction_created','product_created','report_viewed'] }, userId: { $ne: null } } },
          { $group: { _id: null, users: { $addToSet: '$userId' } } }
        ]),
        // [26] Traffic by device
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: '$device', sessions: { $sum: 1 }, pageViews: { $sum: '$pageViews' }, avgDuration: { $avg: '$duration' }, bounces: { $sum: { $cond: ['$isBounce', 1, 0] } } } },
          { $sort: { sessions: -1 } }
        ]),
        // [27] Traffic by browser
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: '$browser', sessions: { $sum: 1 }, pageViews: { $sum: '$pageViews' } } },
          { $sort: { sessions: -1 } }, { $limit: 10 }
        ]),
        // [28] Traffic by OS
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: '$os', sessions: { $sum: 1 } } },
          { $sort: { sessions: -1 } }, { $limit: 10 }
        ]),
        // [29] Daily traffic (sessions+pageviews per day)
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } }, sessions: { $sum: 1 }, uniqueUsers: { $addToSet: '$userId' }, pageViews: { $sum: '$pageViews' }, avgDuration: { $avg: '$duration' } } },
          { $sort: { _id: 1 } },
          { $project: { date: '$_id', sessions: 1, pageViews: 1, avgDuration: 1, uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } } } }
        ]),
        // [30] Countries
        () => AnalyticsSession.aggregate([
          { $match: { startedAt: { $gte: since, $lte: until }, country: { $ne: null } } },
          { $group: { _id: '$country', sessions: { $sum: 1 }, pageViews: { $sum: '$pageViews' }, avgDuration: { $avg: '$duration' }, uniqueUsers: { $addToSet: '$userId' } } },
          { $sort: { sessions: -1 } }, { $limit: 20 },
          { $project: { country: '$_id', sessions: 1, pageViews: 1, avgDuration: { $round: ['$avgDuration', 0] }, uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } } } }
        ]),
        // [31] Top pages
        () => AnalyticsEvent.aggregate([
          { $match: { createdAt: { $gte: since, $lte: until }, eventType: 'page_view', page: { $ne: null } } },
          { $group: { _id: '$page', views: { $sum: 1 }, uniqueUsers: { $addToSet: '$userId' } } },
          { $sort: { views: -1 } }, { $limit: 20 },
          { $project: { page: '$_id', views: 1, uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } } } }
        ]),
        // [32] Daily active users (for activity chart)
        () => AnalyticsEvent.aggregate([
          { $match: { createdAt: { $gte: since, $lte: until }, userId: { $ne: null } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, activeUsers: { $addToSet: '$userId' }, events: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $project: { date: '$_id', activeUsers: { $size: '$activeUsers' }, events: 1 } }
        ]),
        // [33] Funnel: visitors count (sessions in range)
        () => AnalyticsSession.aggregate([{ $match: { startedAt: { $gte: since, $lte: until } } }, { $group: { _id: null, count: { $sum: 1 } } }]),
        // [34] Activité par utilisateur (sessions) — pour churn honnête
        () => AnalyticsSession.aggregate([
          { $match: { userId: { $ne: null } } },
          { $addFields: { activityAt: { $ifNull: ['$lastActivityAt', '$startedAt'] } } },
          { $group: {
            _id: '$userId',
            lastActivityAt: { $max: '$activityAt' },
            sessions: { $sum: 1 },
            activePrevWindow: { $max: { $cond: [{ $and: [{ $gte: ['$activityAt', new Date(Date.now() - 60 * 86400000)] }, { $lt: ['$activityAt', new Date(Date.now() - 30 * 86400000)] }] }, 1, 0] } },
            activeRecentWindow: { $max: { $cond: [{ $gte: ['$activityAt', new Date(Date.now() - 30 * 86400000)] }, 1, 0] } },
          } },
        ]),
        // [35] Utilisateurs (léger) — activité réelle = lastLogin ∪ sessions
        () => EcomUser.find({}, { lastLogin: 1, createdAt: 1, role: 1, isActive: 1 }).lean(),
      ], 10);

      // ── Unpack results by index ────────────────────────────────────────────
      const userRoleAgg       = settled(r[0],  []);
      const totalUsers        = settled(r[1],  0);
      const usersWithWs       = settled(r[2],  0);
      const signups           = settled(r[3],  0);
      const activatedUsers    = settled(r[4],  0);
      const signedUp7dAgo     = settled(r[5],  0);
      const workspacesList    = settled(r[6],  []);
      const memberCounts      = settled(r[7],  []);
      const workspacesCreated = settled(r[8],  0);
      const totalLogs         = settled(r[9],  0);
      const last24h           = settled(r[10], 0);
      const failedLogins      = settled(r[11], 0);
      const lastActivity      = settled(r[12], null);
      const pushTotal         = settled(r[13], 0);
      const pushSent          = settled(r[14], 0);
      const pushFailed        = settled(r[15], 0);
      const pushScheduled     = settled(r[16], 0);
      const sessionStatsArr   = settled(r[17], []);
      const dailySessions     = settled(r[18], []);
      const dailySignups      = settled(r[19], []);
      const dauResult         = settled(r[20], []);
      const wauResult         = settled(r[21], []);
      const mauResult         = settled(r[22], []);
      const retainedResult    = settled(r[23], []);
      const funnelVerified    = settled(r[24], 0);
      const funnelActive      = settled(r[25], []);
      const trafficByDevice   = settled(r[26], []);
      const trafficByBrowser  = settled(r[27], []);
      const trafficByOS       = settled(r[28], []);
      const trafficDaily      = settled(r[29], []);
      const countriesRaw      = settled(r[30], []);
      const pagesRaw          = settled(r[31], []);
      const activityDaily     = settled(r[32], []);
      const funnelVisitors    = settled(r[33], []);
      const perUserSessions   = settled(r[34], []);
      const usersLightArr     = settled(r[35], []);

      // ── Derived stats ──────────────────────────────────────────────────────
      let totalActive = 0, totalInactive = 0, neverLoggedIn = 0;
      const byRole = userRoleAgg.map(row => {
        totalActive   += row.active || 0;
        totalInactive += (row.total - row.active) || 0;
        neverLoggedIn += row.neverLoggedIn || 0;
        return { _id: row._id, count: row.total };
      });
      const userStatsFull = { byRole, totalUsers, totalActive, totalInactive, neverLoggedIn };

      const memberMap = {};
      memberCounts.forEach(m => { memberMap[String(m._id)] = m.count; });
      const workspacesWithCounts = workspacesList.map(ws => ({ ...ws, memberCount: memberMap[String(ws._id)] || 0 }));
      const totalWorkspaces = workspacesWithCounts.length;
      const totalActiveWs   = workspacesWithCounts.filter(w => w.isActive).length;
      const totalMembers    = workspacesWithCounts.reduce((s, w) => s + (w.memberCount || 0), 0);

      const ss = sessionStatsArr[0];
      const totalSessions       = ss?.totalSessions || 0;
      const uniqueVisitors      = (ss?.uniqueUsers || []).filter(Boolean).length;
      const totalPageViews      = ss?.totalPageViews || 0;
      const avgSessionDuration  = Math.round(ss?.avgDuration || 0);
      const bounceRate          = totalSessions > 0 ? Math.round(((ss?.bounces || 0) / totalSessions) * 100) : 0;
      const dau = dauResult[0]?.users?.length || 0;
      const wau = wauResult[0]?.users?.length || 0;
      const mau = mauResult[0]?.users?.length || 0;
      const conversionSignup     = uniqueVisitors > 0 ? Math.round((signups / uniqueVisitors) * 100) : 0;
      const conversionActivation = totalUsers > 0 ? Math.round((usersWithWs / totalUsers) * 100) : 0;
      const retained             = retainedResult[0]?.users?.length || 0;
      const retention7d          = signedUp7dAgo > 0 ? Math.round((retained / signedUp7dAgo) * 100) : 0;
      // ── Churn honnête : activité = max(lastLogin, dernière session analytics).
      // Éligibles = inscrits depuis ≥ 30 j ET déjà actifs au moins une fois
      // (les « jamais actifs » relèvent de l'activation, pas du churn ; les
      // inscrits récents n'ont pas encore eu 30 j pour revenir).
      const day10Ms = day10.getTime();
      const day30Ms = Date.now() - 30 * 86400000;
      const day60Ms = Date.now() - 60 * 86400000;
      const sessionInfoMap = new Map(perUserSessions.map((u) => [String(u._id), u]));
      const totalSessionUsers = perUserSessions.length;
      const totalTrackedSessions = perUserSessions.reduce((s, u) => s + (u.sessions || 0), 0);
      let activeSessionUsers10d = 0;
      // Churn 30 j PÉRIODE SUR PÉRIODE (standard SaaS) — marchands non bloqués :
      // base = actifs dans [-60 j, -30 j[ ; churnés = pas revenus sur [-30 j, now]
      let eligible30 = 0, churned30 = 0, inactive10dEligible = 0;
      for (const u of usersLightArr) {
        const sessInfo = sessionInfoMap.get(String(u._id));
        const lastActivity = Math.max(
          u.lastLogin ? new Date(u.lastLogin).getTime() : 0,
          sessInfo?.lastActivityAt ? new Date(sessInfo.lastActivityAt).getTime() : 0,
        );
        if (!lastActivity) continue; // jamais actif → activation, pas churn
        if (lastActivity >= day10Ms) activeSessionUsers10d += 1;
        if (u.role !== 'ecom_admin' || u.isActive === false) continue;
        const loginMs = u.lastLogin ? new Date(u.lastLogin).getTime() : 0;
        const activePrev = Boolean(sessInfo?.activePrevWindow) || (loginMs >= day60Ms && loginMs < day30Ms);
        if (!activePrev) continue;
        eligible30 += 1;
        const activeRecent = Boolean(sessInfo?.activeRecentWindow) || loginMs >= day30Ms;
        if (!activeRecent) churned30 += 1;
        if (lastActivity < day10Ms) inactive10dEligible += 1;
      }
      const inactiveSessionUsers10d = inactive10dEligible;
      const churnRate10d = eligible30 > 0 ? Math.round((inactive10dEligible / eligible30) * 100) : 0;
      const churnRate30 = eligible30 > 0 ? Math.round((churned30 / eligible30) * 1000) / 10 : 0;

      const fVisitors = funnelVisitors[0]?.count || 0;
      const fAccounts = signups;
      const fJoined   = activatedUsers;
      const fActiveU  = funnelActive[0]?.users?.length || 0;
      const funnelSteps = [
        { step: 'Visiteurs',         count: fVisitors,      rate: 100 },
        { step: 'Comptes créés',     count: fAccounts,      rate: fVisitors  > 0 ? Math.round((fAccounts  / fVisitors)  * 100) : 0 },
        { step: 'Email vérifié',     count: funnelVerified, rate: fAccounts  > 0 ? Math.round((funnelVerified / fAccounts) * 100) : 0 },
        { step: 'Workspace rejoint', count: fJoined,        rate: funnelVerified > 0 ? Math.round((fJoined / funnelVerified) * 100) : 0 },
        { step: 'Utilisateur actif', count: fActiveU,       rate: fJoined > 0 ? Math.round((fActiveU / fJoined) * 100) : 0 },
      ];
      const dropoffs = funnelSteps.slice(1).map((step, i) => {
        const prev = funnelSteps[i];
        const lost = prev.count - step.count;
        return { from: prev.step, to: step.step, lost, dropRate: prev.count > 0 ? Math.round((lost / prev.count) * 100) : 0 };
      });

      // ── Assemble final payload ─────────────────────────────────────────────
      const data = {
        users: {
          // No full user list — dashboard only needs stats + neverLoggedIn count
          users: [], // kept for shape compatibility; full list via /users endpoint
          stats: userStatsFull,
        },
        workspaces: {
          workspaces: workspacesWithCounts,
          totalWorkspaces,
          totalActive: totalActiveWs,
          totalMembers,
        },
        overview: {
          kpis: {
            totalSessions,
            uniqueVisitors,
            totalPageViews,
            avgSessionDuration,
            bounceRate,
            signups,
            activatedUsers,
            workspacesCreated,
            dau,
            wau,
            mau,
            conversionSignup,
            conversionActivation,
            retention7d,
            totalSessionUsers,
            activeSessionUsers10d,
            inactiveSessionUsers10d,
            totalTrackedSessions,
            // Legacy aliases kept for the current dashboard payload consumers.
            totalOpenSessions: totalSessionUsers,
            activeSessions10d: activeSessionUsers10d,
            inactiveSessions10d: inactiveSessionUsers10d,
            churnRate10d,
            churnRate30,
            churned30,
            eligible30,
          },
          trends: { dailySessions, dailySignups }
        },
        funnel: { funnel: funnelSteps, dropoffs },
        traffic: { byDevice: trafficByDevice, byBrowser: trafficByBrowser, byOS: trafficByOS, daily: trafficDaily },
        countries: countriesRaw,
        pages: pagesRaw,
        activity: { daily: activityDaily },
        security: {
          measures: [
            { id: 'encryption', name: 'Chiffrement mots de passe', status: 'active', type: 'bcrypt (12 rounds)', desc: 'Irréversible — même les admins ne peuvent pas lire les mots de passe' },
            { id: 'tls', name: 'Chiffrement en transit', status: 'active', type: 'HTTPS/TLS', desc: 'Toutes les communications sont chiffrées' },
            { id: 'aes', name: 'Chiffrement données sensibles', status: 'active', type: 'AES-256-GCM', desc: 'Données sensibles chiffrées dans la base de données' },
            { id: 'isolation', name: 'Isolation des workspaces', status: 'active', type: 'Filtrage MongoDB', desc: 'Chaque espace est cloisonné au niveau de la base de données' },
            { id: 'rbac', name: "Contrôle d'accès par rôle", status: 'active', type: 'RBAC', desc: 'Principe du moindre privilège appliqué' },
            { id: 'audit', name: "Journalisation d'audit", status: 'active', type: 'Logs immuables', desc: 'Chaque action est tracée et ne peut être ni modifiée ni supprimée' },
            { id: 'headers', name: 'Headers de sécurité HTTP', status: 'active', type: 'HSTS, CSP, XSS', desc: 'Protection contre XSS, clickjacking, sniffing' },
            { id: 'ratelimit', name: 'Protection brute force', status: 'active', type: 'Rate limiting', desc: 'Limitation des tentatives de connexion' },
            { id: 'nocookies', name: 'Zéro cookie tracking', status: 'active', type: 'JWT uniquement', desc: 'Aucun cookie publicitaire ni outil de suivi tiers' },
            { id: 'masking', name: 'Masquage des données', status: 'active', type: 'Data masking', desc: 'Les données sensibles sont masquées dans les réponses API' },
          ],
          stats: { totalAuditLogs: totalLogs, last24hActions: last24h, failedLoginsLast24h: failedLogins, lastActivity: lastActivity?.createdAt || null }
        },
        push: { total: pushTotal, sent: pushSent, failed: pushFailed, scheduled: pushScheduled },
      };

      _dashCache.set(range, data);
      res.json({ success: true, data, cached: false });
    } catch (error) {
      console.error('[SuperAdmin] dashboard-summary error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/ecom/super-admin/dashboard-quick
// Ultra-fast endpoint: only the 4 essential KPIs (counts, no aggregates).
// Used to make the page shell appear in <300ms while the full summary loads.
// Cache: 2 minutes.
// ══════════════════════════════════════════════════════════════════════════════
const _quickCache = makeCache(120_000); // 2 minutes

router.get('/dashboard-quick',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const cached = _quickCache.get('quick');
      if (cached) return res.json({ success: true, data: cached, cached: true });

      const [totalUsers, totalWorkspaces, activeWorkspaces] = await Promise.all([
        EcomUser.estimatedDocumentCount(),
        Workspace.estimatedDocumentCount(),
        Workspace.countDocuments({ isActive: true }),
      ]);

      const data = { totalUsers, totalWorkspaces, activeWorkspaces };
      _quickCache.set('quick', data);
      res.json({ success: true, data, cached: false });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/ecom/super-admin/boutique-stats?workspaceId=&storeId=
// Stats d'une boutique par période (jour/semaine/mois) + top 3 vendeurs (closers)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/boutique-stats',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { workspaceId, storeId } = req.query;

      // ── 1. Liste des boutiques/workspaces pour le sélecteur ──
      if (!workspaceId) {
        const [workspaces, stores] = await Promise.all([
          Workspace.find({}, { name: 1, subdomain: 1, owner: 1, isActive: 1, storeSettings: 1 })
            .limit(500).lean(),
          Store.find({}, { workspaceId: 1, name: 1, subdomain: 1, isActive: 1, storeSettings: 1 })
            .limit(500).lean(),
        ]);
        return res.json({ success: true, data: { workspaces, stores } });
      }

      // ── 2. Périodes ──
      const now = new Date();
      const startOfDay   = new Date(now); startOfDay.setHours(0,0,0,0);
      const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); startOfWeek.setHours(0,0,0,0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const wid = new mongoose.Types.ObjectId(workspaceId);
      const baseMatch = { workspaceId: wid };
      if (storeId) {
        try { baseMatch.storeId = new mongoose.Types.ObjectId(storeId); } catch (_) {}
      }

      const periodStats = async (since) => {
        const match = { ...baseMatch, createdAt: { $gte: since, $lte: now } };
        const [orders, ordersByStatus, revenue] = await Promise.all([
          Order.countDocuments(match),
          Order.aggregate([
            { $match: match },
            { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$price', 0] } } } },
          ]),
          Order.aggregate([
            { $match: { ...match, status: { $in: ['livré', 'delivered', 'livrée', 'livree', 'confirmé', 'confirmed'] } } },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } },
          ]),
        ]);
        const byStatus = {};
        ordersByStatus.forEach(s => { byStatus[s._id || 'unknown'] = { count: s.count, revenue: s.revenue || 0 }; });
        return {
          orders,
          revenue: revenue[0]?.total || 0,
          byStatus,
          confirmed: (byStatus['confirmé']?.count || 0) + (byStatus['confirmed']?.count || 0) + (byStatus['livré']?.count || 0) + (byStatus['delivered']?.count || 0) + (byStatus['livrée']?.count || 0),
        };
      };

      // ── 3. Top 3 closers/vendeurs ──
      const top3Closer = async (since) => {
        return Order.aggregate([
          { $match: { ...baseMatch, closerId: { $ne: null }, createdAt: { $gte: since, $lte: now } } },
          { $group: {
            _id: '$closerId',
            orders: { $sum: 1 },
            sold: { $sum: { $cond: [{ $in: ['$closerStatus', ['sold']] }, 1, 0] } },
            revenue: { $sum: { $ifNull: ['$price', 0] } },
          }},
          { $sort: { sold: -1, orders: -1 } },
          { $limit: 3 },
          { $lookup: { from: 'ecom_users', localField: '_id', foreignField: '_id', as: 'user', pipeline: [{ $project: { name: 1, email: 1, role: 1 } }] } },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $project: { userId: '$_id', name: '$user.name', email: '$user.email', role: '$user.role', orders: 1, sold: 1, revenue: 1 } },
        ]);
      };

      const [day, week, month, topDay, topWeek, topMonth, workspace, store] = await Promise.all([
        periodStats(startOfDay),
        periodStats(startOfWeek),
        periodStats(startOfMonth),
        top3Closer(startOfDay),
        top3Closer(startOfWeek),
        top3Closer(startOfMonth),
        Workspace.findById(workspaceId, { name: 1, subdomain: 1, storeSettings: 1, isActive: 1 }).lean(),
        storeId ? Store.findById(storeId, { name: 1, subdomain: 1, storeSettings: 1, isActive: 1 }).lean() : null,
      ]);

      // ── 4. Toutes les commandes du jour pour le feed ──
      const todayOrders = await Order.find(
        { ...baseMatch, createdAt: { $gte: startOfDay } },
        { customerName: 1, clientName: 1, product: 1, price: 1, status: 1, closerId: 1, closerStatus: 1, createdAt: 1 }
      ).sort({ createdAt: -1 }).limit(50).lean();

      res.json({
        success: true,
        data: {
          workspace,
          store,
          day,   topDay,
          week,  topWeek,
          month, topMonth,
          todayOrders,
        }
      });
    } catch (error) {
      console.error('[SuperAdmin] boutique-stats error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
