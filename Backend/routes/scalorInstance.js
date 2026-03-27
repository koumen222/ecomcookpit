import { Router } from 'express';
import { scalorAuth, scalorRequirePermission, scalorRateLimit } from '../middleware/scalorAuth.js';
import { scalorDashboardAuth } from './scalorAuth.js';
import ScalorInstance from '../models/ScalorInstance.js';
import scalorEvolutionService from '../services/scalorEvolutionService.js';

const router = Router();

// Accept both API key auth (public API) and dashboard JWT auth (web app)
router.use((req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const raw = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (raw.startsWith('sk_')) {
    return scalorAuth(req, res, () => scalorRateLimit(req, res, next));
  }
  return scalorDashboardAuth(req, res, next);
});

// ═══════════════════════════════════════════════
// POST /create — Create a new WhatsApp instance
// ═══════════════════════════════════════════════
router.post('/create', scalorRequirePermission('instance:create'), async (req, res) => {
  try {
    const { name } = req.body;
    const user = req.scalorUser;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'invalid_name', message: 'Instance name must be at least 2 characters' });
    }

    // Sanitize name (alphanumeric, hyphens, underscores only)
    const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);

    // Check instance limit
    const currentCount = await ScalorInstance.countDocuments({ userId: user._id, isActive: true });
    if (user.maxInstances !== -1 && currentCount >= user.maxInstances) {
      return res.status(403).json({
        error: 'instance_limit_reached',
        message: `Your ${user.plan} plan allows ${user.maxInstances} instance(s). Upgrade to create more.`,
        currentCount,
        maxInstances: user.maxInstances
      });
    }

    // Prefix instance name for tenant isolation
    const instanceName = `scalor_${user._id}_${safeName}`;

    // Check if name already taken
    const existing = await ScalorInstance.findOne({ instanceName });
    if (existing) {
      return res.status(409).json({ error: 'instance_exists', message: 'An instance with this name already exists' });
    }

    // Create on Evolution API
    const result = await scalorEvolutionService.createInstance(instanceName);
    if (!result.success) {
      return res.status(502).json({ error: 'creation_failed', message: 'Failed to create WhatsApp instance', details: result.error });
    }

    // Extract token from Evolution API response
    const instanceToken = result.data?.hash || result.data?.instance?.apikey || result.data?.apikey || '';

    // Save to database
    const instance = await ScalorInstance.create({
      userId: user._id,
      instanceName,
      displayName: safeName,
      instanceToken,
      status: 'awaiting_qr'
    });

    // Set up webhook to relay to Scalor backend
    const webhookUrl = `${process.env.SCALOR_WEBHOOK_BASE_URL || 'https://api.scalor.net'}/api/scalor/webhooks/evolution/${instance._id}`;
    await scalorEvolutionService.setWebhook(instanceName, instanceToken, {
      url: webhookUrl,
      events: ['messages.upsert', 'connection.update', 'messages.update'],
      enabled: true
    });

    res.status(201).json({
      success: true,
      instance: {
        id: instance._id,
        name: instance.displayName,
        instanceName: instance.instanceName,
        status: instance.status,
        createdAt: instance.createdAt
      }
    });
  } catch (error) {
    console.error('❌ [Scalor] Instance create error:', error);
    res.status(500).json({ error: 'server_error', message: 'Failed to create instance' });
  }
});

// ═══════════════════════════════════════════════
// GET / — List all instances for the user
// ═══════════════════════════════════════════════
router.get('/', scalorRequirePermission('instance:read'), async (req, res) => {
  try {
    const instances = await ScalorInstance.find({
      userId: req.scalorUser._id,
      isActive: true
    }).select('displayName instanceName status phoneNumber messagesSentToday messagesSentThisMonth lastConnectedAt createdAt webhookUrl');

    res.json({ success: true, instances });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// GET /:id — Get instance details
// ═══════════════════════════════════════════════
router.get('/:id', scalorRequirePermission('instance:read'), async (req, res) => {
  try {
    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    // Get live connection status from Evolution API
    const statusResult = await scalorEvolutionService.getConnectionState(instance.instanceName, instance.instanceToken);

    res.json({
      success: true,
      instance: {
        id: instance._id,
        name: instance.displayName,
        instanceName: instance.instanceName,
        status: instance.status,
        phoneNumber: instance.phoneNumber,
        webhookUrl: instance.webhookUrl,
        webhookEvents: instance.webhookEvents,
        messagesSentToday: instance.messagesSentToday,
        messagesSentThisMonth: instance.messagesSentThisMonth,
        lastConnectedAt: instance.lastConnectedAt,
        createdAt: instance.createdAt,
        liveStatus: statusResult.success ? statusResult.data : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// GET /:id/qrcode — Get QR code for connection
// ═══════════════════════════════════════════════
router.get('/:id/qrcode', scalorRequirePermission('instance:read'), async (req, res) => {
  try {
    const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());
    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    const result = await scalorEvolutionService.getQrCode(instance.instanceName, instance.instanceToken, forceRefresh);

    if (!result.success) {
      return res.status(502).json({ error: 'qr_fetch_failed', message: result.error });
    }

    res.json({
      success: true,
      qrcode: result.qrcode,
      pairingCode: result.pairingCode
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /:id/disconnect — Disconnect (logout) instance
// ═══════════════════════════════════════════════
router.post('/:id/disconnect', scalorRequirePermission('instance:create'), async (req, res) => {
  try {
    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    await scalorEvolutionService.logoutInstance(instance.instanceName, instance.instanceToken);
    instance.status = 'disconnected';
    await instance.save();

    res.json({ success: true, message: 'Instance disconnected' });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /:id/restart — Restart instance
// ═══════════════════════════════════════════════
router.post('/:id/restart', scalorRequirePermission('instance:create'), async (req, res) => {
  try {
    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    const result = await scalorEvolutionService.restartInstance(instance.instanceName, instance.instanceToken);
    if (result.success) {
      instance.status = 'awaiting_qr';
      await instance.save();
    }

    res.json({ success: true, message: 'Instance restart requested' });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /:id — Delete instance permanently
// ═══════════════════════════════════════════════
router.delete('/:id', scalorRequirePermission('instance:create'), async (req, res) => {
  try {
    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    // Delete from Evolution API
    await scalorEvolutionService.deleteInstance(instance.instanceName);

    // Soft delete
    instance.isActive = false;
    instance.status = 'deleted';
    await instance.save();

    res.json({ success: true, message: 'Instance deleted' });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// PUT /:id/webhook — Configure user's webhook URL
// ═══════════════════════════════════════════════
router.put('/:id/webhook', scalorRequirePermission('webhook:manage'), async (req, res) => {
  try {
    const { url, events } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'invalid_url', message: 'Webhook URL is required' });
    }

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      return res.status(400).json({ error: 'invalid_url', message: 'Must be a valid http/https URL' });
    }

    const instance = await ScalorInstance.findOne({
      _id: req.params.id,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    instance.webhookUrl = url;
    if (events && Array.isArray(events)) {
      instance.webhookEvents = events;
    }
    await instance.save();

    res.json({ success: true, webhookUrl: instance.webhookUrl, webhookEvents: instance.webhookEvents });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
