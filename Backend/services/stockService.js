import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockLocation from '../models/StockLocation.js';

export class StockAdjustmentError extends Error {
  constructor(message, status = 400, code = 'STOCK_ADJUSTMENT_ERROR') {
    super(message);
    this.name = 'StockAdjustmentError';
    this.status = status;
    this.code = code;
  }
}

const toObjectId = (value) => {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return new mongoose.Types.ObjectId(value);
};

export const adjustProductStock = async ({ workspaceId, productId, delta, session } = {}) => {
  if (!workspaceId) throw new StockAdjustmentError('Workspace requis', 400, 'WORKSPACE_REQUIRED');
  if (!productId) throw new StockAdjustmentError('Produit requis', 400, 'PRODUCT_REQUIRED');
  if (!Number.isFinite(delta) || delta === 0) {
    throw new StockAdjustmentError('Delta de stock invalide', 400, 'INVALID_DELTA');
  }

  const wsId = toObjectId(workspaceId);
  const pId = toObjectId(productId);

  if (delta < 0) {
    const needed = Math.abs(delta);
    const updated = await Product.findOneAndUpdate(
      { _id: pId, workspaceId: wsId, stock: { $gte: needed } },
      { $inc: { stock: delta } },
      { new: true, session }
    );

    if (updated) return updated;

    const existing = await Product.findOne({ _id: pId, workspaceId: wsId }).select('stock name');
    if (!existing) throw new StockAdjustmentError('Produit non trouvé', 404, 'PRODUCT_NOT_FOUND');
    throw new StockAdjustmentError(`Stock insuffisant. Actuel: ${existing.stock}`, 400, 'INSUFFICIENT_STOCK');
  }

  const updated = await Product.findOneAndUpdate(
    { _id: pId, workspaceId: wsId },
    { $inc: { stock: delta } },
    { new: true, session }
  );

  if (!updated) throw new StockAdjustmentError('Produit non trouvé', 404, 'PRODUCT_NOT_FOUND');
  return updated;
};

export const adjustStockLocationQuantity = async ({ workspaceId, entryId, adjustment, userId, reason } = {}) => {
  if (!workspaceId) throw new StockAdjustmentError('Workspace requis', 400, 'WORKSPACE_REQUIRED');
  if (!entryId) throw new StockAdjustmentError('Emplacement requis', 400, 'LOCATION_REQUIRED');
  if (!Number.isFinite(adjustment) || adjustment === 0) {
    throw new StockAdjustmentError('Ajustement requis (positif ou négatif)', 400, 'INVALID_ADJUSTMENT');
  }

  const wsId = toObjectId(workspaceId);
  const eId = toObjectId(entryId);

  const filter = { _id: eId, workspaceId: wsId };
  if (adjustment < 0) filter.quantity = { $gte: Math.abs(adjustment) };

  const updated = await StockLocation.findOneAndUpdate(
    filter,
    {
      $inc: { quantity: adjustment },
      $set: { updatedBy: userId }
    },
    { new: true, runValidators: true }
  );

  if (updated) {
    if (reason) {
      const fragment = `${adjustment > 0 ? '+' : ''}${adjustment}: ${reason}`;
      updated.notes = updated.notes ? `${updated.notes} | ${fragment}` : fragment;
      await updated.save();
    }
    return updated;
  }

  const existing = await StockLocation.findOne({ _id: eId, workspaceId: wsId }).select('quantity');
  if (!existing) throw new StockAdjustmentError('Emplacement non trouvé', 404, 'LOCATION_NOT_FOUND');
  throw new StockAdjustmentError(`Stock insuffisant. Actuel: ${existing.quantity}`, 400, 'INSUFFICIENT_STOCK');
};
