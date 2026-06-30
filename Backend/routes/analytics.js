import express from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import AnalyticsSession from '../models/AnalyticsSession.js';
import EcomUser from '../models/EcomUser.js';
import Store from '../models/Store.js';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
import Product from '../models/Product.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';

const router = express.Router();

// ──────────────────────────────────────────────────────────
// Helper: parse user-agent into device/browser/os
// ──────────────────────────────────────────────────────────
function parseUserAgent(ua) {
  if (!ua) return { device: 'unknown', browser: null, os: null };

  const device = /mobile|android|iphone|ipad|ipod/i.test(ua)
    ? (/ipad|tablet/i.test(ua) ? 'tablet' : 'mobile')
    : 'desktop';

  let browser = null;
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else browser = 'Other';

  let os = null;
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'Linux';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else os = 'Other';

  return { device, browser, os };
}

// ──────────────────────────────────────────────────────────
// Helper: date range filter builder
// Supports range shortcuts (24h,7d,30d,90d) OR custom startDate/endDate
// Returns { since, until } pair
// ──────────────────────────────────────────────────────────
function dateFilter(range = '30d', startDate = null, endDate = null) {
  const now = new Date();

  // Custom date range takes priority
  if (startDate) {
    const since = new Date(startDate);
    since.setHours(0, 0, 0, 0);
    const until = endDate ? new Date(endDate) : now;
    until.setHours(23, 59, 59, 999);
    return { since, until };
  }

  const ms = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  const delta = ms[range] || ms['30d'];
  return { since: new Date(now.getTime() - delta), until: now };
}

function toDayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function buildDailyEngagement(since, until, sessions = [], logins = []) {
  const map = new Map();
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(until);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    const date = toDayKey(cursor);
    map.set(date, {
      date,
      sessions: 0,
      activeUsers: 0,
      logins: 0,
      loginUsers: 0,
      pageViews: 0,
      totalDuration: 0,
      avgDuration: 0
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  sessions.forEach((item) => {
    const date = item.date || item._id;
    if (!date) return;
    const current = map.get(date) || {
      date,
      sessions: 0,
      activeUsers: 0,
      logins: 0,
      loginUsers: 0,
      pageViews: 0,
      totalDuration: 0,
      avgDuration: 0
    };
    current.sessions = item.sessions || 0;
    current.activeUsers = item.activeUsers || 0;
    current.pageViews = item.pageViews || 0;
    current.totalDuration = Math.round(item.totalDuration || 0);
    current.avgDuration = Math.round(item.avgDuration || 0);
    map.set(date, current);
  });

  logins.forEach((item) => {
    const date = item.date || item._id;
    if (!date) return;
    const current = map.get(date) || {
      date,
      sessions: 0,
      activeUsers: 0,
      logins: 0,
      loginUsers: 0,
      pageViews: 0,
      totalDuration: 0,
      avgDuration: 0
    };
    current.logins = item.logins || 0;
    current.loginUsers = item.loginUsers || 0;
    map.set(date, current);
  });

  return Array.from(map.values()).sort((left, right) => left.date.localeCompare(right.date));
}

function parseLimit(value, fallback = 10, max = 50) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getActivityStatsOverride(source) {
  const override = source?.storeSettings?.adminStatsOverride || source?.storeSettings?.activityStatsOverride;
  if (!override || override.enabled === false) return null;

  const totalOrders = Number(override.totalOrders);
  const totalRevenue = Number(override.totalRevenue);

  return {
    totalOrders: Number.isFinite(totalOrders) && totalOrders >= 0 ? Math.round(totalOrders) : null,
    totalRevenue: Number.isFinite(totalRevenue) && totalRevenue >= 0 ? Math.round(totalRevenue) : null,
  };
}

function applyActivityStatsOverride(record, source) {
  const override = getActivityStatsOverride(source);
  if (!override) return record;

  const totalOrders = override.totalOrders ?? record.totalOrders ?? 0;
  const totalRevenue = override.totalRevenue ?? record.totalRevenue ?? 0;

  return {
    ...record,
    totalOrders,
    totalRevenue,
    statsOverride: {
      applied: true,
      baseTotalOrders: record.totalOrders || 0,
      baseTotalRevenue: record.totalRevenue || 0,
      totalOrders,
      totalRevenue,
    },
  };
}

// ──────────────────────────────────────────────────────────
// Helper: resolve country from IP (Cloudflare headers first, then ipinfo.io)
// ──────────────────────────────────────────────────────────
const _geoCache = new Map(); // simple in-memory cache
async function resolveCountry(req) {
  // 1. Cloudflare / reverse-proxy headers (instant)
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry && cfCountry !== 'XX') return { country: cfCountry.toUpperCase(), city: req.headers['cf-ipcity'] || null };

  // 2. Extract real IP from x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress;
  if (!ip || ip === '::1' || ip === '127.0.0.1') return { country: null, city: null };

  // 3. Cache hit
  if (_geoCache.has(ip)) return _geoCache.get(ip);

  // 4. ipinfo.io lookup (free, no key needed for basic country)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const r = await fetch(`https://ipinfo.io/${ip}/json`, { signal: controller.signal });
    clearTimeout(timer);
    if (r.ok) {
      const d = await r.json();
      const geo = { country: d.country || null, city: d.city || null };
      _geoCache.set(ip, geo);
      if (_geoCache.size > 5000) _geoCache.delete(_geoCache.keys().next().value);
      return geo;
    }
  } catch (_) { /* timeout or network — continue */ }

  return { country: null, city: null };
}

// ──────────────────────────────────────────────────────────
// POST /api/ecom/analytics/track
// Public endpoint for tracking events from the frontend
// ──────────────────────────────────────────────────────────
const VALID_EVENT_TYPES = new Set([
  'page_view', 'signup_started', 'signup_completed', 'email_verified',
  'login', 'login_failed', 'logout', 'workspace_created', 'workspace_joined',
  'order_created', 'order_updated', 'delivery_completed', 'transaction_created',
  'invite_generated', 'invite_accepted', 'product_created', 'report_viewed',
  'settings_changed', 'password_reset', 'custom'
]);

router.post('/track', async (req, res) => {
  try {
    const { sessionId, eventType, page, referrer, meta, userId, workspaceId, userRole } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, message: 'sessionId and eventType required' });
    }

    const safeEventType = VALID_EVENT_TYPES.has(eventType) ? eventType : 'custom';

    const ua = req.headers['user-agent'] || '';
    const { device, browser, os } = parseUserAgent(ua);

    // Geo: Cloudflare headers first, then IP lookup fallback
    const { country, city } = await resolveCountry(req);

    // Validate ObjectIds to avoid Mongoose CastError -> 500
    const isObjectId = (v) => v && /^[a-f\d]{24}$/i.test(String(v));
    const safeUserId = isObjectId(userId) ? userId : null;
    const safeWorkspaceId = isObjectId(workspaceId) ? workspaceId : null;

    // Create event
    await AnalyticsEvent.create({
      userId: safeUserId,
      sessionId,
      eventType: safeEventType,
      page: page || null,
      referrer: referrer || null,
      workspaceId: safeWorkspaceId,
      userRole: userRole || null,
      country,
      city,
      device,
      browser,
      os,
      userAgent: ua.substring(0, 500),
      meta: meta || {}
    });

    // Upsert session
    let session = await AnalyticsSession.findOne({ sessionId });
    if (!session) {
      try {
        session = await AnalyticsSession.create({
          sessionId,
          userId: safeUserId,
          startedAt: new Date(),
          lastActivityAt: new Date(),
          country,
          city,
          device,
          browser,
          os,
          pageViews: eventType === 'page_view' ? 1 : 0,
          pagesVisited: page ? [page] : [],
          entryPage: page || null,
          exitPage: page || null,
          referrer: referrer || null,
          isBounce: true
        });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          session = await AnalyticsSession.findOne({ sessionId });
        } else {
          throw dupErr;
        }
      }
    }
    if (session) {
      const updates = {
        lastActivityAt: new Date(),
        exitPage: page || session.exitPage,
        duration: Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
      };
      if (safeUserId && !session.userId) updates.userId = safeUserId;
      if (eventType === 'page_view') {
        updates.$inc = { pageViews: 1 };
        if (page && !session.pagesVisited.includes(page)) {
          updates.$addToSet = { pagesVisited: page };
        }
        if (session.pageViews >= 1) updates.isBounce = false;
      }

      const { $inc, $addToSet, ...setFields } = updates;
      const updateOp = { $set: setFields };
      if ($inc) updateOp.$inc = $inc;
      if ($addToSet) updateOp.$addToSet = $addToSet;

      await AnalyticsSession.updateOne({ sessionId }, updateOp);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error.message);
    res.status(500).json({ success: false, message: 'Tracking error' });
  }
});

// ══════════════════════════════════════════════════════════
// All routes below require super admin auth
// ══════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/overview
// KPIs: visits, unique users, signups, activations, workspaces, DAU/WAU, retention
// ──────────────────────────────────────────────────────────
router.get('/overview',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      // Sessions & page views
      const [sessionStats] = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            totalPageViews: { $sum: '$pageViews' },
            avgDuration: { $avg: '$duration' },
            bounces: { $sum: { $cond: ['$isBounce', 1, 0] } }
          }
        }
      ]);

      const totalSessions = sessionStats?.totalSessions || 0;
      const uniqueVisitors = (sessionStats?.uniqueUsers || []).filter(Boolean).length;
      const totalPageViews = sessionStats?.totalPageViews || 0;
      const avgSessionDuration = Math.round(sessionStats?.avgDuration || 0);
      const bounceRate = totalSessions > 0
        ? Math.round(((sessionStats?.bounces || 0) / totalSessions) * 100)
        : 0;

      // Signups in period
      const signups = await EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until } });

      // Active users with workspace
      const activatedUsers = await EcomUser.countDocuments({
        createdAt: { $gte: since, $lte: until },
        workspaceId: { $ne: null }
      });

      // Workspaces created
      const workspacesCreated = await Workspace.countDocuments({ createdAt: { $gte: since, $lte: until } });

      // DAU / WAU / MAU
      const now = new Date();
      const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day1, $lte: until }, userId: { $ne: null } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const [wauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day7, $lte: until }, userId: { $ne: null } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const [mauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day30, $lte: until }, userId: { $ne: null } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);

      const dau = dauResult?.users?.length || 0;
      const wau = wauResult?.users?.length || 0;
      const mau = mauResult?.users?.length || 0;

      // Conversion rates
      const totalUsers = await EcomUser.countDocuments();
      const usersWithWorkspace = await EcomUser.countDocuments({ workspaceId: { $ne: null } });
      const conversionSignup = uniqueVisitors > 0 ? Math.round((signups / uniqueVisitors) * 100) : 0;
      const conversionActivation = totalUsers > 0 ? Math.round((usersWithWorkspace / totalUsers) * 100) : 0;

      // 7-day retention: users who signed up 7+ days ago AND have activity in last 7 days
      const retentionCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const usersSignedUp7DaysAgo = await EcomUser.countDocuments({ createdAt: { $lte: retentionCutoff } });
      const [retainedResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: retentionCutoff }, userId: { $ne: null } } },
        {
          $lookup: {
            from: 'ecom_users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        { $match: { 'user.createdAt': { $lte: retentionCutoff } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const retained = retainedResult?.users?.length || 0;
      const retention7d = usersSignedUp7DaysAgo > 0 ? Math.round((retained / usersSignedUp7DaysAgo) * 100) : 0;

      // Trend: daily sessions over period
      const dailySessions = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
            sessions: { $sum: 1 },
            pageViews: { $sum: '$pageViews' },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            date: '$_id',
            sessions: 1,
            pageViews: 1,
            uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } }
          }
        }
      ]);

      // Daily signups trend
      const dailySignups = await EcomUser.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.json({
        success: true,
        data: {
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
            retention7d
          },
          trends: {
            dailySessions,
            dailySignups
          }
        }
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/engagement
// Deep super-admin engagement: logins, daily users, time spent, journeys
// ──────────────────────────────────────────────────────────
router.get('/engagement',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const limit = parseLimit(req.query.limit, 10, 30);
      const { since, until } = dateFilter(range, startDate, endDate);
      const sessionMatch = { startedAt: { $gte: since, $lte: until } };
      const eventMatch = { createdAt: { $gte: since, $lte: until } };
      const durationExpr = {
        $cond: [
          { $gt: [{ $ifNull: ['$duration', 0] }, 0] },
          { $ifNull: ['$duration', 0] },
          {
            $let: {
              vars: {
                computedDuration: {
                  $floor: {
                    $divide: [
                      { $subtract: [{ $ifNull: ['$lastActivityAt', '$startedAt'] }, '$startedAt'] },
                      1000
                    ]
                  }
                }
              },
              in: {
                $cond: [{ $gt: ['$$computedDuration', 0] }, '$$computedDuration', 0]
              }
            }
          }
        ]
      };

      const [
        sessionStatsRaw,
        loginStatsRaw,
        dailySessionsRaw,
        dailyLoginsRaw,
        topPages,
        topActions,
        roles,
        topUsersRaw,
        recentJourneys
      ] = await Promise.all([
        AnalyticsSession.aggregate([
          { $match: sessionMatch },
          {
            $project: {
              userId: 1,
              pageViews: { $ifNull: ['$pageViews', 0] },
              isBounce: 1,
              durationSec: durationExpr
            }
          },
          {
            $group: {
              _id: null,
              totalSessions: { $sum: 1 },
              identifiedSessions: { $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] } },
              anonymousSessions: { $sum: { $cond: [{ $eq: ['$userId', null] }, 1, 0] } },
              activeUsers: { $addToSet: '$userId' },
              pageViews: { $sum: '$pageViews' },
              totalDuration: { $sum: '$durationSec' },
              avgDuration: { $avg: '$durationSec' },
              bounces: { $sum: { $cond: ['$isBounce', 1, 0] } }
            }
          }
        ]),
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, eventType: 'login' } },
          {
            $group: {
              _id: null,
              totalLogins: { $sum: 1 },
              loginUsers: { $addToSet: '$userId' }
            }
          }
        ]),
        AnalyticsSession.aggregate([
          { $match: sessionMatch },
          {
            $project: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } },
              userId: 1,
              pageViews: { $ifNull: ['$pageViews', 0] },
              durationSec: durationExpr
            }
          },
          {
            $group: {
              _id: '$day',
              sessions: { $sum: 1 },
              activeUsers: { $addToSet: '$userId' },
              pageViews: { $sum: '$pageViews' },
              totalDuration: { $sum: '$durationSec' },
              avgDuration: { $avg: '$durationSec' }
            }
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              date: '$_id',
              sessions: 1,
              pageViews: 1,
              totalDuration: 1,
              avgDuration: 1,
              activeUsers: { $size: { $filter: { input: '$activeUsers', cond: { $ne: ['$$this', null] } } } }
            }
          }
        ]),
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, eventType: 'login' } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              logins: { $sum: 1 },
              loginUsers: { $addToSet: '$userId' }
            }
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              date: '$_id',
              logins: 1,
              loginUsers: { $size: { $filter: { input: '$loginUsers', cond: { $ne: ['$$this', null] } } } }
            }
          }
        ]),
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, eventType: 'page_view', page: { $ne: null } } },
          {
            $group: {
              _id: '$page',
              views: { $sum: 1 },
              sessions: { $addToSet: '$sessionId' },
              users: { $addToSet: '$userId' }
            }
          },
          { $sort: { views: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              page: '$_id',
              views: 1,
              sessions: { $size: '$sessions' },
              uniqueUsers: { $size: { $filter: { input: '$users', cond: { $ne: ['$$this', null] } } } }
            }
          }
        ]),
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, eventType: { $ne: 'page_view' } } },
          {
            $group: {
              _id: '$eventType',
              count: { $sum: 1 },
              users: { $addToSet: '$userId' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              eventType: '$_id',
              count: 1,
              uniqueUsers: { $size: { $filter: { input: '$users', cond: { $ne: ['$$this', null] } } } }
            }
          }
        ]),
        AnalyticsSession.aggregate([
          { $match: { ...sessionMatch, userId: { $ne: null } } },
          {
            $lookup: {
              from: 'ecom_users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              role: { $ifNull: ['$user.role', 'unknown'] },
              userId: 1,
              durationSec: durationExpr
            }
          },
          {
            $group: {
              _id: '$role',
              users: { $addToSet: '$userId' },
              sessions: { $sum: 1 },
              totalDuration: { $sum: '$durationSec' }
            }
          },
          { $sort: { sessions: -1 } },
          {
            $project: {
              _id: 0,
              role: '$_id',
              sessions: 1,
              totalDuration: 1,
              users: { $size: '$users' }
            }
          }
        ]),
        AnalyticsSession.aggregate([
          { $match: { ...sessionMatch, userId: { $ne: null } } },
          {
            $project: {
              userId: 1,
              pageViews: { $ifNull: ['$pageViews', 0] },
              pagesVisited: { $ifNull: ['$pagesVisited', []] },
              lastActivityAt: 1,
              startedAt: 1,
              durationSec: durationExpr
            }
          },
          {
            $group: {
              _id: '$userId',
              sessions: { $sum: 1 },
              totalDuration: { $sum: '$durationSec' },
              avgDuration: { $avg: '$durationSec' },
              pageViews: { $sum: '$pageViews' },
              lastActivityAt: { $max: '$lastActivityAt' },
              firstSeenAt: { $min: '$startedAt' },
              pagesArrays: { $push: '$pagesVisited' }
            }
          },
          { $sort: { totalDuration: -1, pageViews: -1 } },
          { $limit: limit },
          {
            $lookup: {
              from: 'ecom_users',
              localField: '_id',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'ecom_workspaces',
              localField: 'user.workspaceId',
              foreignField: '_id',
              as: 'workspace'
            }
          },
          { $unwind: { path: '$workspace', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              email: '$user.email',
              name: '$user.name',
              role: '$user.role',
              workspaceName: '$workspace.name',
              sessions: 1,
              totalDuration: 1,
              avgDuration: 1,
              pageViews: 1,
              lastActivityAt: 1,
              firstSeenAt: 1,
              pagesVisited: {
                $slice: [
                  {
                    $reduce: {
                      input: '$pagesArrays',
                      initialValue: [],
                      in: { $setUnion: ['$$value', '$$this'] }
                    }
                  },
                  8
                ]
              }
            }
          }
        ]),
        AnalyticsSession.aggregate([
          { $match: sessionMatch },
          { $sort: { lastActivityAt: -1 } },
          { $limit: 12 },
          {
            $lookup: {
              from: 'ecom_users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'ecom_workspaces',
              localField: 'user.workspaceId',
              foreignField: '_id',
              as: 'workspace'
            }
          },
          { $unwind: { path: '$workspace', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              sessionId: 1,
              userId: 1,
              email: '$user.email',
              name: '$user.name',
              role: '$user.role',
              workspaceName: '$workspace.name',
              startedAt: 1,
              lastActivityAt: 1,
              duration: durationExpr,
              pageViews: { $ifNull: ['$pageViews', 0] },
              pagesVisited: { $slice: [{ $ifNull: ['$pagesVisited', []] }, 8] },
              device: 1,
              browser: 1,
              country: 1
            }
          }
        ])
      ]);

      const topUserIds = topUsersRaw.map((user) => user._id).filter(Boolean);
      const [perUserActions, perUserPages] = topUserIds.length > 0 ? await Promise.all([
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, userId: { $in: topUserIds }, eventType: { $ne: 'page_view' } } },
          { $group: { _id: { userId: '$userId', eventType: '$eventType' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $group: { _id: '$_id.userId', actions: { $push: { eventType: '$_id.eventType', count: '$count' } } } },
          { $project: { _id: 1, actions: { $slice: ['$actions', 5] } } }
        ]),
        AnalyticsEvent.aggregate([
          { $match: { ...eventMatch, userId: { $in: topUserIds }, eventType: 'page_view', page: { $ne: null } } },
          { $group: { _id: { userId: '$userId', page: '$page' }, views: { $sum: 1 } } },
          { $sort: { views: -1 } },
          { $group: { _id: '$_id.userId', pages: { $push: { page: '$_id.page', views: '$views' } } } },
          { $project: { _id: 1, pages: { $slice: ['$pages', 5] } } }
        ])
      ]) : [[], []];

      const actionMap = new Map(perUserActions.map((item) => [String(item._id), item.actions || []]));
      const pageMap = new Map(perUserPages.map((item) => [String(item._id), item.pages || []]));

      const sessionStats = sessionStatsRaw?.[0] || {};
      const loginStats = loginStatsRaw?.[0] || {};
      const totalSessions = sessionStats.totalSessions || 0;
      const totalLogins = loginStats.totalLogins || 0;
      const activeUsers = (sessionStats.activeUsers || []).filter(Boolean).length;
      const loginUsers = (loginStats.loginUsers || []).filter(Boolean).length;
      const pageViews = sessionStats.pageViews || 0;
      const totalDuration = Math.round(sessionStats.totalDuration || 0);
      const avgDuration = Math.round(sessionStats.avgDuration || 0);

      res.json({
        success: true,
        data: {
          period: { since, until, range, startDate: startDate || null, endDate: endDate || null },
          kpis: {
            totalSessions,
            identifiedSessions: sessionStats.identifiedSessions || 0,
            anonymousSessions: sessionStats.anonymousSessions || 0,
            activeUsers,
            totalLogins,
            loginUsers,
            pageViews,
            totalDuration,
            avgDuration,
            avgPagesPerSession: totalSessions > 0 ? Math.round((pageViews / totalSessions) * 10) / 10 : 0,
            avgSessionsPerUser: activeUsers > 0 ? Math.round((totalSessions / activeUsers) * 10) / 10 : 0,
            bounceRate: totalSessions > 0 ? Math.round(((sessionStats.bounces || 0) / totalSessions) * 100) : 0
          },
          daily: buildDailyEngagement(since, until, dailySessionsRaw, dailyLoginsRaw),
          topUsers: topUsersRaw.map((user) => ({
            userId: String(user._id || ''),
            email: user.email || '',
            name: user.name || '',
            role: user.role || null,
            workspaceName: user.workspaceName || '',
            sessions: user.sessions || 0,
            totalDuration: Math.round(user.totalDuration || 0),
            avgDuration: Math.round(user.avgDuration || 0),
            pageViews: user.pageViews || 0,
            lastActivityAt: user.lastActivityAt || null,
            firstSeenAt: user.firstSeenAt || null,
            pagesVisited: user.pagesVisited || [],
            topPages: pageMap.get(String(user._id)) || [],
            actions: actionMap.get(String(user._id)) || []
          })),
          topPages,
          topActions,
          roles,
          recentJourneys
        }
      });
    } catch (error) {
      console.error('Analytics engagement error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/funnel
// Conversion funnel: visitors → signups → verified → workspace → active
// ──────────────────────────────────────────────────────────
router.get('/funnel',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      // 1. Unique visitors (sessions)
      const [visitorsResult] = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]);
      const visitors = visitorsResult?.count || 0;

      // 2. Accounts created
      const accountsCreated = await EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until } });

      // 3. Email verified (users who logged in at least once = verified)
      const emailVerified = await EcomUser.countDocuments({
        createdAt: { $gte: since, $lte: until },
        lastLogin: { $ne: null }
      });

      // 4. Joined a workspace
      const joinedWorkspace = await EcomUser.countDocuments({
        createdAt: { $gte: since, $lte: until },
        workspaceId: { $ne: null }
      });

      // 5. Active users (had at least 1 business action)
      const businessEvents = [
        'order_created', 'order_updated', 'delivery_completed',
        'transaction_created', 'product_created', 'report_viewed'
      ];
      const [activeResult] = await AnalyticsEvent.aggregate([
        {
          $match: {
            createdAt: { $gte: since, $lte: until },
            eventType: { $in: businessEvents },
            userId: { $ne: null }
          }
        },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const activeUsers = activeResult?.users?.length || 0;

      // Build funnel steps
      const funnel = [
        { step: 'Visiteurs', count: visitors, rate: 100 },
        { step: 'Comptes créés', count: accountsCreated, rate: visitors > 0 ? Math.round((accountsCreated / visitors) * 100) : 0 },
        { step: 'Email vérifié', count: emailVerified, rate: accountsCreated > 0 ? Math.round((emailVerified / accountsCreated) * 100) : 0 },
        { step: 'Workspace rejoint', count: joinedWorkspace, rate: emailVerified > 0 ? Math.round((joinedWorkspace / emailVerified) * 100) : 0 },
        { step: 'Utilisateur actif', count: activeUsers, rate: joinedWorkspace > 0 ? Math.round((activeUsers / joinedWorkspace) * 100) : 0 }
      ];

      // Drop-off between steps
      const dropoffs = [];
      for (let i = 1; i < funnel.length; i++) {
        const prev = funnel[i - 1].count;
        const curr = funnel[i].count;
        const lost = prev - curr;
        dropoffs.push({
          from: funnel[i - 1].step,
          to: funnel[i].step,
          lost,
          dropRate: prev > 0 ? Math.round((lost / prev) * 100) : 0
        });
      }

      res.json({
        success: true,
        data: { funnel, dropoffs }
      });
    } catch (error) {
      console.error('Analytics funnel error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/traffic
// Traffic metrics: sessions, unique users, page views, avg duration, bounce rate
// ──────────────────────────────────────────────────────────
router.get('/traffic',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      // By device
      const byDevice = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: '$device',
            sessions: { $sum: 1 },
            pageViews: { $sum: '$pageViews' },
            avgDuration: { $avg: '$duration' },
            bounces: { $sum: { $cond: ['$isBounce', 1, 0] } }
          }
        },
        { $sort: { sessions: -1 } }
      ]);

      // By browser
      const byBrowser = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: '$browser',
            sessions: { $sum: 1 }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 10 }
      ]);

      // By OS
      const byOS = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: '$os',
            sessions: { $sum: 1 }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 10 }
      ]);

      // Hourly distribution (for "best times")
      const hourly = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until } } },
        {
          $group: {
            _id: { $hour: '$startedAt' },
            sessions: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // By referrer source
      const byReferrer = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, referrer: { $ne: null } } },
        {
          $group: {
            _id: '$referrer',
            sessions: { $sum: 1 }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 15 }
      ]);

      res.json({
        success: true,
        data: { byDevice, byBrowser, byOS, hourly, byReferrer }
      });
    } catch (error) {
      console.error('Analytics traffic error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/countries
// Country breakdown: visits, users, conversion
// ──────────────────────────────────────────────────────────
router.get('/countries',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      const countries = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, country: { $ne: null } } },
        {
          $group: {
            _id: '$country',
            sessions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            pageViews: { $sum: '$pageViews' },
            avgDuration: { $avg: '$duration' },
            bounces: { $sum: { $cond: ['$isBounce', 1, 0] } }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: 30 },
        {
          $project: {
            country: '$_id',
            sessions: 1,
            uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } },
            pageViews: 1,
            avgDuration: { $round: ['$avgDuration', 0] },
            bounceRate: {
              $cond: [
                { $gt: ['$sessions', 0] },
                { $round: [{ $multiply: [{ $divide: ['$bounces', '$sessions'] }, 100] }, 0] },
                0
              ]
            }
          }
        }
      ]);

      // Signups by country (from AnalyticsEvent)
      const signupsByCountry = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, eventType: 'signup_completed', country: { $ne: null } } },
        { $group: { _id: '$country', signups: { $sum: 1 } } }
      ]);
      const signupMap = {};
      signupsByCountry.forEach(s => { signupMap[s._id] = s.signups; });

      let result = countries.map(c => ({
        ...c,
        signups: signupMap[c.country] || 0,
        conversionRate: c.sessions > 0
          ? Math.round(((signupMap[c.country] || 0) / c.sessions) * 100)
          : 0
      }));

      // ── Fallback: if no session geo data, use EcomUser registrations per country ──
      // We use the login events country as a proxy, or aggregate signups from AnalyticsEvent
      if (result.length === 0) {
        // Use signup events that DO have country
        const signupCountries = await AnalyticsEvent.aggregate([
          { $match: { createdAt: { $gte: since, $lte: until }, eventType: { $in: ['signup_completed', 'login'] }, country: { $ne: null } } },
          {
            $group: {
              _id: '$country',
              sessions: { $sum: 1 },
              uniqueUsers: { $addToSet: '$userId' },
              signups: { $sum: { $cond: [{ $eq: ['$eventType', 'signup_completed'] }, 1, 0] } }
            }
          },
          { $sort: { sessions: -1 } },
          { $limit: 30 },
          {
            $project: {
              country: '$_id',
              sessions: 1,
              signups: 1,
              uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } },
              pageViews: '$sessions',
              avgDuration: 0,
              bounceRate: 0,
              conversionRate: {
                $cond: [{ $gt: ['$sessions', 0] }, { $round: [{ $multiply: [{ $divide: ['$signups', '$sessions'] }, 100] }, 0] }, 0]
              }
            }
          }
        ]);
        result = signupCountries;
      }

      res.json({
        success: true,
        data: { countries: result }
      });
    } catch (error) {
      console.error('Analytics countries error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/pages
// Top pages: views, avg time, exit rate, conversion
// ──────────────────────────────────────────────────────────
router.get('/pages',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      const pages = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, eventType: 'page_view', page: { $ne: null } } },
        {
          $group: {
            _id: '$page',
            views: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            sessions: { $addToSet: '$sessionId' }
          }
        },
        { $sort: { views: -1 } },
        { $limit: 25 },
        {
          $project: {
            page: '$_id',
            views: 1,
            uniqueUsers: { $size: { $filter: { input: '$uniqueUsers', cond: { $ne: ['$$this', null] } } } },
            sessions: { $size: '$sessions' }
          }
        }
      ]);

      // Exit pages (sessions where this was the last page)
      const exitPages = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, exitPage: { $ne: null } } },
        { $group: { _id: '$exitPage', exits: { $sum: 1 } } }
      ]);
      const exitMap = {};
      exitPages.forEach(e => { exitMap[e._id] = e.exits; });

      // Entry pages
      const entryPages = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, entryPage: { $ne: null } } },
        { $group: { _id: '$entryPage', entries: { $sum: 1 } } }
      ]);
      const entryMap = {};
      entryPages.forEach(e => { entryMap[e._id] = e.entries; });

      const result = pages.map(p => ({
        ...p,
        exits: exitMap[p.page] || 0,
        exitRate: p.views > 0 ? Math.round(((exitMap[p.page] || 0) / p.views) * 100) : 0,
        entries: entryMap[p.page] || 0
      }));

      res.json({
        success: true,
        data: { pages: result }
      });
    } catch (error) {
      console.error('Analytics pages error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/users-activity
// Recent logins, DAU/WAU/MAU, active by role, users without workspace
// ──────────────────────────────────────────────────────────
router.get('/users-activity',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      // Single parallel batch — all 8 queries fire simultaneously
      const [
        recentLoginUsers,
        totalLogins,
        activeByRole,
        noWorkspace,
        totalWorkspaces,
        users,
        workspaces,
        stores,
        orderStats,
        productStats,
      ] = await Promise.all([
        // Recent logins from EcomUser.lastLogin (fast indexed query, no AnalyticsEvent scan)
        EcomUser.find(
          { lastLogin: { $ne: null } },
          { email: 1, name: 1, role: 1, workspaceId: 1, lastLogin: 1 }
        ).sort({ lastLogin: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        // Login count
        EcomUser.countDocuments({ lastLogin: { $ne: null } }),
        // Active by role — fast aggregate on EcomUser (small collection)
        EcomUser.aggregate([
          { $match: { role: { $ne: null } } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $project: { role: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ]),
        EcomUser.countDocuments({ workspaceId: null }),
        Workspace.countDocuments(),
        // Store activity data
        EcomUser.find({}, { email: 1, name: 1, role: 1, workspaceId: 1, workspaces: 1, isActive: 1, lastLogin: 1, createdAt: 1 }).limit(5000).lean(),
        Workspace.find({}, { name: 1, slug: 1, owner: 1, subdomain: 1, primaryStoreId: 1, createdAt: 1, storeSettings: 1, isActive: 1 }).limit(5000).lean(),
        Store.find({}, { workspaceId: 1, name: 1, subdomain: 1, createdBy: 1, createdAt: 1, isActive: 1, storeSettings: 1 }).limit(5000).lean(),
        StoreOrder.aggregate([
          { $match: { createdAt: { $gte: yearAgo } } },
          { $group: { _id: { workspaceId: '$workspaceId', storeId: '$storeId' }, totalOrders: { $sum: 1 }, totalRevenue: { $sum: { $ifNull: ['$total', 0] } }, lastOrderAt: { $max: '$createdAt' } } }
        ]),
        StoreProduct.aggregate([
          { $group: { _id: { workspaceId: '$workspaceId', storeId: '$storeId' }, totalProducts: { $sum: 1 }, publishedProducts: { $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] } }, lastProductAt: { $max: '$createdAt' }, productNames: { $push: '$name' }, productSlugs: { $push: '$slug' } } }
        ]),
      ]);

      const recentLogins = recentLoginUsers.map(u => ({ _id: u._id, date: u.lastLogin, email: u.email, name: u.name, role: u.role, workspaceId: u.workspaceId, country: null, city: null, device: null, browser: null }));
      const inactiveWorkspaces = 0;
      const productSales = [];

      const storeKey = (workspaceId, storeId) => `${String(workspaceId || '')}:${String(storeId || 'legacy')}`;

      const orderStatsMap = new Map(
        orderStats.map((entry) => [
          storeKey(entry._id?.workspaceId, entry._id?.storeId),
          entry,
        ])
      );

      const productStatsMap = new Map(
        productStats.map((entry) => [
          storeKey(entry._id?.workspaceId, entry._id?.storeId),
          entry,
        ])
      );

      const usersById = new Map(users.map((user) => [String(user._id), user]));
      const workspacesById = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
      const storesByWorkspace = new Map();
      stores.forEach((store) => {
        const key = String(store.workspaceId);
        if (!storesByWorkspace.has(key)) storesByWorkspace.set(key, []);
        storesByWorkspace.get(key).push(store);
      });

      const boutiqueRecords = [];

      stores.forEach((store) => {
        const workspace = workspacesById.get(String(store.workspaceId));
        if (!workspace) return;

        const statsKey = storeKey(workspace._id, store._id);
        const storeOrders = orderStatsMap.get(statsKey);
        const storeProducts = productStatsMap.get(statsKey);
        const storeSubdomain = store.subdomain || workspace.subdomain || '';
        const attributedUserId = store.createdBy ? String(store.createdBy) : String(workspace.owner || '');

        boutiqueRecords.push(applyActivityStatsOverride({
          attributedUserId,
          workspaceId: String(workspace._id),
          _id: String(store._id),
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug || '',
          name: store.storeSettings?.storeName || store.name || workspace.name,
          currency: store.storeSettings?.storeCurrency || workspace.storeSettings?.storeCurrency || 'XAF',
          subdomain: storeSubdomain,
          url: storeSubdomain ? `https://${storeSubdomain}.scalor.net` : '',
          isActive: store.isActive !== false && store.storeSettings?.isStoreEnabled !== false,
          isLegacyStore: false,
          createdAt: store.createdAt,
          totalOrders: storeOrders?.totalOrders || 0,
          totalRevenue: storeOrders?.totalRevenue || 0,
          totalProducts: storeProducts?.totalProducts || 0,
          publishedProducts: storeProducts?.publishedProducts || 0,
          lastOrderAt: storeOrders?.lastOrderAt || null,
          lastProductAt: storeProducts?.lastProductAt || null,
          productPreviews: ((storeProducts?.productNames || []).slice(0, 5)).map((name, index) => ({
            name,
            slug: (storeProducts?.productSlugs || [])[index] || '',
            url: (storeSubdomain && (storeProducts?.productSlugs || [])[index])
              ? `https://${storeSubdomain}.scalor.net/product/${(storeProducts?.productSlugs || [])[index]}`
              : '',
          })),
        }, store));
      });

      workspaces.forEach((workspace) => {
        const workspaceHasStore = (storesByWorkspace.get(String(workspace._id)) || []).length > 0;
        if (workspaceHasStore || !workspace.subdomain) return;

        const legacyKey = storeKey(workspace._id, null);
        const legacyOrders = orderStatsMap.get(legacyKey);
        const legacyProducts = productStatsMap.get(legacyKey);
        const attributedUserId = String(workspace.owner || '');

        boutiqueRecords.push(applyActivityStatsOverride({
          attributedUserId,
          workspaceId: String(workspace._id),
          _id: `legacy-${workspace._id}`,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug || '',
          name: workspace.storeSettings?.storeName || workspace.name,
          currency: workspace.storeSettings?.storeCurrency || 'XAF',
          subdomain: workspace.subdomain,
          url: `https://${workspace.subdomain}.scalor.net`,
          isActive: workspace.isActive !== false && workspace.storeSettings?.isStoreEnabled !== false,
          isLegacyStore: true,
          createdAt: workspace.createdAt,
          totalOrders: legacyOrders?.totalOrders || 0,
          totalRevenue: legacyOrders?.totalRevenue || 0,
          totalProducts: legacyProducts?.totalProducts || 0,
          publishedProducts: legacyProducts?.publishedProducts || 0,
          lastOrderAt: legacyOrders?.lastOrderAt || null,
          lastProductAt: legacyProducts?.lastProductAt || null,
          productPreviews: ((legacyProducts?.productNames || []).slice(0, 5)).map((name, index) => ({
            name,
            slug: (legacyProducts?.productSlugs || [])[index] || '',
            url: (workspace.subdomain && (legacyProducts?.productSlugs || [])[index])
              ? `https://${workspace.subdomain}.scalor.net/product/${(legacyProducts?.productSlugs || [])[index]}`
              : '',
          })),
        }, workspace));
      });

      const soldProductIds = [...new Set(productSales.map((entry) => String(entry._id?.productId || '')).filter(Boolean))];
      const soldStoreProducts = soldProductIds.length > 0
        ? await StoreProduct.find({ _id: { $in: soldProductIds } }, {
          _id: 1,
          workspaceId: 1,
          storeId: 1,
          name: 1,
          slug: 1,
          price: 1,
          compareAtPrice: 1,
          currency: 1,
          linkedProductId: 1,
          isPublished: 1,
          images: 1,
        }).lean()
        : [];

      const linkedProductIds = [...new Set(
        soldStoreProducts
          .map((product) => String(product.linkedProductId || ''))
          .filter(Boolean)
      )];

      const linkedProducts = linkedProductIds.length > 0
        ? await Product.find({ _id: { $in: linkedProductIds } }, {
          _id: 1,
          sellingPrice: 1,
          productCost: 1,
          deliveryCost: 1,
          avgAdsCost: 1,
        }).lean()
        : [];

      const soldStoreProductsById = new Map(soldStoreProducts.map((product) => [String(product._id), product]));
      const linkedProductsById = new Map(linkedProducts.map((product) => [String(product._id), product]));
      const boutiqueRecordMap = new Map();
      boutiqueRecords.forEach((record) => {
        boutiqueRecordMap.set(storeKey(record.workspaceId, record.isLegacyStore ? null : record._id), record);
      });

      const productLeaderboard = productSales.map((entry) => {
        const workspaceId = String(entry._id?.workspaceId || '');
        const storeId = entry._id?.storeId ? String(entry._id.storeId) : null;
        const productId = String(entry._id?.productId || '');
        const storeProduct = soldStoreProductsById.get(productId);
        const linkedProduct = storeProduct?.linkedProductId
          ? linkedProductsById.get(String(storeProduct.linkedProductId))
          : null;
        const relatedStore = boutiqueRecordMap.get(storeKey(workspaceId, storeId));
        const averageSellingPrice = Number(entry.avgUnitPrice || storeProduct?.price || 0);
        const estimatedUnitCost = linkedProduct
          ? Number(linkedProduct.productCost || 0) + Number(linkedProduct.deliveryCost || 0)
          : Math.max(0, Math.floor(averageSellingPrice * 0.4));
        const estimatedUnitProfit = Math.max(0, averageSellingPrice - estimatedUnitCost);
        const unitsSold = Number(entry.unitsSold || 0);
        const profitEstimate = estimatedUnitProfit * unitsSold;
        const revenue = Number(entry.revenue || 0);
        const marginPercentEstimate = averageSellingPrice > 0
          ? Math.round((estimatedUnitProfit / averageSellingPrice) * 1000) / 10
          : 0;

        return {
          workspaceId,
          storeId,
          storeKey: storeKey(workspaceId, storeId),
          workspaceName: relatedStore?.workspaceName || '',
          storeName: relatedStore?.name || 'Boutique inconnue',
          storeUrl: relatedStore?.url || '',
          subdomain: relatedStore?.subdomain || '',
          currency: storeProduct?.currency || relatedStore?.currency || 'XAF',
          productId,
          linkedProductId: storeProduct?.linkedProductId ? String(storeProduct.linkedProductId) : null,
          name: storeProduct?.name || `Produit ${productId}`,
          slug: storeProduct?.slug || '',
          url: relatedStore?.subdomain && storeProduct?.slug
            ? `https://${relatedStore.subdomain}.scalor.net/product/${storeProduct.slug}`
            : '',
          image: Array.isArray(storeProduct?.images) && storeProduct.images[0]?.url ? storeProduct.images[0].url : '',
          isPublished: storeProduct?.isPublished === true,
          ordersCount: Number(entry.ordersCount || 0),
          unitsSold,
          revenue,
          averageSellingPrice,
          estimatedUnitProfit,
          estimatedUnitCost,
          profitEstimate,
          marginPercentEstimate,
          profitSource: linkedProduct ? 'linked-product' : 'inferred-40pct-cost',
          compareAtPrice: Number(storeProduct?.compareAtPrice || 0),
          lastOrderAt: entry.lastOrderAt || null,
        };
      }).sort((left, right) => {
        const profitDiff = (right.profitEstimate || 0) - (left.profitEstimate || 0);
        if (profitDiff !== 0) return profitDiff;
        const revenueDiff = (right.revenue || 0) - (left.revenue || 0);
        if (revenueDiff !== 0) return revenueDiff;
        return (right.unitsSold || 0) - (left.unitsSold || 0);
      });

      const productsByStoreKey = new Map();
      productLeaderboard.forEach((product) => {
        if (!productsByStoreKey.has(product.storeKey)) productsByStoreKey.set(product.storeKey, []);
        productsByStoreKey.get(product.storeKey).push(product);
      });

      const storeLeaderboard = boutiqueRecords.map((record) => {
        const rankedProducts = productsByStoreKey.get(storeKey(record.workspaceId, record.isLegacyStore ? null : record._id)) || [];
        const unitsSold = rankedProducts.reduce((sum, product) => sum + (product.unitsSold || 0), 0);
        const estimatedProfit = rankedProducts.reduce((sum, product) => sum + (product.profitEstimate || 0), 0);
        const averageOrderValue = (record.totalOrders || 0) > 0 ? (record.totalRevenue || 0) / record.totalOrders : 0;
        const estimatedMarginPercent = (record.totalRevenue || 0) > 0
          ? Math.round((estimatedProfit / record.totalRevenue) * 1000) / 10
          : 0;

        return {
          ...record,
          unitsSold,
          estimatedProfit,
          averageOrderValue,
          estimatedMarginPercent,
          topProducts: rankedProducts.slice(0, 5),
          topProductCount: rankedProducts.length,
        };
      }).sort((left, right) => {
        const profitDiff = (right.estimatedProfit || 0) - (left.estimatedProfit || 0);
        if (profitDiff !== 0) return profitDiff;
        const revenueDiff = (right.totalRevenue || 0) - (left.totalRevenue || 0);
        if (revenueDiff !== 0) return revenueDiff;
        return (right.totalOrders || 0) - (left.totalOrders || 0);
      });

      const activityByUser = new Map();
      storeLeaderboard.forEach((record) => {
        if (!record.attributedUserId) return;
        if (!activityByUser.has(record.attributedUserId)) activityByUser.set(record.attributedUserId, []);
        activityByUser.get(record.attributedUserId).push(record);
      });

      const boutiqueActivity = Array.from(activityByUser.entries()).map(([userId, userStores]) => {
        const user = usersById.get(userId);
        const workspaceCount = new Set(userStores.map((store) => String(store.workspaceId))).size;
        const totals = userStores.reduce((accumulator, store) => ({
          boutiqueCount: accumulator.boutiqueCount + 1,
          totalOrders: accumulator.totalOrders + (store.totalOrders || 0),
          totalRevenue: accumulator.totalRevenue + (store.totalRevenue || 0),
          totalProducts: accumulator.totalProducts + (store.totalProducts || 0),
          publishedProducts: accumulator.publishedProducts + (store.publishedProducts || 0),
          unitsSold: accumulator.unitsSold + (store.unitsSold || 0),
          estimatedProfit: accumulator.estimatedProfit + (store.estimatedProfit || 0),
        }), {
          boutiqueCount: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalProducts: 0,
          publishedProducts: 0,
          unitsSold: 0,
          estimatedProfit: 0,
        });

        const averageOrderValue = totals.totalOrders > 0 ? totals.totalRevenue / totals.totalOrders : 0;
        const estimatedMarginPercent = totals.totalRevenue > 0
          ? Math.round((totals.estimatedProfit / totals.totalRevenue) * 1000) / 10
          : 0;

        return {
          userId,
          email: user?.email || '',
          name: user?.name || '',
          role: user?.role || null,
          isActive: user?.isActive !== false,
          createdAt: user?.createdAt || null,
          lastLogin: user?.lastLogin || null,
          workspaceCount,
          ...totals,
          averageOrderValue,
          estimatedMarginPercent,
          stores: userStores.sort((left, right) => {
            const profitDiff = (right.estimatedProfit || 0) - (left.estimatedProfit || 0);
            if (profitDiff !== 0) return profitDiff;
            const revenueDiff = (right.totalRevenue || 0) - (left.totalRevenue || 0);
            if (revenueDiff !== 0) return revenueDiff;
            return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
          }),
        };
      }).filter((user) => user.boutiqueCount > 0).sort((left, right) => {
        const profitDiff = (right.estimatedProfit || 0) - (left.estimatedProfit || 0);
        if (profitDiff !== 0) return profitDiff;
        const boutiqueDiff = (right.boutiqueCount || 0) - (left.boutiqueCount || 0);
        if (boutiqueDiff !== 0) return boutiqueDiff;
        const revenueDiff = (right.totalRevenue || 0) - (left.totalRevenue || 0);
        if (revenueDiff !== 0) return revenueDiff;
        return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
      });

      const boutiqueTotals = boutiqueActivity.reduce((accumulator, user) => ({
        usersWithBoutiques: accumulator.usersWithBoutiques + (user.boutiqueCount > 0 ? 1 : 0),
        totalBoutiques: accumulator.totalBoutiques + (user.boutiqueCount || 0),
        totalOrders: accumulator.totalOrders + (user.totalOrders || 0),
        totalRevenue: accumulator.totalRevenue + (user.totalRevenue || 0),
        totalProducts: accumulator.totalProducts + (user.totalProducts || 0),
        totalUnitsSold: accumulator.totalUnitsSold + (user.unitsSold || 0),
        totalEstimatedProfit: accumulator.totalEstimatedProfit + (user.estimatedProfit || 0),
      }), {
        usersWithBoutiques: 0,
        totalBoutiques: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalProducts: 0,
        totalUnitsSold: 0,
        totalEstimatedProfit: 0,
      });

      res.json({
        success: true,
        data: {
          recentLogins,
          totalLogins,
          activeByRole,
          noWorkspace,
          inactiveWorkspaces,
          totalWorkspaces,
          boutiqueActivity,
          boutiqueTotals,
          storeLeaderboard,
          productLeaderboard,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalLogins,
            pages: Math.max(1, Math.ceil(totalLogins / parseInt(limit)))
          }
        }
      });
    } catch (error) {
      console.error('Analytics users-activity error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/product-leaderboard
// Heavy product-level sales data, loaded lazily by the Activity page
// ──────────────────────────────────────────────────────────
router.get('/product-leaderboard',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      const productSales = await StoreOrder.aggregate([
        { $match: { 'products.0': { $exists: true }, createdAt: { $gte: cutoff } } },
        { $unwind: '$products' },
        { $match: { 'products.productId': { $ne: null } } },
        {
          $group: {
            _id: {
              workspaceId: '$workspaceId',
              storeId: '$storeId',
              productId: '$products.productId',
            },
            ordersCount: { $sum: 1 },
            unitsSold: { $sum: { $ifNull: ['$products.quantity', 1] } },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ['$products.price', 0] },
                  { $ifNull: ['$products.quantity', 1] }
                ]
              }
            },
            avgUnitPrice: { $avg: { $ifNull: ['$products.price', 0] } },
            lastOrderAt: { $max: '$createdAt' },
          }
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 200 },
      ]);

      const soldProductIds = [...new Set(productSales.map(e => String(e._id?.productId || '')).filter(Boolean))];
      const soldStoreProducts = soldProductIds.length > 0
        ? await StoreProduct.find({ _id: { $in: soldProductIds } }, {
            _id: 1, workspaceId: 1, storeId: 1, name: 1, slug: 1,
            price: 1, compareAtPrice: 1, currency: 1, linkedProductId: 1, isPublished: 1, images: 1,
          }).lean()
        : [];

      const linkedProductIds = [...new Set(soldStoreProducts.map(p => String(p.linkedProductId || '')).filter(Boolean))];
      const linkedProducts = linkedProductIds.length > 0
        ? await Product.find({ _id: { $in: linkedProductIds } }, { _id: 1, sellingPrice: 1, productCost: 1, deliveryCost: 1, avgAdsCost: 1 }).lean()
        : [];

      // Gather store/workspace info needed for display
      const [stores, workspaces] = await Promise.all([
        Store.find({}, { workspaceId: 1, name: 1, subdomain: 1, storeSettings: 1 }).limit(5000).lean(),
        Workspace.find({}, { name: 1, subdomain: 1, storeSettings: 1 }).limit(5000).lean(),
      ]);

      const storeKey = (wid, sid) => `${String(wid || '')}:${String(sid || 'legacy')}`;
      const workspacesById = new Map(workspaces.map(w => [String(w._id), w]));
      const storeInfoMap = new Map();
      stores.forEach(s => {
        const ws = workspacesById.get(String(s.workspaceId));
        const sub = s.subdomain || ws?.subdomain || '';
        storeInfoMap.set(storeKey(s.workspaceId, s._id), {
          name: s.storeSettings?.storeName || s.name || ws?.name || '',
          subdomain: sub,
          url: sub ? `https://${sub}.scalor.net` : '',
          currency: s.storeSettings?.storeCurrency || ws?.storeSettings?.storeCurrency || 'XAF',
          workspaceName: ws?.name || '',
        });
      });

      const soldStoreProductsById = new Map(soldStoreProducts.map(p => [String(p._id), p]));
      const linkedProductsById = new Map(linkedProducts.map(p => [String(p._id), p]));

      const leaderboard = productSales.map(entry => {
        const workspaceId = String(entry._id?.workspaceId || '');
        const storeId = entry._id?.storeId ? String(entry._id.storeId) : null;
        const productId = String(entry._id?.productId || '');
        const storeProduct = soldStoreProductsById.get(productId);
        const linkedProduct = storeProduct?.linkedProductId ? linkedProductsById.get(String(storeProduct.linkedProductId)) : null;
        const storeInfo = storeInfoMap.get(storeKey(workspaceId, storeId)) || {};
        const averageSellingPrice = Number(entry.avgUnitPrice || storeProduct?.price || 0);
        const estimatedUnitCost = linkedProduct
          ? Number(linkedProduct.productCost || 0) + Number(linkedProduct.deliveryCost || 0)
          : Math.max(0, Math.floor(averageSellingPrice * 0.4));
        const estimatedUnitProfit = Math.max(0, averageSellingPrice - estimatedUnitCost);
        const unitsSold = Number(entry.unitsSold || 0);
        const revenue = Number(entry.revenue || 0);
        const marginPercentEstimate = averageSellingPrice > 0
          ? Math.round((estimatedUnitProfit / averageSellingPrice) * 1000) / 10 : 0;

        return {
          workspaceId, storeId,
          storeKey: storeKey(workspaceId, storeId),
          workspaceName: storeInfo.workspaceName || '',
          storeName: storeInfo.name || 'Boutique inconnue',
          storeUrl: storeInfo.url || '',
          subdomain: storeInfo.subdomain || '',
          currency: storeProduct?.currency || storeInfo.currency || 'XAF',
          productId,
          linkedProductId: storeProduct?.linkedProductId ? String(storeProduct.linkedProductId) : null,
          name: storeProduct?.name || `Produit ${productId}`,
          slug: storeProduct?.slug || '',
          url: storeInfo.subdomain && storeProduct?.slug ? `https://${storeInfo.subdomain}.scalor.net/product/${storeProduct.slug}` : '',
          image: Array.isArray(storeProduct?.images) && storeProduct.images[0]?.url ? storeProduct.images[0].url : '',
          isPublished: storeProduct?.isPublished === true,
          ordersCount: Number(entry.ordersCount || 0),
          unitsSold,
          revenue,
          averageSellingPrice,
          estimatedUnitProfit,
          estimatedUnitCost,
          profitEstimate: estimatedUnitProfit * unitsSold,
          marginPercentEstimate,
          profitSource: linkedProduct ? 'linked-product' : 'inferred-40pct-cost',
          compareAtPrice: Number(storeProduct?.compareAtPrice || 0),
          lastOrderAt: entry.lastOrderAt || null,
        };
      }).sort((a, b) => (b.unitsSold || 0) - (a.unitsSold || 0));

      res.json({ success: true, data: { productLeaderboard: leaderboard } });
    } catch (error) {
      console.error('Analytics product-leaderboard error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ──────────────────────────────────────────────────────────
// GET /api/ecom/analytics/user-flow
// User journey: most common page sequences
// ──────────────────────────────────────────────────────────
router.get('/user-flow',
  requireEcomAuth,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { range = '30d', startDate, endDate } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);

      // Get sessions with their page visit sequences
      const flows = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, pageViews: { $gte: 2 } } },
        {
          $project: {
            path: {
              $reduce: {
                input: '$pagesVisited',
                initialValue: '',
                in: {
                  $cond: [
                    { $eq: ['$$value', ''] },
                    '$$this',
                    { $concat: ['$$value', ' → ', '$$this'] }
                  ]
                }
              }
            }
          }
        },
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ]);

      // Entry → Exit patterns
      const entryExitPatterns = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since, $lte: until }, entryPage: { $ne: null }, exitPage: { $ne: null } } },
        {
          $group: {
            _id: { entry: '$entryPage', exit: '$exitPage' },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
        {
          $project: {
            entry: '$_id.entry',
            exit: '$_id.exit',
            count: 1
          }
        }
      ]);

      res.json({
        success: true,
        data: { flows, entryExitPatterns }
      });
    } catch (error) {
      console.error('Analytics user-flow error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
