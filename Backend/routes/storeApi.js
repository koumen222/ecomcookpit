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

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop d\'événements de tracking, réessayez dans une minute.' },
});

// ─── Simple in-memory cache for workspace lookups ─────────────────────────────
const storeCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedStore(subdomain) {
  const entry = storeCache.get(subdomain);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    storeCache.delete(subdomain);
    return null;
  }
  return entry.data;
}

function setCachedStore(subdomain, data) {
  storeCache.set(subdomain, { data, expires: Date.now() + CACHE_TTL });
}

// Invalidate cache for a subdomain (called after admin saves config)
export function invalidateStoreCache(subdomain) {
  if (subdomain) storeCache.delete(subdomain.toLowerCase().trim());
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

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of storeCache.entries()) {
    if (now > value.expires) storeCache.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Cache-Control helper ─────────────────────────────────────────────────────
// public: Cloudflare (and any CDN) may cache
// s-maxage: CDN cache TTL (5 min)
// stale-while-revalidate: serve stale while fetching fresh (10 min)
// max-age=0: browser always revalidates (CDN handles caching, not the browser)
function setCacheHeaders(res, ttl = 300) {
  res.set('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}, max-age=0`);
}

// ─── Helper: resolve workspace/store from subdomain param ────────────────────
async function resolveStore(subdomain) {
  if (!subdomain) return null;

  const clean = subdomain.toLowerCase().trim();

  // Check cache
  let cached = getCachedStore(clean);
  if (cached) return cached;

  // 1. Try Store model first (multi-store)
  const store = await Store.findOne({
    subdomain: clean,
    isActive: true,
    'storeSettings.isStoreEnabled': true
  })
  .select('_id workspaceId name subdomain storeSettings storeTheme storePages storeFooter storeLegalPages storePixels storePayments storeDomains storeDeliveryZones whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoAudioUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoSendOrder whatsappAutoProductMediaRules')
  .lean();

  if (store) {
    const result = { ...store, _storeId: store._id, _workspaceId: store.workspaceId, _id: store.workspaceId };
    setCachedStore(clean, result);
    return result;
  }

  // 2. Fallback: legacy Workspace (pre-migration or disabled stores)
  const workspace = await Workspace.findOne({
    subdomain: clean,
    isActive: true,
    'storeSettings.isStoreEnabled': true
  })
  .select('_id name subdomain storeSettings storeTheme storePages storeFooter storeLegalPages storePixels storePayments storeDomains storeDeliveryZones whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoAudioUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoSendOrder whatsappAutoProductMediaRules')
  .lean();

  if (workspace) {
    const result = { ...workspace, _workspaceId: workspace._id, _storeId: null };
    setCachedStore(clean, result);
    return result;
  }

  return null;
}

// Helper: get product filter for a resolved store (supports multi-store + legacy)
function getProductFilter(resolvedStore) {
  if (resolvedStore._storeId) {
    // Multi-store: filter by storeId, or legacy products without storeId in same workspace
    return {
      $or: [
        { storeId: resolvedStore._storeId },
        { workspaceId: resolvedStore._workspaceId, storeId: null }
      ]
    };
  }
  // Legacy: filter by workspaceId only
  return { workspaceId: resolvedStore._workspaceId };
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
    const storeByDomain = await Store.findOne({
      'storeDomains.customDomain': hostname,
      isActive: true,
      'storeSettings.isStoreEnabled': true
    }).select('subdomain name storeSettings.storeName').lean();
    if (storeByDomain?.subdomain) {
      foundSubdomain = storeByDomain.subdomain;
      foundName = storeByDomain.storeSettings?.storeName || storeByDomain.name;
    } else {
      const workspace = await Workspace.findOne({
        'storeDomains.customDomain': hostname,
        isActive: true,
        'storeSettings.isStoreEnabled': true
      }).select('subdomain name storeSettings.storeName').lean();
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
    res.status(500).json({ success: false, message: 'Error resolving domain' });
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
    const workspace = await resolveStore(req.params.subdomain);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
        code: 'STORE_NOT_FOUND'
      });
    }

    const settings = workspace.storeSettings || {};
    const prodFilter = getProductFilter(workspace);

    // Fetch initial products + categories in parallel
    const [products, categories, totalProducts] = await Promise.all([
      StoreProduct.find({ ...prodFilter, isPublished: true })
      .select('name slug price compareAtPrice currency country targetMarket city locale stock images category tags')
      .sort('-createdAt')
      .limit(20)
      .lean(),

      StoreProduct.distinct('category', { ...prodFilter, isPublished: true, category: { $ne: '' } }),

      StoreProduct.countDocuments({ ...prodFilter, isPublished: true })
    ]);

    const storeCurrency = settings.storeCurrency || settings.currency || 'XAF';

    // Per-product currency/country overrides the store default (multi-market support).
    const lightProducts = products.map(p => ({
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
      category: p.category
    }));

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

    // Cache at Cloudflare edge for 30 seconds (fast config refresh after admin edits)
    setCacheHeaders(res, 30);

    res.json({
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
          // Product page builder config
          productPageConfig: settings.productPageConfig || null,
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
        categories: categories.sort(),
        pagination: {
          page: 1,
          limit: 20,
          total: totalProducts,
          pages: Math.ceil(totalProducts / 20)
        }
      }
    });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain error:', error.message);
    res.status(500).json({ success: false, message: 'Error loading store' });
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
    const workspace = await resolveStore(req.params.subdomain);
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

    const [products, total] = await Promise.all([
      StoreProduct.find(filter)
        .select('name slug price compareAtPrice currency country targetMarket city locale stock images category tags')
        .sort(sort)
        .limit(limitNum)
        .skip(skip)
        .lean(),
      StoreProduct.countDocuments(filter)
    ]);

    const storeCurrencyPag = workspace.storeSettings?.storeCurrency || workspace.storeSettings?.currency || 'XAF';
    const lightProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: p.currency || storeCurrencyPag,
      country: p.country || '',
      targetMarket: p.targetMarket || '',
      city: p.city || '',
      locale: p.locale || '',
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      category: p.category
    }));

    // Cache at Cloudflare edge — search results cached for 2 minutes only
    setCacheHeaders(res, search ? 120 : 300);

    res.json({
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
    });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/products error:', error.message);
    res.status(500).json({ success: false, message: 'Error loading products' });
  }
});

/**
 * GET /api/store/:subdomain/products/:slug
 *
 * Full product detail by slug.
 */
router.get('/:subdomain/products/:slug', readLimiter, async (req, res) => {
  try {
    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const product = await StoreProduct.findOne({
      ...getProductFilter(workspace),
      slug: req.params.slug,
      isPublished: true
    })
    .select('-__v')
    .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Fetch active quantity offers for this product
    const quantityOffer = await QuantityOffer.findOne({
      workspaceId: workspace._workspaceId || workspace._id,
      productId: product._id,
      isActive: true
    }).sort({ createdAt: -1 }).lean();

    // Product page builder edits must appear quickly on the live page
    setCacheHeaders(res, 30);

    // Per-product-page currency/country ALWAYS override the store's global config.
    // Why: a single store can publish multiple product pages, each targeting a different market.
    const productCurrency = product.currency || workspace.storeSettings?.storeCurrency || workspace.storeSettings?.currency || 'XAF';
    const productCountry = product.country || workspace.storeSettings?.country || '';
    const productLocale = product.locale || workspace.storeSettings?.locale || '';

    res.json({
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
    });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/products/:slug error:', error.message);
    res.status(500).json({ success: false, message: 'Error loading product' });
  }
});

/**
 * GET /api/store/:subdomain/categories
 */
router.get('/:subdomain/categories', readLimiter, async (req, res) => {
  try {
    const workspace = await resolveStore(req.params.subdomain);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const categories = await StoreProduct.distinct('category', {
      ...getProductFilter(workspace),
      isPublished: true,
      category: { $ne: '' }
    });

    // Categories rarely change — cache 10 minutes
    setCacheHeaders(res, 600);
    res.json({ success: true, data: categories.sort() });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/categories error:', error.message);
    res.status(500).json({ success: false, message: 'Error loading categories' });
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

    const { customerName, phone, phoneCode, email, address, city, country, products, notes, channel, deliveryType, deliveryCost, metaEventId, metaSourceUrl, affiliateCode, affiliateLinkCode } = req.body;

    if (!customerName || !phone || !products?.length) {
      return res.status(400).json({
        success: false,
        message: 'Nom, téléphone et au moins un produit requis'
      });
    }

    // Validate products exist and are in stock
    const productIds = products.map(p => p.productId);
    const dbProducts = await StoreProduct.find({
      _id: { $in: productIds },
      workspaceId: workspace._id,
      isPublished: true
    }).lean();

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

    const resolvedOrderCurrency = orderCurrencies.size === 1
      ? Array.from(orderCurrencies)[0]
      : (workspace.storeSettings?.storeCurrency || 'XAF');
    const resolvedCountry = country?.trim() || workspace.storeSettings?.country || workspace.storeSettings?.storeCountry || '';
    const sanitizedDeliveryType = ['livraison', 'expedition'].includes(deliveryType) ? deliveryType : '';
    const sanitizedDeliveryCost = Math.max(0, Number(deliveryCost) || 0);

    const order = new StoreOrder({
      workspaceId: workspace._workspaceId || workspace._id,
      storeId: workspace._storeId || null,
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
      total: total + sanitizedDeliveryCost,
      currency: resolvedOrderCurrency,
      channel: channel || 'store',
      notes: notes?.trim() || '',
      affiliateCode: normalizeCode(affiliateCode),
      affiliateLinkCode: normalizeCode(affiliateLinkCode)
    });

    await order.save();

    // Decrement stock atomically (synchronous — must complete before confirming)
    const bulkOps = products.map(item => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), workspaceId: workspace._workspaceId || workspace._id },
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

        // WhatsApp auto-confirm
        if (workspace.whatsappAutoConfirm && mainOrder.clientPhone) {
          sendClientOrderConfirmation(mainOrder, shopifyStylePayload, workspaceId.toString(), {
            storeName:      workspace.storeSettings?.storeName || workspace.name || '',
            instanceId:     workspace.whatsappAutoInstanceId || null,
            customTemplate: workspace.whatsappOrderTemplate || null,
            imageUrl:       workspace.whatsappAutoImageUrl || null,
            audioUrl:       workspace.whatsappAutoAudioUrl || null,
          }).catch(err => console.error('⚠️ [Scalor Store] WhatsApp auto-confirm échoué:', err.message));
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

export default router;
