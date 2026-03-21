import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['test', 'stable', 'winner', 'pause', 'stop'],
    default: 'test'
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  productCost: {
    type: Number,
    required: true,
    min: 0
  },
  deliveryCost: {
    type: Number,
    required: true,
    min: 0
  },
  avgAdsCost: {
    type: Number,
    min: 0,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reorderThreshold: {
    type: Number,
    required: true,
    min: 0,
    default: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  collection: 'ecom_products',
  timestamps: true
});

// Index pour recherche rapide
productSchema.index({ status: 1, isActive: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ name: 'text', status: 'text' }); // Index pour recherche plein texte

// Méthode pour calculer la marge (sans inclure avgAdsCost)
productSchema.methods.getMargin = function() {
  return this.sellingPrice - this.productCost - this.deliveryCost;
};

// Méthode pour vérifier si le stock est bas
productSchema.methods.isLowStock = function() {
  return this.stock <= this.reorderThreshold;
};

// Méthode pour obtenir le bénéfice par unité
productSchema.methods.getProfitPerUnit = function() {
  return this.sellingPrice - this.productCost - this.deliveryCost;
};

// Virtual pour calculer le ROI (sans inclure avgAdsCost)
productSchema.virtual('roi').get(function() {
  const totalCost = this.productCost + this.deliveryCost;
  return totalCost > 0 ? ((this.sellingPrice - totalCost) / totalCost * 100) : 0;
});

export default mongoose.model('Product', productSchema);
