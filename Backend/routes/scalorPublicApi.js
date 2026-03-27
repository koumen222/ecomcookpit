import { Router } from 'express';
import { scalorAuth, scalorRequirePermission, scalorRateLimit } from '../middleware/scalorAuth.js';
import ScalorInstance from '../models/ScalorInstance.js';
import ScalorUser from '../models/ScalorUser.js';
import ScalorApiKey from '../models/ScalorApiKey.js';
import ScalorMessageLog from '../models/ScalorMessageLog.js';
import scalorEvolutionService from '../services/scalorEvolutionService.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Scalor Public API — /api/v1
 * 
 * Clean, versioned REST API for external clients.
 * Clients authenticate with API keys: Authorization: Bearer sk_live_xxx
 * Evolution API details are completely hidden.
 * ═══════════════════════════════════════════════════════════════════
 */
const router = Router();

// ─── All routes require API key auth + rate limiting ────────────
router.use(scalorAuth, scalorRateLimit);

// ─── Helper: find instance owned by user (by ID or instanceName) ──
async function findUserInstance(user, idOrName, res) {
  const query = { userId: user._id, isActive: true };
  if (idOrName.match(/^[0-9a-fA-F]{24}$/)) {
    query._id = idOrName;
  } else {
    query.instanceName = idOrName;
  }
  const instance = await ScalorInstance.findOne(query);
  if (!instance) {
    res.status(404).json({ error: 'instance_not_found', message: 'Instance not found or access denied' });
    return null;
  }
  return instance;
}

// ─── Helper: check message quotas and reset counters ──────────
async function checkQuota(user, instance, res) {
  user.checkAndResetCounters();

  if (user.dailyMessageLimit !== -1 && user.messagesSentToday >= user.dailyMessageLimit) {
    res.status(429).json({
      error: 'daily_limit_exceeded',
      message: `Daily limit reached (${user.dailyMessageLimit}). Resets at midnight.`,
      limit: user.dailyMessageLimit, used: user.messagesSentToday
    });
    return false;
  }
  if (user.monthlyMessageLimit !== -1 && user.messagesSentThisMonth >= user.monthlyMessageLimit) {
    res.status(429).json({
      error: 'monthly_limit_exceeded',
      message: `Monthly limit reached (${user.monthlyMessageLimit}). Upgrade your plan.`,
      limit: user.monthlyMessageLimit, used: user.messagesSentThisMonth
    });
    return false;
  }
  if (instance && instance.status !== 'connected') {
    res.status(400).json({ error: 'instance_not_connected', message: `Instance status: ${instance.status}` });
    return false;
  }
  return true;
}

// ─── Helper: increment counters after send ────────────────────
async function incrementCounters(user, instance) {
  user.messagesSentToday += 1;
  user.messagesSentThisMonth += 1;
  await user.save();
  instance.messagesSentToday += 1;
  instance.messagesSentThisMonth += 1;
  await instance.save();
}

// ─── Helper: log a sent message ───────────────────────────────
async function logMessage(user, instance, { phoneNumber, messageType, contentPreview, status, messageId, error: errorMsg, apiKeyPrefix, ip }) {
  return ScalorMessageLog.create({
    userId: user._id,
    instanceId: instance._id,
    instanceName: instance.instanceName,
    phoneNumber,
    messageType,
    contentPreview: (contentPreview || '').substring(0, 200),
    status,
    whatsappMessageId: messageId,
    errorMessage: errorMsg,
    apiKeyPrefix: apiKeyPrefix || 'unknown',
    requestIp: ip
  });
}

// ═══════════════════════════════════════════════════════════════
// ACCOUNT
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/account — View current account & usage
 */
router.get('/account', async (req, res) => {
  const user = req.scalorUser;
  user.checkAndResetCounters();

  const instanceCount = await ScalorInstance.countDocuments({ userId: user._id, isActive: true });

  res.json({
    success: true,
    account: {
      id: user._id,
      email: user.email,
      name: user.name,
      company: user.company,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    },
    usage: {
      instances: { current: instanceCount, max: user.maxInstances },
      messages: {
        today: { sent: user.messagesSentToday, limit: user.dailyMessageLimit },
        month: { sent: user.messagesSentThisMonth, limit: user.monthlyMessageLimit }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// INSTANCES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/instance/create — Create a WhatsApp instance
 */
router.post('/instance/create', scalorRequirePermission('instance:create'), async (req, res) => {
  try {
    const { name, displayName } = req.body;
    const instanceDisplayName = name || displayName;
    const user = req.scalorUser;

    if (!instanceDisplayName || typeof instanceDisplayName !== 'string' || instanceDisplayName.trim().length < 2) {
      return res.status(400).json({ error: 'invalid_name', message: 'Instance name must be at least 2 characters' });
    }

    const safeName = instanceDisplayName.trim().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);

    // Check instance limit
    const currentCount = await ScalorInstance.countDocuments({ userId: user._id, isActive: true });
    if (user.maxInstances !== -1 && currentCount >= user.maxInstances) {
      return res.status(403).json({
        error: 'instance_limit_reached',
        message: `Plan ${user.plan}: max ${user.maxInstances} instance(s). Upgrade to create more.`,
        current: currentCount, max: user.maxInstances
      });
    }

    const instanceName = `scalor_${user._id}_${safeName}`;
    const existing = await ScalorInstance.findOne({ instanceName });
    if (existing) {
      return res.status(409).json({ error: 'instance_exists', message: 'An instance with this name already exists' });
    }

    // Create on Evolution API (hidden from client)
    const result = await scalorEvolutionService.createInstance(instanceName);
    if (!result.success) {
      return res.status(502).json({ error: 'creation_failed', message: 'Failed to create instance. Try again.' });
    }

    const instanceToken = result.data?.hash || result.data?.instance?.apikey || result.data?.apikey || '';

    const instance = await ScalorInstance.create({
      userId: user._id, instanceName, displayName: safeName,
      instanceToken, status: 'awaiting_qr'
    });

    // Auto-configure webhook relay
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
        status: instance.status,
        createdAt: instance.createdAt
      }
    });
  } catch (error) {
    console.error('❌ [Scalor v1] Create instance error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /api/v1/instance — List all instances
 */
router.get('/instance', scalorRequirePermission('instance:read'), async (req, res) => {
  const instances = await ScalorInstance.find({ userId: req.scalorUser._id, isActive: true })
    .select('displayName instanceName status phoneNumber messagesSentToday messagesSentThisMonth webhookUrl createdAt');

  res.json({
    success: true,
    instances: instances.map(i => ({
      id: i._id,
      name: i.displayName,
      instanceName: i.instanceName,
      status: i.status,
      phone: i.phoneNumber || null,
      webhook: i.webhookUrl || null,
      messages: { today: i.messagesSentToday, month: i.messagesSentThisMonth },
      createdAt: i.createdAt
    }))
  });
});

/**
 * GET /api/v1/instance/:id — Get instance details (with live status)
 */
router.get('/instance/:id', scalorRequirePermission('instance:read'), async (req, res) => {
  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;

  const statusResult = await scalorEvolutionService.getConnectionState(instance.instanceName, instance.instanceToken);

  res.json({
    success: true,
    instance: {
      id: instance._id,
      name: instance.displayName,
      instanceName: instance.instanceName,
      status: instance.status,
      phone: instance.phoneNumber || null,
      webhook: instance.webhookUrl || null,
      webhookEvents: instance.webhookEvents,
      messages: { today: instance.messagesSentToday, month: instance.messagesSentThisMonth },
      liveStatus: statusResult.success ? statusResult.data : null,
      createdAt: instance.createdAt
    }
  });
});

/**
 * GET /api/v1/instance/:id/qrcode — Get QR code for WhatsApp pairing
 */
router.get('/instance/:id/qrcode', scalorRequirePermission('instance:read'), async (req, res) => {
  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;
  const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());

  const result = await scalorEvolutionService.getQrCode(instance.instanceName, instance.instanceToken, forceRefresh);
  if (!result.success) {
    return res.status(502).json({ error: 'qr_failed', message: result.error });
  }

  res.json({ success: true, qrcode: result.qrcode, pairingCode: result.pairingCode });
});

/**
 * DELETE /api/v1/instance/:id — Delete an instance
 */
router.delete('/instance/:id', scalorRequirePermission('instance:create'), async (req, res) => {
  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;

  await scalorEvolutionService.deleteInstance(instance.instanceName);
  instance.isActive = false;
  instance.status = 'deleted';
  await instance.save();

  res.json({ success: true, message: 'Instance deleted' });
});

/**
 * POST /api/v1/instance/:id/disconnect — Disconnect WhatsApp
 */
router.post('/instance/:id/disconnect', scalorRequirePermission('instance:create'), async (req, res) => {
  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;

  await scalorEvolutionService.logoutInstance(instance.instanceName, instance.instanceToken);
  instance.status = 'disconnected';
  await instance.save();

  res.json({ success: true, message: 'Instance disconnected' });
});

/**
 * POST /api/v1/instance/:id/restart — Restart instance
 */
router.post('/instance/:id/restart', scalorRequirePermission('instance:create'), async (req, res) => {
  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;

  const result = await scalorEvolutionService.restartInstance(instance.instanceName, instance.instanceToken);
  if (result.success) {
    instance.status = 'awaiting_qr';
    await instance.save();
  }

  res.json({ success: true, message: 'Instance restart requested' });
});

/**
 * PUT /api/v1/instance/:id/webhook — Set webhook URL
 */
router.put('/instance/:id/webhook', scalorRequirePermission('webhook:manage'), async (req, res) => {
  const { url, events } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'invalid_url', message: 'Webhook URL is required' });
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
  } catch {
    return res.status(400).json({ error: 'invalid_url', message: 'Must be a valid http/https URL' });
  }

  const instance = await findUserInstance(req.scalorUser, req.params.id, res);
  if (!instance) return;

  instance.webhookUrl = url;
  if (events && Array.isArray(events)) instance.webhookEvents = events;
  await instance.save();

  res.json({ success: true, webhookUrl: instance.webhookUrl, webhookEvents: instance.webhookEvents });
});

// ═══════════════════════════════════════════════════════════════
// MESSAGING
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/v1/message/send — Send a message (text, media, audio, video, document)
 * 
 * Body: { instanceId, number, text, mediaUrl, caption, fileName, type }
 * type defaults to "text" if only `text` is provided, "media" if `mediaUrl` is provided
 */
router.post('/message/send', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceId, instanceName: reqInstanceName, number, text, message, mediaUrl, audioUrl, videoUrl, documentUrl, caption, fileName } = req.body;
    const user = req.scalorUser;

    // Resolve instance by ID or name
    const resolveId = instanceId || reqInstanceName;
    if (!resolveId || !number) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceId and number are required' });
    }

    const instance = await findUserInstance(user, resolveId, res);
    if (!instance) return;

    const quotaOk = await checkQuota(user, instance, res);
    if (!quotaOk) return;

    let result;
    let msgType = 'text';
    let preview = '';

    if (documentUrl) {
      msgType = 'document';
      preview = `[Document: ${fileName || 'file'}]`;
      result = await scalorEvolutionService.sendDocument(instance.instanceName, instance.instanceToken, number, documentUrl, fileName);
    } else if (videoUrl) {
      msgType = 'video';
      preview = caption || '[Video]';
      result = await scalorEvolutionService.sendVideo(instance.instanceName, instance.instanceToken, number, videoUrl, caption, fileName);
    } else if (audioUrl) {
      msgType = 'audio';
      preview = '[Audio]';
      result = await scalorEvolutionService.sendAudio(instance.instanceName, instance.instanceToken, number, audioUrl);
    } else if (mediaUrl) {
      msgType = 'media';
      preview = caption || '[Media]';
      result = await scalorEvolutionService.sendMedia(instance.instanceName, instance.instanceToken, number, mediaUrl, caption, fileName);
    } else {
      const content = text || message;
      if (!content) {
        return res.status(400).json({ error: 'missing_content', message: 'Provide text, mediaUrl, audioUrl, videoUrl, or documentUrl' });
      }
      preview = content;
      result = await scalorEvolutionService.sendText(instance.instanceName, instance.instanceToken, number, content);
    }

    // Log
    await logMessage(user, instance, {
      phoneNumber: number, messageType: msgType, contentPreview: preview,
      status: result.success ? 'sent' : 'failed',
      messageId: result.data?.key?.id, error: result.error,
      apiKeyPrefix: req.scalorApiKey?.keyPrefix, ip: req.ip
    });

    if (!result.success) {
      return res.status(502).json({ error: 'send_failed', message: result.error });
    }

    await incrementCounters(user, instance);

    res.json({
      success: true,
      messageId: result.data?.key?.id,
      type: msgType,
      status: 'sent',
      usage: {
        today: user.messagesSentToday,
        dailyLimit: user.dailyMessageLimit,
        month: user.messagesSentThisMonth,
        monthlyLimit: user.monthlyMessageLimit
      }
    });
  } catch (error) {
    console.error('❌ [Scalor v1] Send error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/v1/message/send/bulk — Send bulk messages
 */
router.post('/message/send/bulk', scalorRequirePermission('message:send'), async (req, res) => {
  try {
    const { instanceId, instanceName: reqInstanceName, messages } = req.body;
    const user = req.scalorUser;

    const resolveId = instanceId || reqInstanceName;
    if (!resolveId || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'missing_fields', message: 'instanceId and messages[] are required' });
    }
    if (messages.length > 100) {
      return res.status(400).json({ error: 'bulk_too_large', message: 'Max 100 messages per request' });
    }

    const instance = await findUserInstance(user, resolveId, res);
    if (!instance) return;

    const quotaOk = await checkQuota(user, instance, res);
    if (!quotaOk) return;

    user.checkAndResetCounters();
    const remainingDaily = user.dailyMessageLimit === -1 ? Infinity : user.dailyMessageLimit - user.messagesSentToday;
    const remainingMonthly = user.monthlyMessageLimit === -1 ? Infinity : user.monthlyMessageLimit - user.messagesSentThisMonth;
    const maxSendable = Math.min(remainingDaily, remainingMonthly, messages.length);

    const results = [];
    let successCount = 0;

    for (let i = 0; i < maxSendable; i++) {
      const { number, text, message: msgText } = messages[i];
      const content = text || msgText;
      if (!number || !content) {
        results.push({ number, status: 'skipped', error: 'missing number or text' });
        continue;
      }

      const result = await scalorEvolutionService.sendText(instance.instanceName, instance.instanceToken, number, content);

      await logMessage(user, instance, {
        phoneNumber: number, messageType: 'text', contentPreview: content,
        status: result.success ? 'sent' : 'failed',
        messageId: result.data?.key?.id, error: result.error,
        apiKeyPrefix: req.scalorApiKey?.keyPrefix, ip: req.ip
      });

      if (result.success) {
        successCount++;
        results.push({ number, status: 'sent', messageId: result.data?.key?.id });
      } else {
        results.push({ number, status: 'failed', error: result.error });
      }

      if (i < maxSendable - 1) await new Promise(r => setTimeout(r, 1500));
    }

    user.messagesSentToday += successCount;
    user.messagesSentThisMonth += successCount;
    await user.save();
    instance.messagesSentToday += successCount;
    instance.messagesSentThisMonth += successCount;
    await instance.save();

    res.json({
      success: true,
      total: messages.length, sent: successCount,
      failed: maxSendable - successCount,
      skipped: messages.length - maxSendable,
      results
    });
  } catch (error) {
    console.error('❌ [Scalor v1] Bulk send error:', error);
    res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/v1/message/check-number — Verify WhatsApp number
 */
router.post('/message/check-number', scalorRequirePermission('message:read'), async (req, res) => {
  const { instanceId, instanceName: reqInstanceName, numbers } = req.body;
  const resolveId = instanceId || reqInstanceName;
  if (!resolveId || !numbers) {
    return res.status(400).json({ error: 'missing_fields', message: 'instanceId and numbers are required' });
  }

  const instance = await findUserInstance(req.scalorUser, resolveId, res);
  if (!instance) return;

  const result = await scalorEvolutionService.checkNumber(instance.instanceName, instance.instanceToken, numbers);
  if (!result.success) {
    return res.status(502).json({ error: 'check_failed', message: result.error });
  }

  res.json({ success: true, data: result.data });
});

/**
 * GET /api/v1/message/logs — Message history
 */
router.get('/message/logs', scalorRequirePermission('message:read'), async (req, res) => {
  const { instanceId, status, limit = 50, page = 1 } = req.query;
  const filter = { userId: req.scalorUser._id };
  if (instanceId) filter.instanceId = instanceId;
  if (status) filter.status = status;

  const parsedLimit = Math.min(100, parseInt(limit) || 50);
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const skip = (parsedPage - 1) * parsedLimit;

  const [logs, total] = await Promise.all([
    ScalorMessageLog.find(filter)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('instanceId', 'displayName')
      .select('-__v'),
    ScalorMessageLog.countDocuments(filter)
  ]);

  res.json({
    success: true,
    logs: logs.map(l => ({
      id: l._id,
      instance: l.instanceId?.displayName || l.instanceName,
      phone: l.phoneNumber,
      type: l.messageType,
      preview: l.contentPreview,
      status: l.status,
      messageId: l.whatsappMessageId,
      error: l.errorMessage || undefined,
      sentAt: l.sentAt
    })),
    pagination: { page: parsedPage, limit: parsedLimit, total, pages: Math.ceil(total / parsedLimit) }
  });
});

// ═══════════════════════════════════════════════════════════════
// USAGE STATS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/usage — Full usage statistics
 */
router.get('/usage', async (req, res) => {
  const user = req.scalorUser;
  user.checkAndResetCounters();

  const instanceCount = await ScalorInstance.countDocuments({ userId: user._id, isActive: true });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  const [totalMessages, failedMessages] = await Promise.all([
    ScalorMessageLog.countDocuments({ userId: user._id, sentAt: { $gte: thirtyDaysAgo } }),
    ScalorMessageLog.countDocuments({ userId: user._id, sentAt: { $gte: thirtyDaysAgo }, status: 'failed' })
  ]);

  res.json({
    success: true,
    plan: user.plan,
    usage: {
      instances: { current: instanceCount, max: user.maxInstances },
      daily: { sent: user.messagesSentToday, limit: user.dailyMessageLimit },
      monthly: { sent: user.messagesSentThisMonth, limit: user.monthlyMessageLimit }
    },
    stats: {
      last30Days: {
        total: totalMessages,
        failed: failedMessages,
        successRate: totalMessages > 0 ? `${((totalMessages - failedMessages) / totalMessages * 100).toFixed(1)}%` : 'N/A'
      }
    }
  });
});

export default router;
