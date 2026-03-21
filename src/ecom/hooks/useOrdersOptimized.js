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
  // ❌ CACHE DÉSACTIVÉ - Plus de cache local
  // const cacheRef = useRef(new Map());
  // const prefetchTimeoutRef = useRef(null);
  
  // ❌ CACHE DÉSACTIVÉ - Fonctions de cache supprimées

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
      
      // ❌ CACHE DÉSACTIVÉ - Toujours requête API directe
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
        
        // ❌ CACHE DÉSACTIVÉ - Plus de mise en cache ni de prefetch
        
        console.log(`⚡ Orders fetch: ${data.orders?.length || 0} commandes`);
        
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

  // ❌ CACHE DÉSACTIVÉ - Prefetch supprimé

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
    // ❌ CACHE DÉSACTIVÉ - Plus d'invalidation de cache
  }, []);

  // Supprimer localement une commande
  const removeLocalOrder = useCallback((orderId) => {
    setOrders(prev => prev.filter(order => order._id !== orderId));
    // ❌ CACHE DÉSACTIVÉ - Plus d'invalidation de cache
  }, []);

  // Ajouter localement une commande
  const addLocalOrder = useCallback((newOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    // ❌ CACHE DÉSACTIVÉ - Plus d'invalidation de cache
  }, []);

  // Nettoyer les timeouts
  useEffect(() => {
    return () => {
      if (fetchAbortControllerRef.current) {
        fetchAbortControllerRef.current.abort();
      }
      // ❌ CACHE DÉSACTIVÉ - Plus de prefetch timeout
    };
  }, []);

  // ❌ CACHE DÉSACTIVÉ - Cache warming supprimé
  const warmupCache = useCallback(async () => {
    // Ne fait plus rien
    return;
  }, []);

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
    
    // Utilitaires (désactivés)
    clearCache: () => { /* ❌ CACHE DÉSACTIVÉ */ },
    getCacheSize: () => 0,
    
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
