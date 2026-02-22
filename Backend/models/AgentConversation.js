import mongoose from 'mongoose';

const agentConversationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false,
    default: null,
    index: true
  },
  clientPhone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  clientName: {
    type: String,
    trim: true,
    default: ''
  },
  whatsappChatId: {
    type: String,
    required: true,
    index: true
  },
  state: {
    type: String,
    enum: [
      'pending_confirmation',  // En attente de confirmation livraison
      'negotiating_time',      // Négociation horaire
      'confirmed',             // Livraison confirmée
      'cancelled',             // Commande annulée
      'escalated',             // Escalade vers humain
      'completed'              // Conversation terminée
    ],
    default: 'pending_confirmation'
  },
  confidenceScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative', 'unknown'],
    default: 'unknown'
  },
  persuasionLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  refusalCount: {
    type: Number,
    default: 0
  },
  relanceCount: {
    type: Number,
    default: 0,
    max: 3
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  productName: {
    type: String,
    default: ''
  },
  productPrice: {
    type: Number,
    default: 0
  },
  deliveryTime: {
    type: String,
    default: ''
  },
  deliveryAddress: {
    type: String,
    default: ''
  },
  lastInteractionAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastMessageFromClient: {
    type: Date,
    default: null
  },
  lastMessageFromAgent: {
    type: Date,
    default: null
  },
  initialMessageSentAt: {
    type: Date,
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  escalatedAt: {
    type: Date,
    default: null
  },
  escalationReason: {
    type: String,
    default: ''
  },
  metadata: {
    responseTimeAvg: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    clientMessageCount: { type: Number, default: 0 },
    agentMessageCount: { type: Number, default: 0 },
    lastRelanceAt: { type: Date, default: null },
    tags: [String]
  },
  processedMessageIds: [{
    type: String
  }]
}, {
  timestamps: true,
  collection: 'ecom_agent_conversations'
});

agentConversationSchema.index({ workspaceId: 1, active: 1 });
agentConversationSchema.index({ workspaceId: 1, state: 1 });
agentConversationSchema.index({ workspaceId: 1, lastInteractionAt: -1 });
agentConversationSchema.index({ clientPhone: 1, active: 1 });
agentConversationSchema.index({ whatsappChatId: 1 }, { unique: true });

agentConversationSchema.methods.isMessageProcessed = function(messageId) {
  return this.processedMessageIds.includes(messageId);
};

agentConversationSchema.methods.markMessageProcessed = function(messageId) {
  if (!this.processedMessageIds.includes(messageId)) {
    this.processedMessageIds.push(messageId);
    if (this.processedMessageIds.length > 100) {
      this.processedMessageIds = this.processedMessageIds.slice(-100);
    }
  }
};

agentConversationSchema.methods.updateConfidenceScore = function(delta) {
  this.confidenceScore = Math.max(0, Math.min(100, this.confidenceScore + delta));
};

agentConversationSchema.methods.shouldRelance = function() {
  if (!this.active || this.state === 'confirmed' || this.state === 'cancelled') {
    return false;
  }
  if (this.relanceCount >= 3) {
    return false;
  }
  const now = new Date();
  const lastInteraction = this.lastInteractionAt || this.createdAt;
  const minutesSinceLastInteraction = (now - lastInteraction) / (1000 * 60);
  
  if (this.relanceCount === 0 && minutesSinceLastInteraction >= 30) return true;
  if (this.relanceCount === 1 && minutesSinceLastInteraction >= 120) return true;
  if (this.relanceCount === 2 && minutesSinceLastInteraction >= 1440) return true;
  
  return false;
};

agentConversationSchema.methods.shouldDeactivate = function() {
  if (!this.active) return false;
  
  const now = new Date();
  const lastInteraction = this.lastInteractionAt || this.createdAt;
  const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);
  
  return hoursSinceLastInteraction >= 24 || this.relanceCount >= 3;
};

const AgentConversation = mongoose.model('AgentConversation', agentConversationSchema);
export default AgentConversation;
