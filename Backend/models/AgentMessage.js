import mongoose from 'mongoose';

const agentMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentConversation',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  sender: {
    type: String,
    enum: ['client', 'agent', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  whatsappMessageId: {
    type: String,
    default: null,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker'],
    default: 'text'
  },
  intent: {
    type: String,
    enum: [
      'confirmation',       // Client confirme livraison
      'negotiation',        // Client négocie horaire/date
      'question',           // Client pose une question
      'objection',          // Client a une objection
      'cancellation',       // Client veut annuler
      'greeting',           // Salutation
      'thanks',             // Remerciement
      'unclear',            // Intention pas claire
      'positive',           // Réponse positive générale
      'negative',           // Réponse négative générale
      'initial_message',    // Message initial de l'agent
      'follow_up',          // Relance agent
      'closing',            // Clôture conversation
      'unknown'
    ],
    default: 'unknown'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'neutral', 'negative', 'unknown'],
    default: 'unknown'
  },
  confidenceImpact: {
    type: Number,
    default: 0
  },
  promptUsed: {
    type: String,
    default: ''
  },
  gptModel: {
    type: String,
    default: ''
  },
  gptTokensUsed: {
    type: Number,
    default: 0
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  errorMessage: {
    type: String,
    default: ''
  },
  metadata: {
    responseTime: { type: Number, default: 0 },
    processingTime: { type: Number, default: 0 },
    isRelance: { type: Boolean, default: false },
    relanceNumber: { type: Number, default: 0 },
    extractedInfo: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  collection: 'ecom_agent_messages'
});

agentMessageSchema.index({ conversationId: 1, createdAt: 1 });
agentMessageSchema.index({ workspaceId: 1, createdAt: -1 });
agentMessageSchema.index({ whatsappMessageId: 1 }, { sparse: true });

agentMessageSchema.statics.getConversationHistory = async function(conversationId, limit = 20) {
  return this.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

agentMessageSchema.statics.formatForPrompt = async function(conversationId, limit = 10) {
  const messages = await this.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  return messages.reverse().map(msg => {
    const role = msg.sender === 'client' ? 'Client' : 'Agent';
    return `${role}: ${msg.content}`;
  }).join('\n');
};

const AgentMessage = mongoose.model('AgentMessage', agentMessageSchema);
export default AgentMessage;
