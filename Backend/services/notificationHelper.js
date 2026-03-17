import Notification from '../models/Notification.js';
import { getIO } from './socketService.js';
import { sendPushNotification } from './pushService.js';

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
 * Notify all workspace members about a new order
 */
export const notifyNewOrder = async (workspaceId, order) => {
  // Créer la notification interne
  const notification = await createNotification({
    workspaceId,
    type: 'order_new',
    title: 'Nouvelle commande',
    message: `${order.clientName || 'Client'} — ${order.product || 'Produit'} (${order.quantity || 1}x)`,
    icon: 'order',
    link: `/ecom/orders/${order._id}`,
    metadata: { orderId: order._id }
  });

  // Envoyer la notification push
  try {
    await sendPushNotification(
      workspaceId,
      {
        title: '🛒 Nouvelle commande !',
        body: `${order.clientName || 'Client'} — ${order.product || 'Produit'} (${order.quantity || 1}x)`,
        icon: '/icons/order-new.png',
        tag: `order-new-${order._id}`,
        data: {
          type: 'order_new',
          orderId: order._id,
          url: `/ecom/orders/${order._id}`
        },
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'Voir la commande'
          },
          {
            action: 'dismiss',
            title: 'Ignorer'
          }
        ]
      },
      'push_new_orders'
    );
    console.log(`📱 Push notification envoyée pour nouvelle commande: ${order._id}`);
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
