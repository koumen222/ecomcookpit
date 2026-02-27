import express from 'express';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import PushScheduledNotification from '../models/PushScheduledNotification.js';
import PushAutomation from '../models/PushAutomation.js';
import Subscription from '../models/Subscription.js';
import { sendToScope, ensureDefaultAutomations, scheduleAutomations } from '../services/pushSchedulerService.js';

const router = express.Router();

router.get('/stats', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const [scheduledStats, automationsTotal, automationsEnabled, subscriptionsTotal, workspaceCount] = await Promise.all([
      PushScheduledNotification.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: { $ifNull: ['$stats.total', 0] } },
            successful: { $sum: { $ifNull: ['$stats.successful', 0] } },
            failed: { $sum: { $ifNull: ['$stats.failed', 0] } }
          }
        }
      ]),
      PushAutomation.countDocuments({}),
      PushAutomation.countDocuments({ enabled: true }),
      Subscription.countDocuments({}),
      Subscription.distinct('workspaceId').then((ids) => ids.length)
    ]);

    const byStatus = {
      scheduled: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      canceled: 0
    };

    const deliveries = {
      total: 0,
      successful: 0,
      failed: 0
    };

    let totalScheduled = 0;
    for (const row of scheduledStats) {
      byStatus[row._id] = row.count || 0;
      totalScheduled += row.count || 0;
      deliveries.total += row.total || 0;
      deliveries.successful += row.successful || 0;
      deliveries.failed += row.failed || 0;
    }

    res.json({
      success: true,
      data: {
        scheduled: {
          total: totalScheduled,
          byStatus
        },
        deliveries,
        automations: {
          total: automationsTotal,
          enabled: automationsEnabled
        },
        subscriptions: {
          total: subscriptionsTotal,
          workspaces: workspaceCount
        }
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.post('/send', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { scope, workspaceId, title, body, url } = req.body;

    if (!scope || !['global', 'workspace'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'scope invalide' });
    }
    if (scope === 'workspace' && !workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title et body requis' });
    }

    const payload = {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'super-admin',
      data: {
        url: url || '',
        type: 'super_admin_broadcast'
      }
    };

    const result = await sendToScope({ scope, workspaceId, payload });

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.post('/schedule', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { scope, workspaceId, title, body, url, sendAt } = req.body;

    if (!scope || !['global', 'workspace'].includes(scope)) {
      return res.status(400).json({ success: false, message: 'scope invalide' });
    }
    if (scope === 'workspace' && !workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId requis' });
    }
    if (!title || !body || !sendAt) {
      return res.status(400).json({ success: false, message: 'title, body et sendAt requis' });
    }

    const sendAtDate = new Date(sendAt);
    if (Number.isNaN(sendAtDate.getTime())) {
      return res.status(400).json({ success: false, message: 'sendAt invalide' });
    }

    const doc = await PushScheduledNotification.create({
      scope,
      workspaceId: scope === 'workspace' ? workspaceId : null,
      title,
      body,
      url: url || '',
      tag: 'super-admin-scheduled',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      sendAt: sendAtDate,
      status: 'scheduled',
      createdBy: req.ecomUser._id
    });

    res.json({ success: true, data: { scheduled: doc } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.get('/scheduled', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { status, scope, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (scope) filter.scope = scope;

    const rows = await PushScheduledNotification.find(filter)
      .sort({ sendAt: -1 })
      .limit(Math.min(parseInt(limit) || 50, 200))
      .lean();

    res.json({ success: true, data: { scheduled: rows } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.put('/scheduled/:id/cancel', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await PushScheduledNotification.findOneAndUpdate(
      { _id: id, status: 'scheduled' },
      { $set: { status: 'canceled' } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification introuvable ou déjà traitée' });
    }

    res.json({ success: true, data: { scheduled: updated } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.get('/automations', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const rows = await PushAutomation.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { automations: rows } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.post('/automations/bootstrap', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    await ensureDefaultAutomations(req.ecomUser._id);
    await scheduleAutomations();
    const rows = await PushAutomation.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { automations: rows } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

router.put('/automations/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const updated = await PushAutomation.findByIdAndUpdate(
      id,
      { $set: { enabled: !!enabled } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Automation introuvable' });
    }

    await scheduleAutomations();

    res.json({ success: true, data: { automation: updated } });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

export default router;
