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
  if (!Array.isArray(order)) return ['text'];
  const filtered = order.filter(step => ALLOWED_SEND_STEPS.includes(step));
  return filtered.length > 0 ? filtered : ['text'];
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

  // Compléter le téléphone depuis le payload Shopify si manquant sur la commande
  const rawPhone = order.clientPhone
    || shopifyOrder?.customer?.phone
    || shopifyOrder?.shipping_address?.phone
    || shopifyOrder?.phone
    || '';

  console.log(`📞 ${logPrefix} Téléphone brut : "${rawPhone}" (order: "${order.clientPhone || ''}", customer: "${shopifyOrder?.customer?.phone || ''}", shipping: "${shopifyOrder?.shipping_address?.phone || ''}")`);

  if (rawPhone && !order.clientPhone) {
    order.clientPhone = rawPhone.replace(/\D/g, '');
  }

  // Déléguer à sendOrderConfirmationToClient qui gère toute la logique
  // (règles produit, instance dédiée, template, médias, whatsappAutoConfirm)
  console.log(`📱 ${logPrefix} Délégation à sendOrderConfirmationToClient — commande #${order.orderId}`);
  return sendOrderConfirmationToClient(order, workspaceId);
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
    // Anti-doublon : si le produit commandé gère son propre message client
    // (instance dédiée, via le hook produit), on n'envoie pas aussi le message
    // auto au niveau workspace — sinon le client reçoit deux messages.
    try {
      const { default: Product } = await import('../models/Product.js');
      if (order?.productId || order?.product) {
        const q = order.productId
          ? { _id: order.productId, workspaceId }
          : { workspaceId, name: { $regex: `^${String(order.product).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
        const prod = await Product.findOne(q).select('whatsappClientEnabled').lean();
        if (prod?.whatsappClientEnabled) {
          console.log(`ℹ️ ${logPrefix} Produit gère son message client (instance dédiée) — envoi workspace ignoré`);
          return { success: false, skipped: true, reason: 'product_client_message' };
        }
      }
    } catch { /* en cas d'erreur, on continue avec le flux workspace normal */ }

    // Vérifier que whatsappAutoConfirm est activé
    const workspace = await EcomWorkspace.findById(workspaceId)
      .select('whatsappAutoConfirm whatsappOrderTemplate whatsappAutoInstanceId whatsappAutoImageUrl whatsappAutoVideoUrl whatsappAutoDocumentUrl whatsappAutoAudioUrl whatsappAutoSendOrder whatsappAutoProductMediaRules storeSettings name')
      .lean();

    console.log(`🔍 ${logPrefix} workspace trouvé: ${workspace ? 'OUI' : 'NON'}, whatsappAutoConfirm: ${workspace?.whatsappAutoConfirm}, workspaceId: ${workspaceId}`);

    if (!workspace?.whatsappAutoConfirm) {
      console.log(`ℹ️ ${logPrefix} WhatsApp auto désactivé pour workspace ${workspaceId}`);
      return { success: false, error: 'WhatsApp auto désactivé' };
    }

    const rawPhone = order.clientPhone || '';
    console.log(`📞 ${logPrefix} Téléphone: "${rawPhone}", commande: #${order.orderId}, produit: "${order.product}"`);
    if (!rawPhone) {
      console.log(`ℹ️ ${logPrefix} Commande #${order.orderId} — pas de téléphone client`);
      return { success: false, error: 'Pas de numéro de téléphone' };
    }

    const phoneResult = formatInternationalPhone(rawPhone);
    console.log(`📱 ${logPrefix} Format tél: success=${phoneResult.success}, formatted="${phoneResult.formatted}", error="${phoneResult.error || ''}"`);
    if (!phoneResult.success) {
      // Fallback : essayer d'envoyer avec le numéro brut nettoyé si assez long
      const fallbackDigits = rawPhone.replace(/\D/g, '');
      if (fallbackDigits.length >= 8) {
        console.warn(`⚠️ ${logPrefix} Format échoué mais fallback sur "${fallbackDigits}"`);
        // continue avec fallback ci-dessous
      } else {
        console.warn(`⚠️ ${logPrefix} Numéro invalide "${rawPhone}" : ${phoneResult.error}`);
        return { success: false, error: `Numéro invalide: ${phoneResult.error}` };
      }
    }

    const whatsappNumber = phoneResult.formatted || rawPhone.replace(/\D/g, '');
    const storeName = workspace.storeSettings?.storeName || workspace.name || '';
    console.log(`📲 ${logPrefix} Numéro final: "${whatsappNumber}"`);

    const matchedRule = resolveMediaRule(order.product, workspace.whatsappAutoProductMediaRules || []);
    if (matchedRule) {
      console.log(`📦 ${logPrefix} Règle produit trouvée: "${matchedRule.productKeyword}"${matchedRule.instanceId ? ` → instance ${matchedRule.instanceId}` : ''}`);
    }

    // Instance: règle produit > instance globale
    const autoInstanceId = matchedRule?.instanceId || workspace.whatsappAutoInstanceId || null;

    // Template: règle produit > template global
    const effectiveTemplate = matchedRule?.template || workspace.whatsappOrderTemplate || null;

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
      customTemplate: effectiveTemplate,
    });

    console.log(`📱 ${logPrefix} Envoi WhatsApp à ${whatsappNumber} — commande #${order.orderId}${autoInstanceId ? ` via instance ${autoInstanceId}` : ''}`);

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
