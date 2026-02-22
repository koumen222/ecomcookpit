import express from 'express';
import mongoose from 'mongoose';
import DailyReport from '../models/DailyReport.js';
import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import StockOrder from '../models/StockOrder.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

const router = express.Router();

// GET /api/ecom/ecore/overview - Vue d'ensemble économique
router.get('/overview', requireEcomAuth, validateEcomAccess('finance', 'read'), async (req, res) => {
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

    // 1. Ventes et revenus (DailyReport ne stocke pas les prix -> lookup Product)
    const salesData = await DailyReport.aggregate([
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
          totalRevenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          totalProductCost: { $sum: { $multiply: ['$ordersDelivered', '$product.productCost'] } },
          totalDeliveryCost: { $sum: { $multiply: ['$ordersDelivered', '$product.deliveryCost'] } },
          totalAvgAdsCost: { $sum: { $multiply: ['$ordersDelivered', '$product.avgAdsCost'] } },
          totalAdSpend: { $sum: '$adSpend' },
          ordersReceived: { $sum: '$ordersReceived' },
          ordersDelivered: { $sum: '$ordersDelivered' }
        }
      },
      {
        $addFields: {
          totalOrders: { $add: ['$ordersReceived', '$ordersDelivered'] }
        }
      }
    ]);

    // 2. Coûts stocks (status = received dans le modèle)
    const stockCosts = await StockOrder.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
          status: 'received'
        }
      },
      {
        $group: {
          _id: null,
          totalPurchaseCost: { $sum: { $multiply: ['$purchasePrice', '$quantity'] } },
          totalTransportCost: { $sum: '$transportCost' },
          totalStockCost: { $sum: { $add: [{ $multiply: ['$purchasePrice', '$quantity'] }, '$transportCost'] } },
          totalStockValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } }
        }
      }
    ]);

    // 3. Transactions financières
    const transactions = await Transaction.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // 4. Produits actifs et leur performance
    const productPerformance = await DailyReport.aggregate([
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
      { $match: { 'product.isActive': true } },
      {
        $group: {
          _id: '$productId',
          name: { $first: '$product.name' },
          status: { $first: '$product.status' },
          sellingPrice: { $first: '$product.sellingPrice' },
          productCost: { $first: '$product.productCost' },
          deliveryCost: { $first: '$product.deliveryCost' },
          avgAdsCost: { $first: '$product.avgAdsCost' },
          totalRevenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          totalOrders: { $sum: { $add: ['$ordersReceived', '$ordersDelivered'] } },
          totalDelivered: { $sum: '$ordersDelivered' },
          totalAdSpend: { $sum: '$adSpend' }
        }
      },
      {
        $project: {
          name: 1,
          status: 1,
          sellingPrice: 1,
          productCost: 1,
          deliveryCost: 1,
          avgAdsCost: 1,
          totalRevenue: 1,
          totalOrders: 1,
          totalDelivered: 1,
          totalAdSpend: 1,
          margin: { $subtract: ['$sellingPrice', { $add: ['$productCost', '$deliveryCost', '$avgAdsCost'] }] },
          marginPercent: {
            $cond: [
              { $eq: ['$sellingPrice', 0] },
              0,
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$sellingPrice', { $add: ['$productCost', '$deliveryCost', '$avgAdsCost'] }] }, '$sellingPrice'] },
                  100
                ]
              }
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

    // 5. Stock actif
    const stockValue = await Product.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(req.workspaceId), isActive: true } },
      {
        $group: {
          _id: null,
          totalStock: { $sum: '$stock' },
          totalValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
          lowStockCount: {
            $sum: {
              $cond: [{ $lte: ['$stock', '$reorderThreshold'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // 6. Taux de livraison
    const deliveryRate = salesData[0] && salesData[0].totalOrders
      ? (salesData[0].ordersDelivered / salesData[0].totalOrders * 100)
      : 0;

    // Calculs finaux
    const sales = salesData[0] || {};
    const stockOrders = stockCosts[0] || {};
    const stockAgg = stockValue[0] || {};
    const incomeData = transactions.find(t => t._id === 'income') || { total: 0 };
    const expenseData = transactions.find(t => t._id === 'expense') || { total: 0 };

    const totalRevenue = sales.totalRevenue || 0;
    const totalCost = (sales.totalProductCost || 0) + (sales.totalDeliveryCost || 0) + (sales.totalAdSpend || 0) + (stockOrders.totalStockCost || 0);
    const grossProfit = totalRevenue - (sales.totalProductCost || 0) - (sales.totalDeliveryCost || 0);
    const netProfit = grossProfit - (sales.totalAdSpend || 0);
    const grossMargin = totalRevenue ? (grossProfit / totalRevenue * 100) : 0;
    const netMargin = totalRevenue ? (netProfit / totalRevenue * 100) : 0;

    // Performance par produit
    const topProducts = productPerformance
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map(p => ({
        ...p,
        profit: p.totalRevenue - (p.totalDelivered * (p.productCost + p.deliveryCost + p.avgAdsCost)),
        profitMargin: p.totalRevenue
          ? ((p.totalRevenue - (p.totalDelivered * (p.productCost + p.deliveryCost + p.avgAdsCost))) / p.totalRevenue * 100)
          : 0
      }));

    res.json({
      success: true,
      data: {
        // Chiffres clés
        totalRevenue,
        grossProfit,
        netProfit,
        grossMargin,
        netMargin,
        deliveryRate,

        // Ventes
        ordersReceived: sales.ordersReceived || 0,
        ordersDelivered: sales.ordersDelivered || 0,
        totalOrders: sales.totalOrders || 0,

        // Coûts
        productCost: sales.totalProductCost || 0,
        deliveryCost: sales.totalDeliveryCost || 0,
        adSpend: sales.totalAdSpend || 0,
        stockCost: stockOrders.totalStockCost || 0,

        // Stock
        totalStock: stockAgg.totalStock || 0,
        stockValue: stockAgg.totalValue || 0,
        lowStockAlerts: stockAgg.lowStockCount || 0,

        // Transactions
        totalIncome: incomeData.total,
        totalExpense: expenseData.total,
        cashFlow: incomeData.total - expenseData.total,

        // Top produits
        topProducts,

        // Détails par statut
        productsByStatus: await Product.aggregate([
          { $match: { workspaceId: new mongoose.Types.ObjectId(req.workspaceId), isActive: true } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalValue: { $sum: { $multiply: ['$stock', '$sellingPrice'] } },
              avgMargin: { $avg: { $subtract: ['$sellingPrice', { $add: ['$productCost', '$deliveryCost', '$avgAdsCost'] }] } }
            }
          }
        ])
      }
    });
  } catch (error) {
    console.error('Erreur écore overview:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/ecore/profit-analysis - Analyse de rentabilité détaillée
router.get('/profit-analysis', requireEcomAuth, validateEcomAccess('finance', 'read'), async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
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

    if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);

    const profitByProduct = await DailyReport.aggregate([
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
          _id: '$product._id',
          name: { $first: '$product.name' },
          status: { $first: '$product.status' },
          sellingPrice: { $first: '$product.sellingPrice' },
          productCost: { $first: '$product.productCost' },
          deliveryCost: { $first: '$product.deliveryCost' },
          avgAdsCost: { $first: '$product.avgAdsCost' },
          stock: { $first: '$product.stock' },
          reorderThreshold: { $first: '$product.reorderThreshold' },
          totalRevenue: { $sum: { $multiply: ['$ordersDelivered', '$product.sellingPrice'] } },
          totalOrders: { $sum: { $add: ['$ordersReceived', '$ordersDelivered'] } },
          totalDelivered: { $sum: '$ordersDelivered' },
          totalAdSpend: { $sum: '$adSpend' }
        }
      },
      {
        $addFields: {
          unitCost: { $add: ['$productCost', '$deliveryCost', '$avgAdsCost'] },
          unitMargin: { $subtract: ['$sellingPrice', { $add: ['$productCost', '$deliveryCost', '$avgAdsCost'] }] }
        }
      },
      {
        $addFields: {
          unitMarginPercent: {
            $cond: [
              { $eq: ['$sellingPrice', 0] },
              0,
              { $multiply: [{ $divide: ['$unitMargin', '$sellingPrice'] }, 100] }
            ]
          },
          totalCost: { $multiply: ['$totalDelivered', '$unitCost'] },
          grossProfit: { $subtract: ['$totalRevenue', { $multiply: ['$totalDelivered', '$unitCost'] }] },
          netProfit: { $subtract: [{ $subtract: ['$totalRevenue', { $multiply: ['$totalDelivered', '$unitCost'] }] }, '$totalAdSpend'] }
        }
      },
      {
        $addFields: {
          grossMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: ['$grossProfit', '$totalRevenue'] }, 100] }
            ]
          },
          netMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $multiply: [{ $divide: ['$netProfit', '$totalRevenue'] }, 100] }
            ]
          },
          roas: {
            $cond: [
              { $eq: ['$totalAdSpend', 0] },
              0,
              { $divide: ['$totalRevenue', '$totalAdSpend'] }
            ]
          },
          deliveryRate: {
            $cond: [
              { $eq: ['$totalOrders', 0] },
              0,
              { $multiply: [{ $divide: ['$totalDelivered', '$totalOrders'] }, 100] }
            ]
          },
          avgOrderValue: {
            $cond: [
              { $eq: ['$totalDelivered', 0] },
              0,
              { $divide: ['$totalRevenue', '$totalDelivered'] }
            ]
          }
        }
      },
      {
        $project: {
          name: 1,
          status: 1,
          sellingPrice: 1,
          productCost: 1,
          deliveryCost: 1,
          avgAdsCost: 1,
          stock: 1,
          reorderThreshold: 1,
          totalRevenue: 1,
          totalOrders: 1,
          totalDelivered: 1,
          totalAdSpend: 1,
          unitCost: 1,
          unitMargin: 1,
          unitMarginPercent: 1,
          totalCost: 1,
          grossProfit: 1,
          grossMargin: 1,
          netProfit: 1,
          netMargin: 1,
          roas: 1,
          deliveryRate: 1,
          avgOrderValue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: profitByProduct.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
    });
  } catch (error) {
    console.error('Erreur profit analysis:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/ecore/trends - Tendances et projections
router.get('/trends', requireEcomAuth, validateEcomAccess('finance', 'read'), async (req, res) => {
  try {
    const { period = '30' } = req.query; // jours
    
    // Tendances des 30 derniers jours
    const trends = await DailyReport.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(req.workspaceId),
          date: { $gte: new Date(Date.now() - period * 24 * 60 * 60 * 1000) }
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
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: { $dateToString: { date: '$date', format: '%Y-%m-%d' } },
          totalRevenue: { $sum: { $multiply: ['$ordersDelivered', { $ifNull: ['$product.sellingPrice', 0] }] } },
          totalAdSpend: { $sum: '$adSpend' },
          ordersDelivered: { $sum: '$ordersDelivered' }
        }
      },
      {
        $addFields: {
          roas: {
            $cond: [
              { $eq: ['$totalAdSpend', 0] },
              0,
              { $divide: ['$totalRevenue', '$totalAdSpend'] }
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Projection simple (moyenne mobile 7 jours)
    const smoothedTrends = trends.map((day, index) => {
      const start = Math.max(0, index - 6);
      const end = index;
      const weekData = trends.slice(start, end + 1);

      
      const avgRevenue = weekData.reduce((sum, d) => sum + d.totalRevenue, 0) / weekData.length;
      const avgAdSpend = weekData.reduce((sum, d) => sum + d.totalAdSpend, 0) / weekData.length;
      const avgOrders = weekData.reduce((sum, d) => sum + d.ordersDelivered, 0) / weekData.length;
      const avgRoas = weekData.reduce((sum, d) => sum + d.roas, 0) / weekData.length;
      
      return {
        date: day._id,
        actual: {
          revenue: day.totalRevenue,
          adSpend: day.totalAdSpend,
          orders: day.ordersDelivered,
          roas: day.roas
        },
        smoothed: {
          revenue: avgRevenue,
          adSpend: avgAdSpend,
          orders: avgOrders,
          roas: avgRoas
        }
      };
    });

    res.json({
      success: true,
      data: {
        trends: smoothedTrends,
        period: `Derniers ${period} jours`
      }
    });
  } catch (error) {
    console.error('Erreur trends:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
