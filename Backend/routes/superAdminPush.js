import express from 'express';
import { requireEcomAuth, requireSuperAdmin } from '../middleware/ecomAuth.js';
import PushScheduledNotification from '../models/PushScheduledNotification.js';
import PushAutomation from '../models/PushAutomation.js';
import PushTemplate from '../models/PushTemplate.js';
import Subscription from '../models/Subscription.js';
import EcomUser from '../models/EcomUser.js';
import { sendToScope, ensureDefaultAutomations, scheduleAutomations } from '../services/pushSchedulerService.js';
import { sendPushNotification } from '../services/pushService.js';

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

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES DE PUSH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ecom/super-admin/push/templates
 * Liste tous les templates de push
 */
router.get('/templates', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { scope, category, isActive = true } = req.query;
    const filter = {};

    if (scope) filter.scope = scope;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const templates = await PushTemplate.find(filter)
      .sort({ usageCount: -1, createdAt: -1 })
      .populate('createdBy', 'email name')
      .lean();

    // Organiser par catégorie
    const byCategory = {};
    templates.forEach(t => {
      if (!byCategory[t.category]) byCategory[t.category] = [];
      byCategory[t.category].push(t);
    });

    res.json({
      success: true,
      data: {
        templates,
        byCategory,
        total: templates.length
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/super-admin/push/templates
 * Créer un nouveau template de push
 */
router.post('/templates', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      scope = 'global',
      workspaceId,
      title,
      body,
      url,
      icon,
      badge,
      tag,
      actions,
      data,
      options,
      category = 'general'
    } = req.body;

    if (!name || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'name, title et body sont requis'
      });
    }

    const template = await PushTemplate.create({
      name,
      description,
      scope,
      workspaceId: scope === 'workspace' ? workspaceId : null,
      title,
      body,
      url,
      icon,
      badge,
      tag,
      actions,
      data,
      options,
      category,
      createdBy: req.ecomUser._id
    });

    res.json({
      success: true,
      data: { template },
      message: 'Template créé avec succès'
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * PUT /api/ecom/super-admin/push/templates/:id
 * Mettre à jour un template
 */
router.put('/templates/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Empêcher la modification du créateur
    delete updates.createdBy;

    const template = await PushTemplate.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template non trouvé'
      });
    }

    res.json({
      success: true,
      data: { template },
      message: 'Template mis à jour'
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * DELETE /api/ecom/super-admin/push/templates/:id
 * Supprimer un template
 */
router.delete('/templates/:id', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await PushTemplate.findByIdAndDelete(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Template supprimé'
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/super-admin/push/templates/:id/use
 * Utiliser un template pour envoyer immédiatement
 */
router.post('/templates/:id/use', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { scope, workspaceId, personalization = {} } = req.body;

    const template = await PushTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template non trouvé'
      });
    }

    // Personnalisation des variables dans le titre et body
    let title = template.title;
    let body = template.body;

    Object.keys(personalization).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, personalization[key]);
      body = body.replace(regex, personalization[key]);
    });

    const payload = {
      title,
      body,
      icon: template.icon || '/icons/icon-192x192.png',
      badge: template.badge || '/icons/icon-72x72.png',
      tag: template.tag || 'template',
      url: template.url || '',
      actions: template.actions || [],
      data: {
        ...template.data,
        type: 'template_push',
        templateId: template._id.toString(),
        url: template.url || ''
      },
      requireInteraction: template.options?.requireInteraction || false,
      silent: template.options?.silent || false
    };

    const result = await sendToScope({ scope, workspaceId, payload });

    // Incrémenter le compteur d'utilisation
    await PushTemplate.updateOne(
      { _id: template._id },
      { $inc: { usageCount: 1 } }
    );

    res.json({
      success: true,
      data: result,
      message: `Push envoyé avec le template "${template.name}"`
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/super-admin/push/templates/:id/schedule
 * Utiliser un template pour planifier un envoi
 */
router.post('/templates/:id/schedule', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { scope, workspaceId, sendAt, personalization = {} } = req.body;

    const template = await PushTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template non trouvé'
      });
    }

    if (!sendAt) {
      return res.status(400).json({
        success: false,
        message: 'sendAt (date d\'envoi) est requis'
      });
    }

    const sendAtDate = new Date(sendAt);
    if (Number.isNaN(sendAtDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'sendAt invalide'
      });
    }

    // Personnalisation des variables
    let title = template.title;
    let body = template.body;

    Object.keys(personalization).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(regex, personalization[key]);
      body = body.replace(regex, personalization[key]);
    });

    const scheduled = await PushScheduledNotification.create({
      scope,
      workspaceId: scope === 'workspace' ? workspaceId : null,
      title,
      body,
      url: template.url || '',
      tag: template.tag || 'template-scheduled',
      icon: template.icon || '/icons/icon-192x192.png',
      badge: template.badge || '/icons/icon-72x72.png',
      sendAt: sendAtDate,
      status: 'scheduled',
      createdBy: req.ecomUser._id,
      // Stocker les infos du template pour référence
      templateId: template._id,
      templateName: template.name
    });

    res.json({
      success: true,
      data: { scheduled },
      message: `Push planifié avec le template "${template.name}" pour ${sendAtDate.toLocaleString()}`
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ENVOI PERSONNALISÉ DIRECT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/ecom/super-admin/push/send-advanced
 * Envoi personnalisé avancé avec toutes les options
 */
router.post('/send-advanced', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      scope,
      workspaceId,
      title,
      body,
      url,
      icon,
      badge,
      tag,
      actions,
      data,
      requireInteraction,
      silent,
      renotify,
      targetUsers // Array de userIds pour envoi ciblé
    } = req.body;

    if (!scope || !['global', 'workspace', 'users'].includes(scope)) {
      return res.status(400).json({
        success: false,
        message: 'scope invalide (global, workspace, users)'
      });
    }

    if (scope === 'workspace' && !workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'workspaceId requis pour scope=workspace'
      });
    }

    if (scope === 'users' && (!targetUsers || !Array.isArray(targetUsers))) {
      return res.status(400).json({
        success: false,
        message: 'targetUsers (array) requis pour scope=users'
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'title et body sont requis'
      });
    }

    const payload = {
      title,
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-72x72.png',
      tag: tag || 'custom-push',
      data: {
        ...data,
        url: url || '',
        type: 'advanced_push'
      },
      actions: actions || [],
      requireInteraction: requireInteraction || false,
      silent: silent || false,
      renotify: renotify || false
    };

    let result;

    if (scope === 'users') {
      // Envoi ciblé à des utilisateurs spécifiques
      const results = [];
      for (const userId of targetUsers) {
        const userResult = await sendPushNotificationToUser(userId, payload);
        results.push({ userId, ...userResult });
      }

      const successful = results.filter(r => r.success).length;
      result = {
        success: successful > 0,
        total: targetUsers.length,
        successful,
        failed: targetUsers.length - successful,
        details: results
      };
    } else {
      // Envoi global ou par workspace
      result = await sendToScope({ scope, workspaceId, payload });
    }

    res.json({
      success: true,
      data: result,
      message: `Push personnalisé envoyé: ${result.successful || 0} succès, ${result.failed || 0} échecs`
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * POST /api/ecom/super-admin/push/preview
 * Prévisualiser un push avant envoi
 */
router.post('/preview', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const {
      title,
      body,
      icon,
      badge,
      actions,
      templateId
    } = req.body;

    let preview = {
      title: title || 'Titre de la notification',
      body: body || 'Contenu de la notification',
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-72x72.png',
      actions: actions || []
    };

    // Si un templateId est fourni, fusionner avec le template
    if (templateId) {
      const template = await PushTemplate.findById(templateId);
      if (template) {
        preview = {
          ...preview,
          title: title || template.title,
          body: body || template.body,
          icon: icon || template.icon,
          badge: badge || template.badge,
          actions: actions || template.actions
        };
      }
    }

    res.json({
      success: true,
      data: { preview }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

/**
 * GET /api/ecom/super-admin/push/subscriptions
 * Liste des subscriptions pour debug/statistiques
 */
router.get('/subscriptions', requireEcomAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { workspaceId, userId, limit = 50 } = req.query;
    const filter = {};

    if (workspaceId) filter.workspaceId = workspaceId;
    if (userId) filter.userId = userId;

    const subscriptions = await Subscription.find(filter)
      .limit(Math.min(parseInt(limit) || 50, 200))
      .populate('workspaceId', 'name slug')
      .populate('userId', 'email name')
      .lean();

    // Stats globales
    const stats = await Subscription.aggregate([
      {
        $group: {
          _id: '$workspaceId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        subscriptions,
        stats,
        total: subscriptions.length
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e?.message || 'Erreur serveur' });
  }
});

// Fonction helper pour envoyer à un utilisateur spécifique
async function sendPushNotificationToUser(userId, payload) {
  try {
    const subscriptions = await Subscription.find({ userId }).maxTimeMS(5000).catch(() => []);

    if (subscriptions.length === 0) {
      return { success: false, error: 'Aucun abonnement trouvé' };
    }

    const webpush = (await import('web-push')).default;

    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
              }
            },
            JSON.stringify(payload),
            { TTL: 86400, urgency: 'normal' }
          );
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          if (error.statusCode === 410) {
            await Subscription.findByIdAndDelete(subscription._id);
          }
          return { success: false, error: error.message, subscriptionId: subscription._id };
        }
      })
    );

    const successful = results.filter(r => r.value?.success).length;
    return {
      success: successful > 0,
      total: subscriptions.length,
      successful,
      failed: subscriptions.length - successful
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default router;
