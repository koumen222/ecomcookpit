import express from 'express';
import Decision from '../models/Decision.js';
import Product from '../models/Product.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { validateDecision } from '../middleware/validation.js';
import { checkBusinessRules } from '../services/businessRules.js';

const router = express.Router();

// GET /api/ecom/decisions - Liste des décisions
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { productId, decisionType, status, priority, assignedTo, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };
    
    if (productId) filter.productId = productId;
    if (decisionType) filter.decisionType = decisionType;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const decisions = await Decision.find(filter)
      .populate('productId', 'name status')
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Decision.countDocuments(filter);

    res.json({
      success: true,
      data: {
        decisions: decisions.map(decision => ({
          ...decision.toObject(),
          isOverdue: decision.isOverdue(),
          overdueDays: decision.getOverdueDays()
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur get decisions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/ecom/decisions/:id - Détail d'une décision
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const decision = await Decision.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('productId', 'name status sellingPrice stock')
      .populate('assignedTo', 'email')
      .populate('createdBy', 'email');

    if (!decision) {
      return res.status(404).json({
        success: false,
        message: 'Décision non trouvée'
      });
    }

    res.json({
      success: true,
      data: {
        ...decision.toObject(),
        isOverdue: decision.isOverdue(),
        overdueDays: decision.getOverdueDays()
      }
    });
  } catch (error) {
    console.error('Erreur get decision:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/decisions - Créer une décision (admin uniquement)
router.post('/', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  validateDecision, 
  async (req, res) => {
    try {
      const { productId, decisionType, reason, priority, assignedTo } = req.body;

      // Vérifier que le produit existe dans le workspace
      const product = await Product.findOne({ _id: productId, workspaceId: req.workspaceId });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      // Vérifier les règles métier selon le type de décision
      const businessCheck = await checkBusinessRules(decisionType, {
        user: req.ecomUser,
        product,
        decisionData: req.body
      });

      if (!businessCheck.allowed) {
        return res.status(400).json({
          success: false,
          message: businessCheck.message
        });
      }

      const decisionData = {
        workspaceId: req.workspaceId,
        productId,
        decisionType,
        reason,
        priority: priority || 'medium',
        assignedTo,
        createdBy: req.ecomUser._id
      };

      const decision = new Decision(decisionData);
      await decision.save();

      // Si décision de réapprovisionnement, créer automatiquement une commande de stock
      if (decisionType === 'reorder' && businessCheck.stockOrderData) {
        const StockOrder = require('../models/StockOrder.js').default;
        const stockOrder = new StockOrder({
          ...businessCheck.stockOrderData,
          createdBy: req.ecomUser._id
        });
        await stockOrder.save();
      }

      const populatedDecision = await Decision.findById(decision._id)
        .populate('productId', 'name')
        .populate('assignedTo', 'email')
        .populate('createdBy', 'email');

      res.status(201).json({
        success: true,
        message: 'Décision créée avec succès',
        data: populatedDecision
      });
    } catch (error) {
      console.error('Erreur create decision:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/decisions/:id/assign - Assigner une décision
router.put('/:id/assign', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const { assignedTo } = req.body;
      
      const decision = await Decision.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!decision) {
        return res.status(404).json({
          success: false,
          message: 'Décision non trouvée'
        });
      }

      if (decision.status === 'completed' || decision.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'assigner une décision terminée ou annulée'
        });
      }

      await decision.assignTo(assignedTo);

      const updatedDecision = await Decision.findById(decision._id)
        .populate('productId', 'name')
        .populate('assignedTo', 'email')
        .populate('createdBy', 'email');

      res.json({
        success: true,
        message: 'Décision assignée avec succès',
        data: updatedDecision
      });
    } catch (error) {
      console.error('Erreur assign decision:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/decisions/:id/complete - Marquer une décision comme complétée
router.put('/:id/complete', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const { followUpResult } = req.body;
      
      const decision = await Decision.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!decision) {
        return res.status(404).json({
          success: false,
          message: 'Décision non trouvée'
        });
      }

      await decision.markAsCompleted(followUpResult);

      // Si décision de scale, mettre à jour le statut du produit
      if (decision.decisionType === 'scale') {
        const product = await Product.findById(decision.productId);
        if (product) {
          product.status = 'winner';
          await product.save();
        }
      }

      // Si décision de stop, mettre à jour le statut du produit
      if (decision.decisionType === 'stop') {
        const product = await Product.findById(decision.productId);
        if (product) {
          product.status = 'stop';
          product.isActive = false;
          await product.save();
        }
      }

      const updatedDecision = await Decision.findById(decision._id)
        .populate('productId', 'name status')
        .populate('assignedTo', 'email')
        .populate('createdBy', 'email');

      res.json({
        success: true,
        message: 'Décision marquée comme complétée',
        data: updatedDecision
      });
    } catch (error) {
      console.error('Erreur complete decision:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/decisions/:id/cancel - Annuler une décision
router.put('/:id/cancel', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const decision = await Decision.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!decision) {
        return res.status(404).json({
          success: false,
          message: 'Décision non trouvée'
        });
      }

      if (decision.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'annuler une décision déjà complétée'
        });
      }

      decision.status = 'cancelled';
      await decision.save();

      res.json({
        success: true,
        message: 'Décision annulée',
        data: decision
      });
    } catch (error) {
      console.error('Erreur cancel decision:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/decisions/dashboard - Tableau de bord des décisions
router.get('/dashboard/overview', 
  requireEcomAuth, 
  validateEcomAccess('products', 'read'),
  async (req, res) => {
    try {
      const mongoose = (await import('mongoose')).default;
      const wsId = new mongoose.Types.ObjectId(req.workspaceId);
      const stats = await Decision.aggregate([
        { $match: { workspaceId: wsId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const overdueStats = await Decision.aggregate([
        {
          $match: {
            workspaceId: wsId,
            status: { $in: ['pending', 'in_progress'] }
          }
        },
        {
          $addFields: {
            isOverdue: {
              $cond: [
                {
                  $or: [
                    { $and: [{ $eq: ['$priority', 'urgent'] }, { $lt: [new Date(), { $add: ['$date', 24 * 60 * 60 * 1000] }] }] },
                    { $and: [{ $eq: ['$priority', 'high'] }, { $lt: [new Date(), { $add: ['$date', 3 * 24 * 60 * 60 * 1000] }] }] },
                    { $and: [{ $eq: ['$priority', 'medium'] }, { $lt: [new Date(), { $add: ['$date', 7 * 24 * 60 * 60 * 1000] }] }] },
                    { $and: [{ $eq: ['$priority', 'low'] }, { $lt: [new Date(), { $add: ['$date', 14 * 24 * 60 * 60 * 1000] }] }] }
                  ]
                },
                true,
                false
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalOverdue: { $sum: { $cond: ['$isOverdue', 1, 0] } },
            totalActive: { $sum: 1 }
          }
        }
      ]);

      const recentDecisions = await Decision.find({ workspaceId: req.workspaceId, status: { $in: ['pending', 'in_progress'] } })
        .populate('productId', 'name')
        .populate('assignedTo', 'email')
        .sort({ priority: -1, date: 1 })
        .limit(10);

      const dashboardData = {
        byStatus: stats,
        overdue: overdueStats[0] || { totalOverdue: 0, totalActive: 0 },
        recentDecisions: recentDecisions.map(decision => ({
          ...decision.toObject(),
          isOverdue: decision.isOverdue(),
          overdueDays: decision.getOverdueDays()
        }))
      };

      res.json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      console.error('Erreur decisions dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

export default router;
