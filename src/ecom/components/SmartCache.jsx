/**
 * SmartCache.jsx - Provider de cache intelligent pour l'application
 * 
 * Fonctionnalités :
 * - Cache mémoire avec expiration
 * - Déduplication des requêtes
 * - Invalidation sélective
 */

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';

const SmartCacheContext = createContext(null);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100;

export const SmartCacheProvider = ({ children }) => {
  const cacheRef = useRef(new Map());
  const pendingRequestsRef = useRef(new Map());

  // Nettoyage périodique du cache
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cacheRef.current.entries()) {
        if (now - entry.timestamp > CACHE_DURATION) {
          cacheRef.current.delete(key);
        }
      }
    }, 60000); // Toutes les minutes

    return () => clearInterval(cleanup);
  }, []);

  const get = useCallback((key) => {
    const entry = cacheRef.current.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return entry.data;
  }, []);

  const set = useCallback((key, data) => {
    // Limiter la taille du cache
    if (cacheRef.current.size >= MAX_CACHE_SIZE) {
      const firstKey = cacheRef.current.keys().next().value;
      cacheRef.current.delete(firstKey);
    }
    
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  const invalidate = useCallback((pattern) => {
    if (typeof pattern === 'string') {
      cacheRef.current.delete(pattern);
    } else if (pattern instanceof RegExp) {
      for (const key of cacheRef.current.keys()) {
        if (pattern.test(key)) {
          cacheRef.current.delete(key);
        }
      }
    }
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.clear();
    pendingRequestsRef.current.clear();
  }, []);

  const getPendingRequest = useCallback((key) => {
    return pendingRequestsRef.current.get(key);
  }, []);

  const setPendingRequest = useCallback((key, promise) => {
    pendingRequestsRef.current.set(key, promise);
    promise.finally(() => {
      pendingRequestsRef.current.delete(key);
    });
  }, []);

  const value = {
    get,
    set,
    invalidate,
    clear,
    getPendingRequest,
    setPendingRequest
  };

  return (
    <SmartCacheContext.Provider value={value}>
      {children}
    </SmartCacheContext.Provider>
  );
};

export const useSmartCache = () => {
  const context = useContext(SmartCacheContext);
  if (!context) {
    throw new Error('useSmartCache must be used within SmartCacheProvider');
  }
  return context;
};

export default SmartCacheProvider;
