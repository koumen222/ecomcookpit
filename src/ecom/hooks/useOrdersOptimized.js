import { useState, useCallback, useEffect, useRef } from 'react';
import ecomApi from '../services/ecommApi';

// Hook optimisé pour pour la récupération des commandes avec cache intelligent
export const useOrdersOptimized = (initialParams = {}) => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  
  // Refs pour l'optimisation
  const fetchAbortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const prefetchTimeoutRef = useRef(null);
  
  // Cache local pour éviter les requêtes répétées
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  const PREFETCH_DELAY = 500; // 500ms avant prefetch
  
  const generateCacheKey = (params) => {
    return JSON.stringify(params);
  };
  
  const getFromCache = (params) => {
    const key = generateCacheKey(params);
    const cached = cacheRef.current.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('📦 Cache local HIT:', key);
      return cached.data;
    }
    
    // Nettoyer le cache expiré
    if (cached) {
      cacheRef.current.delete(key);
    }
    
    return null;
  };
  
  const setCache = (params, data) => {
    const key = generateCacheKey(params);
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limiter la taille du cache
    if (cacheRef.current.size > 50) {
      const oldestKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(oldestKey);
    }
  };

  const fetchOrders = useCallback(async (options = {}) => {
    // Annuler la requête précédente
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    fetchAbortControllerRef.current = controller;
    
    try {
      setLoading(true);
      setError(null);
      
      const params = { ...initialParams, ...options };
      
      // Vérifier le cache local
      const cached = getFromCache(params);
      if (cached && !options.noCache) {
        setOrders(cached.orders);
        setStats(cached.stats);
        setPagination(cached.pagination);
        setLastFetchTime(cached.timestamp);
        setLoading(false);
        return cached;
      }
      
      // Requête API avec timeout optimisé
      const res = await ecomApi.get('/orders', { 
        params,
        signal: controller.signal,
        timeout: 15000 // 15s timeout
      });
      
      if (!controller.signal.aborted) {
        const data = res.data.data;
        
        setOrders(data.orders || []);
        setStats(data.stats || {});
        setPagination(data.pagination || {});
        setLastFetchTime(Date.now());
        
        // Mettre en cache localement
        if (!options.noCache) {
          setCache(params, data);
        }
        
        // Précharger les pages adjacentes
        if (!options.noPrefetch && data.pagination?.page) {
          schedulePrefetch(params, data.pagination);
        }
        
        console.log(`⚡ Orders fetch: ${data.orders?.length || 0} commandes en ${Date.now() - performance.now()}ms`);
        
        return data;
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        console.log('🚫 Requête annulée');
        return;
      }
      
      console.error('❌ Erreur fetchOrders:', err);
      setError(err.response?.data?.message || err.message || 'Erreur chargement commandes');
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  // Préchargement intelligent des pages adjacentes
  const schedulePrefetch = (currentParams, currentPagination) => {
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }
    
    prefetchTimeoutRef.current = setTimeout(() => {
      const { page, pages } = currentPagination;
      
      // Précharger la page suivante
      if (page < pages) {
        fetchOrders({
          ...currentParams,
          page: page + 1,
          noPrefetch: true,
          noCache: false
        }).catch(() => {}); // Ignorer les erreurs de prefetch
      }
      
      // Précharger la page précédente
      if (page > 1) {
        fetchOrders({
          ...currentParams,
          page: page - 1,
          noPrefetch: true,
          noCache: false
        }).catch(() => {}); // Ignorer les erreurs de prefetch
      }
    }, PREFETCH_DELAY);
  };

  // Refresher optimisé
  const refresh = useCallback(async (options = {}) => {
    return fetchOrders({
      ...options,
      noCache: true,
      noPrefetch: true
    });
  }, [fetchOrders]);

  // Mutation optimisée pour les mises à jour
  const updateLocalOrder = useCallback((orderId, updates) => {
    setOrders(prev => prev.map(order => 
      order._id === orderId ? { ...order, ...updates } : order
    ));
    
    // Invalider le cache local pour cette requête
    cacheRef.current.clear();
  }, []);

  // Supprimer localement une commande
  const removeLocalOrder = useCallback((orderId) => {
    setOrders(prev => prev.filter(order => order._id !== orderId));
    
    // Invalider le cache local
    cacheRef.current.clear();
  }, []);

  // Ajouter localement une commande
  const addLocalOrder = useCallback((newOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    
    // Invalider le cache local
    cacheRef.current.clear();
  }, []);

  // Nettoyer les timeouts
  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, []);

  // Cache warming pour les requêtes courantes
  const warmupCache = useCallback(async () => {
    const commonQueries = [
      { page: 1, limit: 50 },
      { page: 1, limit: 50, status: 'pending' },
      { page: 1, limit: 50, status: 'confirmed' },
      { page: 1, limit: 50, status: 'delivered' }
    ];

    console.log('🔥 Début cache warming...');
    
    // Exécuter en parallèle avec faible priorité
    Promise.allSettled(
      commonQueries.map(params => 
        fetchOrders({ ...params, noPrefetch: true, noCache: false }).catch(() => {})
      )
    ).then(() => {
      console.log('✅ Cache warming terminé');
    });
  }, [fetchOrders]);

  return {
    // État
    orders,
    stats,
    pagination,
    loading,
    error,
    lastFetchTime,
    
    // Actions
    fetchOrders,
    refresh,
    updateLocalOrder,
    removeLocalOrder,
    addLocalOrder,
    warmupCache,
    
    // Utilitaires
    clearCache: () => {
      cacheRef.current.clear();
    },
    getCacheSize: () => cacheRef.current.size,
    
    // États dérivés
    hasOrders: orders.length > 0,
    isEmpty: !loading && orders.length === 0,
    isFirstPage: pagination.page === 1,
    isLastPage: pagination.page >= pagination.pages,
    totalPages: pagination.pages || 0,
    currentPage: pagination.page || 1
  };
};

// Hook pour le polling optimisé des mises à jour
export const useOrdersPolling = (workspaceId, sourceId = null, interval = 30000) => {
  const [updates, setUpdates] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollingRef = useRef(null);
  
  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(async () => {
      try {
        const since = lastUpdate || new Date(Date.now() - interval).toISOString();
        const res = await ecomApi.get('/orders/new-since', {
          params: { since, sourceId },
          timeout: 10000
        });
        
        if (res.data.data.orders.length > 0) {
          setUpdates(res.data.data.orders);
          setLastUpdate(res.data.data.serverTime);
          console.log(`📡 Polling: ${res.data.data.orders.length} nouvelles commandes`);
        }
      } catch (error) {
        console.warn('⚠️ Polling error:', error.message);
      }
    }, interval);
  }, [workspaceId, sourceId, interval, lastUpdate]);
  
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    if (workspaceId) {
      startPolling();
    }
    
    return stopPolling;
  }, [workspaceId, startPolling, stopPolling]);
  
  return {
    updates,
    lastUpdate,
    startPolling,
    stopPolling,
    clearUpdates: () => setUpdates([])
  };
};

export default useOrdersOptimized;
