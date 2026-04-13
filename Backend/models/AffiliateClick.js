import mongoose from 'mongoose';

const affiliateClickSchema = new mongoose.Schema({
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
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  destinationUrl: {
    type: String,
    default: ''
  },
  sourceUrl: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  userAgent: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'affiliate_clicks'
});

affiliateClickSchema.index({ affiliateId: 1, createdAt: -1 });

const AffiliateClick = mongoose.model('AffiliateClick', affiliateClickSchema);
export default AffiliateClick;
