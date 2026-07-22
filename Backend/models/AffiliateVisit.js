import mongoose from 'mongoose';

// ─── Visites référées (pageviews) ────────────────────────────────────────────
// Alimenté par le beacon public POST /api/affiliate/track/visit envoyé par le
// frontend quand une attribution affiliée est active (?aff=... ou stockage 60j).
// Funnel complet : clic (/r/:code) → visites → inscription → paiements.
const affiliateVisitSchema = new mongoose.Schema({
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
  // Identifiant du clic /r/ d'origine (croise avec AffiliateClick.clickId)
  clickId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  // Identifiant visiteur persistant (localStorage, uuid généré côté client)
  visitorId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  // Identifiant de session (sessionStorage — nouvelle session par onglet/visite)
  sessionId: {
    type: String,
    default: '',
    trim: true
  },
  url: {
    type: String,
    default: '',
    trim: true
  },
  path: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  referrer: {
    type: String,
    default: '',
    trim: true
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
  collection: 'affiliate_visits'
});

affiliateVisitSchema.index({ affiliateId: 1, createdAt: -1 });
affiliateVisitSchema.index({ affiliateId: 1, visitorId: 1 });
// Dédoublonnage applicatif : même visiteur + même page dans une fenêtre courte
affiliateVisitSchema.index({ visitorId: 1, path: 1, createdAt: -1 });

const AffiliateVisit = mongoose.model('AffiliateVisit', affiliateVisitSchema);
export default AffiliateVisit;
