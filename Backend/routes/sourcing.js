import express from 'express';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import SupplierOrder from '../models/SupplierOrder.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

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
router.put('/orders/:orderId', requireEcomAuth, async (req, res) => {
  try {
    const order = await SupplierOrder.findOneAndUpdate(
      { _id: req.params.orderId, workspaceId: req.workspaceId },
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
router.delete('/orders/:orderId', requireEcomAuth, async (req, res) => {
  try {
    const order = await SupplierOrder.findOneAndDelete({ 
      _id: req.params.orderId, 
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
