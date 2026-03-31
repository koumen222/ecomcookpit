import mongoose from 'mongoose';

/**
 * GenerationPayment — tracks MoneyFusion payment transactions for AI generation purchases.
 * A record is created when checkout is initiated; status is updated via webhook
 * or manual polling.
 */
const generationPaymentSchema = new mongoose.Schema({
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
  // Number of generations purchased (default 1)
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  // Price per generation (1500 FCFA)
  pricePerGeneration: {
    type: Number,
    default: 1500
  },
  // Total amount to pay
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
  // Date when generations were credited (set when status becomes 'paid')
  creditedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const GenerationPayment = mongoose.model('GenerationPayment', generationPaymentSchema);
export default GenerationPayment;
