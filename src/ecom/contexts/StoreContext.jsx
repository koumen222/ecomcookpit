import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { clearEcomGetCache } from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

const StoreContext = createContext(null);

export const isStoreEnabled = (store) => (
  !!store && store.isActive !== false && store.storeSettings?.isStoreEnabled !== false
);

export const hasStorefrontHomepage = (store) => (
  !!(store?.subdomain && (store.hasHomepage || store.storePages?.sections?.length > 0))
);

export const isStoreReadyForBoutique = (store) => (
  isStoreEnabled(store) && hasStorefrontHomepage(store)
);

export const getStorefrontUrl = (store, path = '/') => {
  const customDomain = String(store?.customDomain || store?.storeDomains?.customDomain || '').trim();
  const isCustomDomainReady = store?.sslStatus === 'active'
    || store?.storeDomains?.sslStatus === 'active';
  const rawBase = store?.storeUrl
    || store?.publicUrl
    || store?.accessUrl
    || (customDomain && isCustomDomainReady ? `https://${customDomain}` : '')
    || (store?.subdomain ? `https://${store.subdomain}.scalor.net` : '');
  if (!rawBase) return '';

  try {
    const normalizedBase = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;
    const baseUrl = new URL(normalizedBase);
    const cleanPath = path ? (String(path).startsWith('/') ? String(path) : `/${path}`) : '/';
    return new URL(cleanPath, `${baseUrl.origin}/`).toString();
  } catch {
    return '';
  }
};

const resolvePreferredStore = (stores, savedId) => {
  // Always honour the explicitly saved store if it still exists and is active.
  // This prevents the context from silently switching back to a "more ready"
  // store (e.g. one that already has a homepage) when the user just created a
  // new one that has no homepage yet.
  const savedStore = stores.find((store) => store._id === savedId && isStoreEnabled(store)) || null;
  if (savedStore) return savedStore;

  // No saved preference — fall back to any ready store, then any enabled store.
  const readyStore = stores.find(isStoreReadyForBoutique);
  if (readyStore) return readyStore;

  return stores.find(isStoreEnabled) || null;
};

export const StoreProvider = ({ children }) => {
  const { workspace, loading: authLoading } = useEcomAuth();
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastKnownStoreRef = useRef(null);
  const workspaceId = workspace?._id || workspace?.id || null;

  const loadStores = useCallback(async (wsId) => {
    if (!wsId) return;
    setLoading(true);
    try {
      const res = await ecomApi.get('/stores');
      const list = res.data?.data || [];
      setStores(list);

      // Priority order for active store selection:
      // 1. window.__activeStoreId__ — set explicitly by switchStore() or wizard (survives refreshStores)
      // 2. localStorage saved preference for this workspace
      // 3. resolvePreferredStore fallback (any ready/enabled store)
      const inMemoryId = window.__activeStoreId__ || null;
      const savedId = inMemoryId || localStorage.getItem(`activeStore:${wsId}`);
      const match = resolvePreferredStore(list, savedId);

      setActiveStore(match);
      lastKnownStoreRef.current = match || list.find((store) => !!store?.subdomain) || null;
      window.__activeStoreId__ = match?._id || null;

      if (match?._id) {
        localStorage.setItem(`activeStore:${wsId}`, match._id);
      } else {
        localStorage.removeItem(`activeStore:${wsId}`);
      }
    } catch {
      setStores([]);
      setActiveStore(null);
      lastKnownStoreRef.current = null;
      window.__activeStoreId__ = null;
      localStorage.removeItem(`activeStore:${wsId}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspaceId) {
      loadStores(workspaceId);
    } else if (!authLoading) {
      // Auth finished but no workspace — stop loading
      setLoading(false);
    }
  }, [workspaceId, authLoading, loadStores]);

  const switchStore = useCallback((store) => {
    clearEcomGetCache();
    setActiveStore(store);
    if (store) {
      lastKnownStoreRef.current = store;
    }
    window.__activeStoreId__ = store?._id || null;
    // Notify all components that need to re-fetch for the new store
    window.dispatchEvent(new CustomEvent('scalor:store-switch', { detail: { storeId: store?._id || null } }));
    if (!workspaceId) return;

    if (store?._id) {
      localStorage.setItem(`activeStore:${workspaceId}`, store._id);
    } else {
      localStorage.removeItem(`activeStore:${workspaceId}`);
    }
  }, [workspaceId]);

  const refreshStores = useCallback(() => {
    if (workspaceId) return loadStores(workspaceId);
    return Promise.resolve();
  }, [workspaceId, loadStores]);

  const getActiveStorefrontUrl = useCallback((path = '/') => {
    const fallbackStore = stores.find((store) => !!store?.subdomain) || lastKnownStoreRef.current;
    return getStorefrontUrl(activeStore || fallbackStore, path);
  }, [activeStore, stores]);

  return (
    <StoreContext.Provider value={{ stores, activeStore, switchStore, refreshStores, loading, getActiveStorefrontUrl }}>
      {children ?? <Outlet />}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
