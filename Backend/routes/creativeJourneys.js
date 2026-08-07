import express from 'express';
import CreativeJourney from '../models/CreativeJourney.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

/**
 * Parcours de création sauvegardés.
 *
 * Portée : le WORKSPACE, pas l'utilisateur. Une boutique tenue à deux doit
 * pouvoir reprendre le parcours ouvert par l'autre — sinon la sauvegarde ne
 * sert qu'à celui qui l'a créée, et le second refait le travail.
 */

const router = express.Router();

// Un état de studio pèse quelques dizaines de kilo-octets (script, segments,
// réglages). Au-delà, ce sont des données binaires qui n'ont rien à faire là.
const MAX_STATE_BYTES = 512 * 1024;
const MAX_PER_WORKSPACE = 60;

// requireEcomAuth résout le workspace actif (header X-Workspace-Id, sinon
// celui par défaut) et le pose sur req.workspaceId. req.user est le JWT
// décodé — il ne porte PAS le workspace.
const wsOf = (req) => req.workspaceId || req.ecomUser?.workspaceId || null;
const userOf = (req) => req.ecomUser?._id || req.user?.id || null;

const oops = (res, error, code = 500) => {
  console.error('[journeys]', error);
  return res.status(code).json({ success: false, error: String(error?.message || error) });
};

router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = wsOf(req);
    if (!workspaceId) return res.json({ success: true, items: [] });

    const q = { workspaceId };
    if (req.query.family) q.family = req.query.family;
    if (req.query.productId) q.productId = String(req.query.productId);

    // La liste ne renvoie PAS `state` : trente parcours complets sur une page
    // de sélection, c'est plusieurs mégaoctets pour afficher des titres.
    const items = await CreativeJourney.find(q)
      .select('-state')
      .sort({ updatedAt: -1 })
      .limit(Math.min(100, Number(req.query.limit) || 40))
      .lean();

    return res.json({ success: true, items });
  } catch (error) { return oops(res, error); }
});

router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const item = await CreativeJourney.findOne({ _id: req.params.id, workspaceId: wsOf(req) }).lean();
    if (!item) return res.status(404).json({ success: false, error: 'Parcours introuvable' });
    return res.json({ success: true, item });
  } catch (error) { return oops(res, error); }
});

router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = wsOf(req);
    if (!workspaceId) return res.status(400).json({ success: false, error: 'Aucun espace de travail actif' });

    const { id, name, family = 'ugc', productId = '', productName = '', productImage = '',
      headline = '', lastVideoUrl = '', scenesCount = 0, state = {} } = req.body || {};

    if (!String(name || '').trim()) return res.status(400).json({ success: false, error: 'Donne un nom au parcours' });
    if (JSON.stringify(state).length > MAX_STATE_BYTES) {
      return res.status(413).json({ success: false, error: 'Parcours trop lourd — retire les images intégrées avant de sauvegarder' });
    }

    const payload = {
      workspaceId, userId: userOf(req),
      name: String(name).trim().slice(0, 120), family,
      productId: String(productId || ''), productName, productImage,
      headline: String(headline || '').slice(0, 200), lastVideoUrl, scenesCount, state,
    };

    // `id` fourni = enregistrement par-dessus. Sans ça, chaque « Enregistrer »
    // créerait une copie et la liste deviendrait illisible en une séance.
    const item = id
      ? await CreativeJourney.findOneAndUpdate({ _id: id, workspaceId }, { $set: payload }, { new: true })
      : await CreativeJourney.create(payload);

    if (!item) return res.status(404).json({ success: false, error: 'Parcours introuvable' });

    // Purge du plus ancien au-delà du plafond : une liste sans limite finit
    // par coûter plus cher à parcourir qu'à recréer.
    const count = await CreativeJourney.countDocuments({ workspaceId });
    if (count > MAX_PER_WORKSPACE) {
      const old = await CreativeJourney.find({ workspaceId }).sort({ updatedAt: 1 })
        .limit(count - MAX_PER_WORKSPACE).select('_id').lean();
      await CreativeJourney.deleteMany({ _id: { $in: old.map((o) => o._id) } });
    }

    return res.status(id ? 200 : 201).json({ success: true, item });
  } catch (error) { return oops(res, error, 400); }
});

router.patch('/:id', requireEcomAuth, async (req, res) => {
  try {
    const item = await CreativeJourney.findOneAndUpdate(
      { _id: req.params.id, workspaceId: wsOf(req) },
      { $set: { name: String(req.body?.name || '').trim().slice(0, 120) } },
      { new: true },
    ).select('-state');
    if (!item) return res.status(404).json({ success: false, error: 'Parcours introuvable' });
    return res.json({ success: true, item });
  } catch (error) { return oops(res, error, 400); }
});

router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    await CreativeJourney.deleteOne({ _id: req.params.id, workspaceId: wsOf(req) });
    return res.json({ success: true });
  } catch (error) { return oops(res, error); }
});

export default router;
