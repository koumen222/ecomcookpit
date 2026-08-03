import express from 'express';
import GuestSession from '../models/GuestSession.js';
import CreativeAsset from '../models/CreativeAsset.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { issueGuestToken, verifyGuestToken, clientIp } from '../middleware/guestAuth.js';

/**
 * Sessions invité du Creative Center (essai sans compte).
 *
 *   POST /api/ecom/guest/session : crée (ou renvoie) une session invité + token.
 *   GET  /api/ecom/guest/status  : quota restant de l'invité.
 *   POST /api/ecom/guest/claim   : (connecté) rattache le contenu généré en
 *                                  invité au workspace de l'utilisateur.
 */

const router = express.Router();

const MAX_SESSIONS_PER_IP_PER_DAY = 10;

// ── POST /session ─────────────────────────────────────────────────────────────
router.post('/session', async (req, res) => {
  try {
    const ip = clientIp(req);

    // Token existant encore valide → renvoyer la même session (pas de reset de quota)
    const existing = verifyGuestToken(req.body?.token);
    if (existing) {
      const sess = await GuestSession.findOne({ guestId: existing.gid }).lean();
      if (sess && !sess.claimedBy) {
        return res.json({
          success: true,
          token: String(req.body.token),
          guestId: sess.guestId,
          generationsUsed: sess.generationsUsed,
          generationsLimit: sess.generationsLimit,
          voiceGenerationsUsed: sess.voiceGenerationsUsed || 0,
          voiceGenerationsLimit: sess.voiceGenerationsLimit ?? 2,
        });
      }
    }

    // Anti-abus : limite de créations de sessions par IP sur 24 h
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recentCount = await GuestSession.countDocuments({ ip, createdAt: { $gte: since } });
    if (recentCount >= MAX_SESSIONS_PER_IP_PER_DAY) {
      return res.status(429).json({ success: false, error: 'Trop de sessions d’essai depuis cette connexion — crée un compte gratuit pour continuer.' });
    }

    const { gid, token } = issueGuestToken();
    const sess = await GuestSession.create({
      guestId: gid,
      ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    });

    return res.json({
      success: true,
      token,
      guestId: gid,
      generationsUsed: sess.generationsUsed,
      generationsLimit: sess.generationsLimit,
      voiceGenerationsUsed: sess.voiceGenerationsUsed || 0,
      voiceGenerationsLimit: sess.voiceGenerationsLimit ?? 2,
    });
  } catch (err) {
    console.error('❌ POST /guest/session:', err.message);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ── GET /status ───────────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const decoded = verifyGuestToken(req.header('Authorization'));
  if (!decoded) return res.status(401).json({ success: false, error: 'Token invité invalide' });
  const sess = await GuestSession.findOne({ guestId: decoded.gid }).lean();
  if (!sess) return res.status(404).json({ success: false, error: 'Session invitée introuvable' });
  return res.json({
    success: true,
    generationsUsed: sess.generationsUsed,
    generationsLimit: sess.generationsLimit,
    claimed: !!sess.claimedBy,
  });
});

// ── POST /claim — après connexion/inscription ────────────────────────────────
router.post('/claim', requireEcomAuth, async (req, res) => {
  try {
    const decoded = verifyGuestToken(req.body?.guestToken);
    if (!decoded) return res.status(400).json({ success: false, error: 'Token invité invalide' });
    if (!req.workspaceId) return res.status(400).json({ success: false, error: 'Workspace requis' });

    const userId = req.user?.id || req.ecomUser?._id;
    const sess = await GuestSession.findOne({ guestId: decoded.gid });
    if (!sess) return res.json({ success: true, claimed: 0, assets: [] });
    if (sess.claimedBy && String(sess.claimedBy) !== String(userId)) {
      return res.status(409).json({ success: false, error: 'Ce contenu d’essai a déjà été rattaché à un autre compte.' });
    }

    // Rattacher les visuels générés en invité au workspace de l'utilisateur
    const guestAssetIds = (await CreativeAsset.find({ guestId: decoded.gid }).select('_id').lean()).map((a) => a._id);
    if (guestAssetIds.length) {
      await CreativeAsset.updateMany(
        { _id: { $in: guestAssetIds } },
        { $set: { workspaceId: req.workspaceId, userId, guestId: null } }
      );
    }
    const assets = guestAssetIds.length
      ? await CreativeAsset.find({ _id: { $in: guestAssetIds } }).sort({ createdAt: -1 }).lean()
      : [];

    sess.claimedBy = userId;
    sess.claimedWorkspaceId = req.workspaceId;
    sess.claimedAt = new Date();
    await sess.save();

    console.log(`🎁 Guest content claimed: guest=${decoded.gid} → workspace=${req.workspaceId}`);
    return res.json({ success: true, claimed: assets.length, assets });
  } catch (err) {
    console.error('❌ POST /guest/claim:', err.message);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
