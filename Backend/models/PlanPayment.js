import mongoose from 'mongoose';

/**
 * PlanPayment — tracks MoneyFusion payment transactions for plan upgrades.
 * A record is created when checkout is initiated; status is updated via webhook
 * or manual polling.
 */
const planPaymentSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['starter', 'pro', 'ultra'],
    required: true
  },
  durationMonths: {
    type: Number,
    enum: [1, 3, 6, 12],
    default: 1
  },
  amount: {
    type: Number,
    required: true
  },
  // MoneyFusion tokenPay — unique identifier returned at checkout
  mfToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Payment URL returned by MoneyFusion to redirect user
  paymentUrl: {
    type: String,
    default: ''
  },
  // MoneyFusion payment status: pending | paid | failure | no paid
  status: {
    type: String,
    enum: ['pending', 'paid', 'failure', 'no paid'],
    default: 'pending',
    index: true
  },
  // Phone number used for payment
  phone: {
    type: String,
    default: ''
  },
  // Client name used for payment
  clientName: {
    type: String,
    default: ''
  },
  // Payment method returned by MoneyFusion (orange, mtn, wave…)
  paymentMethod: {
    type: String,
    default: null
  },
  // MoneyFusion transaction number (numeroTransaction)
  transactionNumber: {
    type: String,
    default: null
  },
  // MoneyFusion fees
  fees: {
    type: Number,
    default: 0
  },
  // Date when plan was applied (set when status becomes 'paid')
  activatedAt: {
    type: Date,
    default: null
  },
  // Promo code applied (if any)
  promoCodeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PromoCode',
    default: null,
    index: true
  },
  promoCode: {
    type: String,
    default: null
  },
  originalAmount: {
    type: Number,
    default: null
  },
  discountAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const PlanPayment = mongoose.model('PlanPayment', planPaymentSchema);
export default PlanPayment;
