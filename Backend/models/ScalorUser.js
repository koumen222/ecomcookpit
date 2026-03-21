import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const scalorUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  // Plan & billing
  plan: {
    type: String,
    enum: ['starter', 'pro', 'business', 'enterprise'],
    default: 'starter'
  },
  planExpiresAt: {
    type: Date
  },
  // Limits based on plan
  maxInstances: {
    type: Number,
    default: 1  // starter = 1
  },
  dailyMessageLimit: {
    type: Number,
    default: 500  // starter = 500/day
  },
  monthlyMessageLimit: {
    type: Number,
    default: 10000  // starter = 10k/month
  },
  // Usage counters
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
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  collection: 'scalor_users',
  timestamps: true
});

// Hash password before saving
scalorUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
scalorUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Reset daily counters if needed
scalorUserSchema.methods.checkAndResetCounters = function () {
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

scalorUserSchema.index({ email: 1 });
scalorUserSchema.index({ plan: 1 });

export default mongoose.model('ScalorUser', scalorUserSchema);
