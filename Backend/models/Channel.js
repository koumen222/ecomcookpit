import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  emoji: { type: String, default: '💬' },
  description: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
  
  // Participants list for group access control
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: null },
    notificationsEnabled: { type: Boolean, default: true },
    isMuted: { type: Boolean, default: false }
  }],
  
  isActive: { type: Boolean, default: true }
}, { timestamps: true, collection: 'ecom_channels' });

channelSchema.index({ workspaceId: 1, slug: 1 }, { unique: true });
channelSchema.index({ 'participants.userId': 1 });

// Method to check if user is participant
channelSchema.methods.hasParticipant = function(userId) {
  return this.participants.some(p => p.userId.toString() === userId.toString());
};

// Method to add participant
channelSchema.methods.addParticipant = function(userId, role = 'member') {
  if (!this.hasParticipant(userId)) {
    this.participants.push({ userId, role, joinedAt: new Date() });
  }
  return this;
};

// Method to remove participant
channelSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.userId.toString() !== userId.toString());
  return this;
};

// Method to get participant IDs who have notifications enabled
channelSchema.methods.getNotifiableParticipants = function(excludeUserId = null) {
  return this.participants
    .filter(p => p.notificationsEnabled && !p.isMuted)
    .filter(p => !excludeUserId || p.userId.toString() !== excludeUserId.toString())
    .map(p => p.userId);
};

export default mongoose.model('EcomChannel', channelSchema);
