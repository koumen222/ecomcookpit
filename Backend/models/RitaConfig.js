import mongoose from 'mongoose';

const ritaConfigSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },

  // Activation
  enabled: { type: Boolean, default: false },
  instanceId: { type: String, default: '' },

  // Identité de l'agent
  agentName: { type: String, default: 'Rita' },
  agentRole: { type: String, default: 'Conseillère commerciale' },
  language: { type: String, default: 'fr' },
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
  escalateAfterMessages: { type: Number, default: 10 },

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
    features: [String],
    faq: [{ question: { type: String }, answer: { type: String } }],
    objections: [{ objection: { type: String }, response: { type: String } }],
    inStock: { type: Boolean, default: true },
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

  // 🎙️ Réponses vocales
  // responseMode: 'text' | 'voice' | 'both'
  responseMode: { type: String, enum: ['text', 'voice', 'both'], default: 'text' },
  voiceMode: { type: Boolean, default: false }, // legacy compat
  elevenlabsApiKey: { type: String, default: '' },
  elevenlabsVoiceId: { type: String, default: 'cgSgspJ2msm6clMCkdW9' }, // Jessica (FR multilingual)
  elevenlabsModel: { type: String, default: 'eleven_v3' }, // Eleven v3 — meilleur modèle (70+ langues)

  // Disponibilité
  businessHoursOnly: { type: Boolean, default: false },
  businessHoursStart: { type: String, default: '09:00' },
  businessHoursEnd: { type: String, default: '18:00' },
}, {
  timestamps: true,
  collection: 'rita_configs',
});

export default mongoose.model('RitaConfig', ritaConfigSchema);
