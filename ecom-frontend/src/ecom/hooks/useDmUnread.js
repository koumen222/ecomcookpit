import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || '';

let globalSocket = null;
let listeners = [];

// Singleton socket partagé entre tous les composants
function getSocket(token) {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
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

  // Charger le nombre de non-lus depuis l'API
  const fetchUnread = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/ecom/dm/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const total = (data.conversations || []).reduce((sum, c) => sum + (c.unread || 0), 0);
        setUnreadDm(total);
      }
    } catch (e) { /* silencieux */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchUnread();

    const socket = getSocket(token);
    socketRef.current = socket;

    const onNewMessage = (msg) => {
      // Incrémenter le badge et re-fetch pour avoir le bon compte
      setUnreadDm(prev => prev + 1);
      fetchUnread();
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
  }, [token, fetchUnread]);

  const clearUnread = useCallback(() => {
    setUnreadDm(0);
  }, []);

  const clearLastMessage = useCallback(() => {
    setLastMessage(null);
  }, []);

  return { unreadDm, clearUnread, fetchUnread, lastMessage, clearLastMessage };
}
