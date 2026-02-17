/**
 * Service Worker pour les notifications push web
 * 
 * Ce Service Worker gère :
 * - La réception des notifications push
 * - L'affichage des notifications
 * - Les clics sur les notifications
 * - La gestion des erreurs
 * 
 * Fichier : public/sw.js
 * Domaine : safitech.shop
 */

// Version du Service Worker (incrémenter pour forcer la mise à jour)
const CACHE_VERSION = '1.0.0';
const CACHE_NAME = `ecom-cockpit-push-${CACHE_VERSION}`;

// ============================================
// 1. INSTALLATION DU SERVICE WORKER
// ============================================

/**
 * Événement déclenché lors de l'installation du Service Worker
 * Permet de mettre en cache les ressources nécessaires
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation...', CACHE_VERSION);
  
  // Forcer l'activation immédiate du nouveau Service Worker
  // (skipWaiting permet d'activer sans attendre la fermeture de tous les onglets)
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cache ouvert:', CACHE_NAME);
      // Vous pouvez ajouter des ressources à mettre en cache ici si nécessaire
      return cache.addAll([
        // Exemple : '/icon-192x192.png', '/icon-512x512.png'
      ]);
    }).catch((error) => {
      console.error('[Service Worker] Erreur lors de l\'installation:', error);
    })
  );
});

// ============================================
// 2. ACTIVATION DU SERVICE WORKER
// ============================================

/**
 * Événement déclenché lors de l'activation du Service Worker
 * Permet de nettoyer les anciens caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation...');
  
  // Prendre le contrôle immédiatement de tous les clients (onglets)
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendre le contrôle de tous les clients
      self.clients.claim()
    ])
  );
  
  console.log('[Service Worker] Service Worker activé et prêt');
});

// ============================================
// 3. RÉCEPTION DES NOTIFICATIONS PUSH
// ============================================

/**
 * Événement déclenché lorsqu'une notification push est reçue
 * Même si l'utilisateur n'est pas sur le site, cette fonction s'exécute
 * 
 * @param {PushEvent} event - Événement push contenant les données
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Notification push reçue');
  
  // Récupérer les données de la notification
  let notificationData = {
    title: 'Ecom Cockpit',
    body: 'Vous avez reçu une nouvelle notification',
    icon: '/ecom-logo (1).png',
    badge: '/icons/icon-72x72.png',
    tag: 'default',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // Parser les données si elles sont présentes
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        image: data.image, // Image grande (optionnel)
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        data: {
          url: data.data?.url || data.url || '/',
          ...data.data,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error('[Service Worker] Erreur lors du parsing des données:', error);
      // Utiliser les données par défaut
    }
  }
  
  // Options de la notification
  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    silent: notificationData.silent,
    data: notificationData.data,
    // Vibrations sur mobile (si supporté)
    vibrate: [200, 100, 200],
    // Actions de notification (si supporté)
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ],
    // Timestamp
    timestamp: notificationData.data.timestamp
  };
  
  // Afficher la notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log('[Service Worker] Notification affichée:', notificationData.title);
      })
      .catch((error) => {
        console.error('[Service Worker] Erreur lors de l\'affichage de la notification:', error);
      })
  );
});

// ============================================
// 4. CLIC SUR UNE NOTIFICATION
// ============================================

/**
 * Événement déclenché lorsqu'un utilisateur clique sur une notification
 * 
 * @param {NotificationEvent} event - Événement de notification
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Clic sur la notification:', event.notification.tag);
  
  // Fermer la notification
  event.notification.close();
  
  // Récupérer l'URL à ouvrir depuis les données de la notification
  const urlToOpen = event.notification.data?.url || '/';
  
  // Gérer les actions de notification
  if (event.action === 'close') {
    // L'utilisateur a cliqué sur "Fermer", ne rien faire
    console.log('[Service Worker] Notification fermée');
    return;
  }
  
  // Ouvrir ou focaliser la fenêtre/onglet
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Chercher une fenêtre ouverte avec l'URL du site
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        // Vérifier si le client correspond au domaine
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Ouvrir l'URL dans la fenêtre existante et la focaliser
          return client.focus().then(() => {
            // Naviguer vers l'URL si nécessaire
            if (urlToOpen !== '/') {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      
      // Aucune fenêtre ouverte, en ouvrir une nouvelle
      if (clients.openWindow) {
        const fullUrl = new URL(urlToOpen, self.location.origin).href;
        console.log('[Service Worker] Ouverture d\'une nouvelle fenêtre:', fullUrl);
        return clients.openWindow(fullUrl);
      }
    }).catch((error) => {
      console.error('[Service Worker] Erreur lors de l\'ouverture de la fenêtre:', error);
    })
  );
});

// ============================================
// 5. FERMETURE D'UNE NOTIFICATION
// ============================================

/**
 * Événement déclenché lorsqu'une notification est fermée
 * 
 * @param {NotificationEvent} event - Événement de notification
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notification fermée:', event.notification.tag);
  
  // Vous pouvez envoyer des analytics ici si nécessaire
  // Exemple : envoyer un événement au backend pour tracker les notifications fermées
});

// ============================================
// 6. GESTION DES ERREURS
// ============================================

/**
 * Gestion globale des erreurs non capturées
 */
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Erreur non capturée:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Promise rejetée non gérée:', event.reason);
});

// ============================================
// 7. MESSAGE DEPUIS LE CLIENT (OPTIONNEL)
// ============================================

/**
 * Écouter les messages envoyés depuis le client (page web)
 * Utile pour synchroniser l'état ou recevoir des instructions
 * 
 * @param {MessageEvent} event - Message reçu
 */
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message reçu:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Forcer l'activation du nouveau Service Worker
    self.skipWaiting();
  }
  
  // Répondre au client
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage({
      success: true,
      message: 'Message reçu par le Service Worker'
    });
  }
});

// ============================================
// 8. FONCTIONS UTILITAIRES
// ============================================

/**
 * Convertit une URL relative en URL absolue
 * 
 * @param {string} url - URL relative
 * @returns {string} URL absolue
 */
function getAbsoluteUrl(url) {
  return new URL(url, self.location.origin).href;
}

/**
 * Log avec timestamp pour le debugging
 * 
 * @param {string} message - Message à logger
 * @param {any} data - Données supplémentaires
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Service Worker] ${message}`, data || '');
}

// ============================================
// 9. INITIALISATION
// ============================================

console.log('[Service Worker] Service Worker chargé et prêt');
console.log('[Service Worker] Version:', CACHE_VERSION);
console.log('[Service Worker] Domaine:', self.location.origin);
