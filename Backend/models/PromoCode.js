import mongoose from 'mongoose';

/**
 * PromoCode — code promo créé par le super admin pour réduire le prix
 * d'un plan/abonnement à l'achat.
 *
 * Types de réduction :
 *   - 'percentage' : % de réduction (1–100)
 *   - 'fixed'      : montant fixe en FCFA
 *
 * Restrictions :
 *   - applicablePlans       : plans concernés ('starter','pro','ultra' ; vide = tous)
 *   - applicableDurations   : durées concernées (1, 3, 6, 12 ; vide = toutes)
 *   - maxUses               : nb total d'utilisations autorisées (null = illimité)
 *   - maxUsesPerWorkspace   : nb d'utilisations par workspace (null = illimité)
 *   - validFrom / validUntil: fenêtre de validité (null = pas de borne)
 *   - minAmount             : montant minimum d'achat (FCFA) pour activer le code
 */
const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  applicablePlans: {
    type: [String],
    enum: ['starter', 'pro', 'ultra'],
    default: []
  },
  applicableDurations: {
    type: [Number],
    enum: [1, 3, 6, 12],
    default: []
  },
  maxUses: {
    type: Number,
    default: null,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxUsesPerWorkspace: {
    type: Number,
    default: null,
    min: 1
  },
  minAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  validFrom: {
    type: Date,
    default: null
  },
  validUntil: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser',
    default: null
  }
}, {
  timestamps: true
});

// Compute current state without mutating the doc
promoCodeSchema.methods.isCurrentlyValid = function (now = new Date()) {
  if (!this.isActive) return { ok: false, reason: 'Code désactivé' };
  if (this.validFrom && this.validFrom > now) {
    return { ok: false, reason: 'Code pas encore actif' };
  }
  if (this.validUntil && this.validUntil < now) {
    return { ok: false, reason: 'Code expiré' };
  }
  if (this.maxUses != null && this.usedCount >= this.maxUses) {
    return { ok: false, reason: 'Limite d\'utilisations atteinte' };
  }
  return { ok: true };
};

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
export default PromoCode;
