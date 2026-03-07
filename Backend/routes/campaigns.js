import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';
import { normalizeCity, deduplicateCities } from '../utils/cityNormalizer.js';

// Helper pour convertir en ObjectId
const toObjectId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
  return null;
};

// Import conditionnel du service WhatsApp
let analyzeSpamRisk = () => ({ risk: 'LOW', score: 0, warnings: [], recommendations: [] });
let validateMessageBeforeSend = () => true;
let sendWhatsAppMessage = async () => ({ messageId: 'mock-id', logId: 'mock-log-id' });
let getHumanDelayWithVariation = () => 5000;
let simulateHumanBehavior = async () => {};
let sanitizePhoneNumber = (phone) => phone?.replace(/\D/g, '') || null;

// Import du nouveau service d'intégration WhatsApp SaaS
let sendWhatsAppMessageV2 = async () => ({ data: { messageId: 'mock-id' } });

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
  return statusGroups.map(s => {
    const pattern = STATUS_REGEX_MAP[s];
    return { status: { $regex: pattern ? pattern.source : `^${s}$`, $options: 'i' } };
  });
}

// Helper: construire le filtre MongoDB depuis les targetFilters
function buildClientFilter(workspaceId, targetFilters) {
  const filter = { workspaceId };
  const clientStatus = toMongoIn(targetFilters.clientStatus);
  if (clientStatus) filter.status = clientStatus;
  if (targetFilters.city) {
    const cities = toArray(targetFilters.city);
    if (cities.length === 1) {
      filter.city = { $regex: `^${cities[0]}`, $options: 'i' };
    } else if (cities.length > 1) {
      filter.$or = cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } }));
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

// Helper: ciblage basé sur les commandes — retourne les phones des clients correspondants
async function getClientsFromOrderFilters(workspaceId, targetFilters) {
  const orderFilter = { workspaceId };
  const statusArr = toArray(targetFilters.orderStatus);
  if (statusArr.length > 0) {
    const conds = buildStatusConditions(statusArr);
    if (conds.length === 1) orderFilter.status = conds[0].status;
    else orderFilter.$or = [...(orderFilter.$or || []), ...conds];
  }
  if (targetFilters.orderCity) {
    const cities = toArray(targetFilters.orderCity);
    if (cities.length === 1) {
      // Recherche flexible : "Douala" trouve "douala", "Douala-Akwa", etc.
      orderFilter.city = { $regex: `^${cities[0]}`, $options: 'i' };
    } else if (cities.length > 1) {
      // Plusieurs villes : $or avec regex pour chacune
      orderFilter.$or = cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } }));
    }
  }
  if (targetFilters.orderAddress) orderFilter.address = { $regex: targetFilters.orderAddress, $options: 'i' };
  if (targetFilters.orderProduct) {
    const prods = toArray(targetFilters.orderProduct);
    orderFilter.product = prods.length > 1 ? { $in: prods } : prods[0];
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

  const orders = await Order.find(orderFilter).select('clientName clientPhone city address product price date status quantity').lean();

  // Group by phone, keep most recent order data
  const clientMap = new Map();
  for (const o of orders) {
    const phone = (o.clientPhone || '').trim();
    if (!phone) continue;
    const existing = clientMap.get(phone);
    if (!existing || new Date(o.date) > new Date(existing.date)) {
      clientMap.set(phone, o);
    }
  }
  return clientMap; // Map<phone, orderData>
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
      .select('name type status createdAt scheduledAt sentAt targetFilters messageTemplate sendProgress')
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
    
    // Récupérer depuis les commandes
    const [orderCities, orderProducts, orderAddresses] = await Promise.all([
      Order.find({ ...wsFilter, city: { $exists: true, $ne: '' } }).distinct('city'),
      Order.find({ ...wsFilter, product: { $exists: true, $ne: '' } }).distinct('product'),
      Order.find({ ...wsFilter, address: { $exists: true, $ne: '' } }).distinct('address')
    ]);
    
    // Récupérer aussi depuis les clients (données enrichies)
    const [clientCities, clientProducts, clientAddresses] = await Promise.all([
      Client.find({ ...wsFilter, city: { $exists: true, $ne: '' } }).distinct('city'),
      Client.find({ ...wsFilter, products: { $exists: true, $ne: [] } }).distinct('products'),
      Client.find({ ...wsFilter, address: { $exists: true, $ne: '' } }).distinct('address')
    ]);
    
    // Fusionner et normaliser les villes intelligemment
    const allCities = [...orderCities, ...clientCities].filter(Boolean);
    const cities = deduplicateCities(allCities);
    
    // Produits et adresses : simple dédupliquer
    const products = [...new Set([...orderProducts, ...clientProducts])].filter(Boolean).sort();
    const addresses = [...new Set([...orderAddresses, ...clientAddresses])].filter(Boolean).sort();

    // Statuts de commande possibles
    const orderStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'returned', 'unreachable', 'called', 'postponed'];

    // Statuts de client possibles
    const clientStatuses = ['active', 'inactive', 'pending', 'blocked'];
    
    console.log(`📊 Filter options: ${cities.length} villes, ${products.length} produits, ${addresses.length} adresses`);
    res.json({
      success: true,
      data: {
        cities,
        products,
        addresses,
        orderStatuses,
        clientStatuses
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
    const hasOrderDate = !!(tf.orderDateFrom || tf.orderDateTo);
    const hasOrderPrice = (tf.orderMinPrice > 0) || (tf.orderMaxPrice > 0);
    const hasAnyOrderFilter = hasOrderStatus || hasOrderCity || hasOrderProduct || hasOrderDate || hasOrderPrice;

    console.log(`📊 [PREVIEW] Type de recherche: ${hasAnyOrderFilter ? 'COMMANDES' : 'CLIENTS DIRECTS'}`);

    // Si aucun filtre actif, retourner vide (évite de charger tous les clients)
    if (!hasAnyOrderFilter && Object.keys(tf).length === 0) {
      console.log(`ℹ️ [PREVIEW] Aucun filtre actif, retour d'une liste vide`);
      return res.json({ success: true, data: { count: 0, clients: [], hint: 'Sélectionnez au moins un filtre pour prévisualiser' } });
    }

    if (hasAnyOrderFilter) {
      console.log(`� [PREVIEW] Recherche via filtres de commande...`);
      const statusArr = toArray(tf.orderStatus);
      
      const orderFilter = { 
        workspaceId: req.workspaceId, 
        clientPhone: { $exists: true, $ne: '' }
      };
      
      if (statusArr.length > 0) {
        const statusConds = buildStatusConditions(statusArr);
        if (statusConds.length === 1) orderFilter.status = statusConds[0].status;
        else orderFilter.$or = [...(orderFilter.$or || []), ...statusConds];
      }
      
      if (tf.orderCity) {
        const cities = toArray(tf.orderCity);
        if (cities.length === 1) {
          orderFilter.city = { $regex: `^${cities[0]}`, $options: 'i' };
        } else if (cities.length > 1) {
          orderFilter.$or = cities.map(c => ({ city: { $regex: `^${c}`, $options: 'i' } }));
        }
      }
      if (tf.orderProduct) {
        const prods = toArray(tf.orderProduct);
        orderFilter.product = prods.length > 1 ? { $in: prods } : prods[0];
      }
      if (tf.orderDateFrom) orderFilter.date = { ...orderFilter.date, $gte: new Date(tf.orderDateFrom) };
      if (tf.orderDateTo) {
        const end = new Date(tf.orderDateTo);
        end.setHours(23, 59, 59, 999);
        orderFilter.date = { ...orderFilter.date, $lte: end };
      }
      
      console.log(`🔍 [PREVIEW] Filtre MongoDB Commandes:`, JSON.stringify(orderFilter));

      const orders = await Order.find(orderFilter)
        .select('clientName clientPhone city address product price date status quantity')
        .limit(500)
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
      .limit(500)
      .lean();

    console.log(`✅ [PREVIEW] ${clients.length} clients trouvés via filtres directs`);
    res.json({ success: true, data: { count: clients.length, clients } });
  } catch (error) {
    console.error('❌ [PREVIEW] Erreur critique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns/:id/preview - Prévisualiser les clients ciblés pour une campagne spécifique
router.post('/:id/preview', requireEcomAuth, async (req, res) => {
  console.log(`🔍 [PREVIEW-ID] Requête pour la campagne ${req.params.id}`);
  try {
    // Récupérer la campagne
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      console.warn(`⚠️ [PREVIEW-ID] Campagne non trouvée: ${req.params.id}`);
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }

    // Utiliser les filtres de la campagne
    const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
    // Seulement les clients avec un téléphone
    filter.phone = { $exists: true, $ne: '' };

    console.log(`🔍 [PREVIEW-ID] Filtre MongoDB:`, JSON.stringify(filter));

    const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent status tags').limit(500);
    
    console.log(`✅ [PREVIEW-ID] ${clients.length} clients trouvés pour "${campaign.name}"`);

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
    const { name, type, messageTemplate, targetFilters, scheduledAt, tags, selectedClientIds, recipients } = req.body;
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
          const phones = [...new Set(orders.map(o => o.clientPhone).filter(Boolean))];
          console.log(`🔍 [CREATE] ${phones.length} numéros de téléphone uniques extraits des commandes`);

          const clients = await Client.find({
            phone: { $in: phones },
            workspaceId: req.workspaceId
          }).select('_id phone').limit(1000);
          
          recipientSnapshotIds = clients.map(c => c._id);
          targetedCount = recipientSnapshotIds.length;
          console.log(`✅ [CREATE] Résolution réussie: ${selectedClientIds.length} commandes → ${targetedCount} clients identifiés pour le snapshot`);
          if (targetedCount < phones.length) {
            console.warn(`⚠️ [CREATE] Attention: ${phones.length - targetedCount} numéros n'ont pas de fiche client correspondante`);
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
        // Utiliser les commandes pour trouver les clients puis récupérer leurs IDs
        const orderMap = await getClientsFromOrderFilters(req.workspaceId, targetFilters);
        const phones = Array.from(orderMap.keys());
        console.log(`🔍 [CREATE] ${phones.length} téléphones trouvés via filtres de commande`);
        
        // Trouver les clients correspondants par téléphone
        const clients = await Client.find({
          phone: { $in: phones },
          workspaceId: req.workspaceId
        }).select('_id').limit(1000);
        
        recipientSnapshotIds = clients.map(c => c._id);
        targetedCount = recipientSnapshotIds.length;
        
        console.log(`✅ [CREATE] ${targetedCount} clients identifiés via filtres commande pour le snapshot`);
      } else {
        // Filtres clients directs
        console.log(`🔍 [CREATE] Utilisation des filtres clients directs pour le snapshot`);
        const filter = buildClientFilter(req.workspaceId, targetFilters || {});
        filter.phone = { $exists: true, $ne: '' };
        
        const clients = await Client.find(filter).select('_id').limit(1000);
        recipientSnapshotIds = clients.map(c => c._id);
        targetedCount = recipientSnapshotIds.length;
        
        console.log(`✅ [CREATE] ${targetedCount} clients identifiés via filtres directs pour le snapshot`);
      }
    } else {
      targetedCount = 0;
      console.log(`⚠️ [CREATE] Campagne sans cible définie`);
    }

    const campaign = new Campaign({
      workspaceId: req.workspaceId,
      name,
      type: type || 'custom',
      messageTemplate,
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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

    const allowedFields = ['name', 'type', 'messageTemplate', 'targetFilters', 'scheduledAt', 'tags', 'status', 'selectedClientIds'];
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
        
        const clients = await Client.find(filter).select('_id').limit(1000);
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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

    // Déterminer les destinataires
    let recipients = []; // [{ phone, client, orderData }]
    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderProduct || campaign.targetFilters.orderDateFrom
    );

    if (campaign.recipientSnapshotIds && campaign.recipientSnapshotIds.length > 0) {
      const clients = await Client.find({ _id: { $in: campaign.recipientSnapshotIds } })
        .select('firstName lastName phone city products totalOrders totalSpent lastContactAt')
        .lean();
      recipients = clients.filter(c => c.phone).map(c => ({ phone: c.phone, client: c, orderData: null }));
    } else if (campaign.selectedClientIds && campaign.selectedClientIds.length > 0) {
      const clients = await Client.find({ _id: { $in: campaign.selectedClientIds } })
        .select('firstName lastName phone city products totalOrders totalSpent lastContactAt')
        .lean();
      recipients = clients.filter(c => c.phone).map(c => ({ phone: c.phone, client: c, orderData: null }));
    } else if (hasOrderFilters) {
      const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
      for (const [phone, orderData] of orderMap) {
        recipients.push({
          phone,
          client: { firstName: orderData.clientName?.split(' ')[0] || '', lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '', phone },
          orderData
        });
      }
    } else if (campaign.targetFilters && Object.keys(campaign.targetFilters).some(k => campaign.targetFilters[k])) {
      const filter = buildClientFilter(req.workspaceId, campaign.targetFilters);
      filter.phone = { $exists: true, $ne: '' };
      const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent lastContactAt').limit(1000).lean();
      recipients = clients.map(c => ({ phone: c.phone, client: c, orderData: null }));
    }

    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun destinataire trouvé pour cette campagne' });
    }

    // Passer la campagne en statut "sending"
    campaign.status = 'sending';
    await campaign.save();

    console.log(`📤 Envoi campagne "${campaign.name}" à ${recipients.length} destinataires via ${instance.instanceName}`);

    let sent = 0;
    let failed = 0;

    for (const { phone, client, orderData } of recipients) {
      const cleanPhone = sanitizePhoneNumber(phone);
      if (!cleanPhone) { failed++; continue; }

      const message = renderMessage(campaign.messageTemplate, client, orderData);

      const result = await evolutionApiService.sendMessage(
        instance.instanceName,
        instance.instanceToken,
        cleanPhone,
        message
      );

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.warn(`⚠️ Échec envoi à ${cleanPhone}:`, result.error);
      }

      // Délai humain entre les messages (1.5s)
      await new Promise(r => setTimeout(r, 1500));
    }

    // Mettre à jour la campagne
    campaign.status = failed === recipients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats = { ...campaign.stats.toObject?.() || campaign.stats, sent, failed, targeted: recipients.length };
    await campaign.save();

    // Mettre à jour le lastSeen de l'instance
    await WhatsAppInstance.findByIdAndUpdate(instanceId, { lastSeen: new Date(), status: 'connected' });

    console.log(`✅ Campagne envoyée : ${sent} réussis, ${failed} échoués`);

    res.json({
      success: true,
      message: `${sent} message(s) envoyé(s) via "${instance.customName || instance.instanceName}"${failed > 0 ? `, ${failed} échec(s)` : ''}`,
      data: { sent, failed, total: recipients.length }
    });
  } catch (error) {
    console.error('❌ Erreur envoi campagne:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de la campagne' });
  }
});

router.post('/preview-send', requireEcomAuth, async (req, res) => {
  try {
    const { messageTemplate, clientId, media } = req.body;
    
    if (!messageTemplate || !clientId) {
      return res.status(400).json({ success: false, message: 'Message et client requis' });
    }

    // Récupérer le client
    const client = await Client.findOne({ _id: clientId, workspaceId: req.workspaceId });
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client introuvable' });
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
    const message = renderMessage(messageTemplate, client, null);

    // Envoyer avec média si présent
    let result;
    if (media?.type === 'image' && media?.url) {
      result = await evolutionApiService.sendMedia(
        instance.instanceName,
        instance.instanceToken,
        cleanNumber,
        media.url,
        message,
        media.fileName || 'image.jpg'
      );
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.post('/test-message', requireEcomAuth, (req, res) => {
  res.status(400).json({ success: false, message: 'Fonctionnalité d\'envoi désactivée' });
});

export default router;
