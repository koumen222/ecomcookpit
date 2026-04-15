import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  from: { type: String, enum: ['visitor', 'agent'], required: true },
  text:  { type: String, required: true, maxlength: 4000 },
  agentName: { type: String, default: 'Rita' },
  senderType: {
    type: String,
    enum: ['user', 'admin', 'ai', 'system'],
    default: function resolveSenderType() {
      return this.from === 'visitor' ? 'user' : 'admin';
    }
  },
  confidence: { type: Number, default: null, min: 0, max: 100 },
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
  workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', default: null, index: true },
  threadType:   { type: String, enum: ['authenticated', 'visitor'], default: 'authenticated', index: true },
  subject:      { type: String, default: '' },
  category:     { type: String, enum: ['general', 'bug', 'billing', 'feature', 'account', 'other'], default: 'general' },
  priority:     { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
  messages:     { type: [messageSchema], default: [] },
  status:       { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
  workflowStatus: {
    type: String,
    enum: ['ai', 'pending_admin', 'resolved'],
    default: 'pending_admin',
    index: true
  },
  handledBy: {
    type: String,
    enum: ['none', 'ai', 'admin'],
    default: 'none',
    index: true
  },
  aiConfidence: { type: Number, default: null, min: 0, max: 100 },
  aiThreshold: { type: Number, default: 78, min: 0, max: 100 },
  aiSummary: { type: String, default: '', maxlength: 600 },
  escalationReason: { type: String, default: '', maxlength: 400 },
  lastEscalatedAt: { type: Date, default: null },
  lastAdminNotificationAt: { type: Date, default: null },
  adminNotificationStatus: {
    type: String,
    enum: ['idle', 'sent', 'failed'],
    default: 'idle'
  },
  adminNotificationError: { type: String, default: '', maxlength: 500 },
  adminNotifiedPhone: { type: String, default: '' },
  unreadAdmin:  { type: Number, default: 0 },  // visitor msgs not yet read by admin
  unreadUser:   { type: Number, default: 0 },  // admin msgs not yet read by user
  lastMessageAt:{ type: Date, default: Date.now },
}, { timestamps: true });

supportConversationSchema.index({ workspaceId: 1, userId: 1, lastMessageAt: -1 });
supportConversationSchema.index({ workspaceId: 1, workflowStatus: 1, priority: 1, lastMessageAt: -1 });
supportConversationSchema.index({ userId: 1, workspaceId: 1, status: 1, lastMessageAt: -1 });

export default mongoose.model('SupportConversation', supportConversationSchema);
