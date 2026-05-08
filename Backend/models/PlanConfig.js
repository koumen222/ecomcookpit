import mongoose from 'mongoose';

const PLAN_KEYS = ['free', 'starter', 'pro', 'ultra'];
let _productLimitsMigrated = false;
let _pricingMigrated = false;

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
  if (count > 0) {
    if (!_productLimitsMigrated) {
      _productLimitsMigrated = true;
      await this.updateMany(
        { key: { $in: ['starter', 'pro', 'ultra'] }, 'limits.maxProducts': { $ne: -1 } },
        { $set: { 'limits.maxProducts': -1 } }
      );
    }
    if (!_pricingMigrated) {
      _pricingMigrated = true;
      // Ensure free plan limits are correct
      await this.updateOne(
        { key: 'free' },
        { $set: {
          priceRegular: 0,
          pricePromo: null,
          promoActive: false,
          'limits.maxOrders': 50,
          'limits.maxCustomers': 50,
          'limits.maxProducts': 10,
          'limits.maxStores': 1,
          'limits.maxUsers': 1,
          'limits.maxWhatsappInstances': 0,
          'limits.maxWhatsappMessagesPerDay': 0,
          'limits.maxWhatsappMessagesPerMonth': 0,
          'limits.maxAiPageCredits': 0,
          'features.hasAiAgent': false,
          'features.hasAiPageGen': false,
          'features.hasPrioritySupport': false,
          'features.hasApiWebhooks': false,
          'features.hasMultiStore': false,
          'features.hasAnalyticsDashboard': false,
          'features.hasCustomStore': true,
          featuresList: [
            '50 commandes / mois',
            '50 clients max',
            '10 produits max',
            'Tableau de bord basique',
            '1 boutique en ligne',
            '1 utilisateur'
          ],
          ctaLabel: 'Commencer',
          order: 0
        }}
      );
      // Ensure starter plan limits and price are correct
      await this.updateOne(
        { key: 'starter' },
        { $set: {
          priceRegular: 7900,
          pricePromo: 2000,
          promoActive: true,
          'limits.maxOrders': -1,
          'limits.maxCustomers': -1,
          'limits.maxProducts': -1,
          'limits.maxStores': 1,
          'limits.maxUsers': 3,
          'limits.maxWhatsappInstances': 0,
          'limits.maxWhatsappMessagesPerDay': 0,
          'limits.maxWhatsappMessagesPerMonth': 0,
          'limits.maxAiPageCredits': 0,
          'features.hasAiAgent': false,
          'features.hasAiPageGen': false,
          'features.hasPrioritySupport': false,
          'features.hasApiWebhooks': false,
          'features.hasMultiStore': false,
          'features.hasAnalyticsDashboard': true,
          'features.hasCustomStore': true,
          ctaLabel: 'Commencer avec Scalor',
          order: 1,
          featuresList: [
            'Commandes illimitées',
            'Gestion clients complète',
            'Catalogue produits illimité',
            'Tableau de bord analytique',
            'Boutique en ligne personnalisée',
            'Notifications & suivi livraisons'
          ]
        }}
      );
      // Ensure pro plan limits and price are correct
      await this.updateOne(
        { key: 'pro' },
        { $set: {
          priceRegular: 14900,
          pricePromo: 5000,
          promoActive: true,
          highlighted: true,
          'limits.maxOrders': -1,
          'limits.maxCustomers': -1,
          'limits.maxProducts': -1,
          'limits.maxStores': 1,
          'limits.maxUsers': 5,
          'limits.maxWhatsappInstances': 1,
          'limits.maxWhatsappMessagesPerDay': 1000,
          'limits.maxWhatsappMessagesPerMonth': 50000,
          'limits.maxAiPageCredits': 0,
          'features.hasAiAgent': true,
          'features.hasAiPageGen': false,
          'features.hasPrioritySupport': true,
          'features.hasApiWebhooks': false,
          'features.hasMultiStore': false,
          'features.hasAnalyticsDashboard': true,
          'features.hasCustomStore': true,
          ctaLabel: 'Commencer avec Scalor + IA',
          order: 2,
          featuresList: [
            'Tout Scalor inclus',
            '1 agent IA commercial WhatsApp',
            '1 numéro WhatsApp connecté',
            '1 000 messages / jour',
            '50 000 messages / mois',
            'Réponses automatiques 24h/7j',
            'Support prioritaire',
            '3 crédits page produit IA / mois'
          ]
        }}
      );
      // Ensure ultra plan limits and price are correct
      await this.updateOne(
        { key: 'ultra' },
        { $set: {
          priceRegular: 34900,
          pricePromo: 7500,
          promoActive: true,
          'limits.maxOrders': -1,
          'limits.maxCustomers': -1,
          'limits.maxProducts': -1,
          'limits.maxStores': -1,
          'limits.maxUsers': -1,
          'limits.maxWhatsappInstances': 5,
          'limits.maxWhatsappMessagesPerDay': -1,
          'limits.maxWhatsappMessagesPerMonth': -1,
          'limits.maxAiPageCredits': 10,
          'features.hasAiAgent': true,
          'features.hasAiPageGen': true,
          'features.hasPrioritySupport': true,
          'features.hasApiWebhooks': true,
          'features.hasMultiStore': true,
          'features.hasAnalyticsDashboard': true,
          'features.hasCustomStore': true,
          ctaLabel: 'Commencer avec Scalor IA Pro',
          order: 3,
          featuresList: [
            'Tout Scalor + IA inclus',
            '5 agents IA actifs simultanés',
            '5 numéros WhatsApp connectés',
            'Messages illimités',
            '20 crédits page produit IA / mois',
            'Gestion multi-boutiques',
            'Support 24/7 dédié',
            'API & webhooks',
            'Formation complète en E-commerce en Afrique',
            '50 génération de créatives images'
          ]
        }}
      );
    }
    return;
  }
  const defaults = [
    {
      key: 'free',
      displayName: 'Gratuit',
      tagline: 'Démarrez sans frais',
      priceRegular: 0,
      pricePromo: null,
      promoActive: false,
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
        hasAnalyticsDashboard: false,
        hasCustomStore: true
      },
      featuresList: [
        '50 commandes / mois',
        '50 clients max',
        '10 produits max',
        'Tableau de bord basique',
        '1 boutique en ligne',
        '1 utilisateur'
      ],
      ctaLabel: 'Commencer'
    },
    {
      key: 'starter',
      displayName: 'Scalor',
      tagline: 'Gestion complète de vos commandes',
      priceRegular: 7900,
      pricePromo: 2000,
      promoActive: true,
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
      priceRegular: 14900,
      pricePromo: 5000,
      promoActive: true,
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
        'Support prioritaire',
        '3 crédits page produit IA / mois'
      ],
      ctaLabel: 'Commencer avec Scalor + IA'
    },
    {
      key: 'ultra',
      displayName: 'Scalor IA Pro',
      tagline: 'La puissance maximale pour scaler',
      priceRegular: 34900,
      pricePromo: 7500,
      promoActive: true,
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
        '20 crédits page produit IA / mois',
        'Gestion multi-boutiques',
        'Support 24/7 dédié',
        'API & webhooks',
        'Formation complète en E-commerce en Afrique',
        '50 génération de créatives images'
      ],
      ctaLabel: 'Commencer avec Scalor IA Pro'
    }
  ];
  await this.insertMany(defaults);
};

export default mongoose.model('PlanConfig', planConfigSchema);
export { PLAN_KEYS };
