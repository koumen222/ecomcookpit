import { Router } from 'express';
import { scalorAuth, scalorRequirePermission, scalorRateLimit } from '../middleware/scalorAuth.js';
import { scalorDashboardAuth } from './scalorAuth.js';
import ScalorInstance from '../models/ScalorInstance.js';
import ScalorUser from '../models/ScalorUser.js';
import ScalorMessageLog from '../models/ScalorMessageLog.js';
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

/**
 * Helper: validate instance belongs to user and check message quotas
 */
async function validateInstanceAndQuota(user, instanceName, res) {
  // Find instance
  const instance = await ScalorInstance.findOne({
    instanceName,
    userId: user._id,
    isActive: true
  });

  if (!instance) {
    res.status(404).json({ error: 'instance_not_found', message: `Instance "${instanceName}" not found or does not belong to you` });
    return null;
  }

  if (instance.status !== 'connected') {
    res.status(400).json({ error: 'instance_not_connected', message: `Instance "${instanceName}" is not connected. Status: ${instance.status}` });
    return null;
  }

  // Check daily limit
  user.checkAndResetCounters();
  if (user.dailyMessageLimit !== -1 && user.messagesSentToday >= user.dailyMessageLimit) {
    res.status(429).json({
      error: 'daily_limit_exceeded',
      message: `Daily message limit reached (${user.dailyMessageLimit}). Resets at midnight.`,
      limit: user.dailyMessageLimit,
      sent: user.messagesSentToday
    });
    return null;
  }

  // Check monthly limit
  if (user.monthlyMessageLimit !== -1 && user.messagesSentThisMonth >= user.monthlyMessageLimit) {
    res.status(429).json({
      error: 'monthly_limit_exceeded',
      message: `Monthly message limit reached (${user.monthlyMessageLimit}). Upgrade your plan.`,
      limit: user.monthlyMessageLimit,
      sent: user.messagesSentThisMonth
    });
    return null;
  }

  return instance;
}

/**
 * Helper: increment usage counters after sending
 */
async function incrementUsage(user, instance) {
  user.messagesSentToday += 1;
  user.messagesSentThisMonth += 1;
  await user.save();

  instance.messagesSentToday += 1;
  instance.messagesSentThisMonth += 1;
  await instance.save();
}

// ═══════════════════════════════════════════════
// POST /send/text — Send a text message
// ═══════════════════════════════════════════════
router.post('/send/text', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, number, message } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !number || !message) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName, number and message are required' });
    }

    const instance = await validateInstanceAndQuota(user, instanceName, res);
    if (!instance) return;

    // Send via Evolution API
    const result = await scalorEvolutionService.sendText(instance.instanceName, instance.instanceToken, number, message);

    // Log the message
    await ScalorMessageLog.create({
      userId: user._id,
      instanceId: instance._id,
      instanceName: instance.instanceName,
      phoneNumber: number,
      messageType: 'text',
      contentPreview: message.substring(0, 200),
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.data?.key?.id,
      errorMessage: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
      requestIp: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    // Increment usage
    await incrementUsage(user, instance);

    res.json({
      success: true,
      messageId: result.data?.key?.id,
      status: 'sent',
      usage: {
        dailySent: user.messagesSentToday,
        dailyLimit: user.dailyMessageLimit,
        monthlySent: user.messagesSentThisMonth,
        monthlyLimit: user.monthlyMessageLimit
      }
    });
  } catch (error) {
    console.error('❌ [Scalor] Send text error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /send/media — Send an image/media
// ═══════════════════════════════════════════════
router.post('/send/media', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, number, mediaUrl, caption, fileName } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !number || !mediaUrl) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName, number and mediaUrl are required' });
    }

    const instance = await validateInstanceAndQuota(user, instanceName, res);
    if (!instance) return;

    const result = await scalorEvolutionService.sendMedia(instance.instanceName, instance.instanceToken, number, mediaUrl, caption, fileName);

    await ScalorMessageLog.create({
      userId: user._id,
      instanceId: instance._id,
      instanceName: instance.instanceName,
      phoneNumber: number,
      messageType: 'media',
      contentPreview: caption?.substring(0, 200) || `[Media: ${fileName || 'image'}]`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.data?.key?.id,
      errorMessage: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
      requestIp: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    await incrementUsage(user, instance);

    res.json({ success: true, messageId: result.data?.key?.id, status: 'sent' });
  } catch (error) {
    console.error('❌ [Scalor] Send media error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /send/audio — Send a voice message
// ═══════════════════════════════════════════════
router.post('/send/audio', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, number, audioUrl } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !number || !audioUrl) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName, number and audioUrl are required' });
    }

    const instance = await validateInstanceAndQuota(user, instanceName, res);
    if (!instance) return;

    const result = await scalorEvolutionService.sendAudio(instance.instanceName, instance.instanceToken, number, audioUrl);

    await ScalorMessageLog.create({
      userId: user._id,
      instanceId: instance._id,
      instanceName: instance.instanceName,
      phoneNumber: number,
      messageType: 'audio',
      contentPreview: '[Audio message]',
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.data?.key?.id,
      errorMessage: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
      requestIp: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    await incrementUsage(user, instance);

    res.json({ success: true, messageId: result.data?.key?.id, status: 'sent' });
  } catch (error) {
    console.error('❌ [Scalor] Send audio error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /send/video — Send a video message
// ═══════════════════════════════════════════════
router.post('/send/video', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, number, videoUrl, caption, fileName } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !number || !videoUrl) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName, number and videoUrl are required' });
    }

    const instance = await validateInstanceAndQuota(user, instanceName, res);
    if (!instance) return;

    const result = await scalorEvolutionService.sendVideo(instance.instanceName, instance.instanceToken, number, videoUrl, caption, fileName);

    await ScalorMessageLog.create({
      userId: user._id,
      instanceId: instance._id,
      instanceName: instance.instanceName,
      phoneNumber: number,
      messageType: 'video',
      contentPreview: caption?.substring(0, 200) || '[Video message]',
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.data?.key?.id,
      errorMessage: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
      requestIp: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    await incrementUsage(user, instance);

    res.json({ success: true, messageId: result.data?.key?.id, status: 'sent' });
  } catch (error) {
    console.error('❌ [Scalor] Send video error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /send/document — Send a document
// ═══════════════════════════════════════════════
router.post('/send/document', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, number, documentUrl, fileName } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !number || !documentUrl) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName, number and documentUrl are required' });
    }

    const instance = await validateInstanceAndQuota(user, instanceName, res);
    if (!instance) return;

    const result = await scalorEvolutionService.sendDocument(instance.instanceName, instance.instanceToken, number, documentUrl, fileName);

    await ScalorMessageLog.create({
      userId: user._id,
      instanceId: instance._id,
      instanceName: instance.instanceName,
      phoneNumber: number,
      messageType: 'document',
      contentPreview: `[Document: ${fileName || 'file'}]`,
      status: result.success ? 'sent' : 'failed',
      whatsappMessageId: result.data?.key?.id,
      errorMessage: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
      requestIp: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    await incrementUsage(user, instance);

    res.json({ success: true, messageId: result.data?.key?.id, status: 'sent' });
  } catch (error) {
    console.error('❌ [Scalor] Send document error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /send/bulk — Send bulk text messages
// ═══════════════════════════════════════════════
router.post('/send/bulk', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceName, messages } = req.body;
    const user = req.scalorUser;

    if (!instanceName || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName and messages[] array are required' });
    }

    // Limit bulk size
    if (messages.length > 100) {
      return res.status(400).json({ error: 'bulk_too_large', message: 'Maximum 100 messages per bulk request' });
    }

    const instance = await ScalorInstance.findOne({ instanceName, userId: user._id, isActive: true });
    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }
    if (instance.status !== 'connected') {
      return res.status(400).json({ error: 'instance_not_connected' });
    }

    // Check if user has enough quota for the whole batch
    user.checkAndResetCounters();
    const remainingDaily = user.dailyMessageLimit === -1 ? Infinity : user.dailyMessageLimit - user.messagesSentToday;
    const remainingMonthly = user.monthlyMessageLimit === -1 ? Infinity : user.monthlyMessageLimit - user.messagesSentThisMonth;
    const maxSendable = Math.min(remainingDaily, remainingMonthly, messages.length);

    if (maxSendable <= 0) {
      return res.status(429).json({ error: 'quota_exceeded', message: 'Message limit reached' });
    }

    const results = [];
    let successCount = 0;

    for (let i = 0; i < maxSendable; i++) {
      const { number, message } = messages[i];
      if (!number || !message) {
        results.push({ number, status: 'skipped', error: 'missing number or message' });
        continue;
      }

      const result = await scalorEvolutionService.sendText(instance.instanceName, instance.instanceToken, number, message);

      await ScalorMessageLog.create({
        userId: user._id,
        instanceId: instance._id,
        instanceName: instance.instanceName,
        phoneNumber: number,
        messageType: 'text',
        contentPreview: message.substring(0, 200),
        status: result.success ? 'sent' : 'failed',
        whatsappMessageId: result.data?.key?.id,
        errorMessage: result.error,
        apiKeyPrefix: req.scalorApiKey?.keyPrefix || 'dashboard_jwt',
        requestIp: req.ip
      });

      if (result.success) {
        successCount++;
        results.push({ number, status: 'sent', messageId: result.data?.key?.id });
      } else {
        results.push({ number, status: 'failed', error: result.error });
      }

      // Small delay between messages to avoid rate limiting
      if (i < maxSendable - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // Update counters
    user.messagesSentToday += successCount;
    user.messagesSentThisMonth += successCount;
    await user.save();

    instance.messagesSentToday += successCount;
    instance.messagesSentThisMonth += successCount;
    await instance.save();

    res.json({
      success: true,
      total: messages.length,
      sent: successCount,
      failed: maxSendable - successCount,
      skipped: messages.length - maxSendable,
      results
    });
  } catch (error) {
    console.error('❌ [Scalor] Bulk send error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// POST /check-number — Check if number is on WhatsApp
// ═══════════════════════════════════════════════
router.post('/check-number', scalorRequirePermission('message:read'), async (req, res) => {
  try {
    const { instanceName, numbers } = req.body;

    if (!instanceName || !numbers) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceName and numbers are required' });
    }

    const instance = await ScalorInstance.findOne({
      instanceName,
      userId: req.scalorUser._id,
      isActive: true
    });

    if (!instance) {
      return res.status(404).json({ error: 'instance_not_found' });
    }

    const result = await scalorEvolutionService.checkNumber(instance.instanceName, instance.instanceToken, numbers);

    if (!result.success) {
      return res.status(502).json({ error: 'check_failed', message: result.error });
    }

    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

// ═══════════════════════════════════════════════
// GET /logs — Fetch message logs
// ═══════════════════════════════════════════════
router.get('/logs', scalorRequirePermission('message:read'), async (req, res) => {
  try {
    const { instanceName, status, limit = 50, page = 1 } = req.query;
    const filter = { userId: req.scalorUser._id };
    if (instanceName) filter.instanceName = instanceName;
    if (status) filter.status = status;

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      ScalorMessageLog.find(filter)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(Math.min(100, parseInt(limit)))
        .select('-__v'),
      ScalorMessageLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
