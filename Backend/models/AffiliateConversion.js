import mongoose from 'mongoose';

const affiliateConversionSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateUser',
    required: true,
    index: true
  },
  affiliateCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  affiliateLinkCode: {
    type: String,
    default: '',
    uppercase: true,
    trim: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true
  },
  storeOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreOrder',
    default: null,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true
  },
  orderNumber: {
    type: String,
    default: '',
    trim: true
  },
  orderAmount: {
    type: Number,
    default: 0
  },
  orderCurrency: {
    type: String,
    default: 'XAF'
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
  commissionAmount: {
    type: Number,
    default: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending',
    index: true
  },
  conversionType: {
    type: String,
    enum: ['signup', 'payment', 'order'],
    default: 'order'
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null,
    index: true
  },
  // Idempotence paiement : une seule conversion par PlanPayment (webhook rejoué)
  planPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PlanPayment',
    default: null
  },
  // Attribution fine : clic /r/ d'origine (AffiliateClick.clickId)
  clickId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  visitorId: {
    type: String,
    default: '',
    trim: true
  },
  // Retrait auquel cette commission est rattachée (AffiliatePayout)
  payoutId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliatePayout',
    default: null,
    index: true
  },
  statusNote: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'affiliate_conversions'
});

affiliateConversionSchema.index({ affiliateId: 1, createdAt: -1 });
affiliateConversionSchema.index({ status: 1, createdAt: -1 });
// Anti-doublon : un seul bonus d'inscription par filleul
affiliateConversionSchema.index(
  { conversionType: 1, referredUserId: 1 },
  { unique: true, partialFilterExpression: { conversionType: 'signup', referredUserId: { $type: 'objectId' } } }
);
// Idempotence : une seule commission par paiement de plan
affiliateConversionSchema.index(
  { planPaymentId: 1 },
  { unique: true, partialFilterExpression: { planPaymentId: { $type: 'objectId' } } }
);

const AffiliateConversion = mongoose.model('AffiliateConversion', affiliateConversionSchema);
export default AffiliateConversion;
