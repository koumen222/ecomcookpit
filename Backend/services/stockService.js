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

/**
 * Décrémente le stock d'un produit lors de la livraison d'une commande.
 * Cette fonction cherche les StockLocation du produit et les décrémente
 * en commençant par celles qui ont le plus de stock (FIFO inversé).
 *
 * @param {Object} params - Paramètres
 * @param {string} params.workspaceId - ID du workspace
 * @param {string} params.productId - ID du produit
 * @param {number} params.quantity - Quantité à décrémenter
 * @param {string} params.orderId - ID de la commande (pour les logs)
 * @returns {Promise<{success: boolean, decremented: number, locations: Array}>}
 */
export const decrementStockForDelivery = async ({ workspaceId, productId, quantity, orderId }) => {
  if (!workspaceId || !productId || !quantity || quantity <= 0) {
    throw new StockAdjustmentError('Paramètres invalides', 400, 'INVALID_PARAMS');
  }

  const wsId = toObjectId(workspaceId);
  const pId = toObjectId(productId);

  // Récupérer toutes les locations du produit
  const locations = await StockLocation.find({
    workspaceId: wsId,
    productId: pId
  }).sort({ quantity: -1 });

  if (locations.length === 0) {
    // Aucune StockLocation trouvée, ne rien faire (le stock n'est pas géré par locations)
    return { success: false, decremented: 0, locations: [], reason: 'NO_STOCK_LOCATIONS' };
  }

  // Calculer le stock total disponible (quantity - sales)
  const totalAvailable = locations.reduce((sum, loc) => {
    const stockRestant = Math.max(0, (loc.quantity || 0) - (loc.sales || 0));
    return sum + stockRestant;
  }, 0);

  // Décrémenter les locations une par une
  // IMPORTANT: quantity = stock initial (ne change jamais)
  //           sales = nombre de ventes (s'incrémente)
  //           stock restant = quantity - sales
  let remaining = quantity;
  const decrementedLocations = [];

  for (const location of locations) {
    if (remaining <= 0) break;

    const stockRestant = Math.max(0, (location.quantity || 0) - (location.sales || 0));
    if (stockRestant <= 0) continue;

    const toDecrement = Math.min(stockRestant, remaining);

    // NE PAS toucher à quantity (stock initial)
    // Incrémenter SEULEMENT sales
    location.sales = (location.sales || 0) + toDecrement;

    // Ajouter une note sur la vente
    const note = `Vente: ${toDecrement} unités (Commande #${orderId})`;
    location.notes = location.notes ? `${location.notes} | ${note}` : note;

    await location.save();

    const newStockRestant = Math.max(0, location.quantity - location.sales);

    decrementedLocations.push({
      locationId: location._id,
      city: location.city,
      agency: location.agency,
      stockInitial: location.quantity,
      ventesAvant: location.sales - toDecrement,
      ventesApres: location.sales,
      decremented: toDecrement,
      stockRestant: newStockRestant
    });

    remaining -= toDecrement;
  }

  const totalDecremented = quantity - remaining;

  return {
    success: true,
    decremented: totalDecremented,
    requested: quantity,
    locations: decrementedLocations
  };
};
