import express from 'express';
import Order from '../models/Order.js';
import OrderSource from '../models/OrderSource.js';
import { notifyNewOrder } from '../services/notificationHelper.js';
import { normalizeCity } from '../utils/cityNormalizer.js';

const router = express.Router();

// Fonction pour normaliser les données de commande
function normalizeOrderData(rawData, sourceConfig) {
  const data = {};
  
  // Mapping des colonnes selon la configuration de la source
  const mapping = sourceConfig.columnMapping || {};
  
  for (const [field, columnName] of Object.entries(mapping)) {
    if (columnName && rawData[columnName] !== undefined) {
      data[field] = rawData[columnName];
    }
  }
  
  return data;
}

// Fonction pour nettoyer le numéro de téléphone
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Supprimer le préfixe 00
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Ajouter l'indicatif pays si manquant (235 pour le Tchad par défaut)
  if (cleaned.length === 8 && !cleaned.startsWith('235')) {
    cleaned = '235' + cleaned;
  }
  
  return cleaned;
}

/**
 * POST /api/ecom/webhooks/google-sheets/:sourceId
 * Webhook pour recevoir les nouvelles commandes depuis Google Sheets
 * 
 * Le script Google Apps Script doit envoyer :
 * {
 *   "sourceId": "id_de_la_source",
 *   "secretKey": "clé_secrète_configurée",
 *   "order": {
 *     "Order ID": "...",
 *     "Full Name": "...",
 *     "Phone": "...",
 *     "Product Name": "...",
 *     "Total Price": "...",
 *     "Date & Time": "...",
 *     ...
 *   }
 * }
 */
router.post('/google-sheets/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { secretKey, order: rawOrder } = req.body;
    
    console.log(`📥 [WEBHOOK] Nouvelle commande reçue pour source ${sourceId}`);
    
    // Récupérer la source
    const source = await OrderSource.findById(sourceId);
    if (!source) {
      console.error(`❌ [WEBHOOK] Source ${sourceId} introuvable`);
      return res.status(404).json({ success: false, message: 'Source introuvable' });
    }
    
    // Vérifier la clé secrète
    if (source.webhookSecret && source.webhookSecret !== secretKey) {
      console.error(`❌ [WEBHOOK] Clé secrète invalide pour source ${sourceId}`);
      return res.status(401).json({ success: false, message: 'Clé secrète invalide' });
    }
    
    // Normaliser les données de commande
    const orderData = normalizeOrderData(rawOrder, source);
    
    // Extraire les champs principaux
    const orderId = orderData.orderId || rawOrder['Order ID'] || rawOrder['Numéro de commande'];
    const clientName = orderData.clientName || rawOrder['Full Name'] || rawOrder['Nom complet'] || rawOrder['Last Name'];
    const clientPhone = cleanPhoneNumber(orderData.clientPhone || rawOrder['Phone'] || rawOrder['Téléphone']);
    const product = orderData.product || rawOrder['Product Name'] || rawOrder['Produit commandé'];
    const city = normalizeCity(orderData.city || rawOrder['City'] || rawOrder['Ville'] || '');
    const address = orderData.address || rawOrder['Address 1'] || rawOrder['Adresse'] || '';
    const price = parseFloat(orderData.price || rawOrder['Total Price'] || rawOrder['Prix total'] || 0);
    const quantity = parseInt(orderData.quantity || rawOrder['Product Quantity'] || rawOrder['Quantite'] || 1);
    const status = orderData.status || rawOrder['Statut commande'] || 'pending';
    const dateStr = orderData.date || rawOrder['Date & Time'] || rawOrder['Date de création'] || new Date().toISOString();
    
    // Validation des champs requis
    if (!clientPhone) {
      console.warn(`⚠️ [WEBHOOK] Commande sans numéro de téléphone ignorée`);
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });
    }
    
    // Vérifier si la commande existe déjà
    let existingOrder = null;
    if (orderId) {
      existingOrder = await Order.findOne({ 
        orderId, 
        sourceId: source._id,
        workspaceId: source.workspaceId 
      });
    }
    
    if (existingOrder) {
      console.log(`ℹ️ [WEBHOOK] Commande ${orderId} existe déjà, mise à jour ignorée`);
      return res.json({ success: true, message: 'Commande déjà existante', orderId });
    }
    
    // Créer la nouvelle commande
    const newOrder = new Order({
      workspaceId: source.workspaceId,
      sourceId: source._id,
      sourceName: source.name,
      orderId,
      clientName,
      clientPhone,
      phoneNormalized: clientPhone,
      product,
      city,
      address,
      price,
      quantity,
      status,
      date: new Date(dateStr),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await newOrder.save();
    console.log(`✅ [WEBHOOK] Nouvelle commande créée: ${orderId} - ${clientName}`);
    
    // 📱 Envoyer les notifications
    try {
      await notifyNewOrder(
        source.workspaceId,
        newOrder._id,
        clientName,
        clientPhone,
        product,
        city,
        price
      );
      console.log(`📬 [WEBHOOK] Notifications envoyées pour commande ${orderId}`);
    } catch (notifError) {
      console.error(`❌ [WEBHOOK] Erreur envoi notifications:`, notifError);
    }
    
    res.json({ 
      success: true, 
      message: 'Commande créée avec succès',
      orderId: newOrder._id,
      orderNumber: orderId
    });
    
  } catch (error) {
    console.error(`❌ [WEBHOOK] Erreur traitement webhook:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/ecom/webhooks/test
 * Route de test pour vérifier que le webhook fonctionne
 */
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/ecom/webhooks/shopify/generate-token
 * Génère ou récupère le token webhook Shopify unique pour le workspace courant
 */
router.post('/shopify/generate-token', async (req, res) => {
  try {
    const { default: crypto } = await import('crypto');
    const { default: Workspace } = await import('../models/Workspace.js');

    // ecomApi envoie workspaceId dans le body
    const workspaceId = req.body?.workspaceId || req.workspaceId || req.headers['x-workspace-id'];
    if (!workspaceId) {
      console.error('❌ [Shopify WH] workspaceId manquant dans la requête');
      return res.status(400).json({ success: false, message: 'Workspace ID manquant' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace introuvable' });
    }

    // Générer un token s'il n'existe pas encore
    if (!workspace.shopifyWebhookToken) {
      workspace.shopifyWebhookToken = crypto.randomBytes(20).toString('hex');
      await workspace.save();
      console.log(`🔑 [Shopify WH] Token généré pour workspace ${workspace.name}`);
    }

    res.json({
      success: true,
      data: {
        webhookToken: workspace.shopifyWebhookToken,
        webhookUrl: `https://api.scalor.net/api/webhooks/shopify/orders/${workspace.shopifyWebhookToken}`
      }
    });
  } catch (err) {
    console.error('❌ [Shopify WH] Erreur generate-token:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
