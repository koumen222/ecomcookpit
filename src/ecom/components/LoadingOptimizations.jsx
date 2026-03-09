import React, { Suspense, useEffect, useState, useRef } from 'react';

/**
 * Suspense sans loader visible - transition instantanée
 * Affiche le contenu précédent ou un placeholder transparent
 */
export function InvisibleSuspense({ children, fallback = null, maxDuration = 3000 }) {
  const [isReady, setIsReady] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Réinitialiser l'état quand les children changent
    setIsReady(false);
    
    // Cleanup timeout précédent
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Timeout de sécurité
    timeoutRef.current = setTimeout(() => {
      setIsReady(true);
    }, maxDuration);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [children, maxDuration]);

  // Fallback complètement invisible
  const invisibleFallback = fallback || (
    <div 
      className="invisible"
      style={{ 
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        height: 0,
        overflow: 'hidden'
      }}
    />
  );

  return (
    <Suspense fallback={invisibleFallback}>
      {children}
    </Suspense>
  );
}

/**
 * Transition de page fluide sans loader visible
 * Garde l'ancien contenu pendant le chargement
 */
export function PageTransition({ children, locationKey, duration = 150 }) {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevKeyRef = useRef(locationKey);

  useEffect(() => {
    if (locationKey !== prevKeyRef.current) {
      // Début de transition
      setIsTransitioning(true);
      
      // Petite pause pour permettre le rendu
      requestAnimationFrame(() => {
        setDisplayChildren(children);
        prevKeyRef.current = locationKey;
        
        // Fin de transition
        setTimeout(() => {
          setIsTransitioning(false);
        }, duration);
      });
    } else {
      setDisplayChildren(children);
    }
  }, [children, locationKey, duration]);

  return (
    <div
      className={`
        transition-opacity duration-${duration} ease-out
        ${isTransitioning ? 'opacity-95' : 'opacity-100'}
      `}
      style={{
        willChange: isTransitioning ? 'opacity' : 'auto'
      }}
    >
      {displayChildren}
    </div>
  );
}

/**
 * Wrapper pour les composants de page avec chargement instantané
 */
export function InstantPage({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    // Rendre visible immédiatement
    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`
        transition-opacity duration-150 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {children}
    </div>
  );
}

/**
 * Composant pour masquer les états de chargement
 * Affiche toujours quelque chose, jamais un spinner
 */
export function LoadingState({ 
  isLoading, 
  data, 
  children, 
  placeholder = null,
  keepPrevious = true 
}) {
  const previousData = useRef(data);

  // Garder les données précédentes
  if (data) {
    previousData.current = data;
  }

  const displayData = keepPrevious 
    ? (data || previousData.current)
    : data;

  // Si pas de données du tout, afficher le placeholder invisible
  if (!displayData) {
    return placeholder || (
      <div className="opacity-0" style={{ minHeight: '100px' }} />
    );
  }

  // Afficher les données (même si loading)
  return (
    <div className={isLoading ? 'opacity-90' : 'opacity-100'}>
      {typeof children === 'function' 
        ? children(displayData, isLoading) 
        : children}
    </div>
  );
}

/**
 * Hook pour cacher les états de chargement
 */
export function useLoadingState(delay = 0) {
  const [isLoading, setIsLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const timeoutRef = useRef(null);

  const startLoading = () => {
    setIsLoading(true);
    setShowLoading(false);
    
    // Ne montrer le loading que si ça prend plus de temps
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    }
  };

  const stopLoading = () => {
    setIsLoading(false);
    setShowLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { 
    isLoading, 
    showLoading, 
    startLoading, 
    stopLoading,
    // Composant invisible à utiliser
    LoadingOverlay: () => showLoading ? null : null
  };
}

/**
 * Fallback de Suspense totalement invisible
 */
export function InvisibleFallback() {
  return (
    <div 
      style={{ 
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        position: 'absolute'
      }} 
    />
  );
}

/**
 * Wrapper pour React.lazy avec préchargement
 */
export function lazyWithPrefetch(importFn, prefetchData = null) {
  const LazyComponent = React.lazy(importFn);
  
  // Fonction de préchargement
  LazyComponent.preload = () => {
    // Précharger le composant
    const componentPromise = importFn();
    
    // Précharger les données si fournies
    if (prefetchData) {
      prefetchData();
    }
    
    return componentPromise;
  };

  return LazyComponent;
}

/**
 * Composant ErrorBoundary minimaliste
 */
export class MinimalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      // Afficher un message discret, pas d'erreur massive
      return (
        <div className="p-4 text-sm text-gray-500 opacity-50">
          Chargement...
        </div>
      );
    }
    return this.props.children;
  }
}

export default {
  InvisibleSuspense,
  PageTransition,
  InstantPage,
  LoadingState,
  useLoadingState,
  InvisibleFallback,
  lazyWithPrefetch,
  MinimalErrorBoundary
};
