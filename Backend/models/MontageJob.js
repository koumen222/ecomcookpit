import mongoose from 'mongoose';

/**
 * MontageJob — suivi des rendus de montage vidéo (Creative Center).
 *
 * Pourquoi en base : les jobs vivaient dans une Map en mémoire du process ;
 * en cluster/multi-instances (ou après un redémarrage), le poll GET tombait
 * sur une instance qui ne connaissait pas le job → « Job de montage
 * introuvable » en boucle. La base rend le statut visible partout.
 * TTL 1 h : nettoyage automatique par MongoDB.
 */
const montageJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  status: { type: String, enum: ['processing', 'done', 'error'], default: 'processing' },
  progress: { type: Number, default: 3 },
  url: { type: String, default: null },
  durationSec: { type: Number, default: 0 },
  format: { type: String, default: '9:16' },
  error: { type: String, default: null },
  warning: { type: String, default: null },
  musicApplied: { type: Boolean, default: false },
  // Dernier signe de vie du worker : un job "processing" sans battement depuis
  // longtemps a été tué par un redémarrage → remonté comme erreur au poll.
  heartbeatAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
}, { collection: 'montage_jobs' });

/** Upsert best-effort : le suivi en base ne doit JAMAIS faire échouer un rendu. */
montageJobSchema.statics.push = async function push(jobId, patch) {
  try {
    return await this.findOneAndUpdate(
      { jobId },
      { $set: { ...patch, heartbeatAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    console.warn('[MontageJob] push failed:', err.message);
    return null;
  }
};

const MontageJob = mongoose.models.MontageJob || mongoose.model('MontageJob', montageJobSchema);
export default MontageJob;
