import mongoose from 'mongoose';

const stockOrderSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  sourcing: {
    type: String,
    enum: ['local', 'chine'],
    required: true,
    default: 'local'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  weightKg: {
    type: Number,
    required: true,
    min: 0
  },
  pricePerKg: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  transportCost: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedArrival: {
    type: Date
  },
  actualArrival: {
    type: Date
  },
  status: {
    type: String,
    enum: ['in_transit', 'received', 'cancelled'],
    default: 'in_transit'
  },
  supplierName: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  collection: 'ecom_stock_orders',
  timestamps: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
});

// Index pour recherche rapide
stockOrderSchema.index({ productId: 1, status: 1 });
stockOrderSchema.index({ sourcing: 1 });
stockOrderSchema.index({ expectedArrival: 1 });
stockOrderSchema.index({ status: 1 });

// Virtuals pour les calculs
stockOrderSchema.virtual('totalPurchaseCost').get(function() {
  return this.purchasePrice * this.quantity;
});

stockOrderSchema.virtual('totalWeightCost').get(function() {
  return this.weightKg * this.pricePerKg;
});

stockOrderSchema.virtual('totalCost').get(function() {
  return this.totalPurchaseCost + this.transportCost;
});

stockOrderSchema.virtual('totalSellingValue').get(function() {
  return this.sellingPrice * this.quantity;
});

stockOrderSchema.virtual('estimatedProfit').get(function() {
  return this.totalSellingValue - this.totalCost;
});

stockOrderSchema.virtual('profitPerUnit').get(function() {
  if (this.quantity === 0) return 0;
  return (this.totalSellingValue - this.totalCost) / this.quantity;
});

// Méthode pour marquer comme reçu
stockOrderSchema.methods.markAsReceived = function(actualArrival = new Date()) {
  this.status = 'received';
  this.actualArrival = actualArrival;
  return this.save();
};

// Méthode pour vérifier si en retard
stockOrderSchema.methods.isDelayed = function() {
  return this.status === 'in_transit' && this.expectedArrival && new Date() > this.expectedArrival;
};

// Méthode pour obtenir les jours de retard
stockOrderSchema.methods.getDelayDays = function() {
  if (!this.isDelayed()) return 0;
  const today = new Date();
  const expected = this.expectedArrival;
  return Math.floor((today - expected) / (1000 * 60 * 60 * 24));
};

export default mongoose.model('StockOrder', stockOrderSchema);
