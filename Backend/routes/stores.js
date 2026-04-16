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
import { checkPlanLimit } from '../middleware/planLimits.js';

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

function buildStorePublicUrl(store) {
  const customDomain = String(store?.storeDomains?.customDomain || '').trim().toLowerCase();
  const isCustomDomainReady = store?.storeDomains?.sslStatus === 'active' || store?.storeDomains?.dnsVerified === true;

  if (customDomain && isCustomDomainReady) {
    return `https://${customDomain}`;
  }

  if (store?.subdomain) {
    return `https://${store.subdomain}.scalor.net`;
  }

  return null;
}

function hasLegacyWorkspaceStore(workspace) {
  return Boolean(
    workspace?.subdomain
    || workspace?.storePages?.sections?.length > 0
    || workspace?.storeSettings?.isStoreEnabled === true
  );
}

function buildLegacyWorkspaceStore(workspace) {
  const storeLike = {
    subdomain: workspace?.subdomain || null,
    storeDomains: workspace?.storeDomains || {},
  };

  return {
    _id: null,
    name: workspace?.storeSettings?.storeName || workspace?.name || 'Boutique',
    subdomain: workspace?.subdomain || null,
    storeSettings: workspace?.storeSettings || {},
    storeTheme: workspace?.storeTheme || {},
    storePages: workspace?.storePages || {},
    storeDomains: workspace?.storeDomains || {},
    isActive: true,
    createdAt: workspace?.createdAt || null,
    hasHomepage: !!(workspace?.storePages?.sections?.length > 0),
    isPrimary: true,
    customDomain: workspace?.storeDomains?.customDomain || '',
    sslStatus: workspace?.storeDomains?.sslStatus || 'none',
    dnsVerified: workspace?.storeDomains?.dnsVerified === true,
    storeUrl: buildStorePublicUrl(storeLike),
    publicUrl: buildStorePublicUrl(storeLike),
    legacyWorkspaceStore: true,
  };
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
    const stores = await Store.find({ workspaceId: req.workspaceId, isActive: true })
      .select('_id name subdomain storeSettings storeTheme storePages storeDomains isActive createdAt')
      .sort({ createdAt: 1 })
      .lean();

    const ws = await Workspace.findById(req.workspaceId)
      .select('primaryStoreId name subdomain storeSettings storeTheme storePages storeDomains createdAt')
      .lean();

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

    const normalizedStores = stores.map(s => ({
      ...s,
      hasHomepage: !!(s.storePages?.sections?.length > 0),
      isPrimary: String(ws?.primaryStoreId) === String(s._id),
      customDomain: s.storeDomains?.customDomain || '',
      sslStatus: s.storeDomains?.sslStatus || 'none',
      dnsVerified: s.storeDomains?.dnsVerified === true,
      storeUrl: buildStorePublicUrl(s),
      publicUrl: buildStorePublicUrl(s)
    }));

    if (normalizedStores.length === 0 && hasLegacyWorkspaceStore(ws)) {
      normalizedStores.push(buildLegacyWorkspaceStore(ws));
    }

    res.json({
      success: true,
      data: normalizedStores
    });
  } catch (err) {
    console.error('Erreur liste stores:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/stores — create a new store (max 3 per workspace)
const MAX_STORES_PER_WORKSPACE = 3;
router.post('/', requireEcomAuth, checkPlanLimit('stores'), async (req, res) => {
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
