import express from 'express';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import EcomUser from '../models/EcomUser.js';
import Workspace from '../models/Workspace.js';
import Campaign from '../models/Campaign.js';
import DailyReport from '../models/DailyReport.js';

import {
  notifyBudgetWarning,
  notifyBudgetExceeded,
  notifyCriticalTransaction
} from '../core/notifications/notification.service.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Seuil transaction critique (configurable via env)
const CRITICAL_TX_THRESHOLD = parseInt(process.env.CRITICAL_TX_THRESHOLD || '100000', 10);

const router = express.Router();

// IMPORTANT: Routes spécifiques (/accounting-summary, /forecast, etc.) AVANT /:id pour éviter capture

// GET /api/ecom/transactions - Liste des transactions
router.get('/', 
  requireEcomAuth, 
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const { type, category, startDate, endDate, page = 1, limit = 50 } = req.query;
      const filter = { workspaceId: req.workspaceId };

      if (type) filter.type = type;
      if (category) filter.category = category;
      if (startDate || endDate) {
        filter.date = {};
        if (startDate) filter.date.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }

      const transactions = await Transaction.find(filter)
        .populate('productId', 'name')
        .populate('createdBy', 'email')
        .sort({ date: -1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments(filter);

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Erreur get transactions:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/transactions/summary - Résumé financier
router.get('/summary',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
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

      // Résumé par type
      const summary = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Résumé par catégorie
      const byCategory = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { type: '$type', category: '$category' },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.type': 1, total: -1 } }
      ]);

      // Résumé par mois
      const byMonth = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              type: '$type'
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } }
      ]);

      const incomeData = summary.find(s => s._id === 'income') || { total: 0, count: 0 };
      const expenseData = summary.find(s => s._id === 'expense') || { total: 0, count: 0 };

      res.json({
        success: true,
        data: {
          totalIncome: incomeData.total,
          totalExpense: expenseData.total,
          balance: incomeData.total - expenseData.total,
          incomeCount: incomeData.count,
          expenseCount: expenseData.count,
          byCategory,
          byMonth
        }
      });
    } catch (error) {
      console.error('Erreur transaction summary:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/transactions/budgets
router.get('/budgets',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const wid = new mongoose.Types.ObjectId(req.workspaceId);
      const { month } = req.query;
      let startOfMonth, endOfMonth;
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, monthNum] = month.split('-').map(Number);
        startOfMonth = new Date(year, monthNum - 1, 1);
        endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);
      } else {
        const now = new Date();
        startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      const [budgetDocs, categorySpending, productSpending] = await Promise.all([
        Budget.find({ workspaceId: req.workspaceId, isActive: true }).populate('productId', 'name status sellingPrice').lean(),
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
          { $group: { _id: '$category', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth }, productId: { $ne: null } } },
          { $group: { _id: { category: '$category', productId: '$productId' }, totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } }
        ])
      ]);

      const budgets = budgetDocs.map(budget => {
        let totalSpent, txCount;
        if (budget.productId) {
          const ps = productSpending.find(s => s._id.category === budget.category && s._id.productId.toString() === budget.productId._id.toString());
          totalSpent = ps?.totalSpent || 0;
          txCount = ps?.count || 0;
        } else {
          const cs = categorySpending.find(s => s._id === budget.category) || { totalSpent: 0, count: 0 };
          totalSpent = cs.totalSpent;
          txCount = cs.count;
        }
        const remaining = budget.amount - totalSpent;
        const percentage = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
        return {
          ...budget,
          totalSpent,
          transactionCount: txCount,
          remaining,
          percentage,
          status: percentage > 100 ? 'exceeded' : percentage >= 70 ? 'warning' : 'ok'
        };
      });

      budgets.sort((a, b) => b.percentage - a.percentage);

      res.json({
        success: true,
        data: {
          budgets,
          summary: {
            totalBudget: budgets.reduce((s, b) => s + b.amount, 0),
            totalSpent: budgets.reduce((s, b) => s + b.totalSpent, 0),
            totalRemaining: budgets.reduce((s, b) => s + b.remaining, 0),
            exceededCount: budgets.filter(b => b.status === 'exceeded').length,
            warningCount: budgets.filter(b => b.status === 'warning').length
          }
        }
      });
    } catch (error) {
      console.error('Erreur budgets:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/ecom/transactions/budgets
router.post('/budgets',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const budget = new Budget({
        ...req.body,
        workspaceId: req.workspaceId,
        createdBy: req.ecomUser._id
      });
      await budget.save();
      res.status(201).json({ success: true, data: budget });
    } catch (error) {
      console.error('Erreur create budget:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/transactions/budgets/:id
router.put('/budgets/:id',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const budget = await Budget.findOneAndUpdate(
        { _id: req.params.id, workspaceId: req.workspaceId },
        req.body,
        { new: true }
      );
      if (!budget) return res.status(404).json({ success: false, message: 'Budget non trouvé' });
      res.json({ success: true, data: budget });
    } catch (error) {
      console.error('Erreur update budget:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/ecom/transactions/budgets/:id
router.delete('/budgets/:id',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const budget = await Budget.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!budget) return res.status(404).json({ success: false, message: 'Budget non trouvé' });
      res.json({ success: true, message: 'Budget supprimé' });
    } catch (error) {
      console.error('Erreur delete budget:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ===== ROUTES FINANCIAL CENTER (avant /:id pour éviter capture) =====

// GET /api/ecom/transactions/accounting-summary
router.get('/accounting-summary',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      if (!req.workspaceId) {
        return res.status(400).json({ success: false, message: 'workspaceId manquant' });
      }
      let wid;
      try {
        wid = new mongoose.Types.ObjectId(req.workspaceId);
      } catch (e) {
        console.error('accounting-summary: workspaceId invalide:', req.workspaceId, e.message);
        return res.status(400).json({ success: false, message: 'workspaceId invalide' });
      }
      const now = new Date();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [categoryTotals, monthlyTrend, lastMonthTotals] = await Promise.all([
        Transaction.aggregate([
          { $match: { workspaceId: wid } },
          { $group: { _id: { category: '$category', type: '$type' }, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) } } },
          { $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
            total: { $sum: '$amount' }, count: { $sum: 1 }
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
          { $group: { _id: '$type', total: { $sum: '$amount' } } }
        ])
      ]);

      const expenses = (categoryTotals || []).filter(c => c._id?.type === 'expense');
      const income = (categoryTotals || []).filter(c => c._id?.type === 'income');
      const totalExpenses = expenses.reduce((s, e) => s + (e.total || 0), 0);
      const totalIncome = income.reduce((s, i) => s + (i.total || 0), 0);
      const lastMonthExp = (lastMonthTotals || []).find(t => t._id === 'expense')?.total || 0;
      const lastMonthInc = (lastMonthTotals || []).find(t => t._id === 'income')?.total || 0;

      res.json({
        success: true,
        data: {
          totalExpenses, totalIncome, balance: totalIncome - totalExpenses,
          lastMonth: { expenses: lastMonthExp, income: lastMonthInc },
          categoryBreakdown: categoryTotals || [],
          monthlyTrend: monthlyTrend || [],
          expenseCount: expenses.reduce((s, e) => s + (e.count || 0), 0),
          incomeCount: income.reduce((s, i) => s + (i.count || 0), 0)
        }
      });
    } catch (error) {
      console.error('Erreur accounting summary — détail:', error.name, error.message, 'workspaceId:', req.workspaceId);
      res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/transactions/forecast - Analyse profonde & prévisions
router.get('/forecast',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const wid = new mongoose.Types.ObjectId(req.workspaceId);
      const wsId = req.workspaceId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const daysLeft = daysInMonth - daysPassed;
      const start3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const start6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      // ── Requêtes parallèles massives ──
      const [
        monthSoFar, last6Months, categoryThisMonth, categoryLastMonth,
        ordersThisMonth, ordersLastMonth, ordersByProduct,
        products, budgetDocs, weeklyTrend
      ] = await Promise.all([
        // Transactions ce mois
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: startOfMonth, $lte: now } } },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Tendance 6 mois
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: start6MonthsAgo } } },
          { $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
            total: { $sum: '$amount' }, count: { $sum: 1 }
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),
        // Dépenses par catégorie ce mois
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: startOfMonth, $lte: now } } },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } }
        ]),
        // Dépenses par catégorie mois dernier
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: startLastMonth, $lte: endLastMonth } } },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Commandes ce mois
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: startOfMonth, $lte: now } } },
          { $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
          }}
        ]),
        // Commandes mois dernier
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: startLastMonth, $lte: endLastMonth } } },
          { $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
          }}
        ]),
        // Top produits par commandes ce mois
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: startOfMonth, $lte: now } } },
          { $group: {
            _id: '$product',
            orders: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $in: ['$status', ['returned', 'no_answer']] }, 1, 0] } }
          }},
          { $sort: { revenue: -1 } },
          { $limit: 10 }
        ]),
        // Produits actifs
        Product.find({ workspaceId: wsId, isActive: true }).select('name status sellingPrice productCost deliveryCost avgAdsCost stock').lean(),
        // Budgets actifs
        Budget.find({ workspaceId: wsId, isActive: true }).populate('productId', 'name').lean(),
        // Tendance hebdomadaire (4 dernières semaines)
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) } } },
          { $group: {
            _id: { week: { $isoWeek: '$date' }, type: '$type' },
            total: { $sum: '$amount' }, count: { $sum: 1 }
          }},
          { $sort: { '_id.week': 1 } }
        ])
      ]);

      // ── Calculs de base ──
      const currentExpense = monthSoFar.find(t => t._id === 'expense')?.total || 0;
      const currentIncome = monthSoFar.find(t => t._id === 'income')?.total || 0;
      const dailyExpenseRate = daysPassed > 0 ? currentExpense / daysPassed : 0;
      const dailyIncomeRate = daysPassed > 0 ? currentIncome / daysPassed : 0;
      const projectedExpense = currentExpense + (dailyExpenseRate * daysLeft);
      const projectedIncome = currentIncome + (dailyIncomeRate * daysLeft);
      const ratio = projectedIncome > 0 ? projectedExpense / projectedIncome : 1;
      const healthScore = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100 + 50)));

      // ── Analyse des commandes ──
      const totalOrdersThisMonth = ordersThisMonth.reduce((s, o) => s + o.count, 0);
      const totalRevenueThisMonth = ordersThisMonth.reduce((s, o) => s + o.revenue, 0);
      const deliveredThisMonth = ordersThisMonth.find(o => o._id === 'delivered');
      const totalOrdersLastMonth = ordersLastMonth.reduce((s, o) => s + o.count, 0);
      const totalRevenueLastMonth = ordersLastMonth.reduce((s, o) => s + o.revenue, 0);
      const orderGrowth = totalOrdersLastMonth > 0 ? ((totalOrdersThisMonth - totalOrdersLastMonth) / totalOrdersLastMonth * 100) : 0;
      const revenueGrowth = totalRevenueLastMonth > 0 ? ((totalRevenueThisMonth - totalRevenueLastMonth) / totalRevenueLastMonth * 100) : 0;
      const deliveryRate = totalOrdersThisMonth > 0 ? ((deliveredThisMonth?.count || 0) / totalOrdersThisMonth * 100) : 0;

      // ── Analyse catégories vs mois dernier ──
      const categoryAnalysis = categoryThisMonth.map(cat => {
        const lastMonth = categoryLastMonth.find(c => c._id === cat._id);
        const lastTotal = lastMonth?.total || 0;
        const variation = lastTotal > 0 ? ((cat.total - lastTotal) / lastTotal * 100) : (cat.total > 0 ? 100 : 0);
        const projectedCategory = daysPassed > 0 ? (cat.total / daysPassed) * daysInMonth : 0;
        return {
          category: cat._id,
          currentSpent: cat.total,
          lastMonthSpent: lastTotal,
          variation: Math.round(variation),
          projected: Math.round(projectedCategory),
          txCount: cat.count,
          dailyRate: daysPassed > 0 ? Math.round(cat.total / daysPassed) : 0
        };
      });

      // ── Analyse produits (top performers) ──
      const productAnalysis = ordersByProduct.map(p => {
        const productInfo = products.find(pr => pr.name === p._id);
        const margin = productInfo ? productInfo.sellingPrice - productInfo.productCost - productInfo.deliveryCost : 0;
        const returnRate = p.orders > 0 ? (p.returned / p.orders * 100) : 0;
        const deliveryRateP = p.orders > 0 ? (p.delivered / p.orders * 100) : 0;
        return {
          name: p._id || 'Inconnu',
          orders: p.orders,
          revenue: p.revenue,
          delivered: p.delivered,
          returned: p.returned,
          deliveryRate: Math.round(deliveryRateP),
          returnRate: Math.round(returnRate),
          margin: Math.round(margin),
          estimatedProfit: Math.round(p.delivered * margin),
          stock: productInfo?.stock || null,
          status: productInfo?.status || null
        };
      });

      // ── Alertes budgets ──
      const budgetAlerts = [];
      for (const budget of budgetDocs) {
        const catSpending = categoryThisMonth.find(c => c._id === budget.category);
        const spent = catSpending?.total || 0;
        const pct = budget.amount > 0 ? (spent / budget.amount * 100) : 0;
        const projectedBudgetSpend = daysPassed > 0 ? (spent / daysPassed) * daysInMonth : 0;
        const projectedPct = budget.amount > 0 ? (projectedBudgetSpend / budget.amount * 100) : 0;
        if (pct >= 60 || projectedPct >= 90) {
          budgetAlerts.push({
            name: budget.name,
            category: budget.category,
            product: budget.productId?.name || null,
            amount: budget.amount,
            spent: Math.round(spent),
            percentage: Math.round(pct),
            projectedSpend: Math.round(projectedBudgetSpend),
            projectedPercentage: Math.round(projectedPct),
            severity: pct > 100 ? 'critical' : pct >= 80 ? 'high' : projectedPct >= 100 ? 'medium' : 'low'
          });
        }
      }
      budgetAlerts.sort((a, b) => { const sev = { critical: 4, high: 3, medium: 2, low: 1 }; return sev[b.severity] - sev[a.severity]; });

      // ── Tendance hebdomadaire ──
      const weeks = [...new Set(weeklyTrend.map(w => w._id.week))].sort();
      const weeklyData = weeks.map(w => {
        const exp = weeklyTrend.find(t => t._id.week === w && t._id.type === 'expense')?.total || 0;
        const inc = weeklyTrend.find(t => t._id.week === w && t._id.type === 'income')?.total || 0;
        return { week: w, expenses: Math.round(exp), income: Math.round(inc), balance: Math.round(inc - exp) };
      });

      // ── Tendance mensuelle 6 mois ──
      const monthKeys = [...new Set(last6Months.map(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}`))].sort();
      const monthlyData = monthKeys.map(mk => {
        const exp = last6Months.find(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}` === mk && m._id.type === 'expense')?.total || 0;
        const inc = last6Months.find(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}` === mk && m._id.type === 'income')?.total || 0;
        return { month: mk, expenses: Math.round(exp), income: Math.round(inc), margin: inc > 0 ? Math.round((inc - exp) / inc * 100) : 0 };
      });

      // ── Calcul moyenne mobile 3 mois ──
      const last3MonthsData = monthlyData.slice(-4, -1);
      const avg3mExpense = last3MonthsData.length > 0 ? last3MonthsData.reduce((s, m) => s + m.expenses, 0) / last3MonthsData.length : 0;
      const avg3mIncome = last3MonthsData.length > 0 ? last3MonthsData.reduce((s, m) => s + m.income, 0) / last3MonthsData.length : 0;

      // ── Génération des recommandations ──
      const recommendations = [];

      // Recommandation: ratio dépenses/revenus
      if (ratio > 0.8) {
        recommendations.push({
          type: 'critical', icon: '🚨',
          title: 'Ratio dépenses/revenus critique',
          detail: `Vos dépenses représentent ${Math.round(ratio * 100)}% de vos revenus. Objectif: < 60%.`,
          action: 'Réduire les dépenses non essentielles ou augmenter les prix de vente.'
        });
      } else if (ratio > 0.6) {
        recommendations.push({
          type: 'warning', icon: '⚠️',
          title: 'Marge bénéficiaire serrée',
          detail: `Ratio dépenses/revenus: ${Math.round(ratio * 100)}%. Marge de manœuvre limitée.`,
          action: 'Optimiser les coûts pub et négocier les tarifs fournisseurs.'
        });
      }

      // Recommandation: croissance des commandes
      if (orderGrowth < -15) {
        recommendations.push({
          type: 'critical', icon: '📉',
          title: 'Baisse significative des commandes',
          detail: `${Math.round(orderGrowth)}% vs mois dernier (${totalOrdersThisMonth} vs ${totalOrdersLastMonth}).`,
          action: 'Analyser les campagnes pub, vérifier la saisonnalité, tester de nouveaux produits.'
        });
      } else if (orderGrowth > 20) {
        recommendations.push({
          type: 'success', icon: '🚀',
          title: 'Forte croissance des commandes',
          detail: `+${Math.round(orderGrowth)}% vs mois dernier. Excellente dynamique !`,
          action: 'Vérifier les stocks et la capacité de livraison pour maintenir la qualité.'
        });
      }

      // Recommandation: taux de livraison
      if (deliveryRate < 50 && totalOrdersThisMonth > 5) {
        recommendations.push({
          type: 'warning', icon: '🚚',
          title: 'Taux de livraison faible',
          detail: `Seulement ${Math.round(deliveryRate)}% des commandes livrées ce mois.`,
          action: 'Améliorer le suivi des commandes, former les livreurs, vérifier les adresses.'
        });
      }

      // Recommandation: catégorie en hausse
      const biggestIncrease = categoryAnalysis.find(c => c.variation > 40 && c.currentSpent > 5000);
      if (biggestIncrease) {
        const catLabels = { publicite: 'Publicité', produit: 'Achat produit', livraison: 'Livraison', salaire: 'Salaire', abonnement: 'Abonnements', materiel: 'Matériel', transport: 'Transport', autre_depense: 'Autres' };
        recommendations.push({
          type: 'warning', icon: '📊',
          title: `Hausse des dépenses: ${catLabels[biggestIncrease.category] || biggestIncrease.category}`,
          detail: `+${biggestIncrease.variation}% vs mois dernier. Projeté: ${biggestIncrease.projected} en fin de mois.`,
          action: 'Vérifier si cette hausse est justifiée par une augmentation proportionnelle des revenus.'
        });
      }

      // Recommandation: produits à fort taux de retour
      const highReturnProducts = productAnalysis.filter(p => p.returnRate > 25 && p.orders >= 3);
      if (highReturnProducts.length > 0) {
        recommendations.push({
          type: 'warning', icon: '↩️',
          title: `${highReturnProducts.length} produit(s) avec taux de retour élevé`,
          detail: highReturnProducts.map(p => `${p.name}: ${p.returnRate}% retours`).join(', '),
          action: 'Revoir la qualité produit, les descriptions, ou les zones de livraison problématiques.'
        });
      }

      // Recommandation: stock bas sur produits performants
      const lowStockWinners = productAnalysis.filter(p => p.stock !== null && p.stock < 10 && p.orders >= 5);
      if (lowStockWinners.length > 0) {
        recommendations.push({
          type: 'critical', icon: '📦',
          title: 'Stock critique sur produits performants',
          detail: lowStockWinners.map(p => `${p.name}: ${p.stock} unités restantes`).join(', '),
          action: 'Commander en urgence pour éviter les ruptures de stock.'
        });
      }

      // Recommandation: budgets en danger
      const criticalBudgets = budgetAlerts.filter(b => b.severity === 'critical' || b.severity === 'high');
      if (criticalBudgets.length > 0) {
        recommendations.push({
          type: 'warning', icon: '💰',
          title: `${criticalBudgets.length} budget(s) en dépassement ou proche`,
          detail: criticalBudgets.map(b => `${b.name}: ${b.percentage}% utilisé`).join(', '),
          action: 'Geler les dépenses non urgentes dans ces catégories.'
        });
      }

      // Recommandation: tendance positive
      if (weeklyData.length >= 3) {
        const lastWeeks = weeklyData.slice(-3);
        const improving = lastWeeks.every((w, i) => i === 0 || w.balance >= lastWeeks[i - 1].balance);
        if (improving && lastWeeks[lastWeeks.length - 1].balance > 0) {
          recommendations.push({
            type: 'success', icon: '✅',
            title: 'Tendance hebdomadaire positive',
            detail: 'Le solde s\'améliore chaque semaine. Continuez sur cette lancée.',
            action: 'Maintenir la stratégie actuelle et envisager de réinvestir les profits.'
          });
        }
      }

      // Recommandation: diversification revenus
      const salesIncome = monthSoFar.find(t => t._id === 'income');
      if (salesIncome && currentIncome > 0) {
        const salesPct = (salesIncome.total / currentIncome) * 100;
        if (salesPct < 70) {
          recommendations.push({
            type: 'info', icon: '💡',
            title: 'Revenus diversifiés',
            detail: `Les ventes représentent ${Math.round(salesPct)}% des revenus. Bonne diversification.`,
            action: 'Continuer à développer les sources de revenus alternatives.'
          });
        }
      }

      recommendations.sort((a, b) => {
        const priority = { critical: 4, warning: 3, info: 2, success: 1 };
        return (priority[b.type] || 0) - (priority[a.type] || 0);
      });

      res.json({
        success: true,
        data: {
          // Prévisions de base
          currentExpense, currentIncome,
          projectedExpense: Math.round(projectedExpense),
          projectedIncome: Math.round(projectedIncome),
          projectedBalance: Math.round(projectedIncome - projectedExpense),
          dailyExpenseRate: Math.round(dailyExpenseRate),
          dailyIncomeRate: Math.round(dailyIncomeRate),
          daysPassed, daysLeft, daysInMonth,
          healthScore,
          healthLabel: healthScore >= 70 ? 'Saine' : healthScore >= 40 ? 'Attention' : 'Critique',
          // Moyennes mobiles
          avg3mExpense: Math.round(avg3mExpense),
          avg3mIncome: Math.round(avg3mIncome),
          expenseVsAvg: avg3mExpense > 0 ? Math.round((projectedExpense - avg3mExpense) / avg3mExpense * 100) : 0,
          incomeVsAvg: avg3mIncome > 0 ? Math.round((projectedIncome - avg3mIncome) / avg3mIncome * 100) : 0,
          // Commandes
          orders: {
            thisMonth: totalOrdersThisMonth,
            lastMonth: totalOrdersLastMonth,
            growth: Math.round(orderGrowth),
            revenueThisMonth: Math.round(totalRevenueThisMonth),
            revenueLastMonth: Math.round(totalRevenueLastMonth),
            revenueGrowth: Math.round(revenueGrowth),
            deliveryRate: Math.round(deliveryRate),
            byStatus: ordersThisMonth.map(o => ({ status: o._id, count: o.count, revenue: Math.round(o.revenue) }))
          },
          // Analyses
          categoryAnalysis,
          productAnalysis,
          budgetAlerts,
          weeklyTrend: weeklyData,
          monthlyTrend: monthlyData,
          recommendations
        }
      });
    } catch (error) {
      console.error('Erreur forecast:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/ecom/transactions/forecast/ai - Analyse GPT-4 des données financières
router.post('/forecast/ai',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const { forecastData } = req.body;
      if (!forecastData) {
        return res.status(400).json({ success: false, message: 'Données forecast manquantes' });
      }

      const f = forecastData;
      const catLabels = { publicite: 'Publicité', produit: 'Achat produit', livraison: 'Livraison', salaire: 'Salaire', abonnement: 'Abonnements', materiel: 'Matériel', transport: 'Transport', autre_depense: 'Autres dépenses' };

      // Construire un résumé structuré pour GPT
      const summary = `
Tu es un expert en analyse financière et e-commerce. Analyse les données suivantes d'une boutique en ligne et fournis une analyse détaillée, actionnable et professionnelle en français.

## DONNÉES FINANCIÈRES DU MOIS EN COURS

### Prévisions fin de mois
- Dépenses projetées: ${f.projectedExpense?.toLocaleString('fr-FR')} FCFA
- Entrées projetées: ${f.projectedIncome?.toLocaleString('fr-FR')} FCFA  
- Solde projeté: ${f.projectedBalance?.toLocaleString('fr-FR')} FCFA
- Score de santé financière: ${f.healthScore}/100 (${f.healthLabel})
- Avancement du mois: ${f.daysPassed}/${f.daysInMonth} jours

### Rythme journalier
- Dépenses/jour: ${f.dailyExpenseRate?.toLocaleString('fr-FR')} FCFA
- Entrées/jour: ${f.dailyIncomeRate?.toLocaleString('fr-FR')} FCFA

### Comparaison vs moyenne 3 mois
- Dépenses vs moy. 3m: ${f.expenseVsAvg > 0 ? '+' : ''}${f.expenseVsAvg}%
- Entrées vs moy. 3m: ${f.incomeVsAvg > 0 ? '+' : ''}${f.incomeVsAvg}%
- Moy. dépenses 3m: ${f.avg3mExpense?.toLocaleString('fr-FR')} FCFA
- Moy. entrées 3m: ${f.avg3mIncome?.toLocaleString('fr-FR')} FCFA

### Commandes
- Ce mois: ${f.orders?.thisMonth} commandes (${f.orders?.growth > 0 ? '+' : ''}${f.orders?.growth}% vs mois dernier)
- CA commandes: ${f.orders?.revenueThisMonth?.toLocaleString('fr-FR')} FCFA (${f.orders?.revenueGrowth > 0 ? '+' : ''}${f.orders?.revenueGrowth}% vs mois dernier)
- Taux de livraison: ${f.orders?.deliveryRate}%
- Statuts: ${(f.orders?.byStatus || []).map(s => `${s.status}: ${s.count}`).join(', ')}

### Dépenses par catégorie (ce mois vs mois dernier)
${(f.categoryAnalysis || []).map(c => `- ${catLabels[c.category] || c.category}: ${c.currentSpent?.toLocaleString('fr-FR')} FCFA (${c.variation > 0 ? '+' : ''}${c.variation}% vs mois dernier, projeté: ${c.projected?.toLocaleString('fr-FR')} FCFA)`).join('\n')}

### Top produits (commandes ce mois)
${(f.productAnalysis || []).slice(0, 5).map(p => `- ${p.name}: ${p.orders} commandes, CA ${p.revenue?.toLocaleString('fr-FR')} FCFA, taux livraison ${p.deliveryRate}%, taux retour ${p.returnRate}%, profit estimé ${p.estimatedProfit?.toLocaleString('fr-FR')} FCFA${p.stock !== null ? `, stock: ${p.stock}` : ''}`).join('\n')}

### Alertes budgets
${(f.budgetAlerts || []).length > 0 ? (f.budgetAlerts || []).map(a => `- ${a.name}: ${a.percentage}% utilisé (projeté: ${a.projectedPercentage}%), sévérité: ${a.severity}`).join('\n') : 'Aucune alerte budget'}

### Tendance mensuelle (6 mois)
${(f.monthlyTrend || []).map(m => `- ${m.month}: entrées ${m.income?.toLocaleString('fr-FR')} FCFA, dépenses ${m.expenses?.toLocaleString('fr-FR')} FCFA, marge ${m.margin}%`).join('\n')}

## FORMAT DE RÉPONSE ATTENDU

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`json) avec cette structure exacte:
{
  "resume": "Résumé exécutif en 2-3 phrases percutantes",
  "diagnostic": "Diagnostic approfondi de la situation financière (3-5 phrases)",
  "points_forts": ["point fort 1", "point fort 2", "point fort 3"],
  "points_faibles": ["point faible 1", "point faible 2", "point faible 3"],
  "opportunites": ["opportunité 1", "opportunité 2"],
  "risques": ["risque 1", "risque 2"],
  "actions_prioritaires": [
    {"priorite": "URGENT", "action": "action à faire", "impact": "impact attendu"},
    {"priorite": "IMPORTANT", "action": "action à faire", "impact": "impact attendu"},
    {"priorite": "MOYEN TERME", "action": "action à faire", "impact": "impact attendu"}
  ],
  "prevision_optimiste": "Scénario optimiste si les bonnes actions sont prises",
  "prevision_pessimiste": "Scénario pessimiste si rien ne change",
  "conseil_expert": "Conseil personnalisé d'expert en une phrase forte"
}
`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: summary }],
        temperature: 0.4,
        max_tokens: 2000
      });

      const raw = completion.choices[0].message.content.trim();

      let analysis;
      try {
        analysis = JSON.parse(raw);
      } catch {
        // Si GPT retourne du markdown malgré tout
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resume: raw, diagnostic: '', points_forts: [], points_faibles: [], opportunites: [], risques: [], actions_prioritaires: [], prevision_optimiste: '', prevision_pessimiste: '', conseil_expert: '' };
      }

      res.json({ success: true, analysis, tokensUsed: completion.usage?.total_tokens });
    } catch (error) {
      console.error('Erreur forecast/ai:', error);
      res.status(500).json({ success: false, message: error.message || 'Erreur OpenAI' });
    }
  }
);

// POST /api/ecom/transactions/strategic-analysis - Rapport stratégique ultra détaillé via GPT-4o
router.post('/strategic-analysis',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const wid = new mongoose.Types.ObjectId(req.workspaceId);
      const wsId = req.workspaceId;
      const now = new Date();
      const { startDate, endDate } = req.body;

      // ── Calcul des périodes ──
      const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = endDate ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })() : now;
      const periodDays = Math.max(1, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)));

      // Période précédente (même durée)
      const prevEnd = new Date(periodStart.getTime() - 1);
      prevEnd.setHours(23, 59, 59, 999);
      const prevStart = new Date(prevEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const daysLeft = daysInMonth - daysPassed;
      const start6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

      // ── Requêtes parallèles massives ──
      const [
        txPeriod, txPrevPeriod,
        catPeriod, catPrevPeriod,
        ordersPeriod, ordersPrevPeriod,
        ordersByCity, ordersByProduct, ordersByLivreur,
        products, budgetDocs,
        campaigns, dailyReports,
        monthlyTrend, weeklyTrend
      ] = await Promise.all([
        // Transactions période actuelle
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: periodStart, $lte: periodEnd } } },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Transactions période précédente
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: prevStart, $lte: prevEnd } } },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Dépenses par catégorie période actuelle
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: periodStart, $lte: periodEnd } } },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } }
        ]),
        // Dépenses par catégorie période précédente
        Transaction.aggregate([
          { $match: { workspaceId: wid, type: 'expense', date: { $gte: prevStart, $lte: prevEnd } } },
          { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]),
        // Commandes période actuelle par statut
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: periodStart, $lte: periodEnd } } },
          { $group: {
            _id: '$status', count: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
          }}
        ]),
        // Commandes période précédente par statut
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: prevStart, $lte: prevEnd } } },
          { $group: {
            _id: '$status', count: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
          }}
        ]),
        // Commandes par ville (top 10)
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: periodStart, $lte: periodEnd }, city: { $ne: '' } } },
          { $group: {
            _id: '$city', orders: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $in: ['$status', ['returned', 'no_answer']] }, 1, 0] } }
          }},
          { $sort: { revenue: -1 } }, { $limit: 10 }
        ]),
        // Commandes par produit (top 10)
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: periodStart, $lte: periodEnd } } },
          { $group: {
            _id: '$product', orders: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $in: ['$status', ['returned', 'no_answer']] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
          }},
          { $sort: { revenue: -1 } }, { $limit: 10 }
        ]),
        // Performance par livreur/closeuse (top 10)
        Order.aggregate([
          { $match: { workspaceId: wid, date: { $gte: periodStart, $lte: periodEnd }, assignedLivreur: { $ne: null } } },
          { $group: {
            _id: '$assignedLivreur', orders: { $sum: 1 },
            revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } },
            delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $in: ['$status', ['returned', 'no_answer']] }, 1, 0] } }
          }},
          { $sort: { orders: -1 } }, { $limit: 10 }
        ]),
        // Produits actifs
        Product.find({ workspaceId: wsId, isActive: true }).select('name status sellingPrice productCost deliveryCost avgAdsCost stock reorderThreshold').lean(),
        // Budgets actifs
        Budget.find({ workspaceId: wsId, isActive: true }).populate('productId', 'name').lean(),
        // Campagnes récentes (30 jours)
        Campaign.find({ workspaceId: wsId, createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } })
          .select('name type status stats sentAt').sort({ createdAt: -1 }).limit(10).lean(),
        // Rapports journaliers du mois
        DailyReport.find({ workspaceId: wsId, date: { $gte: startOfMonth } })
          .populate('productId', 'name').select('date productId ordersReceived ordersDelivered adSpend').lean(),
        // Tendance mensuelle 6 mois
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: start6MonthsAgo } } },
          { $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
            total: { $sum: '$amount' }, count: { $sum: 1 }
          }},
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]),
        // Tendance hebdomadaire (4 semaines)
        Transaction.aggregate([
          { $match: { workspaceId: wid, date: { $gte: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) } } },
          { $group: {
            _id: { week: { $isoWeek: '$date' }, type: '$type' },
            total: { $sum: '$amount' }, count: { $sum: 1 }
          }},
          { $sort: { '_id.week': 1 } }
        ])
      ]);

      // ── Enrichir les livreurs avec leurs noms ──
      const livreurIds = ordersByLivreur.map(l => l._id).filter(Boolean);
      const livreurUsers = livreurIds.length > 0
        ? await EcomUser.find({ _id: { $in: livreurIds } }).select('email').lean()
        : [];

      // ── Calculs de base ──
      const curIncome = txPeriod.find(t => t._id === 'income')?.total || 0;
      const curExpense = txPeriod.find(t => t._id === 'expense')?.total || 0;
      const curProfit = curIncome - curExpense;
      const prevIncome = txPrevPeriod.find(t => t._id === 'income')?.total || 0;
      const prevExpense = txPrevPeriod.find(t => t._id === 'expense')?.total || 0;
      const prevProfit = prevIncome - prevExpense;
      const incomeGrowth = prevIncome > 0 ? ((curIncome - prevIncome) / prevIncome * 100) : 0;
      const expenseGrowth = prevExpense > 0 ? ((curExpense - prevExpense) / prevExpense * 100) : 0;
      const profitGrowth = prevProfit !== 0 ? ((curProfit - prevProfit) / Math.abs(prevProfit) * 100) : 0;

      const dailyExpRate = periodDays > 0 ? curExpense / periodDays : 0;
      const dailyIncRate = periodDays > 0 ? curIncome / periodDays : 0;
      const projectedExpense = curExpense + (dailyExpRate * daysLeft);
      const projectedIncome = curIncome + (dailyIncRate * daysLeft);
      const burnRate = dailyExpRate;
      const cashFlow = curIncome - curExpense;
      const ratio = projectedIncome > 0 ? projectedExpense / projectedIncome : 1;
      const healthScore = Math.max(0, Math.min(100, Math.round((1 - ratio) * 100 + 50)));

      // ── Analyse catégories ──
      const catLabels = { publicite: 'Publicité', produit: 'Achat produit', livraison: 'Livraison', salaire: 'Salaire', abonnement: 'Abonnements', materiel: 'Matériel', transport: 'Transport', autre_depense: 'Autres dépenses' };
      const totalExpense = curExpense || 1;
      const categoryData = catPeriod.map(c => {
        const prev = catPrevPeriod.find(p => p._id === c._id);
        const pct = (c.total / totalExpense * 100);
        const variation = prev?.total > 0 ? ((c.total - prev.total) / prev.total * 100) : 0;
        return {
          category: catLabels[c._id] || c._id,
          amount: c.total,
          percentage: Math.round(pct * 10) / 10,
          variation: Math.round(variation),
          prevAmount: prev?.total || 0,
          txCount: c.count
        };
      });

      // ── Analyse commandes ──
      const totalOrders = ordersPeriod.reduce((s, o) => s + o.count, 0);
      const totalRevenue = ordersPeriod.reduce((s, o) => s + o.revenue, 0);
      const deliveredOrders = ordersPeriod.find(o => o._id === 'delivered');
      const deliveryRate = totalOrders > 0 ? ((deliveredOrders?.count || 0) / totalOrders * 100) : 0;
      const prevTotalOrders = ordersPrevPeriod.reduce((s, o) => s + o.count, 0);
      const orderGrowth = prevTotalOrders > 0 ? ((totalOrders - prevTotalOrders) / prevTotalOrders * 100) : 0;
      const deliveredRevenue = deliveredOrders?.revenue || 0;
      const lostRevenue = totalRevenue - deliveredRevenue;
      const deliveryImpact = totalRevenue > 0 ? (lostRevenue / totalRevenue * 100) : 0;

      // ── Analyse produits avec ROI ──
      const productData = ordersByProduct.map(p => {
        const info = products.find(pr => pr.name === p._id);
        const margin = info ? info.sellingPrice - info.productCost - info.deliveryCost : 0;
        const marginPct = info?.sellingPrice > 0 ? (margin / info.sellingPrice * 100) : 0;
        const returnRate = p.orders > 0 ? (p.returned / p.orders * 100) : 0;
        const delivRate = p.orders > 0 ? (p.delivered / p.orders * 100) : 0;
        const estProfit = p.delivered * margin;
        const adsCost = info?.avgAdsCost || 0;
        const totalAdsCostEst = adsCost * p.orders;
        const roi = totalAdsCostEst > 0 ? ((estProfit - totalAdsCostEst) / totalAdsCostEst * 100) : 0;
        const costAcquisition = p.delivered > 0 ? Math.round(totalAdsCostEst / p.delivered) : 0;
        return {
          name: p._id || 'Inconnu',
          orders: p.orders, delivered: p.delivered, returned: p.returned, cancelled: p.cancelled || 0,
          revenue: Math.round(p.revenue), deliveryRate: Math.round(delivRate), returnRate: Math.round(returnRate),
          margin: Math.round(margin), marginPct: Math.round(marginPct),
          estimatedProfit: Math.round(estProfit), roi: Math.round(roi),
          costAcquisition, stock: info?.stock ?? null, status: info?.status || null,
          sellingPrice: info?.sellingPrice || 0, productCost: info?.productCost || 0,
          deliveryCost: info?.deliveryCost || 0, avgAdsCost: adsCost
        };
      });

      // ── Analyse villes ──
      const cityData = ordersByCity.map(c => {
        const delivRate = c.orders > 0 ? (c.delivered / c.orders * 100) : 0;
        const returnRate = c.orders > 0 ? (c.returned / c.orders * 100) : 0;
        return {
          city: c._id, orders: c.orders, revenue: Math.round(c.revenue),
          delivered: c.delivered, returned: c.returned,
          deliveryRate: Math.round(delivRate), returnRate: Math.round(returnRate)
        };
      });

      // ── Analyse closeuses/livreurs ──
      const livreurData = ordersByLivreur.map(l => {
        const user = livreurUsers.find(u => u._id.toString() === l._id?.toString());
        const delivRate = l.orders > 0 ? (l.delivered / l.orders * 100) : 0;
        return {
          name: user?.email?.split('@')[0] || 'Inconnu',
          orders: l.orders, delivered: l.delivered, returned: l.returned,
          revenue: Math.round(l.revenue), deliveryRate: Math.round(delivRate)
        };
      });

      // ── Alertes budgets ──
      const budgetData = budgetDocs.map(b => {
        const catSpend = catPeriod.find(c => c._id === b.category);
        const spent = catSpend?.total || 0;
        const pct = b.amount > 0 ? (spent / b.amount * 100) : 0;
        const projected = periodDays > 0 ? (spent / daysPassed) * daysInMonth : 0;
        return {
          name: b.name, category: catLabels[b.category] || b.category,
          product: b.productId?.name || null,
          limit: b.amount, spent: Math.round(spent), percentage: Math.round(pct),
          projected: Math.round(projected), status: pct > 100 ? 'dépassé' : pct >= 80 ? 'attention' : pct >= 60 ? 'à surveiller' : 'ok'
        };
      });

      // ── Campagnes ──
      const campaignData = campaigns.map(c => ({
        name: c.name, type: c.type, status: c.status,
        targeted: c.stats?.targeted || 0, sent: c.stats?.sent || 0, failed: c.stats?.failed || 0,
        successRate: c.stats?.targeted > 0 ? Math.round((c.stats.sent / c.stats.targeted) * 100) : 0
      }));

      // ── Rapports journaliers agrégés ──
      const totalAdSpend = dailyReports.reduce((s, r) => s + (r.adSpend || 0), 0);
      const totalDailyOrders = dailyReports.reduce((s, r) => s + (r.ordersReceived || 0), 0);
      const totalDailyDelivered = dailyReports.reduce((s, r) => s + (r.ordersDelivered || 0), 0);

      // ── Stock alerts ──
      const stockAlerts = products.filter(p => p.stock <= (p.reorderThreshold || 10)).map(p => ({
        name: p.name, stock: p.stock, threshold: p.reorderThreshold || 10, status: p.status
      }));

      // ── Tendances mensuelles ──
      const monthKeys = [...new Set(monthlyTrend.map(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}`))].sort();
      const monthlyData = monthKeys.map(mk => {
        const exp = monthlyTrend.find(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}` === mk && m._id.type === 'expense')?.total || 0;
        const inc = monthlyTrend.find(m => `${m._id.year}-${String(m._id.month).padStart(2, '0')}` === mk && m._id.type === 'income')?.total || 0;
        return { month: mk, income: Math.round(inc), expenses: Math.round(exp), profit: Math.round(inc - exp), margin: inc > 0 ? Math.round((inc - exp) / inc * 100) : 0 };
      });

      // ── Construction du prompt GPT-4o ──
      const prompt = `Tu es un consultant senior combinant les compétences d'un Data Analyst senior, d'un Contrôleur de gestion et d'un Consultant business stratégique.

Analyse les données financières suivantes d'une boutique e-commerce et produis un rapport stratégique ULTRA DÉTAILLÉ en français. Tu ne dois PAS simplement reformuler les chiffres — tu dois ANALYSER, INTERPRÉTER, IDENTIFIER LES PROBLÈMES, IDENTIFIER LES OPPORTUNITÉS et DONNER DES RECOMMANDATIONS CONCRÈTES ET ACTIONNABLES.

═══════════════════════════════════════
1. DONNÉES FINANCIÈRES — PÉRIODE ANALYSÉE
═══════════════════════════════════════
Période: ${periodStart.toLocaleDateString('fr-FR')} → ${periodEnd.toLocaleDateString('fr-FR')} (${periodDays} jours)

• Chiffre d'affaires: ${curIncome.toLocaleString('fr-FR')} FCFA (${incomeGrowth > 0 ? '+' : ''}${Math.round(incomeGrowth)}% vs période précédente)
• Total dépenses: ${curExpense.toLocaleString('fr-FR')} FCFA (${expenseGrowth > 0 ? '+' : ''}${Math.round(expenseGrowth)}% vs période précédente)
• Bénéfice net: ${curProfit.toLocaleString('fr-FR')} FCFA (${profitGrowth > 0 ? '+' : ''}${Math.round(profitGrowth)}% vs période précédente)
• Cash flow: ${cashFlow.toLocaleString('fr-FR')} FCFA
• Score santé financière: ${healthScore}/100
• Burn rate journalier: ${Math.round(burnRate).toLocaleString('fr-FR')} FCFA/jour
• Rythme entrées/jour: ${Math.round(dailyIncRate).toLocaleString('fr-FR')} FCFA/jour
• Projection fin de mois: Revenus ${Math.round(projectedIncome).toLocaleString('fr-FR')} FCFA — Dépenses ${Math.round(projectedExpense).toLocaleString('fr-FR')} FCFA
• Avancement mois: ${daysPassed}/${daysInMonth} jours (${daysLeft} jours restants)

═══════════════════════════════════════
2. DÉPENSES PAR CATÉGORIE
═══════════════════════════════════════
${categoryData.map(c => `• ${c.category}: ${c.amount.toLocaleString('fr-FR')} FCFA (${c.percentage}% du total, ${c.variation > 0 ? '+' : ''}${c.variation}% vs précédent, ${c.txCount} transactions)`).join('\n')}

═══════════════════════════════════════
3. COMMANDES & LIVRAISON
═══════════════════════════════════════
• Total commandes: ${totalOrders} (${orderGrowth > 0 ? '+' : ''}${Math.round(orderGrowth)}% vs précédent)
• CA commandes: ${totalRevenue.toLocaleString('fr-FR')} FCFA
• Taux de livraison: ${Math.round(deliveryRate)}%
• CA perdu (non livré): ${Math.round(lostRevenue).toLocaleString('fr-FR')} FCFA (${Math.round(deliveryImpact)}% du CA)
• Répartition statuts: ${ordersPeriod.map(o => `${o._id}: ${o.count}`).join(', ')}

═══════════════════════════════════════
4. PERFORMANCE PAR PRODUIT (ROI & Rentabilité)
═══════════════════════════════════════
${productData.slice(0, 8).map(p => `• ${p.name}: ${p.orders} cmd, ${p.delivered} livrées, taux livr. ${p.deliveryRate}%, taux retour ${p.returnRate}%, marge unitaire ${p.margin.toLocaleString('fr-FR')} FCFA (${p.marginPct}%), profit estimé ${p.estimatedProfit.toLocaleString('fr-FR')} FCFA, ROI pub ${p.roi}%, coût acquisition ${p.costAcquisition.toLocaleString('fr-FR')} FCFA, stock: ${p.stock ?? 'N/A'}, statut: ${p.status || 'N/A'}`).join('\n')}

═══════════════════════════════════════
5. PERFORMANCE PAR VILLE (Top 10)
═══════════════════════════════════════
${cityData.map(c => `• ${c.city}: ${c.orders} cmd, CA ${c.revenue.toLocaleString('fr-FR')} FCFA, taux livr. ${c.deliveryRate}%, taux retour ${c.returnRate}%`).join('\n') || 'Aucune donnée ville'}

═══════════════════════════════════════
6. PERFORMANCE PAR CLOSEUSE/LIVREUR
═══════════════════════════════════════
${livreurData.map(l => `• ${l.name}: ${l.orders} cmd, ${l.delivered} livrées, taux livr. ${l.deliveryRate}%, CA ${l.revenue.toLocaleString('fr-FR')} FCFA`).join('\n') || 'Aucune donnée closeuse'}

═══════════════════════════════════════
7. BUDGETS (défini vs réel)
═══════════════════════════════════════
${budgetData.map(b => `• ${b.name} (${b.category}${b.product ? ' — ' + b.product : ''}): limite ${b.limit.toLocaleString('fr-FR')} FCFA, dépensé ${b.spent.toLocaleString('fr-FR')} FCFA (${b.percentage}%), projeté fin mois ${b.projected.toLocaleString('fr-FR')} FCFA, statut: ${b.status}`).join('\n') || 'Aucun budget défini'}

═══════════════════════════════════════
8. CAMPAGNES MARKETING (30 derniers jours)
═══════════════════════════════════════
${campaignData.map(c => `• ${c.name} (${c.type}): statut ${c.status}, ciblés ${c.targeted}, envoyés ${c.sent}, taux succès ${c.successRate}%`).join('\n') || 'Aucune campagne'}
Dépenses pub totales (rapports journaliers): ${totalAdSpend.toLocaleString('fr-FR')} FCFA

═══════════════════════════════════════
9. ALERTES STOCK
═══════════════════════════════════════
${stockAlerts.map(s => `• ${s.name}: ${s.stock} unités (seuil: ${s.threshold}), statut produit: ${s.status}`).join('\n') || 'Aucune alerte stock'}

═══════════════════════════════════════
10. TENDANCE MENSUELLE (6 mois)
═══════════════════════════════════════
${monthlyData.map(m => `• ${m.month}: CA ${m.income.toLocaleString('fr-FR')}, dépenses ${m.expenses.toLocaleString('fr-FR')}, profit ${m.profit.toLocaleString('fr-FR')}, marge ${m.margin}%`).join('\n')}

═══════════════════════════════════════
FORMAT DE RÉPONSE ATTENDU
═══════════════════════════════════════

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`json) avec cette structure EXACTE:

{
  "situation_globale": {
    "resume_executif": "Résumé en 3-4 phrases percutantes de la situation globale",
    "interpretation": "Analyse détaillée: la situation est-elle saine, stable, risquée ou critique ? Pourquoi ?",
    "chiffres_cles": [
      {"label": "...", "valeur": "...", "tendance": "hausse|baisse|stable", "commentaire": "..."}
    ],
    "cash_flow_analyse": "Analyse du cash flow et de la trésorerie"
  },
  "analyse_depenses": {
    "synthese": "Synthèse en 2-3 phrases sur la structure des dépenses",
    "categorie_critique": "Quelle catégorie pose problème et pourquoi",
    "anomalies": ["anomalie 1 détectée", "anomalie 2"],
    "optimisations": ["optimisation possible 1", "optimisation possible 2"]
  },
  "roi_rentabilite": {
    "synthese": "Synthèse ROI global en 2-3 phrases",
    "produit_star": {"nom": "...", "raison": "...", "action": "..."},
    "produit_probleme": {"nom": "...", "raison": "...", "action": "..."},
    "produits_a_surveiller": [{"nom": "...", "raison": "..."}],
    "cout_acquisition_moyen": "Analyse du coût d'acquisition client",
    "marge_nette_reelle": "Analyse de la marge nette réelle"
  },
  "analyse_operationnelle": {
    "impact_livraison": "Impact du taux de livraison sur le profit — chiffré",
    "performance_closeuses": [{"nom": "...", "verdict": "...", "action": "..."}],
    "ville_plus_rentable": {"nom": "...", "raison": "..."},
    "ville_problematique": {"nom": "...", "raison": "...", "action": "..."},
    "segment_performant": "Segment client/produit le plus performant"
  },
  "projections_risques": {
    "projection_fin_mois": "Projection détaillée fin de mois avec chiffres",
    "risque_perte": "Évaluation du risque de perte — probabilité et montant",
    "burn_rate_analyse": "Analyse du burn rate et de la viabilité",
    "ruptures_stock": ["produit à risque 1", "produit à risque 2"],
    "desequilibre_budget": ["budget en danger 1", "budget en danger 2"],
    "score_risque_global": "faible|moyen|élevé|critique"
  },
  "recommandations": [
    {"priorite": "CRITIQUE", "action": "Action concrète et précise", "impact": "Impact attendu chiffré", "categorie": "finance|produit|operations|marketing|stock"},
    {"priorite": "IMPORTANT", "action": "...", "impact": "...", "categorie": "..."},
    {"priorite": "OPPORTUNITE", "action": "...", "impact": "...", "categorie": "..."}
  ],
  "note_strategique": "Conseil stratégique global d'expert en 2-3 phrases puissantes"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.35,
        max_tokens: 4000
      });

      const raw = completion.choices[0].message.content.trim();

      let analysis;
      try {
        analysis = JSON.parse(raw);
      } catch {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = { situation_globale: { resume_executif: raw, interpretation: '', chiffres_cles: [], cash_flow_analyse: '' }, analyse_depenses: { synthese: '', categorie_critique: '', anomalies: [], optimisations: [] }, roi_rentabilite: { synthese: '', produit_star: {}, produit_probleme: {}, produits_a_surveiller: [], cout_acquisition_moyen: '', marge_nette_reelle: '' }, analyse_operationnelle: { impact_livraison: '', performance_closeuses: [], ville_plus_rentable: {}, ville_problematique: {}, segment_performant: '' }, projections_risques: { projection_fin_mois: '', risque_perte: '', burn_rate_analyse: '', ruptures_stock: [], desequilibre_budget: [], score_risque_global: 'moyen' }, recommandations: [], note_strategique: '' };
        }
      }

      res.json({
        success: true,
        data: {
          analysis,
          rawMetrics: {
            curIncome, curExpense, curProfit, prevIncome, prevExpense, prevProfit,
            incomeGrowth: Math.round(incomeGrowth), expenseGrowth: Math.round(expenseGrowth), profitGrowth: Math.round(profitGrowth),
            healthScore, deliveryRate: Math.round(deliveryRate), totalOrders, totalRevenue: Math.round(totalRevenue),
            burnRate: Math.round(burnRate), daysPassed, daysLeft, daysInMonth,
            projectedIncome: Math.round(projectedIncome), projectedExpense: Math.round(projectedExpense)
          },
          details: { categoryData, productData, cityData, livreurData, budgetData, campaignData, stockAlerts, monthlyData }
        },
        tokensUsed: completion.usage?.total_tokens
      });

    } catch (error) {
      console.error('Erreur strategic-analysis:', error);
      res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
    }
  }
);

// GET /api/ecom/transactions/:id - Détail d'une transaction
router.get('/:id',
  requireEcomAuth,
  validateEcomAccess('finance', 'read'),
  async (req, res) => {
    try {
      const transaction = await Transaction.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
      }

      res.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Erreur get transaction:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// POST /api/ecom/transactions - Créer une transaction
router.post('/',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const { date, type, category, amount, description, reference, productId } = req.body;

      const errors = [];
      if (!date) errors.push('Date requise');
      if (!type || !['income', 'expense'].includes(type)) errors.push('Type invalide (income ou expense)');
      if (!category) errors.push('Catégorie requise');
      if (!amount || amount <= 0) errors.push('Montant requis et doit être positif');

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Erreurs de validation', errors });
      }

      const transaction = new Transaction({
        workspaceId: req.workspaceId,
        date: new Date(date),
        type,
        category,
        amount,
        description: description || '',
        reference: reference || '',
        productId: productId || null,
        createdBy: req.ecomUser._id
      });

      await transaction.save();

      const populated = await Transaction.findById(transaction._id)
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      // ── Notifications asynchrones (non bloquantes) ──
      if (type === 'expense') {
        // Vérifier les alertes budget en arrière-plan
        _checkBudgetAlerts(req.workspaceId, category, req.ecomUser).catch(() => {});
      }
      // Alerte transaction critique
      if (amount >= CRITICAL_TX_THRESHOLD) {
        _notifyCriticalTx(transaction, req.workspaceId, req.ecomUser).catch(() => {});
      }

      res.status(201).json({
        success: true,
        message: 'Transaction créée avec succès',
        data: populated
      });
    } catch (error) {
      console.error('Erreur create transaction:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// PUT /api/ecom/transactions/:id - Modifier une transaction
router.put('/:id',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const transaction = await Transaction.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
      }

      Object.assign(transaction, req.body);
      if (req.body.date) transaction.date = new Date(req.body.date);
      await transaction.save();

      const updated = await Transaction.findById(transaction._id)
        .populate('productId', 'name')
        .populate('createdBy', 'email');

      res.json({
        success: true,
        message: 'Transaction mise à jour',
        data: updated
      });
    } catch (error) {
      console.error('Erreur update transaction:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// DELETE /api/ecom/transactions/:id - Supprimer une transaction
router.delete('/:id',
  requireEcomAuth,
  validateEcomAccess('finance', 'write'),
  async (req, res) => {
    try {
      const transaction = await Transaction.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
      if (!transaction) {
        return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
      }

      await Transaction.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Transaction supprimée' });
    } catch (error) {
      console.error('Erreur delete transaction:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// ─── Helpers notifications internes ─────────────────────────────────────────

async function _checkBudgetAlerts(workspaceId, category, actor) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const wid = new mongoose.Types.ObjectId(workspaceId);

    const [budgets, spending] = await Promise.all([
      Budget.find({ workspaceId, isActive: true, category }).lean(),
      Transaction.aggregate([
        { $match: { workspaceId: wid, type: 'expense', category, date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    if (!budgets.length) return;

    const totalSpent = spending[0]?.total || 0;
    const workspace = await Workspace.findById(workspaceId).lean();
    const admin = await EcomUser.findOne({ workspaceId, role: 'ecom_admin', isActive: true }).lean();
    if (!admin) return;

    const currency = actor?.currency || 'XAF';

    for (const budget of budgets) {
      const percentage = budget.amount > 0 ? (totalSpent / budget.amount) * 100 : 0;
      const enriched = { ...budget, totalSpent, percentage, remaining: budget.amount - totalSpent };

      if (percentage > 100) {
        notifyBudgetExceeded(admin.email, { budget: enriched, workspace, currency, userId: admin._id }).catch(() => {});
      } else if (percentage >= 70) {
        notifyBudgetWarning(admin.email, { budget: enriched, workspace, currency, userId: admin._id }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[transactions] _checkBudgetAlerts:', err.message);
  }
}

async function _notifyCriticalTx(transaction, workspaceId, actor) {
  try {
    const workspace = await Workspace.findById(workspaceId).lean();
    const admin = await EcomUser.findOne({ workspaceId, role: 'ecom_admin', isActive: true }).lean();
    if (!admin) return;
    const currency = actor?.currency || 'XAF';
    notifyCriticalTransaction(admin.email, {
      transaction, workspace, currency,
      threshold: CRITICAL_TX_THRESHOLD,
      userId: admin._id
    }).catch(() => {});
  } catch (err) {
    console.warn('[transactions] _notifyCriticalTx:', err.message);
  }
}

export default router;
