// ─────────────────────────────────────────────────────────────────────────────
//  Tarifs Creative Center éditables depuis le super admin (singleton).
//  Seuls les COÛTS EN CRÉDITS par fonctionnalité et le PRIX DU CRÉDIT (FCFA)
//  sont stockés ici ; libellés et unités restent dans config/creativePricing.js
//  (défauts). getSnapshot() = défauts statiques + overrides base.
//  Pattern identique à GenerationPricingConfig.
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import { CREATIVE_PRICING, PRICE_PER_CREDIT_FCFA } from '../config/creativePricing.js';

const creativePricingConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  pricePerCreditFcfa: { type: Number, default: PRICE_PER_CREDIT_FCFA, min: 1 },
  // Map clé fonctionnalité → coût en crédits (0 = gratuit). Les clés absentes
  // retombent sur le défaut de config/creativePricing.js.
  featureCredits: { type: Map, of: Number, default: {} },
}, {
  timestamps: true,
  collection: 'ecom_creative_pricing_configs',
});

creativePricingConfigSchema.methods.getSnapshot = function getSnapshot() {
  const features = {};
  for (const [k, def] of Object.entries(CREATIVE_PRICING)) {
    const override = this.featureCredits?.get?.(k);
    features[k] = { ...def, credits: Number.isFinite(override) ? override : def.credits };
  }
  return {
    pricePerCreditFcfa: Number.isFinite(this.pricePerCreditFcfa) ? this.pricePerCreditFcfa : PRICE_PER_CREDIT_FCFA,
    features,
  };
};

creativePricingConfigSchema.statics.getSingleton = async function getSingleton() {
  let config = await this.findOne({ key: 'default' });
  if (!config) config = await this.create({ key: 'default' });
  return config;
};

export default mongoose.model('CreativePricingConfig', creativePricingConfigSchema);
