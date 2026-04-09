/**
 * /api/ecom/stores — Multi-store management
 * List, create, update, delete stores for a workspace.
 * Each store has its own subdomain, branding, products, and orders.
 */
import express from 'express';
import mongoose from 'mongoose';
import Store from '../models/Store.js';
import Workspace from '../models/Workspace.js';
import StoreProduct from '../models/StoreProduct.js';
import StoreOrder from '../models/StoreOrder.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// Helper: generate a subdomain suggestion from a store name
function generateSubdomain(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

// Helper: check subdomain availability across Store + Workspace (for backward compat)
async function isSubdomainAvailable(subdomain, excludeStoreId = null) {
  const cleanSub = subdomain.toLowerCase().trim();
  const storeQuery = { subdomain: cleanSub };
  if (excludeStoreId) storeQuery._id = { $ne: excludeStoreId };
  const [storeConflict, wsConflict] = await Promise.all([
    Store.findOne(storeQuery).select('_id').lean(),
    Workspace.findOne({ subdomain: cleanSub }).select('_id').lean()
  ]);
  return !storeConflict && !wsConflict;
}

// GET /api/ecom/stores — list all stores for current workspace
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    let stores = await Store.find({ workspaceId: req.workspaceId, isActive: true })
      .select('_id name subdomain storeSettings storeTheme isActive createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const ws = await Workspace.findById(req.workspaceId)
      .select('primaryStoreId name subdomain storeSettings')
      .lean();

    // Auto-migrate: if no Store docs exist yet but workspace has a subdomain, create one now
    if (stores.length === 0 && ws?.subdomain) {
      try {
        const created = await Store.create({
          workspaceId: req.workspaceId,
          name: ws.storeSettings?.storeName || ws.name,
          subdomain: ws.subdomain,
          isActive: true,
          storeSettings: { ...ws.storeSettings, isStoreEnabled: ws.storeSettings?.isStoreEnabled ?? true },
          createdBy: req.ecomUser._id
        });
        await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: created._id } });
        stores = [created.toObject()];
        // Auto-assign orphan products & orders to this store
        await Promise.all([
          StoreProduct.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: created._id } }
          ),
          StoreOrder.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: created._id } }
          )
        ]);
      } catch (migErr) {
        // Duplicate subdomain — fetch what already exists
        const existing = await Store.findOne({ workspaceId: req.workspaceId }).lean();
        if (existing) stores = [existing];
      }
    }

    // Auto-assign orphan products/orders to primary store (one-time migration)
    if (stores.length > 0) {
      const primaryId = ws?.primaryStoreId || stores[0]._id;
      const orphanCount = await StoreProduct.countDocuments({ workspaceId: req.workspaceId, storeId: null });
      if (orphanCount > 0) {
        await Promise.all([
          StoreProduct.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: primaryId } }
          ),
          StoreOrder.updateMany(
            { workspaceId: req.workspaceId, storeId: null },
            { $set: { storeId: primaryId } }
          )
        ]);
        console.log(`✅ Migrated ${orphanCount} orphan products to store ${primaryId}`);
      }
    }

    res.json({
      success: true,
      data: stores.map(s => ({
        ...s,
        isPrimary: String(ws?.primaryStoreId) === String(s._id)
      }))
    });
  } catch (err) {
    console.error('Erreur liste stores:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores — create a new store (max 3 per workspace)
const MAX_STORES_PER_WORKSPACE = 3;
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { name, subdomain } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nom de boutique requis' });
    }

    // Enforce max stores limit
    const storeCount = await Store.countDocuments({ workspaceId: req.workspaceId, isActive: true });
    if (storeCount >= MAX_STORES_PER_WORKSPACE) {
      return res.status(403).json({ success: false, message: `Maximum ${MAX_STORES_PER_WORKSPACE} boutiques autorisées` });
    }

    // Determine subdomain
    let finalSubdomain = subdomain ? subdomain.toLowerCase().trim() : null;
    if (!finalSubdomain) {
      // Auto-generate + ensure unique
      let base = generateSubdomain(name);
      let candidate = base;
      let attempt = 0;
      while (!(await isSubdomainAvailable(candidate))) {
        attempt++;
        candidate = `${base}-${attempt}`;
      }
      finalSubdomain = candidate;
    } else {
      if (!/^[a-z0-9-]{3,30}$/.test(finalSubdomain)) {
        return res.status(400).json({ success: false, message: 'Sous-domaine invalide (3-30 caractères alphanumériques et tirets)' });
      }
      if (!(await isSubdomainAvailable(finalSubdomain))) {
        return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
      }
    }

    const store = await Store.create({
      workspaceId: req.workspaceId,
      name: name.trim(),
      subdomain: finalSubdomain,
      isActive: true,
      storeSettings: {
        isStoreEnabled: true,
        storeName: name.trim(),
        storeDescription: '',
        storeLogo: '',
        storeBanner: '',
        storePhone: '',
        storeWhatsApp: '',
        storeThemeColor: '#0F6B4F',
        storeCurrency: 'XAF'
      },
      createdBy: req.ecomUser._id
    });

    // If this is the first store for the workspace, set as primary
    const ws = await Workspace.findById(req.workspaceId).select('primaryStoreId').lean();
    if (!ws?.primaryStoreId) {
      await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: store._id } });
    }

    res.status(201).json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur création store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/stores/:storeId — get one store
router.get('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({
      _id: req.params.storeId,
      workspaceId: req.workspaceId,
      isActive: true
    }).lean();

    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    res.json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur get store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/stores/:storeId — update store config
router.put('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({
      _id: req.params.storeId,
      workspaceId: req.workspaceId
    });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    const allowed = ['name', 'storeSettings', 'storeTheme', 'storePages', 'storePixels', 'storePayments', 'storeDomains', 'storeDeliveryZones', 'whatsappAutoConfirm', 'whatsappOrderTemplate', 'whatsappAutoInstanceId', 'whatsappAutoImageUrl', 'whatsappAutoAudioUrl', 'whatsappAutoVideoUrl', 'whatsappAutoDocumentUrl', 'whatsappAutoSendOrder', 'whatsappAutoProductMediaRules'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] === 'object' && !Array.isArray(req.body[key]) && req.body[key] !== null && typeof store[key] === 'object') {
          store[key] = { ...store[key], ...req.body[key] };
        } else {
          store[key] = req.body[key];
        }
      }
    }
    store.markModified('storeSettings');
    store.markModified('storeTheme');
    store.markModified('storePages');
    store.markModified('storePixels');
    store.markModified('storePayments');
    store.markModified('storeDomains');
    store.markModified('storeDeliveryZones');
    await store.save();

    res.json({ success: true, data: store });
  } catch (err) {
    console.error('Erreur update store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/stores/:storeId/subdomain — update subdomain
router.put('/:storeId/subdomain', requireEcomAuth, async (req, res) => {
  try {
    const { subdomain } = req.body;
    if (!subdomain?.trim()) return res.status(400).json({ success: false, message: 'Sous-domaine requis' });

    const clean = subdomain.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'Sous-domaine invalide (3-30 caractères)' });
    }

    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    if (store.subdomain !== clean && !(await isSubdomainAvailable(clean, store._id))) {
      return res.status(409).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' });
    }

    store.subdomain = clean;
    await store.save();

    res.json({ success: true, data: { subdomain: clean } });
  } catch (err) {
    console.error('Erreur update subdomain:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/stores/check-subdomain/:subdomain — availability check
router.get('/check-subdomain/:subdomain', requireEcomAuth, async (req, res) => {
  try {
    const clean = req.params.subdomain.toLowerCase().trim();
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
      return res.json({ success: true, available: false, reason: 'Format invalide' });
    }
    const available = await isSubdomainAvailable(clean, req.query.excludeStoreId || null);
    res.json({ success: true, available });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores/:storeId/set-primary — set as primary store
router.post('/:storeId/set-primary', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId, isActive: true }).select('_id').lean();
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: store._id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/stores/:storeId — soft delete
router.delete('/:storeId', requireEcomAuth, async (req, res) => {
  try {
    const store = await Store.findOne({ _id: req.params.storeId, workspaceId: req.workspaceId });
    if (!store) return res.status(404).json({ success: false, message: 'Boutique non trouvée' });

    // Can't delete primary store if it's the only one
    const ws = await Workspace.findById(req.workspaceId).select('primaryStoreId').lean();
    const storeCount = await Store.countDocuments({ workspaceId: req.workspaceId, isActive: true });
    if (String(ws?.primaryStoreId) === String(store._id) && storeCount <= 1) {
      return res.status(400).json({ success: false, message: 'Impossible de supprimer la seule boutique' });
    }

    store.isActive = false;
    await store.save();

    // If it was primary, set another store as primary
    if (String(ws?.primaryStoreId) === String(store._id)) {
      const next = await Store.findOne({ workspaceId: req.workspaceId, isActive: true, _id: { $ne: store._id } }).select('_id').lean();
      if (next) await Workspace.updateOne({ _id: req.workspaceId }, { $set: { primaryStoreId: next._id } });
    }

    res.json({ success: true, message: 'Boutique supprimée' });
  } catch (err) {
    console.error('Erreur delete store:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
