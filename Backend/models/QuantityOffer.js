import mongoose from 'mongoose';

const quantityOfferSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreProduct',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  offers: [{
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    compare_price: { type: Number, default: null },
    discount: { type: Number, default: 0 },
    label: { type: String, trim: true, default: '' }
  }],
  design: {
    template: { type: String, default: 'modern' },
    colors: {
      primary: { type: String, default: '#0F6B4F' },
      background: { type: String, default: '#FFFFFF' },
      border: { type: String, default: '#E5E7EB' },
      text: { type: String, default: '#111827' },
    },
    border_style: { type: String, default: 'solid' }, // solid, dashed, flat
    highlight_offer: { type: Number, default: null } // index de l'offre mise en avant
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  }
}, {
  collection: 'quantity_offers',
  timestamps: true
});

// Indexes for common queries
quantityOfferSchema.index({ workspaceId: 1, productId: 1, isActive: 1 });
quantityOfferSchema.index({ workspaceId: 1, createdAt: -1 });

export default mongoose.model('QuantityOffer', quantityOfferSchema);
