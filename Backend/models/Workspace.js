import mongoose from 'mongoose';
import crypto from 'crypto';

const workspaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true
  },
  inviteCode: {
    type: String,
    unique: true
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      currency: 'XOF',
      businessType: 'ecommerce'
    }
  },
  // Public store subdomain — generates https://{subdomain}.scalor.net
  subdomain: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  // Store configuration for public storefront
  storeSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      isStoreEnabled: false,
      storeName: '',
      storeDescription: '',
      storeLogo: '',
      storeBanner: '',
      storePhone: '',
      storeWhatsApp: '',
      storeThemeColor: '#0F6B4F',
      storeCurrency: 'XAF'
    }
  },
  // Theme config (colors, font, border-radius, template, section toggles)
  storeTheme: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Page sections config (ordered list of sections with config)
  storePages: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Pixel / tracking IDs
  storePixels: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Payment providers config
  storePayments: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Domain config (custom domain, SSL)
  storeDomains: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Delivery zones config (countries + zones per city with costs)
  storeDeliveryZones: {
    type: mongoose.Schema.Types.Mixed,
    default: { countries: [], zones: [] }
  },
  // Unique tsoken for Ssssshopify webhook URL per workspaces
  shopifyWebhookToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  // Token unique pour le webhook générique de commandes (/webhook/orders/:token)
  orderWebhookToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  // Filtres applicables aux commandes reçues par webhook
  // { allowedCities: ['Paris', 'Lyon'], allowedProducts: ['Nike'] }
  orderWebhookFilters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Active l'envoi automatique d'un message WhatsApp au client après commande Shopify
  whatsappAutoConfirm: {
    type: Boolean,
    default: false
  },
  // Template personnalisé pour le message WhatsApp de confirmation
  // Variables disponibles : {{first_name}}, {{order_number}}, {{product}}, {{quantity}}, {{city}}, {{total_price}}, {{currency}}, {{store_name}}
  whatsappOrderTemplate: {
    type: String,
    default: null
  },
  // Instance WhatsApp spécifique pour l'envoi auto (null = auto-detect)
  whatsappAutoInstanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WhatsAppInstance',
    default: null
  },
  // URL d'image par défaut à envoyer avec le message auto
  whatsappAutoImageUrl: {
    type: String,
    default: null
  },
  // URL audio/vocal par défaut à envoyer avec le message auto
  whatsappAutoAudioUrl: {
    type: String,
    default: null
  },
  // URL vidéo par défaut à envoyer avec le message auto
  whatsappAutoVideoUrl: {
    type: String,
    default: null
  },
  // URL document (PDF) par défaut à envoyer avec le message auto
  whatsappAutoDocumentUrl: {
    type: String,
    default: null
  },
  // Ordre d'envoi global (ex: text -> image -> video -> document -> audio)
  whatsappAutoSendOrder: {
    type: [String],
    default: ['text', 'image', 'audio']
  },
  // Règles d'envoi spécifiques par produit (matching par mot-clé)
  whatsappAutoProductMediaRules: {
    type: [{
      productKeyword: { type: String, required: true },
      imageUrl: { type: String, default: null },
      videoUrl: { type: String, default: null },
      documentUrl: { type: String, default: null },
      audioUrl: { type: String, default: null },
      sendOrder: { type: [String], default: [] }
    }],
    default: []
  },
  // Multi-store: reference to the default/primary Store for this workspace
  primaryStoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // ─── Billing / Plan ──────────────────────────────────────────────────────
  plan: {
    type: String,
    enum: ['free', 'pro', 'ultra'],
    default: 'free',
    index: true
  },
  // Date when the plan expires; null = no active subscription
  planExpiresAt: {
    type: Date,
    default: null
  },
  // Last confirmed MoneyFusion tokenPay for traceability
  planPaymentToken: {
    type: String,
    default: null
  },
  // Free trial tracking
  trialStartedAt: {
    type: Date,
    default: null
  },
  trialEndsAt: {
    type: Date,
    default: null
  },
  trialUsed: {
    type: Boolean,
    default: false
  },
  // Track when trial expiry notifications were sent (to avoid duplicates)
  trialExpiryNotifiedAt: {
    type: Date,
    default: null
  },
  trialExpiredNotifiedAt: {
    type: Date,
    default: null
  },

  // ─── Product Page Generator Tracking ─────────────────────────────────────
  // Legacy fields (backward compat — still used for old single-tier flow)
  freeGenerationsRemaining: {
    type: Number,
    default: 0,
    min: 0
  },
  totalGenerations: {
    type: Number,
    default: 0,
    min: 0
  },
  paidGenerationsRemaining: {
    type: Number,
    default: 0,
    min: 0
  },

  // ─── Two-tier: Simple / Pro credits ────────────────────────────────────────
  simpleGenerationsRemaining: {
    type: Number,
    default: 0,
    min: 0
  },
  proGenerationsRemaining: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSimpleGenerations: {
    type: Number,
    default: 0,
    min: 0
  },
  totalProGenerations: {
    type: Number,
    default: 0,
    min: 0
  },

  // Last generation date (for tracking)
  lastGenerationAt: {
    type: Date,
    default: null
  },

  invites: [{
    token: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    },
    used: {
      type: Boolean,
      default: false
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EcomUser'
    },
    usedAt: {
      type: Date
    }
  }]
}, {
  collection: 'ecom_workspaces',
  timestamps: true
});

// Générer slug et inviteCode avant sauvegarde
workspaceSchema.pre('save', function () {
  if (this.isNew) {
    if (!this.slug) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
    }
    if (!this.inviteCode) {
      this.inviteCode = crypto.randomBytes(6).toString('hex');
    }
  }
});

// Régénérer le code d'invitation
workspaceSchema.methods.regenerateInviteCode = function () {
  this.inviteCode = crypto.randomBytes(6).toString('hex');
  return this.save();
};

// Créer une invitation par lien
workspaceSchema.methods.createInviteLink = function (createdBy) {
  const token = crypto.randomBytes(32).toString('hex');
  this.invites.push({
    token,
    createdBy,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
  });
  return this.save().then(() => token);
};

workspaceSchema.index({ owner: 1 });
// Subdomain lookup for public store routing
workspaceSchema.index({ subdomain: 1 }, { unique: true, sparse: true });
// Compound index for resolveWorkspace middleware query
workspaceSchema.index({ subdomain: 1, isActive: 1, 'storeSettings.isStoreEnabled': 1 });

export default mongoose.model('EcomWorkspace', workspaceSchema);
