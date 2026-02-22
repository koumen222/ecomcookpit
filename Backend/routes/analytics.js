import express from 'express';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import AnalyticsSession from '../models/AnalyticsSession.js';
import EcomUser from '../models/EcomUser.js';
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
// ──────────────────────────────────────────────────────────
function dateFilter(range = '30d') {
  const now = new Date();
  const ms = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  const delta = ms[range] || ms['30d'];
  return new Date(now.getTime() - delta);
}

// ──────────────────────────────────────────────────────────
// POST /api/ecom/analytics/track
// Public endpoint for tracking events from the frontend
// ──────────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  try {
    const { sessionId, eventType, page, referrer, meta, userId, workspaceId, userRole } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, message: 'sessionId and eventType required' });
    }

    const ua = req.headers['user-agent'] || '';
    const { device, browser, os } = parseUserAgent(ua);

    // Geo from headers (set by reverse proxy / Cloudflare)
    const country = req.headers['cf-ipcountry'] || req.headers['x-country'] || null;
    const city = req.headers['cf-ipcity'] || req.headers['x-city'] || null;

    // Create event
    await AnalyticsEvent.create({
      userId: userId || null,
      sessionId,
      eventType,
      page: page || null,
      referrer: referrer || null,
      workspaceId: workspaceId || null,
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
    const session = await AnalyticsSession.findOne({ sessionId });
    if (!session) {
      await AnalyticsSession.create({
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
    } else {
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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      // Sessions & page views
      const [sessionStats] = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since } } },
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
      const signups = await EcomUser.countDocuments({ createdAt: { $gte: since } });

      // Active users with workspace
      const activatedUsers = await EcomUser.countDocuments({
        createdAt: { $gte: since },
        workspaceId: { $ne: null }
      });

      // Workspaces created
      const workspacesCreated = await Workspace.countDocuments({ createdAt: { $gte: since } });

      // DAU / WAU / MAU
      const now = new Date();
      const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day1 }, userId: { $ne: null } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const [wauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day7 }, userId: { $ne: null } } },
        { $group: { _id: null, users: { $addToSet: '$userId' } } }
      ]);
      const [mauResult] = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: day30 }, userId: { $ne: null } } },
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
        { $match: { startedAt: { $gte: since } } },
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
        { $match: { createdAt: { $gte: since } } },
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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      // 1. Unique visitors (sessions)
      const [visitorsResult] = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since } } },
        { $group: { _id: null, count: { $sum: 1 } } }
      ]);
      const visitors = visitorsResult?.count || 0;

      // 2. Accounts created
      const accountsCreated = await EcomUser.countDocuments({ createdAt: { $gte: since } });

      // 3. Email verified (users who logged in at least once = verified)
      const emailVerified = await EcomUser.countDocuments({
        createdAt: { $gte: since },
        lastLogin: { $ne: null }
      });

      // 4. Joined a workspace
      const joinedWorkspace = await EcomUser.countDocuments({
        createdAt: { $gte: since },
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
            createdAt: { $gte: since },
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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      // By device
      const byDevice = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since } } },
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
        { $match: { startedAt: { $gte: since } } },
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
        { $match: { startedAt: { $gte: since } } },
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
        { $match: { startedAt: { $gte: since } } },
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
        { $match: { startedAt: { $gte: since }, referrer: { $ne: null } } },
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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      const countries = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since }, country: { $ne: null } } },
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

      // Signups by country
      const signupsByCountry = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: 'signup_completed', country: { $ne: null } } },
        { $group: { _id: '$country', signups: { $sum: 1 } } }
      ]);

      const signupMap = {};
      signupsByCountry.forEach(s => { signupMap[s._id] = s.signups; });

      const result = countries.map(c => ({
        ...c,
        signups: signupMap[c.country] || 0,
        conversionRate: c.sessions > 0
          ? Math.round(((signupMap[c.country] || 0) / c.sessions) * 100)
          : 0
      }));

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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      const pages = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: 'page_view', page: { $ne: null } } },
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
        { $match: { startedAt: { $gte: since }, exitPage: { $ne: null } } },
        { $group: { _id: '$exitPage', exits: { $sum: 1 } } }
      ]);
      const exitMap = {};
      exitPages.forEach(e => { exitMap[e._id] = e.exits; });

      // Entry pages
      const entryPages = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since }, entryPage: { $ne: null } } },
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
      const { range = '30d', page = 1, limit = 50 } = req.query;
      const since = dateFilter(range);
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Recent logins
      const recentLogins = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since }, eventType: 'login' } },
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
            role: '$user.role',
            workspaceId: '$user.workspaceId',
            country: 1,
            city: 1,
            device: 1,
            browser: 1
          }
        }
      ]);

      const totalLogins = await AnalyticsEvent.countDocuments({
        createdAt: { $gte: since },
        eventType: 'login'
      });

      // Active by role
      const activeByRole = await AnalyticsEvent.aggregate([
        { $match: { createdAt: { $gte: since }, userId: { $ne: null } } },
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

      // Users without workspace
      const noWorkspace = await EcomUser.countDocuments({ workspaceId: null });

      // Inactive workspaces (no event from any member in 30 days)
      const activeWorkspaceIds = await AnalyticsEvent.distinct('workspaceId', {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        workspaceId: { $ne: null }
      });
      const totalWorkspaces = await Workspace.countDocuments();
      const inactiveWorkspaces = totalWorkspaces - activeWorkspaceIds.length;

      res.json({
        success: true,
        data: {
          recentLogins,
          totalLogins,
          activeByRole,
          noWorkspace,
          inactiveWorkspaces,
          totalWorkspaces,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalLogins,
            pages: Math.ceil(totalLogins / parseInt(limit))
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
      const { range = '30d' } = req.query;
      const since = dateFilter(range);

      // Get sessions with their page visit sequences
      const flows = await AnalyticsSession.aggregate([
        { $match: { startedAt: { $gte: since }, pageViews: { $gte: 2 } } },
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
        { $match: { startedAt: { $gte: since }, entryPage: { $ne: null }, exitPage: { $ne: null } } },
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
