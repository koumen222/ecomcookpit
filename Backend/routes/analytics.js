import express from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import AnalyticsSession from '../models/AnalyticsSession.js';
import EcomUser from '../models/EcomUser.js';
import Store from '../models/Store.js';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
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

    // Validate ObjectIds to avoid Mongoose CastError → 500
    const isObjectId = (v) => v && /^[a-f\d]{24}$/i.test(String(v));

    // Create event
    await AnalyticsEvent.create({
      userId: isObjectId(userId) ? userId : null,
      sessionId,
      eventType: safeEventType,
      page: page || null,
      referrer: referrer || null,
      workspaceId: isObjectId(workspaceId) ? workspaceId : null,
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
          userId: userId || null,
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
      if (userId && !session.userId) updates.userId = userId;
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
      const { range = '30d', startDate, endDate, page = 1, limit = 50 } = req.query;
      const { since, until } = dateFilter(range, startDate, endDate);
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Recent logins from AnalyticsEvent
      let recentLogins = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, eventType: 'login' } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
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
            date: '$createdAt',
            email: '$user.email',
            name: '$user.name',
            role: '$user.role',
            workspaceId: '$user.workspaceId',
            country: 1,
            city: 1,
            device: 1,
            browser: 1
          }
        }
      ]);

      let totalLogins = await AnalyticsEvent.countDocuments({
        createdAt: { $gte: since, $lte: until },
        eventType: 'login'
      });

      // ── Fallback: si aucun event login, utiliser EcomUser.lastLogin ──
      if (recentLogins.length === 0) {
        const fallbackUsers = await EcomUser.find(
          { lastLogin: { $gte: since, $lte: until } },
          { email: 1, name: 1, role: 1, workspaceId: 1, lastLogin: 1, createdAt: 1 }
        ).sort({ lastLogin: -1 }).skip(skip).limit(parseInt(limit)).lean();

        recentLogins = fallbackUsers.map(u => ({
          _id: u._id,
          date: u.lastLogin || u.createdAt,
          email: u.email,
          name: u.name,
          role: u.role,
          workspaceId: u.workspaceId,
          country: null,
          city: null,
          device: null,
          browser: null
        }));
        totalLogins = await EcomUser.countDocuments({ lastLogin: { $gte: since, $lte: until } });

        // Second fallback: tous les users créés dans la période
        if (recentLogins.length === 0) {
          const newUsers = await EcomUser.find(
            { createdAt: { $gte: since, $lte: until } },
            { email: 1, name: 1, role: 1, workspaceId: 1, createdAt: 1 }
          ).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean();

          recentLogins = newUsers.map(u => ({
            _id: u._id,
            date: u.createdAt,
            email: u.email,
            name: u.name,
            role: u.role,
            workspaceId: u.workspaceId,
            country: null,
            city: null,
            device: null,
            browser: null
          }));
          totalLogins = await EcomUser.countDocuments({ createdAt: { $gte: since, $lte: until } });
        }
      }

      // Active by role — fallback sur EcomUser si AnalyticsEvent vide
      let activeByRole = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since, $lte: until }, userId: { $ne: null } } },
        {
          $lookup: {
            from: 'ecom_users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $group: {
            _id: '$user.role',
            users: { $addToSet: '$userId' }
          }
        },
        {
          $project: {
            role: '$_id',
            count: { $size: '$users' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      if (activeByRole.length === 0) {
        activeByRole = await EcomUser.aggregate([
          { $match: { role: { $ne: null } } },
          { $group: { _id: '$role', count: { $sum: 1 } } },
          { $project: { role: '$_id', count: 1 } },
          { $sort: { count: -1 } }
        ]);
      }

      // Users without workspace
      const noWorkspace = await EcomUser.countDocuments({ workspaceId: null });

      // Inactive workspaces
      const activeWorkspaceIds = await AnalyticsEvent.distinct('workspaceId', {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        workspaceId: { $ne: null }
      });
      const totalWorkspaces = await Workspace.countDocuments();
      const inactiveWorkspaces = Math.max(0, totalWorkspaces - activeWorkspaceIds.length);

      // ── Store activity by user (all-time business metrics) ──
      const [users, workspaces, stores, orderStats, productStats] = await Promise.all([
        EcomUser.find({}, {
          email: 1,
          name: 1,
          role: 1,
          workspaceId: 1,
          workspaces: 1,
          isActive: 1,
          lastLogin: 1,
          createdAt: 1,
        }).lean(),
        Workspace.find({}, {
          name: 1,
          slug: 1,
          owner: 1,
          subdomain: 1,
          primaryStoreId: 1,
          createdAt: 1,
          storeSettings: 1,
          isActive: 1,
        }).lean(),
        Store.find({}, {
          workspaceId: 1,
          name: 1,
          subdomain: 1,
          createdBy: 1,
          createdAt: 1,
          isActive: 1,
          storeSettings: 1,
        }).lean(),
        StoreOrder.aggregate([
          {
            $group: {
              _id: {
                workspaceId: '$workspaceId',
                storeId: '$storeId',
              },
              totalOrders: { $sum: 1 },
              totalRevenue: { $sum: { $ifNull: ['$total', 0] } },
              lastOrderAt: { $max: '$createdAt' },
            }
          }
        ]),
        StoreProduct.aggregate([
          {
            $group: {
              _id: {
                workspaceId: '$workspaceId',
                storeId: '$storeId',
              },
              totalProducts: { $sum: 1 },
              publishedProducts: {
                $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
              },
              lastProductAt: { $max: '$createdAt' },
              productNames: { $push: '$name' },
              productSlugs: { $push: '$slug' },
            }
          }
        ]),
      ]);

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

        boutiqueRecords.push({
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
        });
      });

      workspaces.forEach((workspace) => {
        const workspaceHasStore = (storesByWorkspace.get(String(workspace._id)) || []).length > 0;
        if (workspaceHasStore || !workspace.subdomain) return;

        const legacyKey = storeKey(workspace._id, null);
        const legacyOrders = orderStatsMap.get(legacyKey);
        const legacyProducts = productStatsMap.get(legacyKey);
        const attributedUserId = String(workspace.owner || '');

        boutiqueRecords.push({
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
        });
      });

      const activityByUser = new Map();
      boutiqueRecords.forEach((record) => {
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
        }), {
          boutiqueCount: 0,
          totalOrders: 0,
          totalRevenue: 0,
          totalProducts: 0,
          publishedProducts: 0,
        });

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
          stores: userStores.sort((left, right) => {
            const revenueDiff = (right.totalRevenue || 0) - (left.totalRevenue || 0);
            if (revenueDiff !== 0) return revenueDiff;
            return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
          }),
        };
      }).filter((user) => user.boutiqueCount > 0).sort((left, right) => {
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
      }), {
        usersWithBoutiques: 0,
        totalBoutiques: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalProducts: 0,
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
