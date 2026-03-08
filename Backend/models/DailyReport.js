import mongoose from 'mongoose';

const dailyReportSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  date: {
    type: Date,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  ordersReceived: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  ordersDelivered: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  adSpend: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  // 🆕 Numéro WhatsApp de la closeuse
  whatsappNumber: {
    type: String,
    trim: true,
    default: ''
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  deliveries: [{
    agencyName: {
      type: String,
      required: false,
      trim: true
    },
    ordersDelivered: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    },
    deliveryCost: {
      type: Number,
      required: false,
      min: 0,
      default: 0
    }
  }],
  priceExceptions: [{
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  customRevenue: {
    type: Number,
    min: 0,
    default: null
  },
  customBenefit: {
    type: Number,
    default: null
  },
  revenue: {
    type: Number,
    default: 0
  },
  productCost: {
    type: Number,
    default: 0
  },
  deliveryCost: {
    type: Number,
    default: 0
  },
  cost: {
    type: Number,
    default: 0
  },
  profit: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    default: 0
  }
}, {
  collection: 'ecom_daily_reports',
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Index unique pour éviter les doublons
dailyReportSchema.index({ date: 1, productId: 1 }, { unique: true });
dailyReportSchema.index({ date: -1 });
dailyReportSchema.index({ productId: 1, date: -1 });

// Virtuals pour les calculs (basés sur les champs stockés)
dailyReportSchema.virtual('productCostTotal').get(function() {
  return this.productCost || 0;
});

dailyReportSchema.virtual('deliveryCostTotal').get(function() {
  return this.deliveryCost || 0;
});

dailyReportSchema.virtual('totalCost').get(function() {
  return this.cost || 0;
});

dailyReportSchema.virtual('deliveryRate').get(function() {
  if (this.ordersReceived === 0) return 0;
  return this.ordersDelivered / this.ordersReceived;
});

dailyReportSchema.virtual('profitPerOrder').get(function() {
  if (this.ordersDelivered === 0) return 0;
  return (this.profit || 0) / this.ordersDelivered;
});

dailyReportSchema.virtual('roas').get(function() {
  if (this.adSpend === 0) return 0;
  return (this.revenue || 0) / this.adSpend;
});

// Méthode pour calculer les métriques
dailyReportSchema.methods.calculateMetrics = async function() {
  await this.populate('productId');
  
  const metrics = {
    revenue: this.revenue,
    productCostTotal: this.productCostTotal,
    deliveryCostTotal: this.deliveryCostTotal,
    totalCost: this.totalCost,
    profit: this.profit,
    deliveryRate: this.deliveryRate,
    profitPerOrder: this.profitPerOrder,
    roas: this.roas
  };
  
  return metrics;
};

export default mongoose.model('DailyReport', dailyReportSchema);
