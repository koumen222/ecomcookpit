import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  sheetRowId: {
    type: String,
    default: ''
  },
  sheetRowIndex: {
    type: Number,
    index: true
  },
  orderId: {
    type: String,
    default: ''
  },
  date: {
    type: Date
  },
  clientName: {
    type: String,
    trim: true,
    default: ''
  },
  clientPhone: {
    type: String,
    trim: true,
    default: ''
  },
  clientPhoneNormalized: {
    type: String,
    index: true
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  product: {
    type: String,
    trim: true,
    default: ''
  },
  quantity: {
    type: Number,
    default: 1
  },
  price: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  status: {
    type: String,
    default: 'pending'
  },
  deliveryLocation: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryTime: {
    type: String,
    trim: true,
    default: ''
  },
  tags: {
    type: [String],
    default: []
  },
  assignedLivreur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  deliveryOfferMode: {
    type: String,
    enum: ['none', 'broadcast', 'targeted'],
    default: 'none'
  },
  deliveryOfferTargetLivreur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  deliveryOfferSentAt: {
    type: Date,
    default: null
  },
  deliveryOfferExpiresAt: {
    type: Date,
    default: null
  },
  deliveryOfferEscalatedAt: {
    type: Date,
    default: null
  },
  deliveryOfferRefusedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'EcomUser',
    default: []
  },
  readyForDelivery: {
    type: Boolean,
    default: false,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  source: {
    type: String,
    enum: ['google_sheets', 'manual', 'boutique', 'shopify', 'webhook', 'rita', 'skelor'],
    default: 'manual'
  },
  // Source tagging — identifiant et nom de la source (boutique Shopify, webhook nommé, etc.)
  sourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrderSource',
    default: null
  },
  sourceName: {
    type: String,
    trim: true,
    default: ''
  },
  // Closer assigné à cette commande
  closerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  closerStatus: {
    type: String,
    enum: ['pending', 'called', 'sold', 'refused', 'unreachable'],
    default: 'pending'
  },
  closerNote: {
    type: String,
    default: ''
  },
  closerUpdatedAt: {
    type: Date,
    default: null
  },
  storeOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreOrder',
    default: null
  },
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateUser',
    default: null,
    index: true
  },
  affiliateCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  affiliateLinkCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  affiliateCommissionAmount: {
    type: Number,
    default: 0
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  whatsappNotificationSent: {
    type: Boolean,
    default: false
  },
  whatsappNotificationSentAt: {
    type: Date,
    default: null
  },
  statusModifiedManually: {
    type: Boolean,
    default: false
  },
  statusModifiedAt: {
    type: Date,
    default: null
  },
  // Delivery GPS tracking
  deliveryStartedAt: {
    type: Date,
    default: null
  },
  deliveryStartLat: {
    type: Number,
    default: null
  },
  deliveryStartLng: {
    type: Number,
    default: null
  },
  deliveryEndLat: {
    type: Number,
    default: null
  },
  deliveryEndLng: {
    type: Number,
    default: null
  },
  deliveryEndAddress: {
    type: String,
    trim: true,
    default: ''
  },
  deliveryDistanceKm: {
    type: Number,
    default: null
  },
  deliveryCostFcfa: {
    type: Number,
    default: null
  },
  deliveryNote: {
    type: String,
    trim: true,
    default: ''
  },
  nonDeliveryReason: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true  // Index pour le tri
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true  // Index pour le polling
  }
}, {
  timestamps: true,
  collection: 'ecom_orders'
});

// Index composés pour les requêtes fréquentes
orderSchema.index({ workspaceId: 1, status: 1, date: -1 });  // Filtres par statut + date
orderSchema.index({ workspaceId: 1, city: 1, status: 1 });   // Filtres par ville + statut
orderSchema.index({ workspaceId: 1, product: 1, status: 1 }); // Filtres par produit + statut
orderSchema.index({ workspaceId: 1, date: -1, status: 1 });  // Pagination avec filtre
orderSchema.index({ workspaceId: 1, updatedAt: -1 });        // Pour le polling
orderSchema.index({ workspaceId: 1, source: 1, date: -1 });  // Filtres par source + date
orderSchema.index({ workspaceId: 1, tags: 1, status: 1 });   // Filtres par tags + statut

// Index textuel pour la recherche globale
orderSchema.index({
  clientName: 'text',
  clientPhone: 'text',
  city: 'text',
  product: 'text',
  address: 'text'
}, {
  weights: {
    clientName: 10,
    clientPhone: 8,
    city: 5,
    product: 5,
    address: 2
  },
  name: 'orders_search_index'
});

// Middleware pour optimiser les requêtes
orderSchema.pre(['find', 'findOne'], function() {
  // Ajouter automatiquement le lean() pour les requêtes en lecture seule
  if (!this.options.skipLean) {
    this.lean();
  }
});

// Méthode statique pour les requêtes optimisées
orderSchema.statics.findOptimized = function(filter, options = {}) {
  const {
    page = 1,
    limit = 50,
    sort = { createdAt: -1 },
    skipLean = false
  } = options;

  const query = this.find(filter)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  if (!skipLean) {
    query.lean();
  }

  return query;
};

// Méthode statique pour les agrégations optimisées
orderSchema.statics.getStatsOptimized = function(workspaceId, dateFilter = {}) {
  const matchStage = {
    workspaceId: new mongoose.Types.ObjectId(workspaceId),
    ...dateFilter
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$price', 0] },
              { $ifNull: ['$quantity', 1] }
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        stats: {
          $push: {
            status: '$_id',
            count: '$count',
            revenue: '$totalRevenue'
          }
        },
        totalCount: { $sum: '$count' },
        totalRevenue: { $sum: '$totalRevenue' }
      }
    }
  ]);
};

orderSchema.index({ workspaceId: 1, orderId: 1 });
orderSchema.index({ workspaceId: 1, sheetRowId: 1 }, { unique: true, sparse: true });
orderSchema.index({ workspaceId: 1, sheetRowIndex: 1 });
orderSchema.index({ workspaceId: 1, status: 1 });
orderSchema.index({ workspaceId: 1, date: -1 });
orderSchema.index({ workspaceId: 1, updatedAt: -1 });
orderSchema.index({ workspaceId: 1, clientPhoneNormalized: 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
