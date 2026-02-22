import express from 'express';
import Notification from '../models/Notification.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// GET /api/ecom/notifications — List notifications for current user's workspace
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { page = 1, limit = 30, unreadOnly = false } = req.query;
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace non trouvé' });
    }

    const query = {
      workspaceId,
      $or: [
        { userId: null },
        { userId: req.ecomUser._id }
      ]
    };

    if (unreadOnly === 'true') {
      query.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ ...query, read: false })
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/notifications/unread-count — Quick unread count
router.get('/unread-count', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      return res.json({ success: true, data: { count: 0 } });
    }

    const count = await Notification.countDocuments({
      workspaceId,
      read: false,
      $or: [
        { userId: null },
        { userId: req.ecomUser._id }
      ]
    });

    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/notifications/read-all — Mark all as read (MUST be before /:id routes)
router.put('/read-all', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;

    const result = await Notification.updateMany(
      {
        workspaceId,
        read: false,
        $or: [
          { userId: null },
          { userId: req.ecomUser._id }
        ]
      },
      { read: true, readAt: new Date() }
    );

    res.json({ success: true, data: { updated: result.modifiedCount } });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/notifications/:id/read — Mark one notification as read
router.put('/:id/read', requireEcomAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        workspaceId: req.workspaceId
      },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification non trouvée' });
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/notifications/:id — Delete one notification
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification non trouvée' });
    }

    res.json({ success: true, message: 'Notification supprimée' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
