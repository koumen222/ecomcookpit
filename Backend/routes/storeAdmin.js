import express from 'express';
import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreAnalytics from '../models/StoreAnalytics.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { emitThemeUpdate } from '../services/socketService.js';

const router = express.Router();
const DEBUG_TAG = '[StoreAdmin:Settings]';

function summarizeStoreSettingsPayload(payload = {}) {
  const logoValue = payload.logo || '';
  const faviconValue = payload.favicon || '';
  const safePayload = { ...payload };

  if (safePayload.logo) {
    safePayload.logo = `[len:${String(logoValue).length}] ${String(logoValue).slice(0, 100)}`;
  }
  if (safePayload.favicon) {
    safePayload.favicon = `[len:${String(faviconValue).length}] ${String(faviconValue).slice(0, 100)}`;
  }

  return {
    keys: Object.keys(payload || {}),
    logoLength: String(logoValue).length,
    faviconLength: String(faviconValue).length,
    logoIsDataUrl: String(logoValue).startsWith('data:'),
    faviconIsDataUrl: String(faviconValue).startsWith('data:'),
    payloadBytes: Buffer.byteLength(JSON.stringify(payload || {}), 'utf8'),
    payloadPreview: safePayload,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE ADMIN ROUTES — Boutique configuration endpoints
// Mounted at: /api/ecom/store
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ANALYTICS ─────────────────────────────────────────────────────────────────

router.get('/analytics/summary', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;

    // Get stats from StoreOrder using the built-in getQuickStats method
    const [orderStats, productCount] = await Promise.all([
      StoreOrder.getQuickStats(workspaceId),
      StoreProduct.countDocuments({ workspaceId })
    ]);

    // Parse the aggregation result
    const stats = orderStats && orderStats.length > 0 ? orderStats[0] : {
      totalOrders: 0,
      totalRevenue: 0,
      byStatus: []
    };

    // Calculate today's sales (orders created today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStats = await StoreOrder.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          todayOrders: { $sum: 1 },
          todaySales: { $sum: '$total' }
        }
      },
      { $project: { _id: 0 } }
    ]);

    const todayData = todayStats && todayStats.length > 0 ? todayStats[0] : { todayOrders: 0, todaySales: 0 };

    // Calculate conversion rate: unique visitors (StoreAnalytics) vs orders (StoreOrder)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const wsIdStr = workspaceId.toString();
    const [uniqueVisitorIds, uniqueSessionIds, recentOrderCount] = await Promise.all([
      StoreAnalytics.distinct('visitorId', {
        workspaceId: wsIdStr,
        visitorId: { $ne: '' },
        timestamp: { $gte: thirtyDaysAgo }
      }),
      StoreAnalytics.distinct('sessionId', {
        workspaceId: wsIdStr,
        visitorId: '',
        timestamp: { $gte: thirtyDaysAgo }
      }),
      StoreOrder.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        createdAt: { $gte: thirtyDaysAgo }
      })
    ]);
    const totalUniqueVisitors = uniqueVisitorIds.length + uniqueSessionIds.length;
    const conversionRate = totalUniqueVisitors > 0
      ? (recentOrderCount / totalUniqueVisitors)
      : 0;

    res.json({
      success: true,
      data: {
        totalOrders: stats.totalOrders || 0,
        totalRevenue: stats.totalRevenue || 0,
        todayOrders: todayData.todayOrders || 0,
        todaySales: todayData.todaySales || 0,
        totalProducts: productCount,
        byStatus: stats.byStatus || [],
        conversionRate,
        totalVisitors: totalUniqueVisitors,
      }
    });
  } catch (error) {
    console.error('Error GET /store/analytics/summary:', error);
    res.status(500).json({ success: false, message: 'Error loading analytics' });
  }
});

// ─── ORDERS ────────────────────────────────────────────────────────────────────

router.get('/orders', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { limit = 20, page = 1, sort = '-createdAt' } = req.query;

    const orders = await StoreOrder.findPaginated(
      { workspaceId },
      { page: parseInt(page), limit: parseInt(limit), sort: { createdAt: -1 } }
    );

    res.json({
      success: true,
      data: {
        orders
      }
    });
  } catch (error) {
    console.error('Error GET /store/orders:', error);
    res.status(500).json({ success: false, message: 'Error loading orders' });
  }
});

// ─── THEME ─────────────────────────────────────────────────────────────────────

router.get('/theme', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storeTheme')
      .lean();

    res.json({
      success: true,
      data: workspace?.storeTheme || {}
    });
  } catch (error) {
    console.error('Error GET /store/theme:', error);
    res.status(500).json({ success: false, message: 'Error loading theme' });
  }
});

router.put('/theme', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('🎨 PUT /store/theme - workspaceId:', req.workspaceId);

    const updated = await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storeTheme: req.body } },
      { new: true }
    ).select('subdomain');

    // Broadcast to all live visitors of this store
    if (updated?.subdomain) {
      emitThemeUpdate(updated.subdomain, req.body);
    }

    console.log('✅ Theme updated + broadcasted to store:', updated?.subdomain);
    res.json({ success: true, message: 'Theme updated' });
  } catch (error) {
    console.error('❌ Error PUT /store/theme:', error.message);
    res.status(500).json({ success: false, message: 'Error saving theme' });
  }
});

// ─── PAGES ─────────────────────────────────────────────────────────────────────

router.get('/pages', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePages')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePages || {}
    });
  } catch (error) {
    console.error('Error GET /store/pages:', error);
    res.status(500).json({ success: false, message: 'Error loading pages' });
  }
});

router.put('/pages', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('📄 PUT /store/pages - workspaceId:', req.workspaceId);
    console.log('📄 Request body:', JSON.stringify(req.body, null, 2));
    
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePages: req.body } },
      { new: true }
    );

    console.log('✅ Pages updated successfully');
    res.json({
      success: true,
      message: 'Pages updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/pages:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving pages' });
  }
});

// ─── PIXELS ────────────────────────────────────────────────────────────────────

router.get('/pixels', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePixels')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePixels || {}
    });
  } catch (error) {
    console.error('Error GET /store/pixels:', error);
    res.status(500).json({ success: false, message: 'Error loading pixels' });
  }
});

router.put('/pixels', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('📊 PUT /store/pixels - workspaceId:', req.workspaceId);
    console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
    
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePixels: req.body } },
      { new: true }
    );

    console.log('✅ Pixels updated successfully');
    res.json({
      success: true,
      message: 'Pixels updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/pixels:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving pixels' });
  }
});

// ─── PAYMENTS ──────────────────────────────────────────────────────────────────

router.get('/payments', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePayments')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePayments || {}
    });
  } catch (error) {
    console.error('Error GET /store/payments:', error);
    res.status(500).json({ success: false, message: 'Error loading payments' });
  }
});

router.put('/payments', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePayments: req.body } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payments updated'
    });
  } catch (error) {
    console.error('Error PUT /store/payments:', error);
    res.status(500).json({ success: false, message: 'Error saving payments' });
  }
});

// ─── DOMAINS ───────────────────────────────────────────────────────────────────

router.get('/domains', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('subdomain storeDomains')
      .lean();

    res.json({
      success: true,
      data: {
        subdomain: workspace?.subdomain || '',
        customDomain: workspace?.storeDomains?.customDomain || '',
        sslStatus: workspace?.storeDomains?.sslStatus || 'none'
      }
    });
  } catch (error) {
    console.error('Error GET /store/domains:', error);
    res.status(500).json({ success: false, message: 'Error loading domains' });
  }
});

router.put('/domains', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    let { subdomain, customDomain } = req.body;

    console.log('🌐 PUT /store/domains - workspaceId:', req.workspaceId);
    console.log('🌐 Request body:', { subdomain, customDomain });

    const update = {};

    if (subdomain !== undefined) {
      // Sanitize
      subdomain = String(subdomain || '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');

      if (subdomain && subdomain.length < 3) {
        return res.status(400).json({ success: false, message: 'Le sous-domaine doit contenir au moins 3 caractères' });
      }

      const RESERVED = ['www','api','app','admin','dashboard','mail','ftp','store','shop','scalor','help','support','docs','blog','static','cdn','assets','dev','staging','test'];
      if (RESERVED.includes(subdomain)) {
        return res.status(400).json({ success: false, message: 'Ce sous-domaine est réservé' });
      }

      // Check uniqueness
      if (subdomain) {
        const existing = await Workspace.findOne({ subdomain, _id: { $ne: req.workspaceId } }).select('_id').lean();
        if (existing) {
          return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà pris' });
        }
      }

      update.subdomain = subdomain || null;

      // Auto-enable store when a subdomain is set
      if (subdomain) {
        update['storeSettings.isStoreEnabled'] = true;
      }
    }

    if (customDomain !== undefined) update['storeDomains.customDomain'] = customDomain;

    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: update },
      { new: true }
    );

    console.log('✅ Domains updated successfully');
    res.json({
      success: true,
      message: 'Domains updated'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà pris' });
    }
    console.error('❌ Error PUT /store/domains:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving domains' });
  }
});

router.post('/domains/check-dns', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ success: false, message: 'Domain required' });
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    // Railway target — customers should CNAME to this
    const CNAME_TARGET = process.env.RAILWAY_DOMAIN || 'ecomcookpit-production-0ec4.up.railway.app';
    // Accepted IPs: VPS (Caddy proxy) + Railway + Cloudflare proxy for shops.scalor.net
    const VPS_IP = process.env.CUSTOM_DOMAIN_VPS_IP || '45.76.27.120';
    const baseIps = '151.101.2.15,104.21.75.212,172.67.182.57';
    const ACCEPTED_IPS = (process.env.ACCEPTED_DNS_IPS || `${VPS_IP},${baseIps}`).split(',').map(s => s.trim()).filter(Boolean);

    const dns = await import('dns');
    const dnsPromises = dns.promises;

    const results = { aRecords: [], cnameRecords: [], aOk: false, cnameOk: false };

    // Check A records
    try {
      results.aRecords = await dnsPromises.resolve4(cleanDomain);
      results.aOk = results.aRecords.some(ip => ACCEPTED_IPS.includes(ip));
    } catch { /* ENODATA or ENOTFOUND — no A record */ }

    // Check CNAME records
    try {
      results.cnameRecords = await dnsPromises.resolveCname(cleanDomain);
      results.cnameOk = results.cnameRecords.some(cname => {
        const c = cname.toLowerCase().replace(/\.$/, '');
        return c === CNAME_TARGET || c.endsWith('.scalor.net') || c.endsWith('.railway.app');
      });
    } catch { /* ENODATA or ENOTFOUND — no CNAME record */ }

    const ok = results.aOk || results.cnameOk;

    // If DNS is OK, update SSL status
    if (ok) {
      await Workspace.findByIdAndUpdate(req.workspaceId, {
        $set: { 'storeDomains.sslStatus': 'active', 'storeDomains.dnsVerified': true }
      });
    }

    res.json({
      success: true,
      data: {
        ok,
        aRecords: results.aRecords,
        cnameRecords: results.cnameRecords,
        aOk: results.aOk,
        cnameOk: results.cnameOk,
        expected: {
          cnameTarget: CNAME_TARGET,
          acceptedIps: ACCEPTED_IPS
        }
      }
    });
  } catch (error) {
    console.error('Error POST /store/domains/check-dns:', error);
    res.status(500).json({ success: false, message: 'Error checking DNS' });
  }
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────────

router.get('/settings', requireEcomAuth, requireWorkspace, async (req, res) => {
  const startedAt = Date.now();
  console.log(`${DEBUG_TAG} GET start`, {
    workspaceId: req.workspaceId,
    userId: req.user?.id || req.user?._id || null,
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    requestId: req.headers['x-request-id'] || null,
    cfRay: req.headers['cf-ray'] || null,
  });

  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storeSettings')
      .lean();

    console.log(`${DEBUG_TAG} GET success`, {
      workspaceId: req.workspaceId,
      durationMs: Date.now() - startedAt,
      foundWorkspace: Boolean(workspace),
      settingsKeys: Object.keys(workspace?.storeSettings || {}),
    });

    res.json({
      success: true,
      data: workspace?.storeSettings || {}
    });
  } catch (error) {
    console.error(`${DEBUG_TAG} GET failed`, {
      durationMs: Date.now() - startedAt,
      workspaceId: req.workspaceId,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    res.status(500).json({ success: false, message: 'Error loading settings' });
  }
});

router.put('/settings', requireEcomAuth, requireWorkspace, async (req, res) => {
  const startedAt = Date.now();
  console.log(`${DEBUG_TAG} PUT start`, {
    workspaceId: req.workspaceId,
    userId: req.user?.id || req.user?._id || null,
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLengthHeader: req.headers['content-length'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    requestId: req.headers['x-request-id'] || null,
    cfRay: req.headers['cf-ray'] || null,
    bodySummary: summarizeStoreSettingsPayload(req.body),
  });

  try {
    console.log('🔧 PUT /store/settings - workspaceId:', req.workspaceId);
    console.log('🔧 Request body keys:', Object.keys(req.body || {}));
    console.log('🔧 Request body sample:', JSON.stringify(req.body, null, 2).substring(0, 500));
    
    const result = await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storeSettings: req.body } },
      { new: true }
    );
    
    // Diffuser les changements de couleurs en temps réel
    if (result?.subdomain) {
      const colorUpdate = {
        primaryColor: req.body.primaryColor,
        accentColor: req.body.accentColor,
        backgroundColor: req.body.backgroundColor,
        textColor: req.body.textColor,
        font: req.body.font,
      };
      emitThemeUpdate(result.subdomain, colorUpdate);
    }
    
    if (!result) {
      console.warn(`${DEBUG_TAG} PUT workspace not found`, {
        workspaceId: req.workspaceId,
        durationMs: Date.now() - startedAt,
      });
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    console.log(`${DEBUG_TAG} PUT success`, {
      workspaceId: req.workspaceId,
      durationMs: Date.now() - startedAt,
      updatedSettingsKeys: Object.keys(result.storeSettings || {}),
      logoLength: String(result.storeSettings?.logo || '').length,
      faviconLength: String(result.storeSettings?.favicon || '').length,
    });
    
    res.json({
      success: true,
      message: 'Settings updated'
    });
  } catch (error) {
    console.error(`${DEBUG_TAG} PUT failed`, {
      durationMs: Date.now() - startedAt,
      workspaceId: req.workspaceId,
      message: error?.message,
      name: error?.name,
      code: error?.code,
      stack: error?.stack,
      bodySummary: summarizeStoreSettingsPayload(req.body),
    });
    res.status(500).json({ success: false, message: 'Error saving settings' });
  }
});

// ─── DELIVERY ZONES ────────────────────────────────────────────────────────────

/**
 * GET /store/delivery-zones
 * Get delivery zones config for the workspace.
 * Structure stored in workspace.storeDeliveryZones (Mixed):
 * {
 *   countries: ['Cameroun', 'Gabon'],
 *   zones: [
 *     { id, country, city, aliases: [], cost: 1500, enabled: true },
 *     ...
 *   ]
 * }
 */
router.get('/delivery-zones', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storeDeliveryZones')
      .lean();

    res.json({
      success: true,
      data: workspace?.storeDeliveryZones || { countries: [], zones: [] }
    });
  } catch (error) {
    console.error('Error GET /store/delivery-zones:', error);
    res.status(500).json({ success: false, message: 'Error loading delivery zones' });
  }
});

/**
 * PUT /store/delivery-zones
 * Save the full delivery zones config.
 */
router.put('/delivery-zones', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { countries, zones } = req.body;

    // Validate structure
    if (!Array.isArray(countries) || !Array.isArray(zones)) {
      return res.status(400).json({ success: false, message: 'Format invalide: countries et zones sont requis' });
    }

    // Sanitize zones
    const sanitizedZones = zones.map((z, i) => ({
      id: z.id || `zone_${Date.now()}_${i}`,
      country: String(z.country || '').trim(),
      city: String(z.city || '').trim(),
      aliases: Array.isArray(z.aliases) ? z.aliases.map(a => String(a).trim()).filter(Boolean) : [],
      cost: Math.max(0, Number(z.cost) || 0),
      enabled: z.enabled !== false
    }));

    // Sanitize countries
    const sanitizedCountries = countries.map(c => String(c || '').trim()).filter(Boolean);

    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storeDeliveryZones: { countries: sanitizedCountries, zones: sanitizedZones } } },
      { new: true }
    );

    res.json({ success: true, message: 'Zones de livraison mises à jour' });
  } catch (error) {
    console.error('Error PUT /store/delivery-zones:', error);
    res.status(500).json({ success: false, message: 'Error saving delivery zones' });
  }
});

export default router;
