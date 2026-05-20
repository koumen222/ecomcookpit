import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockLocation from '../models/StockLocation.js';
import { requireEcomAuth, requireEcomPermission, validateEcomAccess } from '../middleware/ecomAuth.js';
import { validateProduct } from '../middleware/validation.js';
import { checkBusinessRules } from '../services/businessRules.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';

const router = express.Router();

// Helper function to calculate actual stock from StockLocation
const calculateActualStock = async (productId) => {
  const stockLocations = await StockLocation.find({ productId });
  const actualStock = stockLocations.reduce((acc, stockLocation) => acc + stockLocation.quantity, 0);
  return actualStock;
};

// GET /api/ecom/products/search - Recherche de produits (authentifié, workspace-scoped)
router.get('/search', requireEcomAuth, async (req, res) => {
  try {
    const { search, status, isActive, limit = 20 } = req.query;

    const filter = { workspaceId: req.workspaceId, isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const products = await Product.find(filter)
      .select('name status sellingPrice productCost deliveryCost avgAdsCost stock isActive createdAt')
      .limit(Math.min(parseInt(limit), 100))
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: products, count: products.length, search: search || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/products - Liste des produits (tous roles peuvent voir)
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { status, isActive, search, limit = 200 } = req.query;
    const filter = { workspaceId: req.workspaceId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const products = await Product.find(filter)
      .select('-__v')
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 500))
      .lean();

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Erreur get products:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/products/search - Recherche publique de produits (sans authentification)
router.get('/search', async (req, res) => {
  try {
    const { search, status, isActive, limit = 20 } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const products = await Product.find(filter)
      .select('name status sellingPrice productCost deliveryCost avgAdsCost stock isActive createdAt')
      .limit(Math.min(parseInt(limit), 100))
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: products, count: products.length, search: search || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/products/stats - Statistiques produits (admin et compta)
router.get('/stats/overview', 
  requireEcomAuth, 
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const workspaceId = req.workspaceId;
      const mongoose = (await import('mongoose')).default;
      const stats = await Product.aggregate([
        {
          $match: { isActive: true, workspaceId: new mongoose.Types.ObjectId(workspaceId) }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalStock: { $sum: '$stock' },
            avgMargin: { $avg: { $subtract: ['$sellingPrice', '$productCost', '$deliveryCost', '$avgAdsCost'] } },
            totalValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } }
          }
        }
      ]);

      const lowStockProducts = await Product.find({
        workspaceId,
        isActive: true,
        $expr: { $lte: ['$stock', '$reorderThreshold'] }
      }).select('name stock reorderThreshold').lean();

      res.json({
        success: true,
        data: {
          byStatus: stats,
          lowStockAlerts: lowStockProducts,
          totalActiveProducts: await Product.countDocuments({ workspaceId, isActive: true })
        }
      });
    } catch (error) {
      console.error('Erreur products stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/products/quick - Liste rapide des produits (pour ProgressiveListTemplate)
router.get('/quick', requireEcomAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const products = await Product.find({ workspaceId: req.workspaceId, isActive: true })
      .select('name sellingPrice stock isActive')
      .limit(Math.min(parseInt(limit), 100))
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/products/whatsapp-groups - Lister les groupes WhatsApp de l'instance connectée
router.get('/whatsapp-groups', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      workspaceId: req.workspaceId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).sort({ lastSeen: -1 }).lean();

    if (!instance) return res.json({ success: true, groups: [], connected: false });

    const result = await evolutionApiService.listGroups(instance.instanceName, instance.instanceToken);
    const groups = (result.groups || []).map(g => ({
      jid: g.id,
      name: g.subject || g.name || g.id,
      size: g.size,
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, groups, connected: true });
  } catch (error) {
    console.error('Erreur whatsapp-groups:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/products/:id - Détail d'un produit
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'ID de produit invalide' });
    }

    if (!req.workspaceId) {
      return res.status(400).json({ success: false, message: 'workspaceId manquant' });
    }

    const product = await Product.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('createdBy', 'email').lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('❌ Erreur get product:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// POST /api/ecom/products - Créer un produit (admin uniquement)
router.post('/', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  validateProduct, 
  async (req, res) => {
    try {
      const productData = { ...req.body, workspaceId: req.workspaceId, createdBy: req.ecomUser._id };

      const businessCheck = await checkBusinessRules('createProduct', { user: req.ecomUser, productData });
      if (!businessCheck.allowed) {
        return res.status(400).json({ success: false, message: businessCheck.message });
      }

      const product = new Product(productData);
      await product.save();

      const populatedProduct = await Product.findById(product._id)
        .populate('createdBy', 'email');

      res.status(201).json({
        success: true,
        message: 'Produit créé avec succès',
        data: populatedProduct
      });
    } catch (error) {
      console.error('Erreur create product:', error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Un produit avec ce nom existe déjà'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/products/:id - Modifier un produit (admin uniquement)
router.put('/:id', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  validateProduct, 
  async (req, res) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Vérifier les règles métier
      const businessCheck = await checkBusinessRules('updateProduct', {
        user: req.ecomUser,
        product,
        updateData: req.body
      });

      if (!businessCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: businessCheck.message
        });
      }

      const oldStock = product.stock;
      Object.assign(product, req.body);
      await product.save();

      const updatedProduct = await Product.findById(product._id)
        .populate('createdBy', 'email');

      // 📱 Push notification pour changement de stock
      if (req.body.stock !== undefined && req.body.stock !== oldStock) {
        try {
          const { sendPushNotification } = await import('../services/pushService.js');
          const stockDiff = req.body.stock - oldStock;
          const isLowStock = req.body.stock <= (product.reorderThreshold || 5);
          
          await sendPushNotification(req.workspaceId, {
            title: isLowStock ? '⚠️ Stock faible' : '📦 Stock mis à jour',
            body: `${product.name}: ${oldStock} → ${req.body.stock} (${stockDiff > 0 ? '+' : ''}${stockDiff})`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: isLowStock ? 'low-stock' : 'stock-update',
            data: {
              type: isLowStock ? 'low_stock' : 'stock_update',
              productId: product._id.toString(),
              oldStock,
              newStock: req.body.stock,
              url: `/products/${product._id}`
            }
          }, isLowStock ? 'push_low_stock' : 'push_stock_updates');
        } catch (e) {
          console.warn('⚠️ Push notification failed:', e.message);
        }
      }

      res.json({
        success: true,
        message: 'Produit mis à jour avec succès',
        data: updatedProduct
      });
    } catch (error) {
      console.error('Erreur update product:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/products/:id/whatsapp-groups - Lister les groupes WhatsApp disponibles
router.get('/:id/whatsapp-groups', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      workspaceId: req.workspaceId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).sort({ lastSeen: -1 }).lean();

    if (!instance) {
      return res.json({ success: true, groups: [], connected: false });
    }

    const result = await evolutionApiService.listGroups(instance.instanceName, instance.instanceToken);
    const groups = (result.groups || []).map(g => ({
      jid: g.id,
      name: g.subject || g.name || g.id,
      size: g.size,
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, groups, connected: true });
  } catch (error) {
    console.error('Erreur whatsapp-groups:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/products/:id/whatsapp-group - Assigner/retirer un groupe WhatsApp
router.patch('/:id/whatsapp-group', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { groupJid, groupName } = req.body;
    const product = await Product.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!product) return res.status(404).json({ success: false, message: 'Produit non trouvé' });

    product.whatsappGroupJid = groupJid || null;
    product.whatsappGroupName = groupName || null;
    await product.save();

    res.json({ success: true, data: { whatsappGroupJid: product.whatsappGroupJid, whatsappGroupName: product.whatsappGroupName } });
  } catch (error) {
    console.error('Erreur patch whatsapp-group:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/products/:id - Supprimer un produit (admin uniquement)
router.delete('/:id', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const product = await Product.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      await Product.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Produit supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur delete product:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

export default router;
