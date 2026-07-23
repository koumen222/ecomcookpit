import mongoose from 'mongoose';

/**
 * AutoMontageJob — suivi des montages vidéo automatiques (outil « Montage Auto »).
 *
 * Même design que VideoTranslationJob : le pipeline est long (transcription →
 * analyse IA → b-rolls Grok Imagine → rendu ffmpeg multi-formats), donc il
 * tourne en tâche de fond et le front poll ce document. Stocké en base pour
 * survivre aux redémarrages et être visible sur toutes les instances.
 * TTL 2 h : nettoyage automatique par MongoDB.
 */
const autoMontageJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  status: { type: String, enum: ['processing', 'done', 'error'], default: 'processing' },
  // Étape lisible pour l'UI (« Transcription… », « Génération des b-rolls… »).
  stage: { type: String, default: 'Initialisation' },
  progress: { type: Number, default: 2 },

  // Options retenues
  formats: { type: [String], default: ['9:16'] },
  language: { type: String, default: null },      // détectée par Whisper

  // Résultats — une sortie par format demandé
  outputs: {
    type: [{
      format: String,           // '9:16' | '16:9'
      url: String,              // MP4 final sur R2
      durationSec: Number,
    }],
    default: [],
  },
  srtUrl: { type: String, default: null },        // sous-titres export (.srt)
  brollCount: { type: Number, default: 0 },
  cutsRemovedSec: { type: Number, default: 0 },   // secondes de silences retirées

  error: { type: String, default: null },
  warning: { type: String, default: null },
  // Rapport par étape (mots transcrits, cuts, sous-titres, musique, SFX…)
  report: { type: mongoose.Schema.Types.Mixed, default: null },

  // Dernier signe de vie du worker : un job « processing » sans battement
  // depuis longtemps a été tué par un redémarrage → remonté en erreur au poll.
  heartbeatAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 7200 },
}, { collection: 'auto_montage_jobs' });

/** Upsert best-effort : le suivi en base ne doit JAMAIS faire échouer un rendu. */
autoMontageJobSchema.statics.push = async function push(jobId, patch) {
  try {
    return await this.findOneAndUpdate(
      { jobId },
      { $set: { ...patch, heartbeatAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    console.warn('[AutoMontageJob] push failed:', err.message);
    return null;
  }
};

const AutoMontageJob = mongoose.models.AutoMontageJob
  || mongoose.model('AutoMontageJob', autoMontageJobSchema);
export default AutoMontageJob;
