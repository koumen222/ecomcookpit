import { processIncomingMessage, generateInitialMessage, generateRelanceMessage } from './agentService.js';
import AgentConversation from '../models/AgentConversation.js';
import AgentMessage from '../models/AgentMessage.js';
import mongoose from 'mongoose';

let whatsappConfig = null;

// Plus de cache anti-doublon - chatbot normal

const initAgentWhatsapp = () => {
  const greenApiId = process.env.GREEN_API_ID_INSTANCE;
  const greenApiToken = process.env.GREEN_API_TOKEN_INSTANCE;
  const greenApiUrl = process.env.GREEN_API_URL;

  if (greenApiId && greenApiToken) {
    whatsappConfig = {
      idInstance: greenApiId,
      apiTokenInstance: greenApiToken,
      apiUrl: greenApiUrl || `https://${greenApiId}.api.greenapi.com`
    };
    console.log('✅ Agent WhatsApp Service initialisé');
    return true;
  }

  console.warn('⚠️ Agent WhatsApp non configuré - variables GREEN_API manquantes');
  return false;
};

const sanitizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  return phone.replace(/\D/g, '');
};

const extractPhoneFromChatId = (chatId) => {
  if (!chatId) return null;
  return chatId.replace('@c.us', '').replace('@g.us', '');
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Supprimer tous les caractères non numériques
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Ajouter l'indicatif du Cameroun si nécessaire
  if (cleanPhone.length === 9 && cleanPhone.startsWith('6')) {
    cleanPhone = '237' + cleanPhone;
  }
  
  // Pour les tests, accepter n'importe quel format
  if (cleanPhone.length < 10) {
    cleanPhone = '237676778377'; // Numéro de test par défaut
  }
  
  return cleanPhone;
};

const normalizeChatId = (chatId) => {
  if (!chatId) return '237676778377@c.us';
  
  // Si déjà au format @c.us
  if (chatId.includes('@c.us')) {
    return chatId;
  }
  
  // Extraire le numéro et reformater
  const phone = chatId.replace(/\D/g, '');
  const normalizedPhone = normalizePhoneNumber(phone);
  return normalizedPhone ? `${normalizedPhone}@c.us` : '237691234567@c.us';
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendWhatsAppMessage = async (chatId, message) => {
  if (!whatsappConfig) {
    console.log('🔧 Initialisation WhatsApp...');
    initAgentWhatsapp();
  }

  if (!whatsappConfig) {
    throw new Error('WhatsApp non configuré');
  }

  console.log('📤 Envoi WhatsApp:', { chatId, messageLength: message?.length });

  try {
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    const endpoint = `${whatsappConfig.apiUrl}/waInstance${whatsappConfig.idInstance}/sendMessage/${whatsappConfig.apiTokenInstance}`;
    console.log('🔗 Endpoint:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: chatId,
        message: message
      })
    });

    const data = await response.json();
    console.log('📥 Réponse Green API:', data);

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    if (data.idMessage) {
      console.log(`✅ Message envoyé: ${data.idMessage}`);
      return {
        success: true,
        messageId: data.idMessage,
        timestamp: data.timestamp
      };
    }

    throw new Error('Pas de messageId dans la réponse');
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error.message);
    throw error;
  }
};

const updateMessageDeliveryStatus = async (messageId, status, whatsappMessageId = null) => {
  try {
    const update = { deliveryStatus: status };
    if (whatsappMessageId) {
      update.whatsappMessageId = whatsappMessageId;
    }

    await AgentMessage.findByIdAndUpdate(messageId, update);
  } catch (error) {
    console.error('❌ Erreur mise à jour statut message:', error.message);
  }
};

const sendAgentMessage = async (conversation, messageContent) => {
  try {
    const result = await sendWhatsAppMessage(conversation.whatsappChatId, messageContent);

    if (result.success) {
      const lastMessage = await AgentMessage.findOne({
        conversationId: conversation._id,
        direction: 'outbound',
        deliveryStatus: 'pending'
      }).sort({ createdAt: -1 });

      if (lastMessage) {
        await updateMessageDeliveryStatus(lastMessage._id, 'sent', result.messageId);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Erreur envoi message agent:', error.message);
    throw error;
  }
};

const sendInitialMessageForOrder = async (conversation) => {
  try {
    const { message, content } = await generateInitialMessage(conversation);

    await sleep(2000);

    const result = await sendWhatsAppMessage(conversation.whatsappChatId, content);

    if (result.success) {
      await updateMessageDeliveryStatus(message._id, 'sent', result.messageId);
    }

    return {
      success: result.success,
      messageId: result.messageId,
      content
    };
  } catch (error) {
    console.error('❌ Erreur envoi message initial:', error.message);
    throw error;
  }
};

const sendRelanceMessage = async (conversation) => {
  try {
    const { message, content, relanceNumber } = await generateRelanceMessage(conversation);

    await sleep(2000);

    const result = await sendWhatsAppMessage(conversation.whatsappChatId, content);

    if (result.success) {
      await updateMessageDeliveryStatus(message._id, 'sent', result.messageId);
    }

    return {
      success: result.success,
      messageId: result.messageId,
      content,
      relanceNumber
    };
  } catch (error) {
    console.error('❌ Erreur envoi relance:', error.message);
    throw error;
  }
};

const handleIncomingWebhook = async (webhookData) => {
  console.log('🚨 ===================== WEBHOOK REÇU - DÉBUT ANALYSE =====================');
  console.log('📥 Données webhook brutes:', JSON.stringify(webhookData, null, 2));
  
  try {
    const message = webhookData.payload || webhookData;
    const webhookType = webhookData.typeWebhook;
    
    console.log('🔍 Type webhook:', webhookType);
    console.log('📦 Message extrait:', JSON.stringify(message, null, 2));
    
    // **FILTRAGE PRÉLIMINAIRE: Ignorer les webhooks de statut sans logs**
    if (webhookType && !webhookType.includes('incomingMessageReceived')) {
      console.log('⏭️ Webhook de statut ignoré (type:', webhookType, ')');
      return { success: true, message: 'Webhook de statut ignoré silencieusement' };
    }
    
    // Vérifier qu'il y a un contenu textuel AVANT d'afficher les logs
    // Green API format: messageData.textMessageData.textMessage
    // Extended text: messageData.extendedTextMessageData.text
    const messageData = webhookData.messageData || {};
    const messageContent = 
      messageData?.textMessageData?.textMessage ||
      messageData?.extendedTextMessageData?.text ||
      message.textMessage || 
      message.content || '';
    
    console.log('📝 Contenu message détecté:', messageContent);
    
    if (!messageContent || messageContent.trim() === '') {
      console.log('⏭️ Message sans texte ignoré');
      return { success: true, message: 'Message sans texte ignoré silencieusement' };
    }
    
    console.log('✅ Message texte valide, poursuite du traitement...');
    
    let chatId = message.senderData?.chatId;
    const messageId = message.idMessage || 'msg_' + Date.now();
    const senderName = message.senderData?.senderName || message.senderData?.chatName || 'Client';
    const rawSender = message.senderData?.sender || (chatId ? chatId : 'inconnu');
    const senderPhone = rawSender.replace('@c.us', '').replace('@g.us', '');
    
    // Si pas de chatId, ignorer le message (on ne peut pas répondre)
    if (!chatId) {
      console.log('⏭️ Message sans chatId ignoré');
      return { success: true, message: 'Message sans chatId ignoré' };
    }
    
    console.log('📱 ChatId extrait:', chatId);
    console.log('👤 Nom client:', senderName);
    console.log('📞 Téléphone:', senderPhone);
    console.log('🆔 Message ID:', messageId);
    console.log('📝 Contenu message:', messageContent);
    
    // **🔥 LOGS POUR DÉBOGAGE NUMÉROS**
    console.log('🔍 ==================== DÉTAILS NUMÉROS ====================');
    console.log('📱 Instance WhatsApp (wid):', webhookData.instanceData?.wid || 'non défini');
    console.log('👤 Client chatId:', chatId);
    console.log('📞 Client sender:', message.senderData?.sender || 'non défini');
    console.log('📞 Client phone nettoyé:', senderPhone);
    console.log('🔗 Numéro utilisé pour répondre:', chatId);
    console.log('🔍 =========================================================');
    
    // **🔥 LOG SPÉCIAL : Message client reçu**
    console.log('🎯 ===================== MESSAGE CLIENT REÇU =====================');
    console.log('📨 NOUVEAU MESSAGE DE CLIENT DÉTECTÉ !');
    console.log('👤 Client:', senderName, '(', senderPhone, ')');
    console.log('💬 Message:', messageContent);
    console.log('📱 ChatId:', chatId);
    console.log('⏰ Heure:', new Date().toLocaleString());
    console.log('🎯 =========================================================');
    
    // Ignorer les messages sortants
    if (message.fromMe) {
      console.log('⏭️ Message sortant ignoré');
      return { success: true, message: 'Message sortant ignoré' };
    }
    
    // Ignorer les groupes
    if (chatId.includes('@g.us')) {
      console.log('👥 Message de groupe ignoré');
      return { success: true, message: 'Message de groupe ignoré' };
    }
    
    chatId = normalizeChatId(chatId);
    console.log('📞 ChatId normalisé:', chatId);
    
    // **🔥 NOUVEAU: Chercher TOUTES les conversations (actives ET inactives)**
    let conversation = await AgentConversation.findOne({ 
      whatsappChatId: chatId 
    });
    
    if (!conversation) {
      console.log('🆕 AUCUNE CONVERSATION TROUVÉE - CRÉATION AUTOMATIQUE POUR NOUVEAU CLIENT');
      
      // Créer une nouvelle conversation sans commande associée
      const newConversation = new AgentConversation({
        workspaceId: '69870da96590f43912bf4ca2',
        clientName: senderName,
        clientPhone: senderPhone,
        whatsappChatId: chatId,
        productName: 'Produit par défaut',
        productPrice: 0,
        state: 'pending_confirmation',
        confidenceScore: 50,
        relanceCount: 0,
        active: true,
        processedMessageIds: [],
        metadata: {
          source: 'direct_whatsapp',
          firstMessage: messageContent,
          createdAt: new Date()
        }
      });
      
      await newConversation.save();
      console.log('✅ Nouvelle conversation créée pour nouveau client:', newConversation._id);
      
      // Recharger depuis la base pour avoir les méthodes Mongoose
      conversation = await AgentConversation.findById(newConversation._id);
    } else {
      console.log('📋 Conversation existante trouvée:', conversation._id);
      console.log('📊 État actuel:', conversation.state);
      
      // Réactiver la conversation si elle était inactive
      if (!conversation.active) {
        conversation.active = true;
        await conversation.save();
        console.log('🔄 Conversation réactivée');
      }
    }
    
    console.log('🤖 ==================== PROCESSING MESSAGE ====================');
    const result = await processIncomingMessage(conversation, messageContent, messageId);
    
    if (!result) {
      console.log('⚠️ Aucun résultat du traitement');
      return { success: true, message: 'Aucun traitement nécessaire' };
    }
    
    console.log('📤 Résultat traitement:', {
      hasResult: !!result,
      shouldSend: result?.shouldSendResponse,
      hasAgentResponse: !!result?.agentResponse,
      contentLength: result?.agentResponse?.content?.length
    });
    
    // Envoyer la réponse si nécessaire
    if (result && result.shouldSendResponse && result.agentResponse) {
      console.log('🚀 ==================== ENVOI RÉPONSE ====================');
      console.log('📤 Réponse à envoyer:', result.agentResponse.content);
      
      await sleep(2000 + Math.random() * 3000); // Délai humain

      console.log('📤 ==================== ENVOI RÉPONSE ====================');
      console.log('📤 Réponse à envoyer:', result.agentResponse.content);
      console.log('📱 Numéro de destination (conversation.whatsappChatId):', conversation.whatsappChatId);
      console.log('📞 Numéro du client qui a envoyé le message:', chatId);
      console.log('📱 Instance WhatsApp:', webhookData.instanceData?.wid || 'non défini');
      
      const sendResult = await sendWhatsAppMessage(
        conversation.whatsappChatId,
        result.agentResponse.content
      );

      if (sendResult.success) {
        console.log('✅ Message WhatsApp envoyé avec succès:', sendResult.messageId);
        await updateMessageDeliveryStatus(
          result.agentResponse._id,
          'sent',
          sendResult.messageId
        );
      } else {
        console.error('❌ Échec envoi WhatsApp:', sendResult.error);
      }

      console.log('🎉 ==================== WEBHOOK TERMINÉ ====================');
      return {
        processed: true,
        conversationId: conversation._id,
        state: result.conversationState,
        confidenceScore: result.confidenceScore,
        responseSent: sendResult?.success || false,
        whatsappMessageId: sendResult?.messageId,
        isNewClient: !conversation.orderId // Indiquer si c'est un nouveau client
      };
    }

    console.log('⚠️ Aucune réponse générée');
    return {
      processed: true,
      conversationId: conversation._id,
      state: result?.conversationState,
      confidenceScore: result?.confidenceScore,
      responseSent: false,
      reason: conversation.active ? 'Pas de réponse générée' : 'Conversation terminée',
      isNewClient: !conversation.orderId
    };
  } catch (error) {
    console.error('❌ ==================== ERREUR WEBHOOK ====================');
    console.error('❌ Message:', error.message);
    console.error('❌ Stack:', error.stack);
    return { success: false, error: error.message };
  }
};

const handleStatusUpdate = async (webhookData) => {
  const status = webhookData.status;
  const messageId = webhookData.idMessage;

  if (!messageId) return { processed: false };

  const statusMap = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed'
  };

  const newStatus = statusMap[status];
  if (!newStatus) return { processed: false };

  try {
    await AgentMessage.findOneAndUpdate(
      { whatsappMessageId: messageId },
      { deliveryStatus: newStatus }
    );
    return { processed: true, status: newStatus };
  } catch (error) {
    return { processed: false, error: error.message };
  }
};

const findConversationByPhone = async (phone) => {
  const cleanedPhone = sanitizePhoneNumber(phone);
  if (!cleanedPhone) return null;

  const chatId = `${cleanedPhone}@c.us`;
  
  return AgentConversation.findOne({
    $or: [
      { whatsappChatId: chatId },
      { clientPhone: cleanedPhone }
    ],
    active: true
  });
};

export {
  initAgentWhatsapp,
  sendWhatsAppMessage,
  sendAgentMessage,
  sendInitialMessageForOrder,
  sendRelanceMessage,
  findConversationByPhone,
  normalizePhoneNumber,
  extractPhoneFromChatId,
  updateMessageDeliveryStatus,
  handleIncomingWebhook
};
