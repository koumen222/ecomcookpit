import mongoose from 'mongoose';

const storeAnalyticsSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, index: true },
  subdomain: { type: String, required: true, index: true },
  
  // Type d'événement
  eventType: { 
    type: String, 
    enum: ['page_view', 'product_view', 'add_to_cart', 'checkout_started', 'order_placed'],
    required: true,
    index: true
  },
  
  // Détails de la page
  page: {
    path: { type: String, default: '' },
    title: { type: String, default: '' },
    referrer: { type: String, default: '' },
  },
  
  // Produit associé (si applicable)
  productId: { type: String, default: null, index: true },
  productName: { type: String, default: '' },
  productPrice: { type: Number, default: 0 },
  
  // Commande associée (si applicable)
  orderId: { type: String, default: null },
  orderValue: { type: Number, default: 0 },
  
  // Informations visiteur
  visitor: {
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    language: { type: String, default: '' },
    country: { type: String, default: '' },
    city: { type: String, default: '' },
    device: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
    browser: { type: String, default: '' },
  },
  
  // Identifiant visiteur persistant (UUID stocké en localStorage)
  visitorId: { type: String, default: '', index: true },

  // Session
  sessionId: { type: String, default: '', index: true },
  
  // Métadonnées
  timestamp: { type: Date, default: Date.now, index: true },
  
}, {
  timestamps: true,
  collection: 'store_analytics',
});

// Index composés pour les requêtes fréquentes
storeAnalyticsSchema.index({ workspaceId: 1, timestamp: -1 });
storeAnalyticsSchema.index({ workspaceId: 1, eventType: 1, timestamp: -1 });
storeAnalyticsSchema.index({ subdomain: 1, timestamp: -1 });
storeAnalyticsSchema.index({ sessionId: 1, timestamp: -1 });
storeAnalyticsSchema.index({ visitorId: 1, workspaceId: 1, timestamp: -1 });

// Méthode statique pour obtenir les statistiques
storeAnalyticsSchema.statics.getStoreDashboardStats = async function(workspaceId, startDate, endDate, period = '7d') {
  const matchQuery = {
    workspaceId,
    timestamp: { $gte: startDate, $lte: endDate }
  };
  
  // Visites uniques — préférer visitorId (persistant) et fallback sessionId
  const uniqueVisitorsById = await this.distinct('visitorId', {
    ...matchQuery,
    visitorId: { $ne: '' }
  });
  const uniqueVisitorsBySession = await this.distinct('sessionId', {
    ...matchQuery,
    visitorId: ''
  });
  const uniqueVisitors = [
    ...uniqueVisitorsById,
    ...uniqueVisitorsBySession,
  ];
  
  // Total vues de pages
  const pageViews = await this.countDocuments({
    ...matchQuery,
    eventType: 'page_view'
  });
  
  // Vues de produits
  const productViews = await this.countDocuments({
    ...matchQuery,
    eventType: 'product_view'
  });
  
  // Ajouts au panier
  const addToCarts = await this.countDocuments({
    ...matchQuery,
    eventType: 'add_to_cart'
  });
  
  // Checkouts commencés
  const checkoutsStarted = await this.countDocuments({
    ...matchQuery,
    eventType: 'checkout_started'
  });
  
  // Commandes placées
  const ordersPlaced = await this.countDocuments({
    ...matchQuery,
    eventType: 'order_placed'
  });
  
  // Revenu total
  const revenueData = await this.aggregate([
    { $match: { ...matchQuery, eventType: 'order_placed' } },
    { $group: { _id: null, total: { $sum: '$orderValue' } } }
  ]);
  const totalRevenue = revenueData[0]?.total || 0;
  
  // Produits les plus vus
  const topProducts = await this.aggregate([
    { $match: { ...matchQuery, eventType: 'product_view', productId: { $ne: null } } },
    { 
      $group: { 
        _id: '$productId', 
        name: { $first: '$productName' },
        views: { $sum: 1 }
      } 
    },
    { $sort: { views: -1 } },
    { $limit: 10 }
  ]);
  
  // Visites aujourd'hui
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const visitsToday = await this.countDocuments({
    workspaceId,
    eventType: { $in: ['page_view', 'product_view'] },
    timestamp: { $gte: todayStart },
  });

  // Visites par produit
  const visitsPerProduct = await this.aggregate([
    { $match: { ...matchQuery, eventType: 'product_view', productId: { $ne: null } } },
    {
      $group: {
        _id: '$productId',
        name: { $first: '$productName' },
        visits: { $sum: 1 },
        uniqueVisitors: { $addToSet: { $cond: [{ $ne: ['$visitorId', ''] }, '$visitorId', '$sessionId'] } },
      }
    },
    { $addFields: { uniqueVisitorCount: { $size: '$uniqueVisitors' } } },
    { $sort: { visits: -1 } },
    { $limit: 20 },
    { $project: { _id: 1, name: 1, visits: 1, uniqueVisitorCount: 1 } },
  ]);

  // Taux de conversion
  const conversionRate = uniqueVisitors.length > 0 
    ? ((ordersPlaced / uniqueVisitors.length) * 100).toFixed(2)
    : 0;
  
  // Sources de trafic
  const trafficSources = await this.aggregate([
    { $match: { ...matchQuery, eventType: 'page_view' } },
    { 
      $group: { 
        _id: '$page.referrer', 
        count: { $sum: 1 } 
      } 
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  
  // Appareils (visites de pages seulement — évite compter add_to_cart, etc.)
  const visitMatch = { ...matchQuery, eventType: { $in: ['page_view', 'product_view'] } };
  const deviceStats = await this.aggregate([
    { $match: visitMatch },
    { $group: { _id: '$visitor.device', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Pays
  const countryStats = await this.aggregate([
    { $match: visitMatch },
    { $group: { _id: { $ifNull: ['$visitor.country', ''] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 12 }
  ]);

  // Villes
  const cityStats = await this.aggregate([
    { $match: visitMatch },
    { $group: { _id: { $ifNull: ['$visitor.city', ''] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 12 }
  ]);

  // Navigateurs
  const browserStats = await this.aggregate([
    { $match: visitMatch },
    { $group: { _id: { $ifNull: ['$visitor.browser', ''] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Langues
  const languageStats = await this.aggregate([
    { $match: visitMatch },
    { $group: { _id: { $ifNull: ['$visitor.language', ''] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 }
  ]);

  // Top pages visitées (path)
  const topPages = await this.aggregate([
    { $match: { ...matchQuery, eventType: 'page_view' } },
    { $group: { _id: '$page.path', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Visites quotidiennes (pour chart d'aire)
  const dailyVisits = await this.aggregate([
    { $match: visitMatch },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        count: { $sum: 1 },
        uniqueVisitors: { $addToSet: { $cond: [{ $ne: ['$visitorId', ''] }, '$visitorId', '$sessionId'] } },
      }
    },
    { $addFields: { uniqueCount: { $size: '$uniqueVisitors' } } },
    { $project: { _id: 1, count: 1, uniqueCount: 1 } },
    { $sort: { _id: 1 } }
  ]);

  // Timeline générique (hourly for 24h, daily otherwise)
  const timeFormat = period === '24h' ? '%Y-%m-%dT%H' : '%Y-%m-%d';
  const timeline = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: timeFormat, date: '$timestamp' } },
          eventType: '$eventType'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  return {
    overview: {
      uniqueVisitors: uniqueVisitors.length,
      pageViews,
      productViews,
      addToCarts,
      checkoutsStarted,
      ordersPlaced,
      totalRevenue,
      conversionRate: parseFloat(conversionRate),
      visitsToday,
    },
    topProducts,
    visitsPerProduct,
    trafficSources,
    deviceStats,
    countryStats,
    cityStats,
    browserStats,
    languageStats,
    topPages,
    dailyVisits,
    timeline,
  };
};

export default mongoose.model('StoreAnalytics', storeAnalyticsSchema);
