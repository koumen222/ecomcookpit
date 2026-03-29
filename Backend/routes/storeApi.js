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
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';

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

// ─── Helper: resolve workspace from subdomain param ───────────────────────────
async function resolveStore(subdomain) {
  if (!subdomain) return null;

  const clean = subdomain.toLowerCase().trim();

  // Check cache
  let workspace = getCachedStore(clean);
  if (workspace) return workspace;

  // Query DB with compound index
  workspace = await Workspace.findOne({
    subdomain: clean,
    isActive: true,
    'storeSettings.isStoreEnabled': true
  })
  .select('_id name subdomain storeSettings storeTheme storePages storePixels storePayments')
  .lean();

  if (workspace) {
    setCachedStore(clean, workspace);
  }

  return workspace;
}

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

    // Fetch initial products + categories in parallel
    const [products, categories, totalProducts] = await Promise.all([
      StoreProduct.find({
        workspaceId: workspace._id,
        isPublished: true
      })
      .select('name slug price compareAtPrice currency stock images category tags')
      .sort('-createdAt')
      .limit(20)
      .lean(),

      StoreProduct.distinct('category', {
        workspaceId: workspace._id,
        isPublished: true,
        category: { $ne: '' }
      }),

      StoreProduct.countDocuments({
        workspaceId: workspace._id,
        isPublished: true
      })
    ]);

    const storeCurrency = settings.storeCurrency || settings.currency || 'XAF';

    // Lightweight product mapping
    const lightProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: storeCurrency,
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      category: p.category
    }));

    const theme = workspace.storeTheme || {};
    const pages = workspace.storePages;  // intentional: null if never set
    const pixels = workspace.storePixels || {};

    // Cache at Cloudflare edge for 5 minutes
    setCacheHeaders(res, 300);

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
          currency: settings.currency || settings.storeCurrency || 'XAF',
          subdomain: workspace.subdomain,
          // Theme config - PRIORITÉ AUX SETTINGS (configurés dans /boutique/settings)
          template: theme.template || 'classic',
          primaryColor: settings.primaryColor || settings.storeThemeColor || theme.primaryColor || '#0F6B4F',
          accentColor: settings.accentColor || settings.ctaColor || theme.accentColor || theme.ctaColor || '#059669',
          backgroundColor: settings.backgroundColor || theme.backgroundColor || '#FFFFFF',
          textColor: settings.textColor || theme.textColor || '#111827',
          font: settings.font || theme.font || 'inter',
          borderRadius: theme.borderRadius || 'lg',
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
        },
        // Page sections: null = never configured (use defaults), [] = builder empty page
        sections: pages ? (pages.sections ?? null) : null,
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

    const filter = {
      workspaceId: workspace._id,
      isPublished: true
    };

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
        .select('name slug price compareAtPrice currency stock images category tags')
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
      currency: storeCurrencyPag,
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
      workspaceId: workspace._id,
      slug: req.params.slug,
      isPublished: true
    })
    .select('-__v')
    .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Product pages cached 10 minutes — they change rarely
    setCacheHeaders(res, 600);

    const productCurrency = workspace.storeSettings?.storeCurrency || workspace.storeSettings?.currency || product.currency || 'XAF';

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
        stock: product.stock,
        images: product.images || [],
        category: product.category,
        tags: product.tags,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        features: product.features || [],
        faq: product.faq || []
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
      workspaceId: workspace._id,
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

    const { customerName, phone, email, address, city, products, notes, channel } = req.body;

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

      orderProducts.push({
        productId: dbProduct._id,
        name: dbProduct.name,
        price: dbProduct.price,
        quantity: qty,
        image: dbProduct.images?.[0]?.url || ''
      });

      total += dbProduct.price * qty;
    }

    const order = new StoreOrder({
      workspaceId: workspace._id,
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email?.trim() || '',
      address: address?.trim() || '',
      city: city?.trim() || '',
      products: orderProducts,
      total,
      currency: workspace.storeSettings?.storeCurrency || 'XAF',
      channel: channel || 'store',
      notes: notes?.trim() || ''
    });

    await order.save();

    // Sync to main system orders (non-blocking — don't fail the response if this errors)
    try {
      const productSummary = orderProducts.map(p => `${p.name} x${p.quantity}`).join(', ');
      const mainOrder = new Order({
        workspaceId: workspace._id,
        clientName: order.customerName,
        clientPhone: order.phone,
        city: order.city,
        address: order.address,
        product: productSummary,
        quantity: orderProducts.reduce((sum, p) => sum + p.quantity, 0),
        price: order.total,
        status: 'pending',
        source: 'boutique',
        storeOrderId: order._id,
        notes: [order.orderNumber, order.notes].filter(Boolean).join(' — '),
        date: new Date()
      });
      await mainOrder.save();
      order.linkedOrderId = mainOrder._id;
      await order.save();
    } catch (syncErr) {
      console.error('⚠️ Could not sync store order to main orders:', syncErr.message);
    }

    // Decrement stock atomically
    const bulkOps = products.map(item => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), workspaceId: workspace._id },
        update: { $inc: { stock: -(parseInt(item.quantity) || 1) } }
      }
    }));
    await StoreProduct.bulkWrite(bulkOps);

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

    // ── Meta Conversions API (server-side, non-blocking) ─────────────────────
    const metaAccessToken = workspace.storePixels?.metaAccessToken;
    const metaPixelId = workspace.storePixels?.metaPixelId;
    if (metaAccessToken && metaPixelId) {
      const { createHash } = await import('crypto');
      const hash = (v) => v ? createHash('sha256').update(v.trim().toLowerCase()).digest('hex') : undefined;
      const capiPayload = {
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_id: order._id.toString(),
          user_data: {
            ph: [hash(phone)],
            em: email ? [hash(email)] : undefined,
          },
          custom_data: {
            value: order.total,
            currency: order.currency,
            order_id: order.orderNumber,
            contents: orderProducts.map(p => ({ id: p.productId.toString(), quantity: p.quantity })),
            num_items: orderProducts.reduce((s, p) => s + p.quantity, 0),
          }
        }]
      };
      const capiUrl = `https://graph.facebook.com/v18.0/${metaPixelId}/events?access_token=${metaAccessToken}`;
      fetch(capiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload),
      }).catch(err => console.warn('⚠️ Meta CAPI error:', err.message));
    }

  } catch (error) {
    console.error('❌ POST /api/store/:subdomain/orders error:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
