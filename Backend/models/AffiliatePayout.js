import mongoose from 'mongoose';

// ─── Retraits de commissions ─────────────────────────────────────────────────
// Cycle : l'affilié demande un retrait de son solde (conversions "approved"
// non rattachées à un retrait) → pending. L'admin le marque paid (les
// conversions passent à "paid") ou rejected (les conversions retournent au
// solde). Montant = somme exacte des conversions rattachées.
const PAYOUT_METHODS = ['mtn_momo', 'orange_money', 'bank', 'other'];

const affiliatePayoutSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateUser',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'XAF'
  },
  method: {
    type: String,
    enum: PAYOUT_METHODS,
    required: true
  },
  phoneNumber: {
    type: String,
    default: '',
    trim: true
  },
  accountName: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'rejected'],
    default: 'pending',
    index: true
  },
  // Conversions verrouillées par ce retrait (AffiliateConversion.payoutId)
  conversionCount: {
    type: Number,
    default: 0
  },
  adminNote: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  },
  // Référence de la transaction Mobile Money / virement saisie par l'admin
  paymentReference: {
    type: String,
    default: '',
    trim: true
  }
}, {
  timestamps: true,
  collection: 'affiliate_payouts'
});

affiliatePayoutSchema.index({ affiliateId: 1, createdAt: -1 });
affiliatePayoutSchema.index({ status: 1, createdAt: -1 });

export { PAYOUT_METHODS };
const AffiliatePayout = mongoose.model('AffiliatePayout', affiliatePayoutSchema);
export default AffiliatePayout;
