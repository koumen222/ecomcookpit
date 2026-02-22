import express from 'express';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import DailyReport from '../models/DailyReport.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { validateDailyReport } from '../middleware/validation.js';
import { adjustProductStock, StockAdjustmentError } from '../services/stockService.js';
import { notifyReportCreated } from '../services/notificationHelper.js';

const router = express.Router();

function buildDateMatchFromQuery({ date, startDate, endDate }) {
  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    return { $gte: dayStart, $lte: dayEnd };
  }

  if (startDate || endDate) {
    const range = {};
    if (startDate) range.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    return range;
  }

  return null;
}

async function getGlobalOverview({ workspaceId, date, startDate, endDate }) {
  const dateMatch = buildDateMatchFromQuery({ date, startDate, endDate });

  const reportsFilter = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
  if (dateMatch) reportsFilter.date = dateMatch;

  const ordersMatchStage = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
  if (dateMatch) ordersMatchStage.date = dateMatch;

  const [orderStatusAgg, kpiAgg, productAgg, dailyAgg] = await Promise.all([
    Order.aggregate([
      { $match: ordersMatchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    DailyReport.aggregate([
      { $match: reportsFilter },
      {
        $lookup: {
          from: 'ecom_products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          totalProductCost: { $sum: { $multiply: ['$ordersDelivered', '$product.productCost'] } },
          totalDeliveryCost: { $sum: { $multiply: ['$ordersDelivered', '$product.deliveryCost'] } },
          totalAdSpend: { $sum: '$adSpend' },
          totalOrdersReceived: { $sum: '$ordersReceived' },
          totalOrdersDelivered: { $sum: '$ordersDelivered' },
          reportsCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          totalCost: { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] },
          totalProfit: {
            $subtract: [
              '$totalRevenue',
              { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] }
            ]
          },
          deliveryRate: {
            $cond: [
              { $eq: ['$totalOrdersReceived', 0] },
              0,
              { $divide: ['$totalOrdersDelivered', '$totalOrdersReceived'] }
            ]
          },
          roas: {
            $cond: [
              { $eq: ['$totalAdSpend', 0] },
              0,
              { $divide: ['$totalRevenue', '$totalAdSpend'] }
            ]
          }
        }
      }
    ]),
    DailyReport.aggregate([
      { $match: reportsFilter },
      {
        $lookup: {
          from: 'ecom_products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$productId',
          name: { $first: '$product.name' },
          ordersReceived: { $sum: '$ordersReceived' },
          ordersDelivered: { $sum: '$ordersDelivered' },
          adSpend: { $sum: '$adSpend' },
          revenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          productCost: { $sum: { $multiply: ['$ordersDelivered', '$product.productCost'] } },
          deliveryCost: { $sum: { $multiply: ['$ordersDelivered', '$product.deliveryCost'] } }
        }
      },
      {
        $addFields: {
          totalCost: { $add: ['$productCost', '$deliveryCost', '$adSpend'] },
          profit: { $subtract: ['$revenue', { $add: ['$productCost', '$deliveryCost', '$adSpend'] }] },
          deliveryRate: {
            $cond: [
              { $eq: ['$ordersReceived', 0] },
              0,
              { $divide: ['$ordersDelivered', '$ordersReceived'] }
            ]
          },
          roas: {
            $cond: [
              { $eq: ['$adSpend', 0] },
              0,
              { $divide: ['$revenue', '$adSpend'] }
            ]
          }
        }
      },
      { $sort: { profit: -1 } },
      { $limit: 10 }
    ]),
    DailyReport.aggregate([
      { $match: reportsFilter },
      {
        $lookup: {
          from: 'ecom_products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          ordersReceived: { $sum: '$ordersReceived' },
          ordersDelivered: { $sum: '$ordersDelivered' },
          adSpend: { $sum: '$adSpend' },
          revenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          productCost: { $sum: { $multiply: ['$ordersDelivered', '$product.productCost'] } },
          deliveryCost: { $sum: { $multiply: ['$ordersDelivered', '$product.deliveryCost'] } }
        }
      },
      {
        $addFields: {
          totalCost: { $add: ['$productCost', '$deliveryCost', '$adSpend'] },
          profit: { $subtract: ['$revenue', { $add: ['$productCost', '$deliveryCost', '$adSpend'] }] },
          roas: {
            $cond: [
              { $eq: ['$adSpend', 0] },
              0,
              { $divide: ['$revenue', '$adSpend'] }
            ]
          },
          deliveryRate: {
            $cond: [
              { $eq: ['$ordersReceived', 0] },
              0,
              { $divide: ['$ordersDelivered', '$ordersReceived'] }
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);

  const kpis = kpiAgg[0] || {
    totalRevenue: 0,
    totalProductCost: 0,
    totalDeliveryCost: 0,
    totalAdSpend: 0,
    totalCost: 0,
    totalProfit: 0,
    totalOrdersReceived: 0,
    totalOrdersDelivered: 0,
    deliveryRate: 0,
    roas: 0,
    reportsCount: 0
  };

  const orderStatus = (orderStatusAgg || []).map(s => ({ status: s._id, count: s.count }));

  return {
    kpis,
    orders: { byStatus: orderStatus },
    topProducts: productAgg || [],
    daily: dailyAgg || []
  };
}

// GET /api/ecom/reports - Liste des rapports quotidiens
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { productId, date, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };
    
    if (productId) filter.productId = productId;
    if (date) {
      // Filtre par date exacte (début et fin de la journée)
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      filter.date = { $gte: dayStart, $lte: dayEnd };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const reports = await DailyReport.find(filter)
      .populate('productId', 'name sellingPrice productCost deliveryCost')
      .populate('reportedBy', 'email')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DailyReport.countDocuments(filter);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur get reports:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});
router.get('/overview',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query;
      const overview = await getGlobalOverview({ workspaceId: req.workspaceId, date, startDate, endDate });
      res.json({ success: true, data: overview });
    } catch (error) {
      console.error('Erreur reports overview:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);
router.post('/analyze-global',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ success: false, message: 'OPENAI_API_KEY manquant' });
      }

      const { date, startDate, endDate } = req.body || {};
      const overview = await getGlobalOverview({ workspaceId: req.workspaceId, date, startDate, endDate });

      const payload = {
        kpis: overview.kpis,
        orders: overview.orders,
        topProducts: overview.topProducts,
        daily: (overview.daily || []).slice(-14)
      };

      const prompt = `Tu es un analyste e-commerce senior. Analyse les performances globales et propose des actions concrètes.

Données (JSON):\n${JSON.stringify(payload)}\n
Contraintes:
- Réponds en français
- Format: 1) Diagnostic global 2) Points forts 3) Points faibles 4) Top opportunités (3-5) 5) Plan d'action (5 actions max) 6) Alertes risques
- Réponse courte et actionnable (max ~350 mots)`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Tu analyses des KPI e-commerce et tu fournis une synthèse ultra actionnable.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 700
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({ success: false, message: errorData.error?.message || 'Erreur OpenAI' });
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content?.trim() || '';

      res.json({ success: true, data: { analysis, overview } });
    } catch (error) {
      console.error('Erreur analyze-global:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/reports/stats/financial - Statistiques financières (compta et admin)
router.get('/stats/financial', 
  requireEcomAuth, 
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const { startDate, endDate, productId } = req.query;
      const matchStage = { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) };
      
      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) matchStage.date.$lte = new Date(endDate);
      }
      if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);

      const financialStats = await DailyReport.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'ecom_products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] }
            },
            totalProductCost: {
              $sum: { $multiply: ['$ordersDelivered', '$product.productCost'] }
            },
            totalDeliveryCost: {
              $sum: { $multiply: ['$ordersDelivered', '$product.deliveryCost'] }
            },
            totalAdSpend: { $sum: '$adSpend' },
            totalOrdersReceived: { $sum: '$ordersReceived' },
            totalOrdersDelivered: { $sum: '$ordersDelivered' }
          }
        },
        {
          $addFields: {
            totalCost: { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] },
            totalProfit: { 
              $subtract: [
                '$totalRevenue', 
                { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] }
              ] 
            },
            profitabilityRate: {
              $cond: [
                { $eq: ['$totalRevenue', 0] },
                0,
                { $multiply: [
                  { $divide: [
                    { $subtract: ['$totalRevenue', { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] }] },
                    '$totalRevenue'
                  ]},
                  100
                ]}
              ]
            },
            deliveryRate: {
              $cond: [
                { $eq: ['$totalOrdersReceived', 0] },
                0,
                { $divide: ['$totalOrdersDelivered', '$totalOrdersReceived'] }
              ]
            },
            roas: {
              $cond: [
                { $eq: ['$totalAdSpend', 0] },
                0,
                { $divide: ['$totalRevenue', '$totalAdSpend'] }
              ]
            }
          }
        }
      ]);

      const stats = financialStats[0] || {
        totalRevenue: 0,
        totalProductCost: 0,
        totalDeliveryCost: 0,
        totalAdSpend: 0,
        totalCost: 0,
        totalProfit: 0,
        totalOrdersReceived: 0,
        totalOrdersDelivered: 0,
        profitabilityRate: 0,
        deliveryRate: 0,
        roas: 0
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Erreur financial stats:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// GET /api/ecom/reports/stats/financial/daily - Données financières quotidiennes pour le graphique
router.get('/stats/financial/daily',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const { days = 14 } = req.query;
      const daysCount = Math.min(parseInt(days) || 14, 90);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysCount);
      startDate.setHours(0, 0, 0, 0);

      const dailyStats = await DailyReport.aggregate([
        {
          $match: {
            workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
            date: { $gte: startDate }
          }
        },
        {
          $lookup: {
            from: 'ecom_products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            revenue: {
              $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] }
            },
            cost: {
              $sum: {
                $add: [
                  { $multiply: ['$ordersDelivered', '$product.productCost'] },
                  { $multiply: ['$ordersDelivered', '$product.deliveryCost'] },
                  '$adSpend'
                ]
              }
            },
            ordersDelivered: { $sum: '$ordersDelivered' },
            ordersReceived: { $sum: '$ordersReceived' }
          }
        },
        {
          $addFields: {
            profit: { $subtract: ['$revenue', '$cost'] }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Fill gaps with zero-days
      const result = [];
      const dataMap = new Map(dailyStats.map(d => [d._id, d]));
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const existing = dataMap.get(key);
        result.push({
          date: key,
          revenue: existing?.revenue || 0,
          profit: existing?.profit || 0,
          cost: existing?.cost || 0,
          ordersDelivered: existing?.ordersDelivered || 0,
          ordersReceived: existing?.ordersReceived || 0
        });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Erreur financial daily stats:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/reports/:id - Détail d'un rapport
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const report = await DailyReport.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('productId', 'name sellingPrice productCost deliveryCost avgAdsCost')
      .populate('reportedBy', 'email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }

    // Calculer les métriques
    const metrics = await report.calculateMetrics();

    res.json({
      success: true,
      data: {
        ...report.toObject(),
        metrics
      }
    });
  } catch (error) {
    console.error('Erreur get report:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// POST /api/ecom/reports - Créer un rapport quotidien
router.post('/', 
  requireEcomAuth, 
  validateEcomAccess('orders', 'write'),
  validateDailyReport, 
  async (req, res) => {
    try {
      console.log('📊 POST /api/ecom/reports - Création de rapport');
      console.log('👤 Utilisateur:', req.ecomUser?.email);
      console.log('📋 Corps de la requête:', req.body);
      
      const { date, productId, ordersReceived, ordersDelivered, adSpend, notes, deliveries } = req.body;

      // Vérifier que le produit existe dans le même workspace
      const product = await Product.findOne({ _id: productId, workspaceId: req.workspaceId });
      if (!product) {
        console.log('❌ Produit non trouvé:', productId);
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      console.log('✅ Produit trouvé:', product.name);
      console.log('💰 Prix vente:', product.sellingPrice, 'Coûts:', product.productCost, '+', product.deliveryCost);

      // Vérifier si un rapport existe déjà pour cette date et ce produit
      const existingReport = await DailyReport.findOne({
        workspaceId: req.workspaceId,
        date: new Date(date),
        productId
      });

      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'Un rapport existe déjà pour cette date et ce produit'
        });
      }

      const reportData = {
        workspaceId: req.workspaceId,
        date: new Date(date),
        productId,
        ordersReceived,
        ordersDelivered,
        adSpend,
        notes,
        reportedBy: req.ecomUser._id,
        deliveries: (deliveries || []).filter(d => 
          d.agencyName && d.agencyName.trim() !== '' && d.ordersDelivered > 0
        )
      };

      // Calculer le bénéfice (sans inclure avgAdsCost)
      const sellingPrice = product.sellingPrice || 0;
      const productCost = product.productCost || 0;
      const deliveryCost = product.deliveryCost || 0;
      const totalCost = productCost + deliveryCost;
      const unitBenefit = sellingPrice - totalCost;
      const totalBenefit = unitBenefit * ordersDelivered;
      
      reportData.unitBenefit = unitBenefit;
      reportData.totalBenefit = totalBenefit;
      
      console.log('💰 Bénéfice calculé - Unité:', unitBenefit, 'Total:', totalBenefit);

      const report = new DailyReport(reportData);
      await report.save();

      // Notification interne
      notifyReportCreated(req.workspaceId, report, req.ecomUser?.name || req.ecomUser?.email).catch(() => {});

      // Décrémenter le stock du produit selon les commandes livrées
      if (ordersDelivered > 0) {
        await adjustProductStock({
          workspaceId: req.workspaceId,
          productId,
          delta: -ordersDelivered
        });
        console.log(`📦 Stock décrémenté de ${ordersDelivered} pour ${product.name}`);
      }

      const populatedReport = await DailyReport.findById(report._id)
        .populate('productId', 'name sellingPrice')
        .populate('reportedBy', 'email');

      res.status(201).json({
        success: true,
        message: 'Rapport créé avec succès',
        data: populatedReport
      });
    } catch (error) {
      console.error('Erreur create report:', error);
      if (error instanceof StockAdjustmentError) {
        return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
      }
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Un rapport existe déjà pour cette date et ce produit'
        });
      }
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
);

// PUT /api/ecom/reports/:id - Modifier un rapport
router.put('/:id', 
  requireEcomAuth, 
  validateEcomAccess('orders', 'write'),
  validateDailyReport, 
  async (req, res) => {
    try {
      const report = await DailyReport.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Rapport non trouvé'
        });
      }

      // Vérifier que le produit existe si changement
      if (req.body.productId && req.body.productId !== report.productId.toString()) {
        const product = await Product.findById(req.body.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: 'Produit non trouvé'
          });
        }
      }

      const oldDelivered = report.ordersDelivered || 0;
      
      // Mise à jour explicite des champs, y compris deliveries
      if (req.body.date !== undefined) report.date = req.body.date;
      if (req.body.productId !== undefined) report.productId = req.body.productId;
      if (req.body.ordersReceived !== undefined) report.ordersReceived = req.body.ordersReceived;
      if (req.body.ordersDelivered !== undefined) report.ordersDelivered = req.body.ordersDelivered;
      if (req.body.adSpend !== undefined) report.adSpend = req.body.adSpend;
      if (req.body.notes !== undefined) report.notes = req.body.notes;
      if (req.body.deliveries !== undefined) {
        // Filtrer les livraisons vides (agencyName vide ou ordersDelivered = 0)
        report.deliveries = req.body.deliveries.filter(d => 
          d.agencyName && d.agencyName.trim() !== '' && d.ordersDelivered > 0
        );
      }
      
      console.log('📝 Mise à jour du rapport avec deliveries:', report.deliveries);
      
      await report.save();

      // Ajuster le stock si ordersDelivered a changé
      const newDelivered = report.ordersDelivered || 0;
      const diff = newDelivered - oldDelivered;
      if (diff !== 0) {
        await adjustProductStock({
          workspaceId: req.workspaceId,
          productId: report.productId,
          delta: -diff
        });
        console.log(`📦 Stock ajusté de ${-diff} pour le rapport mis à jour`);
      }

      const updatedReport = await DailyReport.findById(report._id)
        .populate('productId', 'name sellingPrice')
        .populate('reportedBy', 'email');

      res.json({
        success: true,
        message: 'Rapport mis à jour avec succès',
        data: updatedReport
      });
    } catch (error) {
      console.error('Erreur update report:', error);
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

// DELETE /api/ecom/reports/:id - Supprimer un rapport (admin uniquement)
router.delete('/:id', 
  requireEcomAuth, 
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      const report = await DailyReport.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Rapport non trouvé'
        });
      }

      // Restaurer le stock du produit
      if (report.ordersDelivered > 0) {
        await adjustProductStock({
          workspaceId: req.workspaceId,
          productId: report.productId,
          delta: report.ordersDelivered
        });
        console.log(`📦 Stock restauré de +${report.ordersDelivered} après suppression du rapport`);
      }

      await DailyReport.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Rapport supprimé avec succès'
      });
    } catch (error) {
      console.error('Erreur delete report:', error);
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

export default router;
