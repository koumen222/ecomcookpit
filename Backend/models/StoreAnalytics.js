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

// Méthode statique pour obtenir les statistiques
storeAnalyticsSchema.statics.getStoreDashboardStats = async function(workspaceId, startDate, endDate) {
  const matchQuery = {
    workspaceId,
    timestamp: { $gte: startDate, $lte: endDate }
  };
  
  // Visites uniques (sessions uniques)
  const uniqueVisitors = await this.distinct('sessionId', matchQuery);
  
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
  
  // Appareils
  const deviceStats = await this.aggregate([
    { $match: matchQuery },
    { 
      $group: { 
        _id: '$visitor.device', 
        count: { $sum: 1 } 
      } 
    }
  ]);
  
  // Timeline (par jour)
  const timeline = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
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
    },
    topProducts,
    trafficSources,
    deviceStats,
    timeline,
  };
};

export default mongoose.model('StoreAnalytics', storeAnalyticsSchema);
