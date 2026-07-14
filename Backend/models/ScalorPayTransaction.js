import mongoose from 'mongoose';

/**
 * ScalorPayTransaction — ledger for the managed Scalor Pay method.
 *
 * Two kinds of movements (`type`):
 *   - 'sale'   : a customer paid an order via Scalor Pay. Collected on the
 *                platform MoneyFusion account; `netAmount` credits the wallet
 *                once MoneyFusion confirms (webhook / poll).
 *   - 'payout' : the merchant requested a withdrawal of their solde. Debits the
 *                wallet immediately (status 'requested'), settled off-platform.
 *
 * A 'sale' row is created at checkout (status 'pending') carrying the MoneyFusion
 * `mfToken`, so the shared webhook can find it and credit the right wallet
 * exactly once (`creditApplied` guard).
 */
const scalorPayTransactionSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomWorkspace',
    required: true,
    index: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
    index: true
  },
  type: {
    type: String,
    enum: ['sale', 'payout'],
    default: 'sale',
    index: true
  },

  // ── Sale linkage ──
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreOrder',
    default: null,
    index: true
  },
  orderNumber: { type: String, default: '' },

  // ── Amounts (in `currency`) ──
  currency: { type: String, default: 'XAF' },
  grossAmount: { type: Number, required: true }, // ce que le client paie (sale) / montant demandé (payout)
  commissionRate: { type: Number, default: 0 },  // ex: 0.02
  commissionAmount: { type: Number, default: 0 },
  netAmount: { type: Number, required: true },    // crédité au marchand (sale) / débité (payout)

  // ── MoneyFusion (sale) ──
  mfToken: {
    type: String,
    default: null,
    index: true,
    sparse: true
  },
  paymentUrl: { type: String, default: '' },
  paymentMethod: { type: String, default: null }, // orange, mtn, wave…
  transactionNumber: { type: String, default: null },

  // ── Status ──
  // sale:   pending | paid | failure | no paid
  // payout: requested | paid | rejected
  status: {
    type: String,
    default: 'pending',
    index: true
  },
  // Idempotency guard — set true once the wallet has been credited/debited.
  creditApplied: { type: Boolean, default: false },
  creditedAt: { type: Date, default: null },
  lastCreditError: { type: String, default: '' },

  // ── Customer / payout snapshot ──
  customerName: { type: String, default: '' },
  phone: { type: String, default: '' },
}, {
  timestamps: true
});

scalorPayTransactionSchema.index({ workspaceId: 1, type: 1, createdAt: -1 });
scalorPayTransactionSchema.index({ workspaceId: 1, storeId: 1, createdAt: -1 });

const ScalorPayTransaction = mongoose.model('ScalorPayTransaction', scalorPayTransactionSchema);
export default ScalorPayTransaction;
