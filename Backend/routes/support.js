import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import SupportConversation from '../models/SupportConversation.js';
import EcomUser from '../models/EcomUser.js';
import Order from '../models/Order.js';
import Store from '../models/Store.js';
import StoreOrder from '../models/StoreOrder.js';
import StoreProduct from '../models/StoreProduct.js';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import WhatsAppLog from '../models/WhatsAppLog.js';
import Workspace from '../models/Workspace.js';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import { emitSupportConversationUpdate } from '../services/socketService.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';

const router = express.Router();
const VALID_CATEGORIES = ['general', 'bug', 'billing', 'feature', 'account', 'other'];
const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const SUPPORT_AI_THRESHOLD = Number(process.env.SUPPORT_AI_CONFIDENCE_THRESHOLD || 78);
const SUPPORT_AI_API_KEY = process.env.NANOBANANA_API_KEY || process.env.GEMINI_API_KEY || '';
const SUPPORT_AI_MODEL = process.env.SUPPORT_AI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const FRONTEND_BASE_URL = (process.env.FRONTEND_URL || 'https://scalor.net').replace(/\/$/, '');
const ADMIN_NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000;

let supportAiClient = null;

function getSupportAiModel() {
  if (!SUPPORT_AI_API_KEY) return null;
  if (!supportAiClient) {
    supportAiClient = new GoogleGenerativeAI(SUPPORT_AI_API_KEY);
  }
  return supportAiClient.getGenerativeModel({ model: SUPPORT_AI_MODEL });
}

function normalizeText(value, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeCategory(category) {
  return VALID_CATEGORIES.includes(category) ? category : 'general';
}

function safePriority(priority) {
  return VALID_PRIORITIES.includes(priority) ? priority : 'normal';
}

function buildSupportSessionId(userId, workspaceId) {
  return `support_${workspaceId}_${userId}_${Date.now()}`;
}

function getConversationPreview(conversation) {
  const lastMessage = Array.isArray(conversation?.messages) && conversation.messages.length > 0
    ? conversation.messages[conversation.messages.length - 1]
    : null;

  return {
    sessionId: conversation.sessionId,
    subject: conversation.subject || 'Support Scalor',
    category: conversation.category,
    status: conversation.status,
    workflowStatus: conversation.workflowStatus,
    handledBy: conversation.handledBy,
    priority: conversation.priority,
    unreadUser: conversation.unreadUser || 0,
    unreadAdmin: conversation.unreadAdmin || 0,
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    lastMessage: lastMessage?.text?.slice(0, 120) || '',
    messageCount: conversation.messages?.length || 0,
  };
}

function summarizeQuestion(text) {
  const normalized = normalizeText(text, 220);
  if (!normalized) return 'Nouvelle demande support';
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function extractJsonPayload(rawText = '') {
  const trimmed = String(rawText || '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Réponse IA non parsable');
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

async function buildWorkspaceSupportContext(workspaceId, user) {
  const [workspace, storeCount, productCount, publishedCount, storeOrderCount, orderCount, activeWhatsAppInstances] = await Promise.all([
    Workspace.findById(workspaceId)
      .select('name slug subdomain plan planExpiresAt storeSettings freeGenerationsRemaining paidGenerationsRemaining simpleGenerationsRemaining proGenerationsRemaining totalGenerations totalSimpleGenerations totalProGenerations lastGenerationAt')
      .lean(),
    Store.countDocuments({ workspaceId, isActive: true }),
    StoreProduct.countDocuments({ workspaceId }),
    StoreProduct.countDocuments({ workspaceId, isPublished: true }),
    StoreOrder.countDocuments({ workspaceId }),
    Order.countDocuments({ workspaceId }),
    WhatsAppInstance.countDocuments({ workspaceId, isActive: true, status: { $in: ['connected', 'active'] } }),
  ]);

  return {
    workspace: workspace
      ? {
        id: String(workspace._id),
        name: workspace.name,
        slug: workspace.slug,
        subdomain: workspace.subdomain || '',
        plan: workspace.plan || 'free',
        planExpiresAt: workspace.planExpiresAt || null,
        storeName: workspace.storeSettings?.storeName || '',
        generatorCredits: {
          free: Number(workspace.freeGenerationsRemaining || 0),
          paid: Number(workspace.paidGenerationsRemaining || 0),
          simple: Number(workspace.simpleGenerationsRemaining || 0),
          pro: Number(workspace.proGenerationsRemaining || 0),
          total: Number(workspace.totalGenerations || 0),
          totalSimple: Number(workspace.totalSimpleGenerations || 0),
          totalPro: Number(workspace.totalProGenerations || 0),
          lastGenerationAt: workspace.lastGenerationAt || null,
        },
      }
      : null,
    metrics: {
      storeCount,
      productCount,
      publishedCount,
      storeOrderCount,
      orderCount,
      activeWhatsAppInstances,
    },
    user: {
      id: String(user?._id || ''),
      name: user?.name || '',
      email: user?.email || '',
      role: user?.role || '',
    },
  };
}

function buildSupportKnowledgeBase() {
  return [
    'Scalor est une plateforme SaaS multi-workspace pour e-commerce.',
    'Chaque utilisateur travaille dans un workspace actif et peut avoir des roles differents selon le workspace.',
    'Le support doit rester isole par workspace et par utilisateur.',
    'Les sujets frequents: connexion, acces workspace, facturation, credits de generation, boutique, commandes, WhatsApp, domaines, membres equipe.',
    'Les notifications WhatsApp du support sont uniquement des alertes vers l\'admin; aucune reponse WhatsApp n\'est autorisee.',
    'Quand la confiance IA est insuffisante, il faut escalader a un admin humain.',
    'Si la demande implique correction manuelle de donnees, remboursement, securite, bug inconnu, indisponibilite, ou action sensible, il faut escalader.',
    'Si la demande peut etre resolue a partir du contexte workspace et des fonctionnalites connues, l\'IA peut repondre clairement et de maniere concise.',
  ].join('\n');
}

async function getSupportAiDecision({ conversation, latestMessage, workspaceContext }) {
  const model = getSupportAiModel();
  if (!model) {
    return {
      confidence: 0,
      shouldReply: false,
      needsAdmin: true,
      answer: '',
      summary: summarizeQuestion(latestMessage?.text),
      priority: 'normal',
      category: conversation.category || 'general',
      escalationReason: 'IA indisponible ou non configuree',
    };
  }

  const history = (conversation.messages || [])
    .slice(-8)
    .map((message) => ({
      from: message.from,
      senderType: message.senderType,
      text: message.text,
      createdAt: message.createdAt,
    }));

  const prompt = `Tu es l'assistant support interne de Scalor.\n\n${buildSupportKnowledgeBase()}\n\nContexte workspace:\n${JSON.stringify(workspaceContext, null, 2)}\n\nConversation recente:\n${JSON.stringify(history, null, 2)}\n\nDerniere question utilisateur:\n${latestMessage?.text || ''}\n\nReponds UNIQUEMENT en JSON valide avec ce schema:\n{\n  "confidence": 0-100,\n  "shouldReply": true|false,\n  "needsAdmin": true|false,\n  "answer": "reponse concise en francais",\n  "summary": "resume en une phrase",\n  "priority": "low|normal|high|urgent",\n  "category": "general|bug|billing|feature|account|other",\n  "escalationReason": "raison humaine si besoin"\n}\n\nRegles:\n- shouldReply=true seulement si la reponse est fiable et actionnable.\n- needsAdmin=true si la confiance est insuffisante, si une action humaine est necessaire, ou si le bug n'est pas clairement resolvable.\n- confidence doit etre severe et conservatrice.\n- Si tu reponds, answer doit etre claire, precise, sans promettre une action humaine immediate.\n- summary doit permettre d'envoyer une notification admin.\n- priority=urgent seulement si blocage critique, securite, paiement, indisponibilite majeure ou perte d'acces.\n`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result?.response?.text?.() || '';
    const parsed = extractJsonPayload(rawText);

    return {
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence || 0))),
      shouldReply: parsed.shouldReply === true,
      needsAdmin: parsed.needsAdmin !== false,
      answer: normalizeText(parsed.answer, 2000),
      summary: normalizeText(parsed.summary, 240) || summarizeQuestion(latestMessage?.text),
      priority: safePriority(parsed.priority),
      category: safeCategory(parsed.category),
      escalationReason: normalizeText(parsed.escalationReason, 240),
    };
  } catch (error) {
    console.error('[Support AI] Decision error:', error.message);
    return {
      confidence: 0,
      shouldReply: false,
      needsAdmin: true,
      answer: '',
      summary: summarizeQuestion(latestMessage?.text),
      priority: 'normal',
      category: conversation.category || 'general',
      escalationReason: 'Analyse IA impossible',
    };
  }
}

async function notifySupportAdmins(conversation) {
  if (!conversation?.workspaceId) return;

  const lastNotificationAt = conversation.lastAdminNotificationAt ? new Date(conversation.lastAdminNotificationAt).getTime() : 0;
  if (lastNotificationAt && (Date.now() - lastNotificationAt) < ADMIN_NOTIFICATION_COOLDOWN_MS) {
    return;
  }

  const [workspace, admins] = await Promise.all([
    Workspace.findById(conversation.workspaceId).select('name slug subdomain').lean(),
    EcomUser.find({
      role: 'super_admin',
      isActive: true,
      supportNotificationEnabled: true,
      supportNotificationPhone: { $nin: ['', null] },
      supportNotificationInstanceId: { $ne: null },
    }).select('name email supportNotificationPhone supportNotificationInstanceId').lean(),
  ]);

  if (!admins.length) return;

  const latestUserMessage = [...(conversation.messages || [])].reverse().find((message) => message.from === 'visitor');
  const summary = conversation.aiSummary || summarizeQuestion(latestUserMessage?.text);
  const workspaceName = workspace?.name || 'Workspace inconnu';
  const link = `${FRONTEND_BASE_URL}/ecom/super-admin/support?conversation=${encodeURIComponent(conversation.sessionId)}`;
  const message = [
    'Alerte support Scalor',
    '',
    `Workspace: ${workspaceName}`,
    `Priorite: ${conversation.priority || 'normal'}`,
    `Resume: ${summary}`,
    '',
    `Ouvrir: ${link}`,
  ].join('\n');

  let sent = false;
  let lastError = '';
  let notifiedPhone = '';

  for (const admin of admins) {
    try {
      const result = await sendWhatsAppMessage({
        to: admin.supportNotificationPhone,
        message,
        workspaceId: conversation.workspaceId,
        userId: admin._id,
        firstName: admin.name || '',
        instanceId: admin.supportNotificationInstanceId,
      });

      notifiedPhone = admin.supportNotificationPhone;
      sent = true;

      await WhatsAppLog.create({
        workspaceId: conversation.workspaceId,
        userId: admin._id,
        phoneNumber: admin.supportNotificationPhone,
        message,
        status: 'sent',
        messageId: result.messageId,
        instanceName: result.instanceName,
        messageType: 'text',
        sentAt: new Date(),
        metadata: {
          type: 'support_escalation',
          sessionId: conversation.sessionId,
          summary,
          link,
          workflowStatus: conversation.workflowStatus,
          supportNotificationInstanceId: admin.supportNotificationInstanceId,
        },
      });
    } catch (error) {
      lastError = error.message;
      notifiedPhone = admin.supportNotificationPhone;

      await WhatsAppLog.create({
        workspaceId: conversation.workspaceId,
        userId: admin._id,
        phoneNumber: admin.supportNotificationPhone,
        message,
        status: 'failed',
        errorMessage: error.message,
        messageType: 'text',
        sentAt: new Date(),
        metadata: {
          type: 'support_escalation',
          sessionId: conversation.sessionId,
          summary,
          link,
          workflowStatus: conversation.workflowStatus,
          supportNotificationInstanceId: admin.supportNotificationInstanceId,
        },
      });
    }
  }

  await SupportConversation.findByIdAndUpdate(conversation._id, {
    $set: {
      lastAdminNotificationAt: new Date(),
      adminNotificationStatus: sent ? 'sent' : 'failed',
      adminNotificationError: sent ? '' : normalizeText(lastError, 500),
      adminNotifiedPhone: notifiedPhone,
    },
  });
}

async function runSupportAutomation(conversationId, user) {
  try {
    const conversation = await SupportConversation.findById(conversationId);
    if (!conversation || !conversation.userId || !conversation.workspaceId) return;

    const latestMessage = [...(conversation.messages || [])].reverse().find((message) => message.from === 'visitor');
    if (!latestMessage) return;

    const workspaceContext = await buildWorkspaceSupportContext(conversation.workspaceId, user);
    const aiDecision = await getSupportAiDecision({ conversation, latestMessage, workspaceContext });
    const now = new Date();

    if (aiDecision.shouldReply && aiDecision.confidence >= SUPPORT_AI_THRESHOLD && aiDecision.answer) {
      const updatedConversation = await SupportConversation.findByIdAndUpdate(
        conversation._id,
        {
          $push: {
            messages: {
              from: 'agent',
              senderType: 'ai',
              text: aiDecision.answer,
              agentName: 'Scalor IA',
              confidence: aiDecision.confidence,
              createdAt: now,
            }
          },
          $inc: { unreadUser: 1 },
          $set: {
            category: aiDecision.category,
            priority: aiDecision.priority,
            aiConfidence: aiDecision.confidence,
            aiThreshold: SUPPORT_AI_THRESHOLD,
            aiSummary: aiDecision.summary,
            escalationReason: '',
            workflowStatus: 'ai',
            handledBy: 'ai',
            status: 'replied',
            lastMessageAt: now,
          },
        },
        { new: true }
      );

      emitSupportConversationUpdate(updatedConversation, { eventType: 'ai_reply', initiator: 'ai' });
      return;
    }

    const updatedConversation = await SupportConversation.findByIdAndUpdate(
      conversation._id,
      {
        $set: {
          category: aiDecision.category,
          priority: aiDecision.priority,
          aiConfidence: aiDecision.confidence,
          aiThreshold: SUPPORT_AI_THRESHOLD,
          aiSummary: aiDecision.summary,
          escalationReason: aiDecision.escalationReason || 'Confiance IA insuffisante',
          workflowStatus: 'pending_admin',
          handledBy: 'none',
          lastEscalatedAt: now,
          status: 'open',
        },
      },
      { new: true }
    );

    emitSupportConversationUpdate(updatedConversation, { eventType: 'escalated', initiator: 'ai' });
    await notifySupportAdmins(updatedConversation);
  } catch (error) {
    console.error('[Support] Automation error:', error.message);
  }
}

async function findActiveConversationForUser(userId, workspaceId) {
  return SupportConversation.findOne({
    userId,
    workspaceId,
    threadType: 'authenticated',
    workflowStatus: { $ne: 'resolved' },
    status: { $ne: 'closed' },
  }).sort({ lastMessageAt: -1 });
}

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
        $push: { messages: { from: 'visitor', senderType: 'user', text: safeText } },
        $inc:  { unreadAdmin: 1 },
        $set:  {
          lastMessageAt: new Date(),
          status: 'open',
          workflowStatus: 'pending_admin',
          handledBy: 'none',
          threadType: 'visitor',
          ...(visitorName  ? { visitorName  } : {}),
          ...(visitorEmail ? { visitorEmail } : {}),
        },
      },
      { new: true, upsert: true }
    );

    emitSupportConversationUpdate(conversation, { eventType: 'visitor_message', initiator: 'visitor' });

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
    const userId = req.ecomUser?._id || req.user?.id;
    const workspaceId = req.workspaceId || req.ecomUser?.workspaceId || null;
    const conversations = await SupportConversation.find({ userId, workspaceId })
      .sort({ lastMessageAt: -1 })
      .select('sessionId subject category status workflowStatus handledBy priority unreadUser unreadAdmin lastMessageAt createdAt messages');

    const tickets = conversations.map((conversation) => ({
      ...getConversationPreview(conversation),
      subject: conversation.subject || 'Support Scalor',
      workspaceId,
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
    const safeSubject = normalizeText(subject, 200) || 'Support Scalor';
    const safeCategoryValue = safeCategory(category);
    const workspaceId = req.workspaceId || req.ecomUser?.workspaceId || null;
    const userId = req.ecomUser?._id || req.user?.id;

    let conversation = await findActiveConversationForUser(userId, workspaceId);
    if (conversation) {
      conversation = await SupportConversation.findByIdAndUpdate(
        conversation._id,
        {
          $push: { messages: { from: 'visitor', senderType: 'user', text: safeText } },
          $inc: { unreadAdmin: 1 },
          $set: {
            subject: safeSubject,
            category: safeCategoryValue,
            lastMessageAt: new Date(),
            status: 'open',
            workflowStatus: 'pending_admin',
            handledBy: 'none',
          },
        },
        { new: true }
      );
    } else {
      conversation = await SupportConversation.create({
        sessionId: buildSupportSessionId(userId, workspaceId),
        userId,
        userName: req.ecomUser?.name || req.user?.name || '',
        userEmail: req.ecomUser?.email || req.user?.email || '',
        workspaceId,
        threadType: 'authenticated',
        subject: safeSubject,
        category: safeCategoryValue,
        priority: 'normal',
        workflowStatus: 'pending_admin',
        handledBy: 'none',
        messages: [{ from: 'visitor', senderType: 'user', text: safeText }],
        unreadAdmin: 1,
        lastMessageAt: new Date(),
        status: 'open',
      });
    }

    emitSupportConversationUpdate(conversation, { eventType: 'user_message', initiator: 'user' });
    void runSupportAutomation(conversation._id, req.ecomUser);

    res.json({
      success: true,
      data: {
        sessionId: conversation.sessionId,
        conversation,
        reusedExisting: conversation.messages.length > 1,
      }
    });
  } catch (err) {
    console.error('[Support] POST /my-tickets error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/ecom/support/my-tickets/:sessionId — Get ticket detail + mark user messages as read
router.get('/my-tickets/:sessionId', requireEcomAuth, async (req, res) => {
  try {
    const workspaceId = req.workspaceId || req.ecomUser?.workspaceId || null;
    const userId = req.ecomUser?._id || req.user?.id;
    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId, workspaceId },
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
    const workspaceId = req.workspaceId || req.ecomUser?.workspaceId || null;
    const userId = req.ecomUser?._id || req.user?.id;

    const conv = await SupportConversation.findOneAndUpdate(
      { sessionId: req.params.sessionId, userId, workspaceId },
      {
        $push: { messages: { from: 'visitor', senderType: 'user', text: safeText } },
        $inc: { unreadAdmin: 1 },
        $set: {
          lastMessageAt: new Date(),
          status: 'open',
          workflowStatus: 'pending_admin',
          handledBy: 'none',
        },
      },
      { new: true }
    );

    if (!conv) return res.status(404).json({ success: false, message: 'Ticket introuvable' });
    emitSupportConversationUpdate(conv, { eventType: 'user_message', initiator: 'user' });
    void runSupportAutomation(conv._id, req.ecomUser);
    res.json({ success: true, data: { conversation: conv } });
  } catch (err) {
    console.error('[Support] POST /my-tickets/:id/reply error:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

export default router;
