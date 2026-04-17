import mongoose from 'mongoose';

const generationPricingConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'default' },
  currency: { type: String, default: 'FCFA', trim: true },
  unitPriceRegular: { type: Number, default: 1000, min: 0 },
  unitPricePromo: { type: Number, default: null, min: 0 },
  packPriceRegular: { type: Number, default: 2500, min: 0 },
  packPricePromo: { type: Number, default: null, min: 0 },
  promoActive: { type: Boolean, default: false },
  promoExpiresAt: { type: Date, default: null },
  packQuantity: { type: Number, default: 3, min: 2, max: 3 },
}, {
  timestamps: true,
  collection: 'ecom_generation_pricing_configs',
});

generationPricingConfigSchema.methods.isPromoEnabled = function isPromoEnabled() {
  if (!this.promoActive) return false;
  if (this.promoExpiresAt && this.promoExpiresAt.getTime() < Date.now()) return false;
  return true;
};

generationPricingConfigSchema.methods.getSnapshot = function getSnapshot() {
  const promoEnabled = this.isPromoEnabled();
  const unit = promoEnabled && this.unitPricePromo != null ? this.unitPricePromo : this.unitPriceRegular;
  const pack3 = promoEnabled && this.packPricePromo != null ? this.packPricePromo : this.packPriceRegular;

  return {
    currency: this.currency || 'FCFA',
    unit,
    unitRegular: this.unitPriceRegular,
    unitPromo: this.unitPricePromo,
    pack3,
    pack3Regular: this.packPriceRegular,
    pack3Promo: this.packPricePromo,
    packQuantity: this.packQuantity || 3,
    promoActive: promoEnabled,
    promoExpiresAt: this.promoExpiresAt || null,
  };
};

generationPricingConfigSchema.statics.getSingleton = async function getSingleton() {
  let config = await this.findOne({ key: 'default' });
  if (!config) {
    config = await this.create({ key: 'default' });
  }
  return config;
};

export default mongoose.model('GenerationPricingConfig', generationPricingConfigSchema);