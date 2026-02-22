import mongoose from 'mongoose';

const analyticsEventSchema = new mongoose.Schema({
  // Identifiers
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // Event info
  eventType: {
    type: String,
    required: true,
    enum: [
      'page_view',
      'signup_started',
      'signup_completed',
      'email_verified',
      'login',
      'login_failed',
      'logout',
      'workspace_created',
      'workspace_joined',
      'order_created',
      'order_updated',
      'delivery_completed',
      'transaction_created',
      'invite_generated',
      'invite_accepted',
      'product_created',
      'report_viewed',
      'settings_changed',
      'password_reset',
      'custom'
    ],
    index: true
  },

  // Page tracking
  page: {
    type: String,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },

  // Context
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    default: null,
    index: true
  },
  userRole: {
    type: String,
    default: null
  },

  // Geo & device
  country: {
    type: String,
    default: null,
    index: true
  },
  city: {
    type: String,
    default: null
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  browser: {
    type: String,
    default: null
  },
  os: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },

  // Extra metadata
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  collection: 'analytics_events',
  timestamps: false
});

// Compound indexes for common queries
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ country: 1, createdAt: -1 });
analyticsEventSchema.index({ page: 1, createdAt: -1 });
analyticsEventSchema.index({ sessionId: 1, createdAt: 1 });
analyticsEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 });

// TTL index - auto-delete events older than 365 days
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model('AnalyticsEvent', analyticsEventSchema);
