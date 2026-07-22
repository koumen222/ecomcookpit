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
  // ── Programme Scalor (SaaS) ────────────────────────────────────────────────
  // Bonus fixe crédité à l'inscription d'un filleul (FCFA)
  signupBonusAmount: {
    type: Number,
    default: 500
  },
  // % de commission sur chaque paiement d'abonnement du filleul (à vie)
  paymentCommissionPercent: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  // Fenêtre d'attribution last-click (jours) — cookie + localStorage
  attributionWindowDays: {
    type: Number,
    default: 60,
    min: 1
  },
  // Seuil minimum pour demander un retrait (FCFA)
  minPayoutAmount: {
    type: Number,
    default: 5000,
    min: 0
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
