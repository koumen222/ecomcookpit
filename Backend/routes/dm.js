import express from 'express';
import mongoose from 'mongoose';
import DirectMessage from '../models/DirectMessage.js';
import EcomUser from '../models/EcomUser.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { emitNewMessage, emitMessageDeleted, emitReactionUpdate, emitMessageStatus, emitConversationUpdate } from '../services/socketService.js';
import { notifyNewDM } from '../services/notificationHelper.js';

const router = express.Router();

// Clé de conversation entre deux users (ordre stable)
const convKey = (a, b) => [a.toString(), b.toString()].sort().join('_');

// Helper: format message preview for inbox
const formatMessagePreview = (msg) => {
  if (msg.deleted) return '🗑️ Message supprimé';
  if (msg.messageType === 'image') return '📷 Photo';
  if (msg.messageType === 'audio') return '🎤 Message vocal';
  if (msg.messageType === 'video') return '🎬 Vidéo';
  if (msg.messageType === 'document') return '📎 Document';
  return msg.content?.substring(0, 50) + (msg.content?.length > 50 ? '...' : '') || '';
};

// GET /api/ecom/dm/conversations - Liste des conversations avec dernier message
router.get('/conversations', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id;
    const workspaceId = req.workspaceId;
    const { search } = req.query;

    // Dernier message par paire de participants
    const convos = await DirectMessage.aggregate([
      { $match: { workspaceId: new mongoose.Types.ObjectId(workspaceId), participants: new mongoose.Types.ObjectId(userId), deleted: false } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $lt: [{ $arrayElemAt: ['$participants', 0] }, { $arrayElemAt: ['$participants', 1] }] },
              { $concat: [{ $toString: { $arrayElemAt: ['$participants', 0] } }, '_', { $toString: { $arrayElemAt: ['$participants', 1] } }] },
              { $concat: [{ $toString: { $arrayElemAt: ['$participants', 1] } }, '_', { $toString: { $arrayElemAt: ['$participants', 0] } }] }
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unread: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$senderId', new mongoose.Types.ObjectId(userId)] },
                    { $not: { $in: [new mongoose.Types.ObjectId(userId), '$readBy.userId'] } }
                  ]
                },
                1, 0
              ]
            }
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    // Enrichir avec les infos de l'autre participant
    const enriched = await Promise.all(convos.map(async (c) => {
      const otherIds = c.lastMessage.participants.filter(p => p.toString() !== userId.toString());
      const other = await EcomUser.findById(otherIds[0]).select('name email role avatar').lean();
      return {
        ...c,
        other,
        preview: formatMessagePreview(c.lastMessage),
        lastMessageAt: c.lastMessage.createdAt
      };
    }));

    // Optional search filter
    let filtered = enriched;
    if (search?.trim()) {
      const q = search.toLowerCase();
      filtered = enriched.filter(c =>
        (c.other?.name || '').toLowerCase().includes(q) ||
        (c.other?.email || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, conversations: filtered });
  } catch (error) {
    console.error('Erreur GET /dm/conversations:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/dm/:userId - Messages avec un utilisateur (cursor-based pagination)
router.get('/:userId', requireEcomAuth, async (req, res) => {
  try {
    const meId = req.ecomUser._id;
    const otherId = new mongoose.Types.ObjectId(req.params.userId);
    const workspaceId = req.workspaceId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const cursor = req.query.cursor; // ObjectId of last message for pagination
    const direction = req.query.direction || 'older'; // 'older' or 'newer'

    // Build query
    const query = {
      workspaceId,
      participants: { $all: [meId, otherId] },
      deleted: false
    };

    // Cursor-based pagination (more efficient than offset)
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      const cursorId = new mongoose.Types.ObjectId(cursor);
      if (direction === 'newer') {
        query._id = { $gt: cursorId };
      } else {
        query._id = { $lt: cursorId };
      }
    }

    const sortOrder = direction === 'newer' ? 1 : -1;

    const messages = await DirectMessage.find(query)
      .sort({ _id: sortOrder })
      .limit(limit + 1) // Fetch one extra to check if there are more
      .populate('replyTo', 'content senderName messageType')
      .lean();

    // Check if there are more messages
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    // Always return in chronological order (oldest first)
    if (direction === 'older') messages.reverse();

    // Marquer comme lus (async, don't wait)
    DirectMessage.updateMany(
      { workspaceId, participants: { $all: [meId, otherId] }, senderId: { $ne: meId }, 'readBy.userId': { $ne: meId } },
      { $push: { readBy: { userId: meId, readAt: new Date() } }, $set: { status: 'read' } }
    ).exec().catch(() => { });

    // Get cursors for next/prev pagination
    const oldestId = messages[0]?._id || null;
    const newestId = messages[messages.length - 1]?._id || null;

    res.json({
      success: true,
      messages,
      pagination: {
        limit,
        hasMore,
        oldestCursor: oldestId,
        newestCursor: newestId
      }
    });
  } catch (error) {
    console.error('Erreur GET /dm/:userId:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/dm/:userId - Envoyer un message direct (text, media, reply)
router.post('/:userId', requireEcomAuth, async (req, res) => {
  try {
    const meId = req.ecomUser._id;
    const otherId = new mongoose.Types.ObjectId(req.params.userId);
    const {
      content,
      messageType = 'text',
      mediaId,
      mediaUrl,
      metadata = {},
      replyTo,
      clientMessageId,
      mentions = []
    } = req.body;

    // Validate: need content OR media
    const hasContent = content?.trim();
    const hasMedia = mediaId || mediaUrl;
    if (!hasContent && !hasMedia) {
      return res.status(400).json({ success: false, message: 'Contenu ou média requis' });
    }

    // Idempotency check: if clientMessageId already exists, return existing message
    if (clientMessageId) {
      const existing = await DirectMessage.findOne({
        workspaceId: req.workspaceId,
        clientMessageId
      }).lean();
      if (existing) {
        return res.status(200).json({ success: true, message: existing, duplicate: true });
      }
    }

    // Verify recipient exists in workspace
    const other = await EcomUser.findOne({ _id: otherId, workspaceId: req.workspaceId }).lean();
    if (!other) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    // Build reply preview if replying
    let replyToPreview = null;
    if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
      const originalMsg = await DirectMessage.findById(replyTo).select('content senderName messageType').lean();
      if (originalMsg) {
        replyToPreview = {
          content: originalMsg.content?.substring(0, 100) || '',
          senderName: originalMsg.senderName,
          messageType: originalMsg.messageType
        };
      }
    }

    // Parse mentions from content (extract @username patterns)
    const mentionIds = [];
    if (hasContent && mentions.length === 0) {
      const mentionMatches = content.match(/@(\S+)/g) || [];
      if (mentionMatches.length > 0) {
        const mentionNames = mentionMatches.map(m => m.slice(1).toLowerCase());
        const mentionedUsers = await EcomUser.find({
          workspaceId: req.workspaceId,
          $or: [
            { name: { $in: mentionNames.map(n => new RegExp(`^${n}`, 'i')) } },
            { email: { $in: mentionNames.map(n => new RegExp(`^${n}`, 'i')) } }
          ]
        }).select('_id').lean();
        mentionIds.push(...mentionedUsers.map(u => u._id));
      }
    } else {
      mentionIds.push(...mentions.filter(id => mongoose.Types.ObjectId.isValid(id)));
    }

    const message = await DirectMessage.create({
      workspaceId: req.workspaceId,
      participants: [meId, otherId],
      senderId: meId,
      senderName: req.ecomUser.name || req.ecomUser.email,
      senderRole: req.ecomUser.role,
      content: hasContent ? content.trim() : '',
      messageType: hasMedia ? messageType : 'text',
      mediaId: mediaId || null,
      mediaUrl: mediaUrl || null,
      metadata: {
        ...metadata,
        mentions: mentionIds
      },
      replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null,
      replyToPreview,
      clientMessageId: clientMessageId || null,
      status: 'sent',
      readBy: [{ userId: meId, readAt: new Date() }]
    });

    // Populate reply for response
    const populated = await DirectMessage.findById(message._id)
      .populate('replyTo', 'content senderName messageType')
      .lean();

    // Emit WebSocket event for real-time delivery
    emitNewMessage(populated, otherId.toString());

    // Update conversation preview for recipient
    emitConversationUpdate(otherId.toString(), {
      recipientId: meId.toString(),
      lastMessage: populated,
      preview: formatMessagePreview(populated)
    });

    // ── Notification interne (panneau notifications) ─────────────────
    try {
      const senderName = req.ecomUser.name || req.ecomUser.email.split('@')[0];
      await notifyNewDM(req.workspaceId, otherId, {
        senderName,
        content: hasContent ? content.trim() : formatMessagePreview(populated),
        messageId: message._id
      });
    } catch (internalNotifError) {
      console.warn('⚠️ Erreur notification interne DM:', internalNotifError.message);
    }
    // ───────────────────────────────────────────────────────────────────

    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    // Handle duplicate key error for clientMessageId
    if (error.code === 11000 && error.keyPattern?.clientMessageId) {
      const existing = await DirectMessage.findOne({
        workspaceId: req.workspaceId,
        clientMessageId: req.body.clientMessageId
      }).lean();
      if (existing) {
        return res.status(200).json({ success: true, message: existing, duplicate: true });
      }
    }
    console.error('Erreur POST /dm/:userId:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// DELETE /api/ecom/dm/message/:id - Supprimer un message DM
router.delete('/message/:id', requireEcomAuth, async (req, res) => {
  try {
    const msg = await DirectMessage.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!msg) return res.status(404).json({ success: false, message: 'Message non trouvé' });
    if (msg.senderId.toString() !== req.ecomUser._id.toString() && !['ecom_admin', 'super_admin'].includes(req.ecomUser.role)) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }
    msg.deleted = true;
    await msg.save();

    // Emit WebSocket event
    const conversationKey = convKey(msg.participants[0], msg.participants[1]);
    emitMessageDeleted(msg._id.toString(), conversationKey);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PUT /api/ecom/dm/message/:id - Modifier un message DM
router.put('/message/:id', requireEcomAuth, async (req, res) => {
  try {
    const msg = await DirectMessage.findOne({ _id: req.params.id, workspaceId: req.workspaceId });
    if (!msg) return res.status(404).json({ success: false, message: 'Message non trouvé' });
    if (msg.senderId.toString() !== req.ecomUser._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }
    if (msg.messageType !== 'text') {
      return res.status(400).json({ success: false, message: 'Seuls les messages texte peuvent être modifiés' });
    }

    const { content } = req.body;
    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Contenu requis' });
    }

    msg.content = content.trim();
    msg.edited = true;
    msg.editedAt = new Date();
    await msg.save();

    res.json({ success: true, message: msg });
  } catch (error) {
    console.error('Erreur PUT /dm/message/:id:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/dm/message/:id/reaction - Ajouter/retirer une réaction emoji
router.post('/message/:id/reaction', requireEcomAuth, async (req, res) => {
  try {
    const { emoji, action = 'add' } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji requis' });

    const msg = await DirectMessage.findOne({
      _id: req.params.id,
      workspaceId: req.workspaceId,
      participants: req.ecomUser._id
    });
    if (!msg) return res.status(404).json({ success: false, message: 'Message non trouvé' });

    if (action === 'remove') {
      msg.removeReaction(req.ecomUser._id, emoji);
    } else {
      msg.addReaction(req.ecomUser._id, emoji);
    }
    await msg.save();

    // Emit WebSocket event for reaction update
    const conversationKey = convKey(msg.participants[0], msg.participants[1]);
    emitReactionUpdate(msg._id.toString(), msg.metadata.reactions, conversationKey);

    res.json({ success: true, reactions: msg.metadata.reactions });
  } catch (error) {
    console.error('Erreur POST /dm/message/:id/reaction:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/dm/:userId/read - Marquer tous les messages comme lus
router.post('/:userId/read', requireEcomAuth, async (req, res) => {
  try {
    const meId = req.ecomUser._id;
    const otherId = new mongoose.Types.ObjectId(req.params.userId);

    // Get unread message IDs before updating
    const unreadMessages = await DirectMessage.find({
      workspaceId: req.workspaceId,
      participants: { $all: [meId, otherId] },
      senderId: { $ne: meId },
      'readBy.userId': { $ne: meId },
      deleted: false
    }).select('_id').lean();

    const messageIds = unreadMessages.map(m => m._id.toString());

    const result = await DirectMessage.updateMany(
      {
        workspaceId: req.workspaceId,
        participants: { $all: [meId, otherId] },
        senderId: { $ne: meId },
        'readBy.userId': { $ne: meId },
        deleted: false
      },
      {
        $push: { readBy: { userId: meId, readAt: new Date() } },
        $set: { status: 'read' }
      }
    );

    // Emit read receipt to sender
    if (messageIds.length > 0) {
      emitMessageStatus(messageIds, 'read', otherId.toString(), {
        readBy: meId.toString(),
        readAt: new Date()
      });
    }

    res.json({ success: true, markedRead: result.modifiedCount });
  } catch (error) {
    console.error('Erreur POST /dm/:userId/read:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/dm/unread/count - Nombre total de DM non lus
router.get('/unread/count', requireEcomAuth, async (req, res) => {
  try {
    const count = await DirectMessage.countDocuments({
      workspaceId: req.workspaceId,
      participants: req.ecomUser._id,
      senderId: { $ne: req.ecomUser._id },
      'readBy.userId': { $ne: req.ecomUser._id },
      deleted: false
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/dm/:userId/typing - Indicateur "en train d'écrire" (pour WebSocket)
router.post('/:userId/typing', requireEcomAuth, async (req, res) => {
  // This endpoint is a placeholder - typing indicators are handled via WebSocket
  // The frontend calls this to trigger a WebSocket event
  res.json({ success: true });
});

export default router;
