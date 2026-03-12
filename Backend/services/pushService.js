import webpush from 'web-push';
import Subscription from '../models/Subscription.js';
import { validateAndNormalizeSubscription } from '../utils/vapidUtils.js';

// Configuration VAPID (depuis .env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@safitech.shop';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('✅ VAPID configuré pour les notifications push');
} else {
  console.warn('⚠️ VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquant — notifications push désactivées');
}

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
    
    // Récupérer tous les abonnés du workspace (timeout 5s)
    const subscriptions = await Subscription.find({ workspaceId }).maxTimeMS(5000).catch(() => []);
    
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
          // Valider et normaliser le subscription (Base64URL)
          const normalizedSub = validateAndNormalizeSubscription({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          });
          
          await webpush.sendNotification(
            normalizedSub,
            payload,
            {
              TTL: 86400, // 24 heures
              urgency: 'normal',
              topic: notificationData.tag
            }
          );
          
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          console.error(`❌ Erreur envoi à l'abonné ${subscription._id}:`, error.message);
          
          // Si l'abonnement est invalide (410) ou mal formaté, le supprimer
          if (error.statusCode === 410 || error.message?.includes('Base64') || error.message?.includes('32 characters')) {
            console.log(`🗑️ Suppression abonnement invalide: ${subscription._id}`);
            await Subscription.findByIdAndDelete(subscription._id).catch(() => {});
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
    console.warn('⚠️ Push notification failed:', error.message);
    return { success: false, total: 0, successful: 0, failed: 0 };
  }
};

/**
 * Envoyer une notification push à un utilisateur spécifique
 */
const sendPushNotificationToUser = async (userId, notificationData) => {
  try {
    const subscriptions = await Subscription.find({ userId }).maxTimeMS(5000).catch(() => []);
    
    if (subscriptions.length === 0) {
      console.log(`ℹ️ Aucun abonné push trouvé pour utilisateur: ${userId}`);
      return;
    }
    
    const payload = JSON.stringify(notificationData);
    
    const results = await Promise.allSettled(
      subscriptions.map(async (subscription) => {
        try {
          // Valider et normaliser le subscription (Base64URL)
          const normalizedSub = validateAndNormalizeSubscription({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth
            }
          });
          
          await webpush.sendNotification(
            normalizedSub,
            payload
          );
          
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          console.error(`❌ Erreur envoi à l'abonné ${subscription._id}:`, error.message);
          
          // Si l'abonnement est invalide (410) ou mal formaté, le supprimer
          if (error.statusCode === 410 || error.message?.includes('Base64') || error.message?.includes('32 characters')) {
            await Subscription.findByIdAndDelete(subscription._id).catch(() => {});
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
