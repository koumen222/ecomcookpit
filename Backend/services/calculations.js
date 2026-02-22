// Service de calculs financiers et métriques

export const formatCurrency = (amount, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatPercent = (value, decimals = 1) => {
  return `${(value * 100).toFixed(decimals)}%`;
};

export const calculateROI = (revenue, costs) => {
  if (costs === 0) return 0;
  return ((revenue - costs) / costs) * 100;
};

export const calculateROAS = (revenue, adSpend) => {
  if (adSpend === 0) return 0;
  return revenue / adSpend;
};

export const calculateProfitMargin = (revenue, costs) => {
  if (revenue === 0) return 0;
  return ((revenue - costs) / revenue) * 100;
};

export const calculateBreakEvenPoint = (fixedCosts, variableCostPerUnit, sellingPrice) => {
  const contributionMargin = sellingPrice - variableCostPerUnit;
  if (contributionMargin <= 0) return null; // Impossible de atteindre le seuil de rentabilité
  return Math.ceil(fixedCosts / contributionMargin);
};

export const calculateInventoryTurnover = (cogs, averageInventory) => {
  if (averageInventory === 0) return 0;
  return cogs / averageInventory;
};

export const calculateDaysOfInventory = (averageInventory, cogs) => {
  const turnover = calculateInventoryTurnover(cogs, averageInventory);
  if (turnover === 0) return Infinity;
  return 365 / turnover;
};

export const calculateCustomerAcquisitionCost = (totalAdSpend, totalNewCustomers) => {
  if (totalNewCustomers === 0) return 0;
  return totalAdSpend / totalNewCustomers;
};

export const calculateLifetimeValue = (avgOrderValue, purchaseFrequency, customerLifetime) => {
  return avgOrderValue * purchaseFrequency * customerLifetime;
};

export const calculateLTVtoCACRatio = (ltv, cac) => {
  if (cac === 0) return Infinity;
  return ltv / cac;
};

export const calculateCashConversionCycle = (daysInventory, daysReceivable, daysPayable) => {
  return daysInventory + daysReceivable - daysPayable;
};

// Calculs spécifiques au e-commerce
export const calculateProductMetrics = (product, reports) => {
  if (!reports || reports.length === 0) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      conversionRate: 0,
      profitPerOrder: 0,
      totalProfit: 0,
      roas: 0,
      deliveryRate: 0,
      profitMargin: 0
    };
  }

  const totalOrdersReceived = reports.reduce((sum, report) => sum + report.ordersReceived, 0);
  const totalOrdersDelivered = reports.reduce((sum, report) => sum + report.ordersDelivered, 0);
  const totalAdSpend = reports.reduce((sum, report) => sum + report.adSpend, 0);
  
  const totalRevenue = totalOrdersDelivered * product.sellingPrice;
  const totalProductCost = totalOrdersDelivered * product.productCost;
  const totalDeliveryCost = totalOrdersDelivered * product.deliveryCost;
  const totalCost = totalProductCost + totalDeliveryCost + totalAdSpend;
  const totalProfit = totalRevenue - totalCost;

  return {
    totalRevenue,
    totalOrders: totalOrdersDelivered,
    avgOrderValue: totalOrdersDelivered > 0 ? totalRevenue / totalOrdersDelivered : 0,
    conversionRate: totalOrdersReceived > 0 ? totalOrdersDelivered / totalOrdersReceived : 0,
    profitPerOrder: totalOrdersDelivered > 0 ? totalProfit / totalOrdersDelivered : 0,
    totalProfit,
    roas: calculateROAS(totalRevenue, totalAdSpend),
    deliveryRate: totalOrdersReceived > 0 ? totalOrdersDelivered / totalOrdersReceived : 0,
    profitMargin: calculateProfitMargin(totalRevenue, totalCost)
  };
};

export const calculateTrend = (currentValue, previousValue) => {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
};

export const calculateMovingAverage = (data, period) => {
  if (data.length < period) return data;
  
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
};

export const calculateSeasonalityIndex = (monthlyData) => {
  const yearlyAverage = monthlyData.reduce((sum, month) => sum + month, 0) / monthlyData.length;
  return monthlyData.map(month => (month / yearlyAverage) * 100);
};

export const calculateGrowthRate = (values) => {
  if (values.length < 2) return 0;
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  
  if (firstValue === 0) return lastValue > 0 ? 100 : 0;
  
  return ((lastValue - firstValue) / firstValue) * 100;
};

export const calculateCompoundGrowthRate = (values, periods) => {
  if (values.length < 2) return 0;
  
  const firstValue = values[0];
  const lastValue = values[values.length - 1];
  
  if (firstValue <= 0) return 0;
  
  return (Math.pow(lastValue / firstValue, 1 / periods) - 1) * 100;
};

export const calculateWeightedAverage = (values, weights) => {
  if (values.length !== weights.length) return 0;
  
  const weightedSum = values.reduce((sum, value, index) => sum + value * weights[index], 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

export const calculateStandardDeviation = (values) => {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / values.length;
  
  return Math.sqrt(variance);
};

export const calculateCoefficientOfVariation = (values) => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const stdDev = calculateStandardDeviation(values);
  
  return mean !== 0 ? (stdDev / mean) * 100 : 0;
};

// Calculs de performance de stock
export const calculateStockMetrics = (products, stockOrders) => {
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.isActive).length;
  const outOfStockProducts = products.filter(p => p.stock === 0 && p.isActive).length;
  const lowStockProducts = products.filter(p => p.isLowStock() && p.isActive).length;
  
  const totalStockValue = products.reduce((sum, product) => 
    sum + (product.stock * product.sellingPrice), 0);
  
  const totalStockCost = products.reduce((sum, product) => 
    sum + (product.stock * product.productCost), 0);
  
  const inTransitOrders = stockOrders.filter(order => order.status === 'in_transit');
  const delayedOrders = inTransitOrders.filter(order => order.isDelayed());
  
  return {
    totalProducts,
    activeProducts,
    outOfStockProducts,
    lowStockProducts,
    stockHealthScore: ((activeProducts - outOfStockProducts) / activeProducts) * 100,
    totalStockValue,
    totalStockCost,
    inTransitOrdersCount: inTransitOrders.length,
    delayedOrdersCount: delayedOrders.length,
    averageDeliveryTime: calculateAverageDeliveryTime(stockOrders)
  };
};

export const calculateAverageDeliveryTime = (stockOrders) => {
  const deliveredOrders = stockOrders.filter(order => 
    order.status === 'received' && order.actualArrival && order.orderDate);
  
  if (deliveredOrders.length === 0) return 0;
  
  const totalDays = deliveredOrders.reduce((sum, order) => {
    const days = Math.floor((order.actualArrival - order.orderDate) / (1000 * 60 * 60 * 24));
    return sum + days;
  }, 0);
  
  return totalDays / deliveredOrders.length;
};

export const calculateForecast = (historicalData, periods) => {
  if (historicalData.length < 3) return [];
  
  // Simple linear regression forecast
  const n = historicalData.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = historicalData;
  
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const forecast = [];
  for (let i = 0; i < periods; i++) {
    forecast.push(slope * (n + i) + intercept);
  }
  
  return forecast.map(val => Math.max(0, val)); // Ensure non-negative values
};
