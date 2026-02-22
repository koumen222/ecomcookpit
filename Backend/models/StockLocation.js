import mongoose from 'mongoose';

const stockLocationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  city: {
    type: String,
    trim: true,
    default: 'Non assigné'
  },
  agency: {
    type: String,
    trim: true,
    default: ''
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unitCost: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser'
  }
}, {
  timestamps: true,
  collection: 'ecom_stock_locations'
});

// Index unique par workspace + produit + ville + agence
stockLocationSchema.index({ workspaceId: 1, productId: 1, city: 1, agency: 1 }, { unique: true });

// Valeur du stock à cet emplacement
stockLocationSchema.virtual('stockValue').get(function() {
  return this.quantity * this.unitCost;
});

stockLocationSchema.set('toJSON', { virtuals: true });
stockLocationSchema.set('toObject', { virtuals: true });

const StockLocation = mongoose.model('StockLocation', stockLocationSchema);
export default StockLocation;
