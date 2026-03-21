import mongoose from 'mongoose';

const directMessageSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true }],
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  
  // Message content - text is optional if media is present
  content: { type: String, maxlength: 4000, trim: true, default: '' },
  
  // Message type: text, image, audio, video, document
  messageType: { 
    type: String, 
    enum: ['text', 'image', 'audio', 'video', 'document'],
    default: 'text'
  },
  
  // Media reference (reuses existing media storage system)
  mediaId: { type: String, default: null },
  mediaUrl: { type: String, default: null },
  
  // Flexible metadata for media info, reactions, etc.
  metadata: {
    // Media metadata
    mimeType: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    durationMs: { type: Number, default: null },  // For audio/video
    width: { type: Number, default: null },       // For images/video
    height: { type: Number, default: null },
    thumbnailUrl: { type: String, default: null },
    
    // Emoji reactions: { "👍": ["userId1", "userId2"], "❤️": ["userId3"] }
    reactions: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // Mentions: ["userId1", "userId2"]
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' }],
    
    // Extra data
    caption: { type: String, default: null }
  },
  
  // Reply to another message
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomDirectMessage', default: null },
  replyToPreview: {
    content: { type: String, default: null },
    senderName: { type: String, default: null },
    messageType: { type: String, default: null }
  },
  
  // Idempotency key from client to prevent duplicates
  clientMessageId: { type: String, default: null, sparse: true },
  
  // Delivery status: sent, delivered, read
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  
  // Read receipts with timestamps
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
    readAt: { type: Date, default: Date.now }
  }],
  
  edited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false }
}, { timestamps: true, collection: 'ecom_direct_messages' });

// Indexes for performance
directMessageSchema.index({ workspaceId: 1, participants: 1, createdAt: -1 });
directMessageSchema.index({ senderId: 1, createdAt: -1 });
directMessageSchema.index({ workspaceId: 1, clientMessageId: 1 }, { unique: true, sparse: true });
directMessageSchema.index({ replyTo: 1 }, { sparse: true });

// Virtual for conversation key (stable ordering of participants)
directMessageSchema.virtual('conversationKey').get(function() {
  return this.participants.map(p => p.toString()).sort().join('_');
});

// Method to mark as read by a user
directMessageSchema.methods.markReadBy = function(userId) {
  const uid = userId.toString();
  if (!this.readBy.some(r => r.userId.toString() === uid)) {
    this.readBy.push({ userId, readAt: new Date() });
    // Update status to 'read' if all participants have read
    const allRead = this.participants.every(p => 
      p.toString() === this.senderId.toString() || 
      this.readBy.some(r => r.userId.toString() === p.toString())
    );
    if (allRead) this.status = 'read';
  }
  return this;
};

// Method to add reaction
directMessageSchema.methods.addReaction = function(userId, emoji) {
  if (!this.metadata.reactions) this.metadata.reactions = {};
  if (!this.metadata.reactions[emoji]) this.metadata.reactions[emoji] = [];
  const uid = userId.toString();
  if (!this.metadata.reactions[emoji].includes(uid)) {
    this.metadata.reactions[emoji].push(uid);
  }
  return this;
};

// Method to remove reaction
directMessageSchema.methods.removeReaction = function(userId, emoji) {
  if (this.metadata.reactions?.[emoji]) {
    const uid = userId.toString();
    this.metadata.reactions[emoji] = this.metadata.reactions[emoji].filter(id => id !== uid);
    if (this.metadata.reactions[emoji].length === 0) {
      delete this.metadata.reactions[emoji];
    }
  }
  return this;
};

export default mongoose.model('EcomDirectMessage', directMessageSchema);
