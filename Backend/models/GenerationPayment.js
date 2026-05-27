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
  // 'generation' (product page gen) | 'creative' (creative image credits)
  type: {
    type: String,
    enum: ['generation', 'creative'],
    default: 'generation',
    index: true
  },
  // Number of generations purchased (default 1)
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  // Effective price per generation credited for this payment
  pricePerGeneration: {
    type: Number,
    default: 1000
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
  },
  // ── Crédit effectivement appliqué au workspace (garde d'idempotence dédiée) ─
  // Ce flag est SÉPARÉ de `status` pour gérer le cas où :
  //   - status passe à 'paid' (1er update)
  //   - puis le $inc workspace.credits crash (network/restart)
  // Sans ce flag, le prochain appel voit status='paid' et skip → crédits perdus.
  // Maintenant : on incrémente UNIQUEMENT si creditApplied=false, et on set
  // creditApplied=true APRÈS l'$inc workspace réussi.
  creditApplied: {
    type: Boolean,
    default: false,
    index: true
  },
  // Nombre de tentatives de crédit (pour debug/alerting)
  creditAttempts: {
    type: Number,
    default: 0
  },
  // Dernière erreur lors de la tentative (pour diagnostic)
  lastCreditError: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index composé pour la recovery cron : "trouve tout ce qui est payé mais pas crédité"
generationPaymentSchema.index({ status: 1, creditApplied: 1, createdAt: -1 });

const GenerationPayment = mongoose.model('GenerationPayment', generationPaymentSchema);
export default GenerationPayment;
