import express from 'express';
import FeatureFeedback, { FEEDBACK_FEATURES } from '../models/FeatureFeedback.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// Garde-fou anti-spam : maximum de feedbacks par utilisateur sur 24h.
const MAX_FEEDBACKS_PER_DAY = 20;

/**
 * POST /api/ecom/feedback
 * Enregistre l'avis d'un utilisateur après l'utilisation d'une fonctionnalité.
 * Body: { feature, rating (1-5), comment?, page?, meta? }
 * Best-effort côté frontend : toute erreur ici est silencieuse pour l'utilisateur.
 */
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { feature, rating, comment, page, meta } = req.body || {};

    const featureClean = FEEDBACK_FEATURES.includes(String(feature)) ? String(feature) : 'other';
    const ratingClean = Math.round(Number(rating));
    if (!Number.isFinite(ratingClean) || ratingClean < 1 || ratingClean > 5) {
      return res.status(400).json({ success: false, message: 'Note invalide (1 à 5 attendu).' });
    }

    const userId = req.ecomUser?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié.' });
    }

    // Anti-spam : cap journalier par utilisateur
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recentCount = await FeatureFeedback.countDocuments({ userId, createdAt: { $gte: since } });
    if (recentCount >= MAX_FEEDBACKS_PER_DAY) {
      return res.status(429).json({ success: false, message: 'Trop de feedbacks envoyés récemment.' });
    }

    const doc = await FeatureFeedback.create({
      workspaceId: req.workspaceId || undefined,
      userId,
      feature: featureClean,
      rating: ratingClean,
      comment: typeof comment === 'string' ? comment.slice(0, 2000) : '',
      page: typeof page === 'string' ? page.slice(0, 300) : undefined,
      meta: (meta && typeof meta === 'object') ? meta : undefined,
    });

    res.status(201).json({ success: true, id: doc._id });
  } catch (err) {
    console.error('[Feedback] create error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
