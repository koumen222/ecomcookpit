import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let globalSocket = null;
let listeners = [];

// Singleton socket partagé entre tous les composants
function getSocket(token) {
  if (!globalSocket || globalSocket.disconnected) {
    globalSocket = io('', {
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

    const onNewMessage = () => {
      // Incrémenter le badge et re-fetch pour avoir le bon compte
      setUnreadDm(prev => prev + 1);
      fetchUnread();
    };

    socket.on('message:new', onNewMessage);

    return () => {
      socket.off('message:new', onNewMessage);
    };
  }, [token, fetchUnread]);

  const clearUnread = useCallback(() => {
    setUnreadDm(0);
  }, []);

  return { unreadDm, clearUnread, fetchUnread };
}
