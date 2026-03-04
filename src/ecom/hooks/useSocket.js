import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const resolveSocketUrl = () => {
  const candidates = [
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_BACKEND_URL,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      // If it's an absolute URL, extract the origin
      const url = new URL(raw.startsWith('http') ? raw : `${window.location.origin}${raw}`);
      return url.origin;
    } catch {
      // ignore malformed
    }
  }

  // Fallback: api.scalor.net in prod, localhost in dev
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  return 'http://localhost:8080';
};

const SOCKET_URL = resolveSocketUrl();

/**
 * Custom hook for WebSocket connection with auto-reconnection
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const listenersRef = useRef(new Map());

  const connect = useCallback(() => {
    const token = localStorage.getItem('ecomToken');
    if (!token) {
      setConnectionError('No auth token');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      // Start with polling, then upgrade to websocket when possible.
      // This avoids noisy hard websocket failures behind some proxies.
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000, // 2 secondes minimum
      reconnectionDelayMax: 10000, // 10 secondes maximum
      randomizationFactor: 0.5, // Ajouter de la randomisation
      timeout: 30000, // 30 secondes timeout
      autoConnect: true,
      forceNew: false // Réutiliser la connexion existante si possible
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      
      // Track listeners for cleanup
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event).add(callback);
    }
  }, []);

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
      
      if (listenersRef.current.has(event)) {
        listenersRef.current.get(event).delete(callback);
      }
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off
  };
}

/**
 * Hook for DM-specific socket events
 */
export function useDmSocket(recipientId, onNewMessage, onTyping, onMessageStatus) {
  const { socket, isConnected, emit, on, off } = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Join conversation room when recipient changes
  useEffect(() => {
    if (isConnected && recipientId) {
      emit('conversation:join', { recipientId });
      
      return () => {
        emit('conversation:leave', { recipientId });
      };
    }
  }, [isConnected, recipientId, emit]);

  // Listen for new messages
  useEffect(() => {
    if (!isConnected || !onNewMessage) return;

    const handleNewMessage = (message) => {
      onNewMessage(message);
    };

    on('message:new', handleNewMessage);
    
    return () => {
      off('message:new', handleNewMessage);
    };
  }, [isConnected, onNewMessage, on, off]);

  // Listen for typing indicators
  useEffect(() => {
    if (!isConnected) return;

    const handleTypingStart = (data) => {
      if (data.userId !== recipientId) return;
      setIsTyping(true);
      onTyping?.(true, data.userName);
      
      // Auto-clear after 5 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping?.(false);
      }, 5000);
    };

    const handleTypingStop = (data) => {
      if (data.userId !== recipientId) return;
      setIsTyping(false);
      onTyping?.(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };

    on('typing:start', handleTypingStart);
    on('typing:stop', handleTypingStop);
    
    return () => {
      off('typing:start', handleTypingStart);
      off('typing:stop', handleTypingStop);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [isConnected, recipientId, onTyping, on, off]);

  // Listen for message status updates
  useEffect(() => {
    if (!isConnected || !onMessageStatus) return;

    const handleStatus = (data) => {
      onMessageStatus(data);
    };

    on('message:status', handleStatus);
    
    return () => {
      off('message:status', handleStatus);
    };
  }, [isConnected, onMessageStatus, on, off]);

  // Send typing indicator
  const sendTyping = useCallback((isTyping) => {
    if (recipientId) {
      emit(isTyping ? 'typing:start' : 'typing:stop', { recipientId });
    }
  }, [recipientId, emit]);

  // Acknowledge message read
  const acknowledgeRead = useCallback((messageIds, senderId) => {
    emit('message:read', { messageIds, senderId });
  }, [emit]);

  return {
    isConnected,
    isTyping,
    sendTyping,
    acknowledgeRead
  };
}

export default useSocket;
