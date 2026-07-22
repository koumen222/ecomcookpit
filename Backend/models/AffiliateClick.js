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
  // Identifiant unique du clic — propagé au frontend (?aff_click=...) puis
  // rattaché aux visites et conversions pour un funnel clic → paiement exact.
  clickId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  // Sub-ID libre fourni par l'affilié (/r/CODE?sub=tiktok_video1) pour
  // segmenter ses campagnes.
  subId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  utmSource: { type: String, default: '', trim: true },
  utmMedium: { type: String, default: '', trim: true },
  utmCampaign: { type: String, default: '', trim: true },
  // Renseigné a posteriori par le beacon de visite (premier visitorId vu)
  visitorId: {
    type: String,
    default: '',
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
affiliateClickSchema.index({ affiliateId: 1, subId: 1, createdAt: -1 });

const AffiliateClick = mongoose.model('AffiliateClick', affiliateClickSchema);
export default AffiliateClick;
