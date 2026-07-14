import express from 'express';
import mongoose from 'mongoose';
import Collection from '../models/Collection.js';
import StoreProduct from '../models/StoreProduct.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

/**
 * Collections (admin) — CRUD scoped au workspace + boutique active.
 * Monté sur /api/ecom/collections.
 */

const slugify = (name = '') => String(name)
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120) || 'collection';

const scopeFilter = (req) => ({
  workspaceId: req.workspaceId,
  storeId: req.activeStoreId || null,
});

// GET / — liste des collections (avec nombre de produits)
// Scope v1 : workspace entier — le storeId est stocké à la création mais ne
// filtre pas (évite les collections « invisibles » quand la boutique active
// diffère de celle du sous-domaine).
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const collections = await Collection.find({ workspaceId: req.workspaceId })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: collections.map((c) => ({ ...c, productCount: (c.productIds || []).length })),
    });
  } catch (err) {
    console.error('[Collections] GET / error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST / — créer une collection
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { name, description = '', image = '', productIds = [], enabled = true } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Nom de collection requis' });
    }

    // Slug unique dans la boutique
    const base = slugify(name);
    let slug = base;
    let attempt = 0;
    // Boucle bornée : évite une collision infinie improbable
    while (attempt < 20 && await Collection.findOne({ ...scopeFilter(req), slug }).select('_id').lean()) {
      attempt += 1;
      slug = `${base}-${attempt}`;
    }

    const cleanIds = (Array.isArray(productIds) ? productIds : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const collection = await Collection.create({
      ...scopeFilter(req),
      name: String(name).trim(),
      slug,
      description: String(description || '').slice(0, 2000),
      image: String(image || ''),
      productIds: cleanIds,
      enabled: enabled !== false,
    });

    res.json({ success: true, data: collection, message: 'Collection créée' });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Une collection avec ce nom existe déjà' });
    }
    console.error('[Collections] POST / error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /:id — mettre à jour (nom, description, image, produits, visibilité, ordre)
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const collection = await Collection.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!collection) return res.status(404).json({ success: false, message: 'Collection introuvable' });

    const { name, description, image, productIds, enabled, sortOrder } = req.body || {};
    if (name !== undefined && String(name).trim()) collection.name = String(name).trim().slice(0, 120);
    if (description !== undefined) collection.description = String(description || '').slice(0, 2000);
    if (image !== undefined) collection.image = String(image || '');
    if (enabled !== undefined) collection.enabled = enabled !== false;
    if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) collection.sortOrder = Number(sortOrder);
    if (productIds !== undefined) {
      collection.productIds = (Array.isArray(productIds) ? productIds : [])
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
    }

    await collection.save();
    res.json({ success: true, data: collection, message: 'Collection mise à jour' });
  } catch (err) {
    console.error('[Collections] PUT /:id error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /:id — supprimer
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const deleted = await Collection.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!deleted) return res.status(404).json({ success: false, message: 'Collection introuvable' });
    res.json({ success: true, message: 'Collection supprimée' });
  } catch (err) {
    console.error('[Collections] DELETE /:id error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
