// ─────────────────────────────────────────────────────────────────────────────
//  Routes de traduction / doublage vidéo.
//    POST /api/ecom/video-translation/translate  → upload MP4 + lance un job async
//    GET  /api/ecom/video-translation/:jobId      → poll de progression/résultat
//    GET  /api/ecom/video-translation/meta/options → langues & voix disponibles
//
//  Le rendu est long → on répond immédiatement un jobId et on traite en tâche de
//  fond ; le front poll le statut (même pattern que le montage vidéo).
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import VideoTranslationJob from '../models/VideoTranslationJob.js';
import { translateVideo } from '../services/videoTranslationService.js';

const router = express.Router();

// Vidéo → disque temporaire (pas la mémoire) : un MP4 peut être lourd.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `vtrans-upload-${crypto.randomUUID()}.mp4`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 Mo
  fileFilter: (req, file, cb) => {
    if (/^video\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Fichier vidéo requis (mp4, mov, webm…).'));
  },
});

// Langues cibles proposées à l'UI (Whisper transcrit ~100 langues en source).
const TARGET_LANGUAGES = [
  { code: 'en', name: 'Anglais' }, { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Espagnol' }, { code: 'pt', name: 'Portugais' },
  { code: 'ar', name: 'Arabe' }, { code: 'de', name: 'Allemand' },
  { code: 'it', name: 'Italien' }, { code: 'nl', name: 'Néerlandais' },
  { code: 'ru', name: 'Russe' }, { code: 'zh', name: 'Chinois' },
  { code: 'ja', name: 'Japonais' }, { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turc' }, { code: 'sw', name: 'Swahili' },
];
const VOICES = [
  { id: 'alloy', label: 'Alloy (neutre)' }, { id: 'nova', label: 'Nova (féminine)' },
  { id: 'shimmer', label: 'Shimmer (féminine douce)' }, { id: 'onyx', label: 'Onyx (masculine grave)' },
  { id: 'echo', label: 'Echo (masculine)' }, { id: 'fable', label: 'Fable (chaleureuse)' },
  { id: 'coral', label: 'Coral (expressive)' }, { id: 'sage', label: 'Sage (posée)' },
];

router.get('/meta/options', requireEcomAuth, (req, res) => {
  res.json({ success: true, languages: TARGET_LANGUAGES, voices: VOICES });
});

// ─── Lancer une traduction ───────────────────────────────────────────────────
router.post('/translate', requireEcomAuth, upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier vidéo reçu.' });

  const jobId = crypto.randomUUID();
  const videoPath = req.file.path;
  const { targetLang = 'en', voice = 'alloy' } = req.body || {};
  // Cases HTML → chaînes 'true'/'false' ; on normalise.
  const keepOriginalAudio = String(req.body?.keepOriginalAudio ?? 'true') !== 'false';
  const burnSubtitles = String(req.body?.burnSubtitles ?? 'false') === 'true';

  await VideoTranslationJob.push(jobId, {
    workspaceId: req.workspaceId || null,
    status: 'processing', stage: 'En file', progress: 2,
    targetLang: String(targetLang).toLowerCase(), voice: String(voice),
  });

  // Réponse immédiate ; le traitement continue en tâche de fond.
  res.status(202).json({ success: true, jobId });

  // ── Worker asynchrone ──
  (async () => {
    try {
      const result = await translateVideo(
        videoPath,
        { targetLang, voice, keepOriginalAudio, burnSubtitles },
        (progress, stage) => { VideoTranslationJob.push(jobId, { progress, stage }); },
      );
      await VideoTranslationJob.push(jobId, {
        status: 'done', progress: 100, stage: 'Terminé',
        videoUrl: result.videoUrl, srtUrl: result.srtUrl,
        sourceLang: result.sourceLang, targetLang: result.targetLang,
        segmentCount: result.segmentCount, durationSec: result.durationSec,
      });
    } catch (err) {
      console.error('[VideoTranslation] job failed:', err.message);
      await VideoTranslationJob.push(jobId, {
        status: 'error', stage: 'Erreur', error: err.message?.slice(0, 400) || 'Échec de la traduction.',
      });
    } finally {
      await fs.rm(videoPath, { force: true }).catch(() => {});
    }
  })();
});

// ─── Poll d'un job ───────────────────────────────────────────────────────────
router.get('/:jobId', requireEcomAuth, async (req, res) => {
  try {
    const job = await VideoTranslationJob.findOne({ jobId: req.params.jobId }).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job introuvable ou expiré.' });

    // Cloisonnement workspace : on ne révèle pas les jobs d'un autre workspace.
    if (job.workspaceId && req.workspaceId && String(job.workspaceId) !== String(req.workspaceId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    // Worker mort (redémarrage) : processing sans battement depuis > 5 min → erreur.
    if (job.status === 'processing' && job.heartbeatAt
        && (Date.now() - new Date(job.heartbeatAt).getTime()) > 5 * 60 * 1000) {
      return res.json({ success: true, job: { ...job, status: 'error', error: 'Traitement interrompu (worker arrêté).' } });
    }

    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
