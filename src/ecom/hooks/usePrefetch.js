import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook pour précharger les composants de pages au hover ou viewport
 * Usage: const { prefetchRoute } = usePrefetch();
 * <Link onMouseEnter={() => prefetchRoute('/ecom/orders')} />
 */
const componentCache = new Map();
const dataCache = new Map();

export function usePrefetch() {
  const navigate = useNavigate();
  const prefetchTimeout = useRef(null);
  const observerRef = useRef(null);

  // Précharge un composant de page
  const prefetchComponent = useCallback((importFn) => {
    if (!importFn || componentCache.has(importFn)) return;
    
    // Préchargement en arrière-plan sans bloquer
    const prefetchPromise = importFn()
      .then(module => {
        componentCache.set(importFn, module);
        return module;
      })
      .catch(() => null);
    
    // Stocker la promesse immédiatement pour éviter les doublons
    componentCache.set(importFn, prefetchPromise);
  }, []);

  // Précharge les données API
  const prefetchData = useCallback((url, fetcher = null) => {
    if (!url || dataCache.has(url)) return;
    
    const defaultFetcher = async () => {
      const token = localStorage.getItem('ecomToken');
      const res = await fetch(url, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-Workspace-Id': localStorage.getItem('workspaceId') || ''
        }
      });
      return res.json();
    };

    const promise = (fetcher || defaultFetcher)()
      .then(data => {
        dataCache.set(url, { data, timestamp: Date.now() });
        return data;
      })
      .catch(() => null);
    
    dataCache.set(url, promise);
  }, []);

  // Précharge une route complète (composant + données)
  const prefetchRoute = useCallback((path, options = {}) => {
    const { 
      componentImport = null, 
      dataUrl = null,
      delay = 100 // Délai avant prefetch au hover pour éviter les requêtes intempestives
    } = options;

    clearTimeout(prefetchTimeout.current);
    
    prefetchTimeout.current = setTimeout(() => {
      // Précharger le composant
      if (componentImport) {
        prefetchComponent(componentImport);
      }
      
      // Précharger les données
      if (dataUrl) {
        prefetchData(dataUrl);
      }
      
      // Préchargement générique basé sur le path
      if (path.startsWith('/ecom/orders')) {
        prefetchData('/api/ecom/orders?limit=20');
      } else if (path.startsWith('/ecom/products')) {
        prefetchData('/api/ecom/products?isActive=true');
      } else if (path.startsWith('/ecom/clients')) {
        prefetchData('/api/ecom/clients?limit=50');
      } else if (path.startsWith('/ecom/reports')) {
        prefetchData('/api/ecom/reports?limit=20');
      }
    }, delay);
  }, [prefetchComponent, prefetchData]);

  // Observation des liens dans le viewport pour préchargement anticipé
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const link = entry.target;
            const href = link.getAttribute('href') || link.dataset.href;
            if (href && href.startsWith('/ecom/')) {
              // Précharger avec un délai plus long pour les liens dans le viewport
              prefetchRoute(href, { delay: 500 });
            }
          }
        });
      },
      { 
        rootMargin: '100px', // Précharger quand l'élément est proche du viewport
        threshold: 0 
      }
    );

    // Observer tous les liens internes
    const observeLinks = () => {
      document.querySelectorAll('a[href^="/ecom/"], [data-prefetch]').forEach(link => {
        observerRef.current.observe(link);
      });
    };

    observeLinks();
    
    // Ré-observer après les changements de route
    const interval = setInterval(observeLinks, 2000);
    
    return () => {
      clearInterval(interval);
      observerRef.current?.disconnect();
      clearTimeout(prefetchTimeout.current);
    };
  }, [prefetchRoute]);

  // Navigation instantanée avec données préchargées
  const navigateInstant = useCallback((path, options = {}) => {
    const { state, replace = false } = options;
    
    // Si les données sont déjà en cache, navigation immédiate
    navigate(path, { state, replace });
  }, [navigate]);

  return { 
    prefetchRoute, 
    prefetchComponent, 
    prefetchData,
    navigateInstant,
    componentCache,
    dataCache
  };
}

/**
 * Hook pour observer les liens et précharger automatiquement
 * Usage: useLinkPrefetching() dans le composant racine
 */
export function useLinkPrefetching() {
  const { prefetchRoute } = usePrefetch();
  const handledRef = useRef(new Set());

  useEffect(() => {
    const handleMouseEnter = (e) => {
      // Vérifier que target est un élément DOM avec closest
      if (!e.target || typeof e.target.closest !== 'function') return;
      
      const link = e.target.closest('a[href^="/ecom/"]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (handledRef.current.has(href)) return;
      
      handledRef.current.add(href);
      prefetchRoute(href, { delay: 50 }); // Préchargement rapide au hover
    };

    const handleTouchStart = (e) => {
      // Vérifier que target est un élément DOM avec closest
      if (!e.target || typeof e.target.closest !== 'function') return;
      
      const link = e.target.closest('a[href^="/ecom/"]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      prefetchRoute(href, { delay: 0 }); // Préchargement immédiat au touch
    };

    // Utiliser la capture pour intercepter avant le clic
    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('touchstart', handleTouchStart, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('touchstart', handleTouchStart, true);
    };
  }, [prefetchRoute]);
}

/**
 * Récupère les données préchargées si disponibles
 */
export function getPrefetchedData(url) {
  const cached = dataCache.get(url);
  if (cached && cached.timestamp) {
    // Vérifier si le cache est encore valide (5 minutes)
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }
  }
  return null;
}

/**
 * Récupère un composant préchargé si disponible
 */
export function getPrefetchedComponent(importFn) {
  const cached = componentCache.get(importFn);
  if (cached && cached.default) {
    return cached;
  }
  return null;
}

export default usePrefetch;
