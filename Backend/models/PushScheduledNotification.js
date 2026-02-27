import mongoose from 'mongoose';

const pushScheduledNotificationSchema = new mongoose.Schema({
  scope: {
    type: String,
    enum: ['global', 'workspace'],
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 120
  },
  body: {
    type: String,
    required: true,
    maxlength: 500
  },
  url: {
    type: String,
    default: ''
  },
  tag: {
    type: String,
    default: 'super-admin'
  },
  icon: {
    type: String,
    default: '/icons/icon-192x192.png'
  },
  badge: {
    type: String,
    default: '/icons/icon-72x72.png'
  },
  sendAt: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'processing', 'sent', 'failed', 'canceled'],
    default: 'scheduled',
    index: true
  },
  stats: {
    total: { type: Number, default: 0 },
    successful: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  },
  error: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'push_scheduled_notifications'
});

pushScheduledNotificationSchema.index({ status: 1, sendAt: 1 });

const PushScheduledNotification = mongoose.model('PushScheduledNotification', pushScheduledNotificationSchema);

export default PushScheduledNotification;
