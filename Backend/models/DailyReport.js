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
  }]
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

// Virtuals pour les calculs
dailyReportSchema.virtual('revenue').get(function() {
  // Prix de vente * commandes livrées
  return this.ordersDelivered * (this.productId?.sellingPrice || 0);
});

dailyReportSchema.virtual('productCostTotal').get(function() {
  // Coût produit * commandes livrées
  return this.ordersDelivered * (this.productId?.productCost || 0);
});

dailyReportSchema.virtual('deliveryCostTotal').get(function() {
  // Coût livraison * commandes livrées
  return this.ordersDelivered * (this.productId?.deliveryCost || 0);
});

dailyReportSchema.virtual('totalCost').get(function() {
  return this.productCostTotal + this.deliveryCostTotal + this.adSpend;
});

dailyReportSchema.virtual('profit').get(function() {
  return this.revenue - this.totalCost;
});

dailyReportSchema.virtual('deliveryRate').get(function() {
  if (this.ordersReceived === 0) return 0;
  return this.ordersDelivered / this.ordersReceived;
});

dailyReportSchema.virtual('profitPerOrder').get(function() {
  if (this.ordersDelivered === 0) return 0;
  return this.profit / this.ordersDelivered;
});

dailyReportSchema.virtual('roas').get(function() {
  if (this.adSpend === 0) return 0;
  return this.revenue / this.adSpend;
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
