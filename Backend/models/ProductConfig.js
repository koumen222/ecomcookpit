import mongoose from 'mongoose';

const productConfigSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productNameVariants: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  pricing: {
    sellingPrice: { type: Number, required: true },
    promoPrice: { type: Number, default: null },
    deliveryCost: { type: Number, default: 0 },
    freeDeliveryThreshold: { type: Number, default: null }
  },
  delivery: {
    estimatedTime: { type: String, default: 'dans la journée' },
    availableSlots: [{ type: String }],
    zones: [{ type: String }],
    expressAvailable: { type: Boolean, default: true },
    expressMessage: { type: String, default: 'Le livreur est déjà dans votre zone aujourd\'hui.' }
  },
  guarantee: {
    hasGuarantee: { type: Boolean, default: false },
    duration: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  advantages: [{
    title: { type: String },
    description: { type: String }
  }],
  faq: [{
    question: { type: String },
    answer: { type: String }
  }],
  objections: [{
    objection: { type: String },
    response: { type: String }
  }],
  agentConfig: {
    tonality: {
      type: String,
      enum: ['friendly', 'professional', 'casual', 'formal'],
      default: 'friendly'
    },
    language: {
      type: String,
      default: 'fr-CM'
    },
    useEmojis: {
      type: Boolean,
      default: true
    },
    maxMessageLength: {
      type: Number,
      default: 500
    },
    persuasionStyle: {
      type: String,
      enum: ['soft', 'balanced', 'assertive'],
      default: 'balanced'
    },
    closingPhrases: [{
      type: String
    }],
    greetingTemplates: [{
      type: String
    }],
    urgencyMessages: [{
      level: { type: Number },
      message: { type: String }
    }]
  },
  persuasionArguments: {
    level1: [{
      type: String
    }],
    level2: [{
      type: String
    }],
    level3: [{
      type: String
    }]
  },
  relanceMessages: {
    relance1: {
      type: String,
      default: 'Bonjour 👋 Je voulais juste m\'assurer que vous avez bien reçu mon message. On peut toujours vous livrer aujourd\'hui si ça vous arrange ?'
    },
    relance2: {
      type: String,
      default: 'Coucou ! Notre livreur passe dans votre quartier cet après-midi. C\'est le dernier passage de la journée, vous confirmez ?'
    },
    relance3: {
      type: String,
      default: 'Bonjour ! Je voulais savoir si vous êtes toujours intéressé(e) par votre commande. On peut organiser la livraison demain si vous préférez 😊'
    }
  },
  initialMessage: {
    type: String,
    default: 'Bonjour 👋\nNous avons bien reçu votre commande du {PRODUIT}.\nLe livreur est déjà dans votre zone aujourd\'hui.\nOn vous livre dans l\'après-midi ?'
  },
  confirmationMessage: {
    type: String,
    default: 'Parfait ! 🎉 Votre livraison est confirmée pour {HORAIRE}.\nLe livreur vous appellera avant de passer.\nMerci pour votre confiance !'
  },
  cancellationMessage: {
    type: String,
    default: 'D\'accord, je note l\'annulation de votre commande.\nN\'hésitez pas à revenir vers nous si vous changez d\'avis.\nBonne journée ! 👋'
  },
  metadata: {
    totalConversations: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
    avgConfidenceScore: { type: Number, default: 0 },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' }
  }
}, {
  timestamps: true,
  collection: 'ecom_product_configs'
});

productConfigSchema.index({ workspaceId: 1, productName: 1 });
productConfigSchema.index({ workspaceId: 1, isActive: 1 });

productConfigSchema.methods.getInitialMessage = function(orderData) {
  let message = this.initialMessage;
  message = message.replace('{PRODUIT}', orderData.product || this.productName);
  message = message.replace('{PRIX}', orderData.price || this.pricing.sellingPrice);
  message = message.replace('{CLIENT}', orderData.clientName || '');
  return message;
};

productConfigSchema.methods.getRelanceMessage = function(relanceNumber) {
  switch(relanceNumber) {
    case 1: return this.relanceMessages.relance1;
    case 2: return this.relanceMessages.relance2;
    case 3: return this.relanceMessages.relance3;
    default: return this.relanceMessages.relance1;
  }
};

productConfigSchema.methods.getPersuasionArgument = function(level) {
  const args = this.persuasionArguments[`level${level}`] || [];
  if (args.length === 0) return null;
  return args[Math.floor(Math.random() * args.length)];
};

productConfigSchema.methods.findFaqAnswer = function(question) {
  const normalizedQ = question.toLowerCase().trim();
  for (const faq of this.faq) {
    if (normalizedQ.includes(faq.question.toLowerCase())) {
      return faq.answer;
    }
  }
  return null;
};

productConfigSchema.methods.findObjectionResponse = function(objection) {
  const normalizedObj = objection.toLowerCase().trim();
  for (const obj of this.objections) {
    if (normalizedObj.includes(obj.objection.toLowerCase())) {
      return obj.response;
    }
  }
  return null;
};

productConfigSchema.statics.findByProductName = async function(workspaceId, productName) {
  const normalizedName = productName.toLowerCase().trim();
  
  let config = await this.findOne({
    workspaceId,
    isActive: true,
    $or: [
      { productName: { $regex: new RegExp(normalizedName, 'i') } },
      { productNameVariants: { $regex: new RegExp(normalizedName, 'i') } }
    ]
  });
  
  if (!config) {
    config = await this.findOne({
      workspaceId,
      isActive: true,
      productName: 'default'
    });
  }
  
  return config;
};

const ProductConfig = mongoose.model('ProductConfig', productConfigSchema);
export default ProductConfig;
