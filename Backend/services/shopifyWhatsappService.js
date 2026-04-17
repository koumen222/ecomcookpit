/**
 * shopifyWhatsappService.js
 * ──────────────────────────
 * Envoie un message WhatsApp de confirmation automatique au client
 * dès qu'une commande Shopify est reçue et enregistrée avec succès.
 *
 * Flux :
 *   Shopify orders/create → shopifyWebhookController → shopifyOrderService
 *     → saveShopifyOrder() → sendClientOrderConfirmation() (ce fichier)
 *
 * Dépend de :
 *   - whatsappService.sendWhatsAppMessage()  (gère l'instance Evolution API)
 *   - WhatsAppLog (logging)
 *   - Workspace.whatsappAutoConfirm (toggle on/off)
 */

import { sendWhatsAppMessage, sendWhatsAppMedia, sendWhatsAppAudio, sendWhatsAppVideo, sendWhatsAppDocument } from './whatsappService.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import EcomWorkspace from '../models/Workspace.js';
import { formatInternationalPhone } from '../utils/phoneUtils.js';

// ─── Templates de messages ──────────────────────────────────────────────────

/**
 * Génère le message de confirmation WhatsApp à envoyer au client.
 * Les variables dynamiques sont remplacées depuis les données de la commande.
 *
 * @param {Object} params
 * @param {string} params.firstName      - Prénom du client
 * @param {string} params.orderNumber    - Numéro de commande Shopify
 * @param {string} params.product        - Nom du/des produit(s)
 * @param {number} params.quantity       - Quantité totale
 * @param {string} params.city           - Ville de livraison
 * @param {number} params.totalPrice     - Prix total
 * @param {string} params.currency       - Devise (XAF, EUR, etc.)
 * @param {string} [params.country]      - Pays de livraison
 * @param {string} [params.deliveryType] - Mode de livraison
 * @param {string} [params.storeName]    - Nom du store (optionnel)
 * @param {string} [params.customTemplate] - Template personnalisé (optionnel)
 * @returns {string} Message formaté
 */
export function buildConfirmationMessage({
  firstName,
  orderNumber,
  product,
  quantity,
  city,
  totalPrice,
  currency = 'XAF',
  country = '',
  deliveryType = '',
  storeName = '',
  customTemplate = null,
}) {
  // Si un template personnalisé est défini, on remplace les variables
  if (customTemplate) {
    return customTemplate
      .replace(/\{\{first_name\}\}/gi,   firstName || 'Client')
      .replace(/\{\{order_number\}\}/gi, orderNumber || '')
      .replace(/\{\{product\}\}/gi,      product || '')
      .replace(/\{\{quantity\}\}/gi,     String(quantity || 1))
      .replace(/\{\{city\}\}/gi,         city || '')
      .replace(/\{\{country\}\}/gi,      country || '')
      .replace(/\{\{total_price\}\}/gi,  String(totalPrice || 0))
      .replace(/\{\{currency\}\}/gi,     currency)
      .replace(/\{\{delivery_type\}\}/gi, deliveryType || '')
      .replace(/\{\{store_name\}\}/gi,   storeName);
  }

  // Template par défaut
  const storeLine = storeName ? ` chez ${storeName}` : '';
  const locationLine = [city, country].filter(Boolean).join(', ');
  const deliveryLabel = deliveryType === 'expedition'
    ? 'confirmer l\'expedition'
    : 'confirmer la livraison';

  return (
    `Bonjour ${firstName || 'Client'} 👋\n\n` +
    `Votre commande #${orderNumber} a bien été reçue${storeLine}.\n\n` +
    `Produit : ${product}\n` +
    `Quantité : ${quantity}\n` +
    (locationLine ? `Localisation : ${locationLine}\n` : '') +
    `Total : ${totalPrice} ${currency}\n\n` +
    `Notre équipe vous contactera pour ${deliveryLabel}.\n\n` +
    `Merci pour votre confiance 🙏`
  );
}

const ALLOWED_SEND_STEPS = ['text', 'image', 'video', 'document', 'audio'];

function normalizeProductText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildTokenSet(value = '') {
  return new Set(
    normalizeProductText(value)
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 3)
  );
}

function splitKeywordPatterns(keyword = '') {
  return String(keyword || '')
    .split(/[\n,;|]+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function scorePatternAgainstProduct(pattern, normalizedProduct, productTokens) {
  const normalizedPattern = normalizeProductText(pattern);
  if (!normalizedPattern) return 0;

  const patternTokens = [...buildTokenSet(normalizedPattern)];
  if (normalizedProduct === normalizedPattern) {
    return 100;
  }

  if (normalizedProduct.includes(normalizedPattern)) {
    return 80 + Math.min(normalizedPattern.length, 15);
  }

  if (patternTokens.length === 0) {
    return 0;
  }

  let score = 0;
  let matchedTokens = 0;

  for (const token of patternTokens) {
    if (productTokens.has(token)) {
      matchedTokens += 1;
      score += 20;
      continue;
    }

    const partialMatch = [...productTokens].some(productToken =>
      productToken.includes(token) || token.includes(productToken)
    );

    if (partialMatch) {
      score += 8;
    }
  }

  if (matchedTokens === patternTokens.length) {
    score += 25;
  }

  return score;
}

function normalizeSendOrder(order = []) {
  if (!Array.isArray(order)) return ['text', 'image', 'audio'];
  const filtered = order.filter(step => ALLOWED_SEND_STEPS.includes(step));
  return filtered.length > 0 ? filtered : ['text', 'image', 'audio'];
}

function resolveMediaRule(orderProduct = '', rules = []) {
  if (!orderProduct || !Array.isArray(rules) || rules.length === 0) return null;
  const normalizedProduct = normalizeProductText(orderProduct);
  const productTokens = buildTokenSet(orderProduct);

  let bestRule = null;
  let bestScore = 0;

  for (const rule of rules) {
    const patterns = splitKeywordPatterns(rule?.productKeyword);
    if (patterns.length === 0) continue;

    let ruleScore = 0;
    for (const pattern of patterns) {
      ruleScore = Math.max(ruleScore, scorePatternAgainstProduct(pattern, normalizedProduct, productTokens));
    }

    if (ruleScore > bestScore) {
      bestScore = ruleScore;
      bestRule = rule;
    }
  }

  return bestScore >= 20 ? bestRule : null;
}

async function sendAutoStep(step, context) {
  const { whatsappNumber, workspaceId, instanceId, message, media } = context;

  if (step === 'text') {
    return sendWhatsAppMessage({
      to: whatsappNumber,
      message,
      workspaceId: String(workspaceId),
      userId: 'system',
      firstName: 'Order Webhook',
      instanceId,
    });
  }

  if (step === 'image' && media.imageUrl) {
    return sendWhatsAppMedia({
      to: whatsappNumber,
      mediaUrl: media.imageUrl,
      caption: '',
      workspaceId: String(workspaceId),
      instanceId,
    });
  }

  if (step === 'video' && media.videoUrl) {
    return sendWhatsAppVideo({
      to: whatsappNumber,
      videoUrl: media.videoUrl,
      caption: '',
      workspaceId: String(workspaceId),
      instanceId,
    });
  }

  if (step === 'document' && media.documentUrl) {
    return sendWhatsAppDocument({
      to: whatsappNumber,
      documentUrl: media.documentUrl,
      caption: '',
      workspaceId: String(workspaceId),
      instanceId,
    });
  }

  if (step === 'audio' && media.audioUrl) {
    return sendWhatsAppAudio({
      to: whatsappNumber,
      audioUrl: media.audioUrl,
      workspaceId: String(workspaceId),
      instanceId,
    });
  }

  return null;
}

// ─── Envoi du message de confirmation au client ─────────────────────────────

/**
 * Envoie un message WhatsApp de confirmation au client après une commande Shopify.
 *
 * La fonction est non bloquante : elle ne throw pas si l'envoi échoue
 * (la commande est déjà enregistrée en base).
 *
 * @param {Object} order         - Document Order Mongoose (après .save())
 * @param {Object} shopifyOrder  - Payload brut Shopify (pour accéder aux données customer)
 * @param {string} workspaceId   - _id du workspace
 * @param {Object} [options]     - Options supplémentaires
 * @param {string} [options.storeName]       - Nom du store
 * @param {string} [options.customTemplate]  - Template personnalisé
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendClientOrderConfirmation(order, shopifyOrder, workspaceId, options = {}) {
  const logPrefix = `[Shopify→WhatsApp]`;

  try {
    // ── Vérifier qu'on a un numéro de téléphone ─────────────────────────
    const rawPhone = order.clientPhone
      || shopifyOrder?.customer?.phone
      || shopifyOrder?.shipping_address?.phone
      || shopifyOrder?.phone
      || '';

    console.log(`📞 ${logPrefix} Téléphone brut : "${rawPhone}"`);
    console.log(`   Sources → order.clientPhone: "${order.clientPhone || ''}" | customer.phone: "${shopifyOrder?.customer?.phone || ''}" | shipping.phone: "${shopifyOrder?.shipping_address?.phone || ''}" | order.phone: "${shopifyOrder?.phone || ''}"`);

    if (!rawPhone) {
      console.log(`ℹ️ ${logPrefix} Commande #${order.orderId} — pas de téléphone client, WhatsApp non envoyé`);
      return { success: false, error: 'Pas de numéro de téléphone' };
    }

    // ── Formater le numéro pour WhatsApp ─────────────────────────────────
    const phoneResult = formatInternationalPhone(rawPhone);
    if (!phoneResult.success) {
      console.warn(`⚠️ ${logPrefix} Numéro invalide "${rawPhone}" : ${phoneResult.error}`);
      return { success: false, error: `Numéro invalide: ${phoneResult.error}` };
    }

    const whatsappNumber = phoneResult.formatted;
    console.log(`📱 ${logPrefix} Numéro formaté : "${rawPhone}" → "${whatsappNumber}"`);

    // ── Extraire les données pour le template ────────────────────────────
    const customer = shopifyOrder?.customer || {};
    const lineItems = shopifyOrder?.line_items || [];
    const currency = shopifyOrder?.currency || 'XAF';
    const shippingCountry = shopifyOrder?.shipping_address?.country || '';
    const shippingDeliveryType = shopifyOrder?.delivery_type || '';

    const firstName = customer.first_name
      || order.clientName?.split(' ')[0]
      || 'Client';

    const productNames = lineItems.length > 0
      ? lineItems.map(li => li.title || li.name).filter(Boolean).join(', ')
      : order.product || 'Produit';

    const totalQuantity = lineItems.reduce((sum, li) => sum + (li.quantity || 1), 0)
      || order.quantity
      || 1;

    // ── Construire le message ────────────────────────────────────────────
    const message = buildConfirmationMessage({
      firstName,
      orderNumber: shopifyOrder?.order_number || order.orderId,
      product:     productNames,
      quantity:    totalQuantity,
      city:        order.city || '',
      totalPrice:  order.price || parseFloat(shopifyOrder?.total_price) || 0,
      currency,
      country: shippingCountry,
      deliveryType: shippingDeliveryType,
      storeName:     options.storeName || '',
      customTemplate: options.customTemplate || null,
    });

    console.log(
      `📱 ${logPrefix} Envoi WhatsApp à ${whatsappNumber} — commande #${order.orderId}`
    );

    // ── Récupérer la config auto (instance spécifique, médias, ordre) ───
    const autoInstanceId = options.instanceId || null;
    const autoImageUrl = options.imageUrl || null;
    const autoVideoUrl = options.videoUrl || null;
    const autoDocumentUrl = options.documentUrl || null;
    const autoAudioUrl = options.audioUrl || null;
    const sendOrder = normalizeSendOrder(options.sendOrder || ['text', 'image', 'audio']);

    // ── Envoi progressif configurable ─────────────────────────────────────
    console.log(`📩 ${logPrefix} Envoi WhatsApp à : ${whatsappNumber} (instance: ${autoInstanceId || 'auto'})`);
    let result = null;
    for (const step of sendOrder) {
      try {
        const stepResult = await sendAutoStep(step, {
          whatsappNumber,
          workspaceId,
          instanceId: autoInstanceId,
          message,
          media: {
            imageUrl: autoImageUrl,
            videoUrl: autoVideoUrl,
            documentUrl: autoDocumentUrl,
            audioUrl: autoAudioUrl,
          }
        });
        if (stepResult && !result && step === 'text') {
          result = stepResult;
        }
        if (stepResult) {
          console.log(`✅ ${logPrefix} Étape envoyée: ${step}`);
        }
        await new Promise(r => setTimeout(r, 1200));
      } catch (stepErr) {
        console.warn(`⚠️ ${logPrefix} Erreur envoi étape ${step}: ${stepErr.message}`);
      }
    }

    // ── Logger dans WhatsAppLog ──────────────────────────────────────────
    await WhatsAppLog.create({
      workspaceId,
      userId:       null,
      phoneNumber:  whatsappNumber,
      message,
      status:       'sent',
      messageId:    result?.messageId || '',
      instanceName: result?.instanceName || '',
      messageType:  'text',
      metadata: {
        trigger: 'shopify_order_confirmation',
        orderId: order._id,
        shopifyOrderId: order.orderId,
        orderNumber: shopifyOrder?.order_number,
      },
    });

    console.log(
      `✅ ${logPrefix} Message envoyé — commande #${order.orderId}, dest: ${whatsappNumber}`
    );

    // ── Marquer la commande comme notifiée ───────────────────────────────
    try {
      await order.constructor.updateOne(
        { _id: order._id },
        {
          whatsappNotificationSent:   true,
          whatsappNotificationSentAt: new Date(),
        }
      );
    } catch (updateErr) {
      console.warn(`⚠️ ${logPrefix} Erreur mise à jour flag WhatsApp: ${updateErr.message}`);
    }

    return { success: true, messageId: result?.messageId };

  } catch (err) {
    console.error(`❌ ${logPrefix} Erreur envoi WhatsApp — commande #${order?.orderId}: ${err.message}`);

    // Logger l'échec
    try {
      await WhatsAppLog.create({
        workspaceId,
        phoneNumber:  order.clientPhone || '',
        message:      '',
        status:       'failed',
        errorMessage: err.message,
        messageType:  'text',
        metadata: {
          trigger: 'shopify_order_confirmation',
          orderId: order._id,
          shopifyOrderId: order.orderId,
        },
      });
    } catch {
      // Ignorer si le log échoue aussi
    }

    return { success: false, error: err.message };
  }
}

/**
 * Envoie un message WhatsApp de confirmation au client pour toute commande
 * (manuelle, webhook Google Sheets, webhook générique).
 *
 * Vérifie automatiquement que whatsappAutoConfirm est activé sur le workspace.
 *
 * @param {Object} order       - Document Order Mongoose (après .save())
 * @param {string} workspaceId - _id du workspace
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendOrderConfirmationToClient(order, workspaceId) {
  const logPrefix = `[Order→WhatsApp]`;

  try {
    // Vérifier que whatsappAutoConfirm est activé
    const workspace = await EcomWorkspace.findById(workspaceId)
      .select('whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoAudioUrl whatsappAutoSendOrder whatsappAutoProductMediaRules storeSettings name')
      .lean();

    if (!workspace?.whatsappAutoConfirm) {
      console.log(`ℹ️ ${logPrefix} WhatsApp auto désactivé pour workspace ${workspaceId}`);
      return { success: false, error: 'WhatsApp auto désactivé' };
    }

    const rawPhone = order.clientPhone || '';
    if (!rawPhone) {
      console.log(`ℹ️ ${logPrefix} Commande #${order.orderId} — pas de téléphone client`);
      return { success: false, error: 'Pas de numéro de téléphone' };
    }

    const phoneResult = formatInternationalPhone(rawPhone);
    if (!phoneResult.success) {
      console.warn(`⚠️ ${logPrefix} Numéro invalide "${rawPhone}" : ${phoneResult.error}`);
      return { success: false, error: `Numéro invalide: ${phoneResult.error}` };
    }

    const whatsappNumber = phoneResult.formatted;
    const storeName = workspace.storeSettings?.storeName || workspace.name || '';

    const message = buildConfirmationMessage({
      firstName:      order.clientName?.split(' ')[0] || 'Client',
      orderNumber:    order.orderId,
      product:        order.product || 'Produit',
      quantity:       order.quantity || 1,
      city:           order.city || '',
      totalPrice:     order.price || 0,
      currency:       order.currency || 'XAF',
      country:        order.rawData?.shipping_address?.country || order.country || '',
      deliveryType:   order.rawData?.delivery_type || order.deliveryType || '',
      storeName,
      customTemplate: workspace.whatsappOrderTemplate || null,
    });

    console.log(`📱 ${logPrefix} Envoi WhatsApp à ${whatsappNumber} — commande #${order.orderId}`);

    const autoInstanceId = workspace.whatsappAutoInstanceId || null;
    const matchedRule = resolveMediaRule(order.product, workspace.whatsappAutoProductMediaRules || []);
    const media = {
      imageUrl: matchedRule?.imageUrl || workspace.whatsappAutoImageUrl || null,
      videoUrl: matchedRule?.videoUrl || workspace.whatsappAutoVideoUrl || null,
      documentUrl: matchedRule?.documentUrl || workspace.whatsappAutoDocumentUrl || null,
      audioUrl: matchedRule?.audioUrl || workspace.whatsappAutoAudioUrl || null,
    };
    const sendOrder = normalizeSendOrder(matchedRule?.sendOrder?.length ? matchedRule.sendOrder : workspace.whatsappAutoSendOrder);

    // Envoi progressif configurable (ordre global ou spécifique au produit)
    let result = null;
    for (const step of sendOrder) {
      try {
        const stepResult = await sendAutoStep(step, {
          whatsappNumber,
          workspaceId,
          instanceId: autoInstanceId,
          message,
          media,
        });
        if (stepResult && !result && step === 'text') {
          result = stepResult;
        }
        if (stepResult) {
          console.log(`✅ ${logPrefix} Étape envoyée: ${step}${matchedRule ? ` (règle produit: ${matchedRule.productKeyword})` : ''}`);
        }
        await new Promise(r => setTimeout(r, 1200));
      } catch (stepErr) {
        console.warn(`⚠️ ${logPrefix} Erreur envoi étape ${step}: ${stepErr.message}`);
      }
    }

    await WhatsAppLog.create({
      workspaceId,
      phoneNumber:  whatsappNumber,
      message,
      status:       'sent',
      messageId:    result?.messageId || '',
      instanceName: result?.instanceName || '',
      messageType:  'text',
      metadata: {
        trigger: 'order_confirmation',
        orderId: order._id,
        orderNumber: order.orderId,
        source: order.source || 'unknown',
      },
    });

    // Marquer la commande comme notifiée
    try {
      await order.constructor.updateOne(
        { _id: order._id },
        { whatsappNotificationSent: true, whatsappNotificationSentAt: new Date() }
      );
    } catch (updateErr) {
      console.warn(`⚠️ ${logPrefix} Erreur mise à jour flag: ${updateErr.message}`);
    }

    console.log(`✅ ${logPrefix} WhatsApp envoyé — commande #${order.orderId}, dest: ${whatsappNumber}`);
    return { success: true, messageId: result?.messageId };

  } catch (err) {
    console.error(`❌ ${logPrefix} Erreur — commande #${order?.orderId}: ${err.message}`);
    try {
      await WhatsAppLog.create({
        workspaceId,
        phoneNumber: order.clientPhone || '',
        message: '',
        status: 'failed',
        errorMessage: err.message,
        messageType: 'text',
        metadata: { trigger: 'order_confirmation', orderId: order._id, source: order.source },
      });
    } catch { /* ignore */ }
    return { success: false, error: err.message };
  }
}
