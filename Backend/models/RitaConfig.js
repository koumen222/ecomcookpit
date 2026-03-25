import mongoose from 'mongoose';

const ritaConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // ─── Activation ───
  enabled: { type: Boolean, default: false },
  instanceId: { type: String, default: '' },

  // ─── Identité ───
  agentName: { type: String, default: 'Rita' },
  welcomeMessage: { type: String, default: 'Bonjour 👋 Comment puis-je vous aider ?' },

  // ─── Catalogue produits ───
  productCatalog: [{
    name: { type: String, required: true },
    price: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    images: [String],
    videos: [String],
    features: [String],
    inStock: { type: Boolean, default: true },
    quantityOffers: [{
      minQuantity: { type: Number, required: true },
      unitPrice: { type: String, default: '' },
      totalPrice: { type: String, default: '' },
      label: { type: String, default: '' },
    }],
  }],

  // ─── Boss settings ───
  bossPhone: { type: String, default: '' },
  bossNotifications: { type: Boolean, default: false },
  notifyOnOrder: { type: Boolean, default: true },

  // ─── Métadonnées ───
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'rita_configs',
  timestamps: true
});

// Index pour recherche rapide
ritaConfigSchema.index({ userId: 1 });
ritaConfigSchema.index({ enabled: 1 });

export default mongoose.model('RitaConfig', ritaConfigSchema);
