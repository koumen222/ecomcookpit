import express from 'express';
import { createConversationForOrder, generateInitialMessage } from '../services/agentService.js';
import { sendWhatsAppMessage } from '../services/agentWhatsappService.js';
import Order from '../models/Order.js';
import AgentConversation from '../models/AgentConversation.js';

const router = express.Router();

/**
 * Route pour créer une nouvelle commande et démarrer la conversation automatiquement
 * POST /api/ecom/agent/commands/new
 */
router.post('/new', async (req, res) => {
  console.log('🆕 ==================== NOUVELLE COMMANDE ====================');
  console.log('📋 Données reçues:', req.body);
  
  try {
    const { 
      clientName, 
      clientPhone, 
      product, 
      price, 
      workspaceId = '69870da96590f43912bf4ca2'  // Default workspace
    } = req.body;

    // Validation des données
    if (!clientName || !clientPhone || !product) {
      console.log('❌ Données manquantes:', { clientName, clientPhone, product });
      return res.status(400).json({
        success: false,
        error: 'Nom client, téléphone et produit requis'
      });
    }

    console.log('✅ Validation OK, création de la commande...');

    // Créer une nouvelle commande
    const newOrder = new Order({
      workspaceId,
      orderId: `CMD-${Date.now()}`,
      clientName,
      clientPhone,
      product,
      price: price || 25000,
      status: 'pending',
      source: 'manual',  // Corrigé: 'manual' est une valeur valide
      deliveryAddress: 'À définir',
      createdAt: new Date()
    });

    await newOrder.save();
    console.log(' Commande créée:', newOrder._id);

    // Créer la conversation agent pour cette commande
    const conversation = await createConversationForOrder(newOrder, workspaceId);
    console.log(' Conversation créée:', conversation._id);
    console.log(' WhatsApp ChatId:', conversation.whatsappChatId);
    
    // Générer et envoyer le message initial
    console.log(' Génération message initial...');
    const initialMessageData = await generateInitialMessage(conversation);
    
    console.log(' Envoi message initial via WhatsApp...');
    console.log(' ChatId utilisé:', conversation.whatsappChatId);
    
    // Utiliser sendWhatsAppMessage directement au lieu de sendAgentMessage
    const sendResult = await sendWhatsAppMessage(
      conversation.whatsappChatId,
      initialMessageData.content
    );

    if (sendResult.success) {
      console.log(' Message initial envoyé avec succès:', sendResult.messageId);
      console.log(' Message initial envoyé avec succès:', sendResult.messageId);
      console.log('✅ Message initial envoyé avec succès:', sendResult.messageId);
      
      // Mettre à jour le statut de livraison du message
      initialMessageData.message.deliveryStatus = 'sent';
      initialMessageData.message.whatsappMessageId = sendResult.messageId;
      await initialMessageData.message.save();
    } else {
      console.error('❌ Échec envoi message initial:', sendResult.error);
    }

    console.log('🎉 ==================== COMMANDE TERMINÉE ====================');

    res.json({
      success: true,
      data: {
        orderId: newOrder._id,
        conversationId: conversation._id,
        clientPhone: conversation.whatsappChatId,
        initialMessage: initialMessageData.content,
        messageSent: sendResult.success,
        whatsappMessageId: sendResult.messageId
      }
    });

  } catch (error) {
    console.error('❌ ==================== ERREUR COMMANDE ====================');
    console.error('❌ Message:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route pour lister toutes les conversations actives
 * GET /api/ecom/agent/commands/active
 */
router.get('/active', async (req, res) => {
  try {
    const activeConversations = await AgentConversation.find({ 
      active: true 
    })
    .populate('orderId')
    .sort({ createdAt: -1 })
    .limit(50);

    console.log(`📋 ${activeConversations.length} conversation(s) active(s) trouvée(s)`);

    res.json({
      success: true,
      count: activeConversations.length,
      conversations: activeConversations
    });

  } catch (error) {
    console.error('❌ Erreur liste conversations actives:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route pour obtenir le statut d'une conversation
 * GET /api/ecom/agent/commands/status/:conversationId
 */
router.get('/status/:conversationId', async (req, res) => {
  try {
    const conversation = await AgentConversation.findById(req.params.conversationId)
      .populate('orderId');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation non trouvée'
      });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        clientName: conversation.clientName,
        clientPhone: conversation.clientPhone,
        product: conversation.product,
        state: conversation.state,
        confidenceScore: conversation.confidenceScore,
        relanceCount: conversation.relanceCount,
        active: conversation.active,
        createdAt: conversation.createdAt,
        lastInteractionAt: conversation.lastInteractionAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur statut conversation:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
