import express from 'express';
import StoreAnalytics from '../models/StoreAnalytics.js';
import StoreOrder from '../models/StoreOrder.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

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
    const { workspaceId, startDate, endDate, period = '7d' } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    // Calculer les dates
    let start, end;
    end = endDate ? new Date(endDate) : new Date();
    
    if (startDate) {
      start = new Date(startDate);
    } else {
      // Période par défaut
      const periodMap = {
        '24h': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
      };
      const days = periodMap[period] || 7;
      start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    }

    // Récupérer les stats analytics
    const analyticsStats = await StoreAnalytics.getStoreDashboardStats(
      workspaceId,
      start,
      end
    );

    // Récupérer les stats de commandes (orienté COD — marchés africains)
    const orders = await StoreOrder.find({
      workspaceId,
      createdAt: { $gte: start, $lte: end }
    }).lean();

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

    const orderStats = {
      total: orders.length,
      pending:    pendingOrders.length,
      confirmed:  confirmedOrders.length,
      processing: processingOrders.length,
      shipped:    shippedOrders.length,
      delivered:  deliveredOrders.length,
      cancelled:  cancelledOrders.length,
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
    };

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
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
        workspaceId,
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
    const { workspaceId, startDate, endDate } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

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
