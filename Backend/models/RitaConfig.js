import mongoose from 'mongoose';

const ritaConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // Activation
  enabled: { type: Boolean, default: false },
  instanceId: { type: String, default: '' },

  // Identité de l'agent
  agentName: { type: String, default: 'Rita' },
  agentRole: { type: String, default: 'Conseillère commerciale' },
  language: { type: String, default: 'fr' }, // fr, en, fr_en, es, ar
  toneStyle: { type: String, default: 'professional_warm' },
  useEmojis: { type: Boolean, default: true },
  signMessages: { type: Boolean, default: false },
  responseDelay: { type: Number, default: 2 },
  welcomeMessage: { type: String, default: '' },
  fallbackMessage: { type: String, default: '' },

  // Intelligence & Autonomie
  autonomyLevel: { type: String, default: 'supervised' },
  canCloseDeals: { type: Boolean, default: false },
  canSendPaymentLinks: { type: Boolean, default: false },
  requireHumanApproval: { type: Boolean, default: true },
  followUpEnabled: { type: Boolean, default: false },
  followUpDelay: { type: Number, default: 24 },
  followUpMessage: { type: String, default: '' },
  followUpMaxRelances: { type: Number, default: 3 },
  followUpRelanceMessages: [{ type: String }],
  followUpOffer: { type: String, default: '' },
  escalateAfterMessages: { type: Number, default: 10 },

  // Témoignages clients
  testimonialsEnabled: { type: Boolean, default: false },
  testimonials: [{
    clientName: { type: String, default: '' },
    text: { type: String, default: '' },
    product: { type: String, default: '' },
  }],

  // Base de connaissances
  businessContext: { type: String, default: '' },
  products: { type: [String], default: [] },
  faq: { type: [String], default: [] },
  usefulLinks: { type: [String], default: [] },
  competitiveAdvantages: { type: [String], default: [] },

  // Catalogue produits structuré
  productCatalog: [{
    name: { type: String, required: true },
    price: { type: String, default: '' },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    images: [String],
    videos: [String],
    features: [String],
    faq: [{ question: { type: String }, answer: { type: String } }],
    objections: [{ objection: { type: String }, response: { type: String } }],
    inStock: { type: Boolean, default: true },
    // Pricing negotiation per product
    minPrice: { type: String, default: '' },
    maxDiscountPercent: { type: Number, default: 0 },
    priceNote: { type: String, default: '' },
  }],

  // Personnalité & ton de l'agent
  personality: {
    description: { type: String, default: '' },
    mannerisms: [String],
    forbiddenPhrases: [String],
    tonalGuidelines: { type: String, default: '' },
  },

  // Exemples de conversations (pairs client/agent)
  conversationExamples: [{
    customer: { type: String },
    agent: { type: String },
  }],

  // Règles de comportement
  behaviorRules: [{
    situation: { type: String },
    reaction: { type: String },
  }],

  // Stratégie de vente
  autoReplyKeywords: { type: [String], default: [] },
  qualificationQuestions: { type: [String], default: [] },
  closingTechnique: { type: String, default: 'soft' },
  objectionsHandling: { type: String, default: '' },

  // 🎁 Offres commerciales gérées par Rita
  commercialOffersEnabled: { type: Boolean, default: false },
  commercialOffers: [{
    title: { type: String, default: '' },
    appliesTo: { type: String, default: '' },
    trigger: { type: String, default: 'hesitation' },
    benefit: { type: String, default: '' },
    message: { type: String, default: '' },
    conditions: { type: String, default: '' },
    active: { type: Boolean, default: true },
  }],

  // 💰 Négociation & prix
  pricingNegotiation: {
    enabled: { type: Boolean, default: false },
    allowDiscount: { type: Boolean, default: false },
    maxDiscountPercent: { type: Number, default: 0 },
    negotiationStyle: { type: String, default: 'firm' }, // firm, flexible, generous
    priceIsFinal: { type: Boolean, default: true },
    discountConditions: { type: String, default: '' },
    refusalMessage: { type: String, default: '' },
    globalNote: { type: String, default: '' },
  },

  // 🌍 Détection automatique de langue
  autoLanguageDetection: { type: Boolean, default: true },

  // 🎙️ Réponses vocales
  // responseMode: 'text' | 'voice' | 'both'
  responseMode: { type: String, enum: ['text', 'voice', 'both'], default: 'text' },
  voiceMode: { type: Boolean, default: false }, // legacy compat
  elevenlabsApiKey: { type: String, default: '' },
  elevenlabsVoiceId: { type: String, default: 'cgSgspJ2msm6clMCkdW9' }, // Jessica (FR multilingual)
  elevenlabsModel: { type: String, default: 'eleven_v3' }, // Eleven v3 — meilleur modèle (70+ langues)
  voiceStylePreset: { type: String, enum: ['balanced', 'natural'], default: 'balanced' },

  // 🎙️ Voix avancée — Fish.audio (S2-Pro)
  ttsProvider: { type: String, enum: ['elevenlabs', 'fishaudio'], default: 'elevenlabs' },
  fishAudioApiKey: { type: String, default: '' },
  fishAudioReferenceId: { type: String, default: '14b22748e04a48a58f92fbcde088ee50' },
  fishAudioModel: { type: String, default: 's2-pro' },
  fishAudioVoices: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    state: { type: String, default: 'ready' },
    visibility: { type: String, default: 'private' },
    createdAt: { type: Date, default: Date.now },
    sampleCount: { type: Number, default: 1 },
    source: { type: String, default: 'fish.audio' },
  }],

  // 🔔 Notifications boss
  bossNotifications: { type: Boolean, default: false },
  bossPhone: { type: String, default: '' },
  notifyOnOrder: { type: Boolean, default: true },

  // 🤝 Escalade boss (question sans réponse → demander au boss)
  bossEscalationEnabled: { type: Boolean, default: false },
  bossEscalationTimeoutMin: { type: Number, default: 30 },
  notifyOnScheduled: { type: Boolean, default: true },
  dailySummary: { type: Boolean, default: true },
  dailySummaryTime: { type: String, default: '20:00' },

  // 📦 Gestion de stock par ville
  stockManagementEnabled: { type: Boolean, default: false },
  stockEntries: [{
    productName: { type: String, required: true },
    city: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: '' },
  }],

  // ─── Messages d'accusé de réception de commande ──────────────────────────
  // Activé uniquement pour les workspaces qui envoient le premier message via l'agent
  orderConfirmationMessage: {
    type: String,
    default: 'Bonjour {{first_name}} 👋\n\nJ\'espère que vous allez bien !\n\nIci le service client Zendo.\n\nNous accusons réception de votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nNous pouvons vous livrer aujourd\'hui (si la commande est passée avant 16h) ou demain (si elle est passée après 16h) 🙏🏼',
  },
  orderConfirmationMessageNonDeliverable: {
    type: String,
    default: 'Bonjour {{first_name}} 👋\n\nNous avons bien reçu votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nMalheureusement, nous ne livrons pas encore dans votre ville ({{city}}). Nous vous contacterons dès que la livraison sera disponible dans votre zone. 🙏',
  },
  enableCityRouting: { type: Boolean, default: false },
  deliverableZones: [{ type: String }],

  // Disponibilité
  businessHoursOnly: { type: Boolean, default: false },
  businessHoursStart: { type: String, default: '09:00' },
  businessHoursEnd: { type: String, default: '18:00' },
}, {
  timestamps: true,
  collection: 'rita_configs',
});

export default mongoose.model('RitaConfig', ritaConfigSchema);
