import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import { formatInternationalPhone } from '../utils/phoneUtils.js';
import { generateInitialMessage, generateRelanceMessage } from './agentService.js';

let agentWhatsappConfigured = false;

const initAgentWhatsapp = () => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  agentWhatsappConfigured = hasApiKey;
  return agentWhatsappConfigured;
};

const getActiveInstanceForWorkspace = async (workspaceId) => {
  try {
    const instance = await WhatsAppInstance.findOne({
      workspaceId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).sort({ lastSeen: -1 });

    if (!instance) {
      console.warn(`⚠️ Aucune instance WhatsApp active pour workspace ${workspaceId}`);
      return null;
    }

    return instance;
  } catch (error) {
    console.error('❌ Erreur récupération instance WhatsApp:', error);
    return null;
  }
};

const sendWhatsAppMessage = async (chatId, messageContent, workspaceId = null) => {
  try {
    if (!chatId || !messageContent) {
      throw new Error('chatId et messageContent requis');
    }

    let instance = null;

    if (workspaceId) {
      instance = await getActiveInstanceForWorkspace(workspaceId);
    }

    if (!instance) {
      throw new Error('Aucune instance WhatsApp connectée disponible');
    }

    console.log(`📱 Envoi message agent via instance ${instance.instanceName} à ${chatId}`);

    const result = await evolutionApiService.sendMessage(
      instance.instanceName,
      instance.instanceToken,
      chatId,
      messageContent
    );

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'envoi du message');
    }

    instance.lastSeen = new Date();
    await instance.save();

    console.log(`✅ Message agent envoyé avec succès à ${chatId}`);

    return {
      success: true,
      messageId: result.data?.key?.id || 'unknown',
      logId: result.data?.messageId || 'unknown'
    };

  } catch (error) {
    console.error('❌ Erreur sendWhatsAppMessage agent:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendInitialMessageForOrder = async (conversation) => {
  try {
    console.log(`📤 Envoi message initial pour conversation ${conversation._id}`);

    const messageData = await generateInitialMessage(conversation);

    const sendResult = await sendWhatsAppMessage(
      conversation.whatsappChatId,
      messageData.content,
      conversation.workspaceId
    );

    if (sendResult.success) {
      messageData.message.deliveryStatus = 'sent';
      messageData.message.whatsappMessageId = sendResult.messageId;
      await messageData.message.save();

      console.log(`✅ Message initial envoyé: ${sendResult.messageId}`);
    } else {
      messageData.message.deliveryStatus = 'failed';
      await messageData.message.save();
      console.error(`❌ Échec envoi message initial: ${sendResult.error}`);
    }

    return sendResult;

  } catch (error) {
    console.error('❌ Erreur sendInitialMessageForOrder:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendRelanceMessage = async (conversation) => {
  try {
    console.log(`📤 Envoi relance pour conversation ${conversation._id}`);

    const messageData = await generateRelanceMessage(conversation);

    const sendResult = await sendWhatsAppMessage(
      conversation.whatsappChatId,
      messageData.content,
      conversation.workspaceId
    );

    if (sendResult.success) {
      messageData.message.deliveryStatus = 'sent';
      messageData.message.whatsappMessageId = sendResult.messageId;
      await messageData.message.save();

      console.log(`✅ Relance ${messageData.relanceNumber} envoyée: ${sendResult.messageId}`);
    } else {
      messageData.message.deliveryStatus = 'failed';
      await messageData.message.save();
      console.error(`❌ Échec envoi relance: ${sendResult.error}`);
    }

    return {
      success: sendResult.success,
      messageId: sendResult.messageId,
      relanceNumber: messageData.relanceNumber,
      error: sendResult.error
    };

  } catch (error) {
    console.error('❌ Erreur sendRelanceMessage:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

const sendAgentResponse = async (conversation, agentMessage) => {
  try {
    if (!agentMessage || !agentMessage.content) {
      throw new Error('Message agent vide');
    }

    console.log(`📤 Envoi réponse agent pour conversation ${conversation._id}`);

    const sendResult = await sendWhatsAppMessage(
      conversation.whatsappChatId,
      agentMessage.content,
      conversation.workspaceId
    );

    if (sendResult.success) {
      agentMessage.deliveryStatus = 'sent';
      agentMessage.whatsappMessageId = sendResult.messageId;
      await agentMessage.save();

      console.log(`✅ Réponse agent envoyée: ${sendResult.messageId}`);
    } else {
      agentMessage.deliveryStatus = 'failed';
      await agentMessage.save();
      console.error(`❌ Échec envoi réponse agent: ${sendResult.error}`);
    }

    return sendResult;

  } catch (error) {
    console.error('❌ Erreur sendAgentResponse:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

export {
  initAgentWhatsapp,
  sendWhatsAppMessage,
  sendInitialMessageForOrder,
  sendRelanceMessage,
  sendAgentResponse,
  getActiveInstanceForWorkspace
};
