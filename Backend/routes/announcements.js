import express from 'express';
import PlatformCampaign from '../models/PlatformCampaign.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

/**
 * Face applicative des annonces : ce que l'utilisateur voit dans Scalor.
 *
 * Séparé de platformMarketing.js parce que le lecteur n'est pas le même —
 * ici c'est un marchand authentifié, là-bas le super admin. Monter ces routes
 * sous /super-admin aurait obligé à relâcher la garde du préfixe entier.
 *
 * Les fermetures sont stockées côté client (une annonce fermée est une
 * préférence d'affichage, pas une donnée métier) : `dismissedIds` arrive en
 * query, le serveur filtre. Un modèle « annonce lue » aurait ajouté une
 * écriture par utilisateur et par annonce pour un bandeau qu'on ferme d'un clic.
 */

const router = express.Router();

router.get('/active', requireEcomAuth, async (req, res) => {
  try {
    const now = new Date();
    const dismissed = String(req.query.dismissed || '').split(',').map((s) => s.trim()).filter(Boolean);

    const items = await PlatformCampaign.find({
      kind: 'announcement',
      status: { $in: ['sent', 'sending', 'scheduled', 'draft'] },
      'placement.surfaces.0': { $exists: true },
      $and: [
        { $or: [{ 'placement.startsAt': null }, { 'placement.startsAt': { $lte: now } }] },
        { $or: [{ 'placement.endsAt': null }, { 'placement.endsAt': { $gte: now } }] },
      ],
    })
      .select('_id name placement createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const surface = String(req.query.surface || '').trim();
    const visible = items
      .filter((a) => !dismissed.includes(String(a._id)))
      .filter((a) => !surface || (a.placement?.surfaces || []).includes(surface))
      .map((a) => ({
        id: String(a._id),
        surfaces: a.placement?.surfaces || [],
        variant: a.placement?.variant || 'feature',
        title: a.placement?.title || a.name,
        body: a.placement?.body || '',
        imageUrl: a.placement?.imageUrl || '',
        ctaLabel: a.placement?.ctaLabel || '',
        ctaUrl: a.placement?.ctaUrl || '',
        dismissible: a.placement?.dismissible !== false,
      }));

    return res.json({ success: true, items: visible });
  } catch (error) {
    console.error('[announcements]', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement des annonces' });
  }
});

export default router;
