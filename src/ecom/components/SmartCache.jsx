import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';

/**
 * Système de cache ultra-performant pour l'application
 * Remplace les appels API redondants par des données en cache
 * 
 * Caractéristiques:
 * - Cache en mémoire ultra-rapide
 * - staleTime configurable (défaut: 5 minutes)
 * - Rafraîchissement silencieux en arrière-plan
 * - Invalidation ciblée
 * - Pas de refetch inutile lors de la navigation
 */

const CACHE_DEFAULTS = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000,   // 10 minutes
  retryDelay: 1000,
  retryCount: 2
};

// Cache global
const cacheStore = new Map();
const subscribers = new Map();

/**
 * Classe CacheEntry pour gérer une entrée de cache
 */
class CacheEntry {
  constructor(key, data = null, options = {}) {
    this.key = key;
    this.data = data;
    this.error = null;
    this.timestamp = Date.now();
    this.isLoading = false;
    this.isStale = false;
    this.promise = null;
    this.options = { ...CACHE_DEFAULTS, ...options };
    this.subscribers = new Set();
  }

  isValid() {
    if (this.error) return false;
    if (!this.data) return false;
    const age = Date.now() - this.timestamp;
    return age < this.options.staleTime;
  }

  markStale() {
    this.isStale = true;
  }

  update(data) {
    this.data = data;
    this.error = null;
    this.timestamp = Date.now();
    this.isStale = false;
    this.isLoading = false;
    this.notifySubscribers();
  }

  setError(error) {
    this.error = error;
    this.isLoading = false;
    this.notifySubscribers();
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.notifySubscribers();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => {
      try {
        cb({
          data: this.data,
          error: this.error,
          isLoading: this.isLoading,
          isStale: this.isStale
        });
      } catch (e) {
        console.warn('Cache subscriber error:', e);
      }
    });
  }
}

/**
 * Context pour le cache
 */
const SmartCacheContext = createContext({
  get: () => null,
  set: () => {},
  invalidate: () => {},
  prefetch: () => {},
  subscribe: () => () => {}
});

/**
 * Provider pour le système de cache intelligent
 */
export function SmartCacheProvider({ children }) {
  const prefetchQueue = useRef([]);
  const prefetchTimeout = useRef(null);

  // Récupérer une entrée du cache
  const get = useCallback((key) => {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    return entry;
  }, []);

  // Définir une entrée dans le cache
  const set = useCallback((key, data, options = {}) => {
    let entry = cacheStore.get(key);
    if (!entry) {
      entry = new CacheEntry(key, data, options);
      cacheStore.set(key, entry);
    } else {
      entry.update(data);
    }
    return entry;
  }, []);

  // S'inscrire aux changements
  const subscribe = useCallback((key, callback) => {
    let entry = cacheStore.get(key);
    if (!entry) {
      entry = new CacheEntry(key);
      cacheStore.set(key, entry);
    }
    return entry.subscribe(callback);
  }, []);

  // Invalider une entrée ou un pattern
  const invalidate = useCallback((keyOrPattern) => {
    if (typeof keyOrPattern === 'string') {
      // Invalider une clé spécifique
      const entry = cacheStore.get(keyOrPattern);
      if (entry) {
        entry.markStale();
        console.log(`🗑️ Cache invalidated: ${keyOrPattern}`);
      }
    } else if (keyOrPattern instanceof RegExp) {
      // Invalider par pattern
      for (const [key, entry] of cacheStore) {
        if (keyOrPattern.test(key)) {
          entry.markStale();
          console.log(`🗑️ Cache invalidated by pattern: ${key}`);
        }
      }
    } else if (Array.isArray(keyOrPattern)) {
      // Invalider plusieurs clés
      keyOrPattern.forEach(key => invalidate(key));
    }
  }, []);

  // Précharger des données en arrière-plan
  const prefetch = useCallback((key, fetcher, options = {}) => {
    const existing = cacheStore.get(key);
    if (existing && existing.isValid() && !options.force) {
      return Promise.resolve(existing.data);
    }

    // Ajouter à la queue de préchargement
    prefetchQueue.current.push({ key, fetcher, options });
    
    // Traiter la queue avec un délai pour regrouper les requêtes
    clearTimeout(prefetchTimeout.current);
    prefetchTimeout.current = setTimeout(() => {
      const queue = prefetchQueue.current.splice(0, prefetchQueue.current.length);
      
      // Exécuter les préchargements
      queue.forEach(async ({ key, fetcher, options }) => {
        try {
          let entry = cacheStore.get(key);
          if (!entry) {
            entry = new CacheEntry(key, null, options);
            cacheStore.set(key, entry);
          }
          
          if (!entry.isLoading) {
            entry.setLoading(true);
            const data = await fetcher();
            entry.update(data);
            console.log(`⚡ Prefetched: ${key}`);
          }
        } catch (error) {
          console.warn(`❌ Prefetch failed: ${key}`, error.message);
        }
      });
    }, 50);

    return Promise.resolve(null);
  }, []);

  // Nettoyer le cache périodiquement
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of cacheStore) {
        const age = now - entry.timestamp;
        if (age > entry.options.gcTime && entry.subscribers.size === 0) {
          cacheStore.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cache cleaned: ${cleaned} entries removed`);
      }
    }, 60000); // Nettoyage toutes les minutes

    return () => clearInterval(cleanup);
  }, []);

  const value = {
    get,
    set,
    invalidate,
    prefetch,
    subscribe
  };

  return (
    <SmartCacheContext.Provider value={value}>
      {children}
    </SmartCacheContext.Provider>
  );
}

export const useSmartCache = () => useContext(SmartCacheContext);

/**
 * Hook pour utiliser le cache avec gestion automatique
 * Usage: const { data, isLoading, error, refetch } = useCachedQuery(key, fetcher, options)
 */
export function useCachedQuery(key, fetcher, options = {}) {
  const { 
    staleTime = CACHE_DEFAULTS.staleTime,
    gcTime = CACHE_DEFAULTS.gcTime,
    retryCount = CACHE_DEFAULTS.retryCount,
    retryDelay = CACHE_DEFAULTS.retryDelay,
    enabled = true,
    onSuccess,
    onError
  } = options;

  const cache = useSmartCache();
  const [state, setState] = React.useState(() => {
    const entry = cache.get(key);
    return {
      data: entry?.data || null,
      isLoading: enabled && !entry?.data,
      error: entry?.error || null
    };
  });
  const fetchRef = useRef(false);

  // Exécuter le fetcher
  const executeFetch = useCallback(async (isBackground = false) => {
    if (!enabled) return;
    
    try {
      if (!isBackground) {
        setState(prev => ({ ...prev, isLoading: true }));
      }

      const data = await fetcher();
      
      cache.set(key, data, { staleTime, gcTime });
      setState({ data, isLoading: false, error: null });
      
      if (onSuccess) onSuccess(data);
      
      return data;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false, error }));
      if (onError) onError(error);
      throw error;
    }
  }, [key, fetcher, enabled, cache, staleTime, gcTime, onSuccess, onError]);

  // Refetch manuel
  const refetch = useCallback(() => executeFetch(false), [executeFetch]);

  // Effet pour le chargement initial
  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    const entry = cache.get(key);
    
    if (entry && entry.isValid()) {
      // Données en cache valides
      setState({
        data: entry.data,
        isLoading: false,
        error: null
      });
      
      // Rafraîchissement silencieux en arrière-plan si stale
      if (entry.isStale) {
        executeFetch(true).catch(() => {});
      }
    } else if (enabled) {
      // Pas de données valides, charger
      executeFetch(false).catch(() => {});
    }

    // S'abonner aux changements du cache
    const unsubscribe = cache.subscribe(key, (update) => {
      setState({
        data: update.data,
        isLoading: update.isLoading,
        error: update.error
      });
    });

    return unsubscribe;
  }, [key, enabled, cache, executeFetch]);

  return {
    ...state,
    refetch
  };
}

/**
 * Hook pour une mutation avec invalidation de cache
 */
export function useCachedMutation(mutationFn, options = {}) {
  const { 
    onSuccess, 
    onError, 
    invalidateKeys = [] 
  } = options;
  
  const cache = useSmartCache();
  const [state, setState] = React.useState({
    isLoading: false,
    error: null,
    data: null
  });

  const mutate = useCallback(async (variables) => {
    setState({ isLoading: true, error: null, data: null });
    
    try {
      const result = await mutationFn(variables);
      
      // Invalider les clés concernées
      invalidateKeys.forEach(key => cache.invalidate(key));
      
      setState({ isLoading: false, error: null, data: result });
      if (onSuccess) onSuccess(result, variables);
      
      return result;
    } catch (error) {
      setState({ isLoading: false, error, data: null });
      if (onError) onError(error, variables);
      throw error;
    }
  }, [mutationFn, invalidateKeys, cache, onSuccess, onError]);

  return {
    mutate,
    ...state
  };
}

/**
 * Fonction utilitaire pour créer une clé de cache
 */
export function createCacheKey(base, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  return sortedParams ? `${base}?${sortedParams}` : base;
}

/**
 * Précharger des données essentielles au démarrage
 */
export async function prefetchCriticalData() {
  const token = localStorage.getItem('ecomToken');
  if (!token) return;

  const defaultFetcher = (url) => async () => {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  };

  const criticalData = [
    { key: 'workspace', url: '/api/ecom/workspaces/current' },
    { key: 'products-quick', url: '/api/ecom/products?isActive=true&limit=20' },
    { key: 'orders-quick', url: '/api/ecom/orders?limit=10' }
  ];

  criticalData.forEach(({ key, url }) => {
    const fetcher = defaultFetcher(url);
    // Précharger sans bloquer
    fetcher().then(data => {
      let entry = cacheStore.get(key);
      if (!entry) {
        entry = new CacheEntry(key);
        cacheStore.set(key, entry);
      }
      entry.update(data);
    }).catch(() => null);
  });
}

export default SmartCacheContext;
