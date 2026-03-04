import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

/**
 * Resolve the Socket.io server URL from env vars
 * Works in both admin (VITE_API_URL) and public storefront (VITE_BACKEND_URL / VITE_STORE_API_URL)
 */
function resolveSocketUrl() {
  const candidates = [
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_BACKEND_URL,
    import.meta.env.VITE_STORE_API_URL,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const url = new URL(raw.startsWith('http') ? raw : `${window.location.origin}${raw}`);
      return url.origin;
    } catch {
      // ignore malformed
    }
  }

  // Fallback: same origin in dev, api.scalor.net in prod
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  return 'http://localhost:8080';
}

const SOCKET_BASE = resolveSocketUrl();

// ─── Singleton socket per subdomain (avoids multiple connections) ─────────────
const _sockets = new Map(); // subdomain -> socket instance
const _refCounts = new Map(); // subdomain -> number of active consumers

function getOrCreateSocket(subdomain) {
  if (_sockets.has(subdomain)) {
    _refCounts.set(subdomain, (_refCounts.get(subdomain) || 0) + 1);
    return _sockets.get(subdomain);
  }

  const socket = io(`${SOCKET_BASE}/store-live`, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.4,
  });

  socket.on('connect', () => {
    socket.emit('store:join', { subdomain });
  });

  _sockets.set(subdomain, socket);
  _refCounts.set(subdomain, 1);
  return socket;
}

function releaseSocket(subdomain) {
  const count = (_refCounts.get(subdomain) || 1) - 1;
  if (count <= 0) {
    _sockets.get(subdomain)?.disconnect();
    _sockets.delete(subdomain);
    _refCounts.delete(subdomain);
  } else {
    _refCounts.set(subdomain, count);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * useThemeSocket — Subscribe to live theme updates from admin builder.
 * Used by public storefront pages (PublicStorefront, StoreProductPage).
 *
 * @param {string|null} subdomain  - Store subdomain (e.g. "koumen")
 * @param {Function} onThemeUpdate - Called with the new theme object when received
 */
export function useThemeSocket(subdomain, onThemeUpdate) {
  const callbackRef = useRef(onThemeUpdate);
  callbackRef.current = onThemeUpdate;

  useEffect(() => {
    if (!subdomain) return;

    const socket = getOrCreateSocket(subdomain);

    const handler = (theme) => {
      callbackRef.current?.(theme);
    };

    socket.on('theme:update', handler);

    return () => {
      socket.off('theme:update', handler);
      releaseSocket(subdomain);
    };
  }, [subdomain]);
}

// ─────────────────────────────────────────────────────────────────────────────
/**
 * useBroadcastTheme — Emit live theme previews from the admin builder.
 * Requires a valid JWT token (from localStorage).
 * Changes are debounced 200ms to avoid flooding the socket.
 *
 * @param {string|null} subdomain - Store subdomain
 * @returns {{ broadcast: Function, isConnected: boolean }}
 */
export function useBroadcastTheme(subdomain) {
  const socketRef = useRef(null);
  const isConnectedRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!subdomain) return;

    const token = localStorage.getItem('ecomToken');
    if (!token) return;

    const socket = io(`${SOCKET_BASE}/store-live`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socket.emit('store:join', { subdomain });
      isConnectedRef.current = true;
    });

    socket.on('disconnect', () => {
      isConnectedRef.current = false;
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subdomain]);

  const broadcast = useCallback(
    (theme) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const socket = socketRef.current;
        const token = localStorage.getItem('ecomToken');
        if (!socket?.connected || !token) return;
        socket.emit('theme:broadcast', { subdomain, theme, token });
      }, 200);
    },
    [subdomain]
  );

  return { broadcast };
}

export default useThemeSocket;
