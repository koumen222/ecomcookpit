import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { memCache } from '../services/memoryCache.js';
import Client from '../models/Client.js';
import WorkspaceSettings from '../models/WorkspaceSettings.js';
import OrderSource from '../models/OrderSource.js';
import EcomUser from '../models/EcomUser.js';
import CloseuseAssignment from '../models/CloseuseAssignment.js';
import Notification from '../models/Notification.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { createNotification, notifyNewOrder, notifyOrderStatus, notifyTeamOrderCreated, notifyTeamOrderStatusChanged } from '../services/notificationHelper.js';
import { sendWhatsAppMessage, sendOrderNotification } from '../services/whatsappService.js';
import { sendOrderConfirmationToClient } from '../services/shopifyWhatsappService.js';
import { formatInternationalPhone, isValidWhatsAppNumber, normalizePhone } from '../utils/phoneUtils.js';
import EcomWorkspace from '../models/Workspace.js';
import { EventEmitter } from 'events';

const router = express.Router();

// Helper: récupère le téléphone depuis rawData si clientPhone est vide
const PHONE_RAWDATA_KEYS = /^(tel|telephone|phone|mobile|whatsapp|gsm|portable|contact|numero|cellulaire)/i;
function recoverPhoneFromRawData(order) {
  if (order.clientPhone) return order.clientPhone;
  if (!order.rawData || typeof order.rawData !== 'object') return '';
  // Pass 1: match by key name
  for (const [k, v] of Object.entries(order.rawData)) {
    if (PHONE_RAWDATA_KEYS.test(k.trim()) && v) {
      const candidate = String(v).replace(/^'+/, '').replace(/\D/g, '');
      if (candidate.length >= 8) return candidate;
    }
  }
  // Pass 2: match by value pattern (looks like a phone number)
  for (const [, v] of Object.entries(order.rawData)) {
    if (!v) continue;
    const str = String(v).trim();
    const digits = str.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15 && /^\+?\d[\d\s().\\-]+\d$/.test(str)) {
      return digits;
    }
  }
  return '';
}
function fixOrderPhone(order) {
  if (!order.clientPhone && order.rawData) {
    const recovered = recoverPhoneFromRawData(order);
    if (recovered) {
      order.clientPhone = recovered;
      // Persister silencieusement
      Order.updateOne({ _id: order._id }, { $set: { clientPhone: recovered, clientPhoneNormalized: recovered } }).catch(() => {});
    }
  }
  return order;
}

// Créer un EventEmitter global pour la progression
const syncProgressEmitter = new EventEmitter();
const activeSyncControllers = new Map();
const DEFAULT_DELIVERY_RESPONSE_SECONDS = 15;

const formatMoney = (amount = 0) => `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

function getPickupLocationLabel(workspaceName) {
  return workspaceName ? `Base ${workspaceName}` : 'Point de récupération';
}

function getDestinationLabel(order) {
  return order.deliveryLocation || order.address || order.city || 'Destination à confirmer';
}

function getEstimatedDistanceLabel(order) {
  const explicitDistance = order.rawData?.estimatedDistance || order.rawData?.distance || order.rawData?.Distance;
  if (explicitDistance) return String(explicitDistance);
  if (order.city) return `Zone ${order.city}`;
  return 'À estimer';
}

async function getWorkspaceName(workspaceId) {
  const workspace = await EcomWorkspace.findById(workspaceId).select('name').lean().catch(() => null);
  return workspace?.name || '';
}

function buildDeliveryOfferMetadata(order, options = {}) {
  const responseWindowSeconds = options.responseWindowSeconds || DEFAULT_DELIVERY_RESPONSE_SECONDS;
  return {
    orderId: order._id,
    orderIdStr: order.orderId,
    clientName: order.clientName,
    city: order.city,
    product: order.product,
    quantity: order.quantity,
    phone: order.clientPhone,
    pickupLocation: getPickupLocationLabel(options.workspaceName),
    destination: getDestinationLabel(order),
    priceLabel: formatMoney(order.price),
    gainLabel: formatMoney(order.price),
    estimatedDistanceLabel: getEstimatedDistanceLabel(order),
    responseWindowSeconds,
    responseDeadline: options.responseDeadline || null,
    offerMode: options.offerMode || 'broadcast'
  };
}

function buildDeliveryOfferMessage(metadata) {
  return `Récup: ${metadata.pickupLocation} • Dest: ${metadata.destination} • Gain: ${metadata.gainLabel} • Distance: ${metadata.estimatedDistanceLabel}`;
}

async function sendDeliveryOfferNotifications({ workspaceId, order, livreurs, workspaceName, responseDeadline, offerMode = 'broadcast' }) {
  if (!livreurs.length) {
    console.log(`⚠️ sendDeliveryOfferNotifications: aucun livreur ciblé pour la commande ${order._id}`);
    return;
  }

  console.log(`📦 sendDeliveryOfferNotifications: ${livreurs.length} livreur(s), mode=${offerMode}, commande=${order.orderId || order._id}`);

  const { sendPushNotificationToUser } = await import('../services/pushService.js');
  const metadata = buildDeliveryOfferMetadata(order, {
    workspaceName,
    responseWindowSeconds: DEFAULT_DELIVERY_RESPONSE_SECONDS,
    responseDeadline,
    offerMode
  });

  const results = await Promise.allSettled(
    livreurs.map(async (livreur) => {
      const notif = await createNotification({
        workspaceId,
        userId: livreur._id,
        type: 'course',
        title: offerMode === 'targeted' ? '🚚 Course proposée' : '📦 Nouvelle course disponible',
        message: buildDeliveryOfferMessage(metadata),
        icon: 'order',
        link: `/ecom/livreur/available`,
        metadata
      });

      if (!notif) {
        console.warn(`⚠️ createNotification a retourné null pour livreur ${livreur._id}`);
      } else {
        console.log(`✅ Notification créée pour livreur ${livreur._id}: ${notif._id}`);
      }

      await sendPushNotificationToUser(livreur._id, {
        title: offerMode === 'targeted' ? '🚚 Course proposée' : '📦 Nouvelle course disponible',
        body: `${order.clientName || 'Client'} • ${metadata.destination} • ${metadata.gainLabel}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: `delivery-offer-${order._id}`,
        data: {
          type: 'course',
          orderId: order._id.toString(),
          url: '/ecom/livreur/available',
          metadata
        },
        requireInteraction: true
      });
    })
  );

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    failed.forEach(r => console.error(`❌ Erreur notification livreur:`, r.reason));
  }
}

async function notifyDeliveryTaken({ workspaceId, order, takenByLivreurId }) {
  const takingLivreur = await EcomUser.findById(takenByLivreurId).select('name').lean().catch(() => null);
  const livreurs = await EcomUser.find({
    workspaceId,
    role: 'ecom_livreur',
    isActive: true,
    _id: { $ne: takenByLivreurId }
  }).select('_id').lean();

  await Promise.allSettled(
    livreurs.map((livreur) =>
      createNotification({
        workspaceId,
        userId: livreur._id,
        type: 'order_taken',
        title: '🚚 Course prise',
        message: `Commande #${order.orderId} prise par ${takingLivreur?.name || 'un livreur'}`,
        icon: 'order',
        metadata: {
          orderId: order._id,
          orderIdStr: order.orderId,
          takenBy: takingLivreur?.name || 'Un livreur'
        }
      })
    )
  );
}

async function escalateExpiredDeliveryOffers(workspaceId) {
  const now = new Date();
  const expiredOrders = await Order.find({
    workspaceId,
    readyForDelivery: true,
    assignedLivreur: null,
    deliveryOfferMode: 'targeted',
    deliveryOfferExpiresAt: { $lte: now },
    deliveryOfferEscalatedAt: null
  }).select('_id orderId clientName city product quantity price clientPhone deliveryLocation address rawData deliveryOfferRefusedBy').lean();

  if (!expiredOrders.length) return;

  const workspaceName = await getWorkspaceName(workspaceId);

  for (const expiredOrder of expiredOrders) {
    const refusedIds = (expiredOrder.deliveryOfferRefusedBy || []).map((entry) => entry.toString());
    const livreurs = await EcomUser.find({
      workspaceId,
      role: 'ecom_livreur',
      isActive: true,
      _id: { $nin: refusedIds }
    }).select('_id').lean();

    await Order.updateOne(
      { _id: expiredOrder._id, deliveryOfferEscalatedAt: null },
      {
        $set: {
          deliveryOfferMode: 'broadcast',
          deliveryOfferTargetLivreur: null,
          deliveryOfferSentAt: now,
          deliveryOfferExpiresAt: null,
          deliveryOfferEscalatedAt: now
        }
      }
    );

    await sendDeliveryOfferNotifications({
      workspaceId,
      order: expiredOrder,
      livreurs,
      workspaceName,
      responseDeadline: null,
      offerMode: 'broadcast'
    }).catch((error) => {
      console.warn('⚠️ Escalation notification failed:', error.message);
    });
  }
}

// Fonction pour détecter le pays depuis le numéro de téléphone ou la ville
const detectCountry = (phone, city) => {
  // Détection par indicatif téléphonique
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Cameroun
    if (cleanPhone.startsWith('237')) return { code: 'CM', name: 'Cameroun' };
    // France
    if (cleanPhone.startsWith('33') || cleanPhone.startsWith('263')) return { code: 'FR', name: 'France' };
    // Côte d'Ivoire
    if (cleanPhone.startsWith('225')) return { code: 'CI', name: 'Côte d\'Ivoire' };
    // Sénégal
    if (cleanPhone.startsWith('221')) return { code: 'SN', name: 'Sénégal' };
    // Mali
    if (cleanPhone.startsWith('223')) return { code: 'ML', name: 'Mali' };
    // Burkina Faso
    if (cleanPhone.startsWith('226')) return { code: 'BF', name: 'Burkina Faso' };
    // Niger
    if (cleanPhone.startsWith('227')) return { code: 'NE', name: 'Niger' };
    // Togo
    if (cleanPhone.startsWith('228')) return { code: 'TG', name: 'Togo' };
    // Bénin
    if (cleanPhone.startsWith('229')) return { code: 'BJ', name: 'Bénin' };
    // Gabon
    if (cleanPhone.startsWith('241')) return { code: 'GA', name: 'Gabon' };
    // Congo RDC
    if (cleanPhone.startsWith('243')) return { code: 'CD', name: 'Congo RDC' };
    // Congo Brazzaville
    if (cleanPhone.startsWith('242')) return { code: 'CG', name: 'Congo Brazzaville' };
    // USA/Canada (both use prefix 1 - cannot distinguish without area code analysis)
    if (cleanPhone.startsWith('1')) return { code: 'US', name: 'États-Unis/Canada' };
    // Royaume-Uni
    if (cleanPhone.startsWith('44')) return { code: 'GB', name: 'Royaume-Uni' };
    // Belgique
    if (cleanPhone.startsWith('32')) return { code: 'BE', name: 'Belgique' };
    // Suisse
    if (cleanPhone.startsWith('41')) return { code: 'CH', name: 'Suisse' };
    // Luxembourg
    if (cleanPhone.startsWith('352')) return { code: 'LU', name: 'Luxembourg' };
    // Maroc
    if (cleanPhone.startsWith('212')) return { code: 'MA', name: 'Maroc' };
    // Tunisie
    if (cleanPhone.startsWith('216')) return { code: 'TN', name: 'Tunisie' };
    // Algérie
    if (cleanPhone.startsWith('213')) return { code: 'DZ', name: 'Algérie' };
    // Égypte
    if (cleanPhone.startsWith('20')) return { code: 'EG', name: 'Égypte' };
  }
  
  // Détection par nom de ville
  if (city) {
    const cleanCity = city.toLowerCase().trim();
    
    // Villes camerounaises
    if (['douala', 'yaoundé', 'yaounde', 'bafoussam', 'garoua', 'maroua', 'bamenda', 'kumba', 'limbé', 'nkongsamba', 'bertoua', 'ebolowa', 'buea', 'kribi'].includes(cleanCity)) {
      return { code: 'CM', name: 'Cameroun' };
    }
    
    // Villes françaises
    if (['paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'strasbourg', 'montpellier', 'bordeaux', 'lille'].includes(cleanCity)) {
      return { code: 'FR', name: 'France' };
    }
    
    // Villes ivoiriennes
    if (['abidjan', 'yamoussoukro', 'bouaké', 'korhogo', 'daloa', 'san-pedro'].includes(cleanCity)) {
      return { code: 'CI', name: 'Côte d\'Ivoire' };
    }
    
    // Villes sénégalaises
    if (['dakar', 'thiès', 'kaolack', 'mbour', 'saint-louis', 'touba'].includes(cleanCity)) {
      return { code: 'SN', name: 'Sénégal' };
    }
  }
  
  // Par défaut, retourner Cameroun
  return { code: 'CM', name: 'Cameroun' };
};

// ─── Route: Créer une commande (POST /) ───────────────────────────────────────
router.post('/', requireEcomAuth, validateEcomAccess('orders', 'write'), async (req, res) => {
  try {
    const { clientName, clientPhone, city, address, product, quantity, price, status, notes, tags } = req.body;
    if (!clientName && !clientPhone) {
      return res.status(400).json({ success: false, message: 'Nom client ou téléphone requis' });
    }
    const phoneValue = clientPhone || '';
    const normalizedPhone = normalizePhone(phoneValue, '237');
    const order = new Order({
      workspaceId: req.workspaceId,
      orderId: `#MAN_${Date.now().toString(36)}`,
      date: new Date(),
      clientName: clientName || '',
      clientPhone: phoneValue,
      clientPhoneNormalized: normalizedPhone || phoneValue,
      city: city || '',
      address: address || '',
      product: product || '',
      quantity: quantity || 1,
      price: price || 0,
      status: status || 'pending',
      notes: notes || '',
      tags: tags || [],
      source: 'manual',
      sheetRowId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sheetRowIndex: 999999 // Manual orders appear at the end
    });
    await order.save();
    memCache.delByPrefix(`stats:${req.workspaceId}`);
    
    // Envoyer la notification WhatsApp automatiquement (au livreur)
    await sendOrderNotification(order, req.workspaceId);
    
    // WhatsApp confirmation au client (si activé)
    sendOrderConfirmationToClient(order, req.workspaceId)
      .catch(err => console.error(`❌ Erreur WhatsApp client:`, err.message));
    
    // Notification interne
    notifyNewOrder(req.workspaceId, order).catch(() => {});
    
    // Notification d'équipe (exclure l'acteur)
    notifyTeamOrderCreated(req.workspaceId, req.ecomUser._id, order, req.ecomUser.email).catch(() => {});
    
    res.status(201).json({ success: true, message: 'Commande créée', data: order });
  } catch (error) {
    console.error('Erreur création commande:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/orders/bulk - Supprimer toutes les commandes (optionnel: filtrées par sourceId)
router.delete('/bulk', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { sourceId } = req.query;
    const filter = { workspaceId: req.workspaceId };
    if (sourceId) {
      if (sourceId === 'legacy') {
        filter.sheetRowId = { $not: /^source_/ };
      } else if (sourceId === 'webhook') {
        filter.source = 'webhook';
      } else {
        filter.sheetRowId = { $regex: `^source_${sourceId}_` };
      }
    }
    const result = await Order.deleteMany(filter);
    res.json({ success: true, message: `${result.deletedCount} commande(s) supprimée(s)`, data: { deletedCount: result.deletedCount } });
  } catch (error) {
    console.error('Erreur suppression bulk:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/available-statuses - Récupérer tous les statuts disponibles (standard + personnalisés)
router.get('/available-statuses', requireEcomAuth, async (req, res) => {
  try {
    const defaultStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'unreachable', 'called', 'postponed', 'reported'];
    
    // Récupérer tous les statuts uniques actuellement utilisés dans les commandes
    const distinctStatuses = await Order.distinct('status', { workspaceId: req.workspaceId });
    
    // Combiner les statuts par défaut avec les statuts personnalisés trouvés
    const allStatuses = [...new Set([...defaultStatuses, ...distinctStatuses.filter(s => s)])];
    
    res.json({ success: true, data: { statuses: allStatuses.sort() } });
  } catch (error) {
    console.error('Erreur fetch available-statuses:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/quick - Phase 1: 20 premières commandes sans stats (affichage immédiat)
router.get('/quick', requireEcomAuth, async (req, res) => {
  try {
    const { sourceId, sortOrder } = req.query;
    const filter = { workspaceId: req.workspaceId };
    if (sourceId) {
      if (sourceId === 'webhook') {
        filter.source = 'webhook';
      } else {
        filter.sheetRowId = { $regex: `^source_${sourceId}_` };
      }
    }

    // Déterminer l'ordre de tri (1 = ascending/oldest first, -1 = descending/newest first)
    const sortDirection = sortOrder === 'oldest_first' ? 1 : -1;

    // Filtre closeuse
    if (req.ecomUser.role === 'ecom_closeuse') {
      const allAssignments = await CloseuseAssignment.find({
        closeuseId: req.ecomUser._id, workspaceId: req.workspaceId, isActive: true
      }).populate('productAssignments.productIds', 'name');

      if (allAssignments.length > 0) {
        const allConditions = [];
        const sheetProductNames = allAssignments.flatMap(a => (a.productAssignments || []).flatMap(pa => pa.sheetProductNames || []));
        const assignedCityNames = allAssignments.flatMap(a => (a.cityAssignments || []).flatMap(ca => ca.cityNames || []));
        const assignedSourceIds = [...new Set(allAssignments.flatMap(a => (a.orderSources || []).map(os => String(os.sourceId)).filter(Boolean)))];

        assignedSourceIds.forEach(sid => {
          if (sid === 'legacy') allConditions.push({ sheetRowId: { $not: /^source_/ } });
          else allConditions.push({ sheetRowId: { $regex: `^source_${sid}_` } });
        });
        sheetProductNames.forEach(name => allConditions.push({ product: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' } }));
        assignedCityNames.forEach(name => allConditions.push({ city: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' } }));

        if (allConditions.length > 0) filter.$or = allConditions;
        else filter._id = null;
      } else {
        filter._id = null;
      }
    }

    const orders = await Order.find(filter)
      .select('orderId clientName clientPhone city address product quantity price status date createdAt notes tags source sheetRowId rawData')
      .sort({ sheetRowIndex: sortDirection, _id: sortDirection })
      .limit(20)
      .lean();

    orders.forEach(fixOrderPhone);

    res.json({ success: true, data: { orders, partial: true } });
  } catch (error) {
    console.error('Erreur quick orders:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/new-since - Silent polling endpoint for frontend
// Returns only orders created/updated after a given timestamp (lightweight)
router.get('/new-since', requireEcomAuth, async (req, res) => {
  try {
    const { since, sourceId } = req.query;
    if (!since) {
      return res.json({ success: true, data: { orders: [], count: 0, serverTime: new Date().toISOString() } });
    }

    const sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return res.json({ success: true, data: { orders: [], count: 0, serverTime: new Date().toISOString() } });
    }

    const filter = {
      workspaceId: req.workspaceId,
      updatedAt: { $gt: sinceDate }
    };
    if (sourceId) {
      if (sourceId === 'webhook') {
        filter.source = 'webhook';
      } else {
        filter.sheetRowId = { $regex: `^source_${sourceId}_` };
      }
    }

    // Filtre closeuse: ne montrer que les commandes des produits assignés
    if (req.ecomUser.role === 'ecom_closeuse') {
      const assignment = await CloseuseAssignment.findOne({
        closeuseId: req.ecomUser._id,
        workspaceId: req.workspaceId,
        isActive: true
      }).populate('productAssignments.productIds', 'name');

      if (assignment) {
        const sheetProductNames = (assignment.productAssignments || []).flatMap(pa => pa.sheetProductNames || []);
        const assignedProductIds = (assignment.productAssignments || []).flatMap(pa => pa.productIds || []);
        const assignedCityNames = (assignment.cityAssignments || []).flatMap(ca => ca.cityNames || []);
        
        // Extraire les noms des produits de la base de données
        const dbProductNames = assignedProductIds
          .filter(pid => pid && typeof pid === 'object' && pid.name) // Filtrer les produits peuplés
          .map(pid => pid.name);
        
        if (sheetProductNames.length > 0 || dbProductNames.length > 0 || assignedCityNames.length > 0) {
          // Combiner tous les noms de produits (sheets + DB)
          const allProductNames = [...sheetProductNames, ...dbProductNames];
          
          // Correspondance exacte sur les noms de produits assignés (case-insensitive, trim)
          const productConditions = allProductNames.map(name => ({
            product: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
          }));

          // Correspondance exacte sur les noms de villes assignées (case-insensitive, trim)
          const cityConditions = assignedCityNames.map(name => ({
            city: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
          }));

          // Combiner toutes les conditions (produits OU villes)
          const allConditions = [...productConditions, ...cityConditions];

          if (allConditions.length > 0) {
            if (filter.$or) {
              // search + product/city filter: wrap both in $and
              const searchOr = filter.$or;
              delete filter.$or;
              filter.$and = [{ $or: searchOr }, { $or: allConditions }];
            } else {
              filter.$or = allConditions;
            }
          } else {
            // Si aucune condition de produit/ville mais qu'il y a une assignment, ne retourner aucune commande
            filter._id = null; // Force un résultat vide
          }
        } else {
          filter._id = null;
        }
      } else {
        // Si la closeuse n'a aucune assignment, ne retourner aucune commande
        filter._id = null;
      }
    }

    const orders = await Order.find(filter)
      .select('orderId clientName clientPhone city address product quantity price status date createdAt updatedAt notes tags source sheetRowId rawData')
      .sort({ sheetRowIndex: 1, _id: 1 })
      .limit(100)
      .lean();

    orders.forEach(fixOrderPhone);

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length,
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    // Silent — never break the frontend polling
    console.error('❌ [Polling Endpoint] Erreur:', error.message);
    res.json({ success: true, data: { orders: [], count: 0, serverTime: new Date().toISOString() } });
  }
});

// GET /api/ecom/orders/my-commissions - Commissions de la closeuse connectée
router.get('/my-commissions', requireEcomAuth, async (req, res) => {
  try {
    if (req.ecomUser.role !== 'ecom_closeuse') {
      return res.status(403).json({ success: false, message: 'Accès réservé aux closeuses' });
    }

    const { period = 'month' } = req.query;

    // Récupérer le taux de commission du workspace
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    const commissionRate = settings?.commissionRate ?? 1000;

    // Récupérer toutes les affectations de la closeuse
    const allAssignments = await CloseuseAssignment.find({
      closeuseId: req.ecomUser._id,
      workspaceId: req.workspaceId,
      isActive: true
    }).populate('productAssignments.productIds', 'name');

    if (!allAssignments.length) {
      return res.json({ success: true, data: { commissionRate, periods: {}, total: 0, totalOrders: 0 } });
    }

    // Extraire toutes les assignations (sources, produits, villes) - même logique que la liste des commandes
    const sheetProductNames = allAssignments.flatMap(a => (a.productAssignments || []).flatMap(pa => pa.sheetProductNames || []));
    const assignedProductIds = allAssignments.flatMap(a => (a.productAssignments || []).flatMap(pa => pa.productIds || []));
    const assignedCityNames = allAssignments.flatMap(a => (a.cityAssignments || []).flatMap(ca => ca.cityNames || []));
    const assignedSourceIds = [...new Set(
      allAssignments.flatMap(a => (a.orderSources || []).map(os => String(os.sourceId)).filter(Boolean))
    )];
    
    // Extraire les noms des produits de la base de données
    const dbProductNames = assignedProductIds
      .filter(pid => pid && typeof pid === 'object' && pid.name)
      .map(pid => pid.name);

    // Construire toutes les conditions (sources, produits, villes)
    const allConditions = [];

    // Condition 1: Commandes des sources assignées
    if (assignedSourceIds.length > 0) {
      for (const sourceId of assignedSourceIds) {
        if (sourceId === 'legacy') {
          allConditions.push({ sheetRowId: { $not: /^source_/ } });
        } else {
          allConditions.push({ sheetRowId: { $regex: `^source_${sourceId}_` } });
        }
      }
    }

    // Condition 2: Commandes des produits assignés
    if (sheetProductNames.length > 0 || dbProductNames.length > 0) {
      const allProductNames = [...sheetProductNames, ...dbProductNames];
      for (const name of allProductNames) {
        allConditions.push({
          product: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
        });
      }
    }

    // Condition 3: Commandes des villes assignées
    if (assignedCityNames.length > 0) {
      for (const name of assignedCityNames) {
        allConditions.push({
          city: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
        });
      }
    }

    // Filtre de date selon la période
    const now = new Date();
    let dateFilter = {};
    if (period === 'today') {
      const start = new Date(now); start.setHours(0,0,0,0);
      dateFilter = { date: { $gte: start } };
    } else if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      dateFilter = { date: { $gte: start } };
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { date: { $gte: start } };
    } else if (period === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      dateFilter = { date: { $gte: start } };
    }

    const baseFilter = {
      workspaceId: req.workspaceId,
      ...dateFilter,
      ...(allConditions.length > 0 ? { $or: allConditions } : { _id: null })
    };

    // Agréger par statut - convertir workspaceId en ObjectId pour aggregate
    const aggregateFilter = {
      ...baseFilter,
      workspaceId: new mongoose.Types.ObjectId(req.workspaceId)
    };

    const stats = await Order.aggregate([
      { $match: aggregateFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $multiply: ['$price', { $ifNull: ['$quantity', 1] }] } } } }
    ]);

    const byStatus = {};
    let totalOrders = 0;
    stats.forEach(s => {
      byStatus[s._id] = { count: s.count, revenue: s.revenue };
      totalOrders += s.count;
    });

    const deliveredCount = byStatus['delivered']?.count || 0;
    const totalCommission = deliveredCount * commissionRate;

    // Historique mensuel (12 derniers mois)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyStats = await Order.aggregate([
      { $match: { 
        workspaceId: new mongoose.Types.ObjectId(req.workspaceId), 
        date: { $gte: twelveMonthsAgo }, 
        status: 'delivered', 
        ...(allConditions.length > 0 ? { $or: allConditions } : { _id: null }) 
      } },
      { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        commissionRate,
        period,
        byStatus,
        totalOrders,
        deliveredCount,
        totalCommission,
        monthlyHistory: monthlyStats.map(m => ({
          year: m._id.year,
          month: m._id.month,
          count: m.count,
          commission: m.count * commissionRate
        }))
      }
    });
  } catch (error) {
    console.error('Erreur commissions closeuse:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders - Liste des commandes
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { status, search, startDate, endDate, city, product, tag, sourceId, page = 1, limit = 50, allWorkspaces, period, sortOrder } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    
    // Déterminer l'ordre de tri (1 = ascending/oldest first, -1 = descending/newest first)
    const sortDirection = sortOrder === 'oldest_first' ? 1 : -1;
    
    // Si super_admin et allWorkspaces=true, ne pas filtrer par workspaceId
    const isSuperAdmin = req.ecomUser.role === 'super_admin';
    const viewAllWorkspaces = isSuperAdmin && allWorkspaces === 'true';

    const filter = viewAllWorkspaces ? {} : { workspaceId: req.workspaceId };

    // Gestion des filtres de période prédéfinis
    if (period) {
      const now = new Date();
      let periodStart, periodEnd;
      
      switch (period) {
        case 'today':
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case '7days':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodEnd = new Date();
          break;
        case '30days':
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          periodEnd = new Date();
          break;
        case '90days':
          periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          periodEnd = new Date();
          break;
        default:
          // Période non reconnue, ignorer
          break;
      }
      
      if (periodStart && periodEnd) {
        filter.date = { $gte: periodStart, $lt: periodEnd };
      }
    } else if (startDate || endDate) {
      // Filtres de dates manuels (comportement existant)
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (status) filter.status = status;
    if (city) filter.city = { $regex: city, $options: 'i' };
    if (product) filter.product = { $regex: product, $options: 'i' };
    if (tag) filter.tags = tag;
    if (sourceId) {
      if (sourceId === 'legacy') {
        filter.sheetRowId = { $not: /^source_/ };
      } else if (sourceId === 'webhook') {
        filter.source = 'webhook';
      } else {
        filter.sheetRowId = { $regex: `^source_${sourceId}_` };
      }
    }
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { clientName: { $regex: safeSearch, $options: 'i' } },
        { clientPhone: { $regex: safeSearch, $options: 'i' } },
        { product: { $regex: safeSearch, $options: 'i' } },
        { city: { $regex: safeSearch, $options: 'i' } },
        { orderId: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Filtre closeuse: montrer les commandes des sources assignées OU des produits/villes assignés
    if (req.ecomUser.role === 'ecom_closeuse') {
      // Use find() to get ALL assignments (one per source possible)
      const allAssignments = await CloseuseAssignment.find({
        closeuseId: req.ecomUser._id,
        workspaceId: req.workspaceId,
        isActive: true
      }).populate('productAssignments.productIds', 'name');

      if (allAssignments.length > 0) {
        // Merge all assignments
        const sheetProductNames = allAssignments.flatMap(a => (a.productAssignments || []).flatMap(pa => pa.sheetProductNames || []));
        const assignedProductIds = allAssignments.flatMap(a => (a.productAssignments || []).flatMap(pa => pa.productIds || []));
        const assignedCityNames = allAssignments.flatMap(a => (a.cityAssignments || []).flatMap(ca => ca.cityNames || []));
        // sourceId is now a String (WorkspaceSettings source ID or 'legacy')
        const assignedSourceIds = [...new Set(
          allAssignments.flatMap(a => (a.orderSources || []).map(os => String(os.sourceId)).filter(Boolean))
        )];
        
        // Extraire les noms des produits de la base de données
        const dbProductNames = assignedProductIds
          .filter(pid => pid && typeof pid === 'object' && pid.name)
          .map(pid => pid.name);
        

        const allConditions = [];

        // Condition 1: Commandes des sources assignées
        if (assignedSourceIds.length > 0) {
          for (const sourceId of assignedSourceIds) {
            if (sourceId === 'legacy') {
              // Legacy orders: sheetRowId does NOT start with 'source_'
              allConditions.push({ sheetRowId: { $not: /^source_/ } });
            } else {
              allConditions.push({ sheetRowId: { $regex: `^source_${sourceId}_` } });
            }
          }
        }

        // Condition 2: Commandes des produits assignés
        if (sheetProductNames.length > 0 || dbProductNames.length > 0) {
          const allProductNames = [...sheetProductNames, ...dbProductNames];
          const productConditions = allProductNames.map(name => ({
            product: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
          }));
          allConditions.push(...productConditions);
        }

        // Condition 3: Commandes des villes assignées
        if (assignedCityNames.length > 0) {
          const cityConditions = assignedCityNames.map(name => ({
            city: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim()}$`, $options: 'i' }
          }));
          allConditions.push(...cityConditions);
        }


        if (allConditions.length > 0) {
          if (filter.$or) {
            // search filter exists: wrap both in $and
            const searchOr = filter.$or;
            delete filter.$or;
            filter.$and = [{ $or: searchOr }, { $or: allConditions }];
          } else {
            filter.$or = allConditions;
          }
        } else {
          // Si aucune source/produit/ville assigné, ne retourner aucune commande
          filter._id = null;
        }
      } else {
        // Si la closeuse n'a aucune assignment, ne retourner aucune commande
        filter._id = null;
      }
    }

    // Filtre livreur : ne voir que SES commandes assignées
    if (req.ecomUser.role === 'ecom_livreur') {
      filter.assignedLivreur = req.ecomUser._id;
    }


    const orders = await Order.find(filter)
      .select('orderId clientName clientPhone city address product quantity price status date createdAt updatedAt notes tags source sheetRowId assignedLivreur readyForDelivery rawData')
      .sort({ sheetRowIndex: sortDirection, _id: sortDirection })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();


    // Stats + total en une seule agrégation (remplace 9 countDocuments séparés)
    const wsFilter = viewAllWorkspaces ? {} : { workspaceId: req.workspaceId };
    let statsFilter = { ...wsFilter };
    if (req.ecomUser.role === 'ecom_closeuse' && (filter.$or || filter.$and)) {
      if (filter.$or) statsFilter.$or = filter.$or;
      else if (filter.$and) {
        const productCityCondition = filter.$and.find(c => c.$or && (c.$or[0]?.product || c.$or[0]?.city));
        if (productCityCondition) statsFilter.$or = productCityCondition.$or;
      }
    }

    // Cache stats 30s si pas de filtre actif (changement de source/page seulement)
    const hasActiveFilter = status || search || city || product || tag || startDate || endDate || period;
    const statsCacheKey = `stats:${req.workspaceId}:${sourceId || 'all'}`;
    let statsAgg = hasActiveFilter ? null : memCache.get(statsCacheKey);

    const [statsAggResult, total] = await Promise.all([
      statsAgg ? Promise.resolve(statsAgg) : Order.aggregate([
        { $match: { ...statsFilter, workspaceId: new mongoose.Types.ObjectId(req.workspaceId) } },
        { $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
        }}
      ]),
      Order.countDocuments(filter)
    ]);

    if (!hasActiveFilter && !statsAgg) memCache.set(statsCacheKey, statsAggResult, 30000);
    statsAgg = statsAggResult;

    const stats = { total: 0, totalRevenue: 0 };
    statsAgg.forEach(s => {
      stats[s._id] = s.count;
      stats.total += s.count;
      if (s._id === 'delivered') stats.totalRevenue = s.revenue;
    });

    if (period) {
      const periodAgg = await Order.aggregate([
        { $match: { ...statsFilter, workspaceId: new mongoose.Types.ObjectId(req.workspaceId), status: 'delivered', date: filter.date } },
        { $group: { _id: null, revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } } } }
      ]);
      stats.periodRevenue = periodAgg[0]?.revenue || 0;
      const periodLabels = { today: "Aujourd'hui", '7days': '7 derniers jours', '30days': '30 derniers jours', '90days': '90 derniers jours' };
      stats.periodLabel = periodLabels[period] || 'Période personnalisée';
    }

    orders.forEach(fixOrderPhone);

    res.json({
      success: true,
      data: {
        orders,
        stats,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
      }
    });
  } catch (error) {
    console.error('Erreur get orders:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/stats/detailed - Statistiques détaillées pour la page stats
router.get('/stats/detailed', requireEcomAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Pour .find()/.countDocuments() Mongoose cast auto string→ObjectId
    const wsFilter = { workspaceId: req.workspaceId };
    // Pour .aggregate() il faut un vrai ObjectId sinon ça ne matche pas
    const wsFilterAgg = { workspaceId: new mongoose.Types.ObjectId(req.workspaceId) };
    
    // Date filter
    if (startDate || endDate) {
      wsFilter.date = {};
      wsFilterAgg.date = {};
      if (startDate) {
        wsFilter.date.$gte = new Date(startDate);
        wsFilterAgg.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        wsFilter.date.$lte = end;
        const endAgg = new Date(endDate);
        endAgg.setHours(23, 59, 59, 999);
        wsFilterAgg.date.$lte = endAgg;
      }
    }

    // Order stats by status
    const statuses = ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'unreachable', 'called', 'postponed', 'reported'];
    const countPromises = statuses.map(s => Order.countDocuments({ ...wsFilter, status: s }));
    const counts = await Promise.all(countPromises);
    
    const orderStats = { total: 0, totalRevenue: 0 };
    statuses.forEach((s, i) => {
      orderStats[s] = counts[i];
      orderStats.total += counts[i];
    });

    // Revenue and average order value
    const deliveredOrders = await Order.find({ ...wsFilter, status: 'delivered' }, { price: 1, quantity: 1 }).lean();
    orderStats.totalRevenue = deliveredOrders.reduce((sum, o) => sum + ((o.price || 0) * (o.quantity || 1)), 0);
    orderStats.avgOrderValue = deliveredOrders.length > 0 ? orderStats.totalRevenue / deliveredOrders.length : 0;

    // Top products (only delivered)
    const topProducts = await Order.aggregate([
      { $match: { ...wsFilterAgg, status: 'delivered', product: { $exists: true, $ne: '' } } },
      { $group: { 
        _id: '$product', 
        count: { $sum: 1 }, 
        revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
      }},
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    // Top cities (only delivered)
    const topCities = await Order.aggregate([
      { $match: { ...wsFilterAgg, status: 'delivered', city: { $exists: true, $ne: '' } } },
      { $group: { 
        _id: '$city', 
        count: { $sum: 1 },
        revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
      }},
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]);

    // Top clients by phone (only delivered)
    const topClients = await Order.aggregate([
      { $match: { ...wsFilterAgg, status: 'delivered', clientPhone: { $exists: true, $ne: '' } } },
      { $group: { 
        _id: '$clientPhone',
        clientName: { $first: '$clientName' },
        phone: { $first: '$clientPhone' },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
      }},
      { $sort: { totalSpent: -1 } },
      { $limit: 10 }
    ]);

    // Client stats
    const Client = (await import('../models/Client.js')).default;
    const clientTotal = await Client.countDocuments({ workspaceId: req.workspaceId });
    const clientDelivered = await Client.countDocuments({ workspaceId: req.workspaceId, status: 'delivered' });
    const clientStats = { total: clientTotal, delivered: clientDelivered };

    // Products sold by client and city - get raw orders first then process (only delivered)
    const rawOrders = await Order.find({
      ...wsFilter,
      status: 'delivered',
      clientName: { $exists: true, $ne: '' },
      city: { $exists: true, $ne: '' }
    }).lean();

    // Process orders to extract real product names and group data
    const productsByClientCityMap = new Map();
    
    rawOrders.forEach(order => {
      const productName = getOrderProductName(order);
      if (!productName) return;
      
      const key = `${order.clientName}|${order.city}|${productName}`;
      const quantity = order.quantity || 1;
      const revenue = (order.price || 0) * quantity;
      
      if (productsByClientCityMap.has(key)) {
        const existing = productsByClientCityMap.get(key);
        existing.quantity += quantity;
        existing.revenue += revenue;
        existing.orderCount += 1;
      } else {
        productsByClientCityMap.set(key, {
          _id: {
            client: order.clientName,
            city: order.city,
            product: productName
          },
          quantity: quantity,
          revenue: revenue,
          orderCount: 1,
          phone: order.clientPhone
        });
      }
    });

    // Convert to array and sort by quantity
    const productsByClientCity = Array.from(productsByClientCityMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    // Daily trend (last 30 days) - only delivered orders
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyTrend = await Order.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(req.workspaceId), status: 'delivered', date: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 },
        revenue: { $sum: { $multiply: [{ $ifNull: ['$price', 0] }, { $ifNull: ['$quantity', 1] }] } }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        orderStats,
        topProducts,
        topCities,
        topClients,
        clientStats,
        productsByClientCity,
        dailyTrend
      }
    });
  } catch (error) {
    console.error('Erreur stats détaillées:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Helper: extraire le vrai nom de produit d'une commande (fallback rawData si numérique)
function getOrderProductName(order) {
  // Si le produit est un vrai nom (non-numérique), le retourner directement
  if (order.product && isNaN(String(order.product).replace(/\s/g, ''))) return order.product;
  // Chercher dans rawData une colonne produit avec une valeur non-numérique
  if (order.rawData && typeof order.rawData === 'object') {
    for (const [k, v] of Object.entries(order.rawData)) {
      if (v && typeof v === 'string' && isNaN(v.replace(/\s/g, '')) && /produit|product|article|item|d[eé]signation/i.test(k)) {
        return v;
      }
    }
  }
  // Fallback: retourner le produit même s'il est numérique, plutôt que rien
  if (order.product) return String(order.product);
  return '';
}

// Helper: extraire le spreadsheetId depuis une URL Google Sheets
function extractSpreadsheetId(input) {
  if (!input) return null;
  // Si c'est déjà un ID (pas d'URL)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  // Extraire depuis l'URL
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Helper: auto-détecter les colonnes depuis les headers et contenu
function autoDetectColumns(headers, rows = []) {
  const mapping = {};
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Patterns ordonnés par priorité (les plus spécifiques d'abord)
  const patterns = [
    { field: 'orderId', compound: ['order id', 'order number', 'numero commande', 'n° commande'], simple: ['order id', 'ref', 'reference'] },
    { field: 'date', compound: ['date & time', 'date time', 'date commande'], simple: ['date', 'jour', 'day', 'created'] },
    { field: 'clientPhone', compound: ['phone number', 'numero telephone', 'num tel', 'contact telephone', 'numero client', 'numero de telephone'], simple: ['tel', 'telephone', 'phone', 'mobile', 'whatsapp', 'gsm', 'portable', 'contact', 'numero', 'cellulaire'] },
    { field: 'clientName', compound: ['first name', 'last name', 'full name', 'nom complet', 'nom client', 'customer name'], simple: ['nom', 'name', 'client', 'prenom', 'firstname', 'lastname'] },
    { field: 'city', compound: [], simple: ['ville', 'city', 'commune', 'localite', 'zone'] },
    { field: 'product', compound: ['product name', 'nom produit', 'nom article', 'nom du produit'], simple: ['produit', 'product', 'article', 'item', 'designation'] },
    { field: 'price', compound: ['product price', 'prix produit', 'prix unitaire', 'unit price', 'selling price'], simple: ['prix', 'price', 'montant', 'amount', 'total', 'cout', 'cost', 'tarif'] },
    { field: 'quantity', compound: [], simple: ['quantite', 'quantity', 'qte', 'qty', 'nb', 'nombre'] },
    { field: 'status', compound: ['statut livraison', 'statut commande', 'delivery status', 'order status'], simple: ['statut', 'status', 'etat', 'state'] },
    { field: 'notes', compound: [], simple: ['notes', 'note', 'commentaire', 'comment', 'remarque', 'observation'] },
    { field: 'address', compound: ['address 1', 'adresse 1'], simple: ['adresse', 'address'] },
  ];

  // Pass 1: compound matches (plus spécifiques)
  headers.forEach((header, index) => {
    const h = normalize(header);
    for (const p of patterns) {
      if (!mapping[p.field] && p.compound.some(c => h.includes(c))) {
        mapping[p.field] = index;
      }
    }
  });

  // Pass 2: simple matches (seulement si pas déjà mappé ET index pas déjà pris)
  const usedIndices = new Set(Object.values(mapping));
  headers.forEach((header, index) => {
    if (usedIndices.has(index)) return;
    const h = normalize(header);
    for (const p of patterns) {
      if (!mapping[p.field] && p.simple.some(k => h.includes(k))) {
        mapping[p.field] = index;
        usedIndices.add(index);
        break;
      }
    }
  });

  // Pass 3: content-based detection for missing fields (price, phone, etc.)
  if (rows.length > 0 && mapping.price === undefined) {
    // Analyze first few rows to detect price column by content
    const sampleSize = Math.min(5, rows.length);
    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      if (usedIndices.has(colIdx)) continue;
      
      let priceScore = 0;
      for (let i = 0; i < sampleSize; i++) {
        const row = rows[i];
        if (!row.c || !row.c[colIdx]) continue;
        const val = String(row.c[colIdx].v || '').trim().replace(/^'+/, '');
        
        // Check for price pattern: numbers between 500-10000000
        const numVal = parseFloat(val.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(numVal) && numVal >= 500 && numVal <= 10000000) {
          priceScore++;
        }
      }
      
      if (priceScore >= 2) {
        mapping.price = colIdx;
        console.log(`✅ [SYNC] Price column detected by content at index ${colIdx}`);
        break;
      }
    }
  }

  console.log('📊 Column mapping result:', mapping, 'Headers:', headers);
  return mapping;
}

// Helper: parser une date flexible
function parseFlexDate(dateVal) {
  if (!dateVal) return new Date();
  // Try ISO / standard format
  let d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = dateVal.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (day <= 31 && month <= 12) {
      d = new Date(year < 100 ? 2000 + year : year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

function cleanPhoneFromSheet(val) {
  if (!val) return '';
  let phone = String(val).trim();
  if (!phone || phone === 'null' || phone === 'undefined') return '';

  phone = phone.replace(/^'+/, '');
  phone = phone.replace(/^(tel:|phone:|whatsapp:|wa:)/i, '');
  phone = phone.replace(/[\u200B-\u200D\uFEFF]/g, '');

  const candidates = phone.match(/\+?\d[\d\s().-]{5,}\d/g) || [];
  if (candidates.length > 0) {
    phone = candidates.sort((a, b) => b.length - a.length)[0];
  }

  phone = phone.replace(/\D/g, '');
  return phone || '';
}

// Helper: notifier les livreurs des nouvelles commandes
async function notifyLivreursOfNewOrder(order, workspaceId) {
  try {
    const workspaceName = await getWorkspaceName(workspaceId);
    const livreurs = await EcomUser.find({
      workspaceId,
      role: 'ecom_livreur',
      isActive: true
    }).select('_id').lean();

    if (livreurs.length === 0) {
      console.log('Aucun livreur disponible pour la notification');
      return;
    }

    await sendDeliveryOfferNotifications({
      workspaceId,
      order,
      livreurs,
      workspaceName,
      responseDeadline: null,
      offerMode: 'broadcast'
    });
    
    // Envoyer les messages WhatsApp
    for (const livreur of livreurs) {
      if (livreur.phone) {
        try {
          const whatsappMessage = `📦 *NOUVELLE COMMANDE DISPONIBLE*\n\n` +
            `🔢 *Commande:* #${order.orderId}\n` +
            `👤 *Client:* ${order.clientName}\n` +
            `📞 *Téléphone:* ${order.clientPhone}\n` +
            `📍 *Ville:* ${order.city}\n` +
            `📦 *Produit:* ${order.product}\n` +
            `🔢 *Quantité:* ${order.quantity}\n` +
            `💰 *Prix:* ${order.price} FCFA\n\n` +
            `🚀 *Prenez cette commande rapidement!*`;
          
          await sendWhatsAppMessage({ 
            to: livreur.phone, 
            message: whatsappMessage,
            workspaceId: workspaceId,
            userId: livreur._id,
            firstName: livreur.name 
          });
          console.log(`✅ WhatsApp envoyé à ${livreur.name} (${livreur.phone}) pour la commande #${order.orderId}`);
        } catch (whatsappError) {
          console.error(`❌ Erreur WhatsApp pour ${livreur.phone}:`, whatsappError.message);
        }
      }
    }
    
    console.log(`✅ Notifications envoyées à ${livreurs.length} livreurs pour la commande #${order.orderId}`);
    
  } catch (error) {
    console.error('Erreur lors de la notification des livreurs:', error);
  }
}

// Helper: notifier les livreurs qu'une commande a été prise
async function notifyOrderTaken(order, workspaceId, takenByLivreurId) {
  try {
    await notifyDeliveryTaken({ workspaceId, order, takenByLivreurId });

    const livreurs = await EcomUser.find({
      workspaceId,
      role: 'ecom_livreur',
      isActive: true,
      _id: { $ne: takenByLivreurId }
    }).select('phone name').lean();

    if (livreurs.length === 0) return;

    const takingLivreur = await EcomUser.findById(takenByLivreurId).select('name').lean();
    
    // Envoyer les messages WhatsApp aux autres livreurs
    for (const livreur of livreurs) {
      if (livreur.phone) {
        try {
          const whatsappMessage = `🚚 *COMMANDE ASSIGNÉE*\n\n` +
            `❌ La commande #${order.orderId} n'est plus disponible\n\n` +
            `👤 *Client:* ${order.clientName}\n` +
            `📍 *Ville:* ${order.city}\n` +
            `✅ *Prise par:* ${takingLivreur?.name || 'Un livreur'}\n\n` +
            `📋 *Autres commandes disponibles dans votre dashboard*`;
          
          await sendWhatsAppMessage({ 
            to: livreur.phone, 
            message: whatsappMessage,
            workspaceId,
            userId: livreur._id,
            firstName: livreur.name 
          });
          console.log(`✅ WhatsApp de commande prise envoyé à ${livreur.name} (${livreur.phone})`);
        } catch (whatsappError) {
          console.error(`❌ Erreur WhatsApp pour ${livreur.phone}:`, whatsappError.message);
        }
      }
    }
    
    console.log(`✅ Notification de commande prise envoyée à ${livreurs.length} autres livreurs`);
    
  } catch (error) {
    console.error('Erreur lors de la notification de commande prise:', error);
  }
}

// Helper: envoyer automatiquement à un numéro WhatsApp prédéfini
async function sendOrderToCustomNumber(order, workspaceId) {
  try {
    // Récupérer les paramètres du workspace pour le numéro personnalisé
    const settings = await WorkspaceSettings.findOne({ workspaceId });
    
    // Numéro WhatsApp personnalisé (peut être configuré dans les settings)
    const customWhatsAppNumber = settings?.customWhatsAppNumber || process.env.CUSTOM_WHATSAPP_NUMBER;
    
    if (!customWhatsAppNumber) {
      console.log('⚠️ Aucun numéro WhatsApp personnalisé configuré');
      return;
    }

    // Formater le message complet pour le destinataire personnalisé
    const whatsappMessage = `📦 *NOUVELLE COMMANDE REÇUE*\n\n` +
      `🔢 *Référence:* #${order.orderId}\n` +
      `📅 *Date:* ${new Date(order.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}\n` +
      `⏰ *Heure:* ${new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      `👤 *INFORMATIONS CLIENT*\n` +
      `👤 *Nom:* ${order.clientName}\n` +
      `📞 *Téléphone:* ${order.clientPhone}\n` +
      `📍 *Ville:* ${order.city}\n` +
      `${order.deliveryLocation ? `🏠 *Adresse:* ${order.deliveryLocation}\n` : ''}` +
      `${order.deliveryTime ? `⏰ *Heure livraison:* ${order.deliveryTime}\n` : ''}\n\n` +
      `📦 *DÉTAILS COMMANDE*\n` +
      `📦 *Produit:* ${order.product}\n` +
      `🔢 *Quantité:* ${order.quantity}\n` +
      `💰 *Prix unitaire:* ${order.price} FCFA\n` +
      `💰 *Total:* ${order.price * order.quantity} FCFA\n\n` +
      `📋 *STATUT:* ${order.status === 'pending' ? '⏳ En attente' : 
                      order.status === 'confirmed' ? '✅ Confirmé' : 
                      order.status === 'shipped' ? '🚚 Expédié' : 
                      order.status === 'delivered' ? '✅ Livré' : 
                      order.status === 'cancelled' ? '❌ Annulé' : order.status}\n\n` +
      `${order.notes ? `📝 *Notes:* ${order.notes}\n\n` : ''}` +
      `🔗 *Traitez cette commande rapidement*`;

    // Envoyer le message WhatsApp
    try {
      await sendWhatsAppMessage({ 
        to: customWhatsAppNumber, 
        message: whatsappMessage,
        workspaceId,
        userId: 'system',
        firstName: 'System'
      });
      
      console.log(`✅ Commande #${order.orderId} envoyée automatiquement à ${customWhatsAppNumber}`);
      
      // Créer une notification système pour le suivi
      await Notification.create({
        userId: null, // Notification système
        type: 'auto_whatsapp_sent',
        title: '📱 WhatsApp auto-envoyé',
        message: `Commande #${order.orderId} envoyée à ${customWhatsAppNumber}`,
        data: {
          orderId: order._id,
          orderIdStr: order.orderId,
          phoneNumber: customWhatsAppNumber,
          sentAt: new Date()
        },
        priority: 'low'
      });
      
    } catch (whatsappError) {
      console.error(`❌ Erreur WhatsApp auto-envoi à ${customWhatsAppNumber}:`, whatsappError.message);
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'envoi WhatsApp automatique:', error);
  }
}

// POST /api/ecom/orders/sync-sheets - Synchroniser depuis Google Sheets
router.post('/sync-sheets', requireEcomAuth, validateEcomAccess('orders', 'write'), async (req, res) => {
  const startTime = Date.now();
  const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let syncKey = null;
  let syncController = null;
  const isSyncAborted = () => Boolean(syncController?.signal?.aborted || req.signal?.aborted);
  
  // Vérifier si la requête a été annulée
  if (isSyncAborted()) {
    console.log(`🚫 [${syncId}] Sync annulée avant le début`);
    return res.status(499).json({ success: false, message: 'Synchronisation annulée' });
  }
  
  // Nettoyer les locks si la requête est annulée
  const cleanupOnAbort = () => {
    const sourceId = req.body?.sourceId || 'unknown';
    const lockKey = `sync_lock_${req.workspaceId}_${sourceId}`;
    WorkspaceSettings.updateOne(
      { workspaceId: req.workspaceId },
      { $pull: { syncLocks: { key: lockKey } } }
    ).catch(() => {}); // Ignorer les erreurs de nettoyage
  };
  
  req.signal?.addEventListener('abort', cleanupOnAbort);
  
    try {
      const { sourceId } = req.body;
      
      // Vérifier si annulé pendant le traitement
      if (isSyncAborted()) {
        console.log(`� [${syncId}] Sync annulée pendant le traitement`);
        return res.status(499).json({ success: false, message: 'Synchronisation annulée' });
      }
      
      // � VALIDATION STRICTE sourceId
      if (!sourceId || typeof sourceId !== 'string') {
        console.log('❌ sourceId manquant ou invalide:', sourceId);
        return res.status(400).json({ 
          success: false, 
          message: 'sourceId est requis et doit être une chaîne de caractères valide' 
        });
      }

      syncKey = `${req.workspaceId}_${sourceId}`;
      const previousSyncController = activeSyncControllers.get(syncKey);
      if (previousSyncController) {
        console.log(`🔄 [${syncId}] Sync en cours détectée pour ${sourceId}, arrêt et redémarrage...`);
        previousSyncController.abort();
      }

      syncController = new AbortController();
      activeSyncControllers.set(syncKey, syncController);
    
    console.log(`🔄 [${syncId}] POST /sync-sheets - Workspace:`, req.workspaceId);
    console.log(`🔄 [${syncId}] SourceId validé:`, sourceId);
    
    // Émettre la progression initiale
    syncProgressEmitter.emit('progress', {
      workspaceId: req.workspaceId,
      sourceId,
      current: 0,
      total: 100,
      status: '🔍 Vérification des paramètres...',
      percentage: 0
    });
    
    // 🔒 VÉRIFICATION LOCK SYNCHRONISATION
    const lockKey = `sync_lock_${req.workspaceId}_${sourceId}`;
    
    // Émettre progression: vérification du lock
    syncProgressEmitter.emit('progress', {
      workspaceId: req.workspaceId,
      sourceId,
      current: 2,
      total: 100,
      status: '🔒 Vérification des verrous...',
      percentage: 2
    });
    
    try {
      const existingLock = await WorkspaceSettings.findOne({ 
        workspaceId: req.workspaceId,
        'syncLocks.key': lockKey 
      });
      
      const activeLock = existingLock?.syncLocks?.find(lock => lock.key === lockKey && lock.expiresAt > new Date());
      if (activeLock) {
        const lockAge = Math.floor((Date.now() - activeLock.createdAt) / 1000);
        console.log(`🔓 [${syncId}] Lock actif détecté (${lockAge}s), nettoyage pour redémarrage...`);
        await WorkspaceSettings.updateOne(
          { workspaceId: req.workspaceId },
          { $pull: { syncLocks: { key: lockKey } } }
        );
      }
    } catch (lockError) {
      // Si le champ syncLocks n'existe pas encore, on continue
      if (lockError.name === 'MongoServerError' && lockError.message.includes('syncLocks')) {
        console.log(`ℹ️ [${syncId}] Champ syncLocks non encore initialisé, continuation...`);
      } else {
        throw lockError;
      }
    }
    
    // 🔒 CRÉATION LOCK TEMPORAIRE (2 minutes)
    const lockExpiresAt = new Date(Date.now() + 120000); // 2 minutes
    let settings = null;
    
    // Émettre progression: création du lock
    syncProgressEmitter.emit('progress', {
      workspaceId: req.workspaceId,
      sourceId,
      current: 4,
      total: 100,
      status: '🔒 Création du verrou de synchronisation...',
      percentage: 4
    });
    
    try {
      // D'abord, s'assurer que le document existe avec syncLocks
      settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
      
      if (!settings) {
        // Créer le document s'il n'existe pas
        settings = new WorkspaceSettings({
          workspaceId: req.workspaceId,
          googleSheets: { apiKey: '', spreadsheetId: '', sheetName: 'Sheet1' },
          sources: [],
          syncLocks: []
        });
        await settings.save();
        console.log(`✅ [${syncId}] WorkspaceSettings créé avec syncLocks`);
      } else if (!settings.syncLocks) {
        // Ajouter le champ syncLocks s'il n'existe pas
        settings.syncLocks = [];
        await settings.save();
        console.log(`🔧 [${syncId}] Champ syncLocks ajouté au document existant`);
      }
      
      // Maintenant ajouter le lock
      const lockData = {
        key: lockKey,
        createdAt: new Date(),
        expiresAt: lockExpiresAt,
        sourceId,
        userId: req.ecomUser?._id
      };
      
      // Nettoyer les anciens locks expirés d'abord
      settings.syncLocks = settings.syncLocks.filter(lock => lock.expiresAt > new Date());
      
      // Vérifier si un lock actif existe déjà
      const existingActiveLock = settings.syncLocks.find(lock => lock.key === lockKey);
      if (existingActiveLock) {
        console.log(`🔓 [${syncId}] Lock déjà actif en mémoire, suppression pour redémarrage...`);
        settings.syncLocks = settings.syncLocks.filter(lock => lock.key !== lockKey);
      }
      
      // Ajouter le nouveau lock
      settings.syncLocks.push(lockData);
      await settings.save();
      
    } catch (lockError) {
      console.error(`❌ [${syncId}] Erreur création lock:`, lockError);
      throw lockError;
    }
    
    console.log(`🔒 [${syncId}] Lock créé pour ${sourceId}, expire à ${lockExpiresAt.toLocaleTimeString('fr-FR')}`);

    console.log(`📋 [${syncId}] Sources disponibles:`, settings.sources?.length || 0);
    console.log(`📋 [${syncId}] Google Sheets legacy:`, settings.googleSheets?.spreadsheetId ? 'OUI' : 'NON');

    let sourceToSync = null;
    
    // 🔍 RECHERCHE SPÉCIFIQUE DE LA SOURCE
    if (sourceId === 'legacy') {
      if (!settings.googleSheets?.spreadsheetId) {
        await WorkspaceSettings.updateOne(
          { workspaceId: req.workspaceId },
          { $pull: { syncLocks: { key: lockKey } } }
        );
        return res.status(404).json({ 
          success: false, 
          message: 'Source legacy non configurée. Veuillez configurer Google Sheets par défaut.' 
        });
      }
      sourceToSync = {
        _id: 'legacy',
        name: 'Commandes Zendo',
        spreadsheetId: settings.googleSheets.spreadsheetId,
        sheetName: settings.googleSheets.sheetName || 'Sheet1'
      };
    } else {
      const source = settings.sources.id(sourceId);
      if (!source) {
        await WorkspaceSettings.updateOne(
          { workspaceId: req.workspaceId },
          { $pull: { syncLocks: { key: lockKey } } }
        );
        return res.status(404).json({ 
          success: false, 
          message: 'Source non trouvée. Veuillez vérifier l\'ID de la source.' 
        });
      }
      
      if (!source.isActive) {
        await WorkspaceSettings.updateOne(
          { workspaceId: req.workspaceId },
          { $pull: { syncLocks: { key: lockKey } } }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Source désactivée. Activez-la d\'abord dans les paramètres.' 
        });
      }
      
      sourceToSync = source;
    }

      console.log(`🎯 [${syncId}] Synchronisation de la source:`, sourceToSync.name);
      
      // Émettre progression: connexion
      syncProgressEmitter.emit('progress', {
        workspaceId: req.workspaceId,
        sourceId,
        current: 8,
        total: 100,
        status: '🌐 Connexion à Google Sheets...',
        percentage: 8
      });

    let totalImported = 0;
    let totalUpdated = 0;
    let syncError = null;

    // 📊 SYNCHRONISATION DE LA SOURCE UNIQUE
    const spreadsheetId = extractSpreadsheetId(sourceToSync.spreadsheetId);
    if (!spreadsheetId) {
      syncError = 'ID de spreadsheet invalide';
    } else {
      const sheetName = sourceToSync.sheetName || 'Sheet1';
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

      try {
        console.log(`🌐 [${syncId}] Appel API Google Sheets...`);
        
        // Vérifier si annulé avant l'appel API
        if (isSyncAborted()) {
          console.log(`🚫 [${syncId}] Sync annulée avant appel API Google Sheets`);
          return res.status(499).json({ success: false, message: 'Synchronisation annulée' });
        }
        
        // Émettre progression: récupération des données
        syncProgressEmitter.emit('progress', {
          workspaceId: req.workspaceId,
          sourceId,
          current: 20,
          total: 100,
          status: '📥 Récupération des données depuis Google Sheets...',
          percentage: 20
        });
        
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}: Accès refusé au sheet`);

        const text = await response.text();
        const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\);?$/);
        if (!jsonStr) throw new Error('Format de réponse invalide');

        const json = JSON.parse(jsonStr[1]);
        const table = json.table;
        if (!table || !table.rows || table.rows.length === 0) {
          console.log(`📭 [${syncId}] Sheet vide ou sans données`);
        } else {
          let headers = table.cols.map(col => col.label || '');
          let dataStartIndex = 0;
          const hasLabels = headers.some(h => h && h.trim());
          if (!hasLabels && table.rows.length > 0) {
            const firstRow = table.rows[0];
            if (firstRow.c) {
              headers = firstRow.c.map(cell => cell ? (cell.f || (cell.v != null ? String(cell.v) : '')) : '');
              dataStartIndex = 1;
            }
          }

          console.log(`📊 [${syncId}] Headers détectés (${headers.length}):`, headers);
          const columnMap = autoDetectColumns(headers, table.rows);
          
          // Fallback: if status column not detected, scan headers manually
          if (columnMap.status === undefined) {
            console.log(`⚠️ [${syncId}] Status column NOT detected! Scanning headers for fallback...`);
            const statusKeywordsForHeaders = ['statut', 'status', 'etat', 'état', 'state', 'livraison', 'delivery'];
            const normalizeH = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
            const usedIdx = new Set(Object.values(columnMap));
            for (let hi = 0; hi < headers.length; hi++) {
              if (usedIdx.has(hi)) continue;
              const nh = normalizeH(headers[hi]);
              if (statusKeywordsForHeaders.some(kw => nh.includes(kw))) {
                columnMap.status = hi;
                console.log(`✅ [${syncId}] Status column found via fallback at index ${hi}: "${headers[hi]}"`);
                break;
              }
            }
            if (columnMap.status === undefined) {
              console.log(`❌ [${syncId}] Status column NOT found even with fallback! All orders will default to 'pending'.`);
            }
          }
          
          console.log(`📊 [${syncId}] Final column mapping:`, columnMap);
          const bulkOps = [];
          
          // Émettre progression: traitement
          syncProgressEmitter.emit('progress', {
            workspaceId: req.workspaceId,
            sourceId,
            current: 30,
            total: 100,
            status: '⚙️ Chargement des commandes existantes...',
            percentage: 30
          });

          // Batch-load existing orders for dedup:
          // 1) By sheetRowId for this source
          const existingByRow = await Order.find(
            { workspaceId: req.workspaceId, sheetRowId: { $regex: `^source_${sourceToSync._id}_` } },
            { sheetRowId: 1, orderId: 1, statusModifiedManually: 1, status: 1 }
          ).lean();
          const existingByRowId = new Map(existingByRow.map(o => [o.sheetRowId, o]));
          
          // 2) By orderId across ALL orders in workspace (to catch manual status changes on any source)
          const allOrdersWithId = await Order.find(
            { workspaceId: req.workspaceId, orderId: { $exists: true, $ne: '' } },
            { orderId: 1, statusModifiedManually: 1, status: 1 }
          ).lean();
          const existingByOrderId = new Map(allOrdersWithId.map(o => [o.orderId, o]));
          console.log(`📋 [${syncId}] ${existingByRow.length} par rowId, ${allOrdersWithId.length} par orderId chargées pour dedup`);

          // Statistiques de mapping des statuts
          let statusStats = {};
          let unrecognizedStatuses = new Set();

          // Mapping étendu des statuts (déclaré une seule fois hors boucle)
          const statusMap = {
            'en attente': 'pending', 'pending': 'pending', 'nouveau': 'pending', 'new': 'pending',
            'à traiter': 'pending', 'a traiter': 'pending', 'en cours': 'pending', 'processing': 'pending',
            'en attente de paiement': 'pending', 'attente paiement': 'pending', 'en validation': 'pending',
            'confirmé': 'confirmed', 'confirmed': 'confirmed', 'confirme': 'confirmed',
            'validé': 'confirmed', 'valide': 'confirmed', 'accepté': 'confirmed', 'accepte': 'confirmed',
            'approuvé': 'confirmed', 'approuve': 'confirmed',
            'expédié': 'shipped', 'shipped': 'shipped', 'expedie': 'shipped', 'envoyé': 'shipped', 'envoye': 'shipped',
            'en livraison': 'shipped', 'en route': 'shipped', 'en transit': 'shipped',
            'en cours de livraison': 'shipped', 'transporté': 'shipped', 'transporte': 'shipped',
            'livré': 'delivered', 'delivered': 'delivered', 'livre': 'delivered',
            'reçu': 'delivered', 'recu': 'delivered', 'livraison effectuée': 'delivered',
            'livraison terminée': 'delivered', 'remis': 'delivered', 'remis client': 'delivered',
            'retour': 'returned', 'returned': 'returned', 'retourné': 'returned', 'retourne': 'returned',
            'retour client': 'returned', 'retour marchandise': 'returned', 'retour produit': 'returned',
            'remboursé': 'returned', 'rembourse': 'returned', 'échange': 'returned', 'echange': 'returned',
            'annulé': 'cancelled', 'cancelled': 'cancelled', 'canceled': 'cancelled', 'annule': 'cancelled',
            'abandonné': 'cancelled', 'abandonne': 'cancelled', 'refusé': 'cancelled', 'refuse': 'cancelled',
            'rejeté': 'cancelled', 'rejete': 'cancelled',
            'injoignable': 'unreachable', 'unreachable': 'unreachable', 'injoignabl': 'unreachable',
            'non joignable': 'unreachable', 'non joignabl': 'unreachable', 'téléphone injoignable': 'unreachable',
            'tel injoignable': 'unreachable', 'pas de réponse': 'unreachable', 'absence réponse': 'unreachable',
            'client injoignable': 'unreachable', 'contact impossible': 'unreachable',
            'appelé': 'called', 'called': 'called', 'appele': 'called', 'contacté': 'called',
            'contacte': 'called', 'appel effectué': 'called', 'appel terminé': 'called',
            'client appelé': 'called', 'tentative appel': 'called',
            'reporté': 'postponed', 'postponed': 'postponed', 'reporte': 'postponed',
            'différé': 'postponed', 'differe': 'postponed', 'plus tard': 'postponed',
            'reporté demande': 'postponed', 'reporté client': 'postponed', 'ajourné': 'postponed',
            'ajourne': 'postponed'
          };

          // Fonction de mapping intelligent avec reconnaissance par mots-clés
          const statusKeywords = {
            'pending': ['attente', 'nouveau', 'new', 'traiter', 'processing', 'validation', 'en cours'],
            'confirmed': ['confirm', 'valid', 'accept', 'approuv'],
            'shipped': ['expedi', 'envoy', 'livraison', 'route', 'transit', 'transport'],
            'delivered': ['livr', 'reçu', 'recu', 'remis', 'termin'],
            'returned': ['retour', 'rembours', 'échange', 'echange', 'refund'],
            'cancelled': ['annul', 'abandon', 'refus', 'rejet', 'cancel'],
            'unreachable': ['injoign', 'joign', 'réponse', 'reponse'],
            'called': ['appel', 'téléphon', 'telephon'],
            'postponed': ['report', 'différ', 'tard', 'ajourn']
          };
          const intelligentStatusMapping = (normalized, raw) => {
            if (!normalized || normalized === '') return 'pending';
            if (statusMap[normalized]) return statusMap[normalized];
            for (const [mapped, kwList] of Object.entries(statusKeywords)) {
              for (const kw of kwList) {
                if (normalized.includes(kw)) return mapped;
              }
            }
            return 'pending';
          };

          // Track seen orderIds to prevent duplicates within same sync batch
          const seenOrderIds = new Set();

          syncProgressEmitter.emit('progress', {
            workspaceId: req.workspaceId,
            sourceId,
            current: 35,
            total: 100,
            status: '⚙️ Traitement des commandes...',
            percentage: 35
          });

          for (let i = dataStartIndex; i < table.rows.length; i++) {
            if (isSyncAborted()) {
              throw new Error('SYNC_RESTARTED');
            }

            const row = table.rows[i];
            if (!row.c || row.c.every(cell => !cell || !cell.v)) continue;

            // Émettre progression toutes les 5% des lignes
            const progress = 35 + Math.floor(((i - dataStartIndex) / (table.rows.length - dataStartIndex)) * 40);
            if (i % Math.max(1, Math.ceil((table.rows.length - dataStartIndex) / 20)) === 0) {
              syncProgressEmitter.emit('progress', {
                workspaceId: req.workspaceId,
                sourceId,
                current: progress,
                total: 100,
                status: `⚙️ Traitement des commandes... ${i - dataStartIndex + 1}/${table.rows.length - dataStartIndex}`,
                percentage: progress
              });
            }

            const getVal = (field) => {
              const idx = columnMap[field];
              if (idx === undefined || !row.c[idx]) return '';
              const cell = row.c[idx];
              return cell.f || (cell.v != null ? String(cell.v) : '');
            };

            const getNumVal = (field) => {
              const idx = columnMap[field];
              if (idx === undefined || !row.c[idx]) return 0;
              return parseFloat(row.c[idx].v) || 0;
            };

            const getDateVal = (field) => {
              const idx = columnMap[field];
              if (idx === undefined || !row.c[idx]) return new Date();
              const cell = row.c[idx];
              // Google Visualization API: Date(year, month, day) — month is 0-indexed, may have spaces
              if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
                const parts = cell.v.match(/Date\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                if (parts) return new Date(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
              }
              // Google Sheets serial date number (days since Dec 30, 1899)
              if (typeof cell.v === 'number' && cell.v > 10000 && cell.v < 100000) {
                const epoch = new Date(1899, 11, 30);
                return new Date(epoch.getTime() + cell.v * 86400000);
              }
              // Use formatted value first (cell.f), then raw value
              return parseFlexDate(cell.f || (cell.v != null ? String(cell.v) : ''));
            };

            const rawData = {};
            headers.forEach((header, idx) => {
              if (header && row.c[idx]) {
                const cell = row.c[idx];
                rawData[header] = cell.f || (cell.v != null ? String(cell.v) : '');
              }
            });

            const rowId = `source_${sourceToSync._id}_row_${i + 2}`;
            let rawStatus = getVal('status') || '';
            
            // Fallback: if status column not mapped, try to find status in rawData
            if (!rawStatus && rawData && typeof rawData === 'object') {
              const statusEntry = Object.entries(rawData).find(([k]) => {
                const nk = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                return nk.includes('statut') || nk.includes('status') || nk.includes('etat') || nk === 'state';
              });
              if (statusEntry && statusEntry[1]) {
                rawStatus = statusEntry[1];
              }
            }
            
            const normalizedStatus = rawStatus.toString().toLowerCase().trim();
            const mappedStatus = intelligentStatusMapping(normalizedStatus, rawStatus);
            
            // Debug: log first 3 rows to verify status mapping
            if (i - dataStartIndex < 3) {
              console.log(`🔍 [${syncId}] Row ${i+2}: rawStatus="${rawStatus}" → normalized="${normalizedStatus}" → mapped="${mappedStatus}" | columnMap.status=${columnMap.status}`);
            }
            
            // Statistiques de mapping
            statusStats[mappedStatus] = (statusStats[mappedStatus] || 0) + 1;
            if (mappedStatus === 'pending' && normalizedStatus !== '' && !statusMap[normalizedStatus]) {
              unrecognizedStatuses.add(rawStatus);
            }

            const orderId = getVal('orderId') || `#${sourceToSync.name}_${i + 2}`;

            // Dedup: skip if this orderId was already processed in this batch
            if (seenOrderIds.has(orderId)) {
              console.log(`⚠️ [${syncId}] Doublon détecté dans le sheet, orderId: ${orderId}, ligne ${i + 2} ignorée`);
              continue;
            }
            seenOrderIds.add(orderId);

            const rawCity = getVal('city');
            const rawAddress = getVal('address');

            // Fallback: si clientPhone non détecté via autoDetectColumns, chercher dans rawData
            let rawPhone = cleanPhoneFromSheet(getVal('clientPhone'));
            if (!rawPhone) {
              const phoneKeys = /^(tel|telephone|phone|mobile|whatsapp|gsm|portable|contact|numero|cellulaire)/i;
              for (const [k, v] of Object.entries(rawData)) {
                if (phoneKeys.test(k.trim()) && v) {
                  const candidate = cleanPhoneFromSheet(String(v));
                  if (candidate.length >= 8) { rawPhone = candidate; break; }
                }
              }
            }
            const doc = {
              orderId,
              date: getDateVal('date'),
              clientName: getVal('clientName'),
              clientPhone: rawPhone,
              city: rawCity || rawAddress,
              address: rawAddress,
              product: getVal('product'),
              quantity: parseInt(getNumVal('quantity')) || 1,
              price: getNumVal('price'),
              status: mappedStatus,
              tags: [sourceToSync.name],
              notes: getVal('notes'),
              rawData
            };

            // Check if order already exists (by rowId first, then by orderId)
            const existingOrder = existingByRowId.get(rowId) || existingByOrderId.get(orderId);

            // Si la commande existe et que le statut a été modifié manuellement, ne pas écraser le statut
            if (existingOrder && existingOrder.statusModifiedManually) {
              delete doc.status;
            }

            // Use orderId + workspaceId as primary dedup key when orderId is a real value (not auto-generated)
            const isRealOrderId = getVal('orderId') && getVal('orderId').trim() !== '';
            const filterKey = isRealOrderId
              ? { workspaceId: req.workspaceId, orderId }
              : { workspaceId: req.workspaceId, sheetRowId: rowId };

            bulkOps.push({
              updateOne: {
                filter: filterKey,
                update: { $set: { ...doc, workspaceId: req.workspaceId, sheetRowId: rowId, source: 'google_sheets' } },
                upsert: true
              }
            });
          }

          if (bulkOps.length > 0) {
            console.log(`💾 [${syncId}] Bulk write de ${bulkOps.length} opérations...`);
            
            // Vérifier si annulé avant le bulk write
            if (isSyncAborted()) {
              console.log(`🚫 [${syncId}] Sync annulée avant bulk write`);
              return res.status(499).json({ success: false, message: 'Synchronisation annulée' });
            }
            
            // Émettre progression: sauvegarde
            syncProgressEmitter.emit('progress', {
              workspaceId: req.workspaceId,
              sourceId,
              current: 80,
              total: 100,
              status: '💾 Sauvegarde des commandes dans la base...',
              percentage: 80
            });
            
            const result = await Order.bulkWrite(bulkOps);
            totalImported += result.upsertedCount || 0;
            totalUpdated += result.modifiedCount || 0;
            console.log(`✅ [${syncId}] Bulk write terminé: ${result.upsertedCount} insérés, ${result.modifiedCount} modifiés`);
            
            // Émettre progression: notifications
            syncProgressEmitter.emit('progress', {
              workspaceId: req.workspaceId,
              sourceId,
              current: 90,
              total: 100,
              status: '📱 Envoi des notifications WhatsApp...',
              percentage: 90
            });
            
            // Notifications pour nouvelles commandes
            if (result.upsertedCount > 0) {
              const newOrders = [];
              for (const op of bulkOps) {
                if (op.updateOne.upsert && op.updateOne.filter.sheetRowId) {
                  newOrders.push(op.updateOne.filter.sheetRowId);
                }
              }
              
              if (newOrders.length > 0) {
                const latestOrder = await Order.findOne({
                  workspaceId: req.workspaceId,
                  sheetRowId: { $in: newOrders },
                  status: { $in: ['pending', 'confirmed'] },
                  whatsappNotificationSent: { $ne: true }
                })
                .setOptions({ skipLean: true })
                .sort({ date: -1 })
                .populate('assignedLivreur', 'name email phone');
                
                if (latestOrder) {
                  await notifyLivreursOfNewOrder(latestOrder, req.workspaceId);
                  await sendOrderToCustomNumber(latestOrder, req.workspaceId);
                  
                  latestOrder.whatsappNotificationSent = true;
                  latestOrder.whatsappNotificationSentAt = new Date();
                  await latestOrder.save();
                  
                  console.log(`📱 [${syncId}] WhatsApp envoyé pour commande: #${latestOrder.orderId}`);
                }
              }
            }
          }

          // Afficher les statistiques de mapping des statuts
          console.log(`📊 [${syncId}] Statistiques de mapping des statuts:`);
          Object.entries(statusStats).forEach(([status, count]) => {
            console.log(`   ${status}: ${count} commandes`);
          });
          
          if (unrecognizedStatuses.size > 0) {
            console.log(`⚠️ [${syncId}] Statuts non reconnus (${unrecognizedStatuses.size}):`, Array.from(unrecognizedStatuses));
          }

          // Update source stats
          if (sourceToSync._id !== 'legacy') {
            const s = settings.sources.id(sourceToSync._id);
            if (s) {
              s.lastSyncAt = new Date();
              s.detectedHeaders = headers.filter(h => h);
              s.detectedColumns = columnMap;
            }
          } else {
            settings.googleSheets.lastSyncAt = new Date();
            settings.googleSheets.detectedHeaders = headers.filter(h => h);
            settings.googleSheets.detectedColumns = columnMap;
          }
        }

      } catch (err) {
        console.error(`❌ [${syncId}] Erreur sync source ${sourceToSync.name}:`, err);
        syncError = err.message === 'SYNC_RESTARTED' ? 'SYNC_RESTARTED' : err.message;
      }
    }

    // Émettre progression: finalisation
    syncProgressEmitter.emit('progress', {
      workspaceId: req.workspaceId,
      sourceId,
      current: 95,
      total: 100,
      status: '� Finalisation de la synchronisation...',
      percentage: 95
    });
    
    // Sauvegarder les settings
    settings.markModified('sources');
    settings.markModified('googleSheets');
    await settings.save();
    
    // �🔓 NETTOYAGE LOCK
    try {
      const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
      if (settings && settings.syncLocks) {
        settings.syncLocks = settings.syncLocks.filter(lock => lock.key !== lockKey);
        await settings.save();
        console.log(`🔓 [${syncId}] Lock libéré`);
      }
    } catch (cleanupError) {
      console.error(`❌ [${syncId}] Erreur nettoyage lock:`, cleanupError);
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    if (syncError) {
      if (syncError === 'SYNC_RESTARTED') {
        return res.status(409).json({
          success: false,
          message: 'Synchronisation redémarrée par une nouvelle demande.',
          duration,
          sourceId
        });
      }

      console.log(`❌ [${syncId}] Sync échouée après ${duration}s:`, syncError);
      return res.status(500).json({ 
        success: false, 
        message: `Erreur synchronisation: ${syncError}`,
        duration,
        sourceId
      });
    }

    console.log(`✅ [${syncId}] Sync réussie en ${duration}s: ${totalImported} importées, ${totalUpdated} mises à jour`);
    
    // Émettre progression: terminé
    syncProgressEmitter.emit('progress', {
      workspaceId: req.workspaceId,
      sourceId,
      current: 100,
      total: 100,
      status: `✅ Terminé! ${totalImported} nouvelles commandes, ${totalUpdated} mises à jour`,
      percentage: 100,
      completed: true
    });
    
    // 📱 Envoyer notification push de synchronisation terminée
    try {
      // Importer le service push
      const { sendPushNotification } = await import('../services/pushService.js');
      
      await sendPushNotification(req.workspaceId, {
        title: '📊 Synchronisation terminée',
        body: `${totalImported} nouvelles commandes importées, ${totalUpdated} mises à jour`,
        icon: '/icons/sync-success.png',
        badge: '/icons/badge.png',
        tag: 'sync-completed',
        data: {
          type: 'sync-completed',
          sourceId,
          imported: totalImported,
          updated: totalUpdated,
          duration: Math.floor((Date.now() - startTime) / 1000)
        },
        actions: [
          {
            action: 'view-orders',
            title: 'Voir les commandes'
          },
          {
            action: 'dismiss',
            title: 'Fermer'
          }
        ]
      });
      
      console.log(`📱 [${syncId}] Notification push envoyée pour la synchronisation`);
    } catch (pushError) {
      console.error(`❌ [${syncId}] Erreur notification push:`, pushError);
      // Ne pas échouer la sync si la notification échoue
    }
    
    res.json({
      success: true,
      message: `Synchronisation terminée: ${totalImported} nouvelles commandes, ${totalUpdated} mises à jour.`,
      data: { 
        imported: totalImported, 
        updated: totalUpdated, 
        duration,
        sourceId,
        sourceName: sourceToSync.name
      }
    });

  } catch (error) {
    console.error(`💥 [${syncId}] Erreur critique sync:`, error);
    
    // 🔓 NETTOYAGE LOCK EN CAS D'ERREUR
    try {
      const sourceIdForCleanup = req.body?.sourceId || 'unknown';
      const lockKey = `sync_lock_${req.workspaceId}_${sourceIdForCleanup}`;
      const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
      if (settings && settings.syncLocks) {
        settings.syncLocks = settings.syncLocks.filter(lock => lock.key !== lockKey);
        await settings.save();
        console.log(`🔓 [${syncId}] Lock d'urgence libéré`);
      }
    } catch (cleanupError) {
      console.error(`❌ [${syncId}] Erreur nettoyage lock:`, cleanupError);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur critique lors de la synchronisation: ' + error.message 
    });
  } finally {
    if (syncKey && syncController) {
      const activeController = activeSyncControllers.get(syncKey);
      if (activeController === syncController) {
        activeSyncControllers.delete(syncKey);
      }
    }
  }
});


// GET /api/ecom/orders/sync-progress - Endpoint SSE pour suivre la progression
router.get('/sync-progress', requireEcomAuth, async (req, res) => {
  const { workspaceId, sourceId } = req.query;
  
  console.log(`📡 SSE connecté - Workspace: ${workspaceId}, Source: ${sourceId}`);
  
  // Configuration SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
  
  // Envoyer la progression initiale immédiatement
  const initialData = {
    current: 1,
    total: 100,
    status: 'Initialisation...',
    percentage: 1,
    workspaceId,
    sourceId
  };
  
  console.log('📤 Envoi progression initiale:', initialData);
  res.write(`data: ${JSON.stringify(initialData)}\n\n`);
  
  // Écouter les événements de progression
  const progressKey = `${workspaceId}_${sourceId}`;
  console.log(`🔑 Clé d'écoute: ${progressKey}`);
  
  const progressHandler = (data) => {
    console.log(`📡 Événement reçu pour ${progressKey}:`, data);
    
    if (data.workspaceId === workspaceId && data.sourceId === sourceId) {
      console.log('📤 Envoi progression au client:', data);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      
      if (data.completed) {
        console.log('✅ Progression terminée, fermeture SSE');
        setTimeout(() => {
          res.end();
        }, 1000);
      }
    }
  };
  
  // S'abonner aux événements
  syncProgressEmitter.on('progress', progressHandler);
  console.log(`👂 Abonné aux événements pour ${progressKey}`);
  
  // Envoyer un heartbeat toutes les 30 secondes pour maintenir la connexion
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);
  
  // Nettoyer quand le client se déconnecte
  req.on('close', () => {
    console.log(`❌ Client déconnecté de ${progressKey}`);
    syncProgressEmitter.off('progress', progressHandler);
    clearInterval(heartbeatInterval);
  });
  
  // Timeout de connexion (2 minutes)
  setTimeout(() => {
    if (!res.closed) {
      console.log(`⏰ Timeout SSE pour ${progressKey}`);
      res.end();
    }
  }, 120000);
});


// GET /api/ecom/orders/settings - Récupérer la config et les sources
router.get('/settings', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    // Cache settings 2 min par workspace
    const cacheKey = `settings:${req.workspaceId}`;
    const cached = memCache.get(cacheKey);
    if (cached) return res.json(cached);

    let settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      settings = await WorkspaceSettings.create({ workspaceId: req.workspaceId });
    }
    
    // Récupérer les sources webhook depuis OrderSource
    let webhookSources = [];
    try {
      webhookSources = await OrderSource.find(
        { workspaceId: req.workspaceId, isActive: true },
        '_id name description color icon metadata isActive'
      ).sort({ name: 1 });
    } catch (err) {
      console.error('Erreur fetch webhook sources:', err);
    }

    // Formatter les sources webhook pour la réponse
    const formattedWebhookSources = webhookSources.map(src => ({
      _id: src._id,
      name: src.name,
      description: src.description || '',
      color: src.color,
      icon: src.icon,
      isActive: src.isActive,
      type: 'webhook',
      metadata: src.metadata || {}
    }));
    
    // Vérifier si des commandes webhook existent pour ce workspace
    let hasWebhookOrders = false;
    try {
      const count = await Order.countDocuments({ workspaceId: req.workspaceId, source: 'webhook' });
      hasWebhookOrders = count > 0;
    } catch (err) { /* ignore */ }

    const response = {
      success: true,
      data: {
        googleSheets: settings.googleSheets,
        sources: [
          ...(settings.sources || []),
          ...formattedWebhookSources,
          ...(hasWebhookOrders ? [{ _id: 'webhook', name: 'Webhook', type: 'webhook_all', isActive: true }] : [])
        ],
        webhookSources: formattedWebhookSources,
        commissionRate: settings.commissionRate ?? 1000
      }
    };
    memCache.set(cacheKey, response, 120000);
    res.json(response);
  } catch (error) {
    console.error('Erreur get settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/sources - Ajouter une nouvelle source Google Sheets
router.post('/sources', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { name, spreadsheetId, sheetName } = req.body;
    if (!name || !spreadsheetId) {
      return res.status(400).json({ success: false, message: 'Nom et ID du sheet requis' });
    }

    let settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      settings = new WorkspaceSettings({ workspaceId: req.workspaceId });
    }

    settings.sources.push({ name, spreadsheetId, sheetName: sheetName || 'Sheet1' });
    await settings.save();
    memCache.delByPrefix(`settings:${req.workspaceId}`);

    res.json({ success: true, message: 'Source ajoutée', data: settings.sources[settings.sources.length - 1] });
  } catch (error) {
    console.error('Erreur add source:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/orders/sources/:sourceId - Modifier une source
router.put('/sources/:sourceId', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { name, spreadsheetId, sheetName, isActive } = req.body;
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) return res.status(404).json({ success: false, message: 'Paramètres non trouvés' });

    const source = settings.sources.id(req.params.sourceId);
    if (!source) return res.status(404).json({ success: false, message: 'Source non trouvée' });

    if (name !== undefined) source.name = name;
    if (spreadsheetId !== undefined) source.spreadsheetId = spreadsheetId;
    if (sheetName !== undefined) source.sheetName = sheetName;
    if (isActive !== undefined) source.isActive = isActive;

    await settings.save();
    memCache.delByPrefix(`settings:${req.workspaceId}`);
    res.json({ success: true, message: 'Source mise à jour', data: source });
  } catch (error) {
    console.error('Erreur update source:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/orders/sources/:sourceId - Supprimer une source Google Sheets
router.delete('/sources/:sourceId', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { sourceId } = req.params;

    if (sourceId === 'legacy') {
      return res.status(400).json({ 
        success: false, 
        message: 'Pour supprimer la source par défaut, utilisez DELETE /api/ecom/orders/sources/legacy/confirm' 
      });
    }

    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings || !settings.sources) {
      return res.status(404).json({ success: false, message: 'Source non trouvée.' });
    }

    const sourceIndex = settings.sources.findIndex(s => String(s._id) === sourceId);
    if (sourceIndex === -1) {
      return res.status(404).json({ success: false, message: 'Source non trouvée.' });
    }

    const deletedSource = settings.sources[sourceIndex];
    settings.sources.splice(sourceIndex, 1);
    await settings.save();

    const deleteResult = await Order.deleteMany({
      workspaceId: req.workspaceId,
      sheetRowId: { $regex: `^source_${sourceId}_` }
    });

    res.json({
      success: true,
      message: `Source "${deletedSource.name}" supprimée avec succès ainsi que ${deleteResult.deletedCount} commande(s)`,
      data: { deletedSource, deletedOrders: deleteResult.deletedCount }
    });
  } catch (error) {
    console.error('Erreur delete source:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/orders/settings - Sauvegarder la config Google Sheets
router.put('/settings', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { spreadsheetId, sheetName, commissionRate } = req.body;

    let settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      settings = new WorkspaceSettings({ workspaceId: req.workspaceId });
    }

    if (spreadsheetId !== undefined) settings.googleSheets.spreadsheetId = spreadsheetId;
    if (sheetName !== undefined) settings.googleSheets.sheetName = sheetName;
    if (commissionRate !== undefined) settings.commissionRate = Number(commissionRate);

    await settings.save();
    res.json({ success: true, message: 'Configuration sauvegardée', data: { ...settings.googleSheets.toObject?.() || settings.googleSheets, commissionRate: settings.commissionRate } });
  } catch (error) {
    console.error('Erreur save settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/settings/push-notifications - Récupérer les préférences de notifications push
router.get('/settings/push-notifications', requireEcomAuth, async (req, res) => {
  try {
    let settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      settings = new WorkspaceSettings({ workspaceId: req.workspaceId });
      await settings.save();
    }

    res.json({ 
      success: true, 
      data: settings.pushNotifications || {
        push_new_orders: true,
        push_status_changes: true,
        push_deliveries: true,
        push_stock_updates: true,
        push_low_stock: true,
        push_sync_completed: true
      }
    });
  } catch (error) {
    console.error('Erreur get push notifications settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/orders/settings/push-notifications - Mettre à jour les préférences de notifications push
router.put('/settings/push-notifications', requireEcomAuth, async (req, res) => {
  try {
    const { push_new_orders, push_status_changes, push_deliveries, push_stock_updates, push_low_stock, push_sync_completed } = req.body;

    let settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      settings = new WorkspaceSettings({ workspaceId: req.workspaceId });
    }

    if (!settings.pushNotifications) {
      settings.pushNotifications = {};
    }

    if (push_new_orders !== undefined) settings.pushNotifications.push_new_orders = push_new_orders;
    if (push_status_changes !== undefined) settings.pushNotifications.push_status_changes = push_status_changes;
    if (push_deliveries !== undefined) settings.pushNotifications.push_deliveries = push_deliveries;
    if (push_stock_updates !== undefined) settings.pushNotifications.push_stock_updates = push_stock_updates;
    if (push_low_stock !== undefined) settings.pushNotifications.push_low_stock = push_low_stock;
    if (push_sync_completed !== undefined) settings.pushNotifications.push_sync_completed = push_sync_completed;

    await settings.save();
    res.json({ success: true, message: 'Préférences de notifications push sauvegardées', data: settings.pushNotifications });
  } catch (error) {
    console.error('Erreur save push notifications settings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/backfill-clients - Créer les clients/prospects depuis toutes les commandes existantes
router.post('/backfill-clients', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    // Mapper statut commande → statut client + tag
    const statusMap = {
      delivered: { clientStatus: 'delivered', tag: 'Client' },
      pending: { clientStatus: 'prospect', tag: 'En attente' },
      confirmed: { clientStatus: 'confirmed', tag: 'Confirmé' },
      shipped: { clientStatus: 'confirmed', tag: 'Expédié' },
      cancelled: { clientStatus: 'prospect', tag: 'Annulé' },
      returned: { clientStatus: 'returned', tag: 'Retour' }
    };
    // Priorité des statuts (un client livré ne doit pas redevenir prospect)
    const statusPriority = { prospect: 1, confirmed: 2, returned: 3, delivered: 4, blocked: 5 };

    const allOrders = await Order.find({ workspaceId: req.workspaceId, status: { $in: Object.keys(statusMap) } });
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const order of allOrders) {
      if (!order.clientName) { skipped++; continue; }

      const phone = (order.clientPhone || '').trim();
      const nameParts = (order.clientName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Client';
      const lastName = nameParts.slice(1).join(' ') || '';
      const orderTotal = (order.price || 0) * (order.quantity || 1);
      const mapping = statusMap[order.status] || statusMap.pending;

      let existingClient = null;
      if (phone) {
        existingClient = await Client.findOne({ workspaceId: req.workspaceId, phone });
      }
      if (!existingClient && firstName) {
        existingClient = await Client.findOne({ workspaceId: req.workspaceId, firstName: { $regex: `^${firstName}$`, $options: 'i' }, lastName: { $regex: `^${lastName}$`, $options: 'i' } });
      }

      const productName = getOrderProductName(order);

      if (existingClient) {
        existingClient.totalOrders = (existingClient.totalOrders || 0) + 1;
        existingClient.totalSpent = (existingClient.totalSpent || 0) + orderTotal;
        // Ne pas rétrograder le statut (livré > confirmé > prospect)
        if ((statusPriority[mapping.clientStatus] || 0) > (statusPriority[existingClient.status] || 0)) {
          existingClient.status = mapping.clientStatus;
        }
        existingClient.lastContactAt = order.date || order.createdAt || new Date();
        if (order.city && !existingClient.city) existingClient.city = order.city;
        if (mapping.tag && !existingClient.tags.includes(mapping.tag)) existingClient.tags.push(mapping.tag);
        if (productName && !(existingClient.products || []).includes(productName)) {
          existingClient.products = [...(existingClient.products || []), productName];
        }
        await existingClient.save();
        updated++;
      } else {
        await Client.create({
          workspaceId: req.workspaceId,
          firstName,
          lastName,
          phone,
          city: order.city || '',
          address: order.deliveryLocation || '',
          source: 'other',
          status: mapping.clientStatus,
          totalOrders: 1,
          totalSpent: orderTotal,
          products: productName ? [productName] : [],
          tags: [mapping.tag],
          lastContactAt: order.date || order.createdAt || new Date(),
          createdBy: req.ecomUser._id
        });
        created++;
      }
    }

    res.json({
      success: true,
      message: `Backfill terminé: ${created} créés, ${updated} mis à jour, ${skipped} ignorés (sans nom) sur ${allOrders.length} commandes`,
      data: { created, updated, skipped, total: allOrders.length }
    });
  } catch (error) {
    console.error('Erreur backfill clients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/available - Commandes disponibles pour les livreurs
router.get('/available', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }

    await escalateExpiredDeliveryOffers(req.workspaceId);

    const { city, limit = 20 } = req.query;
    const userId = req.ecomUser._id.toString();
    const now = new Date();
    
    // Seules les commandes que l'admin a explicitement envoyées au pool livreur
    const filter = {
      workspaceId: req.workspaceId,
      readyForDelivery: true,
      assignedLivreur: null
    };
    
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }
    
    const orders = await Order.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    const visibleOrders = orders
      .filter((order) => {
        const refusedBy = (order.deliveryOfferRefusedBy || []).map((entry) => entry.toString());
        if (refusedBy.includes(userId)) return false;

        const targetLivreurId = order.deliveryOfferTargetLivreur?.toString();
        const hasActiveTarget = order.deliveryOfferMode === 'targeted' && targetLivreurId && (!order.deliveryOfferExpiresAt || new Date(order.deliveryOfferExpiresAt) > now);
        if (!hasActiveTarget) return true;

        return targetLivreurId === userId;
      })
      .map((order) => ({
        ...order,
        livreurView: {
          stateLabel: order.assignedLivreur ? 'Acceptée' : order.deliveryOfferMode === 'targeted' ? 'En attente' : 'Disponible',
          pickupLocation: getPickupLocationLabel(''),
          destination: getDestinationLabel(order),
          priceLabel: formatMoney(order.price),
          gainLabel: formatMoney(order.price),
          estimatedDistanceLabel: getEstimatedDistanceLabel(order),
          responseDeadline: order.deliveryOfferExpiresAt || null,
          isTargeted: order.deliveryOfferMode === 'targeted'
        }
      }));
    
    res.json({
      success: true,
      data: visibleOrders
    });
  } catch (error) {
    console.error('Erreur get available orders:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/:id/delivery-offer - Proposer une commande à un livreur ciblé ou au pool
router.post('/:id/delivery-offer', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_admin', 'super_admin', 'ecom_closeuse'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
    }

    const { mode = 'targeted', livreurId = null, deliveryLocation, deliveryTime, note = '', sendWhatsApp = false } = req.body;
    if (!['targeted', 'broadcast'].includes(mode)) {
      return res.status(400).json({ success: false, message: 'Mode d\'envoi invalide.' });
    }

    if (mode === 'targeted' && !livreurId) {
      return res.status(400).json({ success: false, message: 'Le livreur ciblé est requis.' });
    }

    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId }, null, { skipLean: true });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    if (order.assignedLivreur) {
      return res.status(400).json({ success: false, message: 'Cette commande est déjà acceptée par un livreur.' });
    }

    const now = new Date();
    const responseDeadline = mode === 'targeted'
      ? new Date(now.getTime() + DEFAULT_DELIVERY_RESPONSE_SECONDS * 1000)
      : null;

    if (deliveryLocation !== undefined) order.deliveryLocation = deliveryLocation || '';
    if (deliveryTime !== undefined) order.deliveryTime = deliveryTime || '';
    if (note) {
      order.notes = `${order.notes ? `${order.notes} | ` : ''}Livraison: ${note}`;
    }

    order.readyForDelivery = true;
    order.assignedLivreur = null;
    order.deliveryOfferMode = mode;
    order.deliveryOfferTargetLivreur = mode === 'targeted' ? livreurId : null;
    order.deliveryOfferSentAt = now;
    order.deliveryOfferExpiresAt = responseDeadline;
    order.deliveryOfferEscalatedAt = null;
    order.deliveryOfferRefusedBy = [];
    await order.save();

    const workspaceName = await getWorkspaceName(req.workspaceId);
    const livreurs = mode === 'targeted'
      ? await EcomUser.find({ _id: livreurId, workspaceId: req.workspaceId, role: 'ecom_livreur', isActive: true }).select('_id phone name').lean()
      : await EcomUser.find({ workspaceId: req.workspaceId, role: 'ecom_livreur', isActive: true }).select('_id phone name').lean();

    if (sendWhatsApp && mode === 'targeted' && livreurs[0]?.phone) {
      await sendWhatsAppMessage({
        to: livreurs[0].phone,
        message: req.body.message || `Nouvelle course: ${order.clientName || 'Client'} • ${getDestinationLabel(order)}`,
        workspaceId: req.workspaceId,
        userId: livreurs[0]._id,
        firstName: livreurs[0].name
      }).catch(() => {});
    }

    await sendDeliveryOfferNotifications({
      workspaceId: req.workspaceId,
      order,
      livreurs,
      workspaceName,
      responseDeadline,
      offerMode: mode
    });

    res.json({
      success: true,
      message: mode === 'targeted' ? 'Commande proposée au livreur.' : 'Commande envoyée au pool livreur.',
      data: order
    });
  } catch (error) {
    console.error('Erreur delivery-offer:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/:id/assign - Assigner une commande à un livreur
router.post('/:id/assign', requireEcomAuth, async (req, res) => {
  try {
    await escalateExpiredDeliveryOffers(req.workspaceId);

    const orderId = req.params.id;
    const livreurId = req.ecomUser._id; // L'utilisateur connecté devient le livreur
    
    // Vérifier que l'utilisateur est un livreur
    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }
    
    const order = await Order.findOne({
      _id: orderId,
      workspaceId: req.workspaceId,
      readyForDelivery: true,
      assignedLivreur: null
    }, null, { skipLean: true });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non disponible ou déjà assignée.' });
    }

    const refusedBy = (order.deliveryOfferRefusedBy || []).map((entry) => entry.toString());
    if (refusedBy.includes(livreurId.toString())) {
      return res.status(400).json({ success: false, message: 'Vous avez déjà refusé cette commande.' });
    }

    const targetLivreurId = order.deliveryOfferTargetLivreur?.toString();
    const targetStillActive = order.deliveryOfferMode === 'targeted' && targetLivreurId && (!order.deliveryOfferExpiresAt || new Date(order.deliveryOfferExpiresAt) > new Date());
    if (targetStillActive && targetLivreurId !== livreurId.toString()) {
      return res.status(403).json({ success: false, message: 'Cette commande est actuellement proposée à un autre livreur.' });
    }

    order.assignedLivreur = livreurId;
    order.readyForDelivery = false;
    order.status = 'confirmed';
    order.deliveryOfferMode = 'none';
    order.deliveryOfferTargetLivreur = null;
    order.deliveryOfferSentAt = null;
    order.deliveryOfferExpiresAt = null;
    order.deliveryOfferEscalatedAt = null;
    order.deliveryOfferRefusedBy = [];
    order.updatedAt = new Date();
    await order.save();
    await order.populate('assignedLivreur', 'name email phone');
    
    // Notifier les autres livreurs que cette commande n'est plus disponible
    await notifyOrderTaken(order, req.workspaceId, req.ecomUser._id);
    
    // 📱 Push notification pour assignation livreur
    try {
      const { sendPushNotification } = await import('../services/pushService.js');
      await sendPushNotification(req.workspaceId, {
        title: '🚚 Commande assignée',
        body: `${order.orderId} assignée à un livreur - ${order.clientName || order.clientPhone}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: 'order-assigned',
        data: {
          type: 'order_assigned',
          orderId: order._id.toString(),
          url: `/orders/${order._id}`
        }
      }, 'push_deliveries');
    } catch (e) {
      console.warn('⚠️ Push notification failed:', e.message);
    }
    
    res.json({ 
      success: true, 
      message: 'Commande assignée avec succès',
      data: order 
    });
  } catch (error) {
    console.error('Erreur assign order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/:id/refuse - Refuser une course disponible
router.post('/:id/refuse', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
      readyForDelivery: true,
      assignedLivreur: null
    }, null, { skipLean: true });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    const livreurId = req.ecomUser._id.toString();
    const refusedBy = (order.deliveryOfferRefusedBy || []).map((entry) => entry.toString());
    if (!refusedBy.includes(livreurId)) {
      order.deliveryOfferRefusedBy = [...(order.deliveryOfferRefusedBy || []), req.ecomUser._id];
    }

    const isTargetedToCurrentLivreur = order.deliveryOfferMode === 'targeted' && order.deliveryOfferTargetLivreur?.toString() === livreurId;
    if (isTargetedToCurrentLivreur) {
      order.deliveryOfferMode = 'broadcast';
      order.deliveryOfferTargetLivreur = null;
      order.deliveryOfferSentAt = new Date();
      order.deliveryOfferExpiresAt = null;
      order.deliveryOfferEscalatedAt = new Date();

      const workspaceName = await getWorkspaceName(req.workspaceId);
      const otherLivreurs = await EcomUser.find({
        workspaceId: req.workspaceId,
        role: 'ecom_livreur',
        isActive: true,
        _id: { $nin: order.deliveryOfferRefusedBy }
      }).select('_id').lean();

      await order.save();
      await sendDeliveryOfferNotifications({
        workspaceId: req.workspaceId,
        order,
        livreurs: otherLivreurs,
        workspaceName,
        responseDeadline: null,
        offerMode: 'broadcast'
      });
    } else {
      await order.save();
    }

    res.json({ success: true, message: 'Commande refusée.' });
  } catch (error) {
    console.error('Erreur refuse order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/orders/:id - Modifier une commande (statut, champs, auto-tagging, client sync)
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    console.log(`🔧 PUT /orders/${req.params.id} - User: ${req.ecomUser?.email}, Role: ${req.ecomUser?.role}, Workspace: ${req.workspaceId}`);
    
    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId }, null, { skipLean: true });
    console.log(`📋 Order lookup result:`, order ? `Found - ${order.orderId}` : 'Not found');
    
    if (!order) {
      console.log(`❌ Order not found: ${req.params.id} in workspace ${req.workspaceId}`);
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    // Vérifier les permissions : admin/super-admin/closeuse peuvent modifier, autres uniquement leurs commandes assignées
    const canModify = ['ecom_admin', 'super_admin', 'ecom_closeuse'].includes(req.ecomUser.role) || 
                     order.assignedCloseuse?.toString() === req.ecomUser._id.toString();
    
    console.log(`🔐 Permission check - User role: ${req.ecomUser.role}, Can modify: ${canModify}, Assigned closeuse: ${order.assignedCloseuse}`);
    
    if (!canModify) {
      console.log(`❌ Permission denied for user ${req.ecomUser.email} on order ${order.orderId}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé : vous n\'avez pas les permissions pour modifier cette commande' 
      });
    }

    const allowedFields = ['status', 'notes', 'clientName', 'clientPhone', 'city', 'address', 'product', 'quantity', 'price', 'deliveryLocation', 'deliveryTime', 'tags', 'assignedLivreur'];
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    const statusChanged = req.body.status !== undefined && req.body.status !== order.status;

    // Marquer le statut comme modifié manuellement
    if (req.body.status !== undefined) {
      updateData.statusModifiedManually = true;
      updateData.lastManualStatusUpdate = new Date();
    }

    // Auto-tagging basé sur le statut
    if (statusChanged) {
      const statusTags = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Client', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté' };
      const allStatusTags = Object.values(statusTags);
      // Retirer les anciens tags de statut, garder les tags manuels
      let currentTags = (order.tags || []).filter(t => !allStatusTags.includes(t));
      // Ajouter le nouveau tag
      const newTag = statusTags[req.body.status] || req.body.status;
      if (newTag && !currentTags.includes(newTag)) {
        currentTags.push(newTag);
      }
      updateData.tags = currentTags;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.workspaceId },
      { $set: updateData },
      { new: true }
    );

    // Notification interne sur changement de statut
    if (statusChanged) {
      notifyOrderStatus(req.workspaceId, updatedOrder, req.body.status).catch(() => {});
      
      // Notification d'équipe (exclure l'acteur)
      notifyTeamOrderStatusChanged(req.workspaceId, req.ecomUser._id, updatedOrder, req.body.status, req.ecomUser.email).catch(() => {});
      console.log(`📱 [Orders] Push statut envoyé via notifyOrderStatus: ${updatedOrder._id} -> ${req.body.status}`);
    }

    // Notification + push au livreur spécifique quand il est assigné
    const livreurAssigned = req.body.assignedLivreur &&
      req.body.assignedLivreur !== '' &&
      String(order.assignedLivreur || '') !== String(req.body.assignedLivreur);
    if (livreurAssigned) {
      try {
        const { sendPushNotificationToUser } = await import('../services/pushService.js');
        const livreur = await EcomUser.findById(req.body.assignedLivreur).select('name email');
        if (livreur) {
          // Utiliser createNotification pour avoir le socket emit (temps réel)
          createNotification({
            workspaceId: req.workspaceId,
            userId: livreur._id,
            type: 'order_assigned_to_you',
            title: '🚚 Commande assignée',
            message: `Commande #${updatedOrder.orderId} — ${updatedOrder.clientName || ''} vous a été assignée`,
            icon: 'order',
            link: `/ecom/livreur/available`
          }).catch(err => console.warn('⚠️ createNotification livreur assigné failed:', err.message));
          sendPushNotificationToUser(livreur._id, {
            title: '🚚 Commande assignée',
            body: `Commande #${updatedOrder.orderId} — ${updatedOrder.clientName || ''} vous a été assignée`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: `assigned-${updatedOrder._id}`,
            data: { type: 'order_assigned_to_you', orderId: updatedOrder._id.toString(), url: '/ecom/livreur/available' },
            requireInteraction: true
          }).catch(() => {});
          console.log(`📱 Notification envoyée au livreur ${livreur.name || livreur.email} pour commande ${updatedOrder.orderId}`);
        }
      } catch (notifErr) {
        console.warn('⚠️ Push notification livreur assigné failed:', notifErr.message);
      }
    }

    res.json({ success: true, message: 'Commande mise à jour', data: updatedOrder });
  } catch (error) {
    console.error('Erreur update order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/orders/:id/status - Modifier uniquement le statut (route optimisée pour closeuses)
router.patch('/:id/status', requireEcomAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le statut est requis' 
      });
    }

    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId }, null, { skipLean: true });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    // Vérifier les permissions : admin/super-admin/closeuse peuvent modifier, autres uniquement leurs commandes assignées
    const canModify = ['ecom_admin', 'super_admin', 'ecom_closeuse'].includes(req.ecomUser.role) || 
                     order.assignedCloseuse?.toString() === req.ecomUser._id.toString();
    
    if (!canModify) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé : vous n\'avez pas les permissions pour modifier cette commande' 
      });
    }

    // Valider le statut
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'unreachable', 'called', 'postponed', 'reported'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Statut invalide. Valeurs autorisées: ' + validStatuses.join(', ') 
      });
    }

    const oldStatus = order.status;
    const statusChanged = status !== oldStatus;
    order.status = status;
    order.statusModifiedManually = true;
    order.lastManualStatusUpdate = new Date();
    order.updatedAt = new Date();

    // Auto-tagging basé sur le statut
    const statusTags = { 
      pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', 
      delivered: 'Client', returned: 'Retour', cancelled: 'Annulé', 
      unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté' 
    };
    const allStatusTags = Object.values(statusTags);
    
    // Retirer les anciens tags de statut, garder les tags manuels
    order.tags = (order.tags || []).filter(t => !allStatusTags.includes(t));
    // Ajouter le nouveau tag
    const newTag = statusTags[status] || status;
    if (newTag && !order.tags.includes(newTag)) {
      order.tags.push(newTag);
    }

    await order.save();

    // Notifications internes
    if (statusChanged) {
      notifyOrderStatus(req.workspaceId, order, status).catch(() => {});
      notifyTeamOrderStatusChanged(req.workspaceId, req.ecomUser._id, order, status, req.ecomUser.email).catch(() => {});
      console.log(`📱 [Orders] Push statut envoyé via notifyOrderStatus: ${order._id} -> ${status}`);
    }

    res.json({ 
      success: true, 
      message: `Statut mis à jour : ${oldStatus} → ${status}`,
      data: {
        orderId: order._id,
        oldStatus,
        newStatus: status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    console.error('Erreur update order status:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/orders/:id/livreur-action - Livreur met à jour le statut de livraison
router.patch('/:id/livreur-action', requireEcomAuth, async (req, res) => {
  try {
    const { action } = req.body; // 'pickup_confirmed' | 'delivered' | 'refused' | 'issue'
    const livreurId = req.ecomUser._id;

    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }

    const validActions = ['pickup_confirmed', 'delivered', 'refused', 'issue'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Action invalide.' });
    }

    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId }, null, { skipLean: true });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    // Seul le livreur assigné peut agir (ou un admin)
    const isAdmin = ['ecom_admin', 'super_admin'].includes(req.ecomUser.role);
    if (!isAdmin && order.assignedLivreur?.toString() !== livreurId.toString()) {
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas assigné à cette commande.' });
    }

    const actionMap = {
      pickup_confirmed: 'shipped',
      delivered: 'delivered',
      refused: 'pending',
      issue: 'returned'
    };

    const newStatus = actionMap[action];
    const oldStatus = order.status;

    if (action === 'refused') {
      order.assignedLivreur = null;
      order.readyForDelivery = true;
      order.deliveryOfferMode = 'broadcast';
      order.deliveryOfferTargetLivreur = null;
      order.deliveryOfferSentAt = new Date();
      order.deliveryOfferExpiresAt = null;
      order.deliveryOfferEscalatedAt = new Date();
      order.deliveryOfferRefusedBy = [...(order.deliveryOfferRefusedBy || []), req.ecomUser._id];
    }

    order.status = newStatus;
    order.statusModifiedManually = true;
    order.lastManualStatusUpdate = new Date();
    order.updatedAt = new Date();

    // Auto-tagging
    const statusTags = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Client', returned: 'Retour', cancelled: 'Annulé' };
    const allStatusTags = Object.values(statusTags);
    order.tags = (order.tags || []).filter(t => !allStatusTags.includes(t));
    const newTag = statusTags[newStatus];
    if (newTag && !order.tags.includes(newTag)) order.tags.push(newTag);

    await order.save();

    if (action === 'refused') {
      try {
        const workspaceName = await getWorkspaceName(req.workspaceId);
        const livreurs = await EcomUser.find({
          workspaceId: req.workspaceId,
          role: 'ecom_livreur',
          isActive: true,
          _id: { $nin: order.deliveryOfferRefusedBy }
        }).select('_id').lean();

        await sendDeliveryOfferNotifications({
          workspaceId: req.workspaceId,
          order,
          livreurs,
          workspaceName,
          responseDeadline: null,
          offerMode: 'broadcast'
        });
      } catch (notifyError) {
        console.warn('⚠️ Refused order re-broadcast failed:', notifyError.message);
      }
    }

    if (newStatus !== oldStatus) {
      notifyOrderStatus(req.workspaceId, order, newStatus).catch(() => {});
      notifyTeamOrderStatusChanged(req.workspaceId, req.ecomUser._id, order, newStatus, req.ecomUser.email).catch(() => {});
    }

    res.json({ success: true, message: 'Action enregistrée', data: order });
  } catch (error) {
    console.error('Erreur livreur action:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/orders/:id/ready-for-delivery - Admin/closeuse envoie une commande au pool livreur
router.patch('/:id/ready-for-delivery', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_admin', 'super_admin', 'ecom_closeuse'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Réservé aux administrateurs.' });
    }

    const ready = req.body.ready !== false; // défaut: true
    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId }, null, { skipLean: true });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    order.readyForDelivery = ready;
    order.deliveryOfferMode = ready ? 'broadcast' : 'none';
    order.deliveryOfferTargetLivreur = null;
    order.deliveryOfferSentAt = ready ? new Date() : null;
    order.deliveryOfferExpiresAt = null;
    order.deliveryOfferEscalatedAt = ready ? new Date() : null;
    order.deliveryOfferRefusedBy = ready ? [] : order.deliveryOfferRefusedBy;
    await order.save();

    // Notification + push à tous les livreurs actifs quand on envoie au pool
    if (ready) {
      try {
        const workspaceName = await getWorkspaceName(req.workspaceId);
        const livreurs = await EcomUser.find({ workspaceId: req.workspaceId, role: 'ecom_livreur', isActive: true }).select('_id').lean();
        await sendDeliveryOfferNotifications({
          workspaceId: req.workspaceId,
          order,
          livreurs,
          workspaceName,
          responseDeadline: null,
          offerMode: 'broadcast'
        });
        console.log(`📱 Notifications envoyées à ${livreurs.length} livreur(s) pour commande ${order.orderId}`);
      } catch (notifErr) {
        console.warn('⚠️ Notification livreurs pool failed:', notifErr.message);
      }
    }

    res.json({ success: true, message: ready ? 'Commande envoyée au pool livreur.' : 'Commande retirée du pool livreur.', data: order });
  } catch (error) {
    console.error('Erreur ready-for-delivery:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/livreur/history - Historique de livraisons du livreur connecté
router.get('/livreur/history', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }

    const { page = 1, limit = 20, status } = req.query;
    const filter = {
      workspaceId: req.workspaceId,
      assignedLivreur: req.ecomUser._id,
      status: { $in: ['delivered', 'returned', 'cancelled'] }
    };

    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter)
    ]);

    res.json({ success: true, data: orders, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Erreur livreur history:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/livreur/stats - Stats et gains du livreur connecté
router.get('/livreur/stats', requireEcomAuth, async (req, res) => {
  try {
    if (!['ecom_livreur', 'ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux livreurs.' });
    }

    const livreurId = req.ecomUser._id;
    const workspaceId = req.workspaceId;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [allDelivered, monthDelivered, weekDelivered, inProgress, available] = await Promise.all([
      Order.countDocuments({ workspaceId, assignedLivreur: livreurId, status: 'delivered' }),
      Order.countDocuments({ workspaceId, assignedLivreur: livreurId, status: 'delivered', updatedAt: { $gte: startOfMonth } }),
      Order.countDocuments({ workspaceId, assignedLivreur: livreurId, status: 'delivered', updatedAt: { $gte: startOfWeek } }),
      Order.countDocuments({ workspaceId, assignedLivreur: livreurId, status: { $in: ['confirmed', 'shipped'] } }),
      Order.countDocuments({ workspaceId, readyForDelivery: true, assignedLivreur: null })
    ]);

    // Calcul des gains approximatifs basés sur le champ price des commandes livrées
    const earningsAgg = await Order.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId.toString()), assignedLivreur: new mongoose.Types.ObjectId(livreurId.toString()), status: 'delivered' } },
      { $group: { _id: null, totalAmount: { $sum: '$price' }, count: { $sum: 1 } } }
    ]);
    const monthEarningsAgg = await Order.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId.toString()), assignedLivreur: new mongoose.Types.ObjectId(livreurId.toString()), status: 'delivered', updatedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, totalAmount: { $sum: '$price' }, count: { $sum: 1 } } }
    ]);

    const totalAmount = earningsAgg[0]?.totalAmount || 0;
    const monthAmount = monthEarningsAgg[0]?.totalAmount || 0;

    res.json({
      success: true,
      data: {
        allTime: { delivered: allDelivered, amount: totalAmount },
        thisMonth: { delivered: monthDelivered, amount: monthAmount },
        thisWeek: { delivered: weekDelivered },
        inProgress,
        available
      }
    });
  } catch (error) {
    console.error('Erreur livreur stats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/orders/:id - Supprimer une commande
router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    // Vérifier les permissions : admin/super-admin/closeuse peuvent supprimer, autres uniquement leurs commandes assignées
    const canDelete = ['ecom_admin', 'super_admin', 'ecom_closeuse'].includes(req.ecomUser.role) || 
                     order.assignedCloseuse?.toString() === req.ecomUser._id.toString();
    
    if (!canDelete) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé : vous n\'avez pas les permissions pour supprimer cette commande' 
      });
    }

    await Order.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Commande supprimée' });
  } catch (error) {
    console.error('Erreur delete order:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/fix-statuses - Corriger les statuts en français
router.get('/fix-statuses', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const statusMapping = {
      'livré': 'delivered', 'livre': 'delivered', 'LIVRÉ': 'delivered', 'LIVRE': 'delivered',
      'en attente': 'pending', 'attente': 'pending', 'EN ATTENTE': 'pending',
      'confirmé': 'confirmed', 'confirme': 'confirmed', 'CONFIRMÉ': 'confirmed', 'CONFIRME': 'confirmed',
      'expédié': 'shipped', 'expedie': 'shipped', 'EXPÉDIÉ': 'shipped', 'EXPEDIE': 'shipped',
      'retour': 'returned', 'retourné': 'returned', 'RETOUR': 'returned', 'RETournÉ': 'returned',
      'annulé': 'cancelled', 'annule': 'cancelled', 'ANNULÉ': 'cancelled', 'ANNULE': 'cancelled',
      'injoignable': 'unreachable', 'INJOIGNABLE': 'unreachable',
      'appelé': 'called', 'appele': 'called', 'APPELÉ': 'called', 'APPELE': 'called',
      'reporté': 'postponed', 'reporte': 'postponed', 'REPORTÉ': 'postponed', 'REPORTE': 'postponed'
    };
    
    let totalUpdated = 0;
    const updateResults = [];
    
    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
      const result = await Order.updateMany(
        { workspaceId: req.workspaceId, status: oldStatus },
        { status: newStatus }
      );
      
      if (result.modifiedCount > 0) {
        totalUpdated += result.modifiedCount;
        updateResults.push({ oldStatus, newStatus, count: result.modifiedCount });
        console.log(`✅ ${oldStatus} -> ${newStatus}: ${result.modifiedCount} commandes`);
      }
    }
    
    res.json({ 
      success: true, 
      message: `${totalUpdated} commandes mises à jour`,
      data: {
        totalUpdated,
        updates: updateResults
      }
    });
  } catch (error) {
    console.error('Erreur fix statuses:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/cancel-pending-expired - Annulation manuelle one-shot des pending > 73h
router.post('/cancel-pending-expired', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    if (!['ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    console.info(`🟡 [Orders] Manual cancel-pending-expired requested by ${req.ecomUser?.email || req.ecomUser?._id} (workspace=${req.workspaceId})`);

    const cancelledCount = await autoCancelExpiredPendingOrders(req.workspaceId, {
      log: true,
      trigger: 'manual-button',
      force: true
    });

    console.info(`✅ [Orders] Manual cancel-pending-expired done (workspace=${req.workspaceId}, cancelled=${cancelledCount})`);

    return res.json({
      success: true,
      message: `${cancelledCount} commande(s) en attente annulée(s) automatiquement`,
      data: {
        cancelledCount,
        thresholdHours: AUTO_CANCEL_HOURS
      }
    });
  } catch (error) {
    console.error('Erreur annulation pending expirées:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/:id - Détails d'une commande spécifique
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    })
    .populate('assignedLivreur', 'name email phone');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    // Vérifier les permissions pour les livreurs : seulement leurs commandes assignées ou celles du pool
    if (req.ecomUser.role === 'ecom_livreur') {
      const isAssigned = order.assignedLivreur?.toString() === req.ecomUser._id.toString();
      const isInPool = order.readyForDelivery === true;
      if (!isAssigned && !isInPool) {
        return res.status(403).json({ success: false, message: 'Accès refusé: cette commande ne vous est pas assignée.' });
      }
    }

    // Vérifier les permissions pour les closeuses
    if (req.ecomUser.role === 'ecom_closeuse') {
      console.log('🔒 [order detail] Closeuse access check - userId:', req.ecomUser._id, 'orderId:', req.params.id);
      const assignment = await CloseuseAssignment.findOne({
        closeuseId: req.ecomUser._id,
        workspaceId: req.workspaceId,
        isActive: true
      }).populate('productAssignments.productIds', 'name');

      console.log('🔒 [order detail] Assignment found:', !!assignment);
      if (assignment) {
        const sheetProductNames = (assignment.productAssignments || []).flatMap(pa => pa.sheetProductNames || []);
        const assignedProductIds = (assignment.productAssignments || []).flatMap(pa => pa.productIds || []);
        const assignedCityNames = (assignment.cityAssignments || []).flatMap(ca => ca.cityNames || []);
        const assignedSourceIds = (assignment.orderSources || []).map(os => String(os.sourceId)).filter(Boolean);
        
        // Extraire les noms des produits de la base de données
        const dbProductNames = assignedProductIds
          .filter(pid => pid && typeof pid === 'object' && pid.name) // Filtrer les produits peuplés
          .map(pid => pid.name);
        
        // Combiner tous les noms de produits (sheets + DB)
        const allProductNames = [...sheetProductNames, ...dbProductNames];
        
        console.log('🔒 [order detail] Checking access - order product:', order.product, 'assigned products:', allProductNames, 'assigned cities:', assignedCityNames, 'assigned sources:', assignedSourceIds);

        // Vérifier si le produit de la commande est dans les produits assignés
        const productMatch = allProductNames.some(assignedProduct => 
          assignedProduct && order.product && 
          order.product.trim().toLowerCase() === assignedProduct.trim().toLowerCase()
        );

        // Vérifier si la ville de la commande est dans les villes assignées
        const cityMatch = assignedCityNames.some(assignedCity => 
          assignedCity && order.city && 
          order.city.trim().toLowerCase() === assignedCity.trim().toLowerCase()
        );

        // Vérifier si la source de la commande est dans les sources assignées
        const sourceMatch = assignedSourceIds.some(sourceId => {
          if (sourceId === 'legacy') {
            return order.sheetRowId && !order.sheetRowId.startsWith('source_');
          }
          return order.sheetRowId && order.sheetRowId.startsWith(`source_${sourceId}_`);
        });

        if (!productMatch && !cityMatch && !sourceMatch) {
          console.log('🔒 [order detail] Access denied - product, city or source not assigned');
          return res.status(403).json({ success: false, message: 'Accès refusé: cette commande ne vous est pas assignée.' });
        }

        console.log('🔒 [order detail] Access granted - product, city or source match found');
      } else {
        console.log('🔒 [order detail] Access denied - no assignment found');
        return res.status(403).json({ success: false, message: 'Accès refusé: aucune affectation trouvée.' });
      }
    }

    // Récupérer le téléphone depuis rawData si clientPhone est vide
    fixOrderPhone(order);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Erreur get order detail:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/:id/send-whatsapp - Envoyer les détails d'une commande par WhatsApp
router.post('/:id/send-whatsapp', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }

    // Récupérer la commande
    const order = await Order.findOne({ 
      _id: req.params.id, 
      workspaceId: req.workspaceId 
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée.' });
    }

    // Formater le message WhatsApp avec tous les détails
    const whatsappMessage = `📦 *DÉTAILS COMMANDE*\n\n` +
      `🔢 *Référence:* #${order.orderId}\n` +
      `📅 *Date:* ${new Date(order.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}\n` +
      `⏰ *Heure:* ${new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n` +
      `👤 *INFORMATIONS CLIENT*\n` +
      `👤 *Nom:* ${order.clientName}\n` +
      `📞 *Téléphone:* ${order.clientPhone}\n` +
      `📍 *Ville:* ${order.city}\n` +
      `${order.deliveryLocation ? `🏠 *Adresse:* ${order.deliveryLocation}\n` : ''}` +
      `${order.deliveryTime ? `⏰ *Heure livraison:* ${order.deliveryTime}\n` : ''}\n\n` +
      `📦 *DÉTAILS COMMANDE*\n` +
      `📦 *Produit:* ${order.product}\n` +
      `🔢 *Quantité:* ${order.quantity}\n` +
      `💰 *Prix unitaire:* ${order.price} FCFA\n` +
      `💰 *Total:* ${order.price * order.quantity} FCFA\n\n` +
      `📋 *STATUT:* ${order.status === 'pending' ? '⏳ En attente' : 
                      order.status === 'confirmed' ? '✅ Confirmé' : 
                      order.status === 'shipped' ? '🚚 Expédié' : 
                      order.status === 'delivered' ? '✅ Livré' : 
                      order.status === 'cancelled' ? '❌ Annulé' : order.status}\n\n` +
      `${order.notes ? `📝 *Notes:* ${order.notes}\n\n` : ''}` +
      `🔗 *Envoyé depuis le système de gestion*`;

    // Envoyer le message WhatsApp
    try {
      await sendWhatsAppMessage({ 
        to: phoneNumber, 
        message: whatsappMessage,
        workspaceId: req.workspaceId,
        userId: req.ecomUser._id,
        firstName: req.ecomUser.name 
      });
      
      console.log(`✅ WhatsApp envoyé à ${phoneNumber} pour la commande #${order.orderId}`);
      
      res.json({
        success: true,
        message: `Détails de la commande #${order.orderId} envoyés par WhatsApp à ${phoneNumber}`,
        data: {
          orderId: order._id,
          orderIdStr: order.orderId,
          phoneNumber: phoneNumber,
          sentAt: new Date()
        }
      });
    } catch (whatsappError) {
      console.error(`❌ Erreur WhatsApp pour ${phoneNumber}:`, whatsappError.message);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de l\'envoi WhatsApp: ' + whatsappError.message 
      });
    }
  } catch (error) {
    console.error('Erreur send order WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/ecom/orders/config/whatsapp-auto - Toggle rapide WhatsApp auto-confirmation
router.patch('/config/whatsapp-auto', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { whatsappAutoConfirm } = req.body;
    if (typeof whatsappAutoConfirm !== 'boolean') {
      return res.status(400).json({ success: false, message: 'whatsappAutoConfirm doit être un booléen' });
    }

    await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { whatsappAutoConfirm });

    res.json({
      success: true,
      message: whatsappAutoConfirm ? 'Messages WhatsApp automatiques activés' : 'Messages WhatsApp automatiques désactivés',
      data: { whatsappAutoConfirm }
    });
  } catch (error) {
    console.error('Erreur toggle WhatsApp auto:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/config/whatsapp - Configurer le numéro WhatsApp personnalisé
router.post('/config/whatsapp', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { customWhatsAppNumber, whatsappAutoConfirm } = req.body;
    
    // Validation du format international (tous pays)
    if (customWhatsAppNumber) {
      const phoneCheck = formatInternationalPhone(customWhatsAppNumber);
      if (!phoneCheck.success) {
        return res.status(400).json({ 
          success: false, 
          message: `Format de numéro invalide: ${phoneCheck.error}. Exemples: 237699887766, 33612345678, 18005551234` 
        });
      }
    }
    
    const cleanNumber = customWhatsAppNumber ? formatInternationalPhone(customWhatsAppNumber).formatted : '';
    
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { workspaceId: req.workspaceId },
      { $set: { customWhatsAppNumber: cleanNumber } },
      { new: true, upsert: true }
    );

    // Mettre à jour whatsappAutoConfirm sur le workspace si fourni
    if (typeof whatsappAutoConfirm === 'boolean') {
      await EcomWorkspace.findByIdAndUpdate(req.workspaceId, { whatsappAutoConfirm });
    }

    res.json({
      success: true,
      message: `Numéro WhatsApp configuré: ${cleanNumber}`,
      data: {
        customWhatsAppNumber: cleanNumber,
        whatsappAutoConfirm: typeof whatsappAutoConfirm === 'boolean' ? whatsappAutoConfirm : undefined
      }
    });

  } catch (error) {
    console.error('Erreur configuration WhatsApp personnalisé:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/config/whatsapp - Récupérer la configuration WhatsApp
router.get('/config/whatsapp', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const [settings, workspace] = await Promise.all([
      WorkspaceSettings.findOne({ workspaceId: req.workspaceId }),
      EcomWorkspace.findById(req.workspaceId).select('whatsappAutoConfirm').lean()
    ]);
    
    res.json({
      success: true,
      data: {
        customWhatsAppNumber: settings?.customWhatsAppNumber || null,
        environmentNumber: process.env.CUSTOM_WHATSAPP_NUMBER || null,
        whatsappNumbers: settings?.whatsappNumbers || [],
        whatsappAutoConfirm: workspace?.whatsappAutoConfirm || false
      }
    });

  } catch (error) {
    console.error('Erreur récupération config WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/whatsapp-numbers - Lister tous les numéros WhatsApp configurés
router.get('/whatsapp-numbers', requireEcomAuth, validateEcomAccess('products', 'read'), async (req, res) => {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    const whatsappNumbers = settings?.whatsappNumbers || [];
    res.json({ success: true, data: whatsappNumbers });
  } catch (error) {
    console.error('Erreur récupération numéros WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/whatsapp-numbers - Ajouter un numéro WhatsApp pour un pays
router.post('/whatsapp-numbers', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { country, countryName, phoneNumber, isActive = true, autoNotifyOrders = true } = req.body;
    
    // Validation
    if (!country || !countryName || !phoneNumber) {
      return res.status(400).json({ success: false, message: 'Pays, nom du pays et numéro requis' });
    }
    
    if (!/^\+\d{10,15}$/.test(phoneNumber)) {
      return res.status(400).json({ success: false, message: 'Format invalide. Le numéro doit être au format international (+country_code + number)' });
    }
    
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { workspaceId: req.workspaceId },
      { 
        $push: { 
          whatsappNumbers: {
            country,
            countryName,
            phoneNumber,
            isActive,
            autoNotifyOrders,
            createdAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, message: 'Numéro WhatsApp ajouté', data: settings });
  } catch (error) {
    console.error('Erreur ajout numéro WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/orders/whatsapp-numbers/:id - Mettre à jour un numéro WhatsApp
router.put('/whatsapp-numbers/:id', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { country, countryName, phoneNumber, isActive, autoNotifyOrders } = req.body;
    
    if (phoneNumber && !/^\+\d{10,15}$/.test(phoneNumber)) {
      return res.status(400).json({ success: false, message: 'Format invalide. Le numéro doit être au format international (+country_code + number)' });
    }
    
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { workspaceId: req.workspaceId, 'whatsappNumbers._id': id },
      { 
        $set: { 
          'whatsappNumbers.$.country': country,
          'whatsappNumbers.$.countryName': countryName,
          'whatsappNumbers.$.phoneNumber': phoneNumber,
          'whatsappNumbers.$.isActive': isActive,
          'whatsappNumbers.$.autoNotifyOrders': autoNotifyOrders
        }
      },
      { new: true }
    );
    
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Numéro WhatsApp non trouvé' });
    }
    
    res.json({ success: true, message: 'Numéro WhatsApp mis à jour', data: settings });
  } catch (error) {
    console.error('Erreur mise à jour numéro WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/orders/whatsapp-numbers/:id - Supprimer un numéro WhatsApp
router.delete('/whatsapp-numbers/:id', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const settings = await WorkspaceSettings.findOneAndUpdate(
      { workspaceId: req.workspaceId },
      { $pull: { whatsappNumbers: { _id: id } } },
      { new: true }
    );
    
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Numéro WhatsApp non trouvé' });
    }
    
    res.json({ success: true, message: 'Numéro WhatsApp supprimé', data: settings });
  } catch (error) {
    console.error('Erreur suppression numéro WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/test-whatsapp - Tester l'envoi WhatsApp
router.post('/test-whatsapp', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { country } = req.body;
    
    // Récupérer les paramètres du workspace
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Configuration non trouvée' });
    }
    
    let targetNumber;
    if (country) {
      // Trouver le numéro pour le pays spécifié
      const whatsappConfig = settings.whatsappNumbers?.find(w => w.country === country && w.isActive);
      targetNumber = whatsappConfig?.phoneNumber;
    } else {
      // Utiliser le numéro par défaut
      targetNumber = settings.customWhatsAppNumber;
    }
    
    if (!targetNumber) {
      return res.status(400).json({ success: false, message: 'Aucun numéro WhatsApp configuré pour ce pays' });
    }
    
    const testMessage = `🧪 *TEST DE NOTIFICATION* 🧪

✅ Le système de notification WhatsApp fonctionne correctement!
📅 Heure du test: ${new Date().toLocaleString('fr-FR')}
🌍 Pays: ${country || 'Défaut'}
📱 Numéro: ${targetNumber}

🚀 Prêt à recevoir les notifications des nouvelles commandes!`;
    
    await sendWhatsAppMessage({
      to: targetNumber,
      message: testMessage,
      workspaceId: req.workspaceId,
      userId: req.ecomUser._id,
      firstName: req.ecomUser.name || 'Admin'
    });
    
    res.json({ success: true, message: 'Message de test envoyé avec succès' });
  } catch (error) {
    console.error('Erreur test WhatsApp:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi du message de test' });
  }
});

// DELETE /api/ecom/orders/sources/legacy/confirm - Supprimer le Google Sheet par défaut
router.delete('/sources/legacy/confirm', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const settings = await WorkspaceSettings.findOne({ workspaceId: req.workspaceId });
    
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Workspace non trouvé.' });
    }

    // Supprimer seulement le spreadsheetId et réinitialiser le sync, mais garder les autres configurations
    settings.googleSheets.spreadsheetId = '';
    settings.googleSheets.lastSyncAt = null;
    
    await settings.save();

    // Supprimer toutes les commandes de la source legacy (sheetRowId ne commence pas par source_)
    const deleteResult = await Order.deleteMany({
      workspaceId: req.workspaceId,
      sheetRowId: { $not: /^source_/, $ne: '' }
    });

    res.json({
      success: true,
      message: `Google Sheet par défaut supprimé avec succès ainsi que ${deleteResult.deletedCount} commande(s). Les autres configurations sont conservées.`,
      data: {
        clearedFields: ['googleSheets.spreadsheetId', 'googleSheets.lastSyncAt'],
        preservedFields: ['googleSheets.apiKey', 'googleSheets.sheetName', 'googleSheets.columnMapping'],
        deletedOrders: deleteResult.deletedCount
      }
    });

  } catch (error) {
    console.error('Erreur suppression source legacy:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/orders/sync-clients - Synchroniser tous les clients depuis les commandes
router.post('/sync-clients', requireEcomAuth, async (req, res) => {
  try {
    console.log('🔄 ===== DÉBUT SYNCHRONISATION CLIENTS =====');
    console.log('👤 Utilisateur:', req.ecomUser?.email);
    console.log('🏢 Workspace ID:', req.workspaceId);
    
    const orderStatusMap = {
      delivered: { clientStatus: 'delivered', tag: 'Client' },
      pending: { clientStatus: 'prospect', tag: 'En attente' },
      confirmed: { clientStatus: 'confirmed', tag: 'Confirmé' },
      shipped: { clientStatus: 'confirmed', tag: 'Expédié' },
      cancelled: { clientStatus: 'prospect', tag: 'Annulé' },
      returned: { clientStatus: 'returned', tag: 'Retour' },
      unreachable: { clientStatus: 'prospect', tag: 'Injoignable' },
      called: { clientStatus: 'prospect', tag: 'Appelé' },
      postponed: { clientStatus: 'prospect', tag: 'Reporté' }
    };
    console.log('📋 Mapping statuts:', Object.keys(orderStatusMap));
    
    const statusPriority = { prospect: 1, confirmed: 2, returned: 3, delivered: 4, blocked: 5 };
    console.log('📊 Priorité statuts:', statusPriority);

    // Récupérer les statuts demandés (ou tous par défaut)
    const requestedStatuses = req.body.statuses;
    const statusesToSync = requestedStatuses && requestedStatuses.length > 0 
      ? requestedStatuses 
      : Object.keys(orderStatusMap);
    console.log('🎯 Statuts à synchroniser:', statusesToSync);

    // Récupérer toutes les commandes avec clientPhone (TOUS les statuts)
    console.log('🔍 Recherche des commandes avec téléphone (tous statuts)...');
    const orders = await Order.find({ 
      workspaceId: req.workspaceId,
      clientPhone: { $exists: true, $ne: '' }
    }).lean();

    console.log(`📦 ${orders.length} commandes trouvées pour synchronisation`);
    if (orders.length > 0) {
      console.log('📈 Exemples de commandes:');
      orders.slice(0, 3).forEach((order, i) => {
        console.log(`  ${i+1}. ${order.clientName} - ${order.clientPhone} - ${order.status} - ${order.price}x${order.quantity}`);
      });
    }

    let created = 0;
    let updated = 0;
    const statusGroups = {};
    const totalOrders = orders.length;

    // Emit progress start
    req.app.get('io')?.emit(`sync-clients-progress-${req.workspaceId}`, {
      type: 'start',
      total: totalOrders,
      message: `Démarrage de la synchronisation de ${totalOrders} commandes...`
    });

    console.log('⚙️ Traitement des commandes...');
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const phone = (order.clientPhone || '').trim();
      const nameParts = (order.clientName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Client';
      const lastName = nameParts.slice(1).join(' ') || '';
      const orderTotal = (order.price || 0) * (order.quantity || 1);
      const productName = getOrderProductName(order);

      // Log détaillé pour les premières commandes
      if (i < 5) {
        console.log(`📝 Commande ${i+1}: ${order.clientName} (${phone}) - ${order.status} - ${orderTotal}€ - produit: "${productName}" (raw: "${order.product}")`);
      }

      // Compter par statut pour le retour
      const mapping = orderStatusMap[order.status];
      if (mapping) {
        statusGroups[mapping.clientStatus] = (statusGroups[mapping.clientStatus] || 0) + 1;
        if (i < 5) {
          console.log(`  ↳ Mapping: ${order.status} → ${mapping.clientStatus} (${mapping.tag})`);
        }
      } else {
        if (i < 5) {
          console.log(`  ⚠️ Aucun mapping pour statut: ${order.status}`);
        }
      }

      let client = await Client.findOne({ workspaceId: req.workspaceId, phone });

      if (!client) {
        // Créer nouveau client uniquement
        console.log(`  ➕ Création nouveau client: ${firstName} ${lastName} (${phone})`);
        client = new Client({
          workspaceId: req.workspaceId,
          phone,
          firstName,
          lastName,
          city: order.city || '',
          address: order.address || '',
          products: productName ? [productName] : [],
          status: mapping ? mapping.clientStatus : 'prospect',
          tags: mapping ? [mapping.tag] : [],
          totalOrders: 1,
          totalSpent: orderTotal,
          lastOrderAt: order.date,
          lastContactAt: order.date,
          createdBy: req.ecomUser._id
        });
        await client.save();
        created++;
        console.log(`  ✅ Client créé avec ID: ${client._id}`);
      } else {
        // Client existe déjà - on l'ignore complètement
        console.log(`  ⏭️ Client existant ignoré: ${client.firstName} (${phone})`);
        // Ne rien faire, passer au suivant
      }

      // Emit progress every 10 orders or at the end
      if (i % 10 === 0 || i === orders.length - 1) {
        const progress = Math.round(((i + 1) / totalOrders) * 100);
        console.log(`📊 Progression: ${i + 1}/${totalOrders} (${progress}%) - Créés: ${created}, Mis à jour: ${updated}`);
        
        req.app.get('io')?.emit(`sync-clients-progress-${req.workspaceId}`, {
          type: 'progress',
          current: i + 1,
          total: totalOrders,
          percentage: progress,
          created,
          updated,
          message: `Traitement de ${i + 1}/${totalOrders} commandes...`
        });
      }
    }

    console.log(`✅ ===== SYNCHRONISATION TERMINÉE =====`);
    console.log(`📊 Résultats:`);
    console.log(`  • Total commandes traitées: ${totalOrders}`);
    console.log(`  • Nouveaux clients créés: ${created}`);
    console.log(`  • Clients existants ignorés: ${totalOrders - created}`);
    console.log(`📊 Répartition par statut:`, statusGroups);

    // Emit completion
    req.app.get('io')?.emit(`sync-clients-progress-${req.workspaceId}`, {
      type: 'complete',
      created,
      updated: 0,
      total: created,
      statusGroups,
      message: `Synchronisation terminée ! ${created} nouveaux clients créés.`
    });

    res.json({ 
      success: true, 
      message: 'Synchronisation terminée',
      data: {
        created,
        updated: 0,
        total: created,
        statusGroups
      }
    });
  } catch (error) {
    console.error('❌ ===== ERREUR SYNCHRONISATION =====');
    console.error('Erreur:', error.message);
    console.error('Stack:', error.stack);
    
    // Emit error
    req.app.get('io')?.emit(`sync-clients-progress-${req.workspaceId}`, {
      type: 'error',
      message: 'Erreur lors de la synchronisation'
    });
    
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/orders/revenue-periods - Statistiques des revenus par période
router.get('/revenue-periods', requireEcomAuth, async (req, res) => {
  try {
    const { allWorkspaces } = req.query;
    
    // Si super_admin et allWorkspaces=true, ne pas filtrer par workspaceId
    const isSuperAdmin = req.ecomUser.role === 'super_admin';
    const viewAllWorkspaces = isSuperAdmin && allWorkspaces === 'true';
    
    const baseFilter = viewAllWorkspaces ? {} : { workspaceId: req.workspaceId };
    const now = new Date();
    
    // Définir les périodes
    const periods = [
      {
        key: 'today',
        label: "Aujourd'hui",
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      },
      {
        key: '7days',
        label: '7 derniers jours',
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      {
        key: '30days',
        label: '30 derniers jours',
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      {
        key: '90days',
        label: '90 derniers jours',
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        end: new Date()
      }
    ];
    
    // Calculer les revenus pour chaque période
    const revenueStats = await Promise.all(
      periods.map(async (period) => {
        const deliveredOrders = await Order.find(
          {
            ...baseFilter,
            status: 'delivered',
            date: { $gte: period.start, $lt: period.end }
          },
          { price: 1, quantity: 1 }
        ).lean();
        
        const revenue = deliveredOrders.reduce((sum, o) => sum + ((o.price || 0) * (o.quantity || 1)), 0);
        const orderCount = deliveredOrders.length;
        
        return {
          period: period.key,
          label: period.label,
          revenue,
          orderCount,
          avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
          startDate: period.start,
          endDate: period.end
        };
      })
    );
    
    // Statistiques globales
    const totalDeliveredOrders = await Order.find(
      { ...baseFilter, status: 'delivered' },
      { price: 1, quantity: 1 }
    ).lean();
    
    const totalRevenue = totalDeliveredOrders.reduce((sum, o) => sum + ((o.price || 0) * (o.quantity || 1)), 0);
    const totalOrderCount = totalDeliveredOrders.length;
    
    res.json({
      success: true,
      data: {
        periods: revenueStats,
        total: {
          revenue: totalRevenue,
          orderCount: totalOrderCount,
          avgOrderValue: totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0
        },
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erreur revenue periods:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
