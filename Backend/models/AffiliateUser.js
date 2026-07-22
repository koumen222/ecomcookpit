import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const affiliateUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  commissionType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  commissionValue: {
    type: Number,
    default: 500
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  },
  scalorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null,
    index: true,
    sparse: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  // ── Coordonnées de retrait (mémorisées à la 1re demande) ──────────────────
  payoutMethod: {
    type: String,
    enum: ['mtn_momo', 'orange_money', 'bank', 'other', ''],
    default: ''
  },
  payoutPhone: {
    type: String,
    default: '',
    trim: true
  },
  payoutAccountName: {
    type: String,
    default: '',
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  }
}, {
  timestamps: true,
  collection: 'affiliate_users'
});

affiliateUserSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  return next();
});

affiliateUserSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const AffiliateUser = mongoose.model('AffiliateUser', affiliateUserSchema);
export default AffiliateUser;
