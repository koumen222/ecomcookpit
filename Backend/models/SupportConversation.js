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
  // Authenticated user fields
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', default: null, index: true },
  userName:     { type: String, default: '' },
  userEmail:    { type: String, default: '' },
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', default: null },
  subject:      { type: String, default: '' },
  category:     { type: String, enum: ['general', 'bug', 'billing', 'feature', 'account', 'other'], default: 'general' },
  messages:     { type: [messageSchema], default: [] },
  status:       { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
  unreadAdmin:  { type: Number, default: 0 },  // visitor msgs not yet read by admin
  unreadUser:   { type: Number, default: 0 },  // admin msgs not yet read by user
  lastMessageAt:{ type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('SupportConversation', supportConversationSchema);
