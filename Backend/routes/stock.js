import express from 'express';
import StockOrder from '../models/StockOrder.js';
import Product from '../models/Product.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { validateStockOrder } from '../middleware/validation.js';
import { adjustProductStock, StockAdjustmentError } from '../services/stockService.js';
import { notifyStockReceived } from '../services/notificationHelper.js';
import { notifyStockLow, notifyStockOut } from '../core/notifications/notification.service.js';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';

const router = express.Router();

// GET /api/ecom/stock/orders - Liste des commandes de stock
router.get('/orders', requireEcomAuth, async (req, res) => {
  try {
    const { status, productId, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };
    
    if (status) filter.status = status;
    if (productId) filter.productId = productId;

    const orders = await StockOrder.find(filter)
      .populate('productId', 'name')
      .populate('createdBy', 'email')
      .sort({ orderDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StockOrder.countDocuments(filter);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur get stock orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/stock/orders/:id - Détail d'une commande de stock
router.get('/orders/:id', requireEcomAuth, async (req, res) => {
  try {
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('productId', 'name stock reorderThreshold')
      .populate('createdBy', 'email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande de stock non trouvée'
      });
    }

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        isDelayed: order.isDelayed(),
        delayDays: order.getDelayDays()
      }
    });
  } catch (error) {
    console.error('Erreur get stock order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/stock/orders - Créer une commande de stock (admin uniquement)
router.post('/orders', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  validateStockOrder, 
  async (req, res) => {
    try {
      const { 
        productName, productId, sourcing, quantity, weightKg, pricePerKg,
        purchasePrice, sellingPrice, transportCost,
        expectedArrival, supplierName, trackingNumber, notes 
      } = req.body;

      // Calculer le coût de transport si sourcing Chine et non fourni
      let finalTransportCost = parseFloat(transportCost) || 0;
      if (sourcing === 'chine' && !transportCost && weightKg && pricePerKg) {
        finalTransportCost = weightKg * pricePerKg;
      }

      const orderData = {
        workspaceId: req.workspaceId,
        productName,
        productId: productId || undefined,
        sourcing,
        quantity: parseInt(quantity),
        weightKg: parseFloat(weightKg),
        pricePerKg: parseFloat(pricePerKg),
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        transportCost: finalTransportCost,
        expectedArrival: expectedArrival ? new Date(expectedArrival) : undefined,
        supplierName,
        trackingNumber,
        notes,
        createdBy: req.ecomUser._id
      };

      const order = new StockOrder(orderData);
      await order.save();

      const populatedOrder = await StockOrder.findById(order._id)
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      res.status(201).json({
        success: true,
        message: 'Commande de stock créée avec succès',
        data: populatedOrder
      });
    } catch (error) {
      console.error('Erreur create stock order:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/stock/orders/:id - Modifier une commande de stock
router.put('/orders/:id', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  validateStockOrder, 
  async (req, res) => {
    try {
      const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande de stock non trouvée'
        });
      }

      const {
        productName, sourcing, quantity, weightKg, pricePerKg,
        purchasePrice, sellingPrice, transportCost,
        expectedArrival, supplierName, trackingNumber, notes
      } = req.body;

      let finalTransportCost = parseFloat(transportCost) || 0;
      if (sourcing === 'chine' && !transportCost && weightKg && pricePerKg) {
        finalTransportCost = weightKg * pricePerKg;
      }

      Object.assign(order, {
        productName,
        sourcing,
        quantity: parseInt(quantity),
        weightKg: parseFloat(weightKg),
        pricePerKg: parseFloat(pricePerKg),
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        transportCost: finalTransportCost,
        expectedArrival: expectedArrival ? new Date(expectedArrival) : order.expectedArrival,
        supplierName,
        trackingNumber,
        notes
      });

      await order.save();

      const updatedOrder = await StockOrder.findById(order._id)
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      res.json({
        success: true,
        message: 'Commande de stock mise à jour avec succès',
        data: updatedOrder
      });
    } catch (error) {
      console.error('Erreur update stock order:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/stock/orders/:id/receive - Marquer une commande comme reçue
router.put('/orders/:id/receive', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const { actualArrival } = req.body;
      
      const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande de stock non trouvée'
        });
      }

      if (order.status !== 'in_transit') {
        return res.status(400).json({
          success: false,
          message: 'Cette commande ne peut plus être marquée comme reçue'
        });
      }

      // Marquer comme reçu
      await order.markAsReceived(actualArrival ? new Date(actualArrival) : new Date());

      // Mettre à jour le stock du produit
      let product = null;
      if (order.productId) {
        product = await Product.findOne({ _id: order.productId, workspaceId: req.workspaceId });
      }
      if (!product && order.productName) {
        product = await Product.findOne({
          workspaceId: req.workspaceId,
          name: { $regex: new RegExp(`^${order.productName}$`, 'i') }
        });
        if (product) {
          order.productId = product._id;
          await order.save();
        }
      }
      if (product) {
        await adjustProductStock({
          workspaceId: req.workspaceId,
          productId: product._id,
          delta: order.quantity
        });
      }

      // Notification interne
      notifyStockReceived(req.workspaceId, { _id: order._id, quantity: order.quantity, productName: order.productName || product?.name }).catch(() => {});

      // Alertes stock email (non bloquantes)
      if (product) {
        const freshProduct = await Product.findById(product._id).lean();
        if (freshProduct) {
          _checkStockAlerts(freshProduct, req.workspaceId).catch(() => {});
        }
      }

      const updatedOrder = await StockOrder.findById(order._id)
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      res.json({
        success: true,
        message: 'Commande marquée comme reçue et stock mis à jour',
        data: updatedOrder
      });
    } catch (error) {
      console.error('Erreur receive stock order:', error);
      if (error instanceof StockAdjustmentError) {
        return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
      }
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/stock/orders/:id/cancel - Annuler une commande de stock
router.put('/orders/:id/cancel', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Commande de stock non trouvée'
        });
      }

      if (order.status === 'received') {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'annuler une commande déjà reçue'
        });
      }

      order.status = 'cancelled';
      await order.save();

      res.json({
        success: true,
        message: 'Commande de stock annulée',
        data: order
      });
    } catch (error) {
      console.error('Erreur cancel stock order:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/stock/alerts - Alertes de stock bas
router.get('/alerts', 
  requireEcomAuth, 
  validateEcomAccess('products', 'read'),
  async (req, res) => {
    try {
      const lowStockProducts = await Product.find({
        workspaceId: req.workspaceId,
        isActive: true,
        $expr: { $lte: ['$stock', '$reorderThreshold'] }
      })
      .populate('createdBy', 'email')
      .sort({ stock: 1 });

      // Commandes en transit en retard
      const delayedOrders = await StockOrder.find({
        workspaceId: req.workspaceId,
        status: 'in_transit',
        expectedArrival: { $lt: new Date() }
      })
      .populate('productId', 'name')
      .populate('createdBy', 'email')
      .sort({ expectedArrival: 1 });

      // Commandes arrivant bientôt (prochaines 48h)
      const upcomingOrders = await StockOrder.find({
        workspaceId: req.workspaceId,
        status: 'in_transit',
        expectedArrival: { 
          $gte: new Date(),
          $lte: new Date(Date.now() + 48 * 60 * 60 * 1000)
        }
      })
      .populate('productId', 'name')
      .populate('createdBy', 'email')
      .sort({ expectedArrival: 1 });

      res.json({
        success: true,
        data: {
          lowStockProducts: lowStockProducts.map(p => ({
            ...p.toObject(),
            urgency: p.stock === 0 ? 'critical' : p.stock <= p.reorderThreshold / 2 ? 'high' : 'medium'
          })),
          delayedOrders: delayedOrders.map(order => ({
            ...order.toObject(),
            delayDays: order.getDelayDays()
          })),
          upcomingOrders,
          summary: {
            lowStockCount: lowStockProducts.length,
            delayedOrdersCount: delayedOrders.length,
            upcomingOrdersCount: upcomingOrders.length
          }
        }
      });
    } catch (error) {
      console.error('Erreur stock alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/stock/overview - Vue d'ensemble du stock
router.get('/overview', 
  requireEcomAuth, 
  validateEcomAccess('products', 'read'),
  async (req, res) => {
    try {
      const mongoose = (await import('mongoose')).default;
      const stockOverview = await Product.aggregate([
        { $match: { isActive: true, workspaceId: new mongoose.Types.ObjectId(req.workspaceId) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalStock: { $sum: '$stock' },
            totalStockValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
            lowStockCount: {
              $sum: {
                $cond: [{ $lte: ['$stock', '$reorderThreshold'] }, 1, 0]
              }
            },
            outOfStockCount: {
              $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] }
            }
          }
        }
      ]);

      const ordersInTransit = await StockOrder.aggregate([
        { $match: { status: 'in_transit', workspaceId: new mongoose.Types.ObjectId(req.workspaceId) } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            totalValue: { $sum: '$totalCost' }
          }
        }
      ]);

      const overview = {
        ...stockOverview[0],
        ordersInTransit: ordersInTransit[0] || { totalOrders: 0, totalQuantity: 0, totalValue: 0 }
      };

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('Erreur stock overview:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// ─── Helper notifications stock ───────────────────────────────────────────────

async function _checkStockAlerts(product, workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId).lean();
    const admin = await EcomUser.findOne({ workspaceId, role: 'ecom_admin', isActive: true }).lean();
    if (!admin) return;

    if (product.stock === 0) {
      notifyStockOut(admin.email, { product, workspace, userId: admin._id }).catch(() => {});
    } else if (product.stock <= (product.reorderThreshold || 5)) {
      notifyStockLow(admin.email, { product, workspace, userId: admin._id }).catch(() => {});
    }
  } catch (err) {
    console.warn('[stock] _checkStockAlerts:', err.message);
  }
}

export default router;
