import express from 'express';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import UserNotificationPreferences from '../models/UserNotificationPreferences.js';
import NotificationLog from '../models/NotificationLog.js';

const router = express.Router();

const PREF_FIELDS = [
  'authEmails', 'securityEmails', 'financeEmails',
  'teamEmails', 'productEmails', 'businessEmails',
  'weeklyDigest', 'monthlyDigest'
];

// GET /api/ecom/notification-preferences - Lire les préférences
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    let prefs = await UserNotificationPreferences.findOne({ userId: req.ecomUser._id }).lean();

    if (!prefs) {
      // Créer les prefs par défaut (tout activé)
      prefs = await UserNotificationPreferences.create({ userId: req.ecomUser._id });
    }

    res.json({ success: true, data: prefs });
  } catch (error) {
    console.error('Erreur get notification prefs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/notification-preferences - Mettre à jour les préférences
router.put('/', requireEcomAuth, async (req, res) => {
  try {
    const update = {};
    for (const field of PREF_FIELDS) {
      if (field === 'securityEmails') continue; // Non modifiable
      if (req.body[field] !== undefined) {
        update[field] = Boolean(req.body[field]);
      }
    }

    const prefs = await UserNotificationPreferences.findOneAndUpdate(
      { userId: req.ecomUser._id },
      { $set: update },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: prefs, message: 'Préférences mises à jour' });
  } catch (error) {
    console.error('Erreur update notification prefs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/notification-preferences/logs - Historique des notifications envoyées
router.get('/logs', requireEcomAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, eventType } = req.query;
    const filter = { userId: req.ecomUser._id };

    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;

    const [logs, total] = await Promise.all([
      NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      NotificationLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Erreur get notification logs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/notification-preferences/workspace-logs - Logs du workspace (admin)
router.get('/workspace-logs', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const { page = 1, limit = 50, status, eventType, channel } = req.query;
    const filter = { workspaceId: req.workspaceId };

    if (status) filter.status = status;
    if (eventType) filter.eventType = eventType;
    if (channel) filter.channel = channel;

    const [logs, total] = await Promise.all([
      NotificationLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean(),
      NotificationLog.countDocuments(filter)
    ]);

    // Stats rapides
    const stats = await NotificationLog.aggregate([
      { $match: { workspaceId: req.workspaceId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        logs,
        stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Erreur get workspace notification logs:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
