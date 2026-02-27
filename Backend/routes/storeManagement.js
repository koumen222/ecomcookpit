import express from 'express';
import EcomWorkspace from '../models/Workspace.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';
import { requireStoreOwner } from '../middleware/storeAuth.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// STORE MANAGEMENT ROUTES — Configure storefront (authenticated, admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// Reserved subdomains that cannot be claimed
const RESERVED_SUBDOMAINS = [
  'www', 'api', 'app', 'admin', 'dashboard', 'mail', 'ftp',
  'store', 'shop', 'scalor', 'help', 'support', 'docs', 'blog',
  'static', 'cdn', 'assets', 'dev', 'staging', 'test'
];

/**
 * GET /store-manage/config
 * Get current store configuration for the workspace.
 */
router.get('/config', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await EcomWorkspace.findById(req.workspaceId)
      .select('name subdomain storeSettings')
      .lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    res.json({
      success: true,
      data: {
        name: workspace.name,
        subdomain: workspace.subdomain || null,
        storeSettings: workspace.storeSettings || {
          isStoreEnabled: false,
          storeName: '',
          storeDescription: '',
          storeLogo: '',
          storeBanner: '',
          storePhone: '',
          storeWhatsApp: '',
          storeThemeColor: '#0F6B4F',
          storeCurrency: 'XAF'
        },
        storeUrl: workspace.subdomain ? `https://${workspace.subdomain}.scalor.app` : null
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-manage/config:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-manage/config
 * Update store configuration (name, description, logo, etc).
 */
router.put('/config', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    const {
      storeName, storeDescription, storeLogo, storeBanner,
      storePhone, storeWhatsApp, storeThemeColor, storeCurrency,
      isStoreEnabled
    } = req.body;

    const update = {};

    if (storeName !== undefined) update['storeSettings.storeName'] = storeName;
    if (storeDescription !== undefined) update['storeSettings.storeDescription'] = storeDescription;
    if (storeLogo !== undefined) update['storeSettings.storeLogo'] = storeLogo;
    if (storeBanner !== undefined) update['storeSettings.storeBanner'] = storeBanner;
    if (storePhone !== undefined) update['storeSettings.storePhone'] = storePhone;
    if (storeWhatsApp !== undefined) update['storeSettings.storeWhatsApp'] = storeWhatsApp;
    if (storeThemeColor !== undefined) update['storeSettings.storeThemeColor'] = storeThemeColor;
    if (storeCurrency !== undefined) update['storeSettings.storeCurrency'] = storeCurrency;
    if (isStoreEnabled !== undefined) update['storeSettings.isStoreEnabled'] = isStoreEnabled;

    const workspace = await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: update },
      { new: true }
    ).select('name subdomain storeSettings').lean();

    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    res.json({
      success: true,
      message: 'Configuration boutique mise à jour',
      data: {
        name: workspace.name,
        subdomain: workspace.subdomain,
        storeSettings: workspace.storeSettings,
        storeUrl: workspace.subdomain ? `https://${workspace.subdomain}.scalor.app` : null
      }
    });
  } catch (error) {
    console.error('Erreur PUT /store-manage/config:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-manage/subdomain
 * Set or update the store subdomain.
 * Validates uniqueness and format.
 */
router.put('/subdomain', requireEcomAuth, requireWorkspace, requireStoreOwner, async (req, res) => {
  try {
    let { subdomain } = req.body;

    if (!subdomain) {
      return res.status(400).json({ success: false, message: 'Sous-domaine requis' });
    }

    // Sanitize: lowercase, alphanumeric + hyphens only, 3-30 chars
    subdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');

    if (subdomain.length < 3 || subdomain.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Le sous-domaine doit contenir entre 3 et 30 caractères'
      });
    }

    if (RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.status(400).json({
        success: false,
        message: 'Ce sous-domaine est réservé'
      });
    }

    // Check uniqueness
    const existing = await EcomWorkspace.findOne({
      subdomain,
      _id: { $ne: req.workspaceId }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ce sous-domaine est déjà pris'
      });
    }

    const workspace = await EcomWorkspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { subdomain } },
      { new: true }
    ).select('name subdomain storeSettings').lean();

    res.json({
      success: true,
      message: 'Sous-domaine configuré',
      data: {
        subdomain: workspace.subdomain,
        storeUrl: `https://${workspace.subdomain}.scalor.app`
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Ce sous-domaine est déjà pris'
      });
    }
    console.error('Erreur PUT /store-manage/subdomain:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-manage/subdomain/check/:subdomain
 * Check if a subdomain is available.
 */
router.get('/subdomain/check/:subdomain', requireEcomAuth, async (req, res) => {
  try {
    let { subdomain } = req.params;
    subdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

    if (subdomain.length < 3 || RESERVED_SUBDOMAINS.includes(subdomain)) {
      return res.json({ success: true, data: { available: false } });
    }

    const existing = await EcomWorkspace.findOne({ subdomain }).select('_id').lean();
    res.json({
      success: true,
      data: { available: !existing }
    });
  } catch (error) {
    console.error('Erreur GET /store-manage/subdomain/check:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
