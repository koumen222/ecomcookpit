import express from 'express';
import mongoose from 'mongoose';
import StoreAnalytics from '../models/StoreAnalytics.js';
import StoreOrder from '../models/StoreOrder.js';
import Order from '../models/Order.js';
import Store from '../models/Store.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { convertCurrency } from '../utils/currencyConvert.js';

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

router.post('/track', async (req, res) => {
  try {
    const {
      subdomain,
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

    if (!subdomain || !eventType) {
      return res.status(400).json({ error: 'subdomain et eventType requis' });
    }

    // Récupérer le workspaceId depuis le subdomain
    const Workspace = (await import('../models/Workspace.js')).default;
    const workspace = await Workspace.findOne({ subdomain }).lean();
    
    if (!workspace) {
      return res.status(404).json({ error: 'Boutique introuvable' });
    }

    const workspaceId = workspace._id.toString();

    // Anti-spam : dédupliquer les page_view et product_view par visiteur
    if (['page_view', 'product_view'].includes(eventType)) {
      const identifier = visitorId || sessionId;
      if (identifier) {
        const since = new Date(Date.now() - DEDUP_WINDOW_MS);
        const dedupQuery = {
          workspaceId,
          eventType,
          timestamp: { $gte: since },
          $or: [
            { visitorId: identifier },
            { sessionId: identifier },
          ],
        };
        if (eventType === 'product_view' && productId) {
          dedupQuery.productId = productId;
        } else if (eventType === 'page_view') {
          dedupQuery['page.path'] = page?.path || '';
        }
        const existing = await StoreAnalytics.findOne(dedupQuery).lean();
        if (existing) {
          return res.json({ success: true, deduplicated: true });
        }
      }
    }

    // Créer l'événement analytics
    await StoreAnalytics.create({
      workspaceId,
      subdomain,
      eventType,
      page,
      productId,
      productName,
      productPrice,
      orderId,
      orderValue,
      visitor,
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
    const activeStoreId = useAllStores ? null : req.activeStoreId;
    if (activeStoreId) {
      const store = await Store.findById(activeStoreId).select('subdomain').lean();
      storeSubdomain = store?.subdomain || null;
    }

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

    // Store principal currency for conversion
    const storeCurrency = req.workspace?.storeSettings?.storeCurrency
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
