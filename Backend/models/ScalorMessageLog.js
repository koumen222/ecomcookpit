import mongoose from 'mongoose';

const scalorMessageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScalorUser',
    required: true,
    index: true
  },
  instanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScalorInstance',
    index: true
  },
  instanceName: {
    type: String,
    required: true
  },
  // Recipient
  phoneNumber: {
    type: String,
    required: true
  },
  // Message content
  messageType: {
    type: String,
    enum: ['text', 'media', 'audio', 'video', 'document', 'template'],
    default: 'text'
  },
  // Truncated for storage (first 200 chars)
  contentPreview: {
    type: String,
    maxlength: 200
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  // WhatsApp message ID (from Evolution API response)
  whatsappMessageId: {
    type: String
  },
  // Error info
  errorMessage: {
    type: String
  },
  // API key used
  apiKeyPrefix: {
    type: String
  },
  // Request metadata
  requestIp: {
    type: String
  },
  sentAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'scalor_message_logs',
  timestamps: true
});

scalorMessageLogSchema.index({ userId: 1, sentAt: -1 });
scalorMessageLogSchema.index({ instanceName: 1, sentAt: -1 });
scalorMessageLogSchema.index({ status: 1 });
// TTL: auto-delete logs after 90 days
scalorMessageLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

export default mongoose.model('ScalorMessageLog', scalorMessageLogSchema);
