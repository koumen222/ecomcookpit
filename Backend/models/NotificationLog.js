import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null
  },
  eventType: {
    type: String,
    required: true,
    index: true
  },
  channel: {
    type: String,
    enum: ['EMAIL', 'PUSH', 'SLACK', 'SMS'],
    default: 'EMAIL'
  },
  status: {
    type: String,
    enum: ['SENT', 'FAILED', 'SKIPPED', 'THROTTLED'],
    default: 'SENT',
    index: true
  },
  recipient: {
    type: String,
    default: ''
  },
  subject: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  collection: 'ecom_notification_logs',
  timestamps: true
});

notificationLogSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
notificationLogSchema.index({ createdAt: -1 });

export default mongoose.model('NotificationLog', notificationLogSchema);
