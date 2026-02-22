import mongoose from 'mongoose';

const analyticsSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null,
    index: true
  },
  startedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  endedAt: {
    type: Date,
    default: null
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
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

  // Session metrics
  pageViews: {
    type: Number,
    default: 0
  },
  pagesVisited: [{
    type: String
  }],
  entryPage: {
    type: String,
    default: null
  },
  exitPage: {
    type: String,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },

  // Duration (in seconds)
  duration: {
    type: Number,
    default: 0
  },

  // Bounce = single page view
  isBounce: {
    type: Boolean,
    default: true
  }
}, {
  collection: 'analytics_sessions',
  timestamps: false
});

analyticsSessionSchema.index({ startedAt: -1 });
analyticsSessionSchema.index({ country: 1, startedAt: -1 });
analyticsSessionSchema.index({ device: 1, startedAt: -1 });

// TTL - auto-delete sessions older than 365 days
analyticsSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model('AnalyticsSession', analyticsSessionSchema);
