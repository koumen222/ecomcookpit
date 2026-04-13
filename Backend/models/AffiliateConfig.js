import mongoose from 'mongoose';

const affiliateConfigSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'global',
    unique: true
  },
  baseCommissionType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  baseCommissionValue: {
    type: Number,
    default: 500
  },
  defaultLandingUrl: {
    type: String,
    default: 'https://scalor.net'
  },
  linkTypeRules: [{
    name: { type: String, required: true, trim: true },
    commissionType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    commissionValue: { type: Number, default: 500 },
    isActive: { type: Boolean, default: true }
  }]
}, {
  timestamps: true,
  collection: 'affiliate_config'
});

const AffiliateConfig = mongoose.model('AffiliateConfig', affiliateConfigSchema);
export default AffiliateConfig;
