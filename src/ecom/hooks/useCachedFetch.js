import { useState, useEffect, useRef } from 'react';

/**
 * Hook de fetch avec cache mémoire.
 *
 * - Retourne immédiatement les données en cache (pas de spinner)
 * - Revalide en arrière-plan si les données sont fraîches
 * - `initialData` : données affichées avant le premier fetch (ex: [])
 * - `skip` : ne pas fetcher si true (ex: dépendances manquantes)
 */
const useCachedFetch = (cacheKey, fetchFn, { initialData = null, skip = false, deps = [] } = {}) => {
  // ❌ CACHE DÉSACTIVÉ - Ne lit plus le cache
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (skip) return;

    const run = async () => {
      // ❌ CACHE DÉSACTIVÉ - Toujours fetch direct
      if (mountedRef.current) setLoading(true);
      try {
        const result = await fetchFn();
        // ❌ CACHE DÉSACTIVÉ - Ne stocke plus en cache
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
    // ❌ CACHE DÉSACTIVÉ - Plus de suppression de cache
    setLoading(true);
    try {
      const result = await fetchFn();
      // ❌ CACHE DÉSACTIVÉ - Ne stocke plus en cache
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
