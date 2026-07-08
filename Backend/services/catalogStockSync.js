import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StoreProduct from '../models/StoreProduct.js';
import StockLocation from '../models/StockLocation.js';

// Construit un Product interne à partir d'un produit boutique (StoreProduct)
function buildInternalProductPayload({ name, price, stock, workspaceId, userId }) {
  const sellingPrice = Number(price) || 0;
  const inferredCost = sellingPrice > 0 ? Math.max(0, Math.floor(sellingPrice * 0.4)) : 0;
  return {
    workspaceId,
    createdBy: userId || undefined,
    name: name || 'Produit',
    status: 'test',
    sellingPrice,
    productCost: inferredCost,
    deliveryCost: 0,
    avgAdsCost: 0,
    stock: Number(stock) || 0,
    reorderThreshold: 10,
    isActive: true,
  };
}

const isValidId = (v) => v && mongoose.Types.ObjectId.isValid(v);

// Garantit qu'un produit boutique possède un Product interne lié (1:1). Le crée si absent.
export async function ensureLinkedProduct(storeProduct, { workspaceId, userId }) {
  if (isValidId(storeProduct.linkedProductId)) {
    const exists = await Product.exists({ _id: storeProduct.linkedProductId, workspaceId });
    if (exists) return storeProduct.linkedProductId;
  }
  // Tente un rapprochement par nom avant d'en créer un nouveau
  const byName = await Product.findOne({ workspaceId, name: storeProduct.name }).select('_id').lean();
  if (byName?._id) {
    await StoreProduct.updateOne({ _id: storeProduct._id }, { $set: { linkedProductId: byName._id } });
    return byName._id;
  }
  const created = await Product.create(buildInternalProductPayload({
    name: storeProduct.name,
    price: storeProduct.price,
    stock: storeProduct.stock,
    workspaceId,
    userId,
  }));
  await StoreProduct.updateOne({ _id: storeProduct._id }, { $set: { linkedProductId: created._id } });
  return created._id;
}

// Agrège les entrées StockLocation d'un produit interne
async function aggregateForProduct(workspaceId, productId) {
  const [agg] = await StockLocation.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(String(workspaceId)), productId: new mongoose.Types.ObjectId(String(productId)) } },
    { $group: {
        _id: '$productId',
        totalInitial: { $sum: '$quantity' },
        totalSales: { $sum: '$sales' },
        locations: { $sum: 1 },
      } },
  ]);
  const totalInitial = agg?.totalInitial || 0;
  const totalSales = agg?.totalSales || 0;
  const locations = agg?.locations || 0;
  const available = Math.max(0, totalInitial - totalSales);
  return { totalInitial, totalSales, locations, available, hasEntries: locations > 0 };
}

// Recalcule le stock d'UN produit interne et le propage au catalogue (Product + StoreProduct liés).
// Retourne le stock disponible effectif.
export async function recomputeProductStock({ workspaceId, productId }) {
  if (!isValidId(productId)) return null;
  const { available, hasEntries } = await aggregateForProduct(workspaceId, productId);
  if (!hasEntries) return null; // pas d'entrées de stock : on ne touche pas au stock catalogue

  await Product.updateOne({ _id: productId, workspaceId }, { $set: { stock: available } });
  await StoreProduct.updateMany({ workspaceId, linkedProductId: productId }, { $set: { stock: available } });
  return available;
}

const statusFor = (available) => {
  if (available <= 0) return 'rupture';
  if (available <= 5) return 'critique';
  if (available <= 15) return 'faible';
  return 'ok';
};

// Vue synchronisée : TOUS les produits boutique de la boutique active, liés à un Product
// interne, avec leur stock agrégé. Écrit aussi l'agrégat vers le catalogue (sync quantités).
export async function getSyncedCatalogOverview({ workspaceId, storeId, userId }) {
  const storeFilter = { workspaceId };
  if (isValidId(storeId)) storeFilter.storeId = storeId;

  const storeProducts = await StoreProduct.find(storeFilter)
    .select('_id name price stock images linkedProductId isPublished')
    .sort({ createdAt: -1 })
    .lean();

  const rows = [];
  for (const sp of storeProducts) {
    const productId = await ensureLinkedProduct(sp, { workspaceId, userId });
    const { totalInitial, totalSales, locations, available, hasEntries } = await aggregateForProduct(workspaceId, productId);

    // Stock effectif : agrégat des emplacements si présents, sinon le stock de base du catalogue
    const effectiveStock = hasEntries ? available : (Number(sp.stock) || 0);

    // Sync des quantités : aligne le catalogue sur l'agrégat quand il y a des emplacements
    if (hasEntries && Number(sp.stock) !== effectiveStock) {
      await StoreProduct.updateOne({ _id: sp._id }, { $set: { stock: effectiveStock } });
      await Product.updateOne({ _id: productId, workspaceId }, { $set: { stock: effectiveStock } });
    }

    rows.push({
      storeProductId: sp._id,
      productId,
      name: sp.name,
      image: sp.images?.[0]?.url || '',
      price: sp.price || 0,
      isPublished: sp.isPublished !== false,
      totalInitial: hasEntries ? totalInitial : (Number(sp.stock) || 0),
      totalSales,
      locations,
      available: effectiveStock,
      hasEntries,
      status: statusFor(effectiveStock),
    });
  }

  return rows;
}
