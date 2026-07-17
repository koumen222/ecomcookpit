import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomWorkspace from '../models/Workspace.js';
import evolutionApiService from './evolutionApiService.js';
import { formatInternationalPhone, getPhonePrefixFromWorkspace, normalizePhone } from '../utils/phoneUtils.js';

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
    // Si une instance spécifique est demandée, on la prend dès qu'elle est active
    // (pas de filtre sur le statut : l'admin l'a choisie explicitement)
    if (specificInstanceId) {
      const specific = await WhatsAppInstance.findOne({
        _id: specificInstanceId,
        isActive: true
      });
      if (specific) return specific;
      console.warn(`⚠️ Instance spécifique ${specificInstanceId} introuvable ou désactivée, fallback auto-detect`);
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

async function getWorkspaceDefaultPhonePrefix(workspaceId) {
  if (!workspaceId) return null;

  try {
    const workspace = await EcomWorkspace.findById(workspaceId)
      .select('settings storeSettings')
      .lean();
    return getPhonePrefixFromWorkspace(workspace, '237');
  } catch (error) {
    console.warn('⚠️ [WhatsApp] Impossible de résoudre le préfixe pays du workspace:', error.message);
    return '237';
  }
}

async function resolveWhatsAppNumber(rawPhone, workspaceId) {
  const direct = formatInternationalPhone(rawPhone);
  if (direct.success) {
    return direct;
  }

  const defaultPrefix = await getWorkspaceDefaultPhonePrefix(workspaceId);
  const normalized = normalizePhone(rawPhone, defaultPrefix);
  if (!normalized) {
    return direct;
  }

  const fallback = formatInternationalPhone(normalized);
  if (fallback.success) {
    return fallback;
  }

  return {
    success: true,
    formatted: normalized,
    display: `+${normalized}`,
    countryInfo: null,
    prefix: defaultPrefix,
    nationalNumber: normalized.slice(String(defaultPrefix || '').length),
  };
}

/**
/**
 * Traduit un message d'erreur Evolution API brut en message lisible pour l'utilisateur.
 */
function _friendlyError(rawError = '') {
  const e = String(rawError).toLowerCase();
  if (e.includes('connection closed') || e.includes('connectionclosed') || e.includes('session closed') || e.includes('not connected')) {
    return 'Instance WhatsApp déconnectée — reconnectez-la dans Paramètres > WhatsApp';
  }
  if (e.includes('unauthorized') || e.includes('invalid token') || e.includes('invalid apikey')) {
    return 'Token d\'instance invalide — vérifiez la clé API de l\'instance';
  }
  if (e.includes('rate') || e.includes('too many')) {
    return 'Trop de messages envoyés — réessayez dans quelques instants';
  }
  return rawError || 'Erreur lors de l\'envoi du message';
}

/**
 * Marque l'instance comme déconnectée si Evolution API signale une session fermée.
 */
async function _handleSendFailure(instance, rawError = '') {
  try {
    const e = String(rawError).toLowerCase();
    if (e.includes('connection closed') || e.includes('connectionclosed') || e.includes('session closed') || e.includes('not connected')) {
      console.warn(`⚠️ [WhatsApp] Instance "${instance.instanceName}" déconnectée détectée — mise à jour statut`);
      instance.status = 'disconnected';
      instance.disconnectedAt = new Date();
      await instance.save();
    }
  } catch {}
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
    // Pour les groupes (JID @g.us), passer directement sans reformatage
    if (to.includes('@g.us')) {
      const cleanNumber = to.trim();
      console.log(`📱 [WhatsApp] Groupe JID détecté : "${cleanNumber}"`);
      const result = await evolutionApiService.sendMessage(
        instance.instanceName,
        instance.instanceToken,
        cleanNumber,
        message
      );
      if (!result.success) {
        await _handleSendFailure(instance, result.error);
        throw new Error(_friendlyError(result.error));
      }
      instance.lastSeen = new Date();
      await instance.save();
      return { success: true, messageId: result.data?.key?.id || 'unknown', instanceName: instance.instanceName };
    }
    const phoneCheck = await resolveWhatsAppNumber(to, workspaceId);
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
      console.error(`❌ le service a refusé l'envoi — numéro: ${cleanNumber}, erreur: ${result.error}`);
      await _handleSendFailure(instance, result.error);
      throw new Error(_friendlyError(result.error));
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
    const mediaPhoneCheck = await resolveWhatsAppNumber(to, workspaceId);
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

    const audioPhoneCheck = await resolveWhatsAppNumber(to, workspaceId);
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

/**
 * Envoie une vidéo via WhatsApp
 */
export async function sendWhatsAppVideo({ to, videoUrl, caption = '', workspaceId, instanceId }) {
  try {
    if (!to || !videoUrl) {
      throw new Error('Numéro de téléphone et URL vidéo requis');
    }

    if (!workspaceId) {
      throw new Error('workspaceId requis pour envoyer une vidéo WhatsApp');
    }

    const instance = await getActiveInstance(workspaceId, instanceId);
    if (!instance) {
      throw new Error('Aucune instance WhatsApp connectée. Veuillez configurer WhatsApp dans les paramètres.');
    }

    const phoneCheck = await resolveWhatsAppNumber(to, workspaceId);
    if (!phoneCheck.success) {
      throw new Error(`Numéro de téléphone invalide: ${phoneCheck.error}`);
    }

    const cleanNumber = phoneCheck.formatted;
    const fileName = (videoUrl.split('?')[0].split('/').pop() || 'video.mp4');
    const result = await evolutionApiService.sendVideo(
      instance.instanceName,
      instance.instanceToken,
      cleanNumber,
      videoUrl,
      caption,
      fileName
    );

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'envoi de la vidéo');
    }

    instance.lastSeen = new Date();
    await instance.save();

    return {
      success: true,
      messageId: result.data?.key?.id || 'unknown',
      instanceName: instance.instanceName
    };
  } catch (error) {
    console.error('❌ Erreur sendWhatsAppVideo:', error.message);
    throw error;
  }
}

/**
 * Envoie un document (PDF) via WhatsApp
 */
export async function sendWhatsAppDocument({ to, documentUrl, caption = '', workspaceId, instanceId }) {
  return sendWhatsAppMedia({
    to,
    mediaUrl: documentUrl,
    caption,
    workspaceId,
    instanceId
  });
}

/**
 * Envoie une nouvelle commande dans le groupe WhatsApp lié au produit
 * @param {Object} order - Objet commande (mongoose doc ou plain object)
 * @param {string} workspaceId
 */
export async function sendOrderToProductGroup(order, workspaceId) {
  try {
    if (!order?.productId && !order?.product) return;
    if (!workspaceId) return;

    // Récupérer le produit pour avoir le groupe assigné
    const { default: Product } = await import('../models/Product.js');
    let product = null;
    if (order.productId) {
      product = await Product.findOne({ _id: order.productId, workspaceId }).select('whatsappGroupJid whatsappGroupName name').lean();
    }
    // Fallback: chercher par nom si pas de productId
    if (!product && order.product) {
      product = await Product.findOne({
        workspaceId,
        name: { $regex: `^${order.product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
      }).select('whatsappGroupJid whatsappGroupName name').lean();
    }

    if (!product?.whatsappGroupJid) return;

    const groupJid = product.whatsappGroupJid;
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const message =
      `🛒 *NOUVELLE COMMANDE — ${(order.product || product.name || '').toUpperCase()}*\n\n` +
      `📋 *Réf:* ${order.orderId || '#—'}\n` +
      `📅 *Date:* ${dateStr} à ${timeStr}\n\n` +
      `👤 *Client:* ${order.clientName || '—'}\n` +
      `📞 *Tel:* ${order.clientPhone || '—'}\n` +
      `📍 *Ville:* ${order.city || '—'}\n` +
      `${order.address ? `🏠 *Adresse:* ${order.address}\n` : ''}` +
      `\n` +
      `📦 *Produit:* ${order.product || product.name}\n` +
      `🔢 *Qté:* ${order.quantity || 1}\n` +
      `💰 *Prix:* ${order.price || 0} ${order.currency || 'XAF'}\n` +
      `💰 *Total:* ${(order.price || 0) * (order.quantity || 1)} ${order.currency || 'XAF'}\n` +
      `${order.notes ? `\n📝 *Notes:* ${order.notes}\n` : ''}` +
      `\n_Source: ${order.source || 'manual'}_`;

    await sendWhatsAppMessage({ to: groupJid, message, workspaceId });
    console.log(`✅ [OrderGroup] Commande #${order.orderId} envoyée au groupe "${product.whatsappGroupName}" (${groupJid})`);
  } catch (error) {
    console.error('❌ sendOrderToProductGroup:', error.message);
    // Ne pas propager — ne jamais bloquer la création de commande
  }
}

// ── Message automatique AU CLIENT, par produit ───────────────────────────────
// Modèle par défaut si le produit n'en définit pas.
const DEFAULT_CLIENT_MESSAGE =
  'Bonjour {prenom} 👋\n\n' +
  'Merci pour votre commande *{produit}* ✅\n' +
  'Référence : {commande}\n' +
  'Quantité : {quantite}\n' +
  'Total : {total} {devise}\n\n' +
  'Notre équipe vous contactera très vite pour confirmer la livraison. À bientôt !';

// Remplace les variables {…} du modèle par les données de la commande.
export function renderClientTemplate(tpl, order, product) {
  const prenom = (order?.clientName || '').trim().split(/\s+/)[0] || 'cher client';
  const qty = order?.quantity || 1;
  const price = order?.price || 0;
  const vars = {
    '{prenom}': prenom,
    '{client}': order?.clientName || prenom,
    '{nom}': order?.clientName || prenom,
    '{produit}': order?.product || product?.name || '',
    '{commande}': order?.orderId || order?._id || '',
    '{ref}': order?.orderId || order?._id || '',
    '{prix}': String(price),
    '{quantite}': String(qty),
    '{total}': String(price * qty),
    '{ville}': order?.city || '',
    '{adresse}': order?.address || '',
    '{devise}': order?.currency || 'XAF',
  };
  return String(tpl || DEFAULT_CLIENT_MESSAGE)
    .replace(/\{(prenom|client|nom|produit|commande|ref|prix|quantite|total|ville|adresse|devise)\}/g, (m) => vars[m] ?? m);
}

/**
 * @deprecated NE PLUS UTILISER. Remplacée par `sendOrderConfirmationToClient`
 * (services/shopifyWhatsappService.js), désormais branchée sur le hook post-save
 * de Order ET sur le bouton « Tester ». Cette ancienne version n'envoyait ni
 * l'audio ni le document, ignorait `sendOrder`, et retombait silencieusement sur
 * l'instance/template par défaut. Conservée uniquement pour compatibilité.
 *
 * Envoie un message de confirmation AU CLIENT pour le produit commandé,
 * via l'instance WhatsApp assignée au produit (fallback : instance active du
 * workspace). Ne s'exécute QUE si le produit a `whatsappClientEnabled = true`.
 */
export async function sendOrderClientMessage(order, workspaceId) {
  try {
    if (!workspaceId || !order?.clientPhone) return;
    if (!order?.productId && !order?.product) return;

    const { default: EcomWorkspace } = await import('../models/Workspace.js');
    const ws = await EcomWorkspace.findById(workspaceId)
      .select('whatsappAutoConfirm whatsappAutoProductMediaRules whatsappOrderTemplate storeSettings name')
      .lean();

    // ── 1. Règle par produit dans whatsappAutoProductMediaRules ──────────────
    if (ws?.whatsappAutoConfirm && ws?.whatsappAutoProductMediaRules?.length > 0) {
      const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const normProduct = norm(order.product);
      let matchedRule = null;

      for (const rule of ws.whatsappAutoProductMediaRules) {
        if (!rule?.productKeyword) continue;
        const normKeyword = norm(rule.productKeyword);
        if (normProduct === normKeyword || normProduct.includes(normKeyword) || normKeyword.includes(normProduct)) {
          matchedRule = rule; break;
        }
        const pw = normProduct.split(' ').filter(w => w.length >= 4);
        const kw = normKeyword.split(' ').filter(w => w.length >= 4);
        if (pw.some(w => kw.includes(w))) { matchedRule = rule; break; }
      }

      if (matchedRule) {
        console.log(`✅ [OrderClient] Règle produit trouvée: "${matchedRule.productKeyword}" → instance: ${matchedRule.instanceId || 'défaut'}`);

        const storeName = ws.storeSettings?.storeName || ws.name || '';
        const effectiveTemplate = matchedRule.template || ws.whatsappOrderTemplate || null;

        // Construire le message
        let message;
        if (effectiveTemplate) {
          const unitPrice = (order.price || 0);
          message = effectiveTemplate
            .replace(/\{\{first_name\}\}/gi,   order.clientName?.split(' ')[0] || 'Client')
            .replace(/\{\{order_number\}\}/gi, order.orderId || '')
            .replace(/\{\{product\}\}/gi,      order.product || '')
            .replace(/\{\{quantity\}\}/gi,     String(order.quantity || 1))
            .replace(/\{\{city\}\}/gi,         order.city || '')
            .replace(/\{\{total_price\}\}/gi,  String((order.price || 0) * (order.quantity || 1)))
            .replace(/\{\{price\}\}/gi,        String(unitPrice))
            .replace(/\{\{prix\}\}/gi,         String(unitPrice))
            .replace(/\{\{currency\}\}/gi,     order.currency || 'XAF')
            .replace(/\{\{devise\}\}/gi,       order.currency || 'XAF')
            .replace(/\{\{store_name\}\}/gi,   storeName);
        } else {
          // Total = price × quantity (Order.price est le prix UNITAIRE).
          message = `Bonjour ${order.clientName?.split(' ')[0] || 'Client'} 👋\n\nVotre commande #${order.orderId} a bien été reçue${storeName ? ` chez ${storeName}` : ''}.\n\nProduit : ${order.product}\nQuantité : ${order.quantity || 1}\nTotal : ${(order.price || 0) * (order.quantity || 1)} ${order.currency || 'XAF'}\n\nMerci pour votre confiance 🙏`;
        }

        const instanceId = matchedRule.instanceId || undefined;
        await sendWhatsAppMessage({ to: order.clientPhone, message, workspaceId, instanceId });
        console.log(`✅ [OrderClient] Message envoyé via instance ${instanceId || 'défaut'}`);

        // Envoyer image si présente
        if (matchedRule.imageUrl) {
          await new Promise(r => setTimeout(r, 1000));
          await sendWhatsAppMedia({ to: order.clientPhone, mediaUrl: matchedRule.imageUrl, caption: '', workspaceId, instanceId });
          console.log(`✅ [OrderClient] Image envoyée`);
        }
        // Envoyer vidéo si présente
        if (matchedRule.videoUrl) {
          await new Promise(r => setTimeout(r, 1000));
          await sendWhatsAppVideo({ to: order.clientPhone, videoUrl: matchedRule.videoUrl, caption: '', workspaceId, instanceId });
          console.log(`✅ [OrderClient] Vidéo envoyée`);
        }
        return;
      }
    }

    // ── 2. Fallback : product.whatsappClientEnabled ───────────────────────────
    const { default: Product } = await import('../models/Product.js');
    const fields = 'whatsappClientEnabled whatsappClientInstanceId whatsappClientMessage name';
    let product = null;
    if (order.productId) {
      product = await Product.findOne({ _id: order.productId, workspaceId }).select(fields).lean();
    }
    if (!product && order.product) {
      product = await Product.findOne({
        workspaceId,
        name: { $regex: `^${order.product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      }).select(fields).lean();
    }
    if (!product || !product.whatsappClientEnabled) return;

    const message = renderClientTemplate(product.whatsappClientMessage, order, product);
    await sendWhatsAppMessage({ to: order.clientPhone, message, workspaceId, instanceId: product.whatsappClientInstanceId || undefined });
    console.log(`✅ [OrderClient] Message produit envoyé pour "${product.name}"`);
  } catch (error) {
    console.error('❌ sendOrderClientMessage:', error.message);
  }
}

export default {
  sendWhatsAppMessage,
  sendOrderNotification,
  sendOrderToProductGroup,
  sendOrderClientMessage,
  renderClientTemplate,
  sendWhatsAppMedia,
  sendWhatsAppAudio,
  sendWhatsAppVideo,
  sendWhatsAppDocument,
  getActiveInstance
};
