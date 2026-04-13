import mongoose from 'mongoose';

const ritaConversationHistoryEntrySchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const ritaConversationMemorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  agentId: {
    type: String,
    default: '',
    index: true,
  },
  phone: {
    type: String,
    required: true,
    index: true,
  },
  history: {
    type: [ritaConversationHistoryEntrySchema],
    default: [],
  },
  clientState: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  askedQuestions: {
    type: [String],
    default: [],
  },
  tracker: {
    lastClientMessage: { type: Date, default: null },
    lastAgentMessage: { type: Date, default: null },
    relanceCount: { type: Number, default: 0 },
    ordered: { type: Boolean, default: false },
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
  collection: 'rita_conversation_memory',
});

ritaConversationMemorySchema.index({ userId: 1, agentId: 1, phone: 1 }, { unique: true });
ritaConversationMemorySchema.index({ userId: 1, lastActivityAt: -1 });

export default mongoose.model('RitaConversationMemory', ritaConversationMemorySchema);