import express from 'express';
import SupportConversation from '../models/SupportConversation.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';

const router = express.Router();

// Simple in-memory rate limiter per IP (max 30 messages / 10 min)
const ipCounters = new Map();
const RATE_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT  = 30;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipCounters.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) { entry.count = 0; entry.start = now; }
  entry.count++;
  ipCounters.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// Clean up every 15 min to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipCounters.entries()) {
    if (now - e.start > RATE_WINDOW) ipCounters.delete(ip);
  }
}, 15 * 60 * 1000);

// ─── POST /api/ecom/support/message ────────────────────────────────────────
// Public — visitor sends a message (no auth required)
router.post('/message', async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, message: 'Trop de messages. Patientez quelques minutes.' });
    }

    const { sessionId, text, visitorName, visitorEmail } = req.body;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
      return res.status(400).json({ success: false, message: 'sessionId invalide' });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }

    // Sanitise text
    const safeText = text.trim().slice(0, 2000);
    if (!safeText) return res.status(400).json({ success: false, message: 'Message vide' });

    const conversation = await SupportConversation.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: { from: 'visitor', text: safeText } },
        $inc:  { unreadAdmin: 1 },
        $set:  {
          lastMessageAt: new Date(),
          status: 'open',
          ...(visitorName  ? { visitorName  } : {}),
          ...(visitorEmail ? { visitorEmail } : {}),
        },
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, data: { conversationId: conversation._id } });
  } catch (err) {
    console.error('[Support] POST /message error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /api/ecom/support/session/:sessionId ──────────────────────────────
// Public — visitor polls for agent replies
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ success: false, message: 'sessionId invalide' });
    }

    const conv = await SupportConversation.findOne({ sessionId }).select('messages status');
    if (!conv) return res.json({ success: true, data: { messages: [], status: 'open' } });

    // Only return agent messages (we already display visitor messages locally)
    const agentMessages = conv.messages
      .filter(m => m.from === 'agent')
      .map(m => ({ id: m._id, text: m.text, agentName: m.agentName, createdAt: m.createdAt }));

    res.json({ success: true, data: { messages: agentMessages, status: conv.status } });
  } catch (err) {
    console.error('[Support] GET /session error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTHENTICATED USER SUPPORT
// ═══════════════════════════════════════════════════════════════

// GET /api/ecom/support/my-tickets — List current user's support tickets
router.get('/my-tickets', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await SupportConversation.find({ userId })
      .sort({ lastMessageAt: -1 })
      .select('sessionId subject category status unreadUser lastMessageAt createdAt messages');

    const tickets = conversations.map(c => ({
      sessionId: c.sessionId,
      subject: c.subject || 'Sans objet',
      category: c.category,
      status: c.status,
      unreadUser: c.unreadUser || 0,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
      lastMessage: c.messages?.length ? c.messages[c.messages.length - 1]?.text?.slice(0, 80) : '',
      messageCount: c.messages?.length || 0,
    }));

    res.json({ success: true, data: { tickets } });
  } catch (err) {
    console.error('[Support] GET /my-tickets error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/support/my-tickets — Create a new support ticket
router.post('/my-tickets', requireEcomAuth, async (req, res) => {
  try {
    const { subject, category, text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    const safeText = text.trim().slice(0, 2000);
    const safeSubject = (subject || '').trim().slice(0, 200) || 'Sans objet';
    const validCategories = ['general', 'bug', 'billing', 'feature', 'account', 'other'];
    const safeCategory = validCategories.includes(category) ? category : 'general';

    const sessionId = `user_${req.user._id}_${Date.now()}`;
    const conversation = await SupportConversation.create({
      sessionId,
      userId: req.user._id,
      userName: req.user.name || '',
      userEmail: req.user.email || '',
      workspaceId: req.user.workspaceId || null,
      subject: safeSubject,
      category: safeCategory,
      messages: [{ from: 'visitor', text: safeText }],
      unreadAdmin: 1,
      lastMessageAt: new Date(),
      status: 'open',
    });

    res.json({ success: true, data: { sessionId: conversation.sessionId } });
  } catch (err) {
    console.error('[Support] POST /my-tickets error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/support/my-tickets/:sessionId — Get ticket detail + mark user messages as read
router.get('/my-tickets/:sessionId', requireEcomAuth, async (req, res) => {
  try {
    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId: req.user._id },
      { $set: { unreadUser: 0 } },
      { new: true }
    );
    if (!conv) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support] GET /my-tickets/:id error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/ecom/support/my-tickets/:sessionId/reply — User replies to their ticket
router.post('/my-tickets/:sessionId/reply', requireEcomAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message requis' });
    }
    const safeText = text.trim().slice(0, 2000);

    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId: req.user._id },
      {
        $push: { messages: { from: 'visitor', text: safeText } },
        $inc: { unreadAdmin: 1 },
        $set: { lastMessageAt: new Date(), status: 'open' },
      },
      { new: true }
    );

    if (!conv) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support] POST /my-tickets/:id/reply error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
