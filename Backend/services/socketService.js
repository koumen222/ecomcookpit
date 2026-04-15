import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;
let storeLiveNamespace = null;
const userSockets = new Map(); // userId -> Set of socket ids
const typingUsers = new Map(); // conversationKey -> Map of userId -> timeout

const JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

/**
 * Initialize Socket.io server
 * @param {http.Server} httpServer - The HTTP server instance
 */
export function initSocketServer(httpServer) {
  const allowedOrigins = [
    'https://scalor.site',
    'https://www.scalor.site',
    'https://scalor.net',
    'https://www.scalor.net',
    'https://api.scalor.net',
    'http://scalor.site',
    'http://www.scalor.site',
    'https://ecomcookpit.pages.dev',
    'https://ecomcookpit-production.up.railway.app',
    'https://ecomcookpit-production-7a08.up.railway.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:8081'
  ];

  // Add CORS_ORIGINS from env if available
  if (process.env.CORS_ORIGINS) {
    const envOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
    allowedOrigins.push(...envOrigins);
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list or is an allowed wildcard domain
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.ecomcookpit.pages.dev') ||
          origin.endsWith('.scalor.net') ||
          origin.endsWith('.scalor.app') ||
          origin.endsWith('.up.railway.app')
        ) {
          return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Augmenter les timeouts pour éviter les déconnexions fréquentes
    pingTimeout: 120000, // 2 minutes (au lieu de 60s)
    pingInterval: 30000, // 30 secondes (au lieu de 25s)
    // Configuration de reconnexion
    connectTimeout: 45000, // 45s pour la connexion initiale
    // Permettre les deux transports mais privilégier websocket
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    // Désactiver le multiplexing pour éviter les connexions multiples
    perMessageDeflate: {
      threshold: 1024 // Compression seulement pour les messages > 1KB
    },
    maxHttpBufferSize: 1e6 // 1MB max buffer
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId || decoded.id || decoded._id;
      socket.workspaceId = decoded.workspaceId;
      socket.userName = decoded.name || decoded.email;
      socket.userRole = decoded.role || null;
      
      if (!socket.userId) {
        return next(new Error('Invalid token'));
      }
      
      next();
    } catch (error) {
      console.error('[Socket] Auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const workspaceId = socket.workspaceId;
    
    console.log(`[Socket] User connected: ${userId} (workspace: ${workspaceId})`);

    // Track user's sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join user's personal room and workspace room
    socket.join(`user:${userId}`);
    socket.join(`workspace:${workspaceId}`);
    if (userId && workspaceId) {
      socket.join(`support:user:${workspaceId}:${userId}`);
    }
    if (socket.userRole === 'super_admin') {
      socket.join('support:admins');
    }

    // Handle joining a conversation room
    socket.on('conversation:join', (data) => {
      const { recipientId } = data;
      if (recipientId) {
        const convKey = [userId, recipientId].sort().join('_');
        socket.join(`conversation:${convKey}`);
        console.log(`[Socket] User ${userId} joined conversation:${convKey}`);
      }
    });

    socket.on('support:subscribe', (data) => {
      const sessionId = String(data?.sessionId || '').trim();
      if (!sessionId) return;
      socket.join(`support:session:${sessionId}`);
    });

    socket.on('support:unsubscribe', (data) => {
      const sessionId = String(data?.sessionId || '').trim();
      if (!sessionId) return;
      socket.leave(`support:session:${sessionId}`);
    });

    // Handle leaving a conversation room
    socket.on('conversation:leave', (data) => {
      const { recipientId } = data;
      if (recipientId) {
        const convKey = [userId, recipientId].sort().join('_');
        socket.leave(`conversation:${convKey}`);
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { recipientId } = data;
      if (!recipientId) return;
      
      const convKey = [userId, recipientId].sort().join('_');
      
      // Clear existing timeout
      if (typingUsers.has(convKey)) {
        const userTimeouts = typingUsers.get(convKey);
        if (userTimeouts.has(userId)) {
          clearTimeout(userTimeouts.get(userId));
        }
      } else {
        typingUsers.set(convKey, new Map());
      }
      
      // Set auto-stop timeout (5 seconds)
      const timeout = setTimeout(() => {
        emitTypingStop(userId, recipientId, socket.userName);
      }, 5000);
      typingUsers.get(convKey).set(userId, timeout);
      
      // Emit to recipient
      io.to(`user:${recipientId}`).emit('typing:start', {
        userId,
        userName: socket.userName,
        conversationKey: convKey
      });
    });

    // Handle typing stop
    socket.on('typing:stop', (data) => {
      const { recipientId } = data;
      if (!recipientId) return;
      emitTypingStop(userId, recipientId, socket.userName);
    });

    // Handle message read acknowledgment
    socket.on('message:read', (data) => {
      const { messageIds, senderId } = data;
      if (!senderId || !messageIds?.length) return;
      
      // Notify sender that their messages were read
      io.to(`user:${senderId}`).emit('message:status', {
        messageIds,
        status: 'read',
        readBy: userId,
        readAt: new Date()
      });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] User disconnected: ${userId} (${reason})`);
      
      // Remove socket from tracking
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          
          // Clear all typing indicators for this user
          typingUsers.forEach((userTimeouts, convKey) => {
            if (userTimeouts.has(userId)) {
              clearTimeout(userTimeouts.get(userId));
              userTimeouts.delete(userId);
            }
          });
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`[Socket] Error for user ${userId}:`, error);
    });
  });

  // ─── /store-live namespace (public — no auth, read-only for visitors) ────────
  storeLiveNamespace = io.of('/store-live');

  storeLiveNamespace.on('connection', (socket) => {
    // Anyone (visitor or admin) can join a store room to receive theme updates
    socket.on('store:join', ({ subdomain }) => {
      if (!subdomain || typeof subdomain !== 'string') return;
      socket.join(`store:${subdomain.toLowerCase()}`);
    });

    // Only authenticated admins can broadcast theme changes
    socket.on('theme:broadcast', ({ subdomain, theme, token }) => {
      if (!subdomain || !theme || !token) return;
      try {
        jwt.verify(token, JWT_SECRET);
        // Broadcast to ALL visitors currently on this store (including the admin)
        storeLiveNamespace.to(`store:${subdomain.toLowerCase()}`).emit('theme:update', theme);
      } catch {
        // Invalid token — silently ignore
      }
    });

    // Authenticated admins broadcast productPageConfig live (page builder preview)
    socket.on('page:broadcast', ({ subdomain, productPageConfig, productId, token }) => {
      if (!subdomain || !productPageConfig || !token) return;
      try {
        jwt.verify(token, JWT_SECRET);
        storeLiveNamespace.to(`store:${subdomain.toLowerCase()}`).emit('page:update', { productPageConfig, productId });
      } catch {
        // Invalid token — silently ignore
      }
    });
  });

  console.log('[Socket] WebSocket server initialized');
  return io;
}

/**
 * Helper to emit typing stop
 */
function emitTypingStop(userId, recipientId, userName) {
  const convKey = [userId, recipientId].sort().join('_');
  
  if (typingUsers.has(convKey)) {
    const userTimeouts = typingUsers.get(convKey);
    if (userTimeouts.has(userId)) {
      clearTimeout(userTimeouts.get(userId));
      userTimeouts.delete(userId);
    }
  }
  
  io?.to(`user:${recipientId}`).emit('typing:stop', {
    userId,
    userName,
    conversationKey: convKey
  });
}

/**
 * Get the Socket.io instance
 */
export function getIO() {
  return io;
}

/**
 * Check if a user is online
 */
export function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Get online users count for a workspace
 */
export function getOnlineUsersInWorkspace(workspaceId) {
  const onlineUsers = [];
  userSockets.forEach((sockets, uid) => {
    if (sockets.size > 0) {
      onlineUsers.push(uid);
    }
  });
  return onlineUsers;
}

/**
 * Emit a new message to relevant users
 */
export function emitNewMessage(message, recipientId) {
  if (!io) return;
  
  const senderId = message.senderId?.toString() || message.senderId;
  const convKey = [senderId, recipientId].sort().join('_');
  
  // Emit to conversation room
  io.to(`conversation:${convKey}`).emit('message:new', message);
  
  // Also emit directly to recipient's user room (in case they're not in conversation view)
  io.to(`user:${recipientId}`).emit('message:new', message);
  
  // Update delivery status if recipient is online
  if (isUserOnline(recipientId)) {
    io.to(`user:${senderId}`).emit('message:status', {
      messageIds: [message._id],
      status: 'delivered',
      deliveredAt: new Date()
    });
  }
}

/**
 * Emit message status update
 */
export function emitMessageStatus(messageIds, status, targetUserId, additionalData = {}) {
  if (!io) return;
  
  io.to(`user:${targetUserId}`).emit('message:status', {
    messageIds,
    status,
    ...additionalData
  });
}

/**
 * Emit conversation update (new message preview, unread count)
 */
export function emitConversationUpdate(userId, conversationData) {
  if (!io) return;
  
  io.to(`user:${userId}`).emit('conversation:update', conversationData);
}

/**
 * Emit message deleted event
 */
export function emitMessageDeleted(messageId, conversationKey) {
  if (!io) return;
  
  io.to(`conversation:${conversationKey}`).emit('message:deleted', { messageId });
}

/**
 * Emit reaction update
 */
export function emitReactionUpdate(messageId, reactions, conversationKey) {
  if (!io) return;
  
  io.to(`conversation:${conversationKey}`).emit('message:reaction', { 
    messageId, 
    reactions 
  });
}

export function emitSupportConversationUpdate(conversation, options = {}) {
  if (!io || !conversation?.sessionId) return;

  const workspaceId = conversation.workspaceId ? String(conversation.workspaceId) : null;
  const userId = conversation.userId ? String(conversation.userId) : null;
  const lastMessage = Array.isArray(conversation.messages) && conversation.messages.length > 0
    ? conversation.messages[conversation.messages.length - 1]
    : null;

  const payload = {
    sessionId: conversation.sessionId,
    workspaceId,
    userId,
    userName: conversation.userName || '',
    userEmail: conversation.userEmail || '',
    visitorName: conversation.visitorName || '',
    visitorEmail: conversation.visitorEmail || '',
    status: conversation.status,
    workflowStatus: conversation.workflowStatus,
    handledBy: conversation.handledBy,
    priority: conversation.priority,
    unreadAdmin: conversation.unreadAdmin || 0,
    unreadUser: conversation.unreadUser || 0,
    subject: conversation.subject || '',
    category: conversation.category || 'general',
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt || new Date(),
    lastMessage: lastMessage
      ? {
        _id: lastMessage._id,
        from: lastMessage.from,
        senderType: lastMessage.senderType,
        text: lastMessage.text,
        agentName: lastMessage.agentName,
        createdAt: lastMessage.createdAt,
      }
      : null,
    eventType: options.eventType || 'updated',
    initiator: options.initiator || null,
  };

  io.to('support:admins').emit('support:updated', payload);
  io.to(`support:session:${conversation.sessionId}`).emit('support:updated', payload);

  if (workspaceId && userId) {
    io.to(`support:user:${workspaceId}:${userId}`).emit('support:updated', payload);
  }
}

/**
 * Broadcast a theme update to all visitors of a store (called after DB save)
 */
export function emitThemeUpdate(subdomain, theme) {
  if (!storeLiveNamespace || !subdomain) return;
  storeLiveNamespace.to(`store:${subdomain.toLowerCase()}`).emit('theme:update', theme);
}

export default {
  initSocketServer,
  getIO,
  isUserOnline,
  getOnlineUsersInWorkspace,
  emitNewMessage,
  emitMessageStatus,
  emitConversationUpdate,
  emitMessageDeleted,
  emitReactionUpdate,
  emitThemeUpdate
};
