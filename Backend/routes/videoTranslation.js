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
import { recordFinalCreativeVideo } from '../services/creativeFinalVideoService.js';

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
  const owner = {
    workspaceId: req.workspaceId || null,
    userId: req.ecomUser?._id || null,
  };
  const { targetLang = 'en', voice = 'alloy' } = req.body || {};
  // Cases HTML → chaînes 'true'/'false' ; on normalise.
  const keepOriginalAudio = String(req.body?.keepOriginalAudio ?? 'true') !== 'false';
  const burnSubtitles = String(req.body?.burnSubtitles ?? 'false') === 'true';

  // Débit Creative Center : 1 vidéo doublée = featureCost('translation') crédits.
  // Réservé avant le lancement du job, remboursé si la traduction échoue.
  const { reserveFeatureCredits, sendInsufficientCredits } = await import('../services/creativeCredits.js');
  const transResv = await reserveFeatureCredits(req.workspaceId, 'translation');
  if (!transResv.ok) {
    await fs.rm(videoPath, { force: true }).catch(() => {});
    return sendInsufficientCredits(res, 'translation', transResv);
  }

  (await import('../models/FeatureUsageLog.js')).default
    .track(req, 'creative_translation', { targetLang: String(targetLang).toLowerCase() });

  await VideoTranslationJob.push(jobId, {
    ...owner,
    status: 'processing', stage: 'En file', progress: 2,
    targetLang: String(targetLang).toLowerCase(), voice: String(voice),
  });

  // Réponse immédiate ; le traitement continue en tâche de fond.
  res.status(202).json({ success: true, jobId, creditsUsed: transResv.credits, creditsRemaining: transResv.remaining });

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
        originalUrl: result.originalUrl || null,
        translatedText: result.translatedText || '',
        sourceLang: result.sourceLang, targetLang: result.targetLang,
        segmentCount: result.segmentCount, durationSec: result.durationSec,
      });
      await recordFinalCreativeVideo({
        ...owner,
        videoUrl: result.videoUrl,
        label: `Vidéo traduite · ${String(result.targetLang || targetLang).toUpperCase()}`,
        kind: 'video-translation',
        durationSec: result.durationSec || 0,
        meta: {
          jobId,
          sourceLang: result.sourceLang || '',
          targetLang: result.targetLang || targetLang,
        },
      });
    } catch (err) {
      console.error('[VideoTranslation] job failed:', err.message);
      await transResv.refund(err.message);
      await VideoTranslationJob.push(jobId, {
        status: 'error', stage: 'Erreur', error: err.message?.slice(0, 400) || 'Échec de la traduction.',
      });
    } finally {
      await fs.rm(videoPath, { force: true }).catch(() => {});
    }
  })();
});

// ─── Voix off Scalor sur la vidéo ORIGINALE ──────────────────────────────────
// POST /video-translation/:jobId/revoice { voiceRefId? }
// Le texte TRADUIT du job → voix off Fish Audio → assemblage ffmpeg sur la
// vidéo de base (piste audio remplacée). Suivi via le poll du job
// (revoiceStatus/revoiceProgress/revoiceUrl).
router.post('/:jobId/revoice', requireEcomAuth, async (req, res) => {
  try {
    const job = await VideoTranslationJob.findOne({ jobId: req.params.jobId }).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job introuvable ou expiré.' });
    if (job.workspaceId && req.workspaceId && String(job.workspaceId) !== String(req.workspaceId)) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    if (job.status !== 'done') return res.status(400).json({ success: false, message: 'La traduction n\'est pas terminée.' });
    if (!job.translatedText) return res.status(400).json({ success: false, message: 'Texte traduit indisponible pour ce job (relancez une traduction).' });
    if (!job.originalUrl) return res.status(400).json({ success: false, message: 'Vidéo originale indisponible pour ce job (relancez une traduction).' });
    if (job.revoiceStatus === 'processing') return res.status(409).json({ success: false, message: 'Assemblage déjà en cours.' });

    const FISH_API_KEY = process.env.FISH_API_KEY || process.env.FISHAUDIO_API_KEY || '';
    if (!FISH_API_KEY) return res.status(503).json({ success: false, message: 'Voix off non configurée (FISH_API_KEY).' });

    const voiceRefId = String(req.body?.voiceRefId || '').trim();
    // Texte retouché côté frontend (segments édités) : prioritaire sur le
    // texte traduit stocké — permet de corriger la voix off avant assemblage.
    const editedText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const ttsSource = editedText || job.translatedText;
    const jobId = job.jobId;
    await VideoTranslationJob.push(jobId, { revoiceStatus: 'processing', revoiceProgress: 5, revoiceError: null, revoiceUrl: null });
    res.status(202).json({ success: true, jobId });

    // ── Worker asynchrone : TTS Fish → ffmpeg (audio remplacé) → R2 ──
    (async () => {
      try {
        const axios = (await import('axios')).default;
        const body = { text: ttsSource.slice(0, 9000), format: 'mp3', mp3_bitrate: 128, normalize: true, latency: 'normal' };
        if (voiceRefId) body.reference_id = voiceRefId;
        const fishRes = await axios.post('https://api.fish.audio/v1/tts', body, {
          headers: { Authorization: `Bearer ${FISH_API_KEY}`, 'Content-Type': 'application/json', model: process.env.FISH_MODEL || 's2.1-pro-free' },
          responseType: 'arraybuffer',
          timeout: 240000,
        });
        const audioBuffer = Buffer.from(fishRes.data);
        if (!audioBuffer?.length) throw new Error('Voix off vide.');
        await VideoTranslationJob.push(jobId, { revoiceProgress: 55 });

        // Assemblage : vidéo ORIGINALE + voix off (durée de la vidéo respectée).
        const { addVoiceoverToVideo } = await import('../services/falVideoService.js');
        const maxSeconds = Math.max(5, Number(job.durationSec) || 600);
        const finalBuffer = await addVoiceoverToVideo(job.originalUrl, audioBuffer, { maxSeconds });
        await VideoTranslationJob.push(jobId, { revoiceProgress: 85 });

        const { uploadToR2 } = await import('../services/cloudflareImagesService.js');
        const up = await uploadToR2(finalBuffer, `video-translation/revoice-${Date.now()}.mp4`, 'video/mp4');
        if (!up?.success || !up.url) throw new Error(up?.error || 'Publication impossible.');

        await VideoTranslationJob.push(jobId, { revoiceStatus: 'done', revoiceProgress: 100, revoiceUrl: up.url });
        // Galerie + historique (best-effort)
        const { recordFinalCreativeVideo } = await import('../services/creativeFinalVideoService.js');
        await recordFinalCreativeVideo({
          workspaceId: job.workspaceId, userId: job.userId, videoUrl: up.url,
          label: `Vidéo traduite + voix off · ${String(job.targetLang || '').toUpperCase()}`,
          kind: 'video-translation-revoice', durationSec: job.durationSec || 0,
          meta: { jobId, voiceRefId },
        });
      } catch (err) {
        console.error('[VideoTranslation] revoice failed:', err.message);
        await VideoTranslationJob.push(jobId, { revoiceStatus: 'error', revoiceError: String(err.message || 'Échec de l\'assemblage.').slice(0, 300) });
      }
    })();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
