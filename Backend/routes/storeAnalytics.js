import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import geoip from 'geoip-lite';
import StoreAnalytics from '../models/StoreAnalytics.js';
import StoreVisitorPresence from '../models/StoreVisitorPresence.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';
import Store from '../models/Store.js';
import EcomWorkspace from '../models/Workspace.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { convertCurrency } from '../utils/currencyConvert.js';

// Bot UA patterns — covers major crawlers and headless browsers
const BOT_UA_RE = /bot|crawler|spider|crawling|headless|phantom|selenium|puppeteer|googlebot|bingbot|yandexbot|baiduspider|facebookexternalhit|semrushbot|ahrefsbot|dotbot|mj12bot|petalbot|bytespider|gptbot|claudebot/i;

function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_UA_RE.test(userAgent);
}

function getClientIp(req) {
  // Cloudflare always sets CF-Connecting-IP with the real visitor IP
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();
  // Standard forwarded-for (Railway, nginx, etc.)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

function normalizeObjectIdLike(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof mongoose.Types.ObjectId) return value.toString();

  if (typeof value === 'object') {
    if (typeof value.$oid === 'string') return value.$oid.trim();
    if (typeof value.toHexString === 'function') return value.toHexString();

    const nested = value.productId ?? value._id ?? value.id;
    if (nested && nested !== value) {
      const normalized = normalizeObjectIdLike(nested);
      if (normalized) return normalized;
    }

    if (value.buffer && typeof value.buffer === 'object') {
      const bytes = Array.isArray(value.buffer.data)
        ? value.buffer.data.map((byte) => Number(byte))
        : Object.keys(value.buffer)
          .filter((key) => /^\d+$/.test(key))
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => Number(value.buffer[key]));
      if (bytes.length === 12 && bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
        return Buffer.from(bytes).toString('hex');
      }
    }

    const asString = value.toString?.();
    if (asString && asString !== '[object Object]') return asString.trim();
  }

  return '';
}

// ── GeoIP lookup (geoip-lite + ipinfo.io fallback) ────────────────────────────

// In-memory cache: IP → { country, city, ts }
const GEO_CACHE = new Map();
const GEO_CACHE_MAX = 8000;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Private / loopback ranges that have no meaningful geo data
function isPrivateIp(ip) {
  if (!ip) return true;
  // IPv6 loopback
  if (ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // IPv4 loopback
  if (ip === '127.0.0.1') return true;
  // Strip IPv6-mapped IPv4 prefix so the range checks below work
  const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (stripped.startsWith('10.')) return true;
  if (stripped.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(stripped)) return true;
  return false;
}

// Normalize IPv6-mapped IPv4 to plain IPv4 for geoip-lite
function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip.startsWith('::ffff:') && ip.includes('.')) return ip.slice(7);
  return ip;
}

async function lookupIpGeo(ip) {
  if (isPrivateIp(ip)) return { country: '', city: '' };

  const normalizedIp = normalizeIp(ip);

  // Check in-memory cache first
  const cached = GEO_CACHE.get(normalizedIp);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL_MS) {
    return { country: cached.country, city: cached.city };
  }

  // 1. Try geoip-lite (instant, no network, handles most IPv4)
  const lite = geoip.lookup(normalizedIp);
  if (lite?.country) {
    // geoip-lite has country but not city — try ipinfo.io to get city
    // (run async, don't block the response)
    const result = { country: lite.country, city: lite.city || '' };
    _cacheGeo(normalizedIp, result);

    // If city is missing, enrich in background
    if (!result.city) {
      _enrichCity(normalizedIp, lite.country).catch(() => {});
    }
    return result;
  }

  // 2. geoip-lite returned null (common for African IPs, IPv6 ranges)
  //    → try ipinfo.io with a 2s timeout
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`https://ipinfo.io/${normalizedIp}/json`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const result = { country: data.country || '', city: data.city || '' };
      _cacheGeo(normalizedIp, result);
      return result;
    }
  } catch {
    // timeout or network error — return empty, do not cache to allow future retries
  }

  return { country: '', city: '' };
}

function _cacheGeo(ip, result) {
  if (GEO_CACHE.size >= GEO_CACHE_MAX) {
    GEO_CACHE.delete(GEO_CACHE.keys().next().value);
  }
  GEO_CACHE.set(ip, { ...result, ts: Date.now() });
}

async function _enrichCity(ip, knownCountry) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.city) _cacheGeo(ip, { country: knownCountry, city: data.city });
    }
  } catch { /* ignore background enrichment failures */ }
}

const trackRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: () => false,
});

const router = express.Router();
const SCALOR_ORDER_SOURCES = ['skelor', 'boutique'];

function hasExplicitTimeComponent(value) {
  return typeof value === 'string' && value.includes('T');
}

function parseDateParam(value, boundary = 'start') {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (!hasExplicitTimeComponent(value)) {
    if (boundary === 'end') parsed.setHours(23, 59, 59, 999);
    else parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
}

/**
 * POST /api/ecom/store-analytics/track
 * Tracker un événement analytics (appelé depuis le storefront public)
 */
// Fenêtre anti-spam : une même visite (page ou produit) par visiteur toutes les 30 minutes
const DEDUP_WINDOW_MS = 30 * 60 * 1000;

router.post('/track', trackRateLimit, async (req, res) => {
  try {
    const {
      subdomain,
      hostname,   // client's window.location.hostname — fallback for custom domain resolution
      eventType,
      page,
      productId,
      productName,
      productPrice,
      orderId,
      orderValue,
      visitor,
      sessionId,
      visitorId,
    } = req.body;
    const normalizedProductId = normalizeObjectIdLike(productId);

    if (!eventType) {
      return res.status(400).json({ error: 'eventType requis' });
    }

    // Silently drop bot traffic
    const ua = req.headers['user-agent'] || visitor?.userAgent || '';
    if (isBot(ua)) {
      return res.json({ success: true, skipped: true });
    }

    // ── Resolve workspaceId ────────────────────────────────────────────────────
    // Priority order:
    //   1. subdomain param  → Store (multi-boutique) → Workspace (legacy)
    //   2. hostname param   → custom domain lookup (for visitors arriving via maboutique.com)
    let workspaceId;
    let resolvedStoreId = null;
    let resolvedSubdomain = subdomain || '';

    if (subdomain) {
      // Validate subdomain format to prevent injection
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        return res.status(400).json({ error: 'Subdomain invalide' });
      }

      // Analytics tracking: find by subdomain only — do NOT filter by isActive/isStoreEnabled.
      // We want to record visits even when a store is temporarily paused. The merchant needs
      // to see traffic data regardless of store status.
      const storeDoc = await Store.findOne({ subdomain })
        .select('_id workspaceId').lean();

      if (storeDoc) {
        workspaceId = storeDoc.workspaceId;
        resolvedStoreId = storeDoc._id;
      } else {
        // Legacy single-store model: subdomain lives on the Workspace document
        const workspace = await EcomWorkspace.findOne({ subdomain })
          .select('_id').lean();
        if (workspace) workspaceId = workspace._id;
      }
    }

    // Fallback: resolve via custom domain hostname (when frontend hasn't resolved yet
    // or visitor is directly on maboutique.com without a subdomain param)
    if (!workspaceId && hostname) {
      const cleanHost = String(hostname).toLowerCase().trim().replace(/^www\./, '').substring(0, 253);
      if (cleanHost && !/localhost|127\.0\.0\.1|railway/.test(cleanHost)) {
        // No isActive/isStoreEnabled filter — track visits regardless of store status
        const storeByDomain = await Store.findOne({
          'storeDomains.customDomain': cleanHost,
        }).select('_id workspaceId subdomain').lean();

        if (storeByDomain) {
          workspaceId = storeByDomain.workspaceId;
          resolvedStoreId = storeByDomain._id;
          resolvedSubdomain = storeByDomain.subdomain;
        } else {
          const ws = await EcomWorkspace.findOne({
            'storeDomains.customDomain': cleanHost,
          }).select('_id subdomain').lean();
          if (ws) {
            workspaceId = ws._id;
            resolvedSubdomain = ws.subdomain;
          }
        }
      }
    }

    if (!workspaceId) {
      // Return 200 silently — don't leak whether a store exists or is disabled
      return res.json({ success: true, skipped: true });
    }

    // ── Anti-spam dedup ────────────────────────────────────────────────────────
    // IMPORTANT: always scope dedup by subdomain so visits to different boutiques
    // on the same workspace are never cross-deduplicated.
    if (['page_view', 'product_view'].includes(eventType)) {
      const identifier = visitorId || sessionId;
      if (identifier) {
        const since = new Date(Date.now() - DEDUP_WINDOW_MS);
        const dedupQuery = {
          workspaceId,
          subdomain: resolvedSubdomain,   // ← per-boutique scope (never cross-dedup)
          eventType,
          timestamp: { $gte: since },
          $or: [{ visitorId: identifier }, { sessionId: identifier }],
        };
        if (eventType === 'product_view' && normalizedProductId) {
          dedupQuery.productId = normalizedProductId;
        } else if (eventType === 'page_view') {
          dedupQuery['page.path'] = page?.path || '';
        }
        const existing = await StoreAnalytics.findOne(dedupQuery).lean();
        if (existing) {
          return res.json({ success: true, deduplicated: true });
        }
      }
    }

    // ── GeoIP enrichment ───────────────────────────────────────────────────────
    // 1. Cloudflare headers (instant, most reliable when behind CF CDN)
    const cfCountry = req.headers['cf-ipcountry'];
    const cfCity    = req.headers['cf-ipcity'] || '';
    let geoCountry  = (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') ? cfCountry : '';
    let geoCity     = cfCity;

    // 2. IP lookup — geoip-lite first, ipinfo.io fallback
    if (!geoCountry || !geoCity) {
      const clientIp = getClientIp(req);
      const geo = await lookupIpGeo(clientIp);
      if (!geoCountry) geoCountry = geo.country || '';
      if (!geoCity)    geoCity    = geo.city    || '';
    }

    const enrichedVisitor = {
      ...(visitor || {}),
      country: geoCountry || visitor?.country || '',
      city:    geoCity    || visitor?.city    || '',
    };

    // ── Persist event ──────────────────────────────────────────────────────────
    await StoreAnalytics.create({
      workspaceId,
      ...(resolvedStoreId && { storeId: resolvedStoreId }),
      subdomain: resolvedSubdomain,
      eventType,
      page,
      productId: normalizedProductId || null,
      productName,
      productPrice,
      orderId,
      orderValue,
      visitor: enrichedVisitor,
      sessionId: sessionId || '',
      visitorId: visitorId || '',
      timestamp: new Date(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur tracking analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Live View (visiteurs en temps réel, façon Shopify) ──────────────────────

// Heartbeat toutes les ~20 s par visiteur → limite large pour les IP partagées (NAT mobile)
const presenceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

// Fenêtre "actif en ce moment" (identique à Shopify : 5 min)
const LIVE_WINDOW_MS = 5 * 60 * 1000;

/** Résout workspaceId / storeId / subdomain depuis un subdomain ou un hostname (custom domain). */
async function resolvePresenceTarget(subdomain, hostname) {
  if (subdomain && /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    const storeDoc = await Store.findOne({ subdomain }).select('_id workspaceId').lean();
    if (storeDoc) return { workspaceId: storeDoc.workspaceId, storeId: storeDoc._id, subdomain };
    const ws = await EcomWorkspace.findOne({ subdomain }).select('_id').lean();
    if (ws) return { workspaceId: ws._id, storeId: null, subdomain };
  }
  if (hostname) {
    const cleanHost = String(hostname).toLowerCase().trim().replace(/^www\./, '').substring(0, 253);
    if (cleanHost && !/localhost|127\.0\.0\.1|railway/.test(cleanHost)) {
      const byDomain = await Store.findOne({ 'storeDomains.customDomain': cleanHost })
        .select('_id workspaceId subdomain').lean();
      if (byDomain) return { workspaceId: byDomain.workspaceId, storeId: byDomain._id, subdomain: byDomain.subdomain };
      const ws = await EcomWorkspace.findOne({ 'storeDomains.customDomain': cleanHost })
        .select('_id subdomain').lean();
      if (ws) return { workspaceId: ws._id, storeId: null, subdomain: ws.subdomain };
    }
  }
  return null;
}

const FUNNEL_STAGE_BY_EVENT = { browsing: 1, product: 2, checkout: 3, purchased: 4 };

/**
 * POST /api/ecom/store-analytics/presence
 * Heartbeat du storefront public (~20 s). Upsert la présence du visiteur.
 */
router.post('/presence', presenceRateLimit, async (req, res) => {
  try {
    const {
      subdomain, hostname, visitorId, sessionId,
      page, productId, productName, device, browser, referrer, stage,
    } = req.body || {};

    if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 64) {
      return res.json({ success: true, skipped: true });
    }
    const ua = req.headers['user-agent'] || '';
    if (isBot(ua)) return res.json({ success: true, skipped: true });

    const target = await resolvePresenceTarget(subdomain, hostname);
    if (!target) return res.json({ success: true, skipped: true });

    // Geo : Cloudflare d'abord, sinon lookup IP (même logique que /track)
    const cfCountry = req.headers['cf-ipcountry'];
    let geoCountry = (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') ? cfCountry : '';
    let geoCity = req.headers['cf-ipcity'] || '';
    if (!geoCountry || !geoCity) {
      const geo = await lookupIpGeo(getClientIp(req));
      if (!geoCountry) geoCountry = geo.country || '';
      if (!geoCity) geoCity = geo.city || '';
    }

    const now = new Date();
    const funnelStage = FUNNEL_STAGE_BY_EVENT[stage] || 1;
    const safePath = String(page?.path || '').slice(0, 300);
    const safeTitle = String(page?.title || '').slice(0, 200);

    await StoreVisitorPresence.updateOne(
      { subdomain: target.subdomain, visitorId },
      {
        $set: {
          workspaceId: String(target.workspaceId),
          storeId: target.storeId,
          sessionId: String(sessionId || '').slice(0, 80),
          page: { path: safePath, title: safeTitle },
          productId: productId ? String(productId).slice(0, 40) : null,
          productName: String(productName || '').slice(0, 160),
          device: ['desktop', 'mobile', 'tablet'].includes(device) ? device : 'unknown',
          browser: String(browser || '').slice(0, 40),
          country: geoCountry,
          city: geoCity,
          lastSeenAt: now,
        },
        $setOnInsert: { firstSeenAt: now, referrer: String(referrer || '').slice(0, 300) },
        $max: { funnelStage },
      },
      { upsert: true },
    );

    res.json({ success: true });
  } catch (error) {
    // Duplicate key possible sous forte concurrence d'upserts — sans gravité
    if (error?.code === 11000) return res.json({ success: true });
    console.warn('Erreur presence:', error.message);
    res.status(200).json({ success: true, skipped: true });
  }
});

/**
 * GET /api/ecom/store-analytics/live
 * Vue "En direct" (authentifié) : visiteurs actifs (5 min), pages vues par minute,
 * top pages/localisations, commandes et checkouts récents.
 */
router.get('/live', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = String(req.workspaceId || '');
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId requis' });

    // Scope boutique active (multi-boutique) — même logique que /dashboard
    let storeSubdomain = null;
    if (req.activeStoreId) {
      const store = await Store.findById(req.activeStoreId).select('subdomain').lean();
      if (store?.subdomain) storeSubdomain = store.subdomain;
    }
    if (!storeSubdomain) {
      const ws = await EcomWorkspace.findById(workspaceId).select('subdomain').lean();
      storeSubdomain = ws?.subdomain || null;
    }

    const now = Date.now();
    const liveSince = new Date(now - LIVE_WINDOW_MS);
    const last30min = new Date(now - 30 * 60 * 1000);

    const presenceFilter = { workspaceId, lastSeenAt: { $gte: liveSince } };
    const analyticsFilter = { workspaceId, timestamp: { $gte: last30min } };
    if (storeSubdomain) {
      presenceFilter.subdomain = storeSubdomain;
      analyticsFilter.subdomain = storeSubdomain;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayFilter = { workspaceId, eventType: 'page_view', timestamp: { $gte: startOfDay } };
    if (storeSubdomain) dayFilter.subdomain = storeSubdomain;

    const [visitors, recentEvents, todaySessions, lastView] = await Promise.all([
      StoreVisitorPresence.find(presenceFilter)
        .sort({ lastSeenAt: -1 })
        .limit(200)
        .lean(),
      StoreAnalytics.find({
        ...analyticsFilter,
        eventType: { $in: ['page_view', 'product_view', 'add_to_cart', 'checkout_started', 'order_placed'] },
      })
        .sort({ timestamp: -1 })
        .limit(600)
        .select('eventType timestamp page.path productName orderValue visitor.city visitor.country visitor.device')
        .lean(),
      // Visites du jour (sessions distinctes) — pour le hero du dashboard
      StoreAnalytics.distinct('sessionId', dayFilter),
      // Dernière visite géolocalisée — notification façon Shopify
      StoreAnalytics.findOne({
        ...(storeSubdomain ? { subdomain: storeSubdomain } : {}),
        workspaceId,
        eventType: { $in: ['page_view', 'product_view'] },
      }).sort({ timestamp: -1 }).select('timestamp visitor.city visitor.country page.path').lean(),
    ]);

    // Série par minute (30 dernières minutes) pour le sparkline
    const perMinute = Array.from({ length: 30 }, (_, i) => ({
      t: new Date(now - (29 - i) * 60 * 1000).toISOString().slice(0, 16),
      views: 0,
    }));
    const minuteIndex = new Map(perMinute.map((b, i) => [b.t, i]));
    for (const ev of recentEvents) {
      if (ev.eventType !== 'page_view' && ev.eventType !== 'product_view') continue;
      const key = new Date(ev.timestamp).toISOString().slice(0, 16);
      const idx = minuteIndex.get(key);
      if (idx !== undefined) perMinute[idx].views += 1;
    }

    // Agrégats sur les visiteurs actifs
    const topPages = {};
    const topLocations = {};
    const devices = { desktop: 0, mobile: 0, tablet: 0, unknown: 0 };
    const funnel = { browsing: 0, product: 0, checkout: 0, purchased: 0 };
    const stageKeys = ['browsing', 'product', 'checkout', 'purchased'];
    for (const v of visitors) {
      const p = v.page?.path || '/';
      topPages[p] = (topPages[p] || 0) + 1;
      const loc = [v.city, v.country].filter(Boolean).join(', ') || 'Inconnu';
      topLocations[loc] = (topLocations[loc] || 0) + 1;
      devices[v.device || 'unknown'] = (devices[v.device || 'unknown'] || 0) + 1;
      funnel[stageKeys[(v.funnelStage || 1) - 1]] += 1;
    }
    const sortDesc = (obj) => Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => ({ key, count }));

    // Activité conversion récente (30 min)
    const recentActivity = recentEvents
      .filter((e) => ['add_to_cart', 'checkout_started', 'order_placed'].includes(e.eventType))
      .slice(0, 20)
      .map((e) => ({
        type: e.eventType,
        at: e.timestamp,
        productName: e.productName || '',
        orderValue: e.orderValue || 0,
        city: e.visitor?.city || '',
        country: e.visitor?.country || '',
      }));

    res.json({
      activeCount: visitors.length,
      visitsToday: todaySessions.length,
      lastVisit: lastView ? {
        at: lastView.timestamp,
        city: lastView.visitor?.city || '',
        country: lastView.visitor?.country || '',
        path: lastView.page?.path || '/',
      } : null,
      visitors: visitors.slice(0, 60).map((v) => ({
        visitorId: String(v.visitorId).slice(0, 8),
        page: v.page || { path: '/', title: '' },
        productName: v.productName || '',
        device: v.device || 'unknown',
        city: v.city || '',
        country: v.country || '',
        referrer: v.referrer || '',
        stage: stageKeys[(v.funnelStage || 1) - 1],
        firstSeenAt: v.firstSeenAt,
        lastSeenAt: v.lastSeenAt,
      })),
      perMinute,
      topPages: sortDesc(topPages),
      topLocations: sortDesc(topLocations),
      devices,
      funnel,
      recentActivity,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Erreur live view:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ecom/store-analytics/dashboard
 * Obtenir les statistiques du dashboard (authentifié)
 */
router.get('/dashboard', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId: requestedWorkspaceId, startDate, endDate, period = '7d', allStores } = req.query;
    const workspaceId = String(req.workspaceId || requestedWorkspaceId || '');
    const useAllStores = String(allStores || '') === '1' || String(allStores || '').toLowerCase() === 'true';

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    // Calculer les dates
    let start;
    const now = new Date();
    let end = parseDateParam(endDate, 'end') || now;

    if (startDate) {
      start = parseDateParam(startDate, 'start') || new Date(now);
    } else if (period === 'today') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
    } else if (period === 'yesterday') {
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else {
      const periodMap = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
      };
      const days = periodMap[period] || 7;
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Résoudre le subdomain du store actif pour filtrer les analytics
    let storeSubdomain = null;
    // Devise de la boutique active (source de vérité pour l'affichage et la conversion).
    let activeStoreCurrency = null;
    const activeStoreId = useAllStores ? null : req.activeStoreId;
    if (activeStoreId) {
      const store = await Store.findById(activeStoreId)
        .select('subdomain storeSettings.storeCurrency storeSettings.currency currency')
        .lean();
      activeStoreCurrency = store?.storeSettings?.storeCurrency
        || store?.storeSettings?.currency
        || store?.currency
        || null;
      if (store?.subdomain) {
        storeSubdomain = store.subdomain;
      } else {
        // Legacy model: subdomain lives on the workspace document, not the store
        const ws = await EcomWorkspace.findById(workspaceId).select('subdomain').lean();
        storeSubdomain = ws?.subdomain || null;
      }
    }

    console.log('[DASHBOARD] workspaceId:', workspaceId, '| activeStoreId:', activeStoreId, '| storeSubdomain:', storeSubdomain, '| useAllStores:', useAllStores);

    // Quick count to verify data exists before full aggregation
    const rawCount = await StoreAnalytics.countDocuments({ workspaceId, timestamp: { $gte: start, $lte: end } });
    const subdomainCount = storeSubdomain ? await StoreAnalytics.countDocuments({ workspaceId, subdomain: storeSubdomain, timestamp: { $gte: start, $lte: end } }) : null;
    console.log('[DASHBOARD] raw analytics count (no subdomain filter):', rawCount, '| with subdomain filter:', subdomainCount);

    // Récupérer les stats analytics (filtrées par subdomain si store actif)
    const analyticsStats = await StoreAnalytics.getStoreDashboardStats(
      workspaceId,
      start,
      end,
      period,
      storeSubdomain
    );

    // Récupérer les commandes depuis les deux modèles (Order interne + StoreOrder storefront)
    const wsObjectId = mongoose.Types.ObjectId.isValid(workspaceId)
      ? new mongoose.Types.ObjectId(workspaceId)
      : workspaceId;

    // Build filters scoped to active store if set
    const internalFilter = {
      workspaceId: wsObjectId,
      $and: [
        {
          $or: [
            { date: { $gte: start, $lte: end } },
            { date: { $exists: false }, createdAt: { $gte: start, $lte: end } },
          ],
        },
        {
          $or: [
            { source: { $in: SCALOR_ORDER_SOURCES } },
            { storeOrderId: { $exists: true, $ne: null } },
          ],
        },
      ],
    };
    const storeOrderFilter = {
      workspaceId: wsObjectId,
      createdAt: { $gte: start, $lte: end },
    };
    if (activeStoreId) {
      internalFilter.storeId = activeStoreId;
      storeOrderFilter.storeId = activeStoreId;
    }

    const [internalOrders, storeOrders] = await Promise.all([
      Order.find(internalFilter).lean(),
      StoreOrder.find(storeOrderFilter).lean(),
    ]);

    console.log('[ANALYTICS DEBUG]', {
      workspaceId,
      requestedWorkspaceId,
      effectiveWorkspaceId: req.workspaceId,
      wsObjectId: wsObjectId.toString(),
      start: start.toISOString(),
      end: end.toISOString(),
      internalOrdersCount: internalOrders.length,
      storeOrdersCount: storeOrders.length,
      sampleInternal: internalOrders[0] ? { _id: internalOrders[0]._id, status: internalOrders[0].status, price: internalOrders[0].price, quantity: internalOrders[0].quantity, date: internalOrders[0].date, createdAt: internalOrders[0].createdAt } : null,
    });

    // Dedupe: if an internal Order references a StoreOrder via storeOrderId, skip that StoreOrder
    const linkedStoreOrderIds = new Set(
      internalOrders
        .filter(o => o.storeOrderId)
        .map(o => o.storeOrderId.toString())
    );
    const uniqueStoreOrders = storeOrders.filter(
      so => !linkedStoreOrderIds.has(so._id.toString())
    );

    // Store principal currency for conversion — priorité à la devise de la boutique
    // active (celle choisie dans les paramètres), puis repli sur le workspace.
    const storeCurrency = activeStoreCurrency
      || req.workspace?.storeSettings?.storeCurrency
      || req.workspace?.settings?.currency
      || 'XAF';

    // Normalize both models into a unified shape
    // Convert each order's total to the store's principal currency
    const normalize = (o, isInternal) => {
      const orderCurrency = o.currency || 'XAF';
      const rawTotal = isInternal ? (o.price || 0) : (o.total || 0);
      const convertedTotal = convertCurrency(rawTotal, orderCurrency, storeCurrency);
      const rawDeliveryCost = o.deliveryCost || 0;
      const convertedDeliveryCost = convertCurrency(rawDeliveryCost, orderCurrency, storeCurrency);
      return {
        _id: o._id,
        status: o.status || 'pending',
        total: convertedTotal,
        deliveryCost: convertedDeliveryCost,
        city: o.city || o.deliveryLocation || o.deliveryZone || '',
        phone: isInternal ? (o.clientPhone || o.clientPhoneNormalized || '') : (o.phone || ''),
        channel: isInternal
          ? ((o.storeOrderId || ['boutique', 'skelor', 'shopify', 'webhook'].includes(o.source)) ? 'store' : (o.source || 'manual'))
          : (o.channel || 'store'),
        createdAt: isInternal ? (o.date || o.createdAt) : o.createdAt,
      };
    };

    const orders = [
      ...internalOrders.map(o => normalize(o, true)),
      ...uniqueStoreOrders.map(o => normalize(o, false)),
    ];

    const sumBy = (arr, fn) => arr.reduce((s, o) => s + (fn(o) || 0), 0);
    const byStatus = (s) => orders.filter(o => o.status === s);

    const deliveredOrders = byStatus('delivered');
    const cancelledOrders = byStatus('cancelled');
    const shippedOrders   = byStatus('shipped');
    const confirmedOrders = byStatus('confirmed');
    const processingOrders= byStatus('processing');
    const pendingOrders   = byStatus('pending');

    const potentialRevenue = sumBy(orders, o => o.total);
    const realizedRevenue  = sumBy(deliveredOrders, o => o.total);
    const shippingCost     = sumBy(orders, o => o.deliveryCost);

    // Confirmation: orders that left pending state (regardless of final status)
    const confirmedOrHigher = orders.filter(o => o.status !== 'pending').length;
    const confirmationRate = orders.length > 0
      ? +((confirmedOrHigher / orders.length) * 100).toFixed(1)
      : 0;

    // Delivery success: delivered / (delivered + cancelled after confirmation)
    const shippedOrLater = orders.filter(o => ['shipped', 'delivered', 'cancelled'].includes(o.status));
    const deliveryRate = shippedOrLater.length > 0
      ? +((deliveredOrders.length / shippedOrLater.length) * 100).toFixed(1)
      : 0;

    const cancellationRate = orders.length > 0
      ? +((cancelledOrders.length / orders.length) * 100).toFixed(1)
      : 0;

    // Top delivery cities / zones
    const topCities = Object.entries(orders.reduce((acc, o) => {
      const key = (o.city || o.deliveryZone || 'Inconnu').trim() || 'Inconnu';
      if (!acc[key]) acc[key] = { name: key, count: 0, delivered: 0, revenue: 0 };
      acc[key].count += 1;
      acc[key].revenue += o.total || 0;
      if (o.status === 'delivered') acc[key].delivered += 1;
      return acc;
    }, {})).map(([, v]) => v).sort((a, b) => b.count - a.count).slice(0, 8);

    // Channel breakdown (storefront vs WhatsApp)
    const channelStats = orders.reduce((acc, o) => {
      const k = o.channel || 'store';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const channelPerformance = orders.reduce((acc, o) => {
      const key = o.channel || 'store';
      if (!acc[key]) {
        acc[key] = {
          channel: key,
          orders: 0,
          revenue: 0,
          deliveredRevenue: 0,
        };
      }

      acc[key].orders += 1;
      acc[key].revenue += o.total || 0;
      if (o.status === 'delivered') {
        acc[key].deliveredRevenue += o.total || 0;
      }
      return acc;
    }, {});

    // Repeat customers by phone
    const phoneCounts = orders.reduce((acc, o) => {
      if (!o.phone) return acc;
      acc[o.phone] = (acc[o.phone] || 0) + 1;
      return acc;
    }, {});
    const uniqueCustomers = Object.keys(phoneCounts).length;
    const repeatCustomers = Object.values(phoneCounts).filter(c => c > 1).length;
    const repeatRate = uniqueCustomers > 0
      ? +((repeatCustomers / uniqueCustomers) * 100).toFixed(1)
      : 0;

    // Revenue & orders grouped by time bucket (hourly for 24h, daily otherwise)
    const dailyRevenue = {};
    const dailyOrders = {};
    orders.forEach(o => {
      const d = new Date(o.createdAt);
      const key = period === '24h'
        ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}`
        : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      dailyOrders[key] = (dailyOrders[key] || 0) + 1;
      if (o.status === 'delivered') {
        dailyRevenue[key] = (dailyRevenue[key] || 0) + (o.total || 0);
      }
    });

    const orderStats = {
      total: orders.length,
      pending:    pendingOrders.length,
      confirmed:  confirmedOrders.length,
      processing: processingOrders.length,
      shipped:    shippedOrders.length,
      delivered:  deliveredOrders.length,
      cancelled:  cancelledOrders.length,
      dailyRevenue,
      dailyOrders,
      // Revenue views
      totalRevenue: potentialRevenue,          // kept for compat
      potentialRevenue,                        // all orders (COD not yet collected)
      realizedRevenue,                         // delivered only — cash actually collected
      shippingCost,                            // total delivery cost across all orders
      averageOrderValue: orders.length > 0 ? potentialRevenue / orders.length : 0,
      averageDeliveredValue: deliveredOrders.length > 0
        ? realizedRevenue / deliveredOrders.length
        : 0,
      // COD KPIs
      confirmationRate,
      deliveryRate,
      cancellationRate,
      // Customer loyalty
      uniqueCustomers,
      repeatCustomers,
      repeatRate,
      // Segments
      topCities,
      channelStats,
      channelPerformance: Object.values(channelPerformance).sort((a, b) => b.revenue - a.revenue),
    };

    // Top products by sales (quantity sold) and revenue
    const productSales = {};
    // From StoreOrders (have products array)
    [...uniqueStoreOrders, ...storeOrders.filter(so => linkedStoreOrderIds.has(so._id.toString()))].forEach(so => {
      const orderCur = so.currency || 'XAF';
      (so.products || []).forEach(p => {
        const key = (p.productId || p.name || '').toString();
        if (!productSales[key]) productSales[key] = { name: p.name || 'Sans nom', sold: 0, revenue: 0 };
        productSales[key].sold += p.quantity || 1;
        productSales[key].revenue += convertCurrency((p.price || 0) * (p.quantity || 1), orderCur, storeCurrency);
      });
    });
    // From internal Orders (single product per order)
    internalOrders.filter(o => !o.storeOrderId).forEach(o => {
      if (!o.product) return;
      const key = o.product;
      const orderCur = o.currency || 'XAF';
      if (!productSales[key]) productSales[key] = { name: o.product, sold: 0, revenue: 0 };
      productSales[key].sold += o.quantity || 1;
      productSales[key].revenue += convertCurrency(o.price || 0, orderCur, storeCurrency);
    });
    const topProductsBySales = Object.values(productSales).sort((a, b) => b.sold - a.sold).slice(0, 10);
    const topProductsByRevenue = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const leastProductsBySales = Object.values(productSales)
      .filter(p => (p.sold || 0) > 0)
      .sort((a, b) => a.sold - b.sold || b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      analytics: {
        ...analyticsStats,
        overview: {
          ...analyticsStats.overview,
          // Recalculate conversion rate using actual orders, not just tracked events
          conversionRate: analyticsStats.overview.uniqueVisitors > 0
            ? parseFloat(((orderStats.total / analyticsStats.overview.uniqueVisitors) * 100).toFixed(1))
            : 0,
          ordersPlaced: orderStats.total,
        },
      },
      orders: orderStats,
      storeCurrency,
      topProductsBySales,
      topProductsByRevenue,
      leastProductsBySales,
      period: { start, end },
    });
  } catch (error) {
    console.error('Erreur récupération dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ecom/store-analytics/realtime
 * Statistiques en temps réel (dernières 24h)
 */
router.get('/realtime', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = String(req.workspaceId || req.query.workspaceId || '');

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const wsObjectId = mongoose.Types.ObjectId.isValid(workspaceId)
      ? new mongoose.Types.ObjectId(workspaceId)
      : workspaceId;

    const [
      activeVisitors,
      recentPageViews,
      recentOrders
    ] = await Promise.all([
      // Visiteurs actifs (dernière heure)
      StoreAnalytics.distinct('sessionId', {
        workspaceId,
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      }),
      
      // Vues de pages (dernières 24h)
      StoreAnalytics.countDocuments({
        workspaceId,
        eventType: 'page_view',
        timestamp: { $gte: last24h }
      }),
      
      // Commandes récentes
      StoreOrder.find({
        workspaceId: wsObjectId,
        createdAt: { $gte: last24h }
      }).sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.json({
      activeVisitors: activeVisitors.length,
      pageViews24h: recentPageViews,
      recentOrders,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Erreur stats temps réel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ecom/store-analytics/export
 * Exporter les analytics en CSV
 */
router.get('/export', requireEcomAuth, async (req, res) => {
  try {
    const { workspaceId: requestedWorkspaceId, startDate, endDate } = req.query;
    const workspaceId = String(req.workspaceId || requestedWorkspaceId || '');

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    if (startDate) start.setHours(0, 0, 0, 0);
    if (endDate) end.setHours(23, 59, 59, 999);

    const events = await StoreAnalytics.find({
      workspaceId,
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 }).limit(10000).lean();

    // Générer CSV
    const csv = [
      'Date,Type,Page,Produit,Valeur,Appareil,Navigateur,Ville',
      ...events.map(e => [
        new Date(e.timestamp).toISOString(),
        e.eventType,
        e.page?.path || '',
        e.productName || '',
        e.orderValue || e.productPrice || '',
        e.visitor?.device || '',
        e.visitor?.browser || '',
        e.visitor?.city || '',
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Erreur export analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
