/**
 * Service Worker pour caching intelligent et offline support
 * Place this as public/sw.js
 */

const CACHE_VERSION = 'v1-' + new Date().toISOString().split('T')[0];
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('✅ Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                (cacheName.startsWith('static-') && cacheName !== STATIC_CACHE) ||
                (cacheName.startsWith('dynamic-') && cacheName !== DYNAMIC_CACHE) ||
                (cacheName.startsWith('api-') && cacheName !== API_CACHE)
              );
            })
            .map((cacheName) => {
              console.log(`🗑️ Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(networkFirst(request));
  }

  // Static assets - Cache first, fallback to network
  if (isStaticAsset(url)) {
    return event.respondWith(cacheFirst(request));
  }

  // HTML pages - Network first, fallback to cache
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    return event.respondWith(networkFirst(request));
  }

  // Default - Cache first
  event.respondWith(cacheFirst(request));
});

/**
 * Network-first strategy
 * Tries network first, falls back to cache on failure
 */
async function networkFirst(request) {
  const cacheType = request.url.includes('/api/') ? API_CACHE : DYNAMIC_CACHE;

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(cacheType);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      console.log(`📦 Serving from cache: ${request.url}`);
      return cached;
    }

    // No cache available, return offline page or error
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Cache-first strategy
 * Tries cache first, falls back to network
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    console.log(`📦 Serving from cache: ${request.url}`);
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('❌ Fetch failed:', error);
    return new Response('Resource not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i.test(url.pathname);
}

/**
 * Message handler - cache management from main thread
 */
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'clear-cache':
      clearAllCaches();
      event.ports[0].postMessage({ success: true });
      break;

    case 'cache-urls':
      cacheUrls(payload.urls);
      event.ports[0].postMessage({ success: true });
      break;

    case 'skip-waiting':
      self.skipWaiting();
      break;

    default:
      break;
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

/**
 * Pre-cache URLs
 */
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  return cache.addAll(urls);
}

// Handle push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'EcomCookpit',
    body: 'New notification'
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: notificationData.tag || 'notification',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Open'
        }
      ]
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].url === '/' && 'focus' in clientList[i]) {
            return clientList[i].focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

console.log('✅ Service Worker loaded');
