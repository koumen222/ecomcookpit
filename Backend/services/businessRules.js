import Product from '../models/Product.js';
import DailyReport from '../models/DailyReport.js';
import StockOrder from '../models/StockOrder.js';

// Service de validation des règles métier
export const checkBusinessRules = async (action, context) => {
  const { user, product, productData, updateData, decisionData } = context;

  switch (action) {
    case 'createProduct':
      return await checkCreateProductRules(user, productData);
    
    case 'updateProduct':
      return await checkUpdateProductRules(user, product, updateData);
    
    case 'scale':
      return await checkScaleRules(user, product);
    
    case 'stop':
      return await checkStopRules(user, product);
    
    case 'reorder':
      return await checkReorderRules(user, product, decisionData);
    
    case 'continue':
      return await checkContinueRules(user, product);
    
    default:
      return { allowed: true };
  }
};

// Règle: vérifier le rôle pour créer un produit
const checkCreateProductRules = async (user, productData) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut créer des produits' };
  }

  return { allowed: true };
};

// Règles pour mise à jour de produit
const checkUpdateProductRules = async (user, product, updateData) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut modifier des produits' };
  }

  return { allowed: true };
};

// Règle: scale interdit si deliveryRate < 0.7
const checkScaleRules = async (user, product) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut scaler un produit' };
  }

  // Calculer le delivery rate des 7 derniers jours
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const recentReports = await DailyReport.find({
    productId: product._id,
    date: { $gte: sevenDaysAgo }
  });

  if (recentReports.length === 0) {
    return { 
      allowed: false, 
      message: 'Pas assez de données récentes pour prendre une décision de scale (minimum 7 jours requis)' 
    };
  }

  const totalOrdersReceived = recentReports.reduce((sum, report) => sum + report.ordersReceived, 0);
  const totalOrdersDelivered = recentReports.reduce((sum, report) => sum + report.ordersDelivered, 0);
  const deliveryRate = totalOrdersReceived > 0 ? totalOrdersDelivered / totalOrdersReceived : 0;

  if (deliveryRate < 0.7) {
    return { 
      allowed: false, 
      message: `Taux de livraison trop faible (${(deliveryRate * 100).toFixed(1)}%). Scale interdit en dessous de 70%.` 
    };
  }

  // Vérifier la rentabilité
  const totalRevenue = recentReports.reduce((sum, report) => 
    sum + (report.ordersDelivered * product.sellingPrice), 0);
  const totalCost = recentReports.reduce((sum, report) => 
    sum + (report.ordersDelivered * (product.productCost + product.deliveryCost + product.avgAdsCost)) + report.adSpend, 0);
  const profit = totalRevenue - totalCost;

  if (profit <= 0) {
    return { 
      allowed: false, 
      message: 'Produit non rentable sur les 7 derniers jours. Scale interdit.' 
    };
  }

  return { allowed: true };
};

// Règles pour arrêter un produit
const checkStopRules = async (user, product) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut arrêter un produit' };
  }

  return { allowed: true };
};

// Règles pour réapprovisionnement
const checkReorderRules = async (user, product, decisionData) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut commander du stock' };
  }

  if (!product.isLowStock()) {
    return { 
      allowed: false, 
      message: 'Le stock n\'est pas encore bas. Pas besoin de réapprovisionnement.' 
    };
  }

  // Calculer la quantité suggérée (2x le seuil de réapprovisionnement)
  const suggestedQuantity = product.reorderThreshold * 2;
  const estimatedCost = suggestedQuantity * product.productCost;

  return { 
    allowed: true,
    stockOrderData: {
      productId: product._id,
      quantity: suggestedQuantity,
      expectedArrival: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 jours
      totalCost: estimatedCost,
      notes: `Commande automatique suite à décision de réapprovisionnement. Stock actuel: ${product.stock}`
    }
  };
};

// Règles pour continuer
const checkContinueRules = async (user, product) => {
  if (user.role !== 'ecom_admin') {
    return { allowed: false, message: 'Seul un admin peut décider de continuer un produit' };
  }

  return { allowed: true };
};

// Service de calcul des métriques financières
export const calculateFinancialMetrics = async (productId, startDate, endDate) => {
  const matchStage = {};
  if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }

  const metrics = await DailyReport.aggregate([
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
        _id: '$productId',
        productId: { $first: '$productId' },
        productName: { $first: '$product.name' },
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
        totalOrdersDelivered: { $sum: '$ordersDelivered' },
        totalReports: { $sum: 1 }
      }
    },
    {
      $addFields: {
        totalCost: { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] },
        totalProfit: { $subtract: [
          { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] },
          { $multiply: ['$totalOrdersDelivered', '$product.sellingPrice'] }
        ]},
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
        },
        profitMargin: {
          $cond: [
            { $eq: ['$totalRevenue', 0] },
            0,
            { $divide: [
              { $subtract: ['$totalRevenue', { $add: ['$totalProductCost', '$totalDeliveryCost', '$totalAdSpend'] }] },
              '$totalRevenue'
            ]}
          ]
        }
      }
    }
  ]);

  return metrics;
};

// Service de calcul des alertes stock
export const getStockAlerts = async () => {
  const alerts = {
    critical: [], // Stock = 0
    high: [],     // Stock <= seuil/2
    medium: []    // Stock <= seuil
  };

  const lowStockProducts = await Product.find({
    isActive: true,
    $expr: { $lte: ['$stock', '$reorderThreshold'] }
  }).populate('createdBy', 'email');

  lowStockProducts.forEach(product => {
    const alert = {
      product: product.toObject(),
      urgency: 'medium',
      message: `Stock bas pour ${product.name}: ${product.stock} unités (seuil: ${product.reorderThreshold})`
    };

    if (product.stock === 0) {
      alert.urgency = 'critical';
      alert.message = `Stock critique pour ${product.name}: RUPTURE DE STOCK`;
      alerts.critical.push(alert);
    } else if (product.stock <= product.reorderThreshold / 2) {
      alert.urgency = 'high';
      alerts.high.push(alert);
    } else {
      alerts.medium.push(alert);
    }
  });

  return alerts;
};

// Service de suggestions de décisions
export const getDecisionSuggestions = async () => {
  const suggestions = [];

  // Produits en rupture de stock -> suggérer réapprovisionnement
  const outOfStockProducts = await Product.find({
    isActive: true,
    stock: 0
  });

  outOfStockProducts.forEach(product => {
    suggestions.push({
      type: 'reorder',
      productId: product._id,
      productName: product.name,
      priority: 'high',
      reason: `Produit en rupture de stock. Réapprovisionnement urgent nécessaire.`,
      suggestedQuantity: product.reorderThreshold * 2
    });
  });

  // Produits avec mauvais delivery rate -> suggérer stop
  const productsWithPoorDelivery = await DailyReport.aggregate([
    {
      $match: {
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: '$productId',
        totalOrdersReceived: { $sum: '$ordersReceived' },
        totalOrdersDelivered: { $sum: '$ordersDelivered' }
      }
    },
    {
      $addFields: {
        deliveryRate: {
          $cond: [
            { $eq: ['$totalOrdersReceived', 0] },
            0,
            { $divide: ['$totalOrdersDelivered', '$totalOrdersReceived'] }
          ]
        }
      }
    },
    {
      $match: { deliveryRate: { $lt: 0.5 } }
    }
  ]);

  for (const productData of productsWithPoorDelivery) {
    const product = await Product.findById(productData._id);
    if (product && product.isActive) {
      suggestions.push({
        type: 'stop',
        productId: product._id,
        productName: product.name,
        priority: 'medium',
        reason: `Taux de livraison très faible (${(productData.deliveryRate * 100).toFixed(1)}%). Considérer l'arrêt du produit.`
      });
    }
  }

  return suggestions;
};
