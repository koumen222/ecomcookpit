import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockOrder from '../models/StockOrder.js';
import ScalorAgentAction from '../models/ScalorAgentAction.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';
import Client from '../models/Client.js';
import Transaction from '../models/Transaction.js';
import StoreProduct from '../models/StoreProduct.js';
import { sendWhatsAppMessage } from './whatsappService.js';

const ORDER_STATUSES = new Set(['pending', 'confirmed', 'processing', 'shipped', 'in_delivery', 'delivered', 'postponed', 'reported', 'cancelled', 'returned', 'refused']);
const PRODUCT_STATUSES = new Set(['test', 'stable', 'winner', 'pause', 'stop']);
// Rôles d'équipe : alias français → valeurs du modèle (mêmes règles que /ecom/users).
const TEAM_ROLE_ALIASES = {
  admin: 'ecom_admin', ecom_admin: 'ecom_admin',
  closeuse: 'ecom_closeuse', closer: 'ecom_closeuse', ecom_closeuse: 'ecom_closeuse',
  compta: 'ecom_compta', comptable: 'ecom_compta', ecom_compta: 'ecom_compta',
  livreur: 'ecom_livreur', livreuse: 'ecom_livreur', ecom_livreur: 'ecom_livreur',
};
const CLIENT_SOURCES = new Set(['facebook', 'instagram', 'tiktok', 'whatsapp', 'site', 'referral', 'other']);
// Catégories de transactions (enum du modèle Transaction).
const TX_CATEGORIES = {
  expense: new Set(['publicite', 'produit', 'livraison', 'salaire', 'abonnement', 'materiel', 'transport', 'autre_depense']),
  income: new Set(['vente', 'remboursement_client', 'investissement', 'autre_entree']),
};
const ROLE_ACTIONS = {
  super_admin: '*',
  ecom_admin: '*',
  ecom_closeuse: new Set(['order.create', 'order.update_status', 'order.update', 'whatsapp.send', 'orders.relance', 'client.create', 'client.update']),
  ecom_compta: new Set(['order.update_status', 'product.update_price', 'report.generate', 'transaction.create']),
  ecom_livreur: new Set(['order.update_status']),
  service_client: new Set(['order.update_status', 'whatsapp.send', 'orders.relance', 'client.update']),
};

const escapeRx = (v = '') => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Retrouve UN membre d'équipe du workspace par nom, email ou téléphone.
async function findTeamMember(workspaceId, query, roleFilter = null) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Membre requis (nom, email ou téléphone)');
  const digits = q.replace(/\D/g, '');
  const or = [{ name: new RegExp(`^${escapeRx(q)}$`, 'i') }, { email: q.toLowerCase() }];
  if (digits.length >= 6) or.push({ phone: new RegExp(`${escapeRx(digits.slice(-8))}$`) });
  const members = await EcomUser.find({ workspaceId, $or: or, ...(roleFilter ? { role: roleFilter } : {}) }).limit(2);
  if (!members.length) throw new Error(`Membre introuvable : « ${q} »${roleFilter ? ` (rôle ${roleFilter.replace('ecom_', '')})` : ''}`);
  if (members.length > 1) throw new Error(`Plusieurs membres correspondent à « ${q} » — précise l'email`);
  return members[0];
}

// Retrouve UN produit de la BOUTIQUE (vitrine) par nom, scopé workspace+store.
async function findUniqueStoreProduct(workspaceId, storeId, name) {
  const q = text(name, 'Nom du produit', 200);
  const filter = { workspaceId, ...(storeId ? { storeId } : {}), name: new RegExp(`^${escapeRx(q)}$`, 'i') };
  const items = await StoreProduct.find(filter).limit(2);
  if (!items.length) throw new Error(`Produit boutique introuvable : « ${q} »`);
  if (items.length > 1) throw new Error(`Plusieurs produits boutique s'appellent « ${q} » — précise davantage`);
  return items[0];
}

// Retrouve UN client du workspace par téléphone ou nom (prénom [+ nom]).
async function findUniqueClient(workspaceId, query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Client requis (nom ou téléphone)');
  const digits = q.replace(/\D/g, '');
  const or = [];
  if (digits.length >= 6) {
    const tail = new RegExp(`${escapeRx(digits.slice(-8))}$`);
    or.push({ phone: tail }, { phoneNormalized: tail });
  }
  const words = q.split(/\s+/);
  or.push({ firstName: new RegExp(`^${escapeRx(words[0])}$`, 'i'), ...(words[1] ? { lastName: new RegExp(`^${escapeRx(words.slice(1).join(' '))}$`, 'i') } : {}) });
  const clients = await Client.find({ workspaceId, $or: or }).limit(2);
  if (!clients.length) throw new Error(`Client introuvable : « ${q} »`);
  if (clients.length > 1) throw new Error(`Plusieurs clients correspondent à « ${q} » — précise le téléphone`);
  return clients[0];
}

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
  // Le modèle Order applique lean() par défaut à tous les find/findOne.
  // Les actions mutantes ont besoin d'un document Mongoose (save/deleteOne).
  const order = await Order.findOne(query).setOptions({ skipLean: true });
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

  if (type === 'team.create') {
    // Ajout d'un membre d'équipe — réservé aux admins (ROLE_ACTIONS : seuls
    // les rôles '*' y ont droit). Reprend les règles de POST /api/ecom/users :
    // rôles autorisés, unicité email, hash bcrypt via pre('save') du modèle.
    const roleKey = TEAM_ROLE_ALIASES[String(payload.role || '').trim().toLowerCase()];
    if (!roleKey) throw new Error('Rôle invalide — utilise admin, closeuse, compta ou livreur');
    const name = text(payload.name, 'Nom', 80);
    const phone = String(payload.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
    // L'email est l'identifiant de connexion Scalor. S'il n'est pas fourni,
    // on en génère un interne lisible (nom + fin du téléphone).
    const emailRaw = String(payload.email || '').trim().toLowerCase();
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'membre';
    const email = emailRaw || `${slug}${phone ? `.${phone.slice(-4)}` : `.${Date.now().toString().slice(-4)}`}@team.scalor.app`;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email invalide');
    const existing = await EcomUser.findOne({ email });
    if (existing) throw new Error(`Cet email est déjà utilisé : ${email}`);
    const password = String(payload.password || '').trim() || `Scalor-${Math.random().toString(36).slice(2, 8)}`;
    if (password.length < 6) throw new Error('Mot de passe trop court (6 caractères minimum)');
    const member = new EcomUser({
      email,
      password, // hashé par le hook pre('save') du modèle (bcrypt)
      role: roleKey,
      workspaceId,
      name,
      phone,
      canAccessRitaAgent: roleKey === 'ecom_admin',
    });
    await member.save();
    return {
      label: `Membre créé : ${name} — rôle ${roleKey.replace('ecom_', '')}`,
      entityId: String(member._id),
      // Identifiants transmis UNE FOIS à l'admin dans le chat ; jamais
      // journalisés (retirés avant l'écriture dans ScalorAgentAction).
      credentials: { email, password },
    };
  }

  if (type === 'order.update') {
    // Édition d'une commande — mêmes champs que PUT /orders/:id (allowedFields).
    const order = await findOrder(workspaceId, user, payload.orderId);
    const F = {};
    if (payload.clientName != null) F.clientName = text(payload.clientName, 'Nom client', 120);
    if (payload.clientPhone != null || payload.phone != null) F.clientPhone = text(payload.clientPhone ?? payload.phone, 'Téléphone client', 30);
    for (const k of ['city', 'address', 'notes', 'deliveryLocation', 'deliveryTime']) {
      if (payload[k] != null) F[k] = String(payload[k]).slice(0, 500);
    }
    if (payload.quantity != null) F.quantity = number(payload.quantity, 'Quantité', { min: 1 });
    if (payload.price != null) F.price = number(payload.price, 'Prix', { min: 0 });
    if (payload.postponedUntil !== undefined) {
      if (payload.postponedUntil === null || payload.postponedUntil === '') F.postponedUntil = null;
      else {
        const d = new Date(payload.postponedUntil);
        if (Number.isNaN(d.getTime())) throw new Error('Date de report invalide (ISO attendue)');
        F.postponedUntil = d;
      }
      F.postponeReminderSentAt = null; // le rappel se réarme sur la nouvelle date
    }
    if (payload.livreur) {
      const member = await findTeamMember(workspaceId, payload.livreur, 'ecom_livreur');
      F.assignedLivreur = member._id;
    }
    if (!Object.keys(F).length) throw new Error('Aucun champ à modifier fourni');
    Object.assign(order, F);
    await order.save();
    return { label: `Commande mise à jour (${Object.keys(F).filter((k) => k !== 'postponeReminderSentAt').join(', ')})`, entityId: String(order._id) };
  }

  if (type === 'order.assign') {
    // Assignation d'une commande à un livreur (par nom / téléphone / email).
    const order = await findOrder(workspaceId, user, payload.orderId);
    const member = await findTeamMember(workspaceId, payload.livreur || payload.member, 'ecom_livreur');
    order.assignedLivreur = member._id;
    await order.save();
    return { label: `Commande assignée au livreur ${member.name || member.email}`, entityId: String(order._id) };
  }

  if (type === 'product.update') {
    // Édition générique d'un produit (compléte les update_price/status/stock existants).
    const product = await findUniqueProduct(workspaceId, payload.name);
    const F = [];
    if (payload.newName) { product.name = text(payload.newName, 'Nouveau nom', 120); F.push('nom'); }
    for (const k of ['sellingPrice', 'productCost', 'deliveryCost', 'avgAdsCost']) {
      if (payload[k] != null) { product[k] = number(payload[k], k, { min: 0 }); F.push(k); }
    }
    if (payload.stock != null) { product.stock = number(payload.stock, 'Stock', { min: 0 }); F.push('stock'); }
    if (payload.status != null) {
      const st = String(payload.status).toLowerCase();
      if (!PRODUCT_STATUSES.has(st)) throw new Error('Statut produit invalide (test|stable|winner|pause|stop)');
      product.status = st; F.push('statut');
    }
    if (!F.length) throw new Error('Aucun champ à modifier fourni');
    await product.save();
    return { label: `Produit « ${product.name} » mis à jour (${F.join(', ')})`, entityId: String(product._id) };
  }

  if (type === 'client.create') {
    // Création d'un client (fiche CRM) — mêmes champs que POST /clients.
    const full = String(payload.firstName || payload.name || '').trim();
    if (!full) throw new Error('Prénom du client requis');
    const [firstName, ...rest] = full.split(/\s+/);
    const source = CLIENT_SOURCES.has(String(payload.source || '').toLowerCase()) ? String(payload.source).toLowerCase() : 'other';
    const client = await Client.create({
      workspaceId,
      createdBy: user._id,
      firstName,
      lastName: String(payload.lastName || rest.join(' ') || '').slice(0, 80),
      phone: String(payload.phone || '').slice(0, 30),
      email: String(payload.email || '').toLowerCase().slice(0, 120),
      city: String(payload.city || '').slice(0, 80),
      address: String(payload.address || '').slice(0, 200),
      source,
      notes: String(payload.notes || '').slice(0, 1000),
    });
    return { label: `Client créé : ${client.firstName} ${client.lastName || ''}`.trim(), entityId: String(client._id) };
  }

  if (type === 'client.update') {
    // Édition d'un client retrouvé par nom ou téléphone — champs de PUT /clients/:id.
    const client = await findUniqueClient(workspaceId, payload.client || payload.name || payload.phone);
    const F = [];
    const strFields = { firstName: 80, lastName: 80, phone: 30, email: 120, city: 80, address: 200, notes: 1000, status: 40 };
    for (const [k, max] of Object.entries(strFields)) {
      if (payload[k] != null) { client[k] = String(payload[k]).slice(0, max); F.push(k); }
    }
    if (payload.source != null && CLIENT_SOURCES.has(String(payload.source).toLowerCase())) { client.source = String(payload.source).toLowerCase(); F.push('source'); }
    if (Array.isArray(payload.tags)) { client.tags = payload.tags.slice(0, 10).map((t) => String(t).slice(0, 40)); F.push('tags'); }
    if (!F.length) throw new Error('Aucun champ à modifier fourni');
    await client.save();
    return { label: `Client « ${client.firstName} ${client.lastName || ''} » mis à jour (${F.join(', ')})`.replace(/\s+»/, ' »'), entityId: String(client._id) };
  }

  if (type === 'client.delete') {
    const client = await findUniqueClient(workspaceId, payload.client || payload.name || payload.phone);
    await client.deleteOne();
    return { label: `Client « ${client.firstName} ${client.lastName || ''} » supprimé`.replace(/\s+»/, ' »'), entityId: String(client._id) };
  }

  if (type === 'transaction.create') {
    // Écriture financière — mêmes règles que POST /transactions.
    const txType = /^(income|entr[ée]e|revenu)$/i.test(String(payload.type || '')) ? 'income'
      : /^(expense|d[ée]pense|sortie)$/i.test(String(payload.type || '')) ? 'expense' : null;
    if (!txType) throw new Error('Type invalide — income/entrée ou expense/dépense');
    const amount = number(payload.amount, 'Montant', { min: 0.01 });
    let category = String(payload.category || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
    if (!TX_CATEGORIES[txType].has(category)) category = txType === 'expense' ? 'autre_depense' : 'autre_entree';
    let date = new Date();
    if (payload.date) {
      date = new Date(payload.date);
      if (Number.isNaN(date.getTime())) throw new Error('Date invalide (YYYY-MM-DD)');
    }
    const tx = await Transaction.create({
      workspaceId,
      createdBy: user._id,
      date,
      type: txType,
      category,
      amount,
      description: String(payload.description || '').slice(0, 500),
      reference: String(payload.reference || '').slice(0, 120),
    });
    return { label: `${txType === 'income' ? 'Entrée' : 'Dépense'} de ${amount} enregistrée (${category})`, entityId: String(tx._id) };
  }

  if (type === 'sourcing.receive' || type === 'sourcing.cancel') {
    // Réception / annulation d'une commande de stock — mêmes effets que les
    // routes PUT /sourcing/orders/:id/receive et /cancel (réception : stock
    // produit incrémenté, paiements soldés).
    let so = null;
    if (payload.stockOrderId) so = await StockOrder.findOne({ _id: payload.stockOrderId, workspaceId });
    else {
      const name = text(payload.productName || payload.name, 'Produit', 120);
      const matches = await StockOrder.find({ workspaceId, status: 'in_transit', productName: new RegExp(`^${escapeRx(name)}$`, 'i') }).sort({ createdAt: -1 }).limit(2);
      if (!matches.length) throw new Error(`Aucune commande de stock en transit pour « ${name} »`);
      if (matches.length > 1) throw new Error(`Plusieurs commandes en transit pour « ${name} » — précise stockOrderId`);
      so = matches[0];
    }
    if (!so) throw new Error('Commande de stock introuvable');
    if (so.status !== 'in_transit') throw new Error(`Commande de stock déjà « ${so.status} »`);
    if (type === 'sourcing.cancel') {
      so.status = 'cancelled';
      await so.save();
      return { label: `Commande de stock « ${so.productName} » annulée`, entityId: String(so._id) };
    }
    so.status = 'received';
    so.actualArrival = new Date();
    so.paidPurchase = true; so.paidTransport = true; so.paid = true;
    await so.save();
    // Incrément du stock produit (comme la route /receive).
    let stockNote = '';
    try {
      const product = so.productId ? await Product.findOne({ _id: so.productId, workspaceId }) : await findUniqueProduct(workspaceId, so.productName);
      if (product) { product.stock = Math.max(0, Number(product.stock) || 0) + (Number(so.quantity) || 0); await product.save(); stockNote = ` — stock produit : ${product.stock}`; }
    } catch { stockNote = ' — stock produit non ajusté (produit introuvable)'; }
    return { label: `Commande de stock « ${so.productName} » reçue (+${so.quantity})${stockNote}`, entityId: String(so._id) };
  }

  if (type === 'team.update') {
    // Modification d'un membre — mêmes règles que PUT /users/:id.
    const member = await findTeamMember(workspaceId, payload.member || payload.name || payload.email);
    const F = [];
    if (payload.role != null) {
      const roleKey = TEAM_ROLE_ALIASES[String(payload.role).trim().toLowerCase()];
      if (!roleKey) throw new Error('Rôle invalide — admin, closeuse, compta ou livreur');
      member.role = roleKey;
      if (roleKey !== 'ecom_admin') member.canAccessRitaAgent = false;
      F.push('rôle');
    }
    if (payload.newName != null) { member.name = text(payload.newName, 'Nom', 80); F.push('nom'); }
    if (payload.phone != null) { member.phone = String(payload.phone).replace(/[^\d+]/g, '').slice(0, 20); F.push('téléphone'); }
    if (payload.isActive != null) {
      const active = payload.isActive === true || String(payload.isActive).toLowerCase() === 'true';
      if (!active && String(member._id) === String(user._id)) throw new Error('Impossible de désactiver ton propre compte');
      member.isActive = active;
      F.push(active ? 'activé' : 'désactivé');
    }
    if (!F.length) throw new Error('Aucun champ à modifier fourni');
    await member.save();
    return { label: `Membre « ${member.name || member.email} » mis à jour (${F.join(', ')})`, entityId: String(member._id) };
  }

  if (type === 'team.reset_password') {
    // Nouveau mot de passe (généré ou fourni) — hashé par le modèle, retourné
    // UNE FOIS à l'admin (credentials est retiré du journal).
    const member = await findTeamMember(workspaceId, payload.member || payload.name || payload.email);
    const password = String(payload.password || '').trim() || `Scalor-${Math.random().toString(36).slice(2, 8)}`;
    if (password.length < 6) throw new Error('Mot de passe trop court (6 caractères minimum)');
    member.password = password;
    await member.save();
    return {
      label: `Mot de passe réinitialisé pour ${member.name || member.email}`,
      entityId: String(member._id),
      credentials: { email: member.email, password },
    };
  }

  if (type === 'team.delete') {
    const member = await findTeamMember(workspaceId, payload.member || payload.name || payload.email);
    if (String(member._id) === String(user._id)) throw new Error('Impossible de supprimer ton propre compte');
    await member.deleteOne();
    return { label: `Membre « ${member.name || member.email} » supprimé de l'équipe`, entityId: String(member._id) };
  }

  // ── Actions BOUTIQUE (vitrine — modèle StoreProduct, écrans /ecom/boutique) ──
  if (type === 'store_product.create') {
    // Mêmes exigences que POST /store-products : name + price. isPublished
    // false par défaut (brouillon) — l'agent publie explicitement si demandé.
    const name = text(payload.name, 'Nom du produit', 200);
    const price = number(payload.price, 'Prix', { min: 0 });
    const sp = await StoreProduct.create({
      workspaceId,
      ...(context.storeId ? { storeId: context.storeId } : {}),
      createdBy: user._id,
      name,
      price,
      compareAtPrice: payload.compareAtPrice != null ? number(payload.compareAtPrice, 'Prix barré', { min: 0 }) : null,
      description: String(payload.description || '').slice(0, 50000),
      stock: payload.stock != null ? number(payload.stock, 'Stock', { min: 0 }) : 0,
      category: String(payload.category || '').slice(0, 100),
      isPublished: payload.isPublished === true,
    });
    return { label: `Produit boutique créé : « ${sp.name} » à ${sp.price}${sp.isPublished ? ' (publié)' : ' (brouillon — publie-le quand la page est prête)'}`, entityId: String(sp._id) };
  }

  if (type === 'store_product.update') {
    const sp = await findUniqueStoreProduct(workspaceId, context.storeId, payload.product || payload.name);
    const F = [];
    if (payload.newName) { sp.name = text(payload.newName, 'Nouveau nom', 200); F.push('nom'); }
    if (payload.price != null) { sp.price = number(payload.price, 'Prix', { min: 0 }); F.push('prix'); }
    if (payload.compareAtPrice !== undefined) {
      sp.compareAtPrice = payload.compareAtPrice == null ? null : number(payload.compareAtPrice, 'Prix barré', { min: 0 });
      F.push('prix barré');
    }
    if (payload.description != null) { sp.description = String(payload.description).slice(0, 50000); F.push('description'); }
    if (payload.stock != null) { sp.stock = number(payload.stock, 'Stock', { min: 0 }); F.push('stock'); }
    if (payload.isPublished != null) {
      sp.isPublished = payload.isPublished === true || String(payload.isPublished).toLowerCase() === 'true';
      F.push(sp.isPublished ? 'publié' : 'dépublié');
    }
    if (!F.length) throw new Error('Aucun champ à modifier fourni');
    await sp.save();
    return { label: `Produit boutique « ${sp.name} » mis à jour (${F.join(', ')})`, entityId: String(sp._id) };
  }

  if (type === 'store_product.delete') {
    const sp = await findUniqueStoreProduct(workspaceId, context.storeId, payload.product || payload.name);
    await sp.deleteOne();
    return { label: `Produit boutique « ${sp.name} » supprimé`, entityId: String(sp._id) };
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
    // Journal : ne JAMAIS persister de secrets (identifiants générés par
    // team.create, mot de passe éventuel dans le payload).
    const { credentials: _omit, ...journalResult } = result || {};
    const journalPayload = { ...(action?.payload || {}) };
    if (journalPayload.password) journalPayload.password = '•••';
    await ScalorAgentAction.create({
      workspaceId: context.workspaceId,
      userId: context.user._id,
      userRole: context.user.role,
      actionType: action?.type || 'unknown',
      payload: journalPayload,
      success,
      result: journalResult,
      error,
      sourceMessage: String(context.sourceMessage || '').slice(0, 2000),
    }).catch(() => {});
    results.push({ type: action?.type, success, ...(success ? { result } : { error }) });
  }
  return results;
}
