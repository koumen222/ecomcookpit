// ─────────────────────────────────────────────────────────────────────────────
//  reportGenerationService — génère les rapports quotidiens (DailyReport) par
//  produit à partir des commandes livrées/reçues. Réutilisé par la route
//  /reports/auto-generate ET par l'assistant Scalor (action report.generate).
// ─────────────────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import DailyReport from '../models/DailyReport.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

/**
 * @param {object} params
 *   { workspaceId, userId?, date?, startDate?, endDate?, mappings? }
 * @returns {Promise<{ created:[], updated:[], skipped:[], unmatched:[] }>}
 */
export async function generateDailyReports({ workspaceId, userId = null, date = null, startDate = null, endDate = null, mappings = [] } = {}) {
  if (!workspaceId) throw new Error('workspaceId requis');

  const manualMap = {};
  if (Array.isArray(mappings)) {
    mappings.forEach((m) => { if (m?.orderProductName && m?.productId) manualMap[String(m.orderProductName).toLowerCase().trim()] = m.productId; });
  }

  let dateFilter;
  if (date) {
    dateFilter = { $gte: new Date(`${date}T00:00:00.000Z`), $lte: new Date(`${date}T23:59:59.999Z`) };
  } else if (startDate || endDate) {
    dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) dateFilter.$lte = new Date(`${endDate}T23:59:59.999Z`);
  } else {
    const today = new Date().toISOString().split('T')[0];
    dateFilter = { $gte: new Date(`${today}T00:00:00.000Z`), $lte: new Date(`${today}T23:59:59.999Z`) };
  }

  const wsOid = new mongoose.Types.ObjectId(workspaceId);

  const [deliveredAgg, allOrdersAgg] = await Promise.all([
    Order.aggregate([
      { $match: { workspaceId: wsOid, status: 'delivered', $or: [{ statusModifiedAt: dateFilter }, { $and: [{ statusModifiedAt: null }, { updatedAt: dateFilter }] }] } },
      { $addFields: { _deliveryDate: { $ifNull: ['$statusModifiedAt', '$updatedAt'] } } },
      { $group: { _id: { dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$_deliveryDate' } }, product: '$product' }, ordersDelivered: { $sum: { $ifNull: ['$quantity', 1] } } } },
    ]),
    Order.aggregate([
      { $addFields: { _orderDate: { $ifNull: ['$date', '$createdAt'] } } },
      { $match: { workspaceId: wsOid, product: { $ne: '' }, _orderDate: dateFilter } },
      { $group: { _id: { dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$_orderDate' } }, product: '$product' }, ordersReceived: { $sum: 1 } } },
    ]),
  ]);

  if (deliveredAgg.length === 0) {
    return { created: [], updated: [], skipped: [], unmatched: [] };
  }

  const receivedMap = {};
  allOrdersAgg.forEach((r) => { receivedMap[`${r._id.dateKey}|${r._id.product}`] = r.ordersReceived; });

  const products = await Product.find({ workspaceId }, { name: 1, sellingPrice: 1, productCost: 1, deliveryCost: 1 }).lean();
  const productByName = {};
  products.forEach((p) => { if (p.name) productByName[p.name.toLowerCase().trim()] = p; });

  const created = [];
  const updated = [];
  const skipped = [];
  const unmatchedMap = {};

  for (const agg of deliveredAgg) {
    const { dateKey, product: productName } = agg._id;
    if (!productName || !productName.trim()) { skipped.push({ reason: 'Nom de produit vide', dateKey }); continue; }

    const key = productName.toLowerCase().trim();
    let productDoc = productByName[key];
    if (!productDoc && manualMap[key]) productDoc = products.find((p) => p._id.toString() === manualMap[key]);

    if (!productDoc) {
      if (!unmatchedMap[productName]) unmatchedMap[productName] = { productName, totalDelivered: 0, totalReceived: 0, dates: [] };
      const ordDel = agg.ordersDelivered || 0;
      const ordRec = receivedMap[`${dateKey}|${productName}`] || 0;
      unmatchedMap[productName].totalDelivered += ordDel;
      unmatchedMap[productName].totalReceived += ordRec;
      unmatchedMap[productName].dates.push({ dateKey, ordersDelivered: ordDel, ordersReceived: ordRec });
      continue;
    }

    const ordersDelivered = agg.ordersDelivered || 0;
    const ordersReceived = receivedMap[`${dateKey}|${productName}`] || 0;
    const reportDate = new Date(`${dateKey}T00:00:00.000Z`);
    const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);

    const sp = productDoc.sellingPrice || 0;
    const pc = productDoc.productCost || 0;
    const dc = productDoc.deliveryCost || 0;
    const revenue = sp * ordersDelivered;
    const computedProductCost = pc * ordersDelivered;
    const computedDeliveryCost = dc * ordersDelivered;
    const cost = (pc + dc) * ordersDelivered;
    const profit = revenue - cost;

    const existing = await DailyReport.findOne({ workspaceId, date: { $gte: dayStart, $lte: dayEnd }, productId: productDoc._id });
    if (existing) {
      const adSpend = existing.adSpend || 0;
      const updatedRevenue = adSpend > 0 ? existing.revenue : revenue;
      const updatedCost = adSpend > 0 ? existing.cost : cost + adSpend;
      await DailyReport.updateOne({ _id: existing._id }, { $set: {
        ordersDelivered, ordersReceived, quantity: ordersDelivered,
        productCost: computedProductCost, deliveryCost: computedDeliveryCost,
        revenue: updatedRevenue, cost: updatedCost, profit: updatedRevenue - updatedCost,
      } });
      updated.push({ dateKey, productName: productDoc.name });
    } else {
      await DailyReport.create({
        workspaceId, date: reportDate, productId: productDoc._id,
        ordersReceived, ordersDelivered, quantity: ordersDelivered, adSpend: 0,
        revenue, productCost: computedProductCost, deliveryCost: computedDeliveryCost, cost, profit,
        reportedBy: userId || null, notes: 'Rapport généré automatiquement',
      });
      created.push({ dateKey, productName: productDoc.name });
    }
  }

  return { created, updated, skipped, unmatched: Object.values(unmatchedMap) };
}

export default { generateDailyReports };
