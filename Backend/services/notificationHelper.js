import Notification from '../models/Notification.js';
import EcomUser from '../models/EcomUser.js';
import CloseuseAssignment from '../models/CloseuseAssignment.js';
import { getIO } from './socketService.js';
import { sendPushNotification, sendPushNotificationToUser } from './pushService.js';

/**
 * Create a notification for a workspace (broadcast) or specific user
 */
export const createNotification = async ({ workspaceId, userId = null, type, title, message, icon = 'info', link = null, metadata = {} }) => {
  try {
    if (!workspaceId || !type || !title || !message) {
      console.error('createNotification: missing required fields');
      return null;
    }

    const notification = await Notification.create({
      workspaceId,
      userId,
      type,
      title,
      message,
      icon,
      link,
      metadata
    });

    // Émettre via WebSocket pour mise à jour en temps réel
    try {
      const io = getIO();
      if (io) {
        const payload = { _id: notification._id, type, title, message, icon, link, metadata, createdAt: notification.createdAt };
        if (userId) {
          // Notification ciblée → envoyer à l'utilisateur spécifique
          io.to(`user:${userId}`).emit('notification:new', payload);
        } else {
          // Notification broadcast → envoyer à tout le workspace
          io.to(`workspace:${workspaceId}`).emit('notification:new', payload);
        }
      }
    } catch (socketError) {
      // Ne pas bloquer si le socket échoue
      console.warn('⚠️ Socket emit notification failed:', socketError.message);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
    return null;
  }
};

/**
 * Résout le nom du produit depuis order.product ou rawData.line_items
 */
const isEasySellPlaceholder = (title) => /easysell|cod form|via import/i.test(title || '');

const resolveProductName = (order) => {
  // Direct product string (skip if it's just an EasySell placeholder)
  if (order.product && typeof order.product === 'string' && order.product.trim() && !isEasySellPlaceholder(order.product)) {
    return order.product.trim();
  }
  // Check note_attributes for real product name (EasySell stores it there)
  const noteAttrs = order.rawData?.note_attributes || [];
  const easySellName = noteAttrs.find(a => /product|item|produit/i.test(a.name))?.value;
  if (easySellName) return easySellName;
  // Check line item properties
  if (order.rawData?.line_items?.length) {
    for (const li of order.rawData.line_items) {
      const propName = (li.properties || []).find(p => /product|item|produit|name/i.test(p.name))?.value;
      if (propName) return propName;
    }
  }
  // Fallback: rawData line_items (filter out EasySell placeholders)
  if (order.rawData?.line_items?.length) {
    const names = order.rawData.line_items
      .filter(li => !isEasySellPlaceholder(li.title))
      .map(li => { const t = li.title || li.name || ''; const q = li.quantity > 1 ? ` x${li.quantity}` : ''; return t ? `${t}${q}` : null; })
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  // Last fallback: use the raw product even if EasySell
  if (order.product && typeof order.product === 'string' && order.product.trim()) {
    return order.product.trim();
  }
  return 'Produit';
};

/**
 * Notify all workspace members about a new order
 */
export const notifyNewOrder = async (workspaceId, order) => {
  const productName = resolveProductName(order);

  // Label source pour distinguer Scalor / Shopify / manual
  const sourceLabel = order.source === 'skelor'
    ? ' • Scalor'
    : order.source === 'shopify'
    ? ' • Shopify'
    : '';

  const priceStr = order.price ? `FCFA${new Intl.NumberFormat('fr-FR').format(order.price)}` : '';
  const qtyStr = `${order.quantity || 1} article${(order.quantity || 1) > 1 ? 's' : ''}`;
  const body = `${priceStr ? priceStr + ', ' : ''}${qtyStr} • ${order.clientName || 'Client'}`;
  const pushTitle = `Commande #${order.orderId || ''}${sourceLabel}`;

  // Créer la notification interne
  const notification = await createNotification({
    workspaceId,
    type: 'order_new',
    title: `Nouvelle commande${sourceLabel}`,
    message: body,
    icon: 'order',
    link: `/ecom/orders/${order._id}`,
    metadata: { orderId: order._id, source: order.source }
  });

  // Envoyer la notification push
  try {
    await sendPushNotification(
      workspaceId,
      {
        title: pushTitle,
        body,
        icon: '/icons/order-new.png',
        badge: '/icons/badge.png',
        tag: `order-new-${order._id}`,
        data: {
          type: 'order_new',
          orderId: String(order._id),
          url: `/ecom/orders/${order._id}`
        },
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'Voir la commande' },
          { action: 'dismiss', title: 'Ignorer' }
        ]
      },
      'push_new_orders'
    );
    console.log(`📱 Push notification envoyée pour nouvelle commande: ${order._id} (${order.source || 'manual'})`);
  } catch (pushError) {
    console.warn('⚠️ Erreur envoi notification push nouvelle commande:', pushError.message);
  }

  return notification;
};

/**
 * Notify about order status change
 */
export const notifyOrderStatus = async (workspaceId, order, newStatus) => {
  const statusLabels = {
    confirmed: 'confirmée',
    shipped: 'expédiée',
    delivered: 'livrée',
    cancelled: 'annulée',
    returned: 'retournée'
  };

  const typeMap = {
    confirmed: 'order_confirmed',
    shipped: 'order_shipped',
    delivered: 'order_delivered',
    cancelled: 'order_cancelled',
    returned: 'order_returned'
  };

  // Créer la notification interne
  const notification = await createNotification({
    workspaceId,
    type: typeMap[newStatus] || 'order_status',
    title: `Commande ${statusLabels[newStatus] || newStatus}`,
    message: `${order.clientName || 'Client'} — ${order.product || 'Produit'}`,
    icon: 'order',
    link: `/ecom/orders/${order._id}`,
    metadata: { orderId: order._id, status: newStatus }
  });

  // Envoyer la notification push
  try {
    await sendPushNotification(
      workspaceId,
      {
        title: `📦 Commande ${statusLabels[newStatus] || newStatus}`,
        body: `${order.clientName || 'Client'} — ${order.product || 'Produit'}`,
        icon: `/icons/order-${newStatus}.png`,
        tag: `order-status-${order._id}-${newStatus}`,
        data: {
          type: 'order_status',
          orderId: order._id,
          status: newStatus,
          url: `/ecom/orders/${order._id}`
        },
        requireInteraction: ['cancelled', 'returned'].includes(newStatus)
      },
      'push_status_changes'
    );
    console.log(`📱 Push notification envoyée pour statut commande: ${order._id} -> ${newStatus}`);
  } catch (pushError) {
    console.warn('⚠️ Erreur envoi notification push statut commande:', pushError.message);
  }

  return notification;
};

/**
 * Notify about low stock
 */
export const notifyLowStock = async (workspaceId, product) => {
  return createNotification({
    workspaceId,
    type: 'stock_low',
    title: 'Stock bas',
    message: `${product.name} — ${product.stock} unités restantes (seuil: ${product.reorderThreshold})`,
    icon: 'alert',
    link: `/ecom/stock`,
    metadata: { productId: product._id, stock: product.stock }
  });
};

/**
 * Notify about out of stock
 */
export const notifyOutOfStock = async (workspaceId, product) => {
  return createNotification({
    workspaceId,
    type: 'stock_out',
    title: 'Rupture de stock',
    message: `${product.name} est en rupture de stock !`,
    icon: 'alert',
    link: `/ecom/stock`,
    metadata: { productId: product._id }
  });
};

/**
 * Notify about stock received
 */
export const notifyStockReceived = async (workspaceId, stockOrder) => {
  return createNotification({
    workspaceId,
    type: 'stock_received',
    title: 'Stock reçu',
    message: `${stockOrder.quantity} unités de ${stockOrder.productName || 'produit'} reçues`,
    icon: 'stock',
    link: `/ecom/stock`,
    metadata: { stockOrderId: stockOrder._id }
  });
};

/**
 * Notify about new user joining
 */
export const notifyUserJoined = async (workspaceId, user) => {
  return createNotification({
    workspaceId,
    type: 'user_joined',
    title: 'Nouveau membre',
    message: `${user.name || user.email} a rejoint l'équipe`,
    icon: 'user',
    metadata: { userId: user._id }
  });
};

/**
 * Notify about report creation
 */
export const notifyReportCreated = async (workspaceId, report, userName) => {
  return createNotification({
    workspaceId,
    type: 'report_created',
    title: 'Nouveau rapport',
    message: `${userName || 'Utilisateur'} a soumis un rapport quotidien`,
    icon: 'report',
    link: `/ecom/reports/${report._id}`,
    metadata: { reportId: report._id }
  });
};

/**
 * Notify about import completion
 */
export const notifyImportCompleted = async (workspaceId, result) => {
  return createNotification({
    workspaceId,
    type: 'import_completed',
    title: 'Import terminé',
    message: `${result.imported || 0} commandes importées, ${result.errors || 0} erreurs`,
    icon: 'import',
    link: `/ecom/orders`,
    metadata: result
  });
};

/**
 * Generic system notification
 */
export const notifySystem = async (workspaceId, title, message, link = null) => {
  return createNotification({
    workspaceId,
    type: 'system',
    title,
    message,
    icon: 'system',
    link
  });
};

/**
 * Notify team about member action (excluding the actor)
 */
export const notifyTeamMemberAction = async (workspaceId, actorId, action, details = {}) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_member_action',
    title: 'Action d\'équipe',
    message: `${details.actorName || 'Un membre'} a ${action}`,
    icon: 'team',
    link: details.link,
    metadata: { actorId, action, ...details }
  });
};

/**
 * Notify team about order creation
 */
export const notifyTeamOrderCreated = async (workspaceId, actorId, order, actorName) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_order_created',
    title: 'Nouvelle commande créée',
    message: `${actorName} a créé une commande: ${order.clientName || 'Client'} — ${order.product || 'Produit'}`,
    icon: 'order',
    link: `/ecom/orders/${order._id}`,
    metadata: { orderId: order._id, actorId }
  });
};

/**
 * Notify team about order status change
 */
export const notifyTeamOrderStatusChanged = async (workspaceId, actorId, order, newStatus, actorName) => {
  const statusLabels = {
    confirmed: 'confirmée',
    shipped: 'expédiée',
    delivered: 'livrée',
    cancelled: 'annulée',
    returned: 'retournée',
    pending: 'mise en attente'
  };

  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_order_status_changed',
    title: 'Statut de commande modifié',
    message: `${actorName} a marqué la commande comme ${statusLabels[newStatus] || newStatus}`,
    icon: 'order',
    link: `/ecom/orders/${order._id}`,
    metadata: { orderId: order._id, newStatus, actorId }
  });
};

/**
 * Notify team about campaign creation
 */
export const notifyTeamCampaignCreated = async (workspaceId, actorId, campaign, actorName) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_campaign_created',
    title: 'Nouvelle campagne créée',
    message: `${actorName} a créé une nouvelle campagne marketing`,
    icon: 'campaign',
    link: `/ecom/campaigns/${campaign._id}`,
    metadata: { campaignId: campaign._id, actorId }
  });
};

/**
 * Notify team about campaign sent
 */
export const notifyTeamCampaignSent = async (workspaceId, actorId, campaign, stats, actorName) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_campaign_sent',
    title: 'Campagne envoyée',
    message: `${actorName} a envoyé une campagne à ${stats.sent || 0} clients`,
    icon: 'campaign',
    link: `/ecom/campaigns/${campaign._id}`,
    metadata: { campaignId: campaign._id, stats, actorId }
  });
};

/**
 * Notify team about product creation/update
 */
export const notifyTeamProductAction = async (workspaceId, actorId, product, action, actorName) => {
  const actionLabels = {
    created: 'créé',
    updated: 'modifié',
    deleted: 'supprimé'
  };

  return createNotification({
    workspaceId,
    userId: null,
    type: `team_product_${action}`,
    title: `Produit ${actionLabels[action]}`,
    message: `${actorName} a ${actionLabels[action]} le produit: ${product.name}`,
    icon: 'product',
    link: action !== 'deleted' ? `/ecom/products/${product._id}` : '/ecom/products',
    metadata: { productId: product._id, action, actorId }
  });
};

/**
 * Notify team about report generation
 */
export const notifyTeamReportGenerated = async (workspaceId, actorId, report, actorName) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_report_generated',
    title: 'Rapport généré',
    message: `${actorName} a généré un rapport ${report.type || ''}`,
    icon: 'report',
    link: `/ecom/reports/${report._id}`,
    metadata: { reportId: report._id, actorId }
  });
};

/**
 * Notify team about inventory update
 */
export const notifyTeamInventoryUpdate = async (workspaceId, actorId, product, change, actorName) => {
  return createNotification({
    workspaceId,
    userId: null,
    type: 'team_inventory_update',
    title: 'Inventaire mis à jour',
    message: `${actorName} a modifié le stock de ${product.name}: ${change.previous} → ${change.new}`,
    icon: 'inventory',
    link: `/ecom/products/${product._id}`,
    metadata: { productId: product._id, change, actorId }
  });
};

/**
 * Notify workspace about a new message in a channel
 */
export const notifyNewMessage = async (workspaceId, { senderName, channel, content, messageId }) => {
  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
  return createNotification({
    workspaceId,
    userId: null,
    type: 'new_message',
    title: `💬 Nouveau message dans #${channel}`,
    message: `${senderName}: ${preview}`,
    icon: 'message',
    link: `/ecom/messages`,
    metadata: { channel, messageId, senderName }
  });
};

/**
 * Notify a user about a new direct message
 */
export const notifyNewDM = async (workspaceId, recipientId, { senderName, content, messageId }) => {
  const preview = content.length > 80 ? content.slice(0, 80) + '…' : content;
  return createNotification({
    workspaceId,
    userId: recipientId,
    type: 'new_dm',
    title: `💬 Message de ${senderName}`,
    message: preview,
    icon: 'message',
    link: `/ecom/messages`,
    metadata: { messageId, senderName }
  });
};

/**
 * Find the closeuse(s) responsible for a given order.
 * Matches by assignedCloseuse field, or via CloseuseAssignment (source / product / city).
 */
const findResponsibleCloseuses = async (workspaceId, order) => {
  // 1. Direct assignment on the order
  if (order.assignedCloseuse) {
    const user = await EcomUser.findOne({ _id: order.assignedCloseuse, workspaceId, isActive: true }).select('_id').lean();
    if (user) return [user];
  }

  // 2. Look through CloseuseAssignment to find who handles this order
  const assignments = await CloseuseAssignment.find({ workspaceId, isActive: true }).lean();
  const matchedIds = new Set();

  for (const assignment of assignments) {
    let matched = false;

    // Match by source
    if (!matched && order.sheetRowId) {
      for (const src of assignment.orderSources || []) {
        const sid = String(src.sourceId);
        if (sid === 'legacy' && !/^source_/.test(order.sheetRowId)) { matched = true; break; }
        if (sid !== 'legacy' && order.sheetRowId.startsWith(`source_${sid}_`)) { matched = true; break; }
      }
    }
    if (!matched && order.source === 'webhook') {
      for (const src of assignment.orderSources || []) {
        if (String(src.sourceId) === 'webhook') { matched = true; break; }
      }
    }

    // Match by product name
    if (!matched && order.product) {
      const allProductNames = (assignment.productAssignments || []).flatMap(pa => pa.sheetProductNames || []);
      matched = allProductNames.some(n => n && order.product && n.trim().toLowerCase() === order.product.trim().toLowerCase());
    }

    // Match by city
    if (!matched && order.city) {
      const allCities = (assignment.cityAssignments || []).flatMap(ca => ca.cityNames || []);
      matched = allCities.some(c => c && order.city && c.trim().toLowerCase() === order.city.trim().toLowerCase());
    }

    if (matched) matchedIds.add(String(assignment.closeuseId));
  }

  if (matchedIds.size === 0) return [];
  return await EcomUser.find({ _id: { $in: [...matchedIds] }, workspaceId, isActive: true }).select('_id').lean();
};

/**
 * Notify admins and the responsible closeuse about a livreur action.
 * For the 'delivered' action, also sends push notifications.
 */
export const notifyAdminsLivreurAction = async (workspaceId, livreur, order, action) => {
  const livreurName = livreur.name || livreur.email || 'Livreur';
  const orderRef = order.orderId ? `#${order.orderId}` : '';
  const clientLabel = order.clientName || 'Client';

  const actionMap = {
    pickup_confirmed: {
      title: 'Commande récupérée 🚚',
      message: `${livreurName} a récupéré la commande ${orderRef} — ${clientLabel}`,
      type: 'order_shipped',
      icon: 'order'
    },
    delivered: {
      title: 'Commande livrée ✅',
      message: `${livreurName} a livré la commande ${orderRef} — ${clientLabel}`,
      type: 'order_delivered',
      icon: 'order'
    },
    refused: {
      title: 'Commande refusée ⚠️',
      message: `${livreurName} a refusé la commande ${orderRef} — ${clientLabel}`,
      type: 'order_status',
      icon: 'alert'
    },
    issue: {
      title: 'Problème de livraison ⚠️',
      message: `${livreurName} a signalé un problème pour la commande ${orderRef} — ${clientLabel}`,
      type: 'order_returned',
      icon: 'alert'
    }
  };

  const notifData = actionMap[action];
  if (!notifData) return;

  try {
    // All admins always get notified
    const admins = await EcomUser.find({
      workspaceId,
      role: { $in: ['ecom_admin', 'super_admin'] },
      isActive: true
    }).select('_id').lean();

    // Only the responsible closeuse gets notified (not all closeuses)
    const responsibleCloseuses = await findResponsibleCloseuses(workspaceId, order).catch(() => []);

    const recipients = [...admins, ...responsibleCloseuses];

    // De-duplicate in case an admin is also returned
    const seen = new Set();
    const uniqueRecipients = recipients.filter(r => {
      const id = String(r._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Send in-app notifications
    await Promise.all(uniqueRecipients.map(recipient =>
      createNotification({
        workspaceId,
        userId: recipient._id,
        type: notifData.type,
        title: notifData.title,
        message: notifData.message,
        icon: notifData.icon,
        link: `/ecom/orders/${order._id}`,
        metadata: { orderId: order._id, action, livreurId: livreur._id }
      })
    ));

    // For 'delivered': also send push notifications to each recipient
    if (action === 'delivered') {
      const pushPayload = {
        title: '✅ Commande livrée !',
        body: `${livreurName} a livré la commande ${orderRef} — ${clientLabel}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        tag: `order-delivered-${order._id}`,
        data: {
          type: 'order_delivered',
          orderId: String(order._id),
          url: `/ecom/orders/${order._id}`
        },
        requireInteraction: false
      };

      await Promise.all(uniqueRecipients.map(recipient =>
        sendPushNotificationToUser(recipient._id, pushPayload).catch(() => {})
      ));
    }
  } catch (err) {
    console.warn('⚠️ notifyAdminsLivreurAction failed:', err.message);
  }
};
