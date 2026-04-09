import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

const StoreContext = createContext(null);

export const StoreProvider = ({ children }) => {
  const { workspace, loading: authLoading } = useEcomAuth();
  const [stores, setStores] = useState([]);
  const [activeStore, setActiveStore] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStores = useCallback(async (wsId) => {
    if (!wsId) return;
    setLoading(true);
    try {
      const res = await ecomApi.get('/stores');
      const list = res.data?.data || [];
      setStores(list);

      // Restore last active store from localStorage
      const savedId = localStorage.getItem(`activeStore:${wsId}`);
      const match = list.find(s => s._id === savedId) || list[0] || null;
      setActiveStore(match);
      // Sync global ref for API interceptor
      window.__activeStoreId__ = match?._id || null;
    } catch {
      setStores([]);
      setActiveStore(null);
      window.__activeStoreId__ = null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspace?._id) {
      loadStores(workspace._id);
    } else if (!authLoading) {
      // Auth finished but no workspace — stop loading
      setLoading(false);
    }
  }, [workspace?._id, authLoading, loadStores]);

  const switchStore = useCallback((store) => {
    setActiveStore(store);
    window.__activeStoreId__ = store?._id || null;
    if (workspace?._id && store?._id) {
      localStorage.setItem(`activeStore:${workspace._id}`, store._id);
    }
  }, [workspace?._id]);

  const refreshStores = useCallback(() => {
    if (workspace?._id) return loadStores(workspace._id);
    return Promise.resolve();
  }, [workspace?._id, loadStores]);

  return (
    <StoreContext.Provider value={{ stores, activeStore, switchStore, refreshStores, loading }}>
      {children ?? <Outlet />}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
};
