import WhatsAppInstance from '../models/WhatsAppInstance.js';
import evolutionApiService from './evolutionApiService.js';
import { formatInternationalPhone, isValidWhatsAppNumber } from '../utils/phoneUtils.js';

/**
 * Service pour envoyer des messages WhatsApp en utilisant l'instance connectée
 */

/**
 * Récupère l'instance WhatsApp active pour un workspace
 * @param {string} workspaceId - ID du workspace
 * @param {string} [specificInstanceId] - ID d'une instance spécifique (optionnel)
 * @returns {Promise<Object|null>} Instance WhatsApp ou null
 */
async function getActiveInstance(workspaceId, specificInstanceId = null) {
  try {
    // Si une instance spécifique est demandée
    if (specificInstanceId) {
      const specific = await WhatsAppInstance.findOne({
        _id: specificInstanceId,
        isActive: true,
        status: { $in: ['connected', 'active'] }
      });
      if (specific) return specific;
      console.warn(`⚠️ Instance spécifique ${specificInstanceId} non trouvée ou déconnectée, fallback auto-detect`);
    }

    // Chercher une instance active et connectée pour ce workspace
    const instance = await WhatsAppInstance.findOne({
      workspaceId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).sort({ lastSeen: -1 }); // Prendre la plus récemment vue

    if (!instance) {
      console.warn(`⚠️ Aucune instance WhatsApp active trouvée pour workspace ${workspaceId}`);
      return null;
    }

    return instance;
  } catch (error) {
    console.error('❌ Erreur récupération instance WhatsApp:', error);
    return null;
  }
}

/**
 * Envoie un message WhatsApp via l'instance connectée
 * @param {Object} params - Paramètres d'envoi
 * @param {string} params.to - Numéro de téléphone destinataire
 * @param {string} params.message - Contenu du message
 * @param {string} params.workspaceId - ID du workspace
 * @param {string} params.userId - ID de l'utilisateur (optionnel)
 * @param {string} params.firstName - Prénom de l'utilisateur (optionnel)
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendWhatsAppMessage({ to, message, workspaceId, userId, firstName, instanceId }) {
  try {
    if (!to || !message) {
      throw new Error('Numéro de téléphone et message requis');
    }

    if (!workspaceId) {
      throw new Error('workspaceId requis pour envoyer un message WhatsApp');
    }

    // Récupérer l'instance active (spécifique ou auto-detect)
    const instance = await getActiveInstance(workspaceId, instanceId);
    
    if (!instance) {
      console.error(`❌ [WhatsApp] Aucune instance connectée pour workspace ${workspaceId}`);
      throw new Error('Aucune instance WhatsApp connectée. Veuillez configurer WhatsApp dans les paramètres.');
    }
    console.log(`🔌 [WhatsApp] Instance trouvée : "${instance.instanceName}" (status: ${instance.status})`);

    // Nettoyer et formater le numéro de téléphone international
    const phoneCheck = formatInternationalPhone(to);
    if (!phoneCheck.success) {
      console.error(`❌ [WhatsApp] Numéro invalide : "${to}" → ${phoneCheck.error}`);
      throw new Error(`Numéro de téléphone invalide: ${phoneCheck.error}`);
    }
    const cleanNumber = phoneCheck.formatted;
    console.log(`📱 [WhatsApp] Numéro formaté : "${to}" → "${cleanNumber}"`);

    console.log(`📱 Envoi WhatsApp via instance "${instance.instanceName}" à ${cleanNumber}`);
    console.log(`   🔗 Evolution API URL: ${process.env.EVOLUTION_API_URL || 'https://api.evolution-api.com'}/message/sendText/${instance.instanceName}`);

    // Envoyer via Evolution API
    const result = await evolutionApiService.sendMessage(
      instance.instanceName,
      instance.instanceToken,
      cleanNumber,
      message
    );

    if (!result.success) {
      console.error(`❌ Evolution API a refusé l'envoi — numéro: ${cleanNumber}, erreur: ${result.error}`);
      throw new Error(result.error || 'Erreur lors de l\'envoi du message');
    }

    // Mettre à jour lastSeen de l'instance
    instance.lastSeen = new Date();
    await instance.save();

    console.log(`✅ Message WhatsApp envoyé avec succès à ${cleanNumber}`);
    console.log(`   📋 Response: messageId=${result.data?.key?.id || 'N/A'}, status=${result.data?.status || 'N/A'}`);

    return {
      success: true,
      messageId: result.data?.key?.id || 'unknown',
      logId: result.data?.messageId || 'unknown',
      instanceName: instance.instanceName
    };

  } catch (error) {
    console.error('❌ Erreur sendWhatsAppMessage:', error.message);
    throw error;
  }
}

/**
 * Envoie une notification de commande au livreur
 * @param {Object} order - Objet commande
 * @param {string} workspaceId - ID du workspace
 * @returns {Promise<void>}
 */
export async function sendOrderNotification(order, workspaceId) {
  try {
    if (!order || !workspaceId) {
      console.warn('⚠️ sendOrderNotification: order ou workspaceId manquant');
      return;
    }

    // Récupérer l'instance active
    const instance = await getActiveInstance(workspaceId);
    
    if (!instance) {
      console.warn(`⚠️ Aucune instance WhatsApp pour envoyer la notification de commande #${order.orderId}`);
      return;
    }

    // Déterminer le numéro destinataire (livreur assigné ou numéro par défaut)
    let targetNumber = null;

    // Si un livreur est assigné et a un numéro
    if (order.assignedLivreur?.phone) {
      targetNumber = order.assignedLivreur.phone;
    }

    // Sinon, chercher un numéro par défaut dans les settings (à implémenter si nécessaire)
    // Pour l'instant, on log juste
    if (!targetNumber) {
      console.log(`ℹ️ Pas de livreur assigné pour la commande #${order.orderId}, notification non envoyée`);
      return;
    }

    // Formater le message de notification
    const whatsappMessage = `📦 *NOUVELLE COMMANDE*\n\n` +
      `🔢 *Référence:* #${order.orderId}\n` +
      `📅 *Date:* ${new Date(order.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
      `👤 *Client:* ${order.clientName}\n` +
      `📞 *Téléphone:* ${order.clientPhone}\n` +
      `📍 *Ville:* ${order.city}\n` +
      `${order.deliveryLocation ? `🏠 *Adresse:* ${order.deliveryLocation}\n` : ''}` +
      `${order.deliveryTime ? `⏰ *Heure livraison:* ${order.deliveryTime}\n` : ''}\n` +
      `📦 *Produit:* ${order.product}\n` +
      `🔢 *Quantité:* ${order.quantity}\n` +
      `💰 *Prix:* ${order.price} FCFA\n` +
      `💰 *Total:* ${order.price * order.quantity} FCFA\n\n` +
      `${order.notes ? `📝 *Notes:* ${order.notes}\n\n` : ''}` +
      `🚀 *Préparez-vous pour la livraison!*`;

    // Envoyer le message
    await sendWhatsAppMessage({
      to: targetNumber,
      message: whatsappMessage,
      workspaceId,
      userId: 'system',
      firstName: 'System'
    });

    console.log(`✅ Notification de commande #${order.orderId} envoyée à ${targetNumber}`);

  } catch (error) {
    console.error('❌ Erreur sendOrderNotification:', error.message);
    // Ne pas propager l'erreur pour ne pas bloquer la création de commande
  }
}

/**
 * Envoie un message média (image) via WhatsApp
 * @param {Object} params - Paramètres d'envoi
 * @param {string} params.to - Numéro de téléphone destinataire
 * @param {string} params.mediaUrl - URL de l'image
 * @param {string} params.caption - Légende de l'image
 * @param {string} params.workspaceId - ID du workspace
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendWhatsAppMedia({ to, mediaUrl, caption, workspaceId, instanceId }) {
  try {
    if (!to || !mediaUrl) {
      throw new Error('Numéro de téléphone et URL média requis');
    }

    if (!workspaceId) {
      throw new Error('workspaceId requis pour envoyer un média WhatsApp');
    }

    // Récupérer l'instance active (spécifique ou auto-detect)
    const instance = await getActiveInstance(workspaceId, instanceId);
    
    if (!instance) {
      throw new Error('Aucune instance WhatsApp connectée. Veuillez configurer WhatsApp dans les paramètres.');
    }

    // Nettoyer et formater le numéro de téléphone international pour média
    const mediaPhoneCheck = formatInternationalPhone(to);
    if (!mediaPhoneCheck.success) {
      throw new Error(`Numéro de téléphone invalide: ${mediaPhoneCheck.error}`);
    }
    const cleanMediaNumber = mediaPhoneCheck.formatted;

    console.log(`📱 Envoi média WhatsApp via instance ${instance.instanceName} à ${cleanMediaNumber}`);

    // Envoyer via Evolution API
    const result = await evolutionApiService.sendMedia(
      instance.instanceName,
      instance.instanceToken,
      cleanMediaNumber,
      mediaUrl,
      caption
    );

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'envoi du média');
    }

    // Mettre à jour lastSeen de l'instance
    instance.lastSeen = new Date();
    await instance.save();

    console.log(`✅ Média WhatsApp envoyé avec succès à ${cleanMediaNumber}`);

    return {
      success: true,
      messageId: result.data?.key?.id || 'unknown',
      instanceName: instance.instanceName
    };

  } catch (error) {
    console.error('❌ Erreur sendWhatsAppMedia:', error.message);
    throw error;
  }
}

/**
 * Envoie un message vocal via WhatsApp
 * @param {Object} params - Paramètres d'envoi
 * @param {string} params.to - Numéro de téléphone destinataire
 * @param {string} params.audioUrl - URL du fichier audio
 * @param {string} params.workspaceId - ID du workspace
 * @returns {Promise<Object>} Résultat de l'envoi
 */
export async function sendWhatsAppAudio({ to, audioUrl, workspaceId, instanceId }) {
  try {
    if (!to || !audioUrl) {
      throw new Error('Numéro de téléphone et URL audio requis');
    }

    if (!workspaceId) {
      throw new Error('workspaceId requis pour envoyer un audio WhatsApp');
    }

    const instance = await getActiveInstance(workspaceId, instanceId);
    
    if (!instance) {
      throw new Error('Aucune instance WhatsApp connectée. Veuillez configurer WhatsApp dans les paramètres.');
    }

    const audioPhoneCheck = formatInternationalPhone(to);
    if (!audioPhoneCheck.success) {
      throw new Error(`Numéro de téléphone invalide: ${audioPhoneCheck.error}`);
    }
    const cleanAudioNumber = audioPhoneCheck.formatted;

    console.log(`📱 Envoi audio WhatsApp via instance ${instance.instanceName} à ${cleanAudioNumber}`);

    const result = await evolutionApiService.sendAudio(
      instance.instanceName,
      instance.instanceToken,
      cleanAudioNumber,
      audioUrl
    );

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'envoi de l\'audio');
    }

    instance.lastSeen = new Date();
    await instance.save();

    console.log(`✅ Audio WhatsApp envoyé avec succès à ${cleanAudioNumber}`);

    return {
      success: true,
      messageId: result.data?.key?.id || 'unknown',
      instanceName: instance.instanceName
    };

  } catch (error) {
    console.error('❌ Erreur sendWhatsAppAudio:', error.message);
    throw error;
  }
}

export default {
  sendWhatsAppMessage,
  sendOrderNotification,
  sendWhatsAppMedia,
  sendWhatsAppAudio,
  getActiveInstance
};
