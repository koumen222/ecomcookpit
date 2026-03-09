/**
 * Hook pour enregistrer et contrôler le Service Worker
 * Optimisé pour une navigation ultra-rapide
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * Enregistre le Service Worker
 */
export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'imports'
    });

    console.log('[SW] Registered:', registration.scope);

    // Gérer les mises à jour
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] New version available');
          // Option: auto-skip waiting pour mise à jour immédiate
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

/**
 * Hook pour utiliser le Service Worker
 */
export function useServiceWorker() {
  const [registration, setRegistration] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [cacheStats, setCacheStats] = useState({ static: 0, api: 0, images: 0, total: 0 });

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator);
    
    registerSW().then(reg => {
      setRegistration(reg);
    });
  }, []);

  // Précharger des URLs dans le cache
  const preloadUrls = useCallback((urls) => {
    if (!registration?.active) return;
    
    registration.active.postMessage({
      type: 'PRELOAD_URLS',
      payload: { urls }
    });
  }, [registration]);

  // Vider le cache
  const clearCache = useCallback(() => {
    if (!registration?.active) return Promise.resolve();
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      
      registration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );
    });
  }, [registration]);

  // Obtenir les stats du cache
  const getCacheStats = useCallback(() => {
    if (!registration?.active) return Promise.resolve({ total: 0 });
    
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        setCacheStats(event.data);
        resolve(event.data);
      };
      
      registration.active.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [channel.port2]
      );
    });
  }, [registration]);

  return {
    registration,
    isSupported,
    cacheStats,
    preloadUrls,
    clearCache,
    getCacheStats
  };
}

/**
 * Précharge les ressources critiques au démarrage
 */
export function useCriticalPrefetch() {
  const { preloadUrls, isSupported } = useServiceWorker();

  useEffect(() => {
    if (!isSupported) return;

    // Précharger les pages fréquemment accédées
    const criticalUrls = [
      '/ecom/dashboard',
      '/ecom/orders',
      '/ecom/products',
      '/ecom/clients'
    ];

    // Attendre que l'app soit stable
    const timer = setTimeout(() => {
      preloadUrls(criticalUrls);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSupported, preloadUrls]);
}

/**
 * Hook pour synchronisation en arrière-plan
 */
export function useBackgroundSync() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      return;
    }

    navigator.serviceWorker.ready.then(registration => {
      setIsReady(true);
      
      // Enregistrer une sync périodique
      registration.sync?.register('background-sync').catch(() => {});
    });
  }, []);

  const sync = useCallback(async () => {
    if (!isReady) return;
    
    const registration = await navigator.serviceWorker.ready;
    await registration.sync?.register('background-sync');
  }, [isReady]);

  return { isReady, sync };
}

/**
 * Hook pour les notifications push
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const subscribe = useCallback(async () => {
    if (permission !== 'granted') {
      const newPermission = await requestPermission();
      if (newPermission !== 'granted') return null;
    }

    const registration = await navigator.serviceWorker.ready;
    
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.VAPID_PUBLIC_KEY || ''
        )
      });
      
      return subscription;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return null;
    }
  }, [permission, requestPermission]);

  return {
    permission,
    requestPermission,
    subscribe
  };
}

// Helper pour convertir la clé VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Hook pour le statut de connexion
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Connection API (si disponible)
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      setConnectionType(connection.effectiveType);
      connection.addEventListener('change', () => {
        setConnectionType(connection.effectiveType);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}

export default {
  registerSW,
  useServiceWorker,
  useCriticalPrefetch,
  useBackgroundSync,
  usePushNotifications,
  useNetworkStatus
};
