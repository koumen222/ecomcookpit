import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io = null;
const userSockets = new Map(); // userId -> Set of socket ids
const typingUsers = new Map(); // conversationKey -> Map of userId -> timeout

const JWT_SECRET = process.env.ECOM_JWT_SECRET || 'ecom-secret-key-change-in-production';

/**
 * Initialize Socket.io server
 * @param {http.Server} httpServer - The HTTP server instance
 */
export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
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

    // Handle joining a conversation room
    socket.on('conversation:join', (data) => {
      const { recipientId } = data;
      if (recipientId) {
        const convKey = [userId, recipientId].sort().join('_');
        socket.join(`conversation:${convKey}`);
        console.log(`[Socket] User ${userId} joined conversation:${convKey}`);
      }
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

export default {
  initSocketServer,
  getIO,
  isUserOnline,
  getOnlineUsersInWorkspace,
  emitNewMessage,
  emitMessageStatus,
  emitConversationUpdate,
  emitMessageDeleted,
  emitReactionUpdate
};
