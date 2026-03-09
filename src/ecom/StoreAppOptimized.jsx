/**
 * StoreAppOptimized.jsx - Application Store avec navigation instantanée
 * 
 * Optimisations:
 * - Préchargement des produits au hover
 * - Cache des données store
 * - Suspense invisible
 * - Navigation fluide sans rechargement
 */

import React, { Suspense, lazy, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';
import { useSubdomain } from '../hooks/useSubdomain.js';

// Composants d'optimisation
import { 
  useStorePrefetch, 
  getCachedStore, 
  setCachedStore,
  StorePrefetchLink 
} from '../components/StorePrefetch.jsx';
import { InvisibleSuspense, PageTransition } from '../components/LoadingOptimizations.jsx';

// Lazy loading des pages store
const StoreFront = lazy(() => import('../pages/StoreFrontOptimized.jsx'));
const StoreProductPage = lazy(() => import('../pages/StoreProductPageOptimized.jsx'));
const StoreCheckout = lazy(() => import('../pages/StoreCheckout.jsx'));

// Fallback invisible
const InvisibleFallback = () => (
  <div style={{ 
    opacity: 0, 
    height: 0, 
    overflow: 'hidden',
    position: 'absolute' 
  }} />
);

/**
 * Hook pour précharger le store au montage
 */
function useStorePreloader(subdomain) {
  const { prefetchStore } = useStorePrefetch(subdomain);

  useEffect(() => {
    if (!subdomain) return;
    
    // Précharger le store si pas en cache
    const cached = getCachedStore(subdomain);
    if (!cached) {
      prefetchStore();
    }
  }, [subdomain, prefetchStore]);
}

/**
 * Composant de transition de page
 */
function StorePageTransition({ children }) {
  const location = useLocation();
  
  return (
    <PageTransition locationKey={location.pathname} duration={100}>
      {children}
    </PageTransition>
  );
}

/**
 * App Store Optimisée
 */
function StoreAppOptimized() {
  const { subdomain } = useSubdomain();
  
  // Précharger les données du store
  useStorePreloader(subdomain);

  // Précharger les routes critiques
  useEffect(() => {
    if (!subdomain) return;
    
    // Précharger les pages après le montage
    const timer = setTimeout(() => {
      StoreFront.preload?.();
      StoreProductPage.preload?.();
    }, 2000);

    return () => clearTimeout(timer);
  }, [subdomain]);

  if (!subdomain) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <p>Boutique non trouvée</p>
      </div>
    );
  }

  return (
    <ThemeProvider subdomain={subdomain}>
      <div className="min-h-screen" style={{ fontFamily: 'var(--s-font, system-ui)' }}>
        <StorePageTransition>
          <Routes>
            <Route 
              path="/" 
              element={
                <InvisibleSuspense fallback={<InvisibleFallback />}>
                  <StoreFront />
                </InvisibleSuspense>
              } 
            />
            <Route 
              path="/product/:slug" 
              element={
                <InvisibleSuspense fallback={<InvisibleFallback />}>
                  <StoreProductPage />
                </InvisibleSuspense>
              } 
            />
            <Route 
              path="/checkout" 
              element={
                <InvisibleSuspense fallback={<InvisibleFallback />}>
                  <StoreCheckout />
                </InvisibleSuspense>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </StorePageTransition>
      </div>
    </ThemeProvider>
  );
}

// Ajouter la méthode preload aux composants lazy
StoreFront.preload = () => import('../pages/StoreFrontOptimized.jsx');
StoreProductPage.preload = () => import('../pages/StoreProductPageOptimized.jsx');
StoreCheckout.preload = () => import('../pages/StoreCheckout.jsx');

export default StoreAppOptimized;
