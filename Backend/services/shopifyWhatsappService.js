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

import { sendWhatsAppMessage } from './whatsappService.js';
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
  currency = 'FCFA',
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
      .replace(/\{\{total_price\}\}/gi,  String(totalPrice || 0))
      .replace(/\{\{currency\}\}/gi,     currency)
      .replace(/\{\{store_name\}\}/gi,   storeName);
  }

  // Template par défaut
  const storeSignature = storeName ? `\n${storeName}` : '';

  return (
    `Bonjour ${firstName || 'Client'} 👋\n\n` +
    `Votre commande #${orderNumber} a bien été reçue.\n\n` +
    `Produit : ${product}\n` +
    `Quantité : ${quantity}\n` +
    `Ville : ${city}\n` +
    `Total : ${totalPrice} ${currency}\n\n` +
    `Notre équipe vous contactera pour confirmer la livraison.\n\n` +
    `Merci pour votre confiance 🙏` +
    storeSignature
  );
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
      storeName:     options.storeName || '',
      customTemplate: options.customTemplate || null,
    });

    console.log(
      `📱 ${logPrefix} Envoi WhatsApp à ${whatsappNumber} — commande #${order.orderId}`
    );

    // ── Envoyer via le service WhatsApp existant ─────────────────────────
    console.log(`📩 ${logPrefix} Envoi WhatsApp à : ${whatsappNumber}`);
    const result = await sendWhatsAppMessage({
      to:          whatsappNumber,
      message,
      workspaceId: String(workspaceId),
      userId:      'system',
      firstName:   'Shopify Webhook',
    });
    console.log(`✅ ${logPrefix} WhatsApp envoyé — messageId: ${result?.messageId || 'N/A'}, instance: ${result?.instanceName || 'N/A'}`);

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
      .select('whatsappAutoConfirm whatsappOrderTemplate storeSettings name')
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
      currency:       'FCFA',
      storeName,
      customTemplate: workspace.whatsappOrderTemplate || null,
    });

    console.log(`📱 ${logPrefix} Envoi WhatsApp à ${whatsappNumber} — commande #${order.orderId}`);

    const result = await sendWhatsAppMessage({
      to:          whatsappNumber,
      message,
      workspaceId: String(workspaceId),
      userId:      'system',
      firstName:   'Order Webhook',
    });

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
