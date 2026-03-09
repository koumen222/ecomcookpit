import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Context pour gérer les transitions de page fluides
 * Sans spinners ni loaders visibles
 */
const InstantNavigationContext = createContext({
  isTransitioning: false,
  previousPage: null,
  startTransition: () => {},
  endTransition: () => {},
  preserveContent: false
});

/**
 * Provider pour gérer les transitions instantanées
 * Garde l'ancien contenu visible pendant le chargement
 */
export function InstantNavigationProvider({ children }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousPage, setPreviousPage] = useState(null);
  const [preserveContent, setPreserveContent] = useState(false);
  const transitionTimeoutRef = useRef(null);

  const startTransition = useCallback((options = {}) => {
    const { preserve = true, duration = 300 } = options;
    
    // Nettoyer tout timeout existant
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setPreserveContent(preserve);
    setIsTransitioning(true);
    
    // Enregistrer la page actuelle comme précédente
    setPreviousPage({
      pathname: window.location.pathname,
      timestamp: Date.now()
    });

    // Auto-fin après la durée maximale
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      setPreserveContent(false);
    }, duration);
  }, []);

  const endTransition = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    // Petit délai pour permettre le rendu du nouveau contenu
    requestAnimationFrame(() => {
      setIsTransitioning(false);
      setPreserveContent(false);
    });
  }, []);

  const value = {
    isTransitioning,
    previousPage,
    preserveContent,
    startTransition,
    endTransition
  };

  return (
    <InstantNavigationContext.Provider value={value}>
      {children}
    </InstantNavigationContext.Provider>
  );
}

export const useInstantNavigation = () => useContext(InstantNavigationContext);

/**
 * Wrapper pour les pages avec transition fluide
 * Affiche le contenu précédent pendant le chargement
 */
export function PageTransition({ children, pageKey }) {
  const { isTransitioning, preserveContent } = useInstantNavigation();
  const [displayContent, setDisplayContent] = useState(children);
  const [displayKey, setDisplayKey] = useState(pageKey);
  const contentRef = useRef(children);
  const keyRef = useRef(pageKey);

  // Mettre à jour le contenu affiché
  React.useEffect(() => {
    if (!isTransitioning) {
      // Navigation terminée, afficher le nouveau contenu
      contentRef.current = children;
      keyRef.current = pageKey;
      setDisplayContent(children);
      setDisplayKey(pageKey);
    } else if (!preserveContent) {
      // Transition sans préservation, afficher immédiatement
      contentRef.current = children;
      keyRef.current = pageKey;
      setDisplayContent(children);
      setDisplayKey(pageKey);
    }
    // Si preserveContent est true, on garde l'ancien contenu visible
  }, [children, pageKey, isTransitioning, preserveContent]);

  return (
    <div 
      className={`
        transition-opacity duration-150 ease-out
        ${isTransitioning ? 'opacity-90' : 'opacity-100'}
      `}
      style={{
        // Empêcher les interactions pendant la transition
        pointerEvents: isTransitioning ? 'none' : 'auto'
      }}
    >
      {displayContent}
    </div>
  );
}

/**
 * Suspense invisible - fallback transparent
 * Ne montre aucun loader visuel
 */
export function InvisibleSuspense({ children, maxDuration = 5000 }) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef(null);

  // Afficher le contenu dès que possible
  const handleResolve = useCallback(() => {
    setIsVisible(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Timeout de sécurité pour éviter un écran vide infini
  React.useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, maxDuration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [maxDuration]);

  return (
    <React.Suspense fallback={
      <div 
        className="opacity-0 transition-opacity duration-200"
        style={{ 
          minHeight: '100px',
          visibility: isVisible ? 'visible' : 'hidden'
        }}
      >
        {/* Fallback complètement invisible */}
      </div>
    }>
      {children}
    </React.Suspense>
  );
}

/**
 * Composant pour précharger les données critiques au démarrage
 */
export function CriticalDataPreloader({ children }) {
  const [isReady, setIsReady] = useState(false);

  React.useEffect(() => {
    const preloadCriticalData = async () => {
      const token = localStorage.getItem('ecomToken');
      if (!token) {
        setIsReady(true);
        return;
      }

      const requests = [];

      // Précharger les données selon le rôle
      const user = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      const role = user?.role;

      // Données communes à tous les rôles
      requests.push(
        fetch('/api/ecom/workspaces/current', {
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null)
      );

      if (role === 'ecom_admin' || role === 'ecom_closeuse') {
        // Précharger les données essentielles pour admin/closeuse
        requests.push(
          fetch('/api/ecom/orders?limit=10', {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => null),
          fetch('/api/ecom/products?isActive=true&limit=20', {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => null),
          fetch('/api/ecom/clients?limit=20', {
            headers: { 'Authorization': `Bearer ${token}` }
          }).catch(() => null)
        );
      }

      // Attendre que toutes les requêtes soient lancées (pas nécessairement terminées)
      await Promise.allSettled(requests);
      
      // Rendre l'app disponible immédiatement
      setIsReady(true);
    };

    // Lancer le préchargement
    preloadCriticalData();

    // Fallback: afficher l'app après 500ms max
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 500);

    return () => clearTimeout(timeout);
  }, []);

  if (!isReady) {
    // Écran de démarrage minimaliste et rapide
    return (
      <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
      </div>
    );
  }

  return children;
}

/**
 * Hook pour optimiser le rendu des listes longues
 */
export function useVirtualScroll(items, itemHeight = 50, overscan = 5) {
  const containerRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
      );

      setVisibleRange({ start, end });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => container.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, overscan]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    containerRef,
    visibleItems,
    visibleRange,
    totalHeight,
    offsetY
  };
}

export default InstantNavigationContext;
