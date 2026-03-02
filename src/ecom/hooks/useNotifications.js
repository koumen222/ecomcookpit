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

  // CRITICAL: Use ref to avoid recreating function on every render
  const fetchUnreadCountRef = useRef(null);
  fetchUnreadCountRef.current = async () => {
    try {
      const res = await notificationsApi.getUnreadCount();
      if (mountedRef.current) {
        setUnreadCount(res.data?.data?.count ?? 0);
        failCountRef.current = 0;
      }
    } catch {
      failCountRef.current += 1;
    }
  };

  // Wrapper stable pour exposer au composant
  const fetchUnreadCount = useCallback(() => {
    return fetchUnreadCountRef.current?.();
  }, []);

  useEffect(() => {
    // Évite le double fetch en StrictMode (2ème mount annule le 1er)
    if (mountedRef.current) return;
    mountedRef.current = true;

    fetchUnreadCountRef.current();

    const schedule = () => {
      const backoff = Math.min(BASE_INTERVAL * Math.pow(2, failCountRef.current), MAX_INTERVAL);
      timerRef.current = setTimeout(async () => {
        await fetchUnreadCountRef.current();
        schedule();
      }, backoff);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []); // ✅ Pas de dépendances - s'exécute UNE FOIS

  // Écouter les push SW pour refresh immédiat
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e) => {
      if (e.data?.type === 'PUSH_RECEIVED') fetchUnreadCountRef.current();
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []); // ✅ Pas de dépendances

  // Écouter les events WebSocket relayés par useDmUnread
  useEffect(() => {
    const handler = () => fetchUnreadCountRef.current();
    window.addEventListener('ecom:notification', handler);
    return () => window.removeEventListener('ecom:notification', handler);
  }, []); // ✅ Pas de dépendances

  return { unreadCount, refreshCount: fetchUnreadCount };
}
