import mongoose from 'mongoose';

/**
 * VideoTranslationJob — suivi des traductions/doublages vidéo.
 *
 * Même logique que MontageJob : le rendu est long (extraction audio → Whisper
 * → traduction LLM → TTS par segment → resync ffmpeg), donc il tourne en tâche
 * de fond et le front poll ce document pour la progression. Le stocker en base
 * (et non dans une Map process) rend le statut visible sur toutes les instances
 * et survit à un redémarrage. TTL 2 h : nettoyage automatique par MongoDB.
 */
const videoTranslationJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  status: { type: String, enum: ['processing', 'done', 'error'], default: 'processing' },
  // Étape lisible pour l'UI ("Transcription…", "Traduction…", "Doublage…").
  stage: { type: String, default: 'Initialisation' },
  progress: { type: Number, default: 2 },

  sourceLang: { type: String, default: null },   // détectée par Whisper
  targetLang: { type: String, default: null },
  voice: { type: String, default: 'alloy' },

  // Résultats
  videoUrl: { type: String, default: null },      // MP4 doublé
  srtUrl: { type: String, default: null },        // sous-titres traduits (.srt)
  durationSec: { type: Number, default: 0 },
  segmentCount: { type: Number, default: 0 },

  error: { type: String, default: null },
  warning: { type: String, default: null },

  // Dernier signe de vie du worker : un job "processing" sans battement depuis
  // longtemps a été tué par un redémarrage → remonté comme erreur au poll.
  heartbeatAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 7200 },
}, { collection: 'video_translation_jobs' });

/** Upsert best-effort : le suivi en base ne doit JAMAIS faire échouer un rendu. */
videoTranslationJobSchema.statics.push = async function push(jobId, patch) {
  try {
    return await this.findOneAndUpdate(
      { jobId },
      { $set: { ...patch, heartbeatAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (err) {
    console.warn('[VideoTranslationJob] push failed:', err.message);
    return null;
  }
};

const VideoTranslationJob = mongoose.models.VideoTranslationJob
  || mongoose.model('VideoTranslationJob', videoTranslationJobSchema);
export default VideoTranslationJob;
