import mongoose from 'mongoose';

const ritaConfigSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  agentId: { type: String, index: true }, // Nouvelle clé pour supporter les configs par agent

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

  // ─── Business Profile ───
  country: { type: String, default: '' },
  niche: { type: String, default: '' },
  productType: { type: String, default: '' },

  // ─── Communication Style ───
  communicationStyle: { type: String, enum: ['professional', 'friendly', 'casual', 'formal'], default: 'friendly' },
  tone: { type: String, default: '' },
  personality: { type: mongoose.Schema.Types.Mixed, default: '' }, // Accepte string ou objet

  // ─── Boss settings ───
  bossPhone: { type: String, default: '' },
  bossNotifications: { type: Boolean, default: false },
  notifyOnOrder: { type: Boolean, default: true },

  // ─── Instructions personnalisées propriétaire ───
  customInstructionsEnabled: { type: Boolean, default: false },
  customInstructions: { type: String, default: '' },

  // ─── Premier message (règles d'accueil) ───
  firstMessageRulesEnabled: { type: Boolean, default: false },
  firstMessageRules: [{
    type: { type: String, enum: ['video', 'image', 'text', 'catalog'], default: 'text' },
    content: { type: String, default: '' }, // URL pour video/image, texte pour text
    label: { type: String, default: '' },   // Description courte
    enabled: { type: Boolean, default: true },
  }],

  // ─── Métadonnées ───
  onboardingCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, {
  collection: 'rita_configs',
  timestamps: true,
  strict: false // Permettre les champs non définis dans le schéma
});

// Index pour recherche rapide
ritaConfigSchema.index({ userId: 1 });
ritaConfigSchema.index({ enabled: 1 });

export default mongoose.model('RitaConfig', ritaConfigSchema);
