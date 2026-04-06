import mongoose from 'mongoose';

const orderSourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  icon: {
    type: String,
    default: '📱'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Type de source : manual (saisie), webhook (URL générique), shopify, scalot
  type: {
    type: String,
    enum: ['manual', 'webhook', 'shopify', 'scalot'],
    default: 'manual'
  },
  // Token unique pour l'URL webhook (généré automatiquement)
  // PAS de default:null — sparse index ignore les champs absents, pas les null
  webhookToken: {
    type: String,
    unique: true,
    sparse: true
  },
  // Nom de la boutique externe (Shopify shop domain, Scalot store name)
  shopName: {
    type: String,
    trim: true,
    default: ''
  },
  // Statistiques rapides
  ordersCount: {
    type: Number,
    default: 0
  },
  lastOrderAt: {
    type: Date,
    default: null
  }
}, {
  collection: 'order_sources',
  timestamps: true
});

// Index pour recherche rapide
orderSourceSchema.index({ workspaceId: 1, isActive: 1 });
orderSourceSchema.index({ workspaceId: 1, type: 1 });

export default mongoose.model('OrderSource', orderSourceSchema);
