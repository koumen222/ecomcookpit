import express from 'express';
import mongoose from 'mongoose';
import AgentConversation from '../models/AgentConversation.js';
import AgentMessage from '../models/AgentMessage.js';
import ProductConfig from '../models/ProductConfig.js';
import Order from '../models/Order.js';
import {
  sendInitialMessageForOrder,
  sendRelanceMessage,
  initAgentWhatsapp
} from '../services/agentWhatsappService.js';
import { handleIncomingMessage, initWhatsApp } from '../services/simpleWhatsappService.js';

const router = express.Router();

router.post('/webhook', async (req, res) => {
  // Répondre IMMÉDIATEMENT à Green API pour éviter les timeouts et retries
  console.log('🔔 Webhook Agent reçu');
  
  // **🔥 LOGS CRITIQUES : Instance réelle et expéditeur réel**
  console.log('🔍 ==================== WEBHOOK RÉEL REÇU ====================');
  console.log('📱 Instance réelle:', req.body.instanceData?.wid || 'non défini');
  console.log('👤 Expéditeur réel:', req.body.senderData?.sender || 'non défini');
  console.log('💬 ChatId réel:', req.body.senderData?.chatId || 'non défini');
  console.log('📨 Type webhook:', req.body.typeWebhook || 'non défini');
  console.log('🆔 Message ID:', req.body.idMessage || 'non défini');
  console.log('⏰ Timestamp:', req.body.timestamp || 'non défini');
  console.log('🔍 =========================================================');
  
  res.status(200).json({ success: true, message: 'Webhook reçu' });
  
  // Traiter le webhook avec le service simple (après la réponse)
  try {
    const result = await handleIncomingMessage(req.body);
    console.log('✅ Webhook traité:', result?.processed ? 'message traité' : 'ignoré');
  } catch (error) {
    console.error('❌ Erreur webhook agent (async):', error.message);
  }
});

router.post('/conversations/start/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const workspaceId = req.user?.workspaceId || req.body.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    if (!order.clientPhone) {
      return res.status(400).json({ error: 'Numéro de téléphone client manquant' });
    }

    const conversation = await createConversationForOrder(order, workspaceId);

    const sendResult = await sendInitialMessageForOrder(conversation);

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        state: conversation.state,
        clientPhone: conversation.clientPhone,
        whatsappChatId: conversation.whatsappChatId
      },
      messageSent: sendResult.success,
      messageId: sendResult.messageId
    });
  } catch (error) {
    console.error(' Erreur démarrage conversation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/test', async (req, res) => {
  try {
    const { workspaceId, orderId, clientPhone, clientName, product } = req.body;
    
    if (!workspaceId || !clientPhone || !clientName) {
      return res.status(400).json({ success: false, message: 'workspaceId, clientPhone et clientName requis' });
    }
    
    // Créer une fausse commande pour le test
    const mockOrder = {
      _id: new mongoose.Types.ObjectId(),
      orderId: orderId || 'TEST_' + Date.now(),
      workspaceId,
      clientName,
      clientPhone,
      product: product || 'Montre Connectée Pro',
      price: 25000,
      status: 'pending',
      address: 'Adresse de test'
    };
    
    // Vérifier si une conversation existe déjà
    const AgentConversation = mongoose.model('AgentConversation');
    const existingConversation = await AgentConversation.findOne({ 
      orderId: mockOrder._id, 
      workspaceId 
    });
    
    if (existingConversation) {
      return res.status(400).json({ 
        success: false, 
        message: 'Conversation déjà existante pour ce test' 
      });
    }
    
    // Créer la conversation
    const conversation = await createConversationForOrder(mockOrder, workspaceId);
    
    // Envoyer le message initial
    const message = await sendInitialMessageForOrder(conversation);
    
    res.json({ 
      success: true, 
      conversation,
      initialMessage: message 
    });
    
  } catch (error) {
    console.error(' Erreur création conversation test:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId;
    const { state, active, page = 1, limit = 20 } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const query = { workspaceId };
    
    if (state) query.state = state;
    if (active !== undefined) query.active = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [conversations, total] = await Promise.all([
      AgentConversation.find(query)
        .sort({ lastInteractionAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('orderId', 'orderId product price status')
        .lean(),
      AgentConversation.countDocuments(query)
    ]);

    res.json({
      conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Erreur liste conversations:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await AgentConversation.findById(req.params.id)
      .populate('orderId')
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    const messages = await AgentMessage.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      conversation,
      messages
    });
  } catch (error) {
    console.error('❌ Erreur détail conversation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/close', async (req, res) => {
  try {
    const { state, reason } = req.body;
    
    const validStates = ['confirmed', 'cancelled', 'escalated', 'completed'];
    if (!validStates.includes(state)) {
      return res.status(400).json({ error: 'État invalide' });
    }

    const conversation = await AgentConversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    conversation.state = state;
    conversation.active = false;

    if (state === 'confirmed') conversation.confirmedAt = new Date();
    if (state === 'cancelled') conversation.cancelledAt = new Date();
    if (state === 'escalated') {
      conversation.escalatedAt = new Date();
      conversation.escalationReason = reason || 'Escalade manuelle';
    }

    await conversation.save();

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('❌ Erreur fermeture conversation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/conversations/:id/relance', async (req, res) => {
  try {
    const conversation = await AgentConversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation non trouvée' });
    }

    if (!conversation.active) {
      return res.status(400).json({ error: 'Conversation inactive' });
    }

    if (conversation.relanceCount >= 3) {
      return res.status(400).json({ error: 'Nombre max de relances atteint' });
    }

    const result = await sendRelanceMessage(conversation);

    res.json({
      success: result.success,
      relanceNumber: result.relanceNumber,
      messageId: result.messageId
    });
  } catch (error) {
    console.error('❌ Erreur relance manuelle:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId;
    const { dateFrom, dateTo } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const stats = await getConversationStats(workspaceId, dateFrom, dateTo);

    res.json(stats);
  } catch (error) {
    console.error('❌ Erreur stats agent:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/product-configs', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const configs = await ProductConfig.find({ workspaceId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(configs);
  } catch (error) {
    console.error('❌ Erreur liste configs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/product-configs', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId || req.body.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId requis' });
    }

    const configData = {
      ...req.body,
      workspaceId
    };

    const config = new ProductConfig(configData);
    await config.save();

    res.status(201).json(config);
  } catch (error) {
    console.error('❌ Erreur création config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.put('/product-configs/:id', async (req, res) => {
  try {
    const config = await ProductConfig.findByIdAndUpdate(
      req.params.id,
      { ...req.body, 'metadata.lastUpdatedBy': req.user?._id },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({ error: 'Configuration non trouvée' });
    }

    res.json(config);
  } catch (error) {
    console.error('❌ Erreur mise à jour config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/product-configs/:id', async (req, res) => {
  try {
    const config = await ProductConfig.findByIdAndDelete(req.params.id);

    if (!config) {
      return res.status(404).json({ error: 'Configuration non trouvée' });
    }

    res.json({ success: true, message: 'Configuration supprimée' });
  } catch (error) {
    console.error('❌ Erreur suppression config:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/relance/run', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId || req.body.workspaceId;

    const conversations = await getConversationsNeedingRelance(workspaceId);

    const results = [];
    for (const conv of conversations) {
      try {
        const result = await sendRelanceMessage(conv);
        results.push({
          conversationId: conv._id,
          success: result.success,
          relanceNumber: result.relanceNumber
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        results.push({
          conversationId: conv._id,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      processed: results.length,
      results
    });
  } catch (error) {
    console.error('❌ Erreur exécution relances:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/cleanup/stale', async (req, res) => {
  try {
    const workspaceId = req.user?.workspaceId || req.body.workspaceId;

    const deactivatedCount = await deactivateStaleConversations(workspaceId);

    res.json({
      success: true,
      deactivatedCount
    });
  } catch (error) {
    console.error('❌ Erreur nettoyage conversations:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', (req, res) => {
  const whatsappReady = initAgentWhatsapp();
  const openaiReady = !!process.env.OPENAI_API_KEY;

  res.json({
    status: whatsappReady && openaiReady ? 'healthy' : 'degraded',
    services: {
      whatsapp: whatsappReady ? 'ok' : 'not_configured',
      openai: openaiReady ? 'ok' : 'not_configured'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
