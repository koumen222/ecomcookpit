import Order from '../models/Order.js';
import OrderSource from '../models/OrderSource.js';
import { notifyNewOrder } from './notificationHelper.js';
import { normalizeCity } from '../utils/cityNormalizer.js';
import { sendClientOrderConfirmation } from './shopifyWhatsappService.js';

/**
 * Sauvegarde une commande Shopify reçue par webhook.
 * Retourne l'Order créé ou null si doublon.
 *
 * @param {Object} shopifyOrder   - Payload brut Shopify (orders/create)
 * @param {string} shopDomain     - Domaine Shopify (header X-Shopify-Shop-Domain)
 * @param {string} workspaceId    - ID du workspace (résolu via webhook token)
 */
export async function saveShopifyOrder(shopifyOrder, shopDomain, workspaceId, workspaceSettings = {}) {
  const shopifyOrderId = String(shopifyOrder.id);

  if (!workspaceId) {
    console.error(`❌ [Shopify WH] workspaceId manquant, commande #${shopifyOrderId} ignorée`);
    return null;
  }

  // ── Créer ou récupérer la source Shopify Webhook ───────────────────────
  let orderSource = await OrderSource.findOne({
    workspaceId,
    'metadata.type': 'shopify_webhook',
    'metadata.shopDomain': shopDomain
  });

  if (!orderSource) {
    // Créer une nouvelle source dédiée pour ce shop Shopify
    const shopName = shopDomain.replace('.myshopify.com', '');
    orderSource = await OrderSource.create({
      name: `Shopify - ${shopName}`,
      description: `Commandes reçues via webhook Shopify (${shopDomain})`,
      color: '#96bf48',
      icon: '🛍️',
      workspaceId,
      createdBy: workspaceId, // Utiliser workspaceId comme createdBy (système)
      isActive: true,
      metadata: {
        type: 'shopify_webhook',
        shopDomain,
        createdAt: new Date()
      }
    });
    console.log(`📦 [Shopify WH] Source créée: ${orderSource.name} (${orderSource._id})`);
  }

  // ── Dédoublonnage ──────────────────────────────────────────────────────
  const existing = await Order.findOne({
    orderId: shopifyOrderId,
    source: 'shopify',
    workspaceId,
    sourceId: orderSource._id
  }).lean();

  if (existing) {
    console.log(`ℹ️ [Shopify WH] Commande #${shopifyOrderId} déjà existante, ignorée`);
    return null;
  }

  // ── Extraire les données pertinentes ───────────────────────────────────
  const customer = shopifyOrder.customer || {};
  const shipping = shopifyOrder.shipping_address || shopifyOrder.billing_address || {};
  const lineItems = shopifyOrder.line_items || [];

  const clientName = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
    || shipping.name
    || shopifyOrder.email
    || 'Client Shopify';

  const clientPhone = customer.phone
    || shipping.phone
    || shopifyOrder.phone
    || '';

  const product = lineItems.map(li => {
    const qty = li.quantity > 1 ? ` x${li.quantity}` : '';
    return `${li.title || li.name}${qty}`;
  }).join(', ') || 'Produit Shopify';

  const totalQuantity = lineItems.reduce((sum, li) => sum + (li.quantity || 1), 0);

  const city = normalizeCity(shipping.city || '');
  const address = [shipping.address1, shipping.address2].filter(Boolean).join(', ');

  const price = parseFloat(shopifyOrder.total_price) || 0;
  const currency = shopifyOrder.currency || 'XAF';

  // ── Créer la commande dans le système existant ─────────────────────────
  const newOrder = new Order({
    workspaceId,
    sourceId: orderSource._id,
    sourceName: orderSource.name,
    orderId: shopifyOrderId,
    date: shopifyOrder.created_at ? new Date(shopifyOrder.created_at) : new Date(),
    clientName,
    clientPhone: clientPhone.replace(/\D/g, ''),
    clientPhoneNormalized: clientPhone.replace(/\D/g, ''),
    city,
    address,
    product,
    quantity: totalQuantity,
    price,
    status: mapShopifyStatus(shopifyOrder.financial_status, shopifyOrder.fulfillment_status),
    source: 'shopify',
    notes: `Shopify #${shopifyOrder.order_number || shopifyOrderId} | ${currency} | ${shopifyOrder.email || ''}`,
    rawData: {
      shopify_order_id: shopifyOrderId,
      order_number: shopifyOrder.order_number,
      email: shopifyOrder.email,
      currency,
      financial_status: shopifyOrder.financial_status,
      fulfillment_status: shopifyOrder.fulfillment_status,
      line_items: lineItems.map(li => ({
        title: li.title,
        quantity: li.quantity,
        price: li.price,
        sku: li.sku,
        variant_title: li.variant_title
      })),
      shipping_address: shipping,
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        first_name: customer.first_name,
        last_name: customer.last_name
      },
      shop_domain: shopDomain
    }
  });

  await newOrder.save();

  console.log(`✅ [Shopify WH] Commande #${shopifyOrder.order_number || shopifyOrderId} sauvegardée`);
  console.log(`   📧 ${shopifyOrder.email || 'N/A'} | 💰 ${price} ${currency} | 📦 ${product}`);

  // ── Notifications (asynchrone, ne bloque pas la réponse) ───────────────
  if (workspaceId) {
    notifyNewOrder(workspaceId, newOrder)
      .catch(err => console.error('❌ [Shopify WH] Erreur notification:', err.message));
  }

  // ── WhatsApp confirmation au client (si activé dans le workspace) ──────
  if (workspaceSettings.whatsappAutoConfirm) {
    sendClientOrderConfirmation(newOrder, shopifyOrder, workspaceId, {
      storeName:      workspaceSettings.storeName || '',
      customTemplate: workspaceSettings.whatsappOrderTemplate || null,
    }).catch(err => console.error('❌ [Shopify WH] Erreur WhatsApp client:', err.message));
  }

  return newOrder;
}

/**
 * Mappe les statuts Shopify vers les statuts internes
 */
function mapShopifyStatus(financialStatus, fulfillmentStatus) {
  if (fulfillmentStatus === 'fulfilled') return 'delivered';
  if (fulfillmentStatus === 'partial') return 'shipped';
  if (financialStatus === 'paid') return 'confirmed';
  if (financialStatus === 'pending') return 'pending';
  if (financialStatus === 'refunded' || financialStatus === 'voided') return 'cancelled';
  return 'pending';
}
