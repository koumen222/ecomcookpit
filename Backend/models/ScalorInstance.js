import mongoose from 'mongoose';

const scalorInstanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScalorUser',
    required: true,
    index: true
  },
  // Instance name on Evolution API (prefixed with userId for isolation)
  instanceName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // User-facing display name
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  // Token returned by Evolution API for this instance
  instanceToken: {
    type: String
  },
  // Connection status
  status: {
    type: String,
    enum: ['creating', 'awaiting_qr', 'connected', 'disconnected', 'deleted'],
    default: 'creating'
  },
  // Phone number connected (once paired)
  phoneNumber: {
    type: String
  },
  // Webhook URL configured by the user
  webhookUrl: {
    type: String,
    trim: true
  },
  webhookEvents: {
    type: [String],
    default: ['messages.upsert', 'connection.update']
  },
  // Usage counters (per-instance)
  messagesSentToday: {
    type: Number,
    default: 0
  },
  messagesSentThisMonth: {
    type: Number,
    default: 0
  },
  lastDailyReset: {
    type: Date,
    default: Date.now
  },
  lastMonthlyReset: {
    type: Date,
    default: Date.now
  },
  lastConnectedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  collection: 'scalor_instances',
  timestamps: true
});

scalorInstanceSchema.index({ userId: 1, isActive: 1 });
scalorInstanceSchema.index({ instanceName: 1 });

// Reset daily/monthly counters if needed (mirrors ScalorUser logic)
scalorInstanceSchema.methods.checkAndResetCounters = function () {
  const now = new Date();
  const lastDaily = new Date(this.lastDailyReset);
  const lastMonthly = new Date(this.lastMonthlyReset);

  if (now.toDateString() !== lastDaily.toDateString()) {
    this.messagesSentToday = 0;
    this.lastDailyReset = now;
  }
  if (now.getMonth() !== lastMonthly.getMonth() || now.getFullYear() !== lastMonthly.getFullYear()) {
    this.messagesSentThisMonth = 0;
    this.lastMonthlyReset = now;
  }
};

export default mongoose.model('ScalorInstance', scalorInstanceSchema);
