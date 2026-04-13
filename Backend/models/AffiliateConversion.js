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

const AffiliateConversion = mongoose.model('AffiliateConversion', affiliateConversionSchema);
export default AffiliateConversion;
