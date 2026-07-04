/**
 * Store API Routes — Public store data endpoints
 *
 * Mounted at: /api/store
 * Called by: React storefront SPA running on *.scalor.net
 * Via: https://api.scalor.net/api/store/:subdomain
 *
 * Architecture:
 * - No authentication required (public endpoints)
 * - Workspace isolation via subdomain → workspaceId
 * - Cached workspace lookups (5min TTL in workspaceResolver)
 * - Lean queries for minimal memory footprint
 * - Cache-Control headers so Cloudflare caches at the edge (s-maxage)
 * - Rate limiting to protect Railway from abusive scrapers
 *
 * Endpoints:
 *   GET /api/store/:subdomain          → Store config + featured products
 *   GET /api/store/:subdomain/products → Paginated products with filters
 *   GET /api/store/:subdomain/products/:slug → Single product detail
 *   GET /api/store/:subdomain/categories → Available categories
 *   POST /api/store/:subdomain/abandoned-checkout → Save recoverable checkout
 *   POST /api/store/:subdomain/orders  → Guest checkout (place order)
 */

import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Workspace from '../models/Workspace.js';
import Store from '../models/Store.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';
import OrderSource from '../models/OrderSource.js';
import EcomUser from '../models/EcomUser.js';
import QuantityOffer from '../models/QuantityOffer.js';
import { notifyNewOrder } from '../services/notificationHelper.js';
import { memCache } from '../services/memoryCache.js';
import { sendClientOrderConfirmation } from '../services/shopifyWhatsappService.js';
import { normalizeCity } from '../utils/cityNormalizer.js';
import { buildMetaEventPayload, buildMetaUserData, isSupportedMetaEvent, sendMetaCapiEvent } from '../services/metaCapi.js';
import { createAffiliateConversionFromOrder, normalizeCode } from '../services/affiliateService.js';
import { getPlanRuntimeSnapshot } from '../middleware/planLimits.js';
import { notifyOrderLimitReached } from '../services/orderLimitNotificationService.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const router = express.Router();

// ─── Rate limiting ────────────────────────────────────────────────────────────
// GET routes: generous limit — Cloudflare caches most requests so real traffic is low
const readLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 120,                   // 120 req/min per IP (2 req/s — enough for any human)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes, réessayez dans une minute.' },
  skip: (req) => req.method !== 'GET',  // Only limit GET
});

// POST orders: strict limit to prevent order spam
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minute window
  max: 10,                    // 10 orders per 10min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de commandes, réessayez dans 10 minutes.' },
});

const checkoutDraftLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de sauvegardes checkout, réessayez dans quelques minutes.' },
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop d\'événements de tracking, réessayez dans une minute.' },
});

// In-process store resolver cache: avoids hitting Mongo for the same subdomain
// during bursts of page/API requests. Admin saves call invalidateStoreCache() instantly.
const STORE_CACHE_TTL = 120_000;
const storeCache = new Map(); // subdomain → { data, expiresAt }
const responseCache = new Map(); // key → { data, expiresAt }

const PUBLIC_HOME_CACHE_TTL = 3 * 60_000;       // 3 min
const PUBLIC_PRODUCTS_CACHE_TTL = 3 * 60_000;   // 3 min
const PUBLIC_PRODUCT_PAGE_CACHE_TTL = 5 * 60_000; // 5 min (invalidé immédiatement sur save admin)
const PUBLIC_CATEGORIES_CACHE_TTL = 15 * 60_000;  // 15 min

function normalizeSubdomainKey(subdomain) {
  return String(subdomain || '').toLowerCase().trim();
}

function getCachedStore(subdomain) {
  const entry = storeCache.get(subdomain);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { storeCache.delete(subdomain); return null; }
  return entry.data;
}
function setCachedStore(subdomain, data) {
  storeCache.set(subdomain, { data, expiresAt: Date.now() + STORE_CACHE_TTL });
}

function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { responseCache.delete(key); return null; }
  return entry.data;
}

// pub-*.r2.dev is Cloudflare's development URL and can be rate limited.
// When R2_CDN_URL is configured, rewrite legacy payloads without a DB migration.
const R2_DEV_URL_RX = /https:\/\/pub-[a-z0-9]+\.r2\.dev/g;
function rewriteMediaUrls(payload) {
  const cdn = String(process.env.R2_CDN_URL || '').trim().replace(/\/+$/, '');
  if (!cdn) return payload;
  try {
    return JSON.parse(JSON.stringify(payload).replace(R2_DEV_URL_RX, cdn));
  } catch {
    return payload;
  }
}

function setCachedResponse(key, data, ttlMs) {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function deleteResponseCacheByPrefix(prefix) {
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) responseCache.delete(key);
  }
}

function stableQueryKey(query = {}) {
  return Object.entries(query)
    .filter(([key]) => key !== '_fresh' && key !== '_ts')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value ?? '')}`)
    .join('&');
}

function normalizeCheckoutSessionId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function shouldBypassResponseCache(req) {
  return req.query?._fresh != null || req.query?._ts != null || req.get('cache-control')?.includes('no-cache');
}

export function invalidateStoreCache(subdomain) {
  if (!subdomain) {
    storeCache.clear();
    responseCache.clear();
    return;
  }

  const clean = normalizeSubdomainKey(subdomain);
  storeCache.delete(clean);
  deleteResponseCacheByPrefix(`${clean}:`);
}

// ─── Default legal pages fallback (when AI generation hasn't run yet) ─────────
function buildDefaultLegalPages(settings, workspace) {
  const storeName = settings.storeName || settings.name || workspace.name || 'Notre Boutique';
  const country = settings.country || '';
  const city = settings.city || '';
  const whatsapp = settings.storeWhatsApp || settings.whatsapp || '';
  const email = settings.email || settings.storeEmail || '';
  const contact = whatsapp ? `WhatsApp : ${whatsapp}` : (email ? `Email : ${email}` : 'notre support client');
  const productType = settings.productType || 'produits';

  return {
    confidentialite: {
      title: 'Politique de Confidentialité',
      content: `<h2>Politique de Confidentialité</h2><p>${storeName} s'engage à protéger vos données personnelles.</p><h3>Données collectées</h3><p>Nous collectons uniquement les informations nécessaires au traitement de votre commande : nom, prénom, numéro de téléphone et adresse de livraison.</p><h3>Utilisation des données</h3><ul><li>Traitement et suivi de votre commande</li><li>Livraison de vos produits</li><li>Communication concernant votre commande</li></ul><h3>Protection</h3><p>Vos données sont stockées de manière sécurisée et ne sont jamais vendues à des tiers.</p><h3>Partage</h3><p>Vos informations de livraison sont partagées uniquement avec nos partenaires livreurs pour assurer la bonne réception de votre colis.</p><h3>Contact</h3><p>Pour toute question, contactez-nous via ${contact}.</p>`
    },
    cgv: {
      title: 'Conditions Générales de Vente',
      content: `<h2>Conditions Générales de Vente</h2><h3>Objet</h3><p>Les présentes conditions régissent la vente en ligne de ${productType} par ${storeName}${country ? ` au ${country}` : ''}.</p><h3>Commande</h3><p>Vous pouvez passer commande via notre site ou par WhatsApp. Chaque commande est confirmée par un message de notre équipe.</p><h3>Paiement</h3><p>Le paiement se fait à la livraison (Cash on Delivery). Vous payez en espèces ou par Mobile Money au moment de la réception de votre colis.</p><h3>Livraison</h3><p>Nous livrons dans un délai de 24h à 72h selon votre zone${city ? ` (${city} et environs)` : ''}. Les frais de livraison sont indiqués lors de la commande.</p><h3>Refus</h3><p>Vous avez le droit de refuser votre commande à la livraison si le produit n'est pas conforme à votre commande.</p><h3>Litiges</h3><p>En cas de problème, contactez-nous via ${contact}. Nous privilégions toujours la résolution amiable.</p>`
    },
    mentions: {
      title: 'Mentions Légales',
      content: `<h2>Mentions Légales</h2><h3>Identité</h3><p>Nom de la marque : ${storeName}</p><p>Activité : Vente en ligne${productType ? ` de ${productType}` : ''}</p><h3>Contact</h3><p>${contact}</p><h3>Localisation</h3><p>${city ? city + ', ' : ''}${country || 'Non précisée'}</p><h3>Hébergement</h3><p>Ce site est hébergé par Scalor (scalor.net).</p>`
    },
    remboursement: {
      title: 'Politique de Remboursement',
      content: `<h2>Politique de Remboursement</h2><h3>Principe</h3><p>Chez ${storeName}, vous payez uniquement à la réception de votre commande. Aucun paiement en ligne n'est requis.</p><h3>Vérification</h3><p>À la livraison, vous pouvez vérifier votre produit avant de payer. Si le produit ne correspond pas à votre commande, vous pouvez le refuser.</p><h3>Cas acceptés pour un retour</h3><ul><li>Produit défectueux ou endommagé</li><li>Produit différent de ce qui a été commandé</li><li>Colis endommagé pendant le transport</li></ul><h3>Cas non acceptés</h3><ul><li>Changement d'avis après paiement et réception</li><li>Produit déjà utilisé</li></ul><h3>Procédure</h3><p>Contactez notre support via ${contact} dans les 48h suivant la réception. Nous vous proposerons un remplacement ou un remboursement sous 7 jours.</p>`
    }
  };
}


// ─── Cache-Control helper ─────────────────────────────────────────────────────
// AUCUN cache — ni CDN ni navigateur. Avant on cachait jusqu'à 10 min côté CDN
// (Cloudflare) avec stale-while-revalidate, ce qui faisait que les marchands
// modifiaient leurs paramètres (pixel, thème, prix...) et ne voyaient le
// changement qu'après plusieurs minutes. Maintenant chaque requête tape Mongo
// directement (rapide grâce aux index). Cohérence > 50ms d'économie.
//
// L'argument `_ttl` est conservé pour ne pas casser les appels existants.
function setCacheHeaders(res, ttl = 0) {
  if (ttl > 0) {
    // CDN cache only: browsers/SW revalidate unless our own short app cache serves it.
    res.set('Cache-Control', `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl * 10}`);
  } else {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}

// ─── Helper: resolve workspace/store from subdomain param ────────────────────
async function resolveStore(subdomain) {
  if (!subdomain) return null;

  const clean = subdomain.toLowerCase().trim();

  const cached = getCachedStore(clean);
  if (cached) return cached;

  // 1. Try Store model first (multi-store)
  const store = await Store.findOne({
    subdomain: clean,
    isActive: { $ne: false },
    'storeSettings.isStoreEnabled': { $ne: false }
  })
  .select('_id workspaceId name subdomain storeSettings storeTheme storePages storeFooter storeLegalPages storePixels storePayments storeDomains storeDeliveryZones whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoAudioUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoSendOrder whatsappAutoProductMediaRules updatedAt')
  .lean()
  .maxTimeMS(1000);

  if (store) {
    // _storeId = real Store document _id
    // _workspaceId = parent workspace
    // _id is intentionally kept as the Store._id (NOT overwritten to workspaceId).
    // Some callers use workspace._id for workspace-level queries — they must use _workspaceId.
    const result = { ...store, _storeId: store._id, _workspaceId: store.workspaceId };
    setCachedStore(clean, result);
    return result;
  }

  // 2. Fallback: legacy Workspace (pre-migration or single-store)
  const workspace = await Workspace.findOne({
    subdomain: clean,
    isActive: { $ne: false },
    'storeSettings.isStoreEnabled': { $ne: false }
  })
  .select('_id name subdomain storeSettings storeTheme storePages storeFooter storeLegalPages storePixels storePayments storeDomains storeDeliveryZones whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoAudioUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoSendOrder whatsappAutoProductMediaRules updatedAt')
  .lean()
  .maxTimeMS(1000);

  if (workspace) {
    const result = { ...workspace, _workspaceId: workspace._id, _storeId: null };
    setCachedStore(clean, result);
    return result;
  }

  return null;
}

// Helper: get product filter for a resolved store (strict per-store isolation).
// Multi-store: ONLY products explicitly assigned to this storeId.
//   → storeId:null products are NOT shown (they belong to no specific store).
// Legacy (no storeId on the store doc): scope by workspaceId only.
function getProductFilter(resolvedStore) {
  if (resolvedStore._storeId) {
    return {
      workspaceId: resolvedStore._workspaceId,
      storeId: resolvedStore._storeId,
    };
  }
  return { workspaceId: resolvedStore._workspaceId };
}

const PUBLIC_PRODUCT_LIST_PROJECT = {
  name: 1,
  slug: 1,
  price: 1,
  compareAtPrice: 1,
  currency: 1,
  country: 1,
  targetMarket: 1,
  city: 1,
  locale: 1,
  stock: 1,
  images: 1,
  category: 1,
  tags: 1,
  createdAt: 1,
};

const PUBLIC_DB_TIMEOUT_MS = 2500;

function withPublicTimeout(promise, label, timeoutMs = PUBLIC_DB_TIMEOUT_MS) {
  let timer = null;
  return new Promise((resolve, reject) => {
    let settled = false;
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error(`${label} timed out after ${timeoutMs}ms`);
      error.statusCode = 503;
      reject(error);
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sendPublicError(res, error, fallbackMessage) {
  const message = error?.message || '';
  const isTimeout = error?.statusCode === 503 || /timed out|timeout|maxTimeMS/i.test(message);
  return res.status(isTimeout ? 503 : 500).json({
    success: false,
    message: isTimeout ? 'Boutique temporairement indisponible. Réessayez dans quelques secondes.' : fallbackMessage,
    code: isTimeout ? 'STORE_TEMPORARILY_UNAVAILABLE' : 'STORE_ERROR'
  });
}

function parsePublicProductSort(sort = '-createdAt') {
  const raw = String(sort || '-createdAt').trim();
  const direction = raw.startsWith('-') ? -1 : 1;
  const field = raw.replace(/^-/, '');
  const allowed = new Set(['createdAt', 'price', 'name', 'category']);
  return { [allowed.has(field) ? field : 'createdAt']: direction };
}

function toLightProduct(p, storeCurrency = 'XAF') {
  return {
    _id: p._id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    currency: p.currency || storeCurrency,
    country: p.country || '',
    targetMarket: p.targetMarket || '',
    city: p.city || '',
    locale: p.locale || '',
    stock: p.stock,
    image: p.images?.[0]?.url || '',
    category: p.category,
    createdAt: p.createdAt,
  };
}

/**
 * GET /api/store/resolve-domain/:hostname
 *
 * Resolves a custom domain to the workspace subdomain.
 * Called by useSubdomain() hook when a non-scalor.net hostname is detected.
 */
router.get('/resolve-domain/:hostname', readLimiter, async (req, res) => {
  try {
    const hostname = (req.params.hostname || '').toLowerCase().trim();
    if (!hostname || hostname.length > 253) {
      return res.status(400).json({ success: false, message: 'Invalid hostname' });
    }

    // Look up store by custom domain — check Store first, then Workspace (legacy)
    let foundSubdomain = null, foundName = null;
    const storeByDomain = await withPublicTimeout(Store.findOne({
      'storeDomains.customDomain': hostname,
      isActive: { $ne: false },
      'storeSettings.isStoreEnabled': { $ne: false }
    }).select('subdomain name storeSettings.storeName').lean().maxTimeMS(1000), 'resolve custom store domain');
    if (storeByDomain?.subdomain) {
      foundSubdomain = storeByDomain.subdomain;
      foundName = storeByDomain.storeSettings?.storeName || storeByDomain.name;
    } else {
      const workspace = await withPublicTimeout(Workspace.findOne({
        'storeDomains.customDomain': hostname,
        isActive: { $ne: false },
        'storeSettings.isStoreEnabled': { $ne: false }
      }).select('subdomain name storeSettings.storeName').lean().maxTimeMS(1000), 'resolve custom workspace domain');
      if (workspace?.subdomain) {
        foundSubdomain = workspace.subdomain;
        foundName = workspace.storeSettings?.storeName || workspace.name;
      }
    }

    if (!foundSubdomain) {
      return res.status(404).json({
        success: false,
        message: 'Domain not linked to any store',
        code: 'DOMAIN_NOT_FOUND'
      });
    }

    setCacheHeaders(res, 60); // Cache for 1 minute
    res.json({
      success: true,
      data: { subdomain: foundSubdomain, storeName: foundName }
    });
  } catch (error) {
    console.error('Error GET /api/store/resolve-domain:', error);
    sendPublicError(res, error, 'Error resolving domain');
  }
});

/**
 * GET /api/store/:subdomain
 *
 * Returns store configuration + initial products in a single call.
 * This is the FIRST call the React SPA makes after loading.
 * Combines store info + products to minimize round-trips (critical for African markets).
 */
router.get('/:subdomain', readLimiter, async (req, res) => {
  try {
    const subdomainKey = normalizeSubdomainKey(req.params.subdomain);
    const cacheKey = `${subdomainKey}:home`;
    const cached = shouldBypassResponseCache(req) ? null : getCachedResponse(cacheKey);
    if (cached) {
      setCacheHeaders(res, 30);
      res.set('X-Scalor-Cache', 'HIT');
      return res.json(cached);
    }

    const workspace = await withPublicTimeout(resolveStore(req.params.subdomain), 'resolve public store');

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
        code: 'STORE_NOT_FOUND'
      });
    }

    const settings = workspace.storeSettings || {};
    const prodFilter = getProductFilter(workspace);

    const [homeFacet] = await withPublicTimeout(StoreProduct.aggregate([
      { $match: { ...prodFilter, isPublished: true } },
      {
        $facet: {
          products: [
            { $sort: { createdAt: -1 } },
            { $limit: 20 },
            { $project: PUBLIC_PRODUCT_LIST_PROJECT },
          ],
          categories: [
            { $match: { category: { $ne: '' } } },
            { $group: { _id: '$category' } },
            { $sort: { _id: 1 } },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).option({ maxTimeMS: 1500 }), 'load public store home');

    const products = homeFacet?.products || [];
    const categories = (homeFacet?.categories || []).map((item) => item._id).filter(Boolean);
    const totalProducts = homeFacet?.total?.[0]?.count || 0;

    const storeCurrency = settings.storeCurrency || settings.currency || 'XAF';

    // Per-product currency/country overrides the store default (multi-market support).
    const lightProducts = products.map((p) => toLightProduct(p, storeCurrency));

    const theme = workspace.storeTheme || {};
    const sectionColors = {
      socialProof: theme.sectionColors?.socialProof || theme.accentColor || theme.primaryColor || '#7C3AED',
      benefits: theme.sectionColors?.benefits || theme.primaryColor || '#0F6B4F',
      trust: theme.sectionColors?.trust || theme.accentColor || theme.primaryColor || '#2563EB',
      problem: theme.sectionColors?.problem || theme.errorColor || '#DC2626',
      solution: theme.sectionColors?.solution || theme.primaryColor || '#059669',
      faq: theme.sectionColors?.faq || theme.accentColor || theme.primaryColor || '#7C3AED',
    };
    const pages = workspace.storePages;  // intentional: null if never set
    const pixels = workspace.storePixels || {};
    const deliveryConfig = workspace.storeDeliveryZones || { countries: [], zones: [] };
    const publicDeliveryZones = (deliveryConfig.zones || [])
      .filter((zone) => zone?.enabled !== false)
      .map((zone) => ({
        id: zone.id,
        country: zone.country,
        city: zone.city,
        aliases: zone.aliases || [],
        cost: zone.cost || 0,
      }));

    // 30s CDN cache — short enough that config changes show within one reload
    setCacheHeaders(res, 30);

    let payload = {
      success: true,
      data: {
        store: {
          _id: workspace._id,
          configVersion: workspace.updatedAt ? new Date(workspace.updatedAt).getTime() : null,
          name: settings.name || settings.storeName || workspace.name,
          description: settings.description || settings.storeDescription || '',
          logo: settings.logo || settings.storeLogo || '',
          banner: settings.banner || settings.storeBanner || '',
          phone: settings.phone || settings.storePhone || '',
          whatsapp: settings.whatsapp || settings.storeWhatsApp || '',
          themeColor: settings.themeColor || settings.storeThemeColor || '#0F6B4F',
          currency: settings.storeCurrency || settings.currency || 'XAF',
          language: settings.language || 'fr',
          country: settings.country || settings.storeCountry || '',
          subdomain: workspace.subdomain,
          // Theme config - PRIORITÉ AUX SETTINGS (configurés dans /boutique/settings)
          template: theme.template || 'classic',
          primaryColor: settings.primaryColor || settings.storeThemeColor || theme.primaryColor || '#0F6B4F',
          accentColor: settings.accentColor || settings.ctaColor || theme.accentColor || theme.ctaColor || '#059669',
          backgroundColor: settings.backgroundColor || theme.backgroundColor || '#FFFFFF',
          textColor: settings.textColor || theme.textColor || '#111827',
          font: settings.font || theme.font || 'inter',
          borderRadius: theme.borderRadius || 'lg',
          sectionColors,
          sectionToggles: theme.sections || {},
          // Settings extras
          email: settings.email || '',
          address: settings.address || '',
          facebook: settings.facebook || '',
          instagram: settings.instagram || '',
          tiktok: settings.tiktok || '',
          seoTitle: settings.seoTitle || '',
          seoDescription: settings.seoDescription || '',
          announcement: settings.announcement || '',
          announcementEnabled: settings.announcementEnabled || false,
          deliveryCountries: deliveryConfig.countries || [],
          deliveryZones: publicDeliveryZones,
          flatShippingEnabled: deliveryConfig.flatShippingEnabled === true,
          flatShippingFee: Math.max(0, Number(deliveryConfig.flatShippingFee) || 0),
          freeShippingThreshold: Math.max(0, Number(deliveryConfig.freeShippingThreshold) || 0),
          productPageConfig: settings.productPageConfig || theme.productPageConfig || null,
        },
        // Page sections: null = never configured (use defaults), [] = builder empty page
        sections: pages ? (pages.sections ?? null) : null,
        // Footer config (AI-generated)
        footer: workspace.storeFooter || null,
        // Legal pages content (AI-generated, with inline fallback if never generated)
        legalPages: workspace.storeLegalPages || buildDefaultLegalPages(settings, workspace),
        // Pixel IDs for tracking injection
        pixels: {
          metaPixelId: pixels.metaPixelId || '',
          tiktokPixelId: pixels.tiktokPixelId || '',
          googleTagId: pixels.googleTagId || '',
          googleAdsId: pixels.googleAdsId || '',
          snapchatPixelId: pixels.snapchatPixelId || pixels.snapPixelId || '',
        },
        products: lightProducts,
        categories,
        pagination: {
          page: 1,
          limit: 20,
          total: totalProducts,
          pages: Math.ceil(totalProducts / 20)
        }
      }
    };

    payload = rewriteMediaUrls(payload);
    setCachedResponse(cacheKey, payload, PUBLIC_HOME_CACHE_TTL);
    res.set('X-Scalor-Cache', 'MISS');
    res.json(payload);

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain error:', error.message);
    sendPublicError(res, error, 'Error loading store');
  }
});

/**
 * GET /api/store/:subdomain/products
 *
 * Paginated product listing with search/filter.
 * Query params: page, limit, category, search, sort
 */
router.get('/:subdomain/products', readLimiter, async (req, res) => {
  try {
    const subdomainKey = normalizeSubdomainKey(req.params.subdomain);
    const queryKey = stableQueryKey(req.query);
    const cacheKey = `${subdomainKey}:products:${queryKey}`;
    const cached = shouldBypassResponseCache(req) ? null : getCachedResponse(cacheKey);
    if (cached) {
      setCacheHeaders(res, req.query.search ? 30 : 60);
      res.set('X-Scalor-Cache', 'HIT');
      return res.json(cached);
    }

    const workspace = await withPublicTimeout(resolveStore(req.params.subdomain), 'resolve public store');
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { page = 1, limit = 20, category, search, sort = '-createdAt' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));

    const filter = { ...getProductFilter(workspace), isPublished: true };

    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (pageNum - 1) * limitNum;

    const [listingFacet] = await withPublicTimeout(StoreProduct.aggregate([
      { $match: filter },
      {
        $facet: {
          products: [
            { $sort: parsePublicProductSort(sort) },
            { $skip: skip },
            { $limit: limitNum },
            { $project: PUBLIC_PRODUCT_LIST_PROJECT },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]).option({ maxTimeMS: 1500 }), 'load public products');

    const products = listingFacet?.products || [];
    const total = listingFacet?.total?.[0]?.count || 0;

    const storeCurrencyPag = workspace.storeSettings?.storeCurrency || workspace.storeSettings?.currency || 'XAF';
    const lightProducts = products.map((p) => toLightProduct(p, storeCurrencyPag));

    // Cache at Cloudflare edge — 30s so product/stock changes reflect quickly
    setCacheHeaders(res, search ? 30 : 60);

    let payload = {
      success: true,
      data: {
        products: lightProducts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    };

    payload = rewriteMediaUrls(payload);
    setCachedResponse(cacheKey, payload, PUBLIC_PRODUCTS_CACHE_TTL);
    res.set('X-Scalor-Cache', 'MISS');
    res.json(payload);

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/products error:', error.message);
    sendPublicError(res, error, 'Error loading products');
  }
});

/**
 * GET /api/store/:subdomain/products/:slug
 *
 * Full product detail by slug.
 */
router.get('/:subdomain/products/:slug', readLimiter, async (req, res) => {
  try {
    const subdomainKey = normalizeSubdomainKey(req.params.subdomain);
    const slugKey = String(req.params.slug || '').toLowerCase().trim();
    const cacheKey = `${subdomainKey}:product:${slugKey}`;
    const cached = shouldBypassResponseCache(req) ? null : getCachedResponse(cacheKey);
    if (cached) {
      setCacheHeaders(res, 60);
      res.set('X-Scalor-Cache', 'HIT');
      return res.json(cached);
    }

    const workspace = await withPublicTimeout(resolveStore(req.params.subdomain), 'resolve public store');
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await StoreProduct.findOne({
      ...getProductFilter(workspace),
      slug: req.params.slug,
      isPublished: true
    })
    .select('name slug description price compareAtPrice currency country targetMarket city locale stock images category tags seoTitle seoDescription features faq testimonials _pageData productPageConfig')
    .lean()
    .maxTimeMS(1200);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Fetch quantity offers in parallel with response preparation
    const quantityOfferPromise = QuantityOffer.findOne({
      workspaceId: workspace._workspaceId || workspace._id,
      productId: product._id,
      isActive: true
    }).select('offers design').sort({ createdAt: -1 }).lean().maxTimeMS(800);

    const quantityOffer = await withPublicTimeout(quantityOfferPromise, 'load quantity offer', 1200);

    setCacheHeaders(res, 60);

    // Per-product-page currency/country ALWAYS override the store's global config.
    // Why: a single store can publish multiple product pages, each targeting a different market.
    const productCurrency = product.currency || workspace.storeSettings?.storeCurrency || workspace.storeSettings?.currency || 'XAF';
    const productCountry = product.country || workspace.storeSettings?.country || '';
    const productLocale = product.locale || workspace.storeSettings?.locale || '';

    let payload = {
      success: true,
      data: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: productCurrency,
        country: productCountry,
        targetMarket: product.targetMarket || '',
        city: product.city || '',
        locale: productLocale,
        stock: product.stock,
        images: product.images || [],
        category: product.category,
        tags: product.tags,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        features: product.features || [],
        faq: product.faq || [],
        testimonials: product.testimonials || [],
        _pageData: product._pageData || null,
        productPageConfig: product.productPageConfig || null,
        ...(quantityOffer?.offers?.length > 0 ? {
          quantityOffers: quantityOffer.offers.map((o, i) => ({
            qty: o.quantity,
            price: o.price,
            comparePrice: o.compare_price || 0,
            badge: o.label || '',
            selected: i === (quantityOffer.design?.highlight_offer ?? 0),
          })),
          ...(quantityOffer.design ? { quantityOfferDesign: quantityOffer.design } : {})
        } : {})
      }
    };

    payload = rewriteMediaUrls(payload);
    setCachedResponse(cacheKey, payload, PUBLIC_PRODUCT_PAGE_CACHE_TTL);
    res.set('X-Scalor-Cache', 'MISS');
    res.json(payload);

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/products/:slug error:', error.message);
    sendPublicError(res, error, 'Error loading product');
  }
});

/**
 * GET /api/store/:subdomain/categories
 */
router.get('/:subdomain/categories', readLimiter, async (req, res) => {
  try {
    const subdomainKey = normalizeSubdomainKey(req.params.subdomain);
    const cacheKey = `${subdomainKey}:categories`;
    const cached = shouldBypassResponseCache(req) ? null : getCachedResponse(cacheKey);
    if (cached) {
      setCacheHeaders(res, 600);
      res.set('X-Scalor-Cache', 'HIT');
      return res.json(cached);
    }

    const workspace = await withPublicTimeout(resolveStore(req.params.subdomain), 'resolve public store');
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const categories = await withPublicTimeout(StoreProduct.distinct('category', {
      ...getProductFilter(workspace),
      isPublished: true,
      category: { $ne: '' }
    }).maxTimeMS(1200), 'load public categories');

    // Categories rarely change — cache 10 minutes
    setCacheHeaders(res, 600);
    let payload = { success: true, data: categories.sort() };
    payload = rewriteMediaUrls(payload);
    setCachedResponse(cacheKey, payload, PUBLIC_CATEGORIES_CACHE_TTL);
    res.set('X-Scalor-Cache', 'MISS');
    res.json(payload);

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/categories error:', error.message);
    sendPublicError(res, error, 'Error loading categories');
  }
});

/**
 * GET /api/store/:subdomain/product-page/:slug
 *
 * Single-call endpoint for product pages: returns store config + full product data.
 * Replaces 2 sequential API calls with 1 — critical for 4G latency in African markets.
 * Store data served from in-memory cache (5min TTL), product fetched fresh.
 */
router.get('/:subdomain/product-page/:slug', readLimiter, async (req, res) => {
  try {
    const subdomainKey = normalizeSubdomainKey(req.params.subdomain);
    const slugKey = String(req.params.slug || '').toLowerCase().trim();
    const cacheKey = `${subdomainKey}:product-page:${slugKey}`;
    const cached = shouldBypassResponseCache(req) ? null : getCachedResponse(cacheKey);
    if (cached) {
      setCacheHeaders(res, 60);
      res.set('X-Scalor-Cache', 'HIT');
      return res.json(cached);
    }

    const workspace = await withPublicTimeout(resolveStore(req.params.subdomain), 'resolve public store');
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const productFilter = {
      ...getProductFilter(workspace),
      slug: req.params.slug,
      isPublished: true,
    };

    // Résoudre l'_id du produit d'abord (requête ultra-légère sur index slug),
    // puis lancer le chargement complet + QuantityOffer en parallèle.
    const productIdDoc = await withPublicTimeout(
      StoreProduct.findOne(productFilter).select('_id').lean().maxTimeMS(1000),
      'resolve public product id'
    );
    if (!productIdDoc) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const [product, quantityOffer] = await withPublicTimeout(Promise.all([
      StoreProduct.findById(productIdDoc._id)
        .select('name slug description price compareAtPrice currency country targetMarket city locale stock images category tags seoTitle seoDescription features faq testimonials _pageData productPageConfig')
        .lean()
        .maxTimeMS(1200),
      QuantityOffer.findOne({
        workspaceId: workspace._workspaceId || workspace._id,
        productId: productIdDoc._id,
        isActive: true,
      }).select('offers design productId').sort({ createdAt: -1 }).lean().maxTimeMS(800),
    ]), 'load public product page');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const settings = workspace.storeSettings || {};
    const theme = workspace.storeTheme || {};
    const sectionColors = {
      socialProof: theme.sectionColors?.socialProof || theme.accentColor || theme.primaryColor || '#7C3AED',
      benefits: theme.sectionColors?.benefits || theme.primaryColor || '#0F6B4F',
      trust: theme.sectionColors?.trust || theme.accentColor || theme.primaryColor || '#2563EB',
      problem: theme.sectionColors?.problem || theme.errorColor || '#DC2626',
      solution: theme.sectionColors?.solution || theme.primaryColor || '#059669',
      faq: theme.sectionColors?.faq || theme.accentColor || theme.primaryColor || '#7C3AED',
    };
    const pixels = workspace.storePixels || {};
    const deliveryConfig = workspace.storeDeliveryZones || { countries: [], zones: [] };
    const publicDeliveryZones = (deliveryConfig.zones || [])
      .filter((zone) => zone?.enabled !== false)
      .map((zone) => ({ id: zone.id, country: zone.country, city: zone.city, aliases: zone.aliases || [], cost: zone.cost || 0 }));

    const productCurrency = product.currency || settings.storeCurrency || settings.currency || 'XAF';
    const productCountry = product.country || settings.country || '';

    const productData = {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: productCurrency,
      country: productCountry,
      targetMarket: product.targetMarket || '',
      city: product.city || '',
      locale: product.locale || settings.locale || '',
      stock: product.stock,
      images: product.images || [],
      category: product.category,
      tags: product.tags,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      features: product.features || [],
      faq: product.faq || [],
      testimonials: product.testimonials || [],
      _pageData: product._pageData || null,
      productPageConfig: product.productPageConfig || null,
    };

    if (quantityOffer?.offers?.length > 0) {
      productData.quantityOffers = quantityOffer.offers.map((o, i) => ({
        qty: o.quantity,
        price: o.price,
        comparePrice: o.compare_price || 0,
        badge: o.label || '',
        selected: i === (quantityOffer.design?.highlight_offer ?? 0),
      }));
      if (quantityOffer.design) productData.quantityOfferDesign = quantityOffer.design;
    }

    // 5min CDN cache + stale-while-revalidate=3600s.
    // invalidateStoreCache() est appelé immédiatement sur save admin → pas de données périmées.
    setCacheHeaders(res, 300);

    let payload = {
      success: true,
      data: {
        store: {
          _id: workspace._id,
          name: settings.name || settings.storeName || workspace.name,
          description: settings.description || settings.storeDescription || '',
          logo: settings.logo || settings.storeLogo || '',
          banner: settings.banner || settings.storeBanner || '',
          phone: settings.phone || settings.storePhone || '',
          whatsapp: settings.whatsapp || settings.storeWhatsApp || '',
          themeColor: settings.themeColor || settings.storeThemeColor || '#0F6B4F',
          currency: settings.storeCurrency || settings.currency || 'XAF',
          language: settings.language || 'fr',
          country: settings.country || settings.storeCountry || '',
          subdomain: workspace.subdomain,
          template: theme.template || 'classic',
          primaryColor: settings.primaryColor || settings.storeThemeColor || theme.primaryColor || '#0F6B4F',
          accentColor: settings.accentColor || settings.ctaColor || theme.accentColor || theme.ctaColor || '#059669',
          backgroundColor: settings.backgroundColor || theme.backgroundColor || '#FFFFFF',
          textColor: settings.textColor || theme.textColor || '#111827',
          font: settings.font || theme.font || 'inter',
          borderRadius: theme.borderRadius || 'lg',
          sectionColors,
          sectionToggles: theme.sections || {},
          email: settings.email || '',
          address: settings.address || '',
          facebook: settings.facebook || '',
          instagram: settings.instagram || '',
          tiktok: settings.tiktok || '',
          seoTitle: settings.seoTitle || '',
          seoDescription: settings.seoDescription || '',
          announcement: settings.announcement || '',
          announcementEnabled: settings.announcementEnabled || false,
          deliveryCountries: deliveryConfig.countries || [],
          deliveryZones: publicDeliveryZones,
          flatShippingEnabled: deliveryConfig.flatShippingEnabled === true,
          flatShippingFee: Math.max(0, Number(deliveryConfig.flatShippingFee) || 0),
          freeShippingThreshold: Math.max(0, Number(deliveryConfig.freeShippingThreshold) || 0),
          productPageConfig: settings.productPageConfig || theme.productPageConfig || null,
        },
        product: productData,
        pixels: {
          metaPixelId: pixels.metaPixelId || '',
          tiktokPixelId: pixels.tiktokPixelId || '',
          googleTagId: pixels.googleTagId || '',
          googleAdsId: pixels.googleAdsId || '',
          snapchatPixelId: pixels.snapchatPixelId || pixels.snapPixelId || '',
        },
        footer: workspace.storeFooter || null,
      },
    };

    payload = rewriteMediaUrls(payload);
    setCachedResponse(cacheKey, payload, PUBLIC_PRODUCT_PAGE_CACHE_TTL);
    res.set('X-Scalor-Cache', 'MISS');
    res.json(payload);
  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/product-page/:slug error:', error.message);
    sendPublicError(res, error, 'Error loading product page');
  }
});

/**
 * POST /api/store/:subdomain/track
 *
 * Public storefront tracking bridge for Meta CAPI deduplicated events.
 */
router.post('/:subdomain/track', trackLimiter, async (req, res) => {
  try {
    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const {
      eventName,
      eventId,
      eventSourceUrl,
      customData,
      userData,
    } = req.body || {};

    if (!isSupportedMetaEvent(eventName)) {
      return res.status(400).json({ success: false, message: 'Unsupported event name' });
    }

    const metaAccessToken = workspace.storePixels?.metaAccessToken;
    const metaPixelId = workspace.storePixels?.metaPixelId;
    if (!metaAccessToken || !metaPixelId) {
      return res.status(202).json({ success: true, skipped: true, reason: 'meta-not-configured' });
    }

    const clientIpAddress = (req.headers['x-forwarded-for'] || req.ip || '')
      .toString()
      .split(',')[0]
      .trim();
    const clientUserAgent = req.get('user-agent') || '';
    const normalizedUserData = buildMetaUserData(
      {
        ...(userData || {}),
        fbp: userData?.fbp || req.cookies?._fbp,
        fbc: userData?.fbc || req.cookies?._fbc,
      },
      { clientIpAddress, clientUserAgent },
    );

    const payload = buildMetaEventPayload({
      eventName,
      eventId,
      eventSourceUrl,
      userData: normalizedUserData,
      customData,
    });

    await sendMetaCapiEvent({
      pixelId: metaPixelId,
      accessToken: metaAccessToken,
      eventPayload: payload,
    });

    return res.status(202).json({ success: true, deduplicated: Boolean(eventId) });
  } catch (error) {
    console.warn('⚠️ POST /api/store/:subdomain/track error:', error.message);
    return res.status(202).json({ success: true, skipped: true, reason: 'tracking-error' });
  }
});

/**
 * POST /api/store/:subdomain/abandoned-checkout
 *
 * Captures a recoverable checkout before the final "Commander" click.
 * It does not decrement stock, does not create the internal fulfillment Order,
 * and does not trigger customer confirmation messages.
 */
router.post('/:subdomain/abandoned-checkout', checkoutDraftLimiter, async (req, res) => {
  try {
    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const {
      checkoutSessionId,
      customerName,
      phone,
      phoneCode,
      email,
      address,
      city,
      country,
      products,
      notes,
      deliveryType,
      deliveryCost,
      affiliateCode,
      affiliateLinkCode,
      metaSourceUrl,
    } = req.body || {};

    const sessionId = normalizeCheckoutSessionId(checkoutSessionId);
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session checkout requise' });
    }

    const phoneDigits = normalizePhoneDigits(phone);
    if (phoneDigits.length < 6) {
      return res.status(202).json({ success: true, skipped: true, reason: 'phone_incomplete' });
    }

    const requestedProducts = Array.isArray(products)
      ? products
          .map((item) => ({
            productId: String(item?.productId || item?._id || '').trim(),
            quantity: Math.max(1, parseInt(item?.quantity, 10) || 1),
          }))
          .filter((item) => mongoose.Types.ObjectId.isValid(item.productId))
      : [];

    if (requestedProducts.length === 0) {
      return res.status(202).json({ success: true, skipped: true, reason: 'missing_products' });
    }

    const workspaceId = workspace._workspaceId || workspace._id;
    const storeId = workspace._storeId || null;

    const completedCheckout = await StoreOrder.findOne({
      workspaceId,
      storeId,
      checkoutSessionId: sessionId,
      status: { $ne: 'abandoned' },
    }).select('_id status').lean();

    if (completedCheckout) {
      return res.status(202).json({ success: true, skipped: true, reason: 'already_completed' });
    }

    const productIds = [...new Set(requestedProducts.map((item) => item.productId))];
    const productFetchFilter = {
      _id: { $in: productIds },
      workspaceId,
      isPublished: true,
    };
    if (storeId) productFetchFilter.storeId = storeId;

    const dbProducts = await StoreProduct.find(productFetchFilter).lean();
    const productMap = new Map(dbProducts.map((product) => [product._id.toString(), product]));

    const orderCurrencies = new Set();
    const orderProducts = [];
    let subtotal = 0;

    for (const item of requestedProducts) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) continue;
      const quantity = Math.max(1, item.quantity || 1);
      const price = Number(dbProduct.price) || 0;
      orderProducts.push({
        productId: dbProduct._id,
        name: dbProduct.name,
        price,
        quantity,
        image: dbProduct.images?.[0]?.url || '',
      });
      subtotal += price * quantity;
      if (dbProduct.currency) {
        orderCurrencies.add(String(dbProduct.currency).trim().toUpperCase());
      }
    }

    if (orderProducts.length === 0) {
      return res.status(202).json({ success: true, skipped: true, reason: 'products_unavailable' });
    }

    const sanitizedDeliveryCost = Math.max(0, Number(deliveryCost) || 0);
    const resolvedCurrency = orderCurrencies.size === 1
      ? Array.from(orderCurrencies)[0]
      : (workspace.storeSettings?.storeCurrency || 'XAF');
    const resolvedCountry = cleanText(country, 120)
      || workspace.storeSettings?.country
      || workspace.storeSettings?.storeCountry
      || '';
    const sanitizedDeliveryType = ['livraison', 'expedition'].includes(deliveryType) ? deliveryType : '';
    const customerLabel = cleanText(customerName, 200) || 'Client potentiel';

    const abandonedOrder = await StoreOrder.findOneAndUpdate(
      {
        workspaceId,
        storeId,
        checkoutSessionId: sessionId,
        status: 'abandoned',
      },
      {
        $set: {
          customerName: customerLabel,
          phone: cleanText(phone, 40),
          phoneCode: cleanText(phoneCode, 12),
          email: cleanText(email, 180).toLowerCase(),
          address: cleanText(address, 500),
          city: cleanText(city, 120),
          country: resolvedCountry,
          deliveryZone: cleanText(city, 120),
          deliveryType: sanitizedDeliveryType,
          deliveryCost: sanitizedDeliveryCost,
          products: orderProducts,
          total: subtotal + sanitizedDeliveryCost,
          currency: resolvedCurrency,
          channel: 'store',
          status: 'abandoned',
          notes: cleanText(notes, 1000),
          affiliateCode: normalizeCode(affiliateCode),
          affiliateLinkCode: normalizeCode(affiliateLinkCode),
          abandonedAt: new Date(),
          completedAt: null,
          rawData: {
            checkoutSessionId: sessionId,
            metaSourceUrl: cleanText(metaSourceUrl, 1000),
            capturedFrom: 'store_checkout_autosave',
          },
        },
        $setOnInsert: {
          workspaceId,
          storeId,
          checkoutSessionId: sessionId,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(202).json({
      success: true,
      data: {
        id: abandonedOrder?._id,
        status: 'abandoned',
      },
    });
  } catch (error) {
    console.warn('⚠️ POST /api/store/:subdomain/abandoned-checkout error:', error.message);
    return res.status(202).json({ success: true, skipped: true, reason: 'capture_error' });
  }
});

/**
 * POST /api/store/:subdomain/orders
 *
 * Guest checkout — place a public order without authentication.
 * Validates stock, creates order, decrements stock atomically.
 */
router.post('/:subdomain/orders', orderLimiter, async (req, res) => {
  try {
    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    // Check plan order limit before accepting the order
    const workspaceId = workspace._workspaceId;
    const ws = await Workspace.findById(workspaceId).select('plan planExpiresAt trialEndsAt').lean();
    let effectivePlan = ws?.plan || 'free';
    if (effectivePlan !== 'free' && ws?.planExpiresAt && new Date(ws.planExpiresAt).getTime() < Date.now()) effectivePlan = 'free';
    if (effectivePlan === 'free' && ws?.trialEndsAt && new Date(ws.trialEndsAt).getTime() > Date.now()) effectivePlan = 'starter';
    const { limits: planLimits } = await getPlanRuntimeSnapshot(effectivePlan);
    if (planLimits.maxOrders !== null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthCount = await Order.countDocuments({ workspaceId, createdAt: { $gte: startOfMonth } });
      if (monthCount >= planLimits.maxOrders) {
        notifyOrderLimitReached(workspaceId, { used: monthCount, limit: planLimits.maxOrders }).catch(() => {});
        return res.status(403).json({
          success: false,
          error: 'STORE_ORDER_LIMIT_REACHED',
          message: 'Cette boutique ne peut plus recevoir de commandes ce mois-ci. Veuillez réessayer le mois prochain ou contacter le vendeur.'
        });
      }
    }

    const { customerName, phone, phoneCode, email, address, city, country, products, notes, channel, deliveryType, deliveryCost, orderBump, metaEventId, metaSourceUrl, affiliateCode, affiliateLinkCode, checkoutSessionId } = req.body;

    if (!customerName || !phone || !products?.length) {
      return res.status(400).json({
        success: false,
        message: 'Nom, téléphone et au moins un produit requis'
      });
    }

    const sessionId = normalizeCheckoutSessionId(checkoutSessionId);
    if (sessionId) {
      const existingCompletedCheckout = await StoreOrder.findOne({
        workspaceId: workspace._workspaceId || workspace._id,
        storeId: workspace._storeId || null,
        checkoutSessionId: sessionId,
        status: { $ne: 'abandoned' },
      }).select('orderNumber total currency status').lean();

      if (existingCompletedCheckout) {
        return res.status(200).json({
          success: true,
          message: 'Commande déjà enregistrée',
          data: {
            orderNumber: existingCompletedCheckout.orderNumber,
            total: existingCompletedCheckout.total,
            currency: existingCompletedCheckout.currency,
            status: existingCompletedCheckout.status,
          },
        });
      }
    }

    // Validate products exist and belong to this exact store
    const productIds = products.map(p => p.productId);
    const productFetchFilter = {
      _id: { $in: productIds },
      workspaceId: workspace._workspaceId,
      isPublished: true,
    };
    if (workspace._storeId) {
      productFetchFilter.storeId = workspace._storeId;
    }
    const dbProducts = await StoreProduct.find(productFetchFilter).lean();

    if (dbProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        message: 'Un ou plusieurs produits sont introuvables'
      });
    }

    const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
    let total = 0;
    const orderProducts = [];
    const orderCurrencies = new Set();

    // Load store productPageConfig for offer validation
    const storeSettings = workspace.storeSettings || {};
    const ppConversion = storeSettings.productPageConfig?.conversion || {};
    const storeOffers = ppConversion.offersEnabled ? (ppConversion.offers || []) : [];

    for (const item of products) {
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        return res.status(400).json({
          success: false,
          message: `Produit ${item.productId} introuvable`
        });
      }

      const qty = Math.max(1, parseInt(item.quantity) || 1);
      if (dbProduct.stock < qty) {
        return res.status(400).json({
          success: false,
          message: `Stock insuffisant pour "${dbProduct.name}" (${dbProduct.stock} disponible)`
        });
      }

      // Check if an offer price was sent and validate it against configured offers
      // Merge store-level and per-product offers (per-product takes priority)
      const productConversion = dbProduct.productPageConfig?.conversion || {};
      const productOffers = productConversion.offersEnabled ? (productConversion.offers || []) : [];
      let validOffers = productOffers.length > 0 ? productOffers : storeOffers;

      // Also check QuantityOffer model (highest priority)
      const qtyOffer = await QuantityOffer.findOne({
        workspaceId: workspace._workspaceId || workspace._id,
        productId: dbProduct._id,
        isActive: true
      }).sort({ createdAt: -1 }).lean();
      if (qtyOffer?.offers?.length > 0) {
        validOffers = qtyOffer.offers.map(o => ({ qty: o.quantity, price: o.price }));
      }

      let itemTotal = dbProduct.price * qty;
      let effectiveUnitPrice = dbProduct.price;
      if (item.offerPrice != null && item.offerQty != null) {
        const matchingOffer = validOffers.find(o => o.qty === item.offerQty && o.price === item.offerPrice);
        if (matchingOffer) {
          itemTotal = matchingOffer.price;
          // Store the effective per-unit price so order snapshot math is consistent
          effectiveUnitPrice = Math.round(matchingOffer.price / qty);
        }
      }

      orderProducts.push({
        productId: dbProduct._id,
        name: dbProduct.name,
        price: effectiveUnitPrice,
        quantity: qty,
        image: dbProduct.images?.[0]?.url || ''
      });

      if (dbProduct.currency) {
        orderCurrencies.add(String(dbProduct.currency).trim().toUpperCase());
      }

      total += itemTotal;
    }

    // Validate and apply order bump if provided
    let sanitizedBumpPrice = 0;
    let orderBumpData = null;
    if (orderBump && orderBump.price > 0) {
      const firstProduct = dbProducts[0];
      const bumpConfig = firstProduct?.productPageConfig?.upsells?.bump;
      if (bumpConfig && bumpConfig.isActive && Number(bumpConfig.price) === Number(orderBump.price)) {
        sanitizedBumpPrice = Number(bumpConfig.price);
        orderBumpData = { title: bumpConfig.title || orderBump.title, price: sanitizedBumpPrice };
      }
    }

    const resolvedOrderCurrency = orderCurrencies.size === 1
      ? Array.from(orderCurrencies)[0]
      : (workspace.storeSettings?.storeCurrency || 'XAF');
    const resolvedCountry = country?.trim() || workspace.storeSettings?.country || workspace.storeSettings?.storeCountry || '';
    const sanitizedDeliveryType = ['livraison', 'expedition'].includes(deliveryType) ? deliveryType : '';
    const sanitizedDeliveryCost = Math.max(0, Number(deliveryCost) || 0);

    let order = null;

    if (sessionId) {
      order = await StoreOrder.findOne({
        workspaceId: workspace._workspaceId || workspace._id,
        storeId: workspace._storeId || null,
        checkoutSessionId: sessionId,
        status: 'abandoned',
      });
    }

    const orderPayload = {
      workspaceId: workspace._workspaceId || workspace._id,
      storeId: workspace._storeId || null,
      checkoutSessionId: sessionId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      phoneCode: phoneCode?.trim() || '',
      email: email?.trim() || '',
      address: address?.trim() || '',
      city: city?.trim() || '',
      country: resolvedCountry,
      deliveryType: sanitizedDeliveryType,
      deliveryCost: sanitizedDeliveryCost,
      deliveryZone: city?.trim() || '',
      products: orderProducts,
      total: total + sanitizedDeliveryCost + sanitizedBumpPrice,
      orderBump: orderBumpData,
      currency: resolvedOrderCurrency,
      channel: channel || 'store',
      status: 'pending',
      notes: notes?.trim() || '',
      affiliateCode: normalizeCode(affiliateCode),
      affiliateLinkCode: normalizeCode(affiliateLinkCode),
      completedAt: new Date(),
      rawData: {
        checkoutSessionId: sessionId,
        metaSourceUrl: cleanText(metaSourceUrl, 1000),
      },
    };

    if (order) {
      Object.assign(order, orderPayload);
    } else {
      order = new StoreOrder(orderPayload);
    }

    await order.save();

    // Decrement stock atomically (synchronous — must complete before confirming).
    // Scope filter by workspaceId to ensure we never touch another tenant's stock.
    const bulkOps = products.map(item => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), workspaceId: workspace._workspaceId },
        update: { $inc: { stock: -(parseInt(item.quantity) || 1) } }
      }
    }));
    await StoreProduct.bulkWrite(bulkOps);

    // ── Répondre immédiatement (comme un webhook Shopify) ────────────────────
    res.status(201).json({
      success: true,
      message: 'Commande passée avec succès',
      data: {
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency,
        status: order.status
      }
    });

    // ── Traitement asynchrone en arrière-plan (pattern webhook Shopify) ──────
    setImmediate(async () => {
      try {
        const workspaceId = workspace._workspaceId || workspace._id;

        // Créer ou récupérer la source "Scalor Store" pour ce workspace
        let orderSource = await OrderSource.findOne({
          workspaceId,
          'metadata.type': 'scalor_store'
        });

        if (!orderSource) {
          const adminUser = await EcomUser.findOne({
            workspaceId,
            role: { $in: ['ecom_admin', 'super_admin'] },
            isActive: true
          }).select('_id').lean();

          if (adminUser) {
            try {
              orderSource = await OrderSource.create({
                name: `Scalor Store`,
                description: `Commandes reçues via la boutique en ligne Scalor`,
                color: '#0F6B4F',
                icon: '🛒',
                workspaceId,
                createdBy: adminUser._id,
                isActive: true,
                metadata: { type: 'scalor_store', createdAt: new Date() }
              });
              console.log(`📦 [Scalor Store] Source créée: ${orderSource.name} (${orderSource._id})`);
            } catch (srcErr) {
              console.error(`❌ [Scalor Store] Erreur création OrderSource:`, srcErr.message);
            }
          }
        }

        // Dédoublonnage — évite les doublons si la route est appelée deux fois
        const existing = await Order.findOne({
          orderId: order.orderNumber,
          source: 'skelor',
          workspaceId
        }).lean();

        if (existing) {
          console.log(`ℹ️ [Scalor Store] Commande ${order.orderNumber} déjà existante, ignorée`);
          return;
        }

        // Construire le payload structuré — comme un webhook Shopify
        const shopifyStylePayload = {
          order_number: order.orderNumber,
          currency: order.currency,
          created_at: order.createdAt?.toISOString() || new Date().toISOString(),
          customer: {
            first_name: (order.customerName || '').split(' ')[0] || 'Client',
            last_name: (order.customerName || '').split(' ').slice(1).join(' ') || '',
            phone: order.phone,
            email: order.email || ''
          },
          shipping_address: {
            name: order.customerName,
            address1: order.address,
            city: order.city,
            country: order.country || ''
          },
          line_items: orderProducts.map(p => ({
            title: p.name,
            quantity: p.quantity,
            price: String(p.price),
            product_id: p.productId.toString()
          })),
          total_price: String(order.total),
          financial_status: 'pending',
          fulfillment_status: null,
          note: order.notes || '',
          channel: order.channel || 'store',
          delivery_type: order.deliveryType || '',
          delivery_cost: order.deliveryCost || 0
        };

        const productSummary = orderProducts.map(p => {
          const qty = p.quantity > 1 ? ` x${p.quantity}` : '';
          return `${p.name}${qty}`;
        }).join(', ');

        const normalizedPhone = order.phone.replace(/\D/g, '');
        const normalizedCityVal = normalizeCity(order.city || '');

        const mainOrder = new Order({
          workspaceId,
          sourceId: orderSource?._id || null,
          sourceName: orderSource?.name || 'Scalor Store',
          orderId: order.orderNumber,
          date: order.createdAt || new Date(),
          clientName: order.customerName,
          clientPhone: normalizedPhone || order.phone,
          clientPhoneNormalized: normalizedPhone || order.phone,
          city: normalizedCityVal || order.city,
          address: order.address,
          product: productSummary,
          quantity: orderProducts.reduce((sum, p) => sum + p.quantity, 0),
          price: order.total,
          currency: order.currency,
          status: 'pending',
          source: 'skelor',
          storeOrderId: order._id,
          affiliateCode: normalizeCode(order.affiliateCode || ''),
          affiliateLinkCode: normalizeCode(order.affiliateLinkCode || ''),
          notes: [order.orderNumber, order.notes].filter(Boolean).join(' — '),
          rawData: shopifyStylePayload
        });

        await mainOrder.save();

        // Attribution affiliée + conversion commission
        try {
          const conversion = await createAffiliateConversionFromOrder({
            affiliateCode: order.affiliateCode,
            affiliateLinkCode: order.affiliateLinkCode,
            workspaceId,
            storeOrder: order,
            order: mainOrder
          });

          if (conversion) {
            mainOrder.affiliateId = conversion.affiliateId;
            mainOrder.affiliateCode = conversion.affiliateCode;
            mainOrder.affiliateLinkCode = conversion.affiliateLinkCode;
            mainOrder.affiliateCommissionAmount = conversion.commissionAmount;
            await mainOrder.save();
          }
        } catch (affiliateErr) {
          console.warn('⚠️ [Scalor Store] Attribution affiliée échouée:', affiliateErr.message);
        }

        // Lier la StoreOrder à la Order principale
        order.linkedOrderId = mainOrder._id;
        await order.save();

        memCache.delByPrefix(`stats:${workspaceId.toString()}`);
        memCache.delByPrefix(`filterOpts:${workspaceId.toString()}`);

        console.log(`✅ [Scalor Store] Commande ${order.orderNumber} → Order créée (${mainOrder._id})`);

        // Track feature usage — find workspace owner to log userId
        EcomUser.findOne({ workspaceId }).select('_id').lean()
          .then(async (owner) => {
            if (owner) {
              const { default: FeatureUsageLog } = await import('../models/FeatureUsageLog.js');
              return FeatureUsageLog.create({
                workspaceId,
                userId: owner._id,
                feature: 'order_skelor',
                meta: {
                  orderSource: 'skelor',
                  orderTotal: mainOrder.price,
                  success: true
                }
              });
            }
          }).catch(() => {});

        // Notification interne
        notifyNewOrder(workspaceId, mainOrder)
          .catch(err => console.warn('⚠️ [Scalor Store] Notification échouée:', err.message));

        // WhatsApp auto-confirm au client
        if (mainOrder.clientPhone) {
          const { default: WorkspaceSettings } = await import('../models/WorkspaceSettings.js');
          const wsSettings = await WorkspaceSettings.findOne({ workspaceId }).select(
            'whatsappAutoConfirm whatsappAutoInstanceId whatsappOrderTemplate whatsappAutoImageUrl whatsappAutoAudioUrl'
          ).lean();
          const autoConfirm = workspace.whatsappAutoConfirm || wsSettings?.whatsappAutoConfirm || false;
          // WhatsApp au client géré par le hook Order.post('save') → sendOrderClientMessage
        }

        // ── Meta Conversions API ─────────────────────────────────────────────
        const metaAccessToken = workspace.storePixels?.metaAccessToken;
        const metaPixelId = workspace.storePixels?.metaPixelId;
        if (metaAccessToken && metaPixelId) {
          const [firstName = '', ...restNames] = String(customerName || '').trim().split(/\s+/);
          const lastName = restNames.join(' ');
          const payload = buildMetaEventPayload({
            eventName: 'Purchase',
            eventId: metaEventId || order._id.toString(),
            eventSourceUrl: metaSourceUrl,
            userData: buildMetaUserData(
              {
                phone: order.phone,
                email: order.email,
                firstName,
                lastName,
                city,
                country: resolvedCountry,
              },
              {
                clientIpAddress: (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim(),
                clientUserAgent: req.get('user-agent') || '',
              },
            ),
            customData: {
              value: order.total,
              currency: order.currency,
              order_id: order.orderNumber,
              content_type: 'product',
              content_ids: orderProducts.map((p) => p.productId.toString()),
              contents: orderProducts.map((p) => ({ id: p.productId.toString(), quantity: p.quantity })),
              num_items: orderProducts.reduce((sum, productItem) => sum + productItem.quantity, 0),
            },
          });

          sendMetaCapiEvent({
            pixelId: metaPixelId,
            accessToken: metaAccessToken,
            eventPayload: payload,
          }).catch(err => console.warn('⚠️ [Scalor Store] Meta CAPI error:', err.message));
        }
      } catch (asyncErr) {
        console.error(`❌ [Scalor Store] Erreur traitement async commande ${order.orderNumber}:`, asyncErr.message);
        console.error(asyncErr.stack);
      }
    });

  } catch (error) {
    console.error('❌ POST /api/store/:subdomain/orders error:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── Newsletter subscription ─────────────────────────────────────────────────
router.post('/:subdomain/newsletter', orderLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Email invalide' });
    }

    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const storeId = workspace._storeId || workspace._id;

    await NewsletterSubscriber.findOneAndUpdate(
      { storeId, email: email.toLowerCase().trim() },
      { isActive: true },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, message: 'Inscription réussie' });
  } catch (error) {
    console.error('❌ POST /api/store/:subdomain/newsletter error:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
