import mongoose from 'mongoose';

/**
 * FeatureFeedback — Avis utilisateur recueilli juste après l'utilisation
 * d'une fonctionnalité de génération (page produit, créas, vidéo, image…).
 *
 * Alimenté par le petit modal de feedback côté frontend
 * (src/ecom/components/FeatureFeedbackModal.jsx) via POST /api/ecom/feedback.
 * Consulté par le super admin sur /ecom/super-admin/feedbacks.
 */

export const FEEDBACK_FEATURES = [
  'product_page_generator',   // Générateur de page produit (IA)
  'creative_generator',        // Générateur de créas publicitaires (images)
  'creative_text',             // Génération de texte IA
  'builder_ai_image',          // Image générée (builder / pages produits)
  'creative_video',            // Scène vidéo IA (Creative Center)
  'creative_voice',            // Voix off générée
  'creative_montage',          // Montage vidéo (Montage Auto / Creative Center)
  'creative_lipsync',          // Avatar parlant (lip sync)
  'creative_translation',      // Traduction / doublage vidéo
  'creative_clone',            // Clone de page produit
  'assistant_chat',            // Assistant IA
  'other',                     // Fallback / élément générique
];

const featureFeedbackSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomWorkspace', index: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser', required: true, index: true },

  feature: {
    type: String,
    required: true,
    index: true,
    enum: FEEDBACK_FEATURES,
  },

  // Note d'expérience : 1 (très mauvaise) → 5 (excellente)
  rating: { type: Number, required: true, min: 1, max: 5 },

  // Commentaire libre (optionnel)
  comment: { type: String, trim: true, maxlength: 2000, default: '' },

  // Page frontend d'où vient le feedback (ex: /ecom/creatives)
  page: { type: String, trim: true, maxlength: 300 },

  // Contexte libre transmis par le frontend (template utilisé, nb d'images…)
  meta: { type: mongoose.Schema.Types.Mixed },

  // Triage côté super admin
  status: { type: String, enum: ['new', 'seen', 'resolved'], default: 'new', index: true },
}, {
  timestamps: true,
  collection: 'feature_feedbacks',
});

featureFeedbackSchema.index({ feature: 1, createdAt: -1 });
featureFeedbackSchema.index({ rating: 1, createdAt: -1 });
featureFeedbackSchema.index({ createdAt: -1 });

export default mongoose.model('FeatureFeedback', featureFeedbackSchema);
