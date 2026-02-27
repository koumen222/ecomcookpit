import express from 'express';
import mongoose from 'mongoose';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD ROUTES — Store order management (authenticated, workspace-scoped)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /store-orders
 * List store orders for current workspace (dashboard).
 * Supports pagination + status filter: ?page=1&limit=20&status=pending
 */
router.get('/', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const filter = { workspaceId: req.workspaceId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { orderNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      StoreOrder.findPaginated(filter, { page: pageNum, limit: limitNum }),
      StoreOrder.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-orders:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-orders/stats
 * Quick analytics for store dashboard.
 * Returns order counts and revenue grouped by status.
 */
router.get('/stats', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const stats = await StoreOrder.getQuickStats(req.workspaceId);

    // Also get product count for dashboard
    const productCount = await StoreProduct.countDocuments({
      workspaceId: req.workspaceId
    });
    const publishedProductCount = await StoreProduct.countDocuments({
      workspaceId: req.workspaceId,
      isPublished: true
    });

    const result = stats[0] || { byStatus: [], totalOrders: 0, totalRevenue: 0 };

    res.json({
      success: true,
      data: {
        ...result,
        productCount,
        publishedProductCount
      }
    });
  } catch (error) {
    console.error('Erreur GET /store-orders/stats:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-orders/:id
 * Get single order detail (dashboard).
 */
router.get('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    const order = await StoreOrder.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Erreur GET /store-orders/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-orders/:id/status
 * Update order status (dashboard).
 */
router.put('/:id/status', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}`
      });
    }

    const order = await StoreOrder.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: { status } },
      { new: true, lean: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    // If cancelled, restore stock
    if (status === 'cancelled') {
      const bulkOps = order.products.map(item => ({
        updateOne: {
          filter: { _id: item.productId, workspaceId: req.workspaceId },
          update: { $inc: { stock: item.quantity } }
        }
      }));
      if (bulkOps.length > 0) {
        await StoreProduct.bulkWrite(bulkOps);
      }
    }

    res.json({
      success: true,
      message: 'Statut mis à jour',
      data: order
    });
  } catch (error) {
    console.error('Erreur PUT /store-orders/:id/status:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
