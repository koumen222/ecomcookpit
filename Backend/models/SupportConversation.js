import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  from: { type: String, enum: ['visitor', 'agent'], required: true },
  text:  { type: String, required: true, maxlength: 4000 },
  agentName: { type: String, default: 'Rita' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const supportConversationSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true, index: true },
  visitorName:  { type: String, default: '' },
  visitorEmail: { type: String, default: '' },
  messages:     { type: [messageSchema], default: [] },
  status:       { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
  unreadAdmin:  { type: Number, default: 0 },  // visitor msgs not yet read by admin
  lastMessageAt:{ type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('SupportConversation', supportConversationSchema);
