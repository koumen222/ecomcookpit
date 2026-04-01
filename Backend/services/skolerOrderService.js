import Order from '../models/Order.js';
import { notifyNewOrder } from './notificationHelper.js';
import { normalizeCity } from '../utils/cityNormalizer.js';
import { sendClientOrderConfirmation } from './shopifyWhatsappService.js';

/**
 * Saves a Skelor storefront order into the main orders table.
 * Mirrors saveShopifyOrder logic — same pipeline (dedup, notify, WhatsApp).
 *
 * @param {Object} orderData           - Normalized order payload
 * @param {string} workspaceId         - Resolved workspace _id
 * @param {Object} workspaceSettings   - WhatsApp auto-confirm settings
 * @returns {Order|null}               - Created Order doc, or null if duplicate
 */
export async function saveSkolerOrder(orderData, workspaceId, workspaceSettings = {}) {
  const {
    orderId,
    customerName,
    phone,
    address,
    city,
    product,
    quantity,
    totalPrice,
    currency = 'XAF',
    notes,
    status = 'pending',
    storeOrderId = null,
    items = [],
    rawData = {},
  } = orderData;

  if (!workspaceId) {
    console.error('❌ [Skelor] workspaceId manquant');
    return null;
  }

  // ── Dédoublonnage ─────────────────────────────────────────────────────
  if (orderId) {
    const existing = await Order.findOne({
      orderId: String(orderId),
      source: 'skelor',
      workspaceId,
    }).lean();

    if (existing) {
      console.log(`ℹ️ [Skelor] Commande #${orderId} déjà existante, ignorée`);
      return null;
    }
  }

  // ── Normalisation ─────────────────────────────────────────────────────
  const normalizedCity = normalizeCity(city || '') || city || '';
  const cleanPhone = (phone || '').replace(/\D/g, '');

  const productLabel = items.length > 0
    ? items.map(i => `${i.name || i.title}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ')
    : product || '';

  const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0) || quantity || 1;
  const price = parseFloat(totalPrice) || 0;

  // ── Création ──────────────────────────────────────────────────────────
  const newOrder = new Order({
    workspaceId,
    orderId: orderId ? String(orderId) : undefined,
    date: new Date(),
    clientName: customerName || 'Client Skelor',
    clientPhone: cleanPhone,
    clientPhoneNormalized: cleanPhone,
    city: normalizedCity,
    address: address || '',
    product: productLabel,
    quantity: totalQty,
    price,
    currency,
    status,
    source: 'skelor',
    storeOrderId: storeOrderId || null,
    notes: notes || '',
    rawData: { ...rawData, skelor_order_id: orderId, items, currency },
  });

  await newOrder.save();

  console.log(`✅ [Skelor] Commande #${orderId || newOrder._id} enregistrée`);
  console.log(`   👤 ${customerName} | 💰 ${price} ${currency} | 📦 ${productLabel}`);
  console.log(`   📞 ${cleanPhone} | WhatsApp auto: ${workspaceSettings.whatsappAutoConfirm ? 'OUI ✅' : 'NON ❌'}`);

  // ── Notification temps réel ────────────────────────────────────────────
  notifyNewOrder(workspaceId, newOrder)
    .catch(err => console.error('❌ [Skelor] Erreur notification:', err.message));

  // ── WhatsApp confirmation au client ───────────────────────────────────
  if (workspaceSettings.whatsappAutoConfirm && newOrder.clientPhone) {
    const fakePayload = {
      order_number: orderId,
      currency,
      customer: { first_name: (customerName || '').split(' ')[0] || 'Client' },
      line_items: items.map(i => ({ title: i.name || i.title, quantity: i.quantity || 1 })),
    };

    sendClientOrderConfirmation(newOrder, fakePayload, workspaceId, {
      storeName:      workspaceSettings.storeName || '',
      customTemplate: workspaceSettings.whatsappOrderTemplate || null,
      instanceId:     workspaceSettings.whatsappAutoInstanceId || null,
      imageUrl:       workspaceSettings.whatsappAutoImageUrl || null,
      audioUrl:       workspaceSettings.whatsappAutoAudioUrl || null,
    }).catch(err => console.error('❌ [Skelor] Erreur WhatsApp client:', err.message));
  }

  return newOrder;
}
