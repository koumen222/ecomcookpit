import mongoose from 'mongoose';

/**
 * PlatformPaymentConfig — encaissement PLATEFORME (abonnements + crédits).
 * Document singleton, édité depuis le Super Admin.
 *
 * billingProvider :
 *  - 'moneyfusion' (défaut) — comportement historique
 *  - 'kpay'        — KPay devient le moyen de paiement principal :
 *                    /billing/checkout, /buy-generation, /buy-creative
 *                    passent par la gateway KPay avec les clés ci-dessous.
 */
const platformPaymentConfigSchema = new mongoose.Schema({
  singleton: {
    type: String,
    default: 'platform',
    unique: true,
    index: true
  },
  billingProvider: {
    type: String,
    enum: ['moneyfusion', 'kpay'],
    default: 'moneyfusion'
  },
  kpay: {
    apiKey: { type: String, default: '' },
    secretKey: { type: String, default: '' },
    webhookSecret: { type: String, default: '' }
  },
  // Indicatifs téléphoniques routés vers MoneyFusion MÊME quand KPay est actif
  // (pays non couverts par KPay). Ex : '228' (Togo). Comparés au numéro complet
  // du payeur (indicatif inclus).
  kpayFallbackPrefixes: {
    type: [String],
    default: ['228']
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  }
}, {
  collection: 'platform_payment_config',
  timestamps: true
});

platformPaymentConfigSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne({ singleton: 'platform' });
  if (!doc) {
    doc = await this.create({ singleton: 'platform' });
  }
  return doc;
};

export default mongoose.model('PlatformPaymentConfig', platformPaymentConfigSchema);
