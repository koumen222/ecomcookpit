import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import ecomApi from '../services/ecommApi.js';

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  return 'https://ecomcookpit-production-7a08.up.railway.app';
};

const SOCKET_URL = resolveSocketUrl();

let globalSocket = null;
let listeners = [];

// Singleton socket partagé entre tous les composants
function getSocket(token) {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
  }
  return globalSocket;
}

export function useDmUnread() {
  const token = localStorage.getItem('ecomToken');
  const [unreadDm, setUnreadDm] = useState(0);
  const [lastMessage, setLastMessage] = useState(null);
  const socketRef = useRef(null);

  // CRITICAL: Use ref to avoid recreating function and causing re-renders
  const fetchUnreadRef = useRef(null);
  fetchUnreadRef.current = async () => {
    if (!token) return;
    try {
      const response = await ecomApi.get('/dm/conversations');
      const data = response.data;
      if (data.success) {
        const total = (data.conversations || []).reduce((sum, c) => sum + (c.unread || 0), 0);
        setUnreadDm(total);
      }
    } catch (e) { /* silencieux */ }
  };

  // Wrapper stable pour exposer au composant
  const fetchUnread = useCallback(() => {
    return fetchUnreadRef.current?.();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchUnreadRef.current();

    const socket = getSocket(token);
    socketRef.current = socket;

    const onNewMessage = (msg) => {
      // Incrémenter le badge et re-fetch pour avoir le bon compte
      setUnreadDm(prev => prev + 1);
      fetchUnreadRef.current();
      // Stocker le dernier message pour le toast
      if (msg) {
        setLastMessage({
          senderName: msg.senderName || 'Nouveau message',
          content: msg.content || '',
          channel: msg.channel || null,
          type: msg.channel ? 'channel' : 'dm',
          timestamp: Date.now()
        });
      }
    };

    // Écouter les notifications internes (commandes, messages, stock, etc.)
    const onNotification = (notif) => {
      if (!notif) return;
      window.dispatchEvent(new CustomEvent('ecom:notification', { detail: notif }));
    };

    socket.on('message:new', onNewMessage);
    socket.on('notification:new', onNotification);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('notification:new', onNotification);
    };
  }, [token]); // ✅ Seulement token - fetchUnread retiré

  const clearUnread = useCallback(() => {
    setUnreadDm(0);
  }, []);

  const clearLastMessage = useCallback(() => {
    setLastMessage(null);
  }, []);

  return { unreadDm, clearUnread, fetchUnread, lastMessage, clearLastMessage };
}
