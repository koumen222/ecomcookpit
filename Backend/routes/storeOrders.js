import express from 'express';
import mongoose from 'mongoose';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
import Order from '../models/Order.js';
import { requireEcomAuth, requireWorkspace } from '../middleware/ecomAuth.js';

// Map StoreOrder statuses to main Order statuses
const STATUS_MAP = {
  pending: 'pending',
  confirmed: 'confirmed',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'annulé'
};

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
    // 🔒 SÉCURITÉ CRITIQUE : Vérification workspaceId
    if (!req.workspaceId) {
      console.error('🚨 SECURITY BREACH ATTEMPT: No workspaceId in request');
      return res.status(403).json({ success: false, message: 'Workspace non identifié' });
    }

    const { page = 1, limit = 20, status, search } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    // 🔒 ISOLATION : Filtrage strict par workspaceId
    const filter = { workspaceId: req.workspaceId };
    
    // Log de sécurité
    console.log(`🔒 [STORE-ORDERS] User ${req.ecomUser?.email} accessing orders for workspace ${req.workspaceId}`);
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

    // 🔒 VÉRIFICATION POST-REQUÊTE : S'assurer qu'aucune commande d'un autre workspace n'a été retournée
    const invalidOrders = orders.filter(o => String(o.workspaceId) !== String(req.workspaceId));
    if (invalidOrders.length > 0) {
      console.error('🚨 CRITICAL SECURITY ERROR: Cross-workspace data leak detected!');
      console.error('Expected workspace:', req.workspaceId);
      console.error('Invalid orders:', invalidOrders.map(o => ({ id: o._id, workspace: o.workspaceId })));
      return res.status(500).json({ success: false, message: 'Erreur de sécurité détectée' });
    }

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
    // 🔒 SÉCURITÉ : Vérification workspaceId
    if (!req.workspaceId) {
      console.error('🚨 SECURITY: No workspaceId in stats request');
      return res.status(403).json({ success: false, message: 'Workspace non identifié' });
    }

    console.log(`🔒 [STORE-STATS] User ${req.ecomUser?.email} accessing stats for workspace ${req.workspaceId}`);
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
 * POST /store-orders/bulk-delete
 * Delete multiple store orders
 */
router.post('/bulk-delete', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'IDs requis' });
    }
    // Récupérer les linkedOrderId avant suppression
    const storeOrders = await StoreOrder.find({ _id: { $in: ids }, workspaceId: req.workspaceId }).select('linkedOrderId').lean();
    const linkedIds = storeOrders.map(o => o.linkedOrderId).filter(Boolean);

    const result = await StoreOrder.deleteMany({
      _id: { $in: ids },
      workspaceId: req.workspaceId
    });

    // Cascade: supprimer les commandes globales liées
    if (linkedIds.length > 0) {
      Order.deleteMany({ _id: { $in: linkedIds } }).catch(err => console.warn('⚠️ Cascade bulk delete Orders failed:', err.message));
    }

    res.json({ success: true, message: `${result.deletedCount} commande(s) supprimée(s)` });
  } catch (error) {
    console.error('Erreur POST /store-orders/bulk-delete:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /store-orders/bulk-status
 * Update status of multiple store orders
 */
router.put('/bulk-status', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ success: false, message: 'IDs et statut requis' });
    }
    const result = await StoreOrder.updateMany(
      { _id: { $in: ids }, workspaceId: req.workspaceId },
      { $set: { status } }
    );

    // Sync status vers les Orders liées
    const storeOrders = await StoreOrder.find({ _id: { $in: ids }, workspaceId: req.workspaceId }).select('linkedOrderId').lean();
    const linkedIds = storeOrders.map(o => o.linkedOrderId).filter(Boolean);
    if (linkedIds.length > 0) {
      const mainStatus = STATUS_MAP[status] || status;
      Order.updateMany({ _id: { $in: linkedIds } }, { $set: { status: mainStatus, updatedAt: new Date() } }).catch(err => console.warn('⚠️ Bulk sync Order status failed:', err.message));
    }

    res.json({ success: true, message: `${result.modifiedCount} commande(s) mise(s) à jour` });
  } catch (error) {
    console.error('Erreur PUT /store-orders/bulk-status:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * GET /store-orders/:id
 * Get single order detail (dashboard).
 */
router.get('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    // 🔒 SÉCURITÉ CRITIQUE : Vérifications
    if (!req.workspaceId) {
      console.error('🚨 SECURITY: No workspaceId in order detail request');
      return res.status(403).json({ success: false, message: 'Workspace non identifié' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID invalide' });
    }

    console.log(`🔒 [STORE-ORDER-DETAIL] User ${req.ecomUser?.email} accessing order ${req.params.id} for workspace ${req.workspaceId}`);

    // 🔒 ISOLATION STRICTE : TOUJOURS filtrer par workspaceId
    const order = await StoreOrder.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId
    }).lean();

    // 🔒 VÉRIFICATION DOUBLE : S'assurer que la commande appartient bien au workspace
    if (order && String(order.workspaceId) !== String(req.workspaceId)) {
      console.error(`🚨 SECURITY BREACH: Order ${req.params.id} does not belong to workspace ${req.workspaceId}`);
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

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
    // 🔒 SÉCURITÉ CRITIQUE
    if (!req.workspaceId) {
      console.error('🚨 SECURITY: No workspaceId in status update request');
      return res.status(403).json({ success: false, message: 'Workspace non identifié' });
    }

    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Valeurs acceptées: ${validStatuses.join(', ')}`
      });
    }

    console.log(`🔒 [STORE-ORDER-UPDATE] User ${req.ecomUser?.email} updating order ${req.params.id} status to ${status} for workspace ${req.workspaceId}`);

    // 🔒 ISOLATION STRICTE : TOUJOURS filtrer par workspaceId
    const order = await StoreOrder.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: { status } },
      { new: true, lean: true }
    );

    // 🔒 VÉRIFICATION : La commande existe ET appartient au workspace
    if (order && String(order.workspaceId) !== String(req.workspaceId)) {
      console.error(`🚨 SECURITY BREACH: Attempted to update order ${req.params.id} from different workspace`);
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

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

    // Sync status to linked main system order
    if (order.linkedOrderId) {
      try {
        await Order.findByIdAndUpdate(
          order.linkedOrderId,
          { $set: { status: STATUS_MAP[status] || status, updatedAt: new Date() } }
        );
      } catch (syncErr) {
        console.error('⚠️ Could not sync status to main order:', syncErr.message);
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

/**
 * DELETE /store-orders/:id
 * Delete a store order
 */
router.delete('/:id', requireEcomAuth, requireWorkspace, async (req, res) => {
  try {
    const order = await StoreOrder.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.workspaceId
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }
    // Cascade: supprimer la commande globale liée
    if (order.linkedOrderId) {
      Order.findByIdAndDelete(order.linkedOrderId).catch(err => console.warn('⚠️ Cascade delete Order failed:', err.message));
    }
    res.json({ success: true, message: 'Commande supprimée' });
  } catch (error) {
    console.error('Erreur DELETE /store-orders/:id:', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
