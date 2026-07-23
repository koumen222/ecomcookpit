// ─────────────────────────────────────────────────────────────────────────────
//  Routes du MONTAGE AUTOMATIQUE (outil « Montage Auto », séparé du Creative
//  Center).
//    POST /api/ecom/auto-montage/start        → upload vidéo (+ musique opt.) + job async
//    GET  /api/ecom/auto-montage/jobs/:jobId  → poll progression/résultat
//    GET  /api/ecom/auto-montage/meta/options → formats, styles, coût crédits
//
//  Même pattern éprouvé que videoTranslation : multer disque (vidéo lourde),
//  réservation de crédits AVANT le job, réponse 202 immédiate avec jobId,
//  worker fire-and-forget, remboursement automatique en cas d'échec.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import AutoMontageJob from '../models/AutoMontageJob.js';
import { autoEditVideo, CAPTION_STYLES } from '../services/autoEditService.js';
import { reserveFeatureCredits, sendInsufficientCredits, getFeatureCost } from '../services/creativeCredits.js';
import { recordFinalCreativeVideo } from '../services/creativeFinalVideoService.js';
import { toUserAiError } from '../utils/aiErrorMessages.js';

const router = express.Router();

// Vidéo (+ musique optionnelle) → disque temporaire, jamais la mémoire.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, `automontage-${file.fieldname}-${crypto.randomUUID()}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 Mo
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video' && /^video\//.test(file.mimetype)) return cb(null, true);
    if (file.fieldname === 'music' && /^audio\//.test(file.mimetype)) return cb(null, true);
    cb(new Error(file.fieldname === 'music'
      ? 'Fichier audio requis pour la musique (mp3, wav…).'
      : 'Fichier vidéo requis (mp4, mov, webm…).'));
  },
});

router.get('/meta/options', requireEcomAuth, async (req, res) => {
  res.json({
    success: true,
    formats: ['9:16', '16:9'],
    captionStyles: Object.entries(CAPTION_STYLES).map(([id, s]) => ({ id, label: s.label })),
    brollModes: [
      { id: 'kenburns', label: 'Images animées (rapide)' },
      { id: 'animated', label: 'Clips vidéo IA (plus lent, plus immersif)' },
    ],
    maxBrolls: 5,
    maxDurationMin: 12,
    credits: await getFeatureCost('auto_montage'),
  });
});

// ─── Lancer un montage automatique ───────────────────────────────────────────
router.post('/start', requireEcomAuth,
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'music', maxCount: 1 }]),
  async (req, res) => {
    const videoFile = req.files?.video?.[0];
    const musicFile = req.files?.music?.[0] || null;
    if (!videoFile) return res.status(400).json({ success: false, message: 'Aucun fichier vidéo reçu.' });

    const cleanupUploads = async () => {
      await fs.rm(videoFile.path, { force: true }).catch(() => {});
      if (musicFile) await fs.rm(musicFile.path, { force: true }).catch(() => {});
    };

    // Options (FormData → chaînes)
    const body = req.body || {};
    const formats = String(body.formats || '9:16').split(',').map((f) => f.trim()).filter(Boolean);
    const captionStyle = ['bold', 'clean', 'neon'].includes(body.captionStyle) ? body.captionStyle : 'bold';
    const brollCount = Math.max(0, Math.min(5, parseInt(body.brollCount, 10) || 0));
    const brollMode = body.brollMode === 'animated' ? 'animated' : 'kenburns';
    const removeSilences = String(body.removeSilences ?? 'true') !== 'false';
    const targetDuration = Number(body.targetDuration) > 5 ? Math.min(600, Number(body.targetDuration)) : null;

    // Débit Creative Center : réservé avant le job, remboursé si échec.
    const resv = await reserveFeatureCredits(req.workspaceId, 'auto_montage');
    if (!resv.ok) {
      await cleanupUploads();
      return sendInsufficientCredits(res, 'auto_montage', resv);
    }

    const jobId = crypto.randomUUID();
    const owner = {
      workspaceId: req.workspaceId || null,
      userId: req.ecomUser?._id || null,
    };
    await AutoMontageJob.push(jobId, {
      ...owner,
      status: 'processing', stage: 'En file', progress: 2,
      formats,
    });

    res.status(202).json({ success: true, jobId, creditsUsed: resv.credits, creditsRemaining: resv.remaining });

    // ── Worker asynchrone ──
    (async () => {
      try {
        const result = await autoEditVideo(
          videoFile.path,
          { formats, captionStyle, brollCount, brollMode, musicPath: musicFile?.path || null, removeSilences, targetDuration },
          (progress, stage) => { AutoMontageJob.push(jobId, { progress, stage }); },
        );
        await AutoMontageJob.push(jobId, {
          status: 'done', progress: 100, stage: 'Terminé',
          outputs: result.outputs, srtUrl: result.srtUrl,
          language: result.language, brollCount: result.brollCount,
          cutsRemovedSec: result.cutsRemovedSec,
          report: result.report || null,
          warning: result.warnings?.length ? result.warnings.join(' · ').slice(0, 600) : null,
        });
        await Promise.all((result.outputs || []).map((output) => recordFinalCreativeVideo({
          ...owner,
          videoUrl: output?.url,
          label: `Montage automatique IA${output?.format ? ` · ${output.format}` : ''}`,
          kind: 'auto-montage',
          format: output?.format || '',
          durationSec: output?.durationSec || 0,
          meta: { jobId },
        })));
      } catch (err) {
        console.error('[AutoMontage] job failed:', err.message);
        await resv.refund(err.message);
        // Message neutre côté utilisateur — le détail technique reste en log.
        await AutoMontageJob.push(jobId, {
          status: 'error', stage: 'Erreur',
          error: toUserAiError(err, 'Échec du montage automatique. Réessayez dans quelques instants.').slice(0, 300),
        });
      } finally {
        await cleanupUploads();
      }
    })();
  });

// ─── Poll d'un job ───────────────────────────────────────────────────────────
router.get('/jobs/:jobId', requireEcomAuth, async (req, res) => {
  try {
    const job = await AutoMontageJob.findOne({ jobId: req.params.jobId }).lean();
    if (!job) return res.status(404).json({ success: false, message: 'Job introuvable ou expiré.' });

    // Worker mort (redémarrage serveur) : plus de battement depuis 5 min.
    if (job.status === 'processing' && Date.now() - new Date(job.heartbeatAt).getTime() > 5 * 60 * 1000) {
      await AutoMontageJob.push(job.jobId, { status: 'error', stage: 'Erreur', error: 'Le rendu a été interrompu (redémarrage du serveur). Relancez le montage.' });
      job.status = 'error';
      job.error = 'Le rendu a été interrompu (redémarrage du serveur). Relancez le montage.';
    }

    res.json({
      success: true,
      job: {
        jobId: job.jobId, status: job.status, stage: job.stage, progress: job.progress,
        outputs: job.outputs || [], srtUrl: job.srtUrl || null,
        language: job.language || null, brollCount: job.brollCount || 0,
        cutsRemovedSec: job.cutsRemovedSec || 0,
        report: job.report || null,
        error: job.error || null, warning: job.warning || null,
      },
    });
  } catch (err) {
    console.error('[AutoMontage] poll error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
