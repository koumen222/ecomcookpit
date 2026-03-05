import express from 'express';
import mongoose from 'mongoose';
import Campaign from '../models/Campaign.js';
import Client from '../models/Client.js';
import Order from '../models/Order.js';
import { requireEcomAuth, validateEcomAccess } from '../middleware/ecomAuth.js';

// Helper pour convertir en ObjectId
const toObjectId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (mongoose.Types.ObjectId.isValid(v)) return new mongoose.Types.ObjectId(v);
  return null;
};

// Import conditionnel du service WhatsApp
let analyzeSpamRisk, validateMessageBeforeSend, sendWhatsAppMessage, getHumanDelayWithVariation, simulateHumanBehavior;

async function loadWhatsAppService() {
  try {
    const whatsappService = await import('../services/whatsappService.js');
    analyzeSpamRisk = whatsappService.analyzeSpamRisk;
    validateMessageBeforeSend = whatsappService.validateMessageBeforeSend;
    sendWhatsAppMessage = whatsappService.sendWhatsAppMessage;
    getHumanDelayWithVariation = whatsappService.getHumanDelayWithVariation;
    simulateHumanBehavior = whatsappService.simulateHumanBehavior;
  } catch (error) {
    console.warn('⚠️ Service WhatsApp non disponible:', error.message);
    // Fonctions fallback
    analyzeSpamRisk = () => ({ risk: 'LOW', score: 0, warnings: [], recommendations: [] });
    validateMessageBeforeSend = () => true;
    sendWhatsAppMessage = async () => ({ messageId: 'mock-id', logId: 'mock-log-id' });
    getHumanDelayWithVariation = () => 5000;
    simulateHumanBehavior = async () => {};
  }
}

// Load the service immediately
loadWhatsAppService();

const router = express.Router();

// Helper: normaliser les noms de villes pour regrouper les variantes
function normalizeCityName(city) {
  if (!city || typeof city !== 'string') return null;
  
  // Nettoyer et normaliser
  let normalized = city.trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Enlever accents
    .replace(/[^a-z0-9\s-]/g, '') // Garder seulement lettres, chiffres, espaces, tirets
    .replace(/\s+/g, ' '); // Normaliser espaces multiples
  
  // Extraire la ville principale (avant le tiret ou la virgule)
  const mainCity = normalized.split(/[-,]/)[0].trim();
  
  // Capitaliser première lettre
  return mainCity.charAt(0).toUpperCase() + mainCity.slice(1);
}

// Helper: grouper les villes similaires
function groupCities(cityList) {
  const cityMap = new Map(); // normalized -> original
  const cityCount = new Map(); // normalized -> count
  
  cityList.forEach(city => {
    const normalized = normalizeCityName(city);
    if (!normalized) return;
    
    if (!cityMap.has(normalized)) {
      cityMap.set(normalized, city);
      cityCount.set(normalized, 1);
    } else {
      cityCount.set(normalized, cityCount.get(normalized) + 1);
    }
  });
  
  // Retourner les villes normalisées triées
  return Array.from(cityMap.keys()).sort();
}

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
  const statusVal = toMongoIn(targetFilters.orderStatus);
  if (statusVal) orderFilter.status = statusVal;
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
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-results');

    const total = await Campaign.countDocuments(filter);

    const allCampaigns = await Campaign.find({ workspaceId: req.workspaceId }).select('status');
    const stats = {
      total: allCampaigns.length,
      draft: allCampaigns.filter(c => c.status === 'draft').length,
      scheduled: allCampaigns.filter(c => c.status === 'scheduled').length,
      sent: allCampaigns.filter(c => c.status === 'sent').length,
      sending: allCampaigns.filter(c => c.status === 'sending').length
    };

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
    const cities = groupCities(allCities);
    
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
  try {
    const { targetFilters } = req.body;
    const tf = targetFilters || {};

    // Guard: workspaceId requis
    if (!req.workspaceId) {
      return res.json({ success: true, data: { count: 0, clients: [] } });
    }

    // Vérifier si au moins un filtre de commande est actif
    const hasOrderStatus = toArray(tf.orderStatus).length > 0;
    const hasOrderCity = toArray(tf.orderCity).length > 0;
    const hasOrderProduct = toArray(tf.orderProduct).length > 0;
    const hasOrderDate = !!(tf.orderDateFrom || tf.orderDateTo);
    const hasOrderPrice = (tf.orderMinPrice > 0) || (tf.orderMaxPrice > 0);
    const hasAnyOrderFilter = hasOrderStatus || hasOrderCity || hasOrderProduct || hasOrderDate || hasOrderPrice;

    // Si aucun filtre actif, retourner vide (évite de charger tous les clients)
    if (!hasAnyOrderFilter) {
      return res.json({ success: true, data: { count: 0, clients: [], hint: 'Sélectionnez au moins un filtre pour prévisualiser' } });
    }

    if (hasOrderStatus) {
      const statusArr = toArray(tf.orderStatus);
      console.log(`📊 Filtre par statut(s) de commande: ${statusArr.join(', ')}`);
      
      const orderFilter = { 
        workspaceId: req.workspaceId, 
        status: statusArr.length === 1 ? statusArr[0] : { $in: statusArr },
        clientPhone: { $exists: true, $ne: '' }
      };
      
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
      if (tf.orderSourceId) {
        if (tf.orderSourceId === 'legacy') {
          orderFilter.sheetRowId = { $not: /^source_/ };
        } else {
          orderFilter.sheetRowId = { $regex: `^source_${tf.orderSourceId}_` };
        }
      }
      if (tf.orderMinPrice > 0) orderFilter.price = { ...orderFilter.price, $gte: tf.orderMinPrice };
      if (tf.orderMaxPrice > 0) orderFilter.price = { ...orderFilter.price, $lte: tf.orderMaxPrice };

      const orders = await Order.find(orderFilter)
        .select('clientName clientPhone city address product price date status quantity')
        .limit(500)
        .lean();

      console.log(`📦 Commandes trouvées pour le statut ${tf.orderStatus}: ${orders.length}`);

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
        _id: order._id,
        _orderStatus: order.status || '',
        _orderPrice: order.price || 0,
        _orderDate: order.date || null,
        _orderProduct: order.product || '',
        _orderQuantity: order.quantity || 1
      }));

      console.log(`✅ Preview: ${clients.length} personnes avec le statut ${tf.orderStatus}`);
      return res.json({ success: true, data: { count: clients.length, clients } });
    }

    // Si aucun statut de commande, utiliser les filtres clients (ancienne méthode)
    const filter = buildClientFilter(req.workspaceId, tf);
    filter.phone = { $exists: true, $ne: '' };
    const clients = await Client.find(filter)
      .select('firstName lastName phone city products totalOrders totalSpent status tags address lastContactAt')
      .limit(500)
      .lean();

    console.log(`✅ Preview: ${clients.length} clients (filtres clients)`);
    res.json({ success: true, data: { count: clients.length, clients } });
  } catch (error) {
    console.error('Erreur preview campaign:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/campaigns/:id/preview - Prévisualiser les clients ciblés pour une campagne spécifique
router.post('/:id/preview', requireEcomAuth, async (req, res) => {
  try {
    // Récupérer la campagne
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    }

    // Utiliser les filtres de la campagne
    const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
    // Seulement les clients avec un téléphone
    filter.phone = { $exists: true, $ne: '' };

    const clients = await Client.find(filter).select('firstName lastName phone city products totalOrders totalSpent status tags').limit(500);
    
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
    console.error('Erreur preview campaign spécifique:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/campaigns/stats - Statistiques globales des campagnes
router.get('/stats', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    
    // Récupérer toutes les campagnes du workspace
    const campaigns = await Campaign.find({ workspaceId }).lean();
    
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
    console.error('Erreur récupération stats campagnes:', error);
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

    // ✅ Validation des recipients pour les campagnes WhatsApp
    if (type === 'whatsapp' && recipients) {
      if (!recipients.type) {
        return res.status(400).json({ success: false, message: 'Type de destinataires requis (all, segment, list)' });
      }
      
      if (recipients.type === 'list') {
        if (!recipients.customPhones || !Array.isArray(recipients.customPhones)) {
          return res.status(400).json({ success: false, message: 'customPhones doit être un tableau pour le type "list"' });
        }
        
        if (recipients.customPhones.length === 0) {
          return res.status(400).json({ success: false, message: 'customPhones ne peut pas être vide pour le type "list"' });
        }
        
        // Fonction de normalisation pour validation
        const normalizePhone = (phone) => {
          if (!phone) return '';
          let cleaned = phone.toString().replace(/\D/g, '').trim();
          
          // ✅ Corriger le cas 00237699887766
          if (cleaned.startsWith('00')) {
            cleaned = cleaned.substring(2);
          }
          
          // Gérer le préfixe pays (Cameroun 237)
          if (cleaned.length === 9 && cleaned.startsWith('6')) {
            return '237' + cleaned;
          }
          
          return cleaned;
        };
        
        // Valider et normaliser les numéros
        const validPhones = recipients.customPhones
          .map(phone => normalizePhone(phone))
          .filter(phone => phone.length >= 8); // Minimum 8 digits
        
        if (validPhones.length === 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'Aucun numéro valide trouvé dans customPhones',
            details: 'Les numéros doivent contenir au moins 8 chiffres'
          });
        }
        
        // Mettre à jour recipients.count
        recipients.count = validPhones.length;
        console.log(`✅ Validation LIST: ${validPhones.length} numéros valides sur ${recipients.customPhones.length}`);
      }
    }

    // 🆕 VALIDATION ANTI-SPAM du message template
    const analysis = analyzeSpamRisk(messageTemplate);
    const isValid = validateMessageBeforeSend(messageTemplate, 'campaign-creation');
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message rejeté pour risque de spam élevé',
        spamAnalysis: {
          risk: analysis.risk,
          score: analysis.score,
          warnings: analysis.warnings,
          recommendations: analysis.recommendations
        }
      });
    }
    
    // Avertir si risque moyen
    if (analysis.risk === 'MEDIUM') {
      console.warn('⚠️ Campagne marketing à risque moyen:', analysis.warnings);
    }

    // Compter les clients ciblés - utiliser selectedClientIds si présent
    let targetedCount;
    let recipientSnapshotIds = [];
    
    if (selectedClientIds && selectedClientIds.length > 0) {
      targetedCount = selectedClientIds.length;
      recipientSnapshotIds = selectedClientIds.map(id => toObjectId(id)).filter(Boolean); // 🆕 Conversion et filtre
      console.log(`📋 Campagne avec ${targetedCount} clients sélectionnés manuellement`);
    } else if (targetFilters && Object.keys(targetFilters).length > 0) {
      // 🆕 Récupérer les vrais IDs des clients (pas les IDs de commande)
      const hasOrderFilters = targetFilters.orderStatus || targetFilters.orderCity || 
                             targetFilters.orderProduct || targetFilters.orderDateFrom;
      
      if (hasOrderFilters) {
        // Utiliser les commandes pour trouver les clients puis récupérer leurs IDs
        const orderMap = await getClientsFromOrderFilters(req.workspaceId, targetFilters);
        const phones = Array.from(orderMap.keys());
        
        // Trouver les clients correspondants par téléphone
        const clients = await Client.find({
          phone: { $in: phones },
          workspaceId: req.workspaceId
        }).select('_id').limit(1000);
        
        recipientSnapshotIds = clients.map(c => c._id);
        targetedCount = recipientSnapshotIds.length;
        
        console.log(`🎯 Campagne avec ${targetedCount} clients calculés depuis filtres commande (snapshot client IDs)`);
      } else {
        // Filtres clients directs
        const filter = buildClientFilter(req.workspaceId, targetFilters || {});
        filter.phone = { $exists: true, $ne: '' };
        
        const clients = await Client.find(filter).select('_id').limit(1000);
        recipientSnapshotIds = clients.map(c => c._id);
        targetedCount = recipientSnapshotIds.length;
        
        console.log(`👥 Campagne avec ${targetedCount} clients calculés depuis filtres clients (snapshot client IDs)`);
      }
    } else {
      targetedCount = 0;
      console.log(`⚠️ Campagne sans cible définie`);
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

// POST /api/ecom/campaigns/:id/send - Envoyer la campagne maintenant
router.post('/:id/send', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const campaign = await Campaign.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    if (campaign.status === 'sending' || campaign.status === 'sent') {
      return res.status(400).json({ success: false, message: 'Campagne déjà envoyée ou en cours' });
    }

    // 🆕 Pour les campagnes programmées, annuler la programmation et envoyer maintenant
    if (campaign.status === 'scheduled') {
      campaign.status = 'draft';
      campaign.scheduledAt = null;
      await campaign.save();
      console.log(`🔄 Campagne ${campaign.name}: programmation annulée, envoi manuel initié`);
    }

    // Récupérer l'instance WhatsApp depuis la base de données
    const whatsappInstanceId = req.body.whatsappInstanceId;
    
    if (!whatsappInstanceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Veuillez sélectionner une instance WhatsApp' 
      });
    }
    
    // Charger l'instance depuis la base de données
    const WhatsAppInstance = (await import('../models/WhatsAppInstance.js')).default;
    const whatsappInstance = await WhatsAppInstance.findOne({
      _id: whatsappInstanceId,
      workspaceId: req.workspaceId
    });
    
    if (!whatsappInstance) {
      return res.status(404).json({ 
        success: false, 
        message: 'Instance WhatsApp non trouvée' 
      });
    }
    
    if (whatsappInstance.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Instance WhatsApp inactive. Veuillez vérifier la configuration.' 
      });
    }
    
    const instanceId = whatsappInstance.instanceId;
    const apiKey = whatsappInstance.apiKey;
    const apiUrl = whatsappInstance.apiUrl || 'https://servicewhstapps.pages.dev';
    
    console.log(`📱 Utilisation de l'instance WhatsApp: ${whatsappInstance.name} (${instanceId})`);

    // 🆕 VALIDATION ANTI-SPAM du message avant envoi massif
    const analysis = analyzeSpamRisk(campaign.messageTemplate);
    const isValid = validateMessageBeforeSend(campaign.messageTemplate, `campaign-${campaign._id}`);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Envoi bloqué - message à risque de spam élevé',
        spamAnalysis: {
          risk: analysis.risk,
          score: analysis.score,
          warnings: analysis.warnings,
          recommendations: analysis.recommendations
        }
      });
    }

    // 🆕 LOGS DE VÉRIFICATION - DIAGNOSTIC
    console.log('SEND DEBUG campaign:', {
      id: campaign._id,
      name: campaign.name,
      type: campaign.type,
      targetFilters: campaign.targetFilters,
      snapshotCount: campaign.recipientSnapshotIds?.length,
      selectedClientIdsCount: campaign.selectedClientIds?.length,
      recipientsCount: campaign.recipients?.count,
      statsTargeted: campaign.stats?.targeted
    });

    // Récupérer les clients ciblés
    let clients = [];

    // 🆕 UTILISER LE SNAPSHOT SI DISPONIBLE (priorité absolue)
    if (campaign.recipientSnapshotIds && campaign.recipientSnapshotIds.length > 0) {
      console.log(`📸 Utilisation du snapshot de ${campaign.recipientSnapshotIds.length} destinataires`);
      
      // 🆕 Conversion sécurisée des IDs
      const snapshotIdsRaw = campaign.recipientSnapshotIds;
      const snapshotIds = snapshotIdsRaw.map(toObjectId).filter(Boolean);
      
      console.log("SNAPSHOT DEBUG first3:", snapshotIdsRaw.slice(0,3), "casted:", snapshotIds.slice(0,3));
      
      // Chercher sans filtre workspaceId (les IDs sont déjà scopés au workspace lors de la création)
      clients = await Client.find({ 
        _id: { $in: snapshotIds },
        phone: { $exists: true, $ne: '' }
      }).select('firstName lastName phone city products totalOrders totalSpent status tags address lastContactAt').lean();
      
      console.log("Snapshot loaded:", clients.length, "expected:", snapshotIds.length);
      
      if (clients.length !== snapshotIds.length) {
        console.warn(`⚠️ Attention: ${snapshotIds.length - clients.length} clients du snapshot non trouvés`);
      }
      
      // Fallback si snapshot vide: recalculer depuis les filtres
      if (clients.length === 0) {
        console.warn('⚠️ Snapshot vide, fallback sur les filtres de la campagne...');
        const hasOrderFilters = campaign.targetFilters && (
          campaign.targetFilters.orderStatus || campaign.targetFilters.orderCity ||
          campaign.targetFilters.orderAddress || campaign.targetFilters.orderProduct ||
          campaign.targetFilters.orderDateFrom || campaign.targetFilters.orderDateTo ||
          campaign.targetFilters.orderSourceId || campaign.targetFilters.orderMinPrice ||
          campaign.targetFilters.orderMaxPrice
        );
        if (hasOrderFilters) {
          const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
          clients = Array.from(orderMap.entries()).map(([phone, orderData]) => ({
            firstName: orderData.clientName?.split(' ')[0] || '',
            lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
            phone, city: orderData.city || '', address: orderData.address || '',
            products: orderData.product ? [orderData.product] : [],
            totalOrders: 1, totalSpent: (orderData.price || 0) * (orderData.quantity || 1),
            status: orderData.status || '', tags: [], lastContactAt: orderData.date || new Date(),
            _id: orderData._id, _orderStatus: orderData.status || '',
            _orderPrice: orderData.price || 0, _orderDate: orderData.date || null,
            _orderProduct: orderData.product || '', _orderQuantity: orderData.quantity || 1
          }));
          console.log(`📦 Fallback: ${clients.length} clients depuis filtres commandes`);
        } else {
          const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
          filter.phone = { $exists: true, $ne: '' };
          clients = await Client.find(filter).lean();
          console.log(`👥 Fallback: ${clients.length} clients depuis filtres clients`);
        }
      }
      
    // ✅ Gestion des campagnes WhatsApp
    } else if (campaign.type === 'whatsapp' && campaign.recipients) {
      console.log('🔍 DIAGNOSTIC ENVOI CAMPAGNE WHATSAPP:');
      console.log('   Type de recipients:', campaign.recipients?.type);
      console.log('   Segment:', campaign.recipients?.segment);
      console.log('   Longueur customPhones:', campaign.recipients?.customPhones?.length || 0);
      if (campaign.recipients?.customPhones?.length > 0) {
        console.log('   3-5 numéros exemples:', campaign.recipients.customPhones.slice(0, 5));
      }
      console.log('   Count:', campaign.recipients?.count);
      
      if (campaign.recipients.type === 'list' && campaign.recipients.customPhones?.length) {
        // ✅ Logique "list" améliorée - ne pas dépendre de la DB Users
        console.log('📋 Traitement campagne WhatsApp type LIST');
        
        // ✅ Fonction de normalisation uniforme
        const normalizePhone = (phone) => {
          if (!phone) return '';
          let cleaned = phone.toString().replace(/\D/g, '').trim();
          
          // ✅ Corriger le cas 00237699887766
          if (cleaned.startsWith('00')) {
            cleaned = cleaned.substring(2);
          }
          
          // Gérer le préfixe pays (Cameroun 237)
          if (cleaned.length === 9 && cleaned.startsWith('6')) {
            return '237' + cleaned;
          }
          
          return cleaned;
        };
        
        // Normaliser et filtrer les numéros valides
        const validPhones = campaign.recipients.customPhones
          .map(phone => normalizePhone(phone))
          .filter(phone => phone.length >= 8); // Minimum 8 digits
        
        console.log(`   ${validPhones.length} numéros valides sur ${campaign.recipients.customPhones.length}`);
        
        // ✅ Construire les destinataires directement depuis customPhones
        clients = validPhones.map(phone => ({
          phone: phone,
          phoneNumber: phone,
          name: null,
          firstName: null,
          lastName: null,
          _id: null
        }));
        
        console.log(`   ✅ Créé ${clients.length} destinataires depuis customPhones`);
      } else {
        // Pour les autres types (all, segment), utiliser les filtres commandes/clients
        const hasOrderFilters = campaign.targetFilters && (
          campaign.targetFilters.orderStatus ||
          campaign.targetFilters.orderCity ||
          campaign.targetFilters.orderAddress ||
          campaign.targetFilters.orderProduct ||
          campaign.targetFilters.orderDateFrom ||
          campaign.targetFilters.orderDateTo ||
          campaign.targetFilters.orderSourceId ||
          campaign.targetFilters.orderMinPrice ||
          campaign.targetFilters.orderMaxPrice
        );

        if (campaign.recipientSnapshotIds && campaign.recipientSnapshotIds.length > 0) {
          const snapshotIdsRaw = campaign.recipientSnapshotIds;
          const snapshotIds = snapshotIdsRaw.map(toObjectId).filter(Boolean);
          
          // Chercher sans filtre workspaceId (IDs déjà scopés au workspace)
          clients = await Client.find({
            _id: { $in: snapshotIds },
            phone: { $exists: true, $ne: '' }
          }).lean();
          
          console.log("Snapshot whatsapp loaded:", clients.length, "expected:", snapshotIds.length);
        } else if (hasOrderFilters) {
          const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
          clients = Array.from(orderMap.entries()).map(([phone, orderData]) => ({
            firstName: orderData.clientName?.split(' ')[0] || '',
            lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
            phone: phone,
            city: orderData.city || '',
            address: orderData.address || '',
            products: orderData.product ? [orderData.product] : [],
            totalOrders: 1,
            totalSpent: (orderData.price || 0) * (orderData.quantity || 1),
            status: orderData.status || '',
            tags: [],
            lastContactAt: orderData.date || new Date(),
            _id: orderData._id,
            _orderStatus: orderData.status || '',
            _orderPrice: orderData.price || 0,
            _orderDate: orderData.date || null,
            _orderProduct: orderData.product || '',
            _orderQuantity: orderData.quantity || 1
          }));
        } else {
          const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
          filter.phone = { $exists: true, $ne: '' };
          clients = await Client.find(filter);
        }
      }
    } else {
      // 🆕 LOGIQUE FALLBACK - RECALCULER DEPUIS LES FILTRES
      console.log('🔄 Aucun snapshot trouvé, recalculer depuis les filtres...');
      
      // Logique existante pour les campagnes non-WhatsApp
      const hasOrderFilters = campaign.targetFilters && (
        campaign.targetFilters.orderStatus ||
        campaign.targetFilters.orderCity ||
        campaign.targetFilters.orderAddress ||
        campaign.targetFilters.orderProduct ||
        campaign.targetFilters.orderDateFrom ||
        campaign.targetFilters.orderDateTo ||
        campaign.targetFilters.orderSourceId ||
        campaign.targetFilters.orderMinPrice ||
        campaign.targetFilters.orderMaxPrice
      );

      if (campaign.recipientSnapshotIds && campaign.recipientSnapshotIds.length > 0) {
        // 🆕 Utiliser le snapshot des IDs de clients
        const snapshotIdsRaw = campaign.recipientSnapshotIds;
        const snapshotIds = snapshotIdsRaw.map(toObjectId).filter(Boolean);
        const workspaceObjectId = toObjectId(req.workspaceId) || toObjectId(campaign.workspaceId);
        
        clients = await Client.find({
          _id: { $in: snapshotIds },
          workspaceId: workspaceObjectId,
          phone: { $exists: true, $ne: '' }
        }).lean();
        console.log(`📋 Fallback: ${clients.length} clients depuis snapshot`);
      } else if (hasOrderFilters) {
        // Utiliser directement les commandes
        const orderMap = await getClientsFromOrderFilters(req.workspaceId, campaign.targetFilters);
        console.log(`📦 Campagne basée sur ${orderMap.size} commandes`);

        // Convertir les commandes en structure compatible
        clients = Array.from(orderMap.entries()).map(([phone, orderData]) => ({
          firstName: orderData.clientName?.split(' ')[0] || '',
          lastName: orderData.clientName?.split(' ').slice(1).join(' ') || '',
          phone: phone,
          city: orderData.city || '',
          address: orderData.address || '',
          products: orderData.product ? [orderData.product] : [],
          totalOrders: 1,
          totalSpent: (orderData.price || 0) * (orderData.quantity || 1),
          status: orderData.status || '',
          tags: [],
          lastContactAt: orderData.date || new Date(),
          _id: orderData._id,
          _orderStatus: orderData.status || '',
          _orderPrice: orderData.price || 0,
          _orderDate: orderData.date || null,
          _orderProduct: orderData.product || '',
          _orderQuantity: orderData.quantity || 1
        }));
      } else {
        // Utiliser les filtres clients (ancienne méthode)
        const filter = buildClientFilter(req.workspaceId, campaign.targetFilters || {});
        filter.phone = { $exists: true, $ne: '' };
        clients = await Client.find(filter);
      }
    }

    // 🆕 LOG FINAL DE VÉRIFICATION
    console.log(`🎯 RÉCAPITULATIF ENVOI - Clients récupérés: ${clients.length} | Attendus: ${campaign.stats?.targeted || 'N/A'}`);
    
    if (clients.length === 0) {
      console.error('❌ ERREUR: Aucun client récupéré pour l\'envoi !');
      return res.status(400).json({ 
        success: false, 
        message: 'Aucun destinataire trouvé pour cette campagne. Vérifiez les filtres ou la sélection.',
        debug: {
          snapshotCount: campaign.recipientSnapshotIds?.length,
          selectedCount: campaign.selectedClientIds?.length,
          targetFilters: campaign.targetFilters,
          statsTargeted: campaign.stats?.targeted
        }
      });
    }

    // 🆕 LOGS SKIPPED/FAILED REasons - Analyse des destinataires
    const counters = {
      totalTargets: clients.length,
      missingPhone: 0,
      invalidPhone: 0,
      preparedContacts: 0
    };

    const normalize = (p) => (p ? p.toString().replace(/\D/g, '') : '');

    const contacts = clients
      .map(c => {
        const phoneRaw = c.phoneNumber || c.phone || c.whatsapp || '';
        if (!phoneRaw) { 
          counters.missingPhone++; 
          return null; 
        }
        const phone = normalize(phoneRaw);
        if (phone.length < 8) { 
          counters.invalidPhone++; 
          return null; 
        }
        counters.preparedContacts++;
        return { 
          to: phone, 
          clientId: c._id, 
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          phoneRaw: phoneRaw
        };
      })
      .filter(Boolean);

    console.log('📊 SEND COUNTERS:', counters);
    console.log('📞 Sample phones (first 5):', contacts.slice(0,5).map(c => ({ 
      phoneRaw: c.phoneRaw, 
      normalized: c.to, 
      name: c.firstName + ' ' + c.lastName 
    })));

    // 🆕 HEALTHCHECK Green API avant envoi en masse
    if (counters.preparedContacts > 0) {
      console.log('🔍 Healthcheck ZeChat API avant envoi en masse...');
      try {
        const fetchModule = await import('node-fetch');
        const fetch = fetchModule.default;
        
        const apiUrl = process.env.WHATSAPP_API_URL || 'https://servicewhstapps.pages.dev';
        const instanceId = process.env.WHATSAPP_INSTANCE_ID;
        const apiKey = process.env.WHATSAPP_API_KEY;
        
        const healthUrl = `${apiUrl}/api/status`;
        
        console.log('[ZeChat Healthcheck] POST', healthUrl);
        
        const healthResponse = await fetch(healthUrl, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ instanceId })
        });
        
        if (!healthResponse.ok) {
          throw new Error(`HTTP ${healthResponse.status}`);
        }
        
        const healthData = await healthResponse.json();
        console.log('✅ ZeChat API Healthcheck OK:', healthData);
        
        if (!healthData.success) {
          throw new Error(`Instance non disponible`);
        }
        
      } catch (healthError) {
        console.error('❌ ZeChat API Healthcheck FAILED:', healthError.message);
        return res.status(503).json({ 
          success: false, 
          message: 'Service WhatsApp indisponible. Vérifiez la configuration ZeChat API.',
          error: healthError.message,
          details: 'Healthcheck a échoué - arrêt de la campagne pour éviter des échecs'
        });
      }
    }

    campaign.status = 'sending';
    campaign.stats.targeted = clients.length;
    campaign.results = [];
    await campaign.save();

    console.log(`🚀 Envoi campagne marketing "${campaign.name}" avec système anti-spam`);
    console.log(`   Clients ciblés: ${clients.length}`);
    console.log(`   Contacts préparés: ${counters.preparedContacts}`);
    console.log(`   Téléphones manquants: ${counters.missingPhone}`);
    console.log(`   Téléphones invalides: ${counters.invalidPhone}`);
    console.log(`   Risque spam: ${analysis.risk} (score: ${analysis.score})`);

    let sent = 0;
    let failed = 0;
    let messageCount = 0;
    
    // Configuration timing envoi WhatsApp
    const BATCH_SIZE = 5;            // Pause toutes les 5 messages envoyés avec succès
    const BATCH_PAUSE_MS = 5 * 60 * 1000; // 5 minutes entre chaque batch de 5
    const MSG_PAUSE_MS = 30000;      // 30 secondes entre chaque message

    const hasOrderFilters = campaign.targetFilters && (
      campaign.targetFilters.orderStatus ||
      campaign.targetFilters.orderCity ||
      campaign.targetFilters.orderAddress ||
      campaign.targetFilters.orderProduct ||
      campaign.targetFilters.orderDateFrom ||
      campaign.targetFilters.orderDateTo ||
      campaign.targetFilters.orderSourceId ||
      campaign.targetFilters.orderMinPrice ||
      campaign.targetFilters.orderMaxPrice
    );

    // 🆕 BOUCLE D'ENVOI DIRECTE SUR LES CLIENTS
    for (let ci = 0; ci < clients.length; ci++) {
      const client = clients[ci];
      // Utiliser les données de commande si disponibles
      const orderData = hasOrderFilters ? {
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        clientPhone: client.phone,
        city: client.city,
        address: client.address,
        product: client._orderProduct,
        price: client._orderPrice,
        quantity: client._orderQuantity,
        date: client._orderDate,
        status: client._orderStatus
      } : null;
      
      const message = renderMessage(campaign.messageTemplate, client, orderData);
      const cleanedPhone = (client.phone || client.phoneNumber || '').replace(/\D/g, '');
      
      if (!cleanedPhone || cleanedPhone.length < 8) {
        campaign.results.push({ 
          clientId: client._id, 
          clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Inconnu', 
          phone: client.phone || client.phoneNumber, 
          status: 'failed', 
          error: 'Numéro invalide' 
        });
        failed++;
        continue;
      }

      try {
        // 🆕 Validation anti-spam pour chaque message personnalisé
        const personalizedAnalysis = analyzeSpamRisk(message);
        const isPersonalizedValid = validateMessageBeforeSend(message, `client-${client._id || 'unknown'}`);
        
        if (!isPersonalizedValid) {
          campaign.results.push({ 
            clientId: client._id, 
            clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Inconnu', 
            phone: cleanedPhone, 
            status: 'failed', 
            error: 'Message personnalisé rejeté (spam)',
            spamRisk: personalizedAnalysis.risk,
            spamScore: personalizedAnalysis.score
          });
          failed++;
          continue;
        }

        // 🆕 Envoi avec système anti-spam + workspaceId pour le log + config WhatsApp
        const messageData = {
          to: cleanedPhone,
          message: message,
          campaignId: campaign._id,
          userId: client._id,
          firstName: client.firstName,
          workspaceId: req.workspaceId,
          whatsappConfig: { instanceId, apiKey, apiUrl, phoneNumber }
        };

        const result = await sendWhatsAppMessage(messageData);
        
        // sendWhatsAppMessage retourne { success: true, ... } en cas de succès
        campaign.results.push({ 
          clientId: client._id, 
          clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Inconnu', 
          phone: cleanedPhone,
          status: 'sent', 
          sentAt: new Date(),
          messageId: result.messageId,
          spamRisk: personalizedAnalysis.risk
        });
        sent++;
        messageCount++;
        
        // Mettre à jour le dernier contact si c'est un vrai client avec _id
        if (!hasOrderFilters && client._id) {
          try {
            const realClient = await Client.findById(client._id);
            if (realClient) {
              realClient.lastContactAt = new Date();
              if (!realClient.tags.includes('Relancé')) realClient.tags.push('Relancé');
              await realClient.save();
            }
          } catch (tagErr) {
            console.warn(`⚠️ Erreur mise à jour tag client ${client._id}:`, tagErr.message);
          }
        }
        
        console.log(`✅ [${messageCount}/${clients.length}] Message envoyé à ${client.firstName || 'Inconnu'} ${client.lastName || ''} (${cleanedPhone})`);
        
      } catch (err) {
        const clientName = `${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Inconnu';
        console.error(`❌ Échec envoi à ${clientName} (${cleanedPhone}): ${err.message}`);
        campaign.results.push({ 
          clientId: client._id, 
          clientName: clientName, 
          phone: cleanedPhone,
          status: 'failed', 
          error: err.message 
        });
        failed++;
      }

      // Timing: 30s entre chaque message, pause 5min après chaque batch de 5 envois réussis
      // Ne pas attendre après le dernier message
      if (ci < clients.length - 1) {
        if (messageCount > 0 && messageCount % BATCH_SIZE === 0) {
          console.log(`⏸️ Pause 5 minutes après ${messageCount} messages envoyés avec succès (batch de ${BATCH_SIZE})...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE_MS));
        } else {
          console.log(`⏳ Attente 30s avant prochain message...`);
          await new Promise(resolve => setTimeout(resolve, MSG_PAUSE_MS));
        }
      }
    }

    // 🆕 LOGS RÉSULTATS DÉTAILLÉS
    const results = campaign.results || [];
    const sentResults = results.filter(r => r.status === 'sent');
    const failedResults = results.filter(r => r.status === 'failed');
    const pendingResults = results.filter(r => r.status === 'pending');

    console.log('📈 RESULTS SUMMARY:', {
      total: results.length,
      sent: sentResults.length,
      failed: failedResults.length,
      pending: pendingResults.length,
      successRate: Math.round((sentResults.length / results.length) * 100) || 0
    });

    if (failedResults.length > 0) {
      console.log('❌ SAMPLE FAILED (first 5):', failedResults.slice(0,5).map(x => ({ 
        phone: x.phone, 
        error: x.error,
        clientName: x.clientName
      })));
    }

    if (pendingResults.length > 0) {
      console.log('⏸️ SAMPLE PENDING (first 5):', pendingResults.slice(0,5).map(x => ({ 
        phone: x.phone, 
        clientName: x.clientName
      })));
    }

    campaign.status = failed === clients.length ? 'failed' : 'sent';
    campaign.sentAt = new Date();
    campaign.stats.sent = sent;
    campaign.stats.failed = failed;
    campaign.spamValidation = {
      validated: true,
      riskLevel: analysis.risk,
      score: analysis.score,
      sentAt: new Date()
    };
    await campaign.save();

    const successRate = Math.round((sent / clients.length) * 100);
    console.log(`✅ Campagne marketing terminée: ${sent}/${clients.length} envoyés (${successRate}% succès)`);

    res.json({
      success: true,
      message: `Campagne envoyée avec protection anti-spam: ${sent} envoyés, ${failed} échoués sur ${clients.length} ciblés`,
      data: campaign,
      stats: {
        total: clients.length,
        sent,
        failed,
        successRate,
        spamRisk: analysis.risk,
        spamScore: analysis.score
      }
    });
  } catch (error) {
    console.error('Erreur send campaign:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/campaigns/:id - Supprimer une campagne
router.delete('/:id', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const campaign = await Campaign.findOneAndDelete({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campagne non trouvée' });
    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (error) {
    console.error('Erreur delete campaign:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// 🆕 POST /api/ecom/campaigns/preview-send - Envoyer un aperçu à une seule personne
router.post('/preview-send', requireEcomAuth, validateEcomAccess('products', 'write'), async (req, res) => {
  try {
    const { 
      messageTemplate, 
      clientId, 
      clientData,
      phoneNumber,
      firstName
    } = req.body;
    
    // ✅ Générer previewId unique
    const previewId = 'preview-' + Date.now();
    
    // Validation des champs requis
    if (!messageTemplate || !messageTemplate.trim()) {
      return res.status(400).json({ success: false, message: 'Le message template est requis' });
    }
    
    let client = null;
    
    // Si phoneNumber fourni (preview WhatsApp), créer un client minimal
    if (phoneNumber) {
      client = {
        phone: phoneNumber,
        phoneNumber: phoneNumber,
        firstName: firstName || null,
        lastName: null,
        name: firstName || null,
        _id: null
      };
    }
    // Si clientId fourni, récupérer le client depuis la base
    else if (clientId) {
      client = await Client.findOne({ _id: clientId, workspaceId: req.workspaceId });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client non trouvé' });
      }
    } 
    // Sinon, utiliser les données fournies
    else if (clientData) {
      client = clientData;
    } else {
      return res.status(400).json({ success: false, message: 'clientId, clientData ou phoneNumber requis' });
    }
    
    // Personnaliser le message
    const personalizedMessage = renderMessage(messageTemplate, client);
    
    // 🆕 VALIDATION ANTI-SPAM du message personnalisé
    const analysis = analyzeSpamRisk(personalizedMessage);
    const isValid = validateMessageBeforeSend(personalizedMessage, `preview-${client._id || 'manual'}`);
    
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Message rejeté pour risque de spam élevé',
        analysis: {
          risk: analysis.risk,
          score: analysis.score,
          warnings: analysis.warnings,
          recommendations: analysis.recommendations
        }
      });
    }
    
    // Nettoyer et valider le numéro
    const cleanedPhone = (client.phone || '').replace(/\D/g, '').trim();
    if (!cleanedPhone || cleanedPhone.length < 8) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone invalide' });
    }
    
    console.log(`📱 Envoi d\'aperçu marketing à ${client.firstName} ${client.lastName || ''} (${cleanedPhone})`);
    console.log(`   Message: "${personalizedMessage.substring(0, 50)}..."`);
    console.log(`   Risque spam: ${analysis.risk} (score: ${analysis.score})`);
    
    // Préparer les données pour l'envoi
    const messageData = {
      to: cleanedPhone,
      message: personalizedMessage,
      campaignId: null,
      previewId,
      userId: req.ecomUser._id || null,
      firstName: client.firstName || null,
      workspaceId: req.workspaceId
    };
    
    // Envoyer le message en utilisant le système anti-spam
    try {
      const result = await sendWhatsAppMessage(messageData);
      
      console.log(`✅ Message d\'aperçu marketing envoyé avec succès`);
      console.log(`   ID du message: ${result.messageId}`);
      console.log(`   ID du log: ${result.logId}`);
      
      res.json({
        success: true,
        message: 'Message d\'aperçu marketing envoyé avec succès',
        result: {
          messageId: result.messageId,
          logId: result.logId,
          phone: cleanedPhone,
          clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim(),
          sentAt: new Date(),
          personalizedMessage: personalizedMessage,
          spamAnalysis: {
            risk: analysis.risk,
            score: analysis.score,
            validated: true
          }
        }
      });
      
    } catch (error) {
      console.error(`❌ Erreur envoi aperçu marketing: ${error.message}`);
      
      // Gérer les erreurs spécifiques
      if (error.message.includes('HTTP_466')) {
        return res.status(429).json({ 
          success: false,
          message: 'Limite de débit atteinte - veuillez réessayer dans quelques minutes',
          type: 'rate_limit',
          retryAfter: 60
        });
      }
      
      if (error.message.includes('numéro invalide')) {
        return res.status(400).json({ 
          success: false,
          message: 'Numéro de téléphone invalide ou non enregistré sur WhatsApp',
          type: 'invalid_phone'
        });
      }
      
      res.status(500).json({ 
        success: false,
        message: 'Erreur lors de l\'envoi du message d\'aperçu',
        details: error.message
      });
    }
    
  } catch (error) {
    console.error('Erreur générale aperçu marketing:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de l\'envoi d\'aperçu',
      details: error.message
    });
  }
});

// 🆕 POST /api/ecom/campaigns/test-message - Tester un message sans l'envoyer
router.post('/test-message', requireEcomAuth, async (req, res) => {
  try {
    const { messageTemplate, clientData } = req.body;
    
    if (!messageTemplate || !messageTemplate.trim()) {
      return res.status(400).json({ success: false, message: 'Le message template est requis' });
    }
    
    // Si clientData fourni, personnaliser le message pour le test
    let testMessage = messageTemplate;
    if (clientData) {
      testMessage = renderMessage(messageTemplate, clientData);
    }
    
    // Analyse anti-spam complète
    const analysis = analyzeSpamRisk(testMessage);
    const isValid = validateMessageBeforeSend(testMessage, 'test-user');
    
    res.json({
      success: true,
      message: 'Message testé avec succès',
      analysis: {
        risk: analysis.risk,
        score: analysis.score,
        warnings: analysis.warnings,
        recommendations: analysis.recommendations,
        validated: isValid,
        length: testMessage.length,
        wordCount: testMessage.split(/\s+/).length
      },
      personalizedMessage: clientData ? testMessage : null,
      verdict: isValid ? '✅ Message safe pour envoi' : '❌ Message à risque - modifications recommandées'
    });
    
  } catch (error) {
    console.error('Erreur test message marketing:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erreur lors du test du message',
      details: error.message
    });
  }
});

export default router;
