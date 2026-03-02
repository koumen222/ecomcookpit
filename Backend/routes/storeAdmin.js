import express from 'express';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// STORE ADMIN ROUTES — Boutique configuration endpoints
// Mounted at: /api/ecom/store
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ANALYTICS ─────────────────────────────────────────────────────────────────

router.get('/analytics/summary', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        totalOrders: 0,
        totalRevenue: 0,
        totalProducts: 0,
        totalViews: 0
      }
    });
  } catch (error) {
    console.error('Error GET /store/analytics/summary:', error);
    res.status(500).json({ success: false, message: 'Error loading analytics' });
  }
});

// ─── ORDERS ────────────────────────────────────────────────────────────────────

router.get('/orders', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        orders: []
      }
    });
  } catch (error) {
    console.error('Error GET /store/orders:', error);
    res.status(500).json({ success: false, message: 'Error loading orders' });
  }
});

// ─── THEME ─────────────────────────────────────────────────────────────────────

router.get('/theme', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storeTheme')
      .lean();

    res.json({
      success: true,
      data: workspace?.storeTheme || {}
    });
  } catch (error) {
    console.error('Error GET /store/theme:', error);
    res.status(500).json({ success: false, message: 'Error loading theme' });
  }
});

router.put('/theme', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('🎨 PUT /store/theme - workspaceId:', req.workspaceId);
    console.log('🎨 Request body:', JSON.stringify(req.body, null, 2));
    
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storeTheme: req.body } },
      { new: true }
    );

    console.log('✅ Theme updated successfully');
    res.json({
      success: true,
      message: 'Theme updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/theme:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving theme' });
  }
});

// ─── PAGES ─────────────────────────────────────────────────────────────────────

router.get('/pages', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePages')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePages || {}
    });
  } catch (error) {
    console.error('Error GET /store/pages:', error);
    res.status(500).json({ success: false, message: 'Error loading pages' });
  }
});

router.put('/pages', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('📄 PUT /store/pages - workspaceId:', req.workspaceId);
    console.log('📄 Request body:', JSON.stringify(req.body, null, 2));
    
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePages: req.body } },
      { new: true }
    );

    console.log('✅ Pages updated successfully');
    res.json({
      success: true,
      message: 'Pages updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/pages:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving pages' });
  }
});

// ─── PIXELS ────────────────────────────────────────────────────────────────────

router.get('/pixels', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePixels')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePixels || {}
    });
  } catch (error) {
    console.error('Error GET /store/pixels:', error);
    res.status(500).json({ success: false, message: 'Error loading pixels' });
  }
});

router.put('/pixels', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('📊 PUT /store/pixels - workspaceId:', req.workspaceId);
    console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
    
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePixels: req.body } },
      { new: true }
    );

    console.log('✅ Pixels updated successfully');
    res.json({
      success: true,
      message: 'Pixels updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/pixels:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving pixels' });
  }
});

// ─── PAYMENTS ──────────────────────────────────────────────────────────────────

router.get('/payments', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storePayments')
      .lean();

    res.json({
      success: true,
      data: workspace?.storePayments || {}
    });
  } catch (error) {
    console.error('Error GET /store/payments:', error);
    res.status(500).json({ success: false, message: 'Error loading payments' });
  }
});

router.put('/payments', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storePayments: req.body } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payments updated'
    });
  } catch (error) {
    console.error('Error PUT /store/payments:', error);
    res.status(500).json({ success: false, message: 'Error saving payments' });
  }
});

// ─── DOMAINS ───────────────────────────────────────────────────────────────────

router.get('/domains', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('subdomain storeDomains')
      .lean();

    res.json({
      success: true,
      data: {
        subdomain: workspace?.subdomain || '',
        customDomain: workspace?.storeDomains?.customDomain || '',
        sslStatus: workspace?.storeDomains?.sslStatus || 'none'
      }
    });
  } catch (error) {
    console.error('Error GET /store/domains:', error);
    res.status(500).json({ success: false, message: 'Error loading domains' });
  }
});

router.put('/domains', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { subdomain, customDomain } = req.body;
    
    console.log('🌐 PUT /store/domains - workspaceId:', req.workspaceId);
    console.log('🌐 Request body:', { subdomain, customDomain });
    
    const update = {};
    if (subdomain !== undefined) update.subdomain = subdomain;
    if (customDomain !== undefined) update['storeDomains.customDomain'] = customDomain;

    await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: update },
      { new: true }
    );

    console.log('✅ Domains updated successfully');
    res.json({
      success: true,
      message: 'Domains updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/domains:', error);
    console.error('❌ Error details:', error.message);
    res.status(500).json({ success: false, message: 'Error saving domains' });
  }
});

router.post('/domains/check-dns', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { ok: false }
    });
  } catch (error) {
    console.error('Error POST /store/domains/check-dns:', error);
    res.status(500).json({ success: false, message: 'Error checking DNS' });
  }
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────────

router.get('/settings', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.workspaceId)
      .select('storeSettings')
      .lean();

    res.json({
      success: true,
      data: workspace?.storeSettings || {}
    });
  } catch (error) {
    console.error('Error GET /store/settings:', error);
    res.status(500).json({ success: false, message: 'Error loading settings' });
  }
});

router.put('/settings', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    console.log('🔧 PUT /store/settings - workspaceId:', req.workspaceId);
    console.log('🔧 Request body keys:', Object.keys(req.body || {}));
    console.log('🔧 Request body sample:', JSON.stringify(req.body, null, 2).substring(0, 500));
    
    const result = await Workspace.findByIdAndUpdate(
      req.workspaceId,
      { $set: { storeSettings: req.body } },
      { new: true }
    );
    
    console.log('✅ Settings updated successfully for workspace:', req.workspaceId);
    
    res.json({
      success: true,
      message: 'Settings updated'
    });
  } catch (error) {
    console.error('❌ Error PUT /store/settings:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Error saving settings' });
  }
});

export default router;
