import express from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import SupplierOrder from '../models/SupplierOrder.js';
import StockOrder from '../models/StockOrder.js';
import Product from '../models/Product.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { adjustProductStock, StockAdjustmentError } from '../services/stockService.js';
import { notifyStockReceived } from '../services/notificationHelper.js';

const router = express.Router();

// ==========================================
// FOURNISSEURS (SUPPLIERS)
// ==========================================

// Obtenir tous les fournisseurs avec stats de base
router.get('/suppliers', requireEcomAuth, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ 
      workspaceId: req.workspaceId,
      isActive: true
    }).sort({ createdAt: -1 });

    // Récupérer les stats pour chaque fournisseur
    const stats = await SupplierOrder.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) } },
      { $group: {
          _id: '$supplierId',
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$orderDate' }
      }}
    ]);

    const suppliersWithStats = suppliers.map(supplier => {
      const supplierStats = stats.find(s => s._id.toString() === supplier._id.toString()) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null
      };
      
      return {
        ...supplier.toObject(),
        stats: supplierStats
      };
    });

    res.json({ success: true, data: suppliersWithStats });
  } catch (error) {
    console.error('Erreur get suppliers:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Obtenir un fournisseur spécifique avec stats complètes
router.get('/suppliers/:id', requireEcomAuth, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    });
    
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }

    const stats = await SupplierOrder.aggregate([
      { $match: { 
          workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
          supplierId: new mongoose.Types.ObjectId(req.params.id)
      }},
      { $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$totalAmount' },
          lastOrderDate: { $max: '$orderDate' },
          avgOrderValue: { $avg: '$totalAmount' }
      }}
    ]);

    res.json({ 
      success: true, 
      data: {
        supplier,
        stats: stats[0] || { totalOrders: 0, totalSpent: 0, lastOrderDate: null, avgOrderValue: 0 }
      }
    });
  } catch (error) {
    console.error('Erreur get supplier detail:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer un fournisseur
router.post('/suppliers', requireEcomAuth, async (req, res) => {
  try {
    const supplier = new Supplier({
      ...req.body,
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id
    });
    
    await supplier.save();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    console.error('Erreur create supplier:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour un fournisseur
router.put('/suppliers/:id', requireEcomAuth, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      req.body,
      { new: true }
    );
    
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }
    
    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Erreur update supplier:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer un fournisseur (logique de suppression en cascade des commandes)
router.delete('/suppliers/:id', requireEcomAuth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const supplier = await Supplier.findOneAndDelete({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    }).session(session);
    
    if (!supplier) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }
    
    // Supprimer également toutes les commandes associées
    await SupplierOrder.deleteMany({
      supplierId: req.params.id,
      workspaceId: req.workspaceId
    }).session(session);
    
    await session.commitTransaction();
    session.endSession();
    
    res.json({ success: true, message: 'Fournisseur et commandes associées supprimés' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Erreur delete supplier:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==========================================
// COMMANDES FOURNISSEURS (STOCK ORDERS)
// Source de vérité: StockOrder (mêmes données que /api/ecom/stock/orders)
// Exposé aussi sous /api/ecom/sourcing/orders
// ==========================================

// GET /api/ecom/sourcing/orders - Liste des commandes de stock
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
    console.error('Erreur get sourcing stock orders:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/sourcing/orders/:id - Détail
router.get('/orders/:id', requireEcomAuth, async (req, res) => {
  try {
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('productId', 'name stock reorderThreshold')
      .populate('createdBy', 'email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande de stock non trouvée' });
    }

    res.json({
      success: true,
      data: {
        ...order.toObject(),
        isDelayed: order.isDelayed ? order.isDelayed() : false,
        delayDays: order.getDelayDays ? order.getDelayDays() : 0
      }
    });
  } catch (error) {
    console.error('Erreur get sourcing stock order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/sourcing/orders - Créer
router.post('/orders', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const {
      productName, productId, sourcing, quantity, weightKg, pricePerKg,
      purchasePrice, sellingPrice, transportCost,
      expectedArrival, supplierName, trackingNumber, notes
    } = req.body;

    let finalTransportCost = parseFloat(transportCost) || 0;
    if (sourcing === 'chine' && !transportCost && weightKg && pricePerKg) {
      finalTransportCost = parseFloat(weightKg) * parseFloat(pricePerKg);
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
      // Champs de paiement avec valeurs par défaut pour compatibilité
      paidPurchase: req.body.paidPurchase || false,
      paidTransport: req.body.paidTransport || false,
      paid: req.body.paid || false,
      createdBy: req.ecomUser._id
    };

    const order = new StockOrder(orderData);
    await order.save();

    const populatedOrder = await StockOrder.findById(order._id)
      .populate('productId', 'name')
      .populate('createdBy', 'email');

    res.status(201).json({ success: true, message: 'Commande de stock créée avec succès', data: populatedOrder });
  } catch (error) {
    console.error('Erreur create sourcing stock order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/sourcing/orders/:id - Modifier
router.put('/orders/:id', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande de stock non trouvée' });
    }

    const {
      productName, sourcing, quantity, weightKg, pricePerKg,
      purchasePrice, sellingPrice, transportCost,
      expectedArrival, supplierName, trackingNumber, notes
    } = req.body;

    let finalTransportCost;
    if (transportCost !== undefined) {
      finalTransportCost = parseFloat(transportCost) || 0;
    } else {
      finalTransportCost = order.transportCost || 0;
    }
    
    if (sourcing === 'chine' && transportCost === undefined && weightKg !== undefined && pricePerKg !== undefined) {
      finalTransportCost = parseFloat(weightKg) * parseFloat(pricePerKg);
    }

    Object.assign(order, {
      ...(productName !== undefined && { productName }),
      ...(sourcing !== undefined && { sourcing }),
      ...(quantity !== undefined && { quantity: parseInt(quantity) || order.quantity }),
      ...(weightKg !== undefined && { weightKg: parseFloat(weightKg) || order.weightKg }),
      ...(pricePerKg !== undefined && { pricePerKg: parseFloat(pricePerKg) || order.pricePerKg }),
      ...(purchasePrice !== undefined && { purchasePrice: parseFloat(purchasePrice) || order.purchasePrice }),
      ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) || order.sellingPrice }),
      transportCost: finalTransportCost,
      expectedArrival: expectedArrival ? new Date(expectedArrival) : order.expectedArrival,
      supplierName,
      trackingNumber,
      notes,
      // Champs de paiement avec valeurs par défaut pour compatibilité
      paidPurchase: req.body.paidPurchase !== undefined ? req.body.paidPurchase : (order.paidPurchase || false),
      paidTransport: req.body.paidTransport !== undefined ? req.body.paidTransport : (order.paidTransport || false),
      paid: req.body.paid !== undefined ? req.body.paid : (order.paid || false)
    });

    await order.save();

    const updatedOrder = await StockOrder.findById(order._id)
      .populate('productId', 'name')
      .populate('createdBy', 'email');

    res.json({ success: true, message: 'Commande de stock mise à jour avec succès', data: updatedOrder });
  } catch (error) {
    console.error('Erreur update sourcing stock order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/sourcing/orders/:id/receive - Reçue
router.put('/orders/:id/receive', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { actualArrival } = req.body;
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande de stock non trouvée' });
    }

    if (order.status !== 'in_transit') {
      return res.status(400).json({ success: false, message: 'Cette commande ne peut plus être marquée comme reçue' });
    }

    if (order.markAsReceived) {
      await order.markAsReceived(actualArrival ? new Date(actualArrival) : new Date());
    }
    // Fallback: ensure status is updated even if method doesn't work properly
    if (order.status !== 'received') {
      order.status = 'received';
      order.actualArrival = actualArrival ? new Date(actualArrival) : new Date();
      // Mettre automatiquement tous les paiements à payé quand on reçoit le produit
      order.paidPurchase = true;
      order.paidTransport = true;
      order.paid = true;
      await order.save();
    }

    let product = null;
    if (order.productId) {
      product = await Product.findOne({ _id: order.productId, workspaceId: req.workspaceId });
    }
    if (product) {
      await adjustProductStock({ workspaceId: req.workspaceId, productId: product._id, delta: order.quantity });
    }

    notifyStockReceived(req.workspaceId, { _id: order._id, quantity: order.quantity, productName: order.productName || product?.name }).catch(() => {});

    const updatedOrder = await StockOrder.findById(order._id)
      .populate('productId', 'name')
      .populate('createdBy', 'email');

    res.json({ success: true, message: 'Commande marquée comme reçue et stock mis à jour', data: updatedOrder });
  } catch (error) {
    console.error('Erreur receive sourcing stock order:', error);
    if (error instanceof StockAdjustmentError) {
      return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/sourcing/orders/:id/cancel - Annuler
router.put('/orders/:id/cancel', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande de stock non trouvée' });
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ success: true, message: 'Commande de stock annulée', data: order });
  } catch (error) {
    console.error('Erreur cancel sourcing stock order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/sourcing/orders/:id - Supprimer
router.delete('/orders/:id', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const order = await StockOrder.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande de stock non trouvée' });
    }

    await StockOrder.deleteOne({ _id: req.params.id, workspaceId: req.workspaceId });
    res.json({ success: true, message: 'Commande de stock supprimée avec succès' });
  } catch (error) {
    console.error('Erreur delete sourcing stock order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==========================================
// COMMANDES FOURNISSEURS (SUPPLIER ORDERS)
// ==========================================

// Obtenir toutes les commandes d'un fournisseur
router.get('/suppliers/:supplierId/orders', requireEcomAuth, async (req, res) => {
  try {
    const orders = await SupplierOrder.find({ 
      supplierId: req.params.supplierId,
      workspaceId: req.workspaceId 
    })
    .populate('products.productId', 'name')
    .sort({ orderDate: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Erreur get supplier orders:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Créer une commande fournisseur
router.post('/suppliers/:supplierId/orders', requireEcomAuth, async (req, res) => {
  try {
    // Vérifier d'abord que le fournisseur existe
    const supplierExists = await Supplier.exists({ 
      _id: req.params.supplierId, 
      workspaceId: req.workspaceId 
    });
    
    if (!supplierExists) {
      return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
    }

    const order = new SupplierOrder({
      ...req.body,
      supplierId: req.params.supplierId,
      workspaceId: req.workspaceId,
      createdBy: req.ecomUser._id
    });
    
    await order.save();
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Erreur create supplier order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Mettre à jour une commande
router.put('/suppliers/:supplierId/orders/:orderId', requireEcomAuth, async (req, res) => {
  try {
    const order = await SupplierOrder.findOneAndUpdate(
      { _id: req.params.orderId, supplierId: req.params.supplierId, workspaceId: req.workspaceId },
      req.body,
      { new: true }
    );
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Erreur update supplier order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Supprimer une commande
router.delete('/suppliers/:supplierId/orders/:orderId', requireEcomAuth, async (req, res) => {
  try {
    const order = await SupplierOrder.findOneAndDelete({ 
      _id: req.params.orderId,
      supplierId: req.params.supplierId,
      workspaceId: req.workspaceId 
    });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    
    res.json({ success: true, message: 'Commande supprimée' });
  } catch (error) {
    console.error('Erreur delete supplier order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
