import webpush from 'web-push';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

/**
 * Configuration Web Push pour les notifications push natives
 * 
 * Ce module configure la bibliothèque web-push avec les clés VAPID
 * et fournit des fonctions utilitaires pour envoyer des notifications.
 */

// ============================================
// 1. RÉCUPÉRATION DES CLÉS VAPID
// ============================================

/**
 * Clé publique VAPID
 * - Utilisée côté frontend pour s'abonner aux notifications
 * - Peut être exposée publiquement (dans le code React)
 * - Format: chaîne base64url (87 caractères généralement)
 */
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;

/**
 * Clé privée VAPID
 * - Utilisée côté backend pour signer les notifications
 * - DOIT rester secrète (uniquement dans .env, jamais dans le code frontend)
 * - Format: chaîne base64url
 */
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

/**
 * Subject VAPID (sujet/contact)
 * - Email ou URL de contact pour identifier votre application
 * - Format requis: "mailto:votre-email@example.com" ou "https://votre-site.com"
 * - Utilisé par les navigateurs pour identifier l'expéditeur
 */
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@example.com';

// ============================================
// 2. VALIDATION DES CONFIGURATIONS
// ============================================

/**
 * Vérifie que toutes les clés VAPID sont présentes
 * Affiche des warnings si des clés manquent
 */
const validateVapidKeys = () => {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('⚠️  VAPID_PUBLIC_KEY non défini dans .env');
    console.warn('   Les notifications push ne fonctionneront pas sans cette clé');
    return false;
  }

  if (!VAPID_PRIVATE_KEY) {
    console.warn('⚠️  VAPID_PRIVATE_KEY non défini dans .env');
    console.warn('   Les notifications push ne fonctionneront pas sans cette clé');
    return false;
  }

  if (!VAPID_SUBJECT) {
    console.warn('⚠️  VAPID_SUBJECT non défini dans .env');
    console.warn('   Utilisation de la valeur par défaut:', VAPID_SUBJECT);
  }

  return true;
};

// ============================================
// 3. CONFIGURATION DE WEB-PUSH
// ============================================

/**
 * Initialise la configuration web-push avec les clés VAPID
 * Cette fonction DOIT être appelée avant d'utiliser webpush.sendNotification()
 * 
 * @throws {Error} Si les clés VAPID sont manquantes ou invalides
 */
export const configureWebPush = () => {
  // Vérifier que les clés sont présentes
  if (!validateVapidKeys()) {
    throw new Error('Configuration VAPID incomplète. Vérifiez votre fichier .env');
  }

  try {
    // Configurer web-push avec les clés VAPID
    // Cette configuration est globale et sera utilisée pour toutes les notifications
    webpush.setVapidDetails(
      VAPID_SUBJECT,        // Subject (contact email/URL)
      VAPID_PUBLIC_KEY,     // Clé publique VAPID
      VAPID_PRIVATE_KEY     // Clé privée VAPID
    );

    console.log('✅ Web Push configuré avec succès');
    console.log('   - Subject:', VAPID_SUBJECT);
    console.log('   - Public Key:', VAPID_PUBLIC_KEY.substring(0, 30) + '...');
    console.log('   - Private Key:', VAPID_PRIVATE_KEY.substring(0, 10) + '... (masquée)');
    
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la configuration Web Push:', error.message);
    throw error;
  }
};

// ============================================
// 4. FONCTION UTILITAIRE POUR ENVOYER DES NOTIFICATIONS
// ============================================

/**
 * Envoie une notification push à un utilisateur
 * 
 * @param {Object} subscription - Objet d'abonnement push (PushSubscription)
 *                                Format: { endpoint: string, keys: { p256dh: string, auth: string } }
 * @param {Object} payload - Données de la notification
 * @param {string} payload.title - Titre de la notification
 * @param {string} payload.body - Corps du message
 * @param {string} [payload.icon] - URL de l'icône (optionnel)
 * @param {string} [payload.url] - URL à ouvrir au clic (optionnel)
 * @param {Object} [options] - Options supplémentaires
 * @param {number} [options.TTL=3600] - Time To Live en secondes (durée de vie de la notification)
 * @param {string} [options.urgency='normal'] - Urgence: 'very-low', 'low', 'normal', 'high'
 * 
 * @returns {Promise<void>} Promise qui se résout si l'envoi réussit
 * 
 * @example
 * const subscription = {
 *   endpoint: 'https://fcm.googleapis.com/...',
 *   keys: {
 *     p256dh: '...',
 *     auth: '...'
 *   }
 * };
 * 
 * await sendPushNotification(subscription, {
 *   title: 'Nouveau message',
 *   body: 'Vous avez reçu un nouveau message',
 *   icon: '/icon.png',
 *   url: '/messages'
 * });
 */
export const sendPushNotification = async (subscription, payload, options = {}) => {
  // Vérifier que web-push est configuré
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error('Web Push n\'est pas configuré. Appelez configureWebPush() d\'abord.');
  }

  // Valider que l'abonnement est valide
  if (!subscription || !subscription.endpoint) {
    throw new Error('Abonnement push invalide: endpoint manquant');
  }

  if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    throw new Error('Abonnement push invalide: clés manquantes');
  }

  // Préparer le payload JSON
  // Le payload doit être une chaîne JSON pour être envoyé via Web Push API
  const payloadString = JSON.stringify({
    title: payload.title || 'Notification',
    body: payload.body || '',
    icon: payload.icon || '/icon-192x192.png', // Icône par défaut
    badge: payload.badge || '/badge-72x72.png', // Badge pour les notifications
    image: payload.image, // Image grande (optionnel)
    data: {
      url: payload.url || '/', // URL à ouvrir au clic
      ...payload.data // Autres données personnalisées
    },
    // Options de notification
    requireInteraction: payload.requireInteraction || false, // Rester visible jusqu'à interaction
    silent: payload.silent || false, // Notification silencieuse
    tag: payload.tag, // Tag pour remplacer les notifications similaires
    timestamp: Date.now() // Timestamp de création
  });

  // Options d'envoi
  const sendOptions = {
    TTL: options.TTL || 3600, // Time To Live: 1 heure par défaut
    // Urgence de la notification
    urgency: options.urgency || 'normal', // 'very-low', 'low', 'normal', 'high'
    // Headers personnalisés (optionnel)
    headers: options.headers || {}
  };

  try {
    // Envoyer la notification
    // webpush.sendNotification() utilise les clés VAPID configurées avec setVapidDetails()
    await webpush.sendNotification(subscription, payloadString, sendOptions);
    
    console.log('✅ Notification push envoyée avec succès');
    console.log('   - Endpoint:', subscription.endpoint.substring(0, 50) + '...');
    console.log('   - Title:', payload.title);
    
    return { success: true };
  } catch (error) {
    // Gestion des erreurs spécifiques
    if (error.statusCode === 410) {
      // 410 Gone: L'abonnement n'existe plus (expiré ou révoqué)
      console.warn('⚠️  Abonnement expiré (410):', subscription.endpoint.substring(0, 50));
      return { success: false, error: 'subscription_expired', statusCode: 410 };
    } else if (error.statusCode === 404) {
      // 404 Not Found: L'abonnement n'existe pas
      console.warn('⚠️  Abonnement introuvable (404):', subscription.endpoint.substring(0, 50));
      return { success: false, error: 'subscription_not_found', statusCode: 404 };
    } else if (error.statusCode === 413) {
      // 413 Payload Too Large: Le payload est trop volumineux (> 4KB)
      console.error('❌ Payload trop volumineux (413):', error.message);
      return { success: false, error: 'payload_too_large', statusCode: 413 };
    } else {
      // Autre erreur
      console.error('❌ Erreur lors de l\'envoi de la notification:', error.message);
      console.error('   - Status Code:', error.statusCode);
      console.error('   - Stack:', error.stack);
      return { success: false, error: error.message, statusCode: error.statusCode };
    }
  }
};

// ============================================
// 5. FONCTION POUR ENVOYER À PLUSIEURS UTILISATEURS
// ============================================

/**
 * Envoie une notification à plusieurs abonnements (utilisateurs)
 * Gère les erreurs individuellement pour ne pas bloquer les autres envois
 * 
 * @param {Array<Object>} subscriptions - Tableau d'abonnements push
 * @param {Object} payload - Données de la notification (même format que sendPushNotification)
 * @param {Object} [options] - Options supplémentaires
 * 
 * @returns {Promise<Object>} Résultat avec succès/échecs
 * 
 * @example
 * const subscriptions = [subscription1, subscription2, subscription3];
 * const result = await sendPushNotificationToMany(subscriptions, {
 *   title: 'Mise à jour disponible',
 *   body: 'Une nouvelle version est disponible'
 * });
 * console.log(`Envoyé: ${result.success}, Échecs: ${result.failed}`);
 */
export const sendPushNotificationToMany = async (subscriptions, payload, options = {}) => {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  // Envoyer à tous les abonnements en parallèle
  // Utiliser Promise.allSettled() pour ne pas échouer si un envoi échoue
  const promises = subscriptions.map(async (subscription, index) => {
    try {
      const result = await sendPushNotification(subscription, payload, options);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          index,
          endpoint: subscription.endpoint?.substring(0, 50),
          error: result.error,
          statusCode: result.statusCode
        });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        index,
        endpoint: subscription.endpoint?.substring(0, 50),
        error: error.message
      });
    }
  });

  await Promise.allSettled(promises);

  console.log(`📊 Notifications envoyées: ${results.success} succès, ${results.failed} échecs`);
  
  return results;
};

// ============================================
// 6. EXPORT DES CLÉS (pour le frontend)
// ============================================

/**
 * Retourne la clé publique VAPID
 * Cette fonction peut être utilisée pour exposer la clé publique au frontend
 * via une route API (ex: GET /api/push/public-key)
 * 
 * @returns {string|null} La clé publique VAPID ou null si non configurée
 */
export const getPublicKey = () => {
  return VAPID_PUBLIC_KEY;
};

// ============================================
// 7. EXPORT PAR DÉFAUT
// ============================================

export default {
  configureWebPush,
  sendPushNotification,
  sendPushNotificationToMany,
  getPublicKey,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT
};
