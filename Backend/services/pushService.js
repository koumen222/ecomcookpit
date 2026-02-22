import webpush from 'web-push';
import Subscription from '../models/Subscription.js';

// Configuration VAPID (à mettre dans .env)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BL1HvKjXQh4jL8J9G2L3Q9R0T1Y2U3I4O5P6A7S8D9E0F1G2H3I4J5K6L7M8N9O0P1Q2R3S4T5U6V7W8X9Y0Z1',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'x9J8K7L6M5N4O3P2Q1R0S9T8U7V6W5X4Y3Z2A1B0C9D8E7F6G5H4I3J2K1L0M9N8O7P6Q5R4S3T2U1V0W9X8Y7Z6'
};

webpush.setVapidDetails(
  'mailto:contact@votre-app.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Vérifier si un type de notification push est activé pour un workspace
 */
const isPushNotificationEnabled = async (workspaceId, notificationType) => {
  try {
    const { default: WorkspaceSettings } = await import('../models/WorkspaceSettings.js');
    const settings = await WorkspaceSettings.findOne({ workspaceId });
    
    if (!settings || !settings.pushNotifications) {
      return true; // Par défaut, toutes les notifications sont activées
    }
    
    return settings.pushNotifications[notificationType] !== false;
  } catch (error) {
    console.warn('⚠️ Erreur vérification préférences push:', error.message);
    return true; // En cas d'erreur, on envoie quand même
  }
};

/**
 * Envoyer une notification push à tous les abonnés d'un workspace
 * @param {string} workspaceId - ID du workspace
 * @param {object} notificationData - Données de la notification
 * @param {string} notificationType - Type de notification (push_new_orders, push_status_changes, etc.)
 */
const sendPushNotification = async (workspaceId, notificationData, notificationType = null) => {
  try {
    // Vérifier si ce type de notification est activé
    if (notificationType) {
      const isEnabled = await isPushNotificationEnabled(workspaceId, notificationType);
      if (!isEnabled) {
        console.log(`🔕 Notification push ${notificationType} désactivée pour workspace: ${workspaceId}`);
        return { success: false, total: 0, successful: 0, failed: 0, disabled: true };
      }
    }
    
    console.log(`📱 Envoi notification push pour workspace: ${workspaceId}`);
    
    // Récupérer tous les abonnés du workspace
    const subscriptions = await Subscription.find({ workspaceId });
    
    if (subscriptions.length === 0) {
      console.log(`ℹ️ Aucun abonné push trouvé pour workspace: ${workspaceId}`);
      return { success: false, total: 0, successful: 0, failed: 0 };
    }
    
    console.log(`📡 ${subscriptions.length} abonnés trouvés`);
    
    // Préparer la notification
    const payload = JSON.stringify({
      title: notificationData.title,
      body: notificationData.body,
      icon: notificationData.icon || '/icons/icon-192x192.png',
      badge: notificationData.badge || '/icons/badge.png',
      tag: notificationData.tag || 'default',
      data: notificationData.data || {},
      actions: notificationData.actions || [],
      requireInteraction: notificationData.requireInteraction || false,
      silent: notificationData.silent || false
    });
    
    // Envoyer à chaque abonné
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
              }
            },
            payload,
            {
              TTL: 86400, // 24 heures
              urgency: 'normal',
              topic: notificationData.tag
            }
          );
          
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          console.error(`❌ Erreur envoi à l'abonné ${subscription._id}:`, error);
          
          // Si l'abonnement est invalide, le supprimer
          if (error.statusCode === 410) {
            console.log(`🗑️ Suppression abonnement invalide: ${subscription._id}`);
            await Subscription.findByIdAndDelete(subscription._id);
          }
          
          return { success: false, error: error.message, subscriptionId: subscription._id };
        }
      })
    );
    
    // Compter les succès
    const successful = results.filter(r => r.value?.success).length;
    const failed = results.length - successful;
    
    console.log(`📱 Notification push envoyée: ${successful} succès, ${failed} échecs`);
    
    return {
      success: successful > 0,
      total: results.length,
      successful,
      failed
    };
    
  } catch (error) {
    console.error('❌ Erreur critique notification push:', error);
    throw error;
  }
};

/**
 * Envoyer une notification push à un utilisateur spécifique
 */
const sendPushNotificationToUser = async (userId, notificationData) => {
  try {
    const subscriptions = await Subscription.find({ userId });
    
    if (subscriptions.length === 0) {
      console.log(`ℹ️ Aucun abonné push trouvé pour utilisateur: ${userId}`);
      return;
    }
    
    const payload = JSON.stringify(notificationData);
    
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth
              }
            },
            payload
          );
          
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          console.error(`❌ Erreur envoi à l'abonné ${subscription._id}:`, error);
          
          if (error.statusCode === 410) {
            await Subscription.findByIdAndDelete(subscription._id);
          }
          
          return { success: false, error: error.message, subscriptionId: subscription._id };
        }
      })
    );
    
    const successful = results.filter(r => r.value?.success).length;
    
    console.log(`📱 Notification push utilisateur ${userId}: ${successful} succès`);
    
    return {
      success: successful > 0,
      total: results.length,
      successful
    };
    
  } catch (error) {
    console.error('❌ Erreur notification push utilisateur:', error);
    throw error;
  }
};

/**
 * Notifier les nouveaux événements en temps réel
 */
const notifyRealtimeEvent = async (workspaceId, eventType, eventData) => {
  const notifications = {
    'new_order': {
      title: '🛒 Nouvelle commande',
      body: `Commande #${eventData.orderId} de ${eventData.clientName}`,
      icon: '/icons/new-order.png',
      tag: 'new-order',
      data: { orderId: eventData.orderId, type: 'new_order' },
      actions: [
        { action: 'view-order', title: 'Voir la commande' },
        { action: 'dismiss', title: 'Fermer' }
      ]
    },
    'order_status_change': {
      title: '📦 Statut commande mis à jour',
      body: `Commande #${eventData.orderId}: ${eventData.oldStatus} → ${eventData.newStatus}`,
      icon: '/icons/status-change.png',
      tag: 'status-change',
      data: { orderId: eventData.orderId, type: 'status_change' }
    },
    'sync_completed': {
      title: '📊 Synchronisation terminée',
      body: `${eventData.imported} nouvelles, ${eventData.updated} mises à jour`,
      icon: '/icons/sync-success.png',
      tag: 'sync-completed',
      data: { type: 'sync_completed', ...eventData }
    }
  };
  
  const notification = notifications[eventType];
  if (notification) {
    await sendPushNotification(workspaceId, {
      ...notification,
      ...eventData
    });
  }
};

export {
  sendPushNotification,
  sendPushNotificationToUser,
  notifyRealtimeEvent
};
