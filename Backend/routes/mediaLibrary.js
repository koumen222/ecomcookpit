import express from 'express';
import GeneratedMedia from '../models/GeneratedMedia.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * Médiathèque IA — visuels générés (images, GIF, vidéos), par workspace.
 * Monté sur /api/ecom/media-library.
 */

// GET / — liste paginée. Query : type=image|gif|video, page, limit
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const filter = { workspaceId: req.workspaceId };
    if (['image', 'gif', 'video'].includes(req.query.type)) filter.type = req.query.type;

    const [items, total] = await Promise.all([
      GeneratedMedia.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      GeneratedMedia.countDocuments(filter),
    ]);
    res.json({ success: true, data: items, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error('[MediaLibrary] GET / error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /:id — retire le média de la médiathèque.
// Le fichier n'est pas supprimé du stockage : il peut être utilisé dans des
// pages publiées (descriptions, sections…) — le retirer casserait ces pages.
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const deleted = await GeneratedMedia.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Média introuvable' });
    res.json({ success: true, message: 'Média retiré de la médiathèque' });
  } catch (err) {
    console.error('[MediaLibrary] DELETE error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
