import mongoose from 'mongoose';

/**
 * Liste de suppression — barrière DURE avant tout envoi marketing.
 *
 * Une désinscription, un rebond permanent ou une plainte pour spam doivent
 * survivre à la campagne qui les a provoqués : réémettre vers une adresse qui
 * a déjà cliqué « ceci est un spam » est le moyen le plus direct de faire
 * classer tout le domaine. C'est pourquoi la liste est globale et non
 * rattachée à une campagne.
 *
 * `hard` distingue ce qui est définitif (plainte, rebond permanent,
 * désinscription) de ce qui est temporaire (rebond doux répété) : seul le
 * définitif bloque pour toujours.
 */
const emailSuppressionSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  reason: {
    type: String,
    enum: ['unsubscribe', 'complaint', 'hard_bounce', 'soft_bounce', 'manual', 'invalid'],
    required: true,
    index: true,
  },
  hard: { type: Boolean, default: true, index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCampaign', default: null },
  detail: { type: String, default: '' },
  softBounceCount: { type: Number, default: 0 },
}, { timestamps: true, collection: 'email_suppressions' });

/** Filtre une liste d'adresses : renvoie celles qui restent envoyables. */
emailSuppressionSchema.statics.filterSendable = async function filterSendable(emails = []) {
  const list = [...new Set((emails || []).map((e) => String(e || '').toLowerCase().trim()).filter(Boolean))];
  if (!list.length) return { sendable: [], suppressed: new Set() };
  const blocked = await this.find({ email: { $in: list }, hard: true }).select('email').lean();
  const suppressed = new Set(blocked.map((b) => b.email));
  return { sendable: list.filter((e) => !suppressed.has(e)), suppressed };
};

export default mongoose.model('EmailSuppression', emailSuppressionSchema);
