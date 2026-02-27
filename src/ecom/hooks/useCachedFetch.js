import { useState, useEffect, useRef } from 'react';
import { getCache, setCache, removeCache } from '../utils/cacheUtils.js';

/**
 * Hook de fetch avec cache mémoire.
 *
 * - Retourne immédiatement les données en cache (pas de spinner)
 * - Revalide en arrière-plan si les données sont fraîches
 * - `initialData` : données affichées avant le premier fetch (ex: [])
 * - `skip` : ne pas fetcher si true (ex: dépendances manquantes)
 */
const useCachedFetch = (cacheKey, fetchFn, { initialData = null, skip = false, deps = [] } = {}) => {
  const cached = cacheKey ? getCache(cacheKey) : null;

  const [data, setData] = useState(cached ?? initialData);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (skip) return;

    const run = async () => {
      const fresh = cacheKey ? getCache(cacheKey) : null;
      if (fresh !== null) {
        if (mountedRef.current) {
          setData(fresh);
          setLoading(false);
        }
        return;
      }

      if (mountedRef.current) setLoading(true);
      try {
        const result = await fetchFn();
        if (cacheKey) setCache(cacheKey, result);
        if (mountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) setError(err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, skip, ...deps]);

  const refresh = async () => {
    if (cacheKey) {
      removeCache(cacheKey);
    }
    setLoading(true);
    try {
      const result = await fetchFn();
      if (cacheKey) setCache(cacheKey, result);
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return { data, loading, error, refresh };
};

export default useCachedFetch;
