import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { normalizeCity, deduplicateCities } from '../utils/cityNormalizer.js';
import { checkMessageLimit, incrementMessageCount } from '../services/messageLimitService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import { formatInternationalPhone, normalizePhone } from '../utils/phoneUtils.js';
import { 
  groupRecipientsByCountry, 
  filterRecipientsByCountry, 
  excludeRecipientsByCountry,
  generateCountryReport,
  parseCountryFilters
} from '../utils/campaignCountryUtils.js';

// Helper pour convertir en ObjectId
const toObjectId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
  return null;
};

// Helper functions
let analyzeSpamRisk = () => ({ risk: 'LOW', score: 0, warnings: [], recommendations: [] });
let validateMessageBeforeSend = () => true;
let getHumanDelayWithVariation = () => 5000;
let simulateHumanBehavior = async () => {};

// Fonction de nettoyage de numéro avec détection automatique du code pays
// Utilise normalizePhone pour la détection intelligente (pas de préfixe 237 forcé)
let sanitizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Utiliser normalizePhone avec détection automatique (sans defaultPrefix forcé)
  // → détecte le code pays existant ou applique la logique formatInternationalPhone
  const normalized = normalizePhone(phone);
  if (normalized) return normalized;
  
  // Fallback : nettoyage basique si normalizePhone échoue (garder le numéro brut)
  let cleaned = String(phone).trim();
  cleaned = cleaned.replace(/^'+/, '');
  cleaned = cleaned.replace(/[\s\-().]/g, '');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  cleaned = cleaned.replace(/\D/g, '');
  if (!cleaned || cleaned.length < 8) return null;
  return cleaned;
};

const router = express.Router();

// Helper: remplacer les variables dans le template (priorité aux données de commande)
function renderMessage(template, client, orderData = null) {
  // Utiliser les données de commande si disponibles, sinon utiliser les données client
  const orderInfo = orderData || client;
  
  let msg = template
    .replace(/\{firstName\}/g, client.firstName || orderInfo.clientName?.split(' ')[0] || '')
    .replace(/\{lastName\}/g, client.lastName || orderInfo.clientName?.split(' ').slice(1).join(' ') || '')
    .replace(/\{fullName\}/g, client.firstName && client.lastName ? [client.firstName, client.lastName].join(' ') : (orderInfo.clientName || ''))
    .replace(/\{phone\}/g, client.phone || orderInfo.clientPhone || '')
    .replace(/\{city\}/g, client.city || orderInfo.city || '')
    .replace(/\{product\}/g, (client.products || []).join(', ') || orderInfo.product || '')
    .replace(/\{totalOrders\}/g, String(client.totalOrders || 1))
    .replace(/\{totalSpent\}/g, String(client.totalSpent || (orderInfo.price || 0) * (orderInfo.quantity || 1)))
    .replace(/\{status\}/g, client._orderStatus || orderInfo.status || '')
    .replace(/\{price\}/g, client._orderPrice ? String(client._orderPrice) : String(orderInfo.price || 0))
    .replace(/\{quantity\}/g, client._orderQuantity ? String(client._orderQuantity) : String(orderInfo.quantity || 1))
    .replace(/\{orderDate\}/g, client._orderDate ? new Date(client._orderDate).toLocaleDateString('fr-FR') : (orderInfo.date ? new Date(orderInfo.date).toLocaleDateString('fr-FR') : ''))
    .replace(/\{address\}/g, client.address || orderInfo.address || '')
    .replace(/\{lastContact\}/g, client.lastContactAt ? new Date(client.lastContactAt).toLocaleDateString('fr-FR') : (orderInfo.date ? new Date(orderInfo.date).toLocaleDateString('fr-FR') : ''));
  return msg;
}

// Helper: normalise un filtre qui peut être string ou array
function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean);
}
function toMongoIn(v) {
  const arr = toArray(v);
  if (arr.length === 0) return null;
  return arr.length === 1 ? arr[0] : { $in: arr };
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pushAndCondition(filter, condition) {
  if (!filter.$and) filter.$and = [];
  filter.$and.push(condition);
}

// Mapping groupe → regex (correspondance flexible sur statuts Google Sheet)
const STATUS_REGEX_MAP = {
  pending:     /en.?attente|pending|attente/i,
  confirmed:   /confirm/i,
  shipped:     /expédi|expedi|ship|exped|en.cours.de.livr/i,
  delivered:   /livr[ée]|deliver/i,
  returned:    /retour|return|renvoy/i,
  cancelled:   /annul|cancel/i,
  unreachable: /injoignable|unreachable|non.joignable/i,
  called:      /appel[ée]|call/i,
  postponed:   /report[ée]|renvoy[ée]|postpone/i,
};

// Convertit un tableau de groupes status → conditions MongoDB $or regex
function buildStatusConditions(statusGroups) {
  return statusGroups.flatMap(s => {
    const pattern = STATUS_REGEX_MAP[s];
    const conditions = [];

    if (s === 'pending') {
      conditions.push({ status: { $exists: false } });
      conditions.push({ status: null });
      conditions.push({ status: '' });
    }

    conditions.push({ status: { $regex: pattern ? pattern.source : `^${escapeRegex(s)}$`, $options: 'i' } });
    return conditions;
  });
}

// Helper: construire le filtre MongoDB depuis les targetFilters
function buildClientFilter(workspaceId, targetFilters) {
  const filter = { workspaceId };
  const clientStatus = toMongoIn(targetFilters.clientStatus);
  if (clientStatus) filter.status = clientStatus;
  if (targetFilters.city) {
    const cities = toArray(targetFilters.city);
    // FIX: Exclure les entrées sans ville (null, undefined, vide)
    if (cities.length === 1) {
      filter.city = { $regex: `^${cities[0]}`, $options: 'i', $exists: true, $ne: '' };
    } else if (cities.length > 1) {
      filter.$and = [
        { city: { $exists: true, $ne: '' } },
        { $or: cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } })) }
      ];
    }
  }
  if (targetFilters.product) {
    const prods = toArray(targetFilters.product);
    filter.products = prods.length > 1 ? { $in: prods } : prods[0];
  }
  if (targetFilters.tag) filter.tags = targetFilters.tag;
  if (targetFilters.minOrders > 0) filter.totalOrders = { ...filter.totalOrders, $gte: targetFilters.minOrders };
  if (targetFilters.maxOrders > 0) filter.totalOrders = { ...filter.totalOrders, $lte: targetFilters.maxOrders };
  if (targetFilters.lastContactBefore) filter.lastContactAt = { $lt: new Date(targetFilters.lastContactBefore) };
  return filter;
}

function buildOrderFilter(workspaceId, targetFilters = {}, options = {}) {
  const { requirePhone = false } = options;
  const orderFilter = { workspaceId };
  const statusArr = toArray(targetFilters.orderStatus);

  if (requirePhone) {
    orderFilter.clientPhone = { $exists: true, $ne: '' };
  }

  if (statusArr.length > 0) {
    const conds = buildStatusConditions(statusArr);
    if (conds.length === 1 && conds[0].status) orderFilter.status = conds[0].status;
    else orderFilter.$or = [...(orderFilter.$or || []), ...conds];
  }

  if (targetFilters.orderCity) {
    const cities = toArray(targetFilters.orderCity).map(v => String(v).trim()).filter(Boolean);
    if (cities.length === 1) {
      orderFilter.city = { $regex: escapeRegex(cities[0]), $options: 'i' };
    } else if (cities.length > 1) {
      pushAndCondition(orderFilter, {
        $or: cities.map(city => ({ city: { $regex: escapeRegex(city), $options: 'i' } }))
      });
    }
  }

  if (targetFilters.orderAddress) {
    orderFilter.address = { $regex: escapeRegex(targetFilters.orderAddress), $options: 'i' };
  }

  if (targetFilters.orderProduct) {
    const prods = toArray(targetFilters.orderProduct).map(v => String(v).trim()).filter(Boolean);
    if (prods.length === 1) {
      orderFilter.product = { $regex: escapeRegex(prods[0]), $options: 'i' };
    } else if (prods.length > 1) {
      pushAndCondition(orderFilter, {
        $or: prods.map(product => ({ product: { $regex: escapeRegex(product), $options: 'i' } }))
      });
    }
  }

  if (targetFilters.orderDateFrom) orderFilter.date = { ...orderFilter.date, $gte: new Date(targetFilters.orderDateFrom) };
  if (targetFilters.orderDateTo) {
    const end = new Date(targetFilters.orderDateTo);
    end.setHours(23, 59, 59, 999);
    orderFilter.date = { ...orderFilter.date, $lte: end };
  }
  if (targetFilters.orderSourceId) {
    if (targetFilters.orderSourceId === 'legacy') {
      orderFilter.sheetRowId = { $not: /^source_/ };
    } else {
      orderFilter.sheetRowId = { $regex: `^source_${targetFilters.orderSourceId}_` };
    }
  }
  if (targetFilters.orderMinPrice > 0) orderFilter.price = { ...orderFilter.price, $gte: targetFilters.orderMinPrice };
  if (targetFilters.orderMaxPrice > 0) orderFilter.price = { ...orderFilter.price, $lte: targetFilters.orderMaxPrice };

  return orderFilter;
}

// Helper: ciblage basé sur les commandes — retourne les phones des clients correspondants
async function getClientsFromOrderFilters(workspaceId, targetFilters) {
  console.log(`🔍 [getClientsFromOrderFilters] Début - workspaceId: ${workspaceId}`);
  console.log(`🔍 [getClientsFromOrderFilters] targetFilters:`, JSON.stringify(targetFilters));

  const orderFilter = buildOrderFilter(workspaceId, targetFilters);
  console.log(`🔍 [getClientsFromOrderFilters] Filtre MongoDB final:`, JSON.stringify(orderFilter));

  const orders = await Order.find(orderFilter).select('clientName clientPhone city address product price date status quantity').lean();
  console.log(`✅ [getClientsFromOrderFilters] ${orders.length} commandes trouvées en base`);

  // Group by CLEANED phone, keep most recent order data
  const clientMap = new Map();
  let phonesWithoutNumber = 0;
  for (const o of orders) {
    const cleaned = sanitizePhoneNumber(o.clientPhone);
    if (!cleaned) {
      phonesWithoutNumber++;
      continue;
    }
    const existing = clientMap.get(cleaned);
    if (!existing || new Date(o.date) > new Date(existing.date)) {
      clientMap.set(cleaned, o);
    }
  }
  
  console.log(`📞 [getClientsFromOrderFilters] ${clientMap.size} numéros nettoyés uniques extraits`);
  if (phonesWithoutNumber > 0) {
    console.log(`⚠️ [getClientsFromOrderFilters] ${phonesWithoutNumber} commandes sans numéro de téléphone ignorées`);
  }
  
  return clientMap; // Map<cleanedPhone, orderData>
}

// GET /api/ecom/campaigns - Liste des campagnes
router.get('/', requireEcomAuth, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    const filter = { workspaceId: req.workspaceId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const campaigns = await Campaign.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('name type status createdAt scheduledAt sentAt targetFilters messageTemplate sendProgress stats recipientSnapshotIds selectedClientIds')
      .lean();

    const total = campaigns.length;

    const stats = {
      total,
      draft: 0,
      scheduled: 0,
      sent: 0,
      sending: 0,
      paused: 0,
      failed: 0,
      interrupted: 0
    };

    campaigns.forEach(c => {
      if (stats[c.status] !== undefined) stats[c.status]++;
    });

    res.json({
      success: true,
      data: {
        campaigns,
        stats,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (error) {
    console.error('Erreur get campaigns:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/campaigns/filter-options - Villes, adresses et produits depuis commandes + clients
router.get('/filter-options', requireEcomAuth, async (req, res) => {
  try {
    const wsFilter = { workspaceId: req.workspaceId };
    
    // Récupérer uniquement depuis les commandes
    const [orderCities, orderProducts, orderAddresses] = await Promise.all([
      Order.find({ ...wsFilter, city: { $exists: true, $ne: '' } }).distinct('city'),
      Order.find({ ...wsFilter, product: { $exists: true, $ne: '' } }).distinct('product'),
      Order.find({ ...wsFilter, address: { $exists: true, $ne: '' } }).distinct('address')
    ]);

    const normalizeOption = (value) => String(value || '').trim();

    const cities = deduplicateCities(orderCities.map(normalizeOption).filter(v => v && /[a-zA-ZÀ-ÿ]/.test(v)));
    const products = [...new Set(orderProducts.map(normalizeOption).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    const addresses = [...new Set(orderAddresses.map(normalizeOption).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    // Statuts de commande possibles
    const orderStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned', 'unreachable', 'called', 'postponed'];
    
    console.log(`📊 Filter options: ${cities.length} villes, ${products.length} produits, ${addresses.length} adresses`);
    res.json({
      success: true,
      data: {
        cities,
        products,
        addresses,
        orderStatuses
      }
    });
  } catch (error) {
    console.error('Erreur filter-options:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/campaigns/templates - Templates prédéfinis
router.get('/templates', requireEcomAuth, async (req, res) => {
  try {
    const templates = [
      {
        id: 'relance_pending',
        name: 'Relance en attente',
        type: 'relance_pending',
        message: 'Bonjour {firstName} 👋\n\nNous avons bien reçu votre commande ({product}) et l\'attendons votre confirmation.\n\nMerci de nous contacter rapidement pour finaliser.',
        targetFilters: { orderStatus: 'pending' }
      },
      {
        id: 'relance_unreachable',
        name: 'Relance injoignables',
        type: 'relance_unreachable',
        message: 'Bonjour {firstName} 👋\n\nNous avons essayé de vous joindre plusieurs fois concernant votre commande ({product}).\n\nQuand seriez-vous disponible ?',
        targetFilters: { orderStatus: 'unreachable' }
      },
      {
        id: 'relance_called',
        name: 'Relance appelés',
        type: 'relance_called',
        message: 'Bonjour {firstName} 👋\n\nSuite à notre appel, nous attendons votre confirmation pour votre commande ({product}).\n\nMerci de nous contacter si vous avez des questions.',
        targetFilters: { orderStatus: 'called' }
      },
      {
        id: 'relance_postponed',
        name: 'Relance reportés',
        type: 'relance_postponed',
        message: 'Bonjour {firstName} 👋\n\nVous aviez souhaité reporter votre commande ({product}). Nous revenons vers vous pour savoir si vous êtes toujours intéressé(e).',
        targetFilters: { orderStatus: 'postponed' }
      },
      {
        id: 'relance_cancelled',
        name: 'Relance annulés',
        type: 'relance_cancelled',
        message: 'Bonjour {firstName} 👋\n\nNous avons remarqué l\'annulation de votre commande ({product}). Y a-t-il un problème que nous pouvons résoudre ?',
        targetFilters: { orderStatus: 'cancelled' }
      },
      {
        id: 'relance_returns',
        name: 'Relance retours',
        type: 'relance_returns',
        message: 'Bonjour {firstName} 👋\n\nNous avons noté le retour de votre commande ({product}). Nous aimerions comprendre la raison.\n\nY a-t-il un problème que nous pouvons résoudre ?',
        targetFilters: { orderStatus: 'returned' }
      },
      {
        id: 'relance_confirmed_not_shipped',
        name: 'Relance confirmés non expédiés',
        type: 'relance_confirmed_not_shipped',
        message: 'Bonjour {firstName} 😊\n\nVotre commande ({product}) est confirmée et sera bientôt expédiée.\n\nNous vous tiendrons informé(e) de l\'avancement.',
        targetFilters: { orderStatus: 'confirmed' }
      },
      {
        id: 'promo_city',
        name: 'Promo par ville',
        type: 'promo_city',
        message: 'Bonjour {firstName} 🎉\n\nOffre exclusive pour {city} ! Profitez de nos prix exceptionnels sur {product}.\n\nContactez-nous vite, stock limité !',
        targetFilters: { orderCity: '{city}' }
      },
      {
        id: 'promo_product',
        name: 'Promo par produit',
        type: 'promo_product',
        message: 'Bonjour {firstName} 🎉\n\nPromo spéciale sur {product} ! Prix imbattable garanti.\n\nN\'attendez plus, contactez-nous !',
        targetFilters: { orderProduct: '{product}' }
      },
      {
        id: 'followup_delivery',
        name: 'Suivi après livraison',
        type: 'followup_delivery',
        message: 'Bonjour {firstName} 👋\n\nVotre commande ({product}) a été livrée. Tout se passe bien ?\n\nN\'hésitez pas à nous faire votre retour !',
        targetFilters: { orderStatus: 'delivered' }
      },
      {
        id: 'relance_reorder',
        name: 'Relance réachat',
        type: 'relance_reorder',
        message: 'Bonjour {firstName} 👋\n\nMerci pour votre confiance ! Profitez de -10% sur votre prochaine commande avec le code REORDER10.\n\nÀ bientôt !',
        targetFilters: { minOrders: 1 }
      },
      {
        id: 'followup_shipping',
        name: 'Suivi expédition',
        type: 'followup_shipping',
        message: 'Bonjour {firstName} 📦\n\nVotre commande ({product}) est en cours d\'expédition.\n\nVous la recevrez sous peu. Suivez votre colis en ligne !',
        targetFilters: { orderStatus: 'shipping' }
      }
    ];
    
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Erreur get templates:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns/preview - Prévisualiser les clients ciblés
router.post('/preview', requireEcomAuth, async (req, res) => {
  console.log(`🔍 [PREVIEW] Requête reçue pour le workspace ${req.workspaceId}`);
  try {
    const { targetFilters } = req.body;
    const tf = targetFilters || {};
    console.log(`🔍 [PREVIEW] Filtres reçus:`, JSON.stringify(tf));

    // Guard: workspaceId requis
    if (!req.workspaceId) {
      console.warn(`⚠️ [PREVIEW] WorkspaceId manquant dans la requête`);
      return res.json({ success: true, data: { count: 0, clients: [] } });
    }

    // Vérifier si au moins un filtre de commande est actif
    const hasOrderStatus = toArray(tf.orderStatus).length > 0;
    const hasOrderCity = toArray(tf.orderCity).length > 0;
    const hasOrderProduct = toArray(tf.orderProduct).length > 0;
    const hasOrderAddress = !!tf.orderAddress;
    const hasOrderDate = !!(tf.orderDateFrom || tf.orderDateTo);
    const hasOrderPrice = (tf.orderMinPrice > 0) || (tf.orderMaxPrice > 0);
    const hasAnyOrderFilter = hasOrderStatus || hasOrderCity || hasOrderProduct || hasOrderAddress || hasOrderDate || hasOrderPrice;

    console.log(`📊 [PREVIEW] Type de recherche: ${hasAnyOrderFilter ? 'COMMANDES' : 'CLIENTS DIRECTS'}`);

    // Si aucun filtre actif, retourner vide (évite de charger tous les clients)
    if (!hasAnyOrderFilter && Object.keys(tf).length === 0) {
      console.log(`ℹ️ [PREVIEW] Aucun filtre actif, retour d'une liste vide`);
      return res.json({ success: true, data: { count: 0, clients: [], hint: 'Sélectionnez au moins un filtre pour prévisualiser' } });
    }

    if (hasAnyOrderFilter) {
      console.log(`� [PREVIEW] Recherche via filtres de commande...`);
      const orderFilter = buildOrderFilter(req.workspaceId, tf, { requirePhone: true });
      
      console.log(`🔍 [PREVIEW] Filtre MongoDB Commandes:`, JSON.stringify(orderFilter));

      const orders = await Order.find(orderFilter)
        .select('clientName clientPhone city address product price date status quantity')
        .lean();

      console.log(`✅ [PREVIEW] ${orders.length} commandes trouvées`);

      // Convertir les commandes en structure pour le marketing
      const clients = orders.map(order => ({
        firstName: order.clientName?.split(' ')[0] || '',
        lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
        phone: order.clientPhone,
        city: order.city || '',
        address: order.address || '',
        products: order.product ? [order.product] : [],
        totalOrders: 1,
        totalSpent: (order.price || 0) * (order.quantity || 1),
        status: order.status || '',
        tags: [],
        lastContactAt: order.date || new Date(),
        _id: order._id, // ⚠️ C'est un Order ID, résolu lors de la création de campagne
        _orderStatus: order.status || '',
        _orderPrice: order.price || 0,
        _orderDate: order.date || null,
        _orderProduct: order.product || '',
        _orderQuantity: order.quantity || 1
      }));

      return res.json({ success: true, data: { count: clients.length, clients } });
    }

    // Si aucun statut de commande, utiliser les filtres clients (ancienne méthode)
    console.log(`👥 [PREVIEW] Recherche via filtres clients directs...`);
    const filter = buildClientFilter(req.workspaceId, tf);
    filter.phone = { $exists: true, $ne: '' };
    
    console.log(`🔍 [PREVIEW] Filtre MongoDB Clients:`, JSON.stringify(filter));

    const clients = await Client.find(filter)
      .select('firstName lastName phone city products totalOrders totalSpent status tags address lastContactAt')
      .lean();

    console.log(`✅ [PREVIEW] ${clients.length} clients trouvés via filtres directs`);
    res.json({ success: true, data: { count: clients.length, clients } });
  } catch (error) {
    console.error('❌ [PREVIEW] Erreur critique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/:id/preview', requireEcomAuth, async (req, res) => {
  console.log(`🔍 [PREVIEW-ID] Requête pour la campagne ${req.params.id}`);
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      console.warn(`⚠️ [PREVIEW-ID] Campagne non trouvée: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }

    let clients = [];
    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderProduct || campaign.targetFilters.orderAddress || campaign.targetFilters.orderDateFrom || campaign.targetFilters.orderDateTo
    );

    if (campaign.selectedClientIds?.length > 0) {
      const candidateIds = campaign.selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
      const orders = await Order.find({ _id: { $in: candidateIds }, workspaceId: req.workspaceId })
        .select('clientName clientPhone city address product price date status quantity')
        .lean();

      clients = orders.map(order => ({
        firstName: order.clientName?.split(' ')[0] || '',
        lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
        phone: order.clientPhone || '',
        city: order.city || '',
        address: order.address || '',
        products: order.product ? [order.product] : [],
        totalOrders: 1,
        totalSpent: (order.price || 0) * (order.quantity || 1),
        status: order.status || '',
        tags: [],
        lastContactAt: order.date || new Date(),
        _id: order._id
      }));
    } else if (hasOrderFilters) {
      const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters || {});
      clients = Array.from(orderMap.values()).map(order => ({
        firstName: order.clientName?.split(' ')[0] || '',
        lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
        phone: order.clientPhone || '',
        city: order.city || '',
        address: order.address || '',
        products: order.product ? [order.product] : [],
        totalOrders: 1,
        totalSpent: (order.price || 0) * (order.quantity || 1),
        status: order.status || '',
        tags: [],
        lastContactAt: order.date || new Date(),
        _id: order._id
      }));
    } else {
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
      filter.phone = { $exists: true, $ne: '' };
      console.log(`🔍 [PREVIEW-ID] Filtre MongoDB:`, JSON.stringify(filter));
      clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent status tags').lean();
    }
    
    console.log(`✅ [PREVIEW-ID] ${clients.length} destinataires trouvés pour "${campaign.name}"`);

    res.json({ 
      success: true, 
      data: { 
        count: clients.length, 
        clients,
        messageTemplate: campaign.messageTemplate,
        campaignName: campaign.name
      } 
    });
  } catch (error) {
    console.error('❌ [PREVIEW-ID] Erreur critique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/campaigns/stats - Statistiques globales des campagnes
router.get('/stats', requireEcomAuth, async (req, res) => {
  console.log(`📊 [STATS] Récupération des statistiques pour le workspace ${req.workspaceId}`);
  try {
    const workspaceId = req.workspaceId;
    
    // Récupérer toutes les campagnes du workspace
    const campaigns = await Campaign.find({ workspaceId }).lean();
    console.log(`📊 [STATS] ${campaigns.length} campagnes trouvées au total`);
    
    // Statistiques globales
    const totalCampaigns = campaigns.length;
    const sentCampaigns = campaigns.filter(c => c.status === 'sent').length;
    const draftCampaigns = campaigns.filter(c => c.status === 'draft').length;
    const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled').length;
    const sendingCampaigns = campaigns.filter(c => c.status === 'sending').length;
    const failedCampaigns = campaigns.filter(c => c.status === 'failed').length;
    
    // Statistiques d'envoi
    const totalTargeted = campaigns.reduce((sum, c) => sum + (c.stats?.targeted || 0), 0);
    const totalSent = campaigns.reduce((sum, c) => sum + (c.stats?.sent || 0), 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + (c.stats?.failed || 0), 0);
    
    console.log(`📊 [STATS] Synthèse: Sent=${sentCampaigns}, Targeted=${totalTargeted}, Delivered=${totalSent}`);
    
    // Taux de succès global
    const successRate = totalSent + totalFailed > 0 
      ? Math.round((totalSent / (totalSent + totalFailed)) * 100) 
      : 0;
    
    // Campagnes récentes (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCampaigns = campaigns.filter(c => 
      new Date(c.createdAt) >= thirtyDaysAgo
    );
    
    // Statistiques par type de campagne
    const campaignsByType = {};
    campaigns.forEach(c => {
      const type = c.type || 'custom';
      if (!campaignsByType[type]) {
        campaignsByType[type] = { count: 0, sent: 0, failed: 0 };
      }
      campaignsByType[type].count++;
      campaignsByType[type].sent += c.stats?.sent || 0;
      campaignsByType[type].failed += c.stats?.failed || 0;
    });
    
    // Activité par jour (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activityByDay = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      activityByDay[dateKey] = { sent: 0, failed: 0, campaigns: 0 };
    }
    
    campaigns.forEach(c => {
      if (c.sentAt && new Date(c.sentAt) >= sevenDaysAgo) {
        const dateKey = new Date(c.sentAt).toISOString().split('T')[0];
        if (activityByDay[dateKey]) {
          activityByDay[dateKey].sent += c.stats?.sent || 0;
          activityByDay[dateKey].failed += c.stats?.failed || 0;
          activityByDay[dateKey].campaigns++;
        }
      }
    });
    
    // Top 5 campagnes les plus performantes
    const topCampaigns = campaigns
      .filter(c => c.status === 'sent' && (c.stats?.sent || 0) > 0)
      .sort((a, b) => (b.stats?.sent || 0) - (a.stats?.sent || 0))
      .slice(0, 5)
      .map(c => ({
        _id: c._id,
        name: c.name,
        type: c.type,
        sent: c.stats?.sent || 0,
        failed: c.stats?.failed || 0,
        targeted: c.stats?.targeted || 0,
        successRate: c.stats?.sent && (c.stats.sent + c.stats.failed) > 0
          ? Math.round((c.stats.sent / (c.stats.sent + c.stats.failed)) * 100)
          : 0,
        sentAt: c.sentAt
      }));
    
    // Dernières campagnes envoyées
    const latestCampaigns = campaigns
      .filter(c => c.status === 'sent')
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))
      .slice(0, 10)
      .map(c => ({
        _id: c._id,
        name: c.name,
        type: c.type,
        sent: c.stats?.sent || 0,
        failed: c.stats?.failed || 0,
        targeted: c.stats?.targeted || 0,
        sentAt: c.sentAt
      }));
    
    res.json({
      success: true,
      data: {
        overview: {
          totalCampaigns,
          sentCampaigns,
          draftCampaigns,
          scheduledCampaigns,
          sendingCampaigns,
          failedCampaigns,
          totalTargeted,
          totalSent,
          totalFailed,
          successRate
        },
        recentActivity: {
          last30Days: recentCampaigns.length,
          activityByDay: Object.entries(activityByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, stats]) => ({ date, ...stats }))
        },
        campaignsByType: Object.entries(campaignsByType).map(([type, stats]) => ({
          type,
          ...stats,
          successRate: stats.sent + stats.failed > 0
            ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100)
            : 0
        })),
        topCampaigns,
        latestCampaigns
      }
    });
  } catch (error) {
    console.error('❌ [STATS] Erreur récupération statistiques:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/campaigns/:id - Détail d'une campagne
router.get('/:id', requireEcomAuth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId })
      .populate('createdBy', 'email');
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Erreur get campaign:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns - Créer une campagne
router.post('/', requireEcomAuth, async (req, res) => {
  try {
    const { name, type, messageTemplate, targetFilters, scheduledAt, tags, selectedClientIds, recipients, media } = req.body;
    if (!name || !messageTemplate) {
      return res.status(400).json({ success: false, message: 'Nom et message requis' });
    }

    // ✅ Validation des recipients - supprimée car liée à WhatsApp

    // 🆕 VALIDATION ANTI-SPAM supprimée
    const analysis = { risk: 'LOW', score: 0, warnings: [] };

    // Compter les clients ciblés - utiliser selectedClientIds si présent
    let targetedCount;
    let recipientSnapshotIds = [];
    
    if (selectedClientIds && selectedClientIds.length > 0) {
      console.log(`🔍 [CREATE] Traitement de ${selectedClientIds.length} IDs sélectionnés`);
      // 🔧 FIX: Les selectedClientIds provenant du preview commandes sont des Order IDs, pas des Client IDs
      // On vérifie si les IDs correspondent à des commandes plutôt qu'à des clients
      const hasOrderFilters = targetFilters && (targetFilters.orderStatus || targetFilters.orderCity || 
                             targetFilters.orderProduct || targetFilters.orderDateFrom);
      
      if (hasOrderFilters) {
        console.log(`🔍 [CREATE] Filtres de commande détectés, résolution des IDs d'origine`);
        // Les IDs sont probablement des Order IDs — résoudre les vrais Client IDs
        const candidateIds = selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
        console.log(`🔍 [CREATE] ${candidateIds.length} IDs valides convertis en ObjectId`);
        
        // Chercher les commandes correspondantes pour obtenir les téléphones
        const orders = await Order.find({ 
          _id: { $in: candidateIds }, 
          workspaceId: req.workspaceId 
        }).select('clientPhone').lean();
        
        console.log(`🔍 [CREATE] ${orders.length} commandes trouvées en base pour ces IDs`);

        if (orders.length > 0) {
          // Ce sont bien des Order IDs — résoudre vers les Client IDs
          const phonesCleaned = [
            ...new Set(
              orders
                .map(o => sanitizePhoneNumber(o.clientPhone))
                .filter(Boolean)
            )
          ];
          console.log(`🔍 [CREATE] ${phonesCleaned.length} numéros nettoyés uniques extraits des commandes`);

          const clients = await Client.find({
            phoneNormalized: { $in: phonesCleaned },
            workspaceId: req.workspaceId
          }).select('_id phone phoneNormalized');
          
          recipientSnapshotIds = clients.map(c => c._id);
          targetedCount = recipientSnapshotIds.length;
          console.log(`✅ [CREATE] Résolution réussie: ${selectedClientIds.length} commandes → ${targetedCount} clients identifiés pour le snapshot`);
          
          // 🔧 FIX: Si aucun client trouvé, créer des "pseudo-clients" à partir des commandes
          if (targetedCount === 0 && phonesCleaned.length > 0) {
            console.log(`⚠️ [CREATE] Aucun client trouvé en base → utilisation des données commande pour le snapshot`);
            // Stocker les infos de la commande directement dans selectedClientIds 
            // et ne pas essayer de les matcher avec Client
            targetedCount = phonesCleaned.length;
            // On garde les Order IDs dans selectedClientIds pour l'envoi
          }
          
          if (targetedCount < phonesCleaned.length) {
            console.warn(`⚠️ [CREATE] Attention: ${phonesCleaned.length - targetedCount} numéros n'ont pas de fiche client correspondante`);
          }
        } else {
          // Pas des Order IDs, traiter comme des Client IDs normaux
          console.log(`🔍 [CREATE] Aucun document trouvé dans Order, traitement comme Client IDs`);
          recipientSnapshotIds = candidateIds;
          targetedCount = recipientSnapshotIds.length;
        }
      } else {
        console.log(`� [CREATE] Pas de filtres commande, utilisation directe des IDs fournis`);
        targetedCount = selectedClientIds.length;
        recipientSnapshotIds = selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
      }
    } else if (targetFilters && Object.keys(targetFilters).length > 0) {
      console.log(`🔍 [CREATE] Calcul de la cible via filtres:`, JSON.stringify(targetFilters));
      // 🆕 Récupérer les vrais IDs des clients (pas les IDs de commande)
      const hasOrderFilters = targetFilters.orderStatus || targetFilters.orderCity || 
                             targetFilters.orderProduct || targetFilters.orderDateFrom;
      
      if (hasOrderFilters) {
        console.log(`🔍 [CREATE] Utilisation des filtres de commande pour le snapshot`);
        // Utiliser exclusivement les commandes comme source d'audience
        const orderMap = await getClientsFromOrderFilters(req.workspaceId, targetFilters);
        const orders = Array.from(orderMap.values());
        console.log(`🔍 [CREATE] ${orders.length} commandes trouvées via filtres de commande`);
        
        // Stocker les IDs des commandes pour les réutiliser au preview/envoi
        selectedClientIds = orders.map(o => o._id.toString());
        targetedCount = selectedClientIds.length;
        recipientSnapshotIds = [];
        
        console.log(`✅ [CREATE] ${targetedCount} commandes sélectionnées pour la campagne`);
      } else {
        // Filtres clients directs
        console.log(`🔍 [CREATE] Utilisation des filtres clients directs pour le snapshot`);
        const filter = buildClientFilter(req.workspaceId, targetFilters || {});
        filter.phone = { $exists: true, $ne: '' };
        
        const clients = await Client.find(filter).select('_id');
        recipientSnapshotIds = clients.map(c => c._id);
        targetedCount = recipientSnapshotIds.length;
        
        console.log(`✅ [CREATE] ${targetedCount} clients identifiés via filtres directs pour le snapshot`);
      }
    } else {
      targetedCount = 0;
      console.log(`⚠️ [CREATE] Campagne sans cible définie`);
    }

    console.log(`📊 [CREATE] Résumé avant sauvegarde:`);
    console.log(`   - targetedCount: ${targetedCount}`);
    console.log(`   - recipientSnapshotIds.length: ${recipientSnapshotIds.length}`);
    console.log(`   - selectedClientIds: ${selectedClientIds?.length || 0}`);
    console.log(`   - targetFilters:`, JSON.stringify(targetFilters));

    const campaign = new Campaign({
      workspaceId: req.workspaceId,
      name,
      type: type || 'custom',
      messageTemplate,
      media: media || { type: 'none', url: '', fileName: '', caption: '' },
      targetFilters: targetFilters || {},
      selectedClientIds: selectedClientIds || [],
      recipientSnapshotIds: recipientSnapshotIds, // 🆕 Snapshot des IDs client uniquement
      scheduledAt: scheduledAt || null,
      status: scheduledAt ? 'scheduled' : 'draft',
      stats: { targeted: targetedCount },
      tags: tags || [],
      createdBy: req.ecomUser._id,
      // ✅ Ajouter recipients pour les campagnes WhatsApp
      recipients: recipients || null,
      // 🆕 Métadonnées anti-spam
      spamValidation: {
        validated: true,
        riskLevel: analysis.risk,
        score: analysis.score,
        validatedAt: new Date(),
        warnings: analysis.warnings
      }
    });

    await campaign.save();
    
    res.status(201).json({ 
      success: true, 
      message: 'Campagne créée', 
      data: campaign,
      spamValidation: {
        validated: true,
        riskLevel: analysis.risk,
        score: analysis.score,
        message: analysis.risk === 'HIGH' ? 'Message à risque élevé' : 
                analysis.risk === 'MEDIUM' ? 'Message à risque moyen' : 'Message sécurisé'
      }
    });
  } catch (error) {
    console.error('Erreur create campaign:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// PUT /api/ecom/campaigns/:id - Modifier une campagne
router.put('/:id', requireEcomAuth, async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Impossible de modifier une campagne en cours ou envoyée' });
    }

    const allowedFields = ['name', 'type', 'messageTemplate', 'targetFilters', 'scheduledAt', 'tags', 'status', 'selectedClientIds', 'media'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) campaign[field] = req.body[field];
    });

    // 🆕 Recalculer et sauvegarder le snapshot si les filtres changent
    if (req.body.targetFilters || req.body.selectedClientIds) {
      let recipientSnapshotIds = [];
      
      if (req.body.selectedClientIds && req.body.selectedClientIds.length > 0) {
        recipientSnapshotIds = req.body.selectedClientIds;
        console.log(`📋 Modification: ${recipientSnapshotIds.length} clients sélectionnés manuellement`);
      } else if (req.body.targetFilters && Object.keys(req.body.targetFilters).length > 0) {
        // Récupérer les IDs des clients pour le nouveau snapshot
        const filter = buildClientFilter(req.workspaceId, req.body.targetFilters || {});
        filter.phone = { $exists: true, $ne: '' };
        
        const clients = await Client.find(filter).select('_id');
        recipientSnapshotIds = clients.map(c => c._id);
        
        console.log(`🎯 Modification: ${recipientSnapshotIds.length} clients calculés depuis nouveaux filtres`);
      }
      
      campaign.recipientSnapshotIds = recipientSnapshotIds;
    }

    // Recompter les clients ciblés - priorité aux selectedClientIds
    if (campaign.selectedClientIds && campaign.selectedClientIds.length > 0) {
      campaign.stats.targeted = campaign.selectedClientIds.length;
    } else if (campaign.recipientSnapshotIds && campaign.recipientSnapshotIds.length > 0) {
      campaign.stats.targeted = campaign.recipientSnapshotIds.length;
    } else {
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
      filter.phone = { $exists: true, $ne: '' };
      campaign.stats.targeted = await Client.countDocuments(filter);
    }

    await campaign.save();
    res.json({ success: true, message: 'Campagne modifiée', data: campaign });
  } catch (error) {
    console.error('Erreur update campaign:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns/cancel-all - Annuler toutes les campagnes en cours d'envoi
router.post('/cancel-all', requireEcomAuth, async (req, res) => {
  try {
    const result = await Campaign.updateMany(
      { workspaceId: req.workspaceId, status: 'sending' },
      { $set: { status: 'draft' } }
    );
    res.json({ success: true, message: `${result.modifiedCount} campagne(s) annulée(s)` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ecom/campaigns/:id/analyze-countries - Analyser les destinataires par pays
router.post('/:id/analyze-countries', requireEcomAuth, async (req, res) => {
  try {
    const { includeCountries, excludeCountries } = req.body;
    
    // Récupérer la campagne
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }

    // Récupérer les destinataires (même logique que la route d'envoi)
    let recipients = [];
    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderProduct || campaign.targetFilters.orderDateFrom
    );

    // Utiliser la même logique que la route d'envoi pour récupérer les destinataires
    if (campaign.selectedClientIds && campaign.selectedClientIds.length > 0) {
      const candidateIds = campaign.selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
      const orders = await Order.find({ _id: { $in: candidateIds }, workspaceId: req.workspaceId })
        .select('clientName clientPhone city address product price date status quantity')
        .lean();
      
      const phoneMap = new Map();
      for (const order of orders) {
        const phone = (order.clientPhone || '').trim();
        if (!phone) continue;
        const cleaned = sanitizePhoneNumber(phone);
        if (!cleaned) continue;
        if (!phoneMap.has(cleaned) || new Date(order.date) > new Date(phoneMap.get(cleaned).date)) {
          phoneMap.set(cleaned, order);
        }
      }
      
      for (const [cleaned, order] of phoneMap) {
        recipients.push({
          phone: cleaned,
          client: {
            firstName: order.clientName?.split(' ')[0] || '',
            lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
            phone: cleaned,
            city: order.city || '',
            address: order.address || ''
          },
          orderData: order
        });
      }
    } else if (hasOrderFilters) {
      const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
      for (const [normalized, orderData] of orderMap) {
        if (!normalized || !normalized.trim()) continue;
        
        recipients.push({
          phone: normalized,
          client: {
            firstName: orderData.clientName?.split(' ')[0] || '',
            lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
            phone: normalized,
            city: orderData.city || '',
            address: orderData.address || ''
          },
          orderData
        });
      }
    } else if (campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
      filter.phone = { $exists: true, $ne: '' };
      const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').lean();
      recipients = clients.map(c => ({ phone: c.phone, client: c, orderData: null }));
    }

    if (recipients.length === 0) {
      return res.json({ 
        success: true, 
        data: { 
          summary: { totalRecipients: 0, validRecipients: 0, invalidCount: 0, countryCount: 0 },
          countries: {},
          invalidPhones: [],
          recommendations: ['Aucun destinataire trouvé pour cette campagne']
        } 
      });
    }

    // Analyser par pays
    const countryAnalysis = groupRecipientsByCountry(recipients);
    
    // Appliquer les filtres pays si spécifiés
    let filteredRecipients = recipients;
    if (includeCountries && includeCountries.length > 0) {
      const includeCodes = parseCountryFilters(includeCountries);
      filteredRecipients = filterRecipientsByCountry(recipients, includeCodes);
    }
    if (excludeCountries && excludeCountries.length > 0) {
      const excludeCodes = parseCountryFilters(excludeCountries);
      filteredRecipients = excludeRecipientsByCountry(filteredRecipients, excludeCodes);
    }

    // Générer le rapport
    const report = generateCountryReport(countryAnalysis);
    
    // Ajouter les informations sur les filtres appliqués
    if (includeCountries || excludeCountries) {
      const filteredAnalysis = groupRecipientsByCountry(filteredRecipients);
      report.filteredSummary = filteredAnalysis.summary;
      report.filteredCountries = filteredAnalysis.countries;
    }

    console.log(`📊 [ANALYZE-COUNTRIES] ${recipients.length} destinataires analysés pour ${Object.keys(countryAnalysis.countries).length} pays`);

    res.json({ 
      success: true, 
      data: report,
      originalRecipients: recipients.length,
      filteredRecipients: filteredRecipients.length
    });

  } catch (error) {
    console.error('❌ [ANALYZE-COUNTRIES] Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns/:id/send-by-country - Envoyer la campagne par pays
router.post('/:id/send-by-country', requireEcomAuth, async (req, res) => {
  try {
    const { 
      whatsappInstanceId, 
      includeCountries, 
      excludeCountries,
      sendStrategy, // 'all' | 'priority' | 'sequential'
      priorityCountries, // Ordre prioritaire des pays
      delayBetweenCountries // Délai entre les pays (en secondes)
    } = req.body;

    const instanceId = whatsappInstanceId;
    if (!instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Sélectionnez une instance WhatsApp avant d\'envoyer la campagne.'
      });
    }

    // Récupérer et valider l'instance
    const instance = await WhatsAppInstance.findOne({ _id: instanceId, isActive: true });
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance WhatsApp introuvable.'
      });
    }

    if (instance.status !== 'connected' && instance.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `L'instance n'est pas connectée à WhatsApp.`
      });
    }

    // Récupérer la campagne
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }
    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Campagne déjà en cours ou envoyée' });
    }

    // Récupérer les destinataires (même logique que précédemment)
    let recipients = [];
    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderProduct || campaign.targetFilters.orderDateFrom
    );

    // [Code pour récupérer les destinataires - identique à la route d'envoi]
    if (campaign.selectedClientIds && campaign.selectedClientIds.length > 0) {
      const candidateIds = campaign.selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
      const orders = await Order.find({ _id: { $in: candidateIds }, workspaceId: req.workspaceId })
        .select('clientName clientPhone city address product price date status quantity')
        .lean();
      
      const phoneMap = new Map();
      for (const order of orders) {
        const phone = (order.clientPhone || '').trim();
        if (!phone) continue;
        const cleaned = sanitizePhoneNumber(phone);
        if (!cleaned) continue;
        if (!phoneMap.has(cleaned) || new Date(order.date) > new Date(phoneMap.get(cleaned).date)) {
          phoneMap.set(cleaned, order);
        }
      }
      
      for (const [cleaned, order] of phoneMap) {
        recipients.push({
          phone: cleaned,
          client: {
            firstName: order.clientName?.split(' ')[0] || '',
            lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
            phone: cleaned,
            city: order.city || '',
            address: order.address || ''
          },
          orderData: order
        });
      }
    } else if (hasOrderFilters) {
      const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
      for (const [normalized, orderData] of orderMap) {
        if (!normalized || !normalized.trim()) continue;
        
        recipients.push({
          phone: normalized,
          client: {
            firstName: orderData.clientName?.split(' ')[0] || '',
            lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
            phone: normalized,
            city: orderData.city || '',
            address: orderData.address || ''
          },
          orderData
        });
      }
    } else if (campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
      filter.phone = { $exists: true, $ne: '' };
      const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').lean();
      recipients = clients.map(c => ({ phone: c.phone, client: c, orderData: null }));
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé' });
    }

    // Grouper par pays
    const countryGroups = groupRecipientsByCountry(recipients);
    console.log(`📊 [SEND-BY-COUNTRY] ${recipients.length} destinataires groupés en ${Object.keys(countryGroups.countries).length} pays`);

    // Appliquer les filtres pays
    let targetCountries = countryGroups.countries;
    if (includeCountries && includeCountries.length > 0) {
      const includeCodes = parseCountryFilters(includeCountries);
      const tempGroups = {};
      for (const [code, group] of Object.entries(countryGroups.countries)) {
        if (includeCodes.includes(code)) {
          tempGroups[code] = group;
        }
      }
      targetCountries = tempGroups;
    }
    if (excludeCountries && excludeCountries.length > 0) {
      const excludeCodes = parseCountryFilters(excludeCountries);
      const tempGroups = {};
      for (const [code, group] of Object.entries(targetCountries)) {
        if (!excludeCodes.includes(code)) {
          tempGroups[code] = group;
        }
      }
      targetCountries = tempGroups;
    }

    // Déterminer l'ordre d'envoi
    let countryOrder = Object.keys(targetCountries);
    if (sendStrategy === 'priority' && priorityCountries && priorityCountries.length > 0) {
      const priorityCodes = parseCountryFilters(priorityCountries);
      countryOrder = [
        ...priorityCodes.filter(code => targetCountries[code]),
        ...countryOrder.filter(code => !priorityCodes.includes(code))
      ];
    } else if (sendStrategy === 'sequential') {
      // Garder l'ordre par nombre décroissant
      countryOrder = Object.entries(targetCountries)
        .sort(([,a], [,b]) => b.recipients.length - a.recipients.length)
        .map(([code]) => code);
    }

    // Vérifier les limites
    const limitCheck = await checkMessageLimit(instance);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: limitCheck.reason,
        usage: limitCheck.usage
      });
    }

    // Mettre la campagne en statut "sending"
    campaign.status = 'sending';
    await campaign.save();

    // Envoyer par pays avec délais
    let totalSent = 0;
    let totalFailed = 0;
    const countryResults = [];

    for (let i = 0; i < countryOrder.length; i++) {
      const countryCode = countryOrder[i];
      const countryGroup = targetCountries[countryCode];
      
      console.log(`🌍 [SEND-BY-COUNTRY] Envoi vers ${countryGroup.countryName} (${countryGroup.recipients.length} contacts)`);

      let countrySent = 0;
      let countryFailed = 0;

      for (const recipient of countryGroup.recipients) {
        // Vérifier les limites avant chaque message
        const msgLimitCheck = await checkMessageLimit(instance);
        if (!msgLimitCheck.allowed) {
          console.warn(`⚠️ Limite atteinte: ${msgLimitCheck.reason}`);
          break;
        }

        const message = renderMessage(campaign.messageTemplate, recipient.client, recipient.orderData);

        const result = await evolutionApiService.sendMessage(
          instance.instanceName,
          instance.instanceToken,
          recipient.cleanPhone,
          message
        );

        if (result.success) {
          countrySent++;
          totalSent++;
          await incrementMessageCount(instanceId, 1);
        } else {
          countryFailed++;
          totalFailed++;
          console.warn(`⚠️ Échec envoi à ${recipient.cleanPhone}:`, result.error);
        }

        // Délai entre messages (1.5s)
        await new Promise(r => setTimeout(r, 1500));
      }

      countryResults.push({
        countryCode,
        countryName: countryGroup.countryName,
        sent: countrySent,
        failed: countryFailed,
        total: countryGroup.recipients.length
      });

      // Délai entre pays (sauf pour le dernier)
      if (i < countryOrder.length - 1 && delayBetweenCountries > 0) {
        console.log(`⏱️ [SEND-BY-COUNTRY] Pause de ${delayBetweenCountries}s avant le pays suivant...`);
        await new Promise(r => setTimeout(r, delayBetweenCountries * 1000));
      }
    }

    // Mettre à jour la campagne
    campaign.status = totalFailed === totalSent + totalFailed ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats = { 
      ...campaign.stats.toObject?.() || campaign.stats, 
      sent: totalSent, 
      failed: totalFailed, 
      targeted: recipients.length 
    };
    await campaign.save();

    // Mettre à jour l'instance
    await WhatsAppInstance.findByIdAndUpdate(instanceId, { lastSeen: new Date(), status: 'connected' });

    console.log(`✅ Campagne envoyée par pays : ${totalSent} réussis, ${totalFailed} échoués`);

    res.json({
      success: true,
      message: `Campagne envoyée avec succès par pays`,
      data: {
        totalSent,
        totalFailed,
        total: recipients.length,
        countryResults,
        countryCount: countryOrder.length
      }
    });

  } catch (error) {
    console.error('❌ [SEND-BY-COUNTRY] Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de la campagne' });
  }
});

// POST /api/ecom/campaigns/:id/send - Envoyer une campagne via WhatsApp
router.post('/:id/send', requireEcomAuth, async (req, res) => {
  try {
    const { whatsappInstanceId, whatsappInstances } = req.body;
    const instanceId = whatsappInstanceId || (whatsappInstances && whatsappInstances[0]);

    if (!instanceId) {
      return res.status(400).json({
        success: false,
        message: 'Sélectionnez une instance WhatsApp avant d\'envoyer la campagne.'
      });
    }

    // Récupérer et valider l'instance
    const instance = await WhatsAppInstance.findOne({ _id: instanceId, isActive: true });
    if (!instance) {
      return res.status(404).json({
        success: false,
        message: 'Instance WhatsApp introuvable. Vérifiez la configuration dans "Connexion WhatsApp".'
      });
    }

    if (instance.status !== 'connected' && instance.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: `L'instance "${instance.customName || instance.instanceName}" n'est pas connectée à WhatsApp. Allez dans "Connexion WhatsApp" pour la connecter, puis actualisez son statut.`,
        instanceStatus: instance.status
      });
    }

    // Récupérer la campagne
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }
    if (campaign.status === 'sending') {
      return res.status(400).json({ success: false, message: 'Cette campagne est déjà en cours d\'envoi' });
    }
    if (campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Cette campagne a déjà été envoyée' });
    }

    // 🔍 DEBUG: Vérifier le média de la campagne
    console.log(`📸 [SEND] Média de la campagne "${campaign.name}":`, JSON.stringify(campaign.media));
    if (campaign.media?.type === 'image') {
      console.log(`📸 [SEND] Image URL: ${campaign.media.url}`);
      console.log(`📸 [SEND] Caption: ${campaign.media.caption || 'aucune'}`);
    } else if (campaign.media?.type === 'audio') {
      console.log(`🎵 [SEND] Audio URL: ${campaign.media.url}`);
    } else {
      console.log(`📝 [SEND] Pas de média (type: ${campaign.media?.type || 'undefined'})`);
    }

    // Déterminer les destinataires
    console.log(`📋 [SEND] Récupération des destinataires pour campagne "${campaign.name}"`);
    console.log(`📋 [SEND] recipientSnapshotIds: ${campaign.recipientSnapshotIds?.length || 0}`);
    console.log(`📋 [SEND] selectedClientIds: ${campaign.selectedClientIds?.length || 0}`);
    console.log(`📋 [SEND] targetFilters:`, JSON.stringify(campaign.targetFilters));

    let recipients = []; // [{ phone, client, orderData }]
    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderProduct || campaign.targetFilters.orderDateFrom
    );

    // ========== Méthode 1: recipientSnapshotIds - DÉSACTIVÉE (utiliser directement les commandes) ==========
    // On ne cherche plus dans Client, on utilise directement les données des commandes

    // ========== Méthode 2: selectedClientIds (TOUJOURS des Order IDs depuis Google Sheets) ==========
    if (recipients.length === 0 && campaign.selectedClientIds && campaign.selectedClientIds.length > 0) {
      console.log(`🔍 [SEND] Méthode 2: selectedClientIds (${campaign.selectedClientIds.length} IDs)`);
      const candidateIds = campaign.selectedClientIds.map(id => toObjectId(id)).filter(Boolean);
      
      // ✅ UTILISER DIRECTEMENT LES COMMANDES (Google Sheets) - Ne pas chercher dans Client
      console.log(`📋 [SEND] M2: Récupération directe depuis les commandes (Google Sheets)...`);
      const orders = await Order.find({ _id: { $in: candidateIds }, workspaceId: req.workspaceId })
        .select('clientName clientPhone city address product price date status quantity')
        .lean();
      console.log(`✅ [SEND] M2: ${orders.length} commandes trouvées dans Google Sheets`);
      
      if (orders.length > 0) {
        // Collecter tous les phones nettoyés et utiliser DIRECTEMENT les données des commandes
        const phoneMap = new Map();
        for (const order of orders) {
          const phone = (order.clientPhone || '').trim();
          if (!phone) continue;
          const cleaned = sanitizePhoneNumber(phone);
          if (!cleaned) continue;
          // Garder la commande la plus récente par numéro
          if (!phoneMap.has(cleaned) || new Date(order.date) > new Date(phoneMap.get(cleaned).date)) {
            phoneMap.set(cleaned, order);
          }
        }
        
        console.log(`📞 [SEND] M2: ${phoneMap.size} numéros uniques extraits des commandes`);
        
        // ✅ UTILISER DIRECTEMENT LES DONNÉES DES COMMANDES - Pas de recherche dans Client
        for (const [cleaned, order] of phoneMap) {
          recipients.push({
            phone: cleaned,
            client: {
              firstName: order.clientName?.split(' ')[0] || '',
              lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
              phone: cleaned,
              city: order.city || '',
              address: order.address || ''
            },
            orderData: order
          });
        }
        
        console.log(`✅ [SEND] M2: ${recipients.length} destinataires créés directement depuis Google Sheets`);
      }
    }

    // ========== Méthode 3: filtres de commandes (UTILISER DIRECTEMENT Google Sheets) ==========
    if (recipients.length === 0 && hasOrderFilters) {
      console.log(`🔍 [SEND] Méthode 3: recalcul via filtres de commandes (Google Sheets)`);
      console.log(`🔍 [SEND] M3: Filtres utilisés:`, JSON.stringify(campaign.targetFilters));
      const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
      console.log(`✅ [SEND] M3: ${orderMap.size} commandes avec numéros uniques depuis Google Sheets`);
      
      // ✅ UTILISER DIRECTEMENT LES DONNÉES DES COMMANDES - Pas de recherche dans Client
      for (const [normalized, orderData] of orderMap) {
        if (!normalized || !normalized.trim()) continue;
        
        recipients.push({
          phone: normalized,
          client: {
            firstName: orderData.clientName?.split(' ')[0] || '',
            lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
            phone: normalized,
            city: orderData.city || '',
            address: orderData.address || ''
          },
          orderData
        });
      }
      console.log(`✅ [SEND] M3: ${recipients.length} destinataires créés directement depuis Google Sheets`);
    }

    // ========== Méthode 4: filtres clients directs ==========
    if (recipients.length === 0 && campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
      console.log(`🔍 [SEND] Méthode 4: filtres clients directs`);
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
      filter.phone = { $exists: true, $ne: '' };
      console.log(`🔍 [SEND] M4 Filtre MongoDB:`, JSON.stringify(filter));
      const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').lean();
      console.log(`✅ [SEND] M4: ${clients.length} clients trouvés`);
      recipients = clients.map(c => ({ phone: c.phone, client: c, orderData: null }));
    }

    if (recipients.length === 0) {
      console.log(`⚠️ [SEND] Aucune méthode n'a trouvé de destinataires`);
    }

    console.log(`📊 [SEND] Total destinataires bruts: ${recipients.length}`);

    if (recipients.length === 0) {
      console.error(`❌ [SEND] Aucun destinataire trouvé pour cette campagne`);
      return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé pour cette campagne' });
    }

    // Passer la campagne en statut "sending"
    campaign.status = 'sending';
    await campaign.save();

    // Vérifier les limites avant d'envoyer la campagne
    const limitCheck = await checkMessageLimit(instance);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: limitCheck.reason,
        usage: limitCheck.usage,
        upgradeUrl: 'https://zechat.site/pricing'
      });
    }

    // Nettoyer les numéros de téléphone (sans formatage forcé)
    console.log(`🧹 [SEND] Nettoyage des ${recipients.length} numéros de téléphone...`);
    const validRecipients = [];
    const invalidNumbers = [];

    for (const recipient of recipients) {
      const cleanPhone = sanitizePhoneNumber(recipient.phone);
      if (cleanPhone) {
        validRecipients.push({ ...recipient, cleanPhone });
      } else {
        invalidNumbers.push({ phone: recipient.phone, reason: 'Format invalide ou trop court (minimum 8 chiffres)' });
      }
    }

    console.log(`✅ [SEND] ${validRecipients.length} numéros nettoyés`);
    console.log(`⚠️ [SEND] ${invalidNumbers.length} numéros invalides (seront ignorés)`);
    if (invalidNumbers.length > 0 && invalidNumbers.length <= 20) {
      console.log(`🚫 [SEND] Numéros invalides:`, invalidNumbers.map(n => n.phone));
    }

    if (validRecipients.length === 0) {
      console.error(`❌ [SEND] Aucun numéro valide après nettoyage`);
      return res.status(400).json({ 
        success: false, 
        message: `Aucun numéro valide trouvé. ${invalidNumbers.length} numéros rejetés (format invalide).`,
        details: { 
          totalRecipients: recipients.length, 
          validNumbers: 0, 
          invalidNumbers: invalidNumbers.length,
          invalidDetails: invalidNumbers.slice(0, 10)
        }
      });
    }

    console.log(`📤 Envoi campagne "${campaign.name}" à ${validRecipients.length} destinataires via ${instance.instanceName}`);
    console.log(`📊 Limites: ${limitCheck.usage.dailyUsed}/${limitCheck.usage.dailyLimit} aujourd'hui, ${limitCheck.usage.monthlyUsed}/${limitCheck.usage.monthlyLimit} ce mois`);

    let sent = 0;
    let failed = 0;
    const failedDetails = [];

    for (const { phone, client, orderData, cleanPhone } of validRecipients) {
      if (!cleanPhone) { 
        failed++;
        failedDetails.push({ phone, reason: 'Numéro vide après nettoyage' });
        continue; 
      }

      // Vérifier les limites avant chaque message
      const msgLimitCheck = await checkMessageLimit(instance);
      if (!msgLimitCheck.allowed) {
        console.warn(`⚠️ Limite atteinte après ${sent} messages: ${msgLimitCheck.reason}`);
        // Marquer les messages restants comme non envoyés
        const remaining = validRecipients.length - (sent + failed);
        failed += remaining;
        failedDetails.push({ phone: 'multiple', reason: `Limite atteinte: ${msgLimitCheck.reason}`, count: remaining });
        break;
      }

      const message = renderMessage(campaign.messageTemplate, client, orderData);

      try {
        let result;

        if (campaign.media?.type === 'image' && campaign.media?.url) {
          // Envoyer l'image d'abord (sans caption)
          console.log(`📸 [SEND] Envoi image à ${cleanPhone}: ${campaign.media.url}`);
          const imageResult = await evolutionApiService.sendMedia(
            instance.instanceName,
            instance.instanceToken,
            cleanPhone,
            campaign.media.url,
            '', // Pas de caption - le texte sera envoyé séparément
            campaign.media.fileName || 'image.jpg'
          );
          console.log(`📸 [SEND] Résultat envoi image:`, imageResult.success ? '✅ Succès' : `❌ Échec: ${imageResult.error}`);
          
          // Puis envoyer le texte séparément si l'image a réussi
          if (imageResult.success && message.trim()) {
            await new Promise(r => setTimeout(r, 2000)); // Délai entre image et texte
            result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanPhone, message);
          } else {
            result = imageResult;
          }
        } else if (campaign.media?.type === 'audio' && campaign.media?.url) {
          console.log(`🎵 [SEND] Envoi audio à ${cleanPhone}: ${campaign.media.url}`);

          const audioResult = await evolutionApiService.sendAudio(
            instance.instanceName,
            instance.instanceToken,
            cleanPhone,
            campaign.media.url
          );

          if (audioResult.success && message.trim()) {
            await new Promise(r => setTimeout(r, 2000));
            result = await evolutionApiService.sendMessage(
              instance.instanceName,
              instance.instanceToken,
              cleanPhone,
              message
            );
          } else {
            result = audioResult;
          }
        } else {
          result = await evolutionApiService.sendMessage(
            instance.instanceName,
            instance.instanceToken,
            cleanPhone,
            message
          );
        }

        if (result.success) {
          sent++;
          console.log(`✅ [${sent}/${validRecipients.length}] Envoyé à ${cleanPhone}`);
          // Incrémenter le compteur après chaque envoi réussi
          await incrementMessageCount(instanceId, 1);
        } else {
          failed++;
          const errorMsg = result.error || 'Erreur inconnue';
          failedDetails.push({ phone: cleanPhone, reason: errorMsg });
          console.warn(`❌ [${sent + failed}/${validRecipients.length}] Échec ${cleanPhone}: ${errorMsg}`);
        }
      } catch (err) {
        failed++;
        const errorMsg = err.message || 'Exception lors de l\'envoi';
        failedDetails.push({ phone: cleanPhone, reason: errorMsg });
        console.error(`❌ [${sent + failed}/${validRecipients.length}] Exception ${cleanPhone}:`, errorMsg);
      }

      // Délai humain entre les messages (1.5s)
      await new Promise(r => setTimeout(r, 1500));
    }

    // Mettre à jour la campagne
    campaign.status = failed === validRecipients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats = { 
      ...campaign.stats.toObject?.() || campaign.stats, 
      sent, 
      failed, 
      targeted: validRecipients.length,
      invalidNumbers: invalidNumbers.length
    };
    await campaign.save();

    // Mettre à jour le lastSeen de l'instance
    await WhatsAppInstance.findByIdAndUpdate(instanceId, { lastSeen: new Date(), status: 'connected' });

    console.log(`✅ Campagne terminée : ${sent} réussis, ${failed} échoués, ${invalidNumbers.length} numéros invalides ignorés`);

    // Construire le message de résultat
    let resultMessage = `${sent} message(s) envoyé(s) avec succès via "${instance.customName || instance.instanceName}"`;
    if (failed > 0) {
      resultMessage += `, ${failed} échec(s)`;
    }
    if (invalidNumbers.length > 0) {
      resultMessage += `, ${invalidNumbers.length} numéro(s) invalide(s) ignoré(s)`;
    }

    res.json({
      success: true,
      message: resultMessage,
      data: { 
        sent, 
        failed, 
        total: recipients.length,
        validRecipients: validRecipients.length,
        invalidNumbers: invalidNumbers.length,
        failedDetails: failedDetails.slice(0, 20),
        invalidDetails: invalidNumbers.slice(0, 20)
      }
    });
  } catch (error) {
    console.error('❌ Erreur envoi campagne:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur lors de l\'envoi de la campagne' });
  }
});

router.post('/preview-send', requireEcomAuth, async (req, res) => {
  try {
    const { messageTemplate, clientId, media, manualPhone, manualName } = req.body;
    
    if (!messageTemplate || (!clientId && !manualPhone)) {
      return res.status(400).json({ success: false, message: 'Message et destinataire requis' });
    }

    // Récupérer soit un client, soit une commande
    let client = null;
    let orderData = null;

    if (clientId) {
      client = await Client.findOne({ _id: clientId, workspaceId: req.workspaceId });
    }

    if (!client && clientId) {
      const order = await Order.findOne({ _id: clientId, workspaceId: req.workspaceId })
        .select('clientName clientPhone city address product price date status quantity')
        .lean();

      if (!order) {
        return res.status(404).json({ success: false, message: 'Client ou commande introuvable' });
      }

      orderData = order;
      client = {
        firstName: order.clientName?.split(' ')[0] || '',
        lastName: order.clientName?.split(' ').slice(1).join(' ') || '',
        phone: order.clientPhone || '',
        city: order.city || '',
        address: order.address || ''
      };
    } else if (!client && manualPhone) {
      client = {
        firstName: manualName || 'Destinataire',
        lastName: '',
        phone: manualPhone,
        city: '',
        address: ''
      };
    }

    // Récupérer une instance WhatsApp active
    const instances = await WhatsAppInstance.find({ 
      workspaceId: req.workspaceId, 
      status: 'connected' 
    }).sort({ lastSeen: -1 });

    if (instances.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aucune instance WhatsApp connectée. Configurez une instance dans les paramètres.' 
      });
    }

    const instance = instances[0];
    const instanceStatus = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
    if (!instanceStatus || !instanceStatus.instance || instanceStatus.instance.state !== 'open') {
      return res.status(400).json({ 
        success: false, 
        message: `L'instance WhatsApp n'est pas connectée. Scannez le QR code.` 
      });
    }

    // Nettoyer le numéro
    const cleanNumber = sanitizePhoneNumber(client.phone);
    if (!cleanNumber) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone invalide' });
    }

    // Rendre le message avec les variables
    const message = renderMessage(messageTemplate, client, orderData);

    // Envoyer avec média si présent
    let result;
    if (media?.type === 'image' && media?.url) {
      // Envoyer l'image d'abord (sans caption)
      const imageResult = await evolutionApiService.sendMedia(
        instance.instanceName,
        instance.instanceToken,
        cleanNumber,
        media.url,
        '', // Pas de caption - le texte sera envoyé séparément
        media.fileName || 'image.jpg'
      );
      
      // Puis envoyer le texte séparément si l'image a réussi
      if (imageResult.success && message.trim()) {
        await new Promise(r => setTimeout(r, 2000));
        result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
      } else {
        result = imageResult;
      }
    } else if (media?.type === 'audio' && media?.url) {
      const audioResult = await evolutionApiService.sendAudio(
        instance.instanceName,
        instance.instanceToken,
        cleanNumber,
        media.url
      );
      
      if (audioResult.success && message.trim()) {
        await new Promise(r => setTimeout(r, 2000));
        result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
      } else {
        result = audioResult;
      }
    } else {
      result = await evolutionApiService.sendMessage(instance.instanceName, instance.instanceToken, cleanNumber, message);
    }

    if (result.success) {
      res.json({ success: true, message: 'Message de test envoyé avec succès' });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Erreur lors de l\'envoi' });
    }
  } catch (error) {
    console.error('Erreur preview-send:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur serveur' });
  }
});

router.delete('/:id', requireEcomAuth, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const { force } = req.query; // ?force=true pour forcer la suppression
    
    // Récupérer la campagne
    const campaign = await Campaign.findOne({ 
      _id: campaignId, 
      workspaceId: req.workspaceId 
    });
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: 'Campagne non trouvée' 
      });
    }
    
    // Vérifier si la campagne est en cours d'envoi
    if (campaign.status === 'sending' && force !== 'true') {
      return res.status(400).json({ 
        success: false, 
        message: 'Impossible de supprimer une campagne en cours d\'envoi. Ajoutez ?force=true pour forcer.',
        canForce: true
      });
    }
    
    // Si la campagne est en cours d'envoi et qu'on force, la mettre en paused/interrupted d'abord
    if (campaign.status === 'sending' && force === 'true') {
      console.log(`⚠️ [DELETE] Forcage de la suppression d'une campagne en cours d'envoi: ${campaign.name}`);
      campaign.status = 'interrupted';
      await campaign.save();
      
      // Attendre un peu pour que les processus en cours s'arrêtent
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Supprimer la campagne
    await Campaign.deleteOne({ _id: campaignId });
    
    console.log(`🗑️ Campagne supprimée: ${campaign.name} (ID: ${campaignId})${force === 'true' ? ' (forcé)' : ''}`);
    
    res.json({ 
      success: true, 
      message: `Campagne supprimée avec succès${force === 'true' ? ' (forcé)' : ''}` 
    });
    
  } catch (error) {
    console.error('❌ [DELETE] Erreur suppression campagne:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Erreur lors de la suppression de la campagne' 
    });
  }
});

router.post('/test-message', requireEcomAuth, (req, res) => {
  res.status(400).json({ success: false, message: 'Fonctionnalité d\'envoi désactivée' });
});

export default router;
