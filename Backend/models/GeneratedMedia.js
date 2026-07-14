import mongoose from 'mongoose';

/**
 * GeneratedMedia — médiathèque des visuels générés par IA (images, GIF, vidéos).
 * Chaque génération réussie (builder, fiche produit, GIF de scène…) est
 * enregistrée ici, par workspace, pour être retrouvée et réutilisée.
 */
const generatedMediaSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  type: { type: String, enum: ['image', 'gif', 'video'], required: true, index: true },
  url: { type: String, required: true },
  // Génération : prompt saisi/produit, scénario, source éventuelle
  prompt: { type: String, default: '' },
  kind: { type: String, default: '' }, // 'builder-image' | 'scene-gif' | 'steps-gif' | 'scene-video' …
  sourceUrl: { type: String, default: '' },
  meta: { type: Object, default: {} },
}, { timestamps: true, collection: 'generated_media' });

generatedMediaSchema.index({ workspaceId: 1, createdAt: -1 });
generatedMediaSchema.index({ workspaceId: 1, type: 1, createdAt: -1 });

/** Insertion best-effort : ne doit JAMAIS faire échouer une génération. */
generatedMediaSchema.statics.record = async function record(entry) {
  try {
    if (!entry?.workspaceId || !entry?.url || !entry?.type) return null;
    return await this.create({
      workspaceId: entry.workspaceId,
      storeId: entry.storeId || null,
      userId: entry.userId || null,
      type: entry.type,
      url: String(entry.url),
      prompt: String(entry.prompt || '').slice(0, 2000),
      kind: String(entry.kind || ''),
      sourceUrl: String(entry.sourceUrl || ''),
      meta: entry.meta || {},
    });
  } catch (err) {
    console.warn('[GeneratedMedia] record failed:', err.message);
    return null;
  }
};

export default mongoose.model('GeneratedMedia', generatedMediaSchema);
