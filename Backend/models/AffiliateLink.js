import mongoose from 'mongoose';

const affiliateLinkSchema = new mongoose.Schema({
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AffiliateUser',
    required: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  destinationUrl: {
    type: String,
    required: true,
    trim: true
  },
  linkType: {
    type: String,
    default: 'default',
    trim: true
  },
  commissionType: {
    type: String,
    enum: ['fixed', 'percentage', ''],
    default: ''
  },
  commissionValue: {
    type: Number,
    default: 0
  },
  clickCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'affiliate_links'
});

affiliateLinkSchema.index({ affiliateId: 1, createdAt: -1 });

const AffiliateLink = mongoose.model('AffiliateLink', affiliateLinkSchema);
export default AffiliateLink;
