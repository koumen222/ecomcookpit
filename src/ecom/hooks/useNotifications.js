import { useState, useEffect, useRef, useCallback } from 'react';
import { notificationsApi } from '../services/ecommApi';

// Polling interval de base : 60s (pas 30s pour éviter la surcharge)
const BASE_INTERVAL = 60_000;
const MAX_INTERVAL = 300_000;

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const failCountRef = useRef(0);
  const timerRef = useRef(null);
  // Protège contre le double-mount React 18 StrictMode
  const mountedRef = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      if (mountedRef.current) {
        setUnreadCount(res.data?.data?.count ?? 0);
        failCountRef.current = 0;
      }
    } catch {
      failCountRef.current += 1;
    }
  }, []);

  useEffect(() => {
    // Évite le double fetch en StrictMode (2ème mount annule le 1er)
    if (mountedRef.current) return;
    mountedRef.current = true;

    fetchUnreadCount();

    const schedule = () => {
      const backoff = Math.min(BASE_INTERVAL * Math.pow(2, failCountRef.current), MAX_INTERVAL);
      timerRef.current = setTimeout(async () => {
        await fetchUnreadCount();
        schedule();
      }, backoff);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, [fetchUnreadCount]);

  // Écouter les push SW pour refresh immédiat
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e) => {
      if (e.data?.type === 'PUSH_RECEIVED') fetchUnreadCount();
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [fetchUnreadCount]);

  // Écouter les events WebSocket relayés par useDmUnread
  useEffect(() => {
    const handler = () => fetchUnreadCount();
    window.addEventListener('ecom:notification', handler);
    return () => window.removeEventListener('ecom:notification', handler);
  }, [fetchUnreadCount]);

  return { unreadCount, refreshCount: fetchUnreadCount };
}
