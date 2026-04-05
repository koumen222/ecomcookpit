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
      { $lookup: { from: 'ecom_products', localField: 'productId', foreignField: '_id', as: '_p' } },
      { $unwind: { path: '$_p', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        _qty: { $ifNull: ['$ordersDelivered', 0] },
        _sp: { $ifNull: ['$_p.sellingPrice', 0] },
        _pc: { $ifNull: ['$_p.productCost', 0] },
        _dc: { $ifNull: ['$_p.deliveryCost', 0] },
        _ad: { $ifNull: ['$adSpend', 0] }
      }},
      { $addFields: {
        _cRev: { $multiply: ['$_sp', '$_qty'] },
        _cCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] },
        _cPCost: { $multiply: ['$_pc', '$_qty'] },
        _cDCost: { $multiply: ['$_dc', '$_qty'] }
      }},
      { $addFields: {
        _fRev: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_cRev'] },
        _fCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_cCost'] },
        _fPCost: { $cond: [{ $gt: ['$productCost', 0] }, '$productCost', '$_cPCost'] },
        _fDCost: { $cond: [{ $gt: ['$deliveryCost', 0] }, '$deliveryCost', '$_cDCost'] }
      }},
      { $addFields: { _fProfit: { $subtract: ['$_fRev', '$_fCost'] } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$_fRev' },
          totalProductCost: { $sum: '$_fPCost' },
          totalDeliveryCost: { $sum: '$_fDCost' },
          totalAdSpend: { $sum: '$_ad' },
          totalCost: { $sum: '$_fCost' },
          totalProfit: { $sum: '$_fProfit' },
          totalOrdersReceived: { $sum: '$ordersReceived' },
          totalOrdersDelivered: { $sum: '$_qty' },
          totalOrdersReturned: { $sum: { $ifNull: ['$ordersReturned', 0] } },
          reportsCount: { $sum: 1 }
        }
      },
      {
        $addFields: {
          deliveryRate: {
            $cond: [
              { $eq: ['$totalOrdersReceived', 0] },
              0,
              { $multiply: [
                { $divide: ['$totalOrdersDelivered', '$totalOrdersReceived'] },
                100
              ]}
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
      { $lookup: { from: 'ecom_products', localField: 'productId', foreignField: '_id', as: '_p' } },
      { $unwind: { path: '$_p', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        _qty: { $ifNull: ['$ordersDelivered', 0] },
        _sp: { $ifNull: ['$_p.sellingPrice', 0] },
        _pc: { $ifNull: ['$_p.productCost', 0] },
        _dc: { $ifNull: ['$_p.deliveryCost', 0] },
        _ad: { $ifNull: ['$adSpend', 0] }
      }},
      { $addFields: {
        _cRev: { $multiply: ['$_sp', '$_qty'] },
        _cCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] },
        _cPCost: { $multiply: ['$_pc', '$_qty'] },
        _cDCost: { $multiply: ['$_dc', '$_qty'] }
      }},
      { $addFields: {
        _fRev: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_cRev'] },
        _fCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_cCost'] },
        _fPCost: { $cond: [{ $gt: ['$productCost', 0] }, '$productCost', '$_cPCost'] },
        _fDCost: { $cond: [{ $gt: ['$deliveryCost', 0] }, '$deliveryCost', '$_cDCost'] }
      }},
      { $addFields: { _fProfit: { $subtract: ['$_fRev', '$_fCost'] } } },
      {
        $group: {
          _id: '$productId',
          ordersReceived: { $sum: '$ordersReceived' },
          ordersDelivered: { $sum: '$_qty' },
          adSpend: { $sum: '$_ad' },
          revenue: { $sum: '$_fRev' },
          productCost: { $sum: '$_fPCost' },
          deliveryCost: { $sum: '$_fDCost' },
          profit: { $sum: '$_fProfit' },
          cost: { $sum: '$_fCost' }
        }
      },
      {
        $addFields: {
          deliveryRate: {
            $cond: [
              { $eq: ['$ordersReceived', 0] },
              0,
              { $multiply: [
                { $divide: ['$ordersDelivered', '$ordersReceived'] },
                100
              ]}
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
      { $lookup: { from: 'ecom_products', localField: 'productId', foreignField: '_id', as: '_p' } },
      { $unwind: { path: '$_p', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        _qty: { $ifNull: ['$ordersDelivered', 0] },
        _sp: { $ifNull: ['$_p.sellingPrice', 0] },
        _pc: { $ifNull: ['$_p.productCost', 0] },
        _dc: { $ifNull: ['$_p.deliveryCost', 0] },
        _ad: { $ifNull: ['$adSpend', 0] }
      }},
      { $addFields: {
        _cRev: { $multiply: ['$_sp', '$_qty'] },
        _cCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] },
        _cPCost: { $multiply: ['$_pc', '$_qty'] },
        _cDCost: { $multiply: ['$_dc', '$_qty'] }
      }},
      { $addFields: {
        _fRev: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_cRev'] },
        _fCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_cCost'] },
        _fPCost: { $cond: [{ $gt: ['$productCost', 0] }, '$productCost', '$_cPCost'] },
        _fDCost: { $cond: [{ $gt: ['$deliveryCost', 0] }, '$deliveryCost', '$_cDCost'] }
      }},
      { $addFields: { _fProfit: { $subtract: ['$_fRev', '$_fCost'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          ordersReceived: { $sum: '$ordersReceived' },
          ordersDelivered: { $sum: '$_qty' },
          adSpend: { $sum: '$_ad' },
          revenue: { $sum: '$_fRev' },
          productCost: { $sum: '$_fPCost' },
          deliveryCost: { $sum: '$_fDCost' },
          profit: { $sum: '$_fProfit' },
          cost: { $sum: '$_fCost' }
        }
      },
      {
        $addFields: {
          deliveryRate: {
            $cond: [
              { $eq: ['$ordersReceived', 0] },
              0,
              { $multiply: [
                { $divide: ['$ordersDelivered', '$ordersReceived'] },
                100
              ]}
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
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const filter = { workspaceId: req.workspaceId };
    
    // Closeuse: ne voir que ses propres rapports
    if (req.ecomUser.role === 'ecom_closeuse') {
      filter.reportedBy = req.ecomUser._id;
    }

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

    const rawReports = await DailyReport.find(filter)
      .populate('productId', 'name sellingPrice productCost deliveryCost')
      .populate('reportedBy', 'email')
      .sort({ date: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await DailyReport.countDocuments(filter);

    // Recalculer les champs financiers à la volée si manquants
    const reports = rawReports.map(r => {
      const report = r.toObject();
      const qty = report.ordersDelivered || 0;
      if (qty > 0 && !report.revenue && report.productId) {
        const sp = report.productId.sellingPrice || 0;
        const pc = report.productId.productCost || 0;
        const dc = report.productId.deliveryCost || 0;
        const ad = report.adSpend || 0;
        report.revenue = sp * qty;
        report.productCost = pc * qty;
        report.deliveryCost = dc * qty;
        report.cost = (pc + dc) * qty + ad;
        report.profit = report.revenue - report.cost;
      }
      return report;
    });

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
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

// GET /api/ecom/reports/stats/products-ranking - Classement produits par différents critères
router.get('/stats/products-ranking',
  requireEcomAuth,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const matchStage = { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) };

      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchStage.date.$lte = end;
        }
      }

      const products = await DailyReport.aggregate([
        { $match: matchStage },
        { $lookup: { from: 'ecom_products', localField: 'productId', foreignField: '_id', as: '_p' } },
        { $unwind: { path: '$_p', preserveNullAndEmptyArrays: true } },
        { $addFields: {
          _qty: { $ifNull: ['$ordersDelivered', 0] },
          _sp: { $ifNull: ['$_p.sellingPrice', 0] },
          _pc: { $ifNull: ['$_p.productCost', 0] },
          _dc: { $ifNull: ['$_p.deliveryCost', 0] },
          _ad: { $ifNull: ['$adSpend', 0] }
        }},
        { $addFields: {
          _cRev: { $multiply: ['$_sp', '$_qty'] },
          _cCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] },
        }},
        { $addFields: {
          _fRev: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_cRev'] },
          _fCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_cCost'] }
        }},
        { $addFields: { _fProfit: { $subtract: ['$_fRev', '$_fCost'] } } },
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$_p.name' },
            ordersReceived: { $sum: '$ordersReceived' },
            ordersDelivered: { $sum: '$_qty' },
            adSpend: { $sum: '$_ad' },
            revenue: { $sum: '$_fRev' },
            cost: { $sum: '$_fCost' },
            profit: { $sum: '$_fProfit' },
            reportsCount: { $sum: 1 }
          }
        },
        { $addFields: {
          deliveryRate: {
            $cond: [
              { $eq: ['$ordersReceived', 0] }, 0,
              { $multiply: [{ $divide: ['$ordersDelivered', '$ordersReceived'] }, 100] }
            ]
          },
          profitabilityRate: {
            $cond: [
              { $eq: ['$revenue', 0] }, 0,
              { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] }
            ]
          },
          roas: {
            $cond: [
              { $eq: ['$adSpend', 0] }, 0,
              { $divide: ['$revenue', '$adSpend'] }
            ]
          }
        }},
        { $sort: { ordersDelivered: -1 } }
      ]);

      res.json({ success: true, data: products });
    } catch (error) {
      console.error('Erreur products ranking:', error);
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
            as: '_product'
          }
        },
        { $unwind: { path: '$_product', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            _qty: { $ifNull: ['$ordersDelivered', 0] },
            _sp: { $ifNull: ['$_product.sellingPrice', 0] },
            _pc: { $ifNull: ['$_product.productCost', 0] },
            _dc: { $ifNull: ['$_product.deliveryCost', 0] },
            _ad: { $ifNull: ['$adSpend', 0] }
          }
        },
        {
          $addFields: {
            _computedRevenue: { $multiply: ['$_sp', '$_qty'] },
            _computedProductCost: { $multiply: ['$_pc', '$_qty'] },
            _computedDeliveryCost: { $multiply: ['$_dc', '$_qty'] },
            _computedCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] }
          }
        },
        {
          $addFields: {
            _finalRevenue: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_computedRevenue'] },
            _finalProductCost: { $cond: [{ $gt: ['$productCost', 0] }, '$productCost', '$_computedProductCost'] },
            _finalDeliveryCost: { $cond: [{ $gt: ['$deliveryCost', 0] }, '$deliveryCost', '$_computedDeliveryCost'] },
            _finalCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_computedCost'] }
          }
        },
        {
          $addFields: {
            _finalProfit: { $subtract: ['$_finalRevenue', '$_finalCost'] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$_finalRevenue' },
            totalProductCost: { $sum: '$_finalProductCost' },
            totalDeliveryCost: { $sum: '$_finalDeliveryCost' },
            totalAdSpend: { $sum: '$_ad' },
            totalCost: { $sum: '$_finalCost' },
            totalProfit: { $sum: '$_finalProfit' },
            totalOrdersReceived: { $sum: '$ordersReceived' },
            totalOrdersDelivered: { $sum: '$_qty' },
            totalQuantity: { $sum: { $ifNull: ['$quantity', '$_qty'] } }
          }
        },
        {
          $addFields: {
            profitabilityRate: {
              $cond: [
                { $eq: ['$totalRevenue', 0] },
                0,
                { $multiply: [
                  { $divide: ['$totalProfit', '$totalRevenue'] },
                  100
                ]}
              ]
            },
            deliveryRate: {
              $cond: [
                { $eq: ['$totalOrdersReceived', 0] },
                0,
                { $multiply: [
                  { $divide: ['$totalOrdersDelivered', '$totalOrdersReceived'] },
                  100
                ]}
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
            as: '_product'
          }
        },
        { $unwind: { path: '$_product', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            _qty: { $ifNull: ['$ordersDelivered', 0] },
            _sp: { $ifNull: ['$_product.sellingPrice', 0] },
            _pc: { $ifNull: ['$_product.productCost', 0] },
            _dc: { $ifNull: ['$_product.deliveryCost', 0] },
            _ad: { $ifNull: ['$adSpend', 0] }
          }
        },
        {
          $addFields: {
            _computedRevenue: { $multiply: ['$_sp', '$_qty'] },
            _computedCost: { $add: [{ $multiply: [{ $add: ['$_pc', '$_dc'] }, '$_qty'] }, '$_ad'] }
          }
        },
        {
          $addFields: {
            _finalRevenue: { $cond: [{ $gt: ['$revenue', 0] }, '$revenue', '$_computedRevenue'] },
            _finalCost: { $cond: [{ $gt: ['$cost', 0] }, '$cost', '$_computedCost'] }
          }
        },
        {
          $addFields: {
            _finalProfit: { $subtract: ['$_finalRevenue', '$_finalCost'] }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$date' }
            },
            revenue: { $sum: '$_finalRevenue' },
            cost: { $sum: '$_finalCost' },
            profit: { $sum: '$_finalProfit' },
            ordersDelivered: { $sum: '$_qty' },
            ordersReceived: { $sum: '$ordersReceived' },
            totalAdSpend: { $sum: '$_ad' }
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

// GET /api/ecom/reports/product-stats - Stats détaillées pour un produit
router.get('/product-stats', requireEcomAuth, async (req, res) => {
  try {
    const { productId, dateStart, dateEnd } = req.query;
    
    console.log('📊 GET /product-stats - productId:', productId, 'dateStart:', dateStart, 'dateEnd:', dateEnd);
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'productId requis'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error('❌ productId invalide:', productId);
      return res.status(400).json({
        success: false,
        message: 'productId invalide'
      });
    }

    const dateMatch = buildDateMatchFromQuery({ 
      startDate: dateStart, 
      endDate: dateEnd 
    });

    const reportsFilter = { 
      workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
      productId: new mongoose.Types.ObjectId(productId)
    };
    
    if (dateMatch) reportsFilter.date = dateMatch;
    
    console.log('🔍 Filtre de recherche:', JSON.stringify(reportsFilter));

    // Récupérer tous les rapports quotidiens pour ce produit sur la période
    const reports = await DailyReport.find(reportsFilter)
      .populate('productId', 'name sellingPrice productCost deliveryCost avgAdsCost')
      .sort({ date: -1 });

    console.log(`📋 ${reports.length} rapports trouvés pour le produit`);

    // Si aucun rapport trouvé, retourner des stats à zéro
    if (reports.length === 0) {
      console.log('⚠️ Aucun rapport trouvé, récupération du produit...');
      const product = await Product.findById(productId).select('name sellingPrice productCost deliveryCost avgAdsCost');
      
      if (!product) {
        console.error('❌ Produit non trouvé:', productId);
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }
      
      console.log('✅ Produit trouvé:', product.name);
      return res.json({
        success: true,
        data: {
          product,
          stats: {
            totalReceived: 0,
            totalDelivered: 0,
            totalQuantity: 0,
            totalRevenue: 0,
            totalAdSpend: 0,
            totalProfit: 0,
            totalCost: 0,
            totalProductCost: 0,
            totalDeliveryCost: 0
          },
          reports: [],
          period: {
            start: dateStart,
            end: dateEnd
          }
        }
      });
    }

    // Calculer les stats agrégées depuis les rapports quotidiens
    const stats = {
      totalReceived: 0,
      totalDelivered: 0,
      totalQuantity: 0,
      totalRevenue: 0,
      totalAdSpend: 0,
      totalProfit: 0,
      totalCost: 0,
      totalProductCost: 0,
      totalDeliveryCost: 0
    };

    reports.forEach(report => {
      const qty = report.ordersDelivered || 0;
      const ad = report.adSpend || 0;
      
      // Si le rapport a des valeurs financières à 0 mais a des livraisons, recalculer depuis le produit
      let revenue = report.revenue || 0;
      let productCost = report.productCost || 0;
      let deliveryCost = report.deliveryCost || 0;
      let cost = report.cost || 0;
      let profit = report.profit || 0;
      
      if (qty > 0 && (!revenue || revenue === 0) && report.productId) {
        const product = report.productId;
        const sp = product.sellingPrice || 0;
        const pc = product.productCost || 0;
        const dc = product.deliveryCost || 0;
        
        revenue = sp * qty;
        productCost = pc * qty;
        deliveryCost = dc * qty;
        cost = (pc + dc) * qty + ad;
        profit = revenue - cost;
      }
      
      stats.totalReceived += report.ordersReceived || 0;
      stats.totalDelivered += qty;
      stats.totalQuantity += report.quantity || qty;
      stats.totalRevenue += revenue;
      stats.totalAdSpend += ad;
      stats.totalProfit += profit;
      stats.totalCost += cost;
      stats.totalProductCost += productCost;
      stats.totalDeliveryCost += deliveryCost;
    });

    console.log('💰 Stats calculées:', stats);

    // Récupérer les infos du produit depuis le premier rapport (ou directement)
    let product = reports[0]?.productId;
    
    if (!product || typeof product === 'string') {
      console.log('⚠️ Produit non populé, récupération directe...');
      product = await Product.findById(productId).select('name sellingPrice productCost deliveryCost avgAdsCost');
    }

    console.log('✅ Envoi de la réponse avec', reports.length, 'rapports');

    res.json({
      success: true,
      data: {
        product,
        stats,
        reports,
        period: {
          start: dateStart,
          end: dateEnd
        }
      }
    });
  } catch (error) {
    console.error('❌ Erreur product stats:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/ecom/reports/dashboard/stats - Stats dynamiques pour le dashboard
router.get('/dashboard/stats',
  requireEcomAuth,
  async (req, res) => {
    try {
      const workspaceObjectId = new mongoose.Types.ObjectId(req.workspaceId);
      const periodRaw = parseInt(req.query?.period, 10);
      const periodDays = Math.min(120, Math.max(1, Number.isFinite(periodRaw) ? periodRaw : 30));

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - periodDays);

      const prevDaysAgo = new Date();
      prevDaysAgo.setDate(prevDaysAgo.getDate() - (periodDays * 2));

      const buildSummaryPipeline = (matchStage) => ([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            returnedOrders: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            confirmedOrders: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'shipped', 'delivered']] }, 1, 0] } },
            totalRevenue: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'delivered'] },
                  { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] },
                  0
                ]
              }
            },
            uniqueClientsSet: { $addToSet: '$clientPhone' }
          }
        },
        {
          $project: {
            _id: 0,
            totalOrders: 1,
            deliveredOrders: 1,
            returnedOrders: 1,
            confirmedOrders: 1,
            totalRevenue: 1,
            averageOrderValue: {
              $cond: [
                { $eq: ['$deliveredOrders', 0] },
                0,
                { $divide: ['$totalRevenue', '$deliveredOrders'] }
              ]
            },
            conversionRate: {
              $cond: [
                { $eq: ['$totalOrders', 0] },
                0,
                { $multiply: [{ $divide: ['$confirmedOrders', '$totalOrders'] }, 100] }
              ]
            },
            returnRate: {
              $cond: [
                { $eq: ['$deliveredOrders', 0] },
                0,
                { $multiply: [{ $divide: ['$returnedOrders', '$deliveredOrders'] }, 100] }
              ]
            },
            activeClients: {
              $size: {
                $filter: {
                  input: '$uniqueClientsSet',
                  as: 'phone',
                  cond: { $and: [{ $ne: ['$$phone', null] }, { $ne: ['$$phone', ''] }] }
                }
              }
            }
          }
        }
      ]);

      const currentMatch = {
        workspaceId: workspaceObjectId,
        createdAt: { $gte: daysAgo }
      };

      const prevMatch = {
        workspaceId: workspaceObjectId,
        createdAt: { $gte: prevDaysAgo, $lt: daysAgo }
      };

      const [currentAgg, prevAgg, topProductsAgg] = await Promise.all([
        Order.aggregate(buildSummaryPipeline(currentMatch)),
        Order.aggregate(buildSummaryPipeline(prevMatch)),
        Order.aggregate([
          {
            $match: {
              ...currentMatch,
              status: 'delivered'
            }
          },
          {
            $group: {
              _id: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ['$product', ''] } }, 0] },
                  '$product',
                  'Inconnu'
                ]
              },
              sales: { $sum: 1 },
              quantity: { $sum: { $ifNull: ['$quantity', 1] } },
              revenue: {
                $sum: {
                  $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }]
                }
              }
            }
          },
          { $sort: { sales: -1 } },
          { $limit: 5 },
          {
            $project: {
              _id: 0,
              name: '$_id',
              sales: 1,
              quantity: 1,
              revenue: { $round: ['$revenue', 0] }
            }
          }
        ])
      ]);

      const current = currentAgg[0] || {
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        confirmedOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        conversionRate: 0,
        returnRate: 0,
        activeClients: 0
      };

      const prev = prevAgg[0] || {
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        confirmedOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        conversionRate: 0,
        returnRate: 0,
        activeClients: 0
      };

      const conversionTrend = current.conversionRate - prev.conversionRate;
      const avgOrderTrend = prev.averageOrderValue > 0
        ? ((current.averageOrderValue - prev.averageOrderValue) / prev.averageOrderValue) * 100
        : 0;
      const activeClientsTrend = current.activeClients - prev.activeClients;
      const returnRateTrend = current.returnRate - prev.returnRate;
      const topProducts = topProductsAgg || [];

      res.json({
        success: true,
        data: {
          conversionRate: Number(current.conversionRate || 0).toFixed(1),
          conversionTrend: conversionTrend.toFixed(1),
          averageOrderValue: Math.round(current.averageOrderValue || 0),
          avgOrderTrend: avgOrderTrend.toFixed(1),
          activeClients: current.activeClients || 0,
          activeClientsTrend,
          returnRate: Number(current.returnRate || 0).toFixed(1),
          returnRateTrend: returnRateTrend.toFixed(1),
          topProducts
        }
      });
    } catch (error) {
      console.error('Erreur dashboard stats:', error);
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
      
      const { date, productId, ordersReceived, ordersDelivered, ordersReturned, adSpend, notes, deliveries, priceExceptions, whatsappNumber } = req.body;

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

      // Valider et nettoyer les exceptions de prix
      const validExceptions = (priceExceptions || []).filter(e => 
        e.quantity > 0 && e.unitPrice >= 0
      );

      // Calculer le CA avec exceptions de prix
      const sellingPrice = product.sellingPrice || 0;
      const productCost = product.productCost || 0;
      const deliveryCost = product.deliveryCost || 0;
      const totalCostPerUnit = productCost + deliveryCost;

      let customRevenue = null;
      let customBenefit = null;

      if (validExceptions.length > 0) {
        // CA avec exceptions : certaines commandes à prix différent
        const exceptionQty = validExceptions.reduce((s, e) => s + e.quantity, 0);
        const exceptionRevenue = validExceptions.reduce((s, e) => s + e.quantity * e.unitPrice, 0);
        const normalQty = Math.max(0, ordersDelivered - exceptionQty);
        const normalRevenue = normalQty * sellingPrice;
        customRevenue = normalRevenue + exceptionRevenue;
        customBenefit = customRevenue - (totalCostPerUnit * ordersDelivered) - (adSpend || 0);
        console.log(`💰 CA avec exceptions: ${customRevenue} FCFA (normal: ${normalRevenue}, exceptions: ${exceptionRevenue})`);
      }

      // Calculer les valeurs financières à stocker
      // Les retours réduisent le CA mais les coûts restent engagés
      const effectiveDelivered = ordersDelivered - (parseInt(ordersReturned) || 0);
      const computedRevenue = customRevenue !== null 
        ? customRevenue - ((parseInt(ordersReturned) || 0) * sellingPrice)
        : sellingPrice * effectiveDelivered;
      const computedProductCost = productCost * ordersDelivered;
      const computedDeliveryCost = deliveryCost * ordersDelivered;
      const computedCost = computedProductCost + computedDeliveryCost + (adSpend || 0);
      const computedProfit = computedRevenue - computedCost;
      const unitBenefit = sellingPrice - totalCostPerUnit;
      const totalBenefit = customBenefit !== null ? customBenefit : unitBenefit * effectiveDelivered;

      console.log(`💰 Financier: revenue=${computedRevenue}, productCost=${computedProductCost}, deliveryCost=${computedDeliveryCost}, cost=${computedCost}, profit=${computedProfit}`);

      const reportData = {
        workspaceId: req.workspaceId,
        date: new Date(date),
        productId,
        ordersReceived,
        ordersDelivered,
        ordersReturned: parseInt(ordersReturned) || 0,
        quantity: ordersDelivered,
        adSpend,
        notes,
        whatsappNumber: whatsappNumber?.trim() || '',
        reportedBy: req.ecomUser._id,
        deliveries: (deliveries || []).filter(d => 
          d.agencyName && d.agencyName.trim() !== '' && d.ordersDelivered > 0
        ),
        priceExceptions: validExceptions,
        revenue: computedRevenue,
        productCost: computedProductCost,
        deliveryCost: computedDeliveryCost,
        cost: computedCost,
        profit: computedProfit,
        unitBenefit,
        totalBenefit,
        ...(customRevenue !== null && { customRevenue }),
        ...(customBenefit !== null && { customBenefit })
      };

      console.log('💰 Bénéfice calculé - Unité:', unitBenefit, 'Total:', totalBenefit);

      const report = new DailyReport(reportData);
      await report.save();

      // Notification interne
      notifyReportCreated(req.workspaceId, report, req.ecomUser?.name || req.ecomUser?.email).catch(() => {});

      // 📱 Push notification rapport soumis
      import('../services/pushService.js').then(({ sendPushNotification }) => {
        sendPushNotification(req.workspaceId, {
          title: '📊 Nouveau rapport soumis',
          body: `${req.ecomUser?.name || req.ecomUser?.email} — ${product.name} : ${ordersDelivered} livrées / ${ordersReceived} reçues`,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'report-created',
          data: { type: 'report_created', reportId: report._id.toString(), url: `/ecom/reports` }
        }, 'push_new_orders');
      }).catch(() => {});

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

// POST /api/ecom/reports/auto-generate - Génération automatique des rapports depuis les commandes livrées
router.post('/auto-generate',
  requireEcomAuth,
  validateEcomAccess('orders', 'write'),
  async (req, res) => {
    try {
      const { date, startDate, endDate, mappings } = req.body || {};

      // Map des assignations manuelles : nomCommande (lowercase) -> productId
      const manualMap = {};
      if (Array.isArray(mappings)) {
        mappings.forEach(m => {
          if (m.orderProductName && m.productId) {
            manualMap[m.orderProductName.toLowerCase().trim()] = m.productId;
          }
        });
      }

      // Construire le filtre de date
      let dateFilter;
      if (date) {
        const s = new Date(date + 'T00:00:00.000Z');
        const e = new Date(date + 'T23:59:59.999Z');
        dateFilter = { $gte: s, $lte: e };
      } else if (startDate || endDate) {
        dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate + 'T00:00:00.000Z');
        if (endDate) dateFilter.$lte = new Date(endDate + 'T23:59:59.999Z');
      } else {
        // Par défaut : aujourd'hui
        const today = new Date().toISOString().split('T')[0];
        dateFilter = { $gte: new Date(today + 'T00:00:00.000Z'), $lte: new Date(today + 'T23:59:59.999Z') };
      }

      const wsOid = new mongoose.Types.ObjectId(req.workspaceId);

      // Agréger les commandes livrées par produit + date de LIVRAISON (statusModifiedAt ou updatedAt)
      // Toutes sources confondues (pas de filtre source)
      const [deliveredAgg, allOrdersAgg] = await Promise.all([
        Order.aggregate([
          { $match: {
            workspaceId: wsOid,
            status: 'delivered',
            $or: [
              { statusModifiedAt: dateFilter },
              { $and: [{ statusModifiedAt: null }, { updatedAt: dateFilter }] }
            ]
          }},
          { $addFields: {
            _deliveryDate: {
              $ifNull: ['$statusModifiedAt', '$updatedAt']
            }
          }},
          { $group: {
            _id: {
              dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$_deliveryDate' } },
              product: '$product'
            },
            ordersDelivered: { $sum: { $ifNull: ['$quantity', 1] } }
          }}
        ]),
        // Commandes reçues (créées) sur la même période, toutes sources
        // Utilise date (création) avec fallback createdAt si date est null
        Order.aggregate([
          { $addFields: {
            _orderDate: { $ifNull: ['$date', '$createdAt'] }
          }},
          { $match: {
            workspaceId: wsOid,
            product: { $ne: '' },
            _orderDate: dateFilter
          }},
          { $group: {
            _id: {
              dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$_orderDate' } },
              product: '$product'
            },
            ordersReceived: { $sum: 1 }
          }}
        ])
      ]);

      if (deliveredAgg.length === 0) {
        return res.json({
          success: true,
          message: 'Aucune commande livrée trouvée pour cette période',
          data: { created: [], updated: [], skipped: [] }
        });
      }

      // Map des commandes reçues par produit+date
      const receivedMap = {};
      allOrdersAgg.forEach(r => {
        receivedMap[`${r._id.dateKey}|${r._id.product}`] = r.ordersReceived;
      });

      // Charger tous les produits du workspace
      const products = await Product.find(
        { workspaceId: req.workspaceId },
        { name: 1, sellingPrice: 1, productCost: 1, deliveryCost: 1 }
      ).lean();

      // Map nom (en minuscules) -> produit
      const productByName = {};
      products.forEach(p => {
        if (p.name) productByName[p.name.toLowerCase().trim()] = p;
      });

      const created = [];
      const updated = [];
      const skipped = [];
      const unmatchedMap = {}; // productName -> { productName, totalDelivered, totalReceived, dates[] }

      for (const agg of deliveredAgg) {
        const { dateKey, product: productName } = agg._id;

        if (!productName || !productName.trim()) {
          skipped.push({ reason: 'Nom de produit vide', dateKey });
          continue;
        }

        const key = productName.toLowerCase().trim();
        let productDoc = productByName[key];

        // Essayer l'assignation manuelle si pas trouvé par nom
        if (!productDoc && manualMap[key]) {
          productDoc = products.find(p => p._id.toString() === manualMap[key]);
        }

        if (!productDoc) {
          if (!unmatchedMap[productName]) {
            unmatchedMap[productName] = { productName, totalDelivered: 0, totalReceived: 0, dates: [] };
          }
          const ordDel = agg.ordersDelivered || 0;
          const ordRec = receivedMap[`${dateKey}|${productName}`] || 0;
          unmatchedMap[productName].totalDelivered += ordDel;
          unmatchedMap[productName].totalReceived += ordRec;
          unmatchedMap[productName].dates.push({ dateKey, ordersDelivered: ordDel, ordersReceived: ordRec });
          continue;
        }

        const ordersDelivered = agg.ordersDelivered || 0;
        const ordersReceived = receivedMap[`${dateKey}|${productName}`] || 0;

        // Date normalisée à minuit UTC
        const reportDate = new Date(dateKey + 'T00:00:00.000Z');
        const dayStart = new Date(dateKey + 'T00:00:00.000Z');
        const dayEnd = new Date(dateKey + 'T23:59:59.999Z');

        // Calcul financier (sans dépense pub — à compléter manuellement)
        const sp = productDoc.sellingPrice || 0;
        const pc = productDoc.productCost || 0;
        const dc = productDoc.deliveryCost || 0;
        const revenue = sp * ordersDelivered;
        const computedProductCost = pc * ordersDelivered;
        const computedDeliveryCost = dc * ordersDelivered;
        const cost = (pc + dc) * ordersDelivered;
        const profit = revenue - cost;

        const existing = await DailyReport.findOne({
          workspaceId: req.workspaceId,
          date: { $gte: dayStart, $lte: dayEnd },
          productId: productDoc._id
        });

        if (existing) {
          // Mettre à jour les quantités ; conserver adSpend si déjà renseigné manuellement
          const adSpend = existing.adSpend || 0;
          const updatedRevenue = adSpend > 0 ? existing.revenue : revenue;
          const updatedCost = adSpend > 0 ? existing.cost : cost + adSpend;
          const updatedProfit = updatedRevenue - updatedCost;
          await DailyReport.updateOne(
            { _id: existing._id },
            { $set: {
              ordersDelivered,
              ordersReceived,
              quantity: ordersDelivered,
              productCost: computedProductCost,
              deliveryCost: computedDeliveryCost,
              revenue: updatedRevenue,
              cost: updatedCost,
              profit: updatedProfit
            }}
          );
          updated.push({ dateKey, productName: productDoc.name });
        } else {
          await DailyReport.create({
            workspaceId: req.workspaceId,
            date: reportDate,
            productId: productDoc._id,
            ordersReceived,
            ordersDelivered,
            quantity: ordersDelivered,
            adSpend: 0,
            revenue,
            productCost: computedProductCost,
            deliveryCost: computedDeliveryCost,
            cost,
            profit,
            reportedBy: req.ecomUser._id,
            notes: 'Rapport généré automatiquement'
          });
          created.push({ dateKey, productName: productDoc.name });
        }
      }

      const unmatched = Object.values(unmatchedMap);
      const total = created.length + updated.length;
      const hasUnmatched = unmatched.length > 0;
      res.json({
        success: true,
        message: `${total} rapport(s) traité(s) : ${created.length} créé(s), ${updated.length} mis à jour${hasUnmatched ? ` · ${unmatched.length} produit(s) à assigner` : ''}${skipped.length > 0 ? ` · ${skipped.length} ignoré(s)` : ''}`,
        data: { created, updated, skipped, unmatched }
      });
    } catch (error) {
      console.error('Erreur auto-generate reports:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
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
      if (req.body.ordersReturned !== undefined) report.ordersReturned = req.body.ordersReturned;
      if (req.body.adSpend !== undefined) report.adSpend = req.body.adSpend;
      if (req.body.notes !== undefined) report.notes = req.body.notes;
      if (req.body.deliveries !== undefined) {
        report.deliveries = req.body.deliveries.filter(d => 
          d.agencyName && d.agencyName.trim() !== '' && d.ordersDelivered > 0
        );
      }

      // Recalculer les champs financiers depuis le produit
      const productForCalc = await Product.findById(report.productId).select('sellingPrice productCost deliveryCost');
      if (productForCalc) {
        const sp = productForCalc.sellingPrice || 0;
        const pc = productForCalc.productCost || 0;
        const dc = productForCalc.deliveryCost || 0;
        const qty = report.ordersDelivered || 0;
        const returned = report.ordersReturned || 0;
        const effectiveQty = qty - returned;
        const ad = report.adSpend || 0;
        report.revenue = sp * effectiveQty;
        report.productCost = pc * qty;
        report.deliveryCost = dc * qty;
        report.cost = (pc + dc) * qty + ad;
        report.profit = report.revenue - report.cost;
        report.quantity = qty;
      }
      
      console.log('📝 Mise à jour du rapport - revenue:', report.revenue, 'profit:', report.profit);
      
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
        try {
          await adjustProductStock({
            workspaceId: req.workspaceId,
            productId: report.productId,
            delta: report.ordersDelivered
          });
          console.log(`📦 Stock restauré de +${report.ordersDelivered} après suppression du rapport`);
        } catch (stockError) {
          if (stockError instanceof StockAdjustmentError && stockError.code === 'PRODUCT_NOT_FOUND') {
            console.warn(`⚠️ Produit introuvable (${report.productId}) pendant suppression du rapport ${report._id}, suppression poursuivie sans restauration de stock.`);
          } else {
            throw stockError;
          }
        }
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

// POST /api/ecom/reports/migrate-financials - Recalculer les champs financiers des rapports existants (admin)
router.post('/migrate-financials',
  requireEcomAuth,
  validateEcomAccess('products', 'write'),
  async (req, res) => {
    try {
      console.log('🔄 Migration des champs financiers...');
      // Migrer TOUS les rapports pour recalculer les valeurs
      const reports = await DailyReport.find({ workspaceId: req.workspaceId });
      console.log(`📋 ${reports.length} rapports trouvés dans le workspace`);
      
      let updated = 0;
      let errors = 0;

      for (const report of reports) {
        try {
          const product = await Product.findById(report.productId).select('sellingPrice productCost deliveryCost');
          if (!product) continue;

          const sp = product.sellingPrice || 0;
          const pc = product.productCost || 0;
          const dc = product.deliveryCost || 0;
          const qty = report.ordersDelivered || 0;
          const ad = report.adSpend || 0;

          await DailyReport.updateOne(
            { _id: report._id },
            {
              $set: {
                revenue: sp * qty,
                productCost: pc * qty,
                deliveryCost: dc * qty,
                cost: (pc + dc) * qty + ad,
                profit: (sp * qty) - ((pc + dc) * qty + ad),
                quantity: qty
              }
            }
          );
          updated++;
        } catch (e) {
          console.error('Erreur migration rapport', report._id, e.message);
          errors++;
        }
      }

      console.log(`✅ Migration terminée: ${updated} mis à jour, ${errors} erreurs`);
      res.json({ success: true, data: { updated, errors, total: reports.length } });
    } catch (error) {
      console.error('Erreur migration:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

export default router;
