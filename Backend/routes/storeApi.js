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
 * - Proper MongoDB indexes on Workspace.subdomain + StoreProduct.workspaceId
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
import Workspace from '../models/Workspace.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';

const router = express.Router();

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
router.get('/:subdomain', async (req, res) => {
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

    // Lightweight product mapping
    const lightProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: p.currency,
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      category: p.category
    }));

    const theme = workspace.storeTheme || {};
    const pages = workspace.storePages;  // intentional: null if never set
    const pixels = workspace.storePixels || {};

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
          // Theme config
          template: theme.template || 'classic',
          primaryColor: theme.primaryColor || settings.primaryColor || settings.storeThemeColor || '#0F6B4F',
          accentColor: theme.accentColor || theme.ctaColor || settings.accentColor || settings.ctaColor || '#059669',
          backgroundColor: theme.backgroundColor || settings.backgroundColor || '#FFFFFF',
          textColor: theme.textColor || settings.textColor || '#111827',
          font: theme.font || settings.font || 'inter',
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
          snapPixelId: pixels.snapPixelId || '',
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
    console.error('❌ GET /api/store/:subdomain error:', error);
    res.status(500).json({ success: false, message: 'Error loading store' });
  }
});

/**
 * GET /api/store/:subdomain/products
 * 
 * Paginated product listing with search/filter.
 * Query params: page, limit, category, search, sort
 */
router.get('/:subdomain/products', async (req, res) => {
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

    const lightProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: p.currency,
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      category: p.category
    }));

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
    console.error('❌ GET /api/store/:subdomain/products error:', error);
    res.status(500).json({ success: false, message: 'Error loading products' });
  }
});

/**
 * GET /api/store/:subdomain/products/:slug
 * 
 * Full product detail by slug.
 */
router.get('/:subdomain/products/:slug', async (req, res) => {
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

    res.json({
      success: true,
      data: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: product.currency,
        stock: product.stock,
        images: product.images || [],
        category: product.category,
        tags: product.tags,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription
      }
    });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/products/:slug error:', error);
    res.status(500).json({ success: false, message: 'Error loading product' });
  }
});

/**
 * GET /api/store/:subdomain/categories
 */
router.get('/:subdomain/categories', async (req, res) => {
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

    res.json({ success: true, data: categories.sort() });

  } catch (error) {
    console.error('❌ GET /api/store/:subdomain/categories error:', error);
    res.status(500).json({ success: false, message: 'Error loading categories' });
  }
});

/**
 * POST /api/store/:subdomain/orders
 * 
 * Guest checkout — place a public order without authentication.
 * Validates stock, creates order, decrements stock atomically.
 */
router.post('/:subdomain/orders', async (req, res) => {
  try {
    console.log('🛒 [POST /api/store/:subdomain/orders] Début de la requête');
    console.log('📝 Subdomain:', req.params.subdomain);
    console.log('📦 Corps de la requête:', JSON.stringify(req.body, null, 2));
    
    const workspace = await resolveStore(req.params.subdomain);
    console.log('🏢 Workspace trouvé:', workspace ? 'OUI' : 'NON');
    
    if (!workspace) {
      console.log('❌ Store non trouvé pour subdomain:', req.params.subdomain);
      return res.status(404).json({ success: false, message: 'Store not found' });
    }

    const { customerName, phone, email, address, city, products, notes, channel } = req.body;
    console.log('👤 Données client extraites:', { customerName, phone, email, address, city, products, notes, channel });

    if (!customerName || !phone || !products?.length) {
      console.log('❌ Validation échouée - champs manquants:', { customerName: !!customerName, phone: !!phone, products: products?.length });
      return res.status(400).json({
        success: false,
        message: 'Nom, téléphone et au moins un produit requis'
      });
    }

    console.log('🔍 Validation des produits...');
    // Validate products exist and are in stock
    const productIds = products.map(p => p.productId);
    console.log('🆔 Product IDs à vérifier:', productIds);
    
    const dbProducts = await StoreProduct.find({
      _id: { $in: productIds },
      workspaceId: workspace._id,
      isPublished: true
    }).lean();
    
    console.log('📋 Produits trouvés en DB:', dbProducts.length, 'attendus:', products.length);
    console.log('📋 Détails produits DB:', dbProducts.map(p => ({ id: p._id, name: p.name, stock: p.stock })));

    if (dbProducts.length !== products.length) {
      console.log('❌ Certains produits sont introuvables');
      return res.status(400).json({
        success: false,
        message: 'Un ou plusieurs produits sont introuvables'
      });
    }

    const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));
    let total = 0;
    const orderProducts = [];

    console.log('💰 Calcul du total et validation du stock...');
    for (const item of products) {
      console.log('🔄 Traitement produit:', item);
      const dbProduct = productMap.get(item.productId);
      if (!dbProduct) {
        console.log('❌ Produit non trouvé dans le map:', item.productId);
        return res.status(400).json({
          success: false,
          message: `Produit ${item.productId} introuvable`
        });
      }

      const qty = Math.max(1, parseInt(item.quantity) || 1);
      console.log('📊 Quantité demandée:', qty, 'Stock disponible:', dbProduct.stock);
      
      if (dbProduct.stock < qty) {
        console.log('❌ Stock insuffisant pour', dbProduct.name);
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
      console.log('💵 Sous-total pour', dbProduct.name, ':', dbProduct.price * qty);
    }

    console.log('💰 Total de la commande:', total);

    console.log('📝 Création de la commande StoreOrder...');
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

    console.log('💾 Sauvegarde de la commande StoreOrder...');
    await order.save();
    console.log('✅ StoreOrder sauvegardée avec ID:', order._id);

    // ── Sync to main system orders ──────────────────────────────────────────
    // Creates a standard Order in the main system so the team sees it
    // in the dashboard orders view with source='boutique'
    try {
      console.log('🔄 Synchronisation vers le système principal...');
      const productSummary = orderProducts.map(p => `${p.name} x${p.quantity}`).join(', ');
      console.log('📋 Résumé produits:', productSummary);
      
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
      
      console.log('💾 Sauvegarde de la commande principale...');
      await mainOrder.save();
      console.log('✅ Commande principale sauvegardée avec ID:', mainOrder._id);
      
      // Link back
      order.linkedOrderId = mainOrder._id;
      await order.save();
      console.log('🔗 Liaison des commandes effectuée');
    } catch (syncErr) {
      console.error('⚠️ Could not sync store order to main orders:', syncErr.message);
      console.error('⚠️ Stack trace:', syncErr.stack);
    }

    console.log('📉 Décrémentation du stock...');
    // Decrement stock atomically
    const bulkOps = products.map(item => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), workspaceId: workspace._id },
        update: { $inc: { stock: -(parseInt(item.quantity) || 1) } }
      }
    }));
    
    console.log('🔄 Opérations bulk de stock:', bulkOps);
    await StoreProduct.bulkWrite(bulkOps);
    console.log('✅ Stock décrémenté avec succès');

    console.log('📤 Envoi de la réponse succès...');
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

  } catch (error) {
    console.error('❌ POST /api/store/:subdomain/orders error:', error);
    console.error('❌ Stack trace complet:', error.stack);
    console.error('❌ Détails de l\'erreur:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
