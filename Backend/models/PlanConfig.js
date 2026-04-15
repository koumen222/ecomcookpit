import mongoose from 'mongoose';

const PLAN_KEYS = ['free', 'starter', 'pro', 'ultra'];

const planConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: PLAN_KEYS,
    required: true,
    unique: true,
    index: true
  },
  displayName: { type: String, required: true },
  tagline: { type: String, default: '' },

  priceRegular: { type: Number, default: 0, min: 0 },
  pricePromo: { type: Number, default: null, min: 0 },
  promoActive: { type: Boolean, default: false },
  promoExpiresAt: { type: Date, default: null },
  currency: { type: String, default: 'FCFA' },

  limits: {
    maxOrders: { type: Number, default: -1 },
    maxCustomers: { type: Number, default: -1 },
    maxProducts: { type: Number, default: -1 },
    maxStores: { type: Number, default: 1 },
    maxUsers: { type: Number, default: 1 },
    maxWhatsappInstances: { type: Number, default: 0 },
    maxWhatsappMessagesPerDay: { type: Number, default: 0 },
    maxWhatsappMessagesPerMonth: { type: Number, default: 0 },
    maxAiPageCredits: { type: Number, default: 0 }
  },

  features: {
    hasAiAgent: { type: Boolean, default: false },
    hasAiPageGen: { type: Boolean, default: false },
    hasPrioritySupport: { type: Boolean, default: false },
    hasApiWebhooks: { type: Boolean, default: false },
    hasMultiStore: { type: Boolean, default: false },
    hasAnalyticsDashboard: { type: Boolean, default: false },
    hasCustomStore: { type: Boolean, default: false }
  },

  featuresList: { type: [String], default: [] },

  highlighted: { type: Boolean, default: false },
  ctaLabel: { type: String, default: 'Commencer' },
  order: { type: Number, default: 0 }
}, {
  collection: 'ecom_plan_configs',
  timestamps: true
});

planConfigSchema.statics.PLAN_KEYS = PLAN_KEYS;

// Returns promo if active and not expired, else regular price
planConfigSchema.methods.getEffectivePrice = function () {
  if (!this.promoActive) return this.priceRegular;
  if (this.promoExpiresAt && this.promoExpiresAt.getTime() < Date.now()) return this.priceRegular;
  if (this.pricePromo == null) return this.priceRegular;
  return this.pricePromo;
};

// Seed the default config if no docs exist yet
planConfigSchema.statics.seedDefaults = async function () {
  const count = await this.countDocuments();
  if (count > 0) return;
  const now = Date.now();
  const in24h = new Date(now + 24 * 60 * 60 * 1000);
  const defaults = [
    {
      key: 'free',
      displayName: 'Gratuit',
      tagline: 'Démarrez sans frais',
      priceRegular: 0,
      order: 0,
      limits: {
        maxOrders: 50,
        maxCustomers: 50,
        maxProducts: 10,
        maxStores: 1,
        maxUsers: 1,
        maxWhatsappInstances: 0,
        maxWhatsappMessagesPerDay: 0,
        maxWhatsappMessagesPerMonth: 0,
        maxAiPageCredits: 0
      },
      features: {
        hasAiAgent: false,
        hasAiPageGen: false,
        hasPrioritySupport: false,
        hasApiWebhooks: false,
        hasMultiStore: false,
        hasAnalyticsDashboard: true,
        hasCustomStore: true
      },
      featuresList: [
        '50 commandes / mois',
        '50 clients max',
        '10 produits max',
        'Tableau de bord basique',
        '1 boutique en ligne',
        '1 utilisateur'
      ]
    },
    {
      key: 'starter',
      displayName: 'Scalor',
      tagline: 'Gestion complète de vos commandes',
      priceRegular: 5000,
      pricePromo: 2000,
      promoActive: false,
      promoExpiresAt: null,
      order: 1,
      limits: {
        maxOrders: -1,
        maxCustomers: -1,
        maxProducts: -1,
        maxStores: 1,
        maxUsers: 3,
        maxWhatsappInstances: 0,
        maxWhatsappMessagesPerDay: 0,
        maxWhatsappMessagesPerMonth: 0,
        maxAiPageCredits: 0
      },
      features: {
        hasAiAgent: false,
        hasAiPageGen: false,
        hasPrioritySupport: false,
        hasApiWebhooks: false,
        hasMultiStore: false,
        hasAnalyticsDashboard: true,
        hasCustomStore: true
      },
      featuresList: [
        'Commandes illimitées',
        'Gestion clients complète',
        'Catalogue produits illimité',
        'Tableau de bord analytique',
        'Boutique en ligne personnalisée',
        'Notifications & suivi livraisons'
      ],
      ctaLabel: 'Commencer avec Scalor'
    },
    {
      key: 'pro',
      displayName: 'Scalor + IA',
      tagline: 'Vendez automatiquement sur WhatsApp',
      priceRegular: 10000,
      pricePromo: 5000,
      promoActive: false,
      promoExpiresAt: null,
      highlighted: true,
      order: 2,
      limits: {
        maxOrders: -1,
        maxCustomers: -1,
        maxProducts: -1,
        maxStores: 1,
        maxUsers: 5,
        maxWhatsappInstances: 1,
        maxWhatsappMessagesPerDay: 1000,
        maxWhatsappMessagesPerMonth: 50000,
        maxAiPageCredits: 0
      },
      features: {
        hasAiAgent: true,
        hasAiPageGen: false,
        hasPrioritySupport: true,
        hasApiWebhooks: false,
        hasMultiStore: false,
        hasAnalyticsDashboard: true,
        hasCustomStore: true
      },
      featuresList: [
        'Tout Scalor inclus',
        '1 agent IA commercial WhatsApp',
        '1 numéro WhatsApp connecté',
        '1 000 messages / jour',
        '50 000 messages / mois',
        'Réponses automatiques 24h/7j',
        'Support prioritaire'
      ],
      ctaLabel: 'Commencer avec Scalor + IA'
    },
    {
      key: 'ultra',
      displayName: 'Scalor IA Pro',
      tagline: 'La puissance maximale pour scaler',
      priceRegular: 15000,
      pricePromo: 7500,
      promoActive: false,
      promoExpiresAt: null,
      order: 3,
      limits: {
        maxOrders: -1,
        maxCustomers: -1,
        maxProducts: -1,
        maxStores: -1,
        maxUsers: -1,
        maxWhatsappInstances: 5,
        maxWhatsappMessagesPerDay: -1,
        maxWhatsappMessagesPerMonth: -1,
        maxAiPageCredits: 10
      },
      features: {
        hasAiAgent: true,
        hasAiPageGen: true,
        hasPrioritySupport: true,
        hasApiWebhooks: true,
        hasMultiStore: true,
        hasAnalyticsDashboard: true,
        hasCustomStore: true
      },
      featuresList: [
        'Tout Scalor + IA inclus',
        '5 agents IA actifs simultanés',
        '5 numéros WhatsApp connectés',
        'Messages illimités',
        '10 crédits page produit IA / mois',
        'Gestion multi-boutiques',
        'Support 24/7 dédié',
        'API & webhooks'
      ],
      ctaLabel: 'Commencer avec Scalor IA Pro'
    }
  ];
  await this.insertMany(defaults);
};

export default mongoose.model('PlanConfig', planConfigSchema);
export { PLAN_KEYS };
