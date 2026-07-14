import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockOrder from '../models/StockOrder.js';
import ScalorAgentAction from '../models/ScalorAgentAction.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import { sendWhatsAppMessage } from './whatsappService.js';

const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'shipped', 'in_delivery', 'delivered', 'postponed', 'reported', 'cancelled', 'returned', 'refused']);
const PRODUCT_STATUSES = new Set(['test', 'stable', 'winner', 'pause', 'stop']);
const ROLE_ACTIONS = {
  super_admin: '*',
  ecom_admin: '*',
  ecom_closeuse: new Set(['order.create', 'order.update_status', 'whatsapp.send', 'orders.relance']),
  ecom_compta: new Set(['order.update_status', 'product.update_price', 'report.generate']),
  ecom_livreur: new Set(['order.update_status']),
  service_client: new Set(['order.update_status', 'whatsapp.send', 'orders.relance']),
};

const number = (value, label, { min = 0, required = true } = {}) => {
  const parsed = Number(value);
  if ((!Number.isFinite(parsed) || parsed < min) && required) throw new Error(`${label} invalide`);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value, label, max = 300) => {
  const clean = String(value || '').trim();
  if (!clean) throw new Error(`${label} requis`);
  return clean.slice(0, max);
};

function canExecute(role, actionType) {
  const allowed = ROLE_ACTIONS[role];
  return allowed === '*' || allowed?.has(actionType);
}

async function findOrder(workspaceId, user, orderId) {
  const query = { workspaceId, orderId: text(orderId, 'Numéro de commande', 100) };
  if (user.role === 'ecom_closeuse') query.closerId = user._id;
  if (user.role === 'ecom_livreur') query.assignedLivreur = user._id;
  const order = await Order.findOne(query);
  if (!order) throw new Error('Commande introuvable dans votre périmètre');
  return order;
}

async function findUniqueProduct(workspaceId, name) {
  const cleanName = text(name, 'Nom du produit', 200);
  const products = await Product.find({ workspaceId, name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).limit(2);
  if (!products.length) throw new Error('Produit introuvable');
  if (products.length > 1) throw new Error('Plusieurs produits portent ce nom, précisez lequel dans Scalor');
  return products[0];
}

async function performAction(action, context) {
  const { workspaceId, user, sourceMessage } = context;
  const type = action?.type;
  const payload = action?.payload || {};
  if (!canExecute(user.role, type)) throw new Error("Votre rôle n'autorise pas cette action");

  if (type === 'order.update_status') {
    const order = await findOrder(workspaceId, user, payload.orderId);
    const status = String(payload.status || '').trim();
    if (!ORDER_STATUSES.has(status)) throw new Error('Statut de commande non autorisé');
    if (user.role === 'ecom_livreur' && !['in_delivery', 'delivered', 'returned'].includes(status)) throw new Error('Statut non autorisé pour un livreur');
    order.status = status;
    order.statusModifiedManually = true;
    order.statusModifiedAt = new Date();
    await order.save();
    return { label: `Commande ${order.orderId} passée à « ${status} »`, entityId: order.orderId };
  }

  if (type === 'order.create') {
    const order = await Order.create({
      workspaceId,
      orderId: payload.orderId ? String(payload.orderId).slice(0, 100) : `#IA_${Date.now().toString(36).toUpperCase()}`,
      date: new Date(),
      clientName: text(payload.clientName, 'Nom du client', 150),
      clientPhone: text(payload.clientPhone, 'Téléphone du client', 40),
      city: String(payload.city || '').trim().slice(0, 100),
      address: String(payload.address || '').trim().slice(0, 250),
      product: text(payload.product, 'Produit', 200),
      quantity: number(payload.quantity ?? 1, 'Quantité', { min: 1 }),
      price: number(payload.price, 'Prix', { min: 0 }),
      status: ORDER_STATUSES.has(payload.status) ? payload.status : 'pending',
      source: 'manual',
      tags: ['assistant-ia'],
      closerId: user.role === 'ecom_closeuse' ? user._id : null,
    });
    return { label: `Commande ${order.orderId} créée`, entityId: order.orderId };
  }

  if (type === 'order.delete') {
    if (!/supprim\w*[\s\S]*(définit|confirme)|(?:définit|confirme)[\s\S]*supprim/i.test(sourceMessage)) throw new Error('La suppression définitive doit être confirmée explicitement');
    const order = await findOrder(workspaceId, user, payload.orderId);
    const orderId = order.orderId;
    await order.deleteOne();
    return { label: `Commande ${orderId} supprimée définitivement`, entityId: orderId };
  }

  if (type === 'report.generate') {
    const { generateDailyReports } = await import('./reportGenerationService.js');
    const date = payload.date ? String(payload.date).slice(0, 10) : null;
    const startDate = payload.startDate ? String(payload.startDate).slice(0, 10) : null;
    const endDate = payload.endDate ? String(payload.endDate).slice(0, 10) : null;
    const result = await generateDailyReports({ workspaceId, userId: user._id, date, startDate, endDate });
    const period = date ? `du ${date}` : (startDate || endDate) ? `${startDate || '…'} → ${endDate || '…'}` : "d'aujourd'hui";
    const unmatched = result.unmatched.length ? ` · ${result.unmatched.length} produit(s) à assigner manuellement` : '';
    return {
      label: `Rapports ${period} générés : ${result.created.length} créé(s), ${result.updated.length} mis à jour${unmatched}`,
      entityId: null,
    };
  }

  if (type === 'product.update_price') {
    const product = await findUniqueProduct(workspaceId, payload.name);
    product.sellingPrice = number(payload.sellingPrice, 'Prix de vente', { min: 0 });
    await product.save();
    return { label: `Prix de « ${product.name} » mis à jour`, entityId: String(product._id) };
  }

  if (type === 'product.update_status') {
    const product = await findUniqueProduct(workspaceId, payload.name);
    const status = String(payload.status || '').trim();
    if (!PRODUCT_STATUSES.has(status)) throw new Error('Statut produit non valide (test, stable, winner, pause, stop)');
    product.status = status;
    await product.save();
    return { label: `« ${product.name} » passé au statut « ${status} »`, entityId: String(product._id) };
  }

  if (type === 'product.update_stock') {
    const product = await findUniqueProduct(workspaceId, payload.name);
    if (payload.stock != null) {
      product.stock = number(payload.stock, 'Stock', { min: 0 });
      await product.save();
      return { label: `Stock de « ${product.name} » fixé à ${product.stock}`, entityId: String(product._id) };
    }
    const delta = Number(payload.delta);
    if (!Number.isFinite(delta) || delta === 0) throw new Error('Précisez stock (valeur absolue) ou delta (ajustement non nul)');
    const { adjustProductStock } = await import('./stockService.js');
    await adjustProductStock({ workspaceId, productId: product._id, delta });
    const fresh = await Product.findById(product._id).select('stock').lean();
    return { label: `Stock de « ${product.name} » ajusté de ${delta > 0 ? '+' : ''}${delta} → ${fresh?.stock ?? '?'}`, entityId: String(product._id) };
  }

  if (type === 'product.create') {
    const status = PRODUCT_STATUSES.has(payload.status) ? payload.status : 'test';
    const product = await Product.create({
      workspaceId,
      name: text(payload.name, 'Nom du produit', 200),
      sellingPrice: number(payload.sellingPrice, 'Prix de vente', { min: 0 }),
      productCost: number(payload.productCost, 'Coût produit', { min: 0 }),
      deliveryCost: number(payload.deliveryCost ?? 0, 'Coût de livraison', { min: 0 }),
      avgAdsCost: number(payload.avgAdsCost ?? 0, 'Coût publicitaire', { min: 0 }),
      stock: number(payload.stock ?? 0, 'Stock', { min: 0 }),
      reorderThreshold: number(payload.reorderThreshold ?? 10, 'Seuil de réapprovisionnement', { min: 0 }),
      status,
      isActive: true,
      createdBy: user._id,
    });
    return { label: `Produit « ${product.name} » créé`, entityId: String(product._id) };
  }

  if (type === 'product.delete') {
    if (!/supprim\w*[\s\S]*(définit|confirme)|(?:définit|confirme)[\s\S]*supprim/i.test(sourceMessage)) throw new Error('La suppression définitive doit être confirmée explicitement');
    const product = await findUniqueProduct(workspaceId, payload.name);
    const name = product.name;
    await product.deleteOne();
    return { label: `Produit « ${name} » supprimé définitivement` };
  }

  if (type === 'sourcing.create') {
    const sourcing = payload.sourcing === 'chine' ? 'chine' : 'local';
    const weightKg = number(payload.weightKg ?? 0, 'Poids', { min: 0 });
    const pricePerKg = number(payload.pricePerKg ?? 0, 'Prix par kg', { min: 0 });
    const transportCost = payload.transportCost != null ? number(payload.transportCost, 'Transport', { min: 0 }) : weightKg * pricePerKg;
    const order = await StockOrder.create({
      workspaceId,
      productName: text(payload.productName, 'Produit', 200),
      sourcing,
      quantity: number(payload.quantity, 'Quantité', { min: 1 }),
      weightKg,
      pricePerKg,
      purchasePrice: number(payload.purchasePrice, "Prix d'achat unitaire", { min: 0 }),
      sellingPrice: number(payload.sellingPrice, 'Prix de vente', { min: 0 }),
      transportCost,
      supplierName: String(payload.supplierName || '').trim().slice(0, 150),
      expectedArrival: payload.expectedArrival ? new Date(payload.expectedArrival) : undefined,
      status: 'in_transit',
      createdBy: user._id,
    });
    return { label: `Commande sourcing « ${order.productName} » créée`, entityId: String(order._id) };
  }

  if (type === 'whatsapp.send') {
    let destination = String(payload.to || '').trim();
    if (payload.orderId) {
      const order = await findOrder(workspaceId, user, payload.orderId);
      destination = order.clientPhone;
    }
    if (!destination) throw new Error('Destinataire WhatsApp requis');
    const customerInstance = await WhatsAppInstance.findOne({ workspaceId, usageType: 'customer', isActive: true, status: { $in: ['connected', 'active'] } }).sort({ lastSeen: -1 }).select('_id').lean();
    if (!customerInstance) throw new Error('Aucune instance WhatsApp Clients n’est connectée');
    const result = await sendWhatsAppMessage({ to: destination, message: text(payload.message, 'Message WhatsApp', 2000), workspaceId, userId: user._id, instanceId: customerInstance._id });
    return { label: 'Message WhatsApp envoyé', messageId: result.messageId };
  }

  if (type === 'orders.relance') {
    const status = String(payload.status || '').trim();
    if (!ORDER_STATUSES.has(status)) throw new Error('Statut à relancer non valide');
    const customerInstance = await WhatsAppInstance.findOne({ workspaceId, usageType: 'customer', isActive: true, status: { $in: ['connected', 'active'] } }).sort({ lastSeen: -1 }).select('_id').lean();
    if (!customerInstance) throw new Error('Aucune instance WhatsApp Clients n’est connectée');

    const query = { workspaceId, status };
    if (user.role === 'ecom_closeuse') query.closerId = user._id;
    if (user.role === 'ecom_livreur') query.assignedLivreur = user._id;

    const limit = Math.max(1, Math.min(60, Number(payload.limit) || 25));
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(limit).select('orderId clientName clientPhone product').lean();
    if (!orders.length) return { label: `Aucune commande « ${status} » à relancer`, entityId: null };

    const tpl = String(payload.message || 'Bonjour {prenom}, votre commande de {produit} est en cours de livraison. Confirmez-vous la réception ?').slice(0, 2000);
    let sent = 0;
    let failed = 0;
    for (const o of orders) {
      if (!o.clientPhone) { failed += 1; continue; }
      const prenom = String(o.clientName || '').trim().split(/\s+/)[0] || 'cher client';
      const msg = tpl
        .replace(/\{prenom\}|\[pr[ée]nom\]/gi, prenom)
        .replace(/\{produit\}|\[produit\]/gi, o.product || 'votre commande');
      try {
        await sendWhatsAppMessage({ to: o.clientPhone, message: msg, workspaceId, userId: user._id, instanceId: customerInstance._id });
        sent += 1;
      } catch { failed += 1; }
      await new Promise((r) => setTimeout(r, 300)); // léger throttle anti-blocage
    }
    return { label: `Relance « ${status} » : ${sent} message(s) envoyé(s)${failed ? `, ${failed} échec(s)` : ''} (sur ${orders.length} commande(s))`, entityId: null };
  }

  throw new Error(`Action non prise en charge : ${type || 'inconnue'}`);
}

export async function executeScalorAgentActions(actions, context) {
  const limited = Array.isArray(actions) ? actions.slice(0, 3) : [];
  const results = [];
  for (const action of limited) {
    let result;
    let error = '';
    try {
      result = await performAction(action, context);
    } catch (err) {
      error = err.message || 'Action impossible';
    }
    const success = !error;
    await ScalorAgentAction.create({
      workspaceId: context.workspaceId,
      userId: context.user._id,
      userRole: context.user.role,
      actionType: action?.type || 'unknown',
      payload: action?.payload || {},
      success,
      result: result || {},
      error,
      sourceMessage: String(context.sourceMessage || '').slice(0, 2000),
    }).catch(() => {});
    results.push({ type: action?.type, success, ...(success ? { result } : { error }) });
  }
  return results;
}
