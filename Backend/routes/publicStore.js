import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';
import OrderSource from '../models/OrderSource.js';
import EcomUser from '../models/EcomUser.js';
import EcomWorkspace from '../models/Workspace.js';
import { memCache } from '../services/memoryCache.js';
import { notifyNewOrder } from '../services/notificationHelper.js';
import { sendClientOrderConfirmation } from '../services/shopifyWhatsappService.js';
import { normalizeCity } from '../utils/cityNormalizer.js';
import { resolveStoreBySubdomain } from '../middleware/storeAuth.js';

const router = express.Router();

const readLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Trop de requêtes.' },
});
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Trop de commandes.' },
});

function setCacheHeaders(res, ttl = 300) {
  res.set('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}, max-age=0`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC STORE ROUTES (no authentication — customer-facing)
// All routes prefixed with /:subdomain and resolved via middleware
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /public/store/:subdomain
 * Get store info (name, logo, banner, theme, description).
 * First call made by the public store frontend to render the shell.
 */
router.get('/:subdomain', readLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const { store } = req;

    // Also get delivery zones from workspace
    const workspace = await EcomWorkspace.findById(store._id)
      .select('storeDeliveryZones')
      .lean();
    const deliveryConfig = workspace?.storeDeliveryZones || { countries: [], zones: [] };

    // Only expose enabled zones publicly
    const publicZones = (deliveryConfig.zones || [])
      .filter(z => z.enabled !== false)
      .map(z => ({
        id: z.id,
        country: z.country,
        city: z.city,
        aliases: z.aliases || [],
        cost: z.cost || 0
      }));

    setCacheHeaders(res, 300);
    res.json({
      success: true,
      data: {
        _id: store._id,
        name: store.storeSettings?.storeName || store.name,
        description: store.storeSettings?.storeDescription || '',
        logo: store.storeSettings?.storeLogo || '',
        banner: store.storeSettings?.storeBanner || '',
        phone: store.storeSettings?.storePhone || '',
        whatsapp: store.storeSettings?.storeWhatsApp || '',
        themeColor: store.storeSettings?.storeThemeColor || '#0F6B4F',
        currency: store.storeSettings?.storeCurrency || 'XAF',
        subdomain: store.subdomain,
        primaryColor: store.storeSettings?.primaryColor || store.storeSettings?.storeThemeColor || '#0F6B4F',
        accentColor: store.storeSettings?.accentColor || '#059669',
        backgroundColor: store.storeSettings?.backgroundColor || '#FFFFFF',
        textColor: store.storeSettings?.textColor || '#111827',
        font: store.storeSettings?.font || 'inter',
        deliveryCountries: deliveryConfig.countries || [],
        deliveryZones: publicZones
      }
    });
  } catch (error) {
    console.error('Erreur GET /public/store/:subdomain:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /public/store/:subdomain/products
 * List published products for public store.
 * Supports pagination: ?page=1&limit=20&category=&search=
 * Only returns published products — lightweight response.
 */
router.get('/:subdomain/products', readLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));

    // Filter: workspace-scoped + published only
    const filter = {
      workspaceId: req.storeWorkspaceId,
      isPublished: true
    };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const [products, total] = await Promise.all([
      StoreProduct.findPaginated(filter, { page: pageNum, limit: limitNum }),
      StoreProduct.countForFilter(filter)
    ]);

    const storeCur = req.store.storeSettings?.storeCurrency || req.store.storeSettings?.currency || 'XAF';
    // Return lightweight response — only fields needed by storefront
    const lightProducts = products.map(p => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      currency: storeCur,
      stock: p.stock,
      image: p.images?.[0]?.url || '',
      category: p.category
    }));

    setCacheHeaders(res, 300);
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
    console.error('Erreur GET /public/store/:subdomain/products:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /public/store/:subdomain/products/:slug
 * Get single product by slug for product detail page.
 * Returns full product data including all images.
 */
router.get('/:subdomain/products/:slug', readLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const product = await StoreProduct.findOne({
      workspaceId: req.storeWorkspaceId,
      slug: req.params.slug,
      isPublished: true
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    setCacheHeaders(res, 600);
    res.json({
      success: true,
      data: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: req.store.storeSettings?.storeCurrency || req.store.storeSettings?.currency || product.currency || 'XAF',
        stock: product.stock,
        images: product.images || [],
        category: product.category,
        tags: product.tags,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription
      }
    });
  } catch (error) {
    console.error('Erreur GET /public/store/:subdomain/products/:slug:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /public/store/:subdomain/categories
 * Get available categories for store navigation.
 */
router.get('/:subdomain/categories', readLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const categories = await StoreProduct.distinct('category', {
      workspaceId: req.storeWorkspaceId,
      isPublished: true,
      category: { $ne: '' }
    });

    setCacheHeaders(res, 600);
    res.json({ success: true, data: categories.sort() });
  } catch (error) {
    console.error('Erreur GET /public/store/:subdomain/categories:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /public/store/:subdomain/delivery-zones
 * Get delivery zones for public checkout (no auth).
 * Returns countries and zones so checkout can validate the customer's location.
 */
router.get('/:subdomain/delivery-zones', readLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const workspace = await EcomWorkspace.findById(req.storeWorkspaceId)
      .select('storeDeliveryZones')
      .lean();

    const config = workspace?.storeDeliveryZones || { countries: [], zones: [] };

    // Only return enabled zones to the public
    const publicZones = (config.zones || [])
      .filter(z => z.enabled !== false)
      .map(z => ({
        id: z.id,
        country: z.country,
        city: z.city,
        aliases: z.aliases || [],
        cost: z.cost || 0
      }));

    setCacheHeaders(res, 600);
    res.json({
      success: true,
      data: {
        countries: config.countries || [],
        zones: publicZones
      }
    });
  } catch (error) {
    console.error('Erreur GET /public/store/:subdomain/delivery-zones:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /public/store/:subdomain/orders
 * Place a public order (guest checkout — no auth required).
 * Validates stock, creates order, decrements stock.
 */
router.post('/:subdomain/orders', orderLimiter, resolveStoreBySubdomain, async (req, res) => {
  try {
    const { customerName, phone, phoneCode, email, address, city, country, products, notes, channel, deliveryType, deliveryCost } = req.body;

    // Validate required fields
    if (!customerName || !phone || !products?.length) {
      return res.status(400).json({
        success: false,
        message: 'Nom, téléphone et au moins un produit requis'
      });
    }

    // Validate and fetch product data — workspace-scoped
    const productIds = products.map(p => p.productId);
    const dbProducts = await StoreProduct.find({
      _id: { $in: productIds },
      workspaceId: req.storeWorkspaceId,
      isPublished: true
    }).lean();

    if (dbProducts.length !== products.length) {
      return res.status(400).json({
        success: false,
        message: 'Un ou plusieurs produits sont introuvables'
      });
    }

    // Build order items with price snapshot + validate stock
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

    // Create order
    const order = new StoreOrder({
      workspaceId: req.storeWorkspaceId,
      customerName: customerName.trim(),
      phone: phone.trim(),
      phoneCode: phoneCode?.trim() || '',
      email: email?.trim() || '',
      address: address?.trim() || '',
      city: city?.trim() || '',
      country: country?.trim() || '',
      deliveryType: deliveryType || '',
      deliveryCost: Math.max(0, Number(deliveryCost) || 0),
      deliveryZone: city?.trim() || '',
      products: orderProducts,
      total: total + Math.max(0, Number(deliveryCost) || 0),
      currency: req.store.storeSettings?.storeCurrency || 'XAF',
      channel: channel || 'store',
      notes: notes?.trim() || ''
    });

    await order.save();

    // Decrement stock (bulk update for performance)
    const bulkOps = products.map(item => ({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(item.productId), workspaceId: req.storeWorkspaceId },
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

    // ── Sync asynchrone vers Order principale ──────────────────────────────
    setImmediate(async () => {
      try {
        const workspaceId = req.storeWorkspaceId;

        // Créer ou récupérer la source "Scalor Store"
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
                name: 'Scalor Store',
                description: 'Commandes reçues via la boutique en ligne Scalor',
                color: '#0F6B4F',
                icon: '🛒',
                workspaceId,
                createdBy: adminUser._id,
                isActive: true,
                metadata: { type: 'scalor_store', createdAt: new Date() }
              });
            } catch (srcErr) {
              console.error('❌ [PublicStore] Erreur création OrderSource:', srcErr.message);
            }
          }
        }

        // Dédoublonnage
        const existing = await Order.findOne({ orderId: order.orderNumber, source: 'skelor', workspaceId }).lean();
        if (existing) return;

        const productSummary = orderProducts.map(p => {
          const qty = p.quantity > 1 ? ` x${p.quantity}` : '';
          return `${p.name}${qty}`;
        }).join(', ');

        const normalizedPhone = (order.phone || '').replace(/\D/g, '');
        const normalizedCityVal = normalizeCity(order.city || '') || order.city;

        const mainOrder = new Order({
          workspaceId,
          sourceId: orderSource?._id || null,
          sourceName: orderSource?.name || 'Scalor Store',
          orderId: order.orderNumber,
          date: order.createdAt || new Date(),
          clientName: order.customerName,
          clientPhone: normalizedPhone || order.phone,
          clientPhoneNormalized: normalizedPhone || order.phone,
          city: normalizedCityVal,
          address: order.address,
          product: productSummary,
          quantity: orderProducts.reduce((sum, p) => sum + p.quantity, 0),
          price: order.total,
          currency: order.currency,
          status: 'pending',
          source: 'skelor',
          storeOrderId: order._id,
          notes: [order.orderNumber, order.notes].filter(Boolean).join(' — ')
        });

        await mainOrder.save();

        order.linkedOrderId = mainOrder._id;
        await order.save();

        memCache.delByPrefix(`stats:${workspaceId.toString()}`);
        memCache.delByPrefix(`filterOpts:${workspaceId.toString()}`);

        console.log(`✅ [PublicStore] Commande ${order.orderNumber} → Order créée (${mainOrder._id})`);

        notifyNewOrder(workspaceId, mainOrder).catch(() => {});

        // WhatsApp auto-confirm
        const workspace = await EcomWorkspace.findById(workspaceId).lean();
        if (workspace?.whatsappAutoConfirm && mainOrder.clientPhone) {
          const shopifyPayload = {
            order_number: order.orderNumber,
            currency: order.currency,
            created_at: order.createdAt?.toISOString() || new Date().toISOString(),
            customer: { first_name: (order.customerName || '').split(' ')[0], last_name: (order.customerName || '').split(' ').slice(1).join(' '), phone: order.phone },
            line_items: orderProducts.map(p => ({ title: p.name, quantity: p.quantity, price: String(p.price) })),
            total_price: String(order.total)
          };
          sendClientOrderConfirmation(mainOrder, shopifyPayload, workspaceId.toString(), {
            storeName: workspace.storeSettings?.storeName || workspace.name || '',
            instanceId: workspace.whatsappAutoInstanceId || null,
            customTemplate: workspace.whatsappOrderTemplate || null,
            imageUrl: workspace.whatsappAutoImageUrl || null,
            audioUrl: workspace.whatsappAutoAudioUrl || null,
          }).catch(err => console.error('⚠️ [PublicStore] WhatsApp auto-confirm échoué:', err.message));
        }
      } catch (syncErr) {
        console.error('❌ [PublicStore] Sync vers Order échouée:', syncErr.message);
      }
    });
  } catch (error) {
    console.error('Erreur POST /public/store/:subdomain/orders:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
