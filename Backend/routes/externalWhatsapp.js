import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import WhatsAppInstance from '../models/WhatsAppInstance.js';
import EcomUser from '../models/EcomUser.js';
import RitaConfig from '../models/RitaConfig.js';
import WhatsAppOrder from '../models/WhatsAppOrder.js';
import Order from '../models/Order.js';
import RitaContact from '../models/RitaContact.js';
import Agent from '../models/Agent.js';
import { normalizePhone } from '../utils/phoneUtils.js';
import evolutionApiService from '../services/evolutionApiService.js';
import { processIncomingMessage, processBossMessage, generateTestReply, transcribeAudio, textToSpeech, textToSpeechFishAudio, getLastAssistantMessage, getTtsVoiceSettings } from '../services/ritaAgentService.js';
import { logRitaActivity } from '../services/ritaBossReportService.js';
import { analyzeImage as analyzeProductImage } from '../services/agentImageService.js';
import { processFlows } from '../services/ritaFlowEngine.js';
import { uploadImage as uploadImageToR2, isConfigured as isR2Configured } from '../services/cloudflareImagesService.js';
import { requireEcomAuth, requireRitaAgentAccess } from '../middleware/ecomAuth.js';
import Workspace from '../models/Workspace.js';
import mongoose from 'mongoose';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FISH_AUDIO_DIRECT_API_KEY = process.env.FISH_AUDIO_API_KEY || '203f946aa7b3454184fd28fc7eb1f33b';

// ─── Multer config pour upload d'images/vidéos produit Rita ───────────────
// On utilise memoryStorage pour envoyer directement à R2 (fallback disk si R2 indisponible)
const _uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('Seuls les images et vidéos sont acceptés'));
    }
    cb(null, true);
  },
});
// Fallback disk storage si R2 n'est pas configuré
const _uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
      cb(null, `rita-${safeName}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('Seuls les images et vidéos sont acceptés'));
    }
    cb(null, true);
  },
});
const _upload = isR2Configured() ? _uploadMemory : _uploadDisk;
const _uploadAudioMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error('Seuls les fichiers audio sont acceptés'));
    }
    cb(null, true);
  },
});

const ENV_WEBHOOK_BASE_URL = (
  process.env.WEBHOOK_BASE_URL ||
  process.env.PUBLIC_API_URL ||
  process.env.BACKEND_PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
).replace(/\/$/, '');

function resolveWebhookBaseUrl(req) {
  if (ENV_WEBHOOK_BASE_URL) {
    return ENV_WEBHOOK_BASE_URL;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || 'http';
  const host = req.get('host');
  const isLocalHost = host && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(host);

  if (isLocalHost) {
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return `${proto}://${host}`.replace(/\/$/, '');
}
import { checkMessageLimit, incrementMessageCount, getInstanceUsage } from '../services/messageLimitService.js';

/**
 * Découpe un message long en plusieurs parties pour WhatsApp.
 * Coupe sur les doubles retours à la ligne, puis les retours simples, puis les phrases.
 * @param {string} text - Message complet
 * @param {number} maxLen - Longueur max par partie (défaut 1500)
 * @returns {string[]} - Tableau de parties
 */
function splitWhatsAppMessage(text, maxLen = 1500) {
  if (!text || text.length <= maxLen) return [text];

  const parts = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let cutIndex = -1;

    // 1. Essayer de couper sur un double retour à la ligne
    const doubleNewline = remaining.lastIndexOf('\n\n', maxLen);
    if (doubleNewline > maxLen * 0.3) {
      cutIndex = doubleNewline;
    }

    // 2. Sinon couper sur un retour à la ligne simple
    if (cutIndex === -1) {
      const singleNewline = remaining.lastIndexOf('\n', maxLen);
      if (singleNewline > maxLen * 0.3) {
        cutIndex = singleNewline;
      }
    }

    // 3. Sinon couper sur une fin de phrase (. ! ?)
    if (cutIndex === -1) {
      const sentenceEnd = remaining.substring(0, maxLen).search(/[.!?]\s+[^\s]/);
      if (sentenceEnd > maxLen * 0.3) {
        cutIndex = sentenceEnd + 1;
      }
    }

    // 4. Dernier recours : couper sur un espace
    if (cutIndex === -1) {
      cutIndex = remaining.lastIndexOf(' ', maxLen);
      if (cutIndex <= 0) cutIndex = maxLen;
    }

    parts.push(remaining.substring(0, cutIndex).trim());
    remaining = remaining.substring(cutIndex).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function unwrapMessageContent(message) {
  let content = message;

  while (content) {
    if (content.ephemeralMessage?.message) {
      content = content.ephemeralMessage.message;
      continue;
    }
    if (content.viewOnceMessage?.message) {
      content = content.viewOnceMessage.message;
      continue;
    }
    if (content.viewOnceMessageV2?.message) {
      content = content.viewOnceMessageV2.message;
      continue;
    }
    if (content.viewOnceMessageV2Extension?.message) {
      content = content.viewOnceMessageV2Extension.message;
      continue;
    }
    if (content.documentWithCaptionMessage?.message) {
      content = content.documentWithCaptionMessage.message;
      continue;
    }
    if (content.editedMessage?.message) {
      content = content.editedMessage.message;
      continue;
    }
    break;
  }

  return content || {};
}

function extractInteractiveResponseText(interactiveResponseMessage) {
  if (!interactiveResponseMessage) return '';

  const nativeFlow = interactiveResponseMessage.nativeFlowResponseMessage;
  const directText = firstNonEmptyText(
    interactiveResponseMessage.body?.text,
    interactiveResponseMessage.header?.title,
    interactiveResponseMessage.nativeFlowResponseMessage?.name
  );

  if (directText) return directText;

  const paramsJson = nativeFlow?.paramsJson;
  if (!paramsJson || typeof paramsJson !== 'string') return '';

  try {
    const parsed = JSON.parse(paramsJson);
    return firstNonEmptyText(
      parsed.display_text,
      parsed.title,
      parsed.text,
      parsed.id,
      parsed.selected_display_text,
      parsed.selected_row_id,
      parsed.selected_row_title,
      parsed.flow_token,
      parsed.reply,
      parsed.value
    );
  } catch {
    return paramsJson.trim();
  }
}

function extractIncomingText(message) {
  const content = unwrapMessageContent(message);

  return firstNonEmptyText(
    content?.conversation,
    content?.extendedTextMessage?.text,
    content?.imageMessage?.caption,
    content?.videoMessage?.caption,
    content?.documentMessage?.caption,
    content?.documentWithCaptionMessage?.message?.documentMessage?.caption,
    content?.buttonsResponseMessage?.selectedDisplayText,
    content?.buttonsResponseMessage?.selectedButtonId,
    content?.templateButtonReplyMessage?.selectedDisplayText,
    content?.templateButtonReplyMessage?.selectedId,
    content?.listResponseMessage?.title,
    content?.listResponseMessage?.description,
    content?.listResponseMessage?.singleSelectReply?.selectedRowId,
    content?.listResponseMessage?.singleSelectReply?.title,
    content?.listResponseMessage?.singleSelectReply?.description,
    extractInteractiveResponseText(content?.interactiveResponseMessage)
  );
}

function extractContextInfo(message) {
  const content = unwrapMessageContent(message);

  return (
    content?.extendedTextMessage?.contextInfo ||
    content?.buttonsResponseMessage?.contextInfo ||
    content?.templateButtonReplyMessage?.contextInfo ||
    content?.listResponseMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    null
  );
}

const INSTANCE_PLAN_LIMITS = {
  free: { daily: 100, monthly: 5000 },
  pro: { daily: 1000, monthly: 50000 },
  plus: { daily: 5000, monthly: 200000 },
};

function normalizeInstancePlan(plan) {
  const raw = String(plan || 'free').toLowerCase();
  if (raw === 'premium') return 'pro';
  if (raw === 'unlimited') return 'plus';
  return INSTANCE_PLAN_LIMITS[raw] ? raw : 'free';
}

function resolveInstanceLimits(instance) {
  const normalizedPlan = normalizeInstancePlan(instance.plan);
  const defaults = INSTANCE_PLAN_LIMITS[normalizedPlan] || INSTANCE_PLAN_LIMITS.free;
  const dailyLimit = Number.isFinite(instance.dailyLimit) && instance.dailyLimit > 0 ? instance.dailyLimit : defaults.daily;
  const monthlyLimit = Number.isFinite(instance.monthlyLimit) && instance.monthlyLimit > 0 ? instance.monthlyLimit : defaults.monthly;
  return { normalizedPlan, dailyLimit, monthlyLimit };
}

function extractPhoneFromJid(jid) {
  if (!jid || typeof jid !== 'string') return null;

  // Ex: 2376...@s.whatsapp.net, 2376...:12@s.whatsapp.net, +2376...@lid
  const localPart = jid.split('@')[0] || '';
  const noDeviceSuffix = localPart.split(':')[0] || '';

  const normalized = normalizePhone(noDeviceSuffix);
  if (normalized) return normalized;

  const digitsOnly = noDeviceSuffix.replace(/\D/g, '');
  return digitsOnly.length >= 8 && digitsOnly.length <= 15 ? digitsOnly : null;
}

async function resolveIncomingInstanceDoc(instance, data) {
  const fromPayload = [
    instance,
    data?.instance,
    data?.instanceName,
    data?.instance?.instanceName,
    data?.instance?.name,
  ].filter(Boolean);

  const candidateNames = [];
  for (const item of fromPayload) {
    if (typeof item === 'string' && item.trim()) {
      candidateNames.push(item.trim());
    } else if (typeof item === 'object') {
      if (typeof item.instanceName === 'string' && item.instanceName.trim()) {
        candidateNames.push(item.instanceName.trim());
      }
      if (typeof item.name === 'string' && item.name.trim()) {
        candidateNames.push(item.name.trim());
      }
    }
  }

  if (!candidateNames.length) return null;

  // 1) Match exact sur instanceName/customName
  let instanceDoc = await WhatsAppInstance.findOne({
    isActive: true,
    $or: [
      { instanceName: { $in: candidateNames } },
      { customName: { $in: candidateNames } },
    ],
  }).lean();

  if (instanceDoc) return instanceDoc;

  // 2) Fallback insensible à la casse
  const escaped = candidateNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  instanceDoc = await WhatsAppInstance.findOne({
    isActive: true,
    $or: [
      { instanceName: { $in: escaped.map((name) => new RegExp(`^${name}$`, 'i')) } },
      { customName: { $in: escaped.map((name) => new RegExp(`^${name}$`, 'i')) } },
    ],
  }).lean();

  return instanceDoc;
}

const router = express.Router();

async function resolveRitaTargetUserId(req) {
  if (req.ecomUser?.role === 'super_admin') {
    return req.body?.userId || req.query?.userId || String(req.ecomUser._id);
  }

  // Résoudre via le owner du workspace pour que tous les membres
  // lisent/écrivent la MÊME RitaConfig (celle que le webhook utilise)
  const wsId = req.workspaceId || req.ecomUser?.workspaceId;
  if (wsId) {
    try {
      const ws = await Workspace.findById(wsId).select('owner').lean();
      if (ws?.owner) return String(ws.owner);
    } catch (e) {
      console.warn('⚠️ resolveRitaTargetUserId: workspace owner lookup failed:', e.message);
    }
  }

  return String(req.ecomUser?._id || '');
}

async function sendMessageAndTrack(instanceName, instanceToken, number, message, ...rest) {
  const result = await evolutionApiService.sendMessage(
    instanceName,
    instanceToken,
    number,
    message,
    ...rest
  );

  const isSuccess = result?.success !== false;
  if (isSuccess) {
    try {
      const trackedInstance = await WhatsAppInstance.findOne({ instanceName, instanceToken }).select('_id').lean();
      if (trackedInstance?._id) {
        await incrementMessageCount(trackedInstance._id, 1);
      }
    } catch (quotaErr) {
      console.error('⚠️ [QUOTA] Impossible de compter un message sortant:', quotaErr.message);
    }
  }

  return result;
}

// Normalise une chaîne : minuscules + suppression des accents/diacritiques
function normalizeStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Cherche le meilleur produit correspondant à un nom dans le catalogue
function findProductByName(catalog, query) {
  const q = normalizeStr(query);
  // 1. Exact
  let p = catalog.find(p => normalizeStr(p.name) === q);
  if (p) return p;
  // 2. Contenu (l'un dans l'autre)
  p = catalog.find(p => { const n = normalizeStr(p.name); return n.includes(q) || q.includes(n); });
  if (p) return p;
  // 3. Tous les tokens significatifs du nom demandé sont dans le nom du produit
  const tokens = q.split(/\s+/).filter(t => t.length > 1);
  if (tokens.length > 0) {
    p = catalog.find(p => tokens.every(t => normalizeStr(p.name).includes(t)));
    if (p) return p;
    // 4. Au moins 60% des tokens matchent
    p = catalog.reduce((best, p) => {
      const matched = tokens.filter(t => normalizeStr(p.name).includes(t)).length;
      const score = matched / tokens.length;
      return score > (best?.score || 0) ? { p, score } : best;
    }, null);
    if (p?.score >= 0.6) return p.p;
  }
  return null;
}

function normalizeFilterValue(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function resolveStatusVariants(rawStatus) {
  const normalized = normalizeFilterValue(rawStatus);
  const aliases = {
    pending: ['pending'],
    accepted: ['accepted', 'confirmed'],
    refused: ['refused', 'rejected'],
    delivered: ['delivered'],
    cancelled: ['cancelled', 'canceled'],
    all: [],
  };

  if (aliases[normalized]) return aliases[normalized];
  if (normalized === 'en attente') return aliases.pending;
  if (normalized === 'acceptee' || normalized === 'acceptees' || normalized === 'acceptee(s)') return aliases.accepted;
  if (normalized === 'refusee' || normalized === 'refusees' || normalized === 'refusee(s)') return aliases.refused;
  if (normalized === 'livree' || normalized === 'livrees' || normalized === 'livree(s)') return aliases.delivered;
  if (normalized === 'annulee' || normalized === 'annulees' || normalized === 'annulee(s)') return aliases.cancelled;
  return [normalized];
}

// ─── Escalades boss en attente: userId → [{ clientPhone, question, askedAt, instanceName, instanceToken }]
// Queue FIFO : chaque réponse du boss est transmise au prochain client en attente.
const pendingBossEscalations = new Map();

function addPendingEscalation(userId, entry) {
  if (!pendingBossEscalations.has(userId)) pendingBossEscalations.set(userId, []);
  // Éviter les doublons pour le même client
  const queue = pendingBossEscalations.get(userId).filter(e => e.clientPhone !== entry.clientPhone);
  queue.push(entry);
  pendingBossEscalations.set(userId, queue);
}

function shiftPendingEscalation(userId) {
  const queue = pendingBossEscalations.get(userId) || [];
  if (!queue.length) return null;
  const next = queue.shift();
  pendingBossEscalations.set(userId, queue);
  return next;
}

function hasPendingEscalation(userId, clientPhone) {
  const queue = pendingBossEscalations.get(userId) || [];
  return queue.some(e => e.clientPhone === clientPhone);
}

/**
 * @route   GET /api/ecom/v1/external/whatsapp/
 * @desc    Test route to verify router is loaded
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'WhatsApp External Router is loaded',
    availableRoutes: [
      'GET /instances?userId=xxx',
      'POST /link',
      'POST /verify-instance',
      'POST /send',
      'DELETE /instances/:id?userId=xxx'
    ]
  });
});

/**
 * @route   POST /api/v1/external/whatsapp/link
 * @desc    Enregistrer une instance WhatsApp pour un utilisateur
 * @access  Public (Public selon spécification, sécurisé par userId/instanceToken)
 */
router.post('/link', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const workspaceId = req.workspaceId;
    const { instanceName, instanceToken, customName, defaultPart } = req.body;

    if (!instanceName || !instanceToken) {
      return res.status(400).json({
        success: false,
        error: "instanceName et instanceToken sont requis"
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Vérifier l'instance auprès d'Evolution API EXTERNE
    // L'instance ne sera PAS créée si la vérification échoue
    // ═══════════════════════════════════════════════════════════════
    console.log(`🔍 [LINK] Vérification Evolution API pour : ${instanceName}`);
    console.log(`🔍 [LINK] URL Evolution API : ${evolutionApiService.baseUrl}`);

    const apiStatus = await evolutionApiService.getInstanceStatus(instanceName, instanceToken);

    console.log(`🔍 [LINK] Réponse Evolution API :`, JSON.stringify(apiStatus));

    // Si aucune réponse ou instance introuvable → REFUSER la création
    if (!apiStatus || !apiStatus.instance) {
      console.warn(`❌ [LINK] REFUSÉ : Instance "${instanceName}" introuvable sur Evolution API`);
      return res.status(400).json({
        success: false,
        error: `Instance "${instanceName}" introuvable sur Evolution API. Vérifiez le nom de l'instance et le token, puis réessayez.`,
        verified: false
      });
    }

    const state = apiStatus.instance.state;
    let status;

    if (state === 'open') {
      status = 'connected';
      console.log(`✅ [LINK] Instance "${instanceName}" connectée à WhatsApp (state: open)`);
    } else if (state === 'close') {
      status = 'disconnected';
      console.log(`⚠️ [LINK] Instance "${instanceName}" trouvée mais déconnectée (state: close)`);
    } else if (state === 'connecting') {
      status = 'disconnected';
      console.log(`⚠️ [LINK] Instance "${instanceName}" en cours de connexion (state: connecting)`);
    } else {
      console.warn(`❌ [LINK] REFUSÉ : Instance "${instanceName}" état inconnu : ${state}`);
      return res.status(400).json({
        success: false,
        error: `Instance "${instanceName}" retourne un état inconnu ("${state}"). Vérifiez la configuration sur Evolution API.`,
        verified: false
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 2 : Instance confirmée par Evolution → l'enregistrer en DB
    // ═══════════════════════════════════════════════════════════════

    const instance = await WhatsAppInstance.findOneAndUpdate(
      { instanceName },
      { 
        userId, 
        workspaceId,
        instanceToken, 
        customName: customName || instanceName,
        lastSeen: new Date(),
        isActive: true,
        status,
        ...(defaultPart !== undefined && { defaultPart })
      },
      { new: true, upsert: true }
    );

    const verificationMessage = status === 'connected'
      ? 'Instance vérifiée et connectée à WhatsApp ✅'
      : 'Instance trouvée sur Evolution API mais non connectée à WhatsApp. Scannez le QR code dans Evolution.';

    console.log(`✅ [LINK] Instance SAUVEGARDÉE dans MongoDB:`);
    console.log(`   - ID: ${instance._id}`);
    console.log(`   - Nom: ${instance.instanceName}`);
    console.log(`   - userId: ${instance.userId}`);
    console.log(`   - workspaceId: ${instance.workspaceId || 'N/A'}`);
    console.log(`   - Status: ${instance.status}`);
    console.log(`   - isActive: ${instance.isActive}`);
    console.log(`   - defaultPart: ${instance.defaultPart}%`);

    res.status(200).json({
      success: true,
      message: "Instance WhatsApp enregistrée",
      verified: true,
      verificationMessage,
      data: {
        id: instance._id,
        instanceName: instance.instanceName,
        customName: instance.customName,
        status
      }
    });
  } catch (error) {
    console.error('❌ [LINK] Erreur lors du link WhatsApp:', error.message);
    
    // Messages d'erreur clairs selon le type d'erreur
    let errorMessage = "Erreur lors de la liaison de l'instance";
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      errorMessage = "Impossible de contacter le serveur Evolution API. Vérifiez votre connexion internet.";
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      errorMessage = "Le serveur Evolution API ne répond pas (timeout). Réessayez dans quelques instants.";
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = "Token d'accès invalide ou expiré. Vérifiez votre token ZenChat.";
    } else if (error.response?.status === 404) {
      errorMessage = "Instance non trouvée sur Evolution API. Vérifiez le nom de l'instance.";
    } else if (error.message?.includes('instance') && error.message?.includes('not found')) {
      errorMessage = "Instance non disponible. Cette instance n'existe pas sur Evolution API.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/verify-instance
 * @desc    Tester la connexion réelle d'une instance via Evolution API externe
 * @access  Public
 */
router.post('/verify-instance', async (req, res) => {
  try {
    const { instanceId } = req.body;

    if (!instanceId) {
      return res.status(400).json({ success: false, error: "instanceId est requis" });
    }

    const instance = await WhatsAppInstance.findById(instanceId);
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable en base de données" });
    }

    console.log(`🔍 [VERIFY] Test Evolution API pour : ${instance.instanceName}`);
    console.log(`🔍 [VERIFY] URL : ${evolutionApiService.baseUrl}/instance/connectionState/${instance.instanceName}`);

    const apiStatus = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);

    console.log(`🔍 [VERIFY] Réponse :`, JSON.stringify(apiStatus));

    if (!apiStatus || !apiStatus.instance) {
      await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: 'disconnected', lastSeen: new Date() });
      return res.status(200).json({
        success: false,
        error: `Impossible de joindre l'instance "${instance.instanceName}" sur Evolution API. Elle n'existe peut-être plus.`,
        status: 'disconnected'
      });
    }

    const state = apiStatus.instance.state;
    let newStatus = 'disconnected';
    let message = '';

    if (state === 'open') {
      newStatus = 'connected';
      message = `Instance "${instance.customName || instance.instanceName}" connectée à WhatsApp ✅`;
    } else if (state === 'close') {
      newStatus = 'disconnected';
      message = `Instance trouvée mais déconnectée de WhatsApp. Scannez le QR code dans Evolution.`;
    } else if (state === 'connecting') {
      newStatus = 'disconnected';
      message = `Instance en cours de connexion à WhatsApp. Patientez ou scannez le QR code.`;
    } else {
      message = `État inconnu : "${state}"`;
    }

    await WhatsAppInstance.findByIdAndUpdate(instanceId, { status: newStatus, lastSeen: new Date() });

    res.status(200).json({
      success: newStatus === 'connected',
      message,
      status: newStatus,
      evolutionState: state
    });
  } catch (error) {
    console.error('❌ [VERIFY] Erreur:', error.message);
    
    // Messages d'erreur clairs
    let errorMessage = "Erreur lors de la vérification";
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      errorMessage = "Serveur Evolution API injoignable. Vérifiez votre connexion.";
    } else if (error.message?.includes('timeout')) {
      errorMessage = "Timeout - Le serveur met trop de temps à répondre.";
    } else if (error.message?.includes('token') || error.message?.includes('auth')) {
      errorMessage = "Token d'accès erroné. Vérifiez votre configuration.";
    } else if (error.message?.includes('instance')) {
      errorMessage = "Instance non disponible actuellement.";
    }
    
    res.status(500).json({ success: false, error: errorMessage, details: error.message });
  }
});

/**
 * @route   DELETE /api/ecom/v1/  external/whatsapp/instances/:id
 * @desc    Supprimer une instance WhatsApp
 * @access  Public (Sécurisé par userId)
 */
router.delete('/instances/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId est requis" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable ou non autorisée" });
    }

    await WhatsAppInstance.findByIdAndDelete(id);

    console.log(`🗑️ Instance WhatsApp supprimée : ${instance.instanceName} (user: ${userId})`);

    res.status(200).json({
      success: true,
      message: `Instance "${instance.customName || instance.instanceName}" supprimée avec succès`
    });
  } catch (error) {
    console.error('❌ Erreur suppression instance:', error.message);
    
    let errorMessage = "Erreur lors de la suppression";
    if (error.message?.includes('CastError') || error.message?.includes('ObjectId')) {
      errorMessage = "ID d'instance invalide.";
    } else if (error.message?.includes('not found')) {
      errorMessage = "Instance introuvable. Elle a peut-être déjà été supprimée.";
    }
    
    res.status(500).json({ success: false, error: errorMessage, details: error.message });
  }
});

/**
 * @route   POST /api/v1/external/whatsapp/send
 * @desc    Envoyer un message WhatsApp via ZenChat API
 * @access  Public (Sécurisé par le instanceToken passé dans le body)
 */
router.post('/send', async (req, res) => {
  try {
    const { instanceName, instanceToken, number, message } = req.body;

    if (!instanceName || !instanceToken || !number || !message) {
      return res.status(400).json({
        success: false,
        error: "instanceName, instanceToken, number et message sont requis"
      });
    }

    // Récupérer l'instance pour vérifier les limites
    const instance = await WhatsAppInstance.findOne({ instanceName, instanceToken });
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: "Instance introuvable. Vérifiez le nom et le token."
      });
    }

    // Vérifier les limites de messages
    const limitCheck = await checkMessageLimit(instance);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: limitCheck.reason,
        usage: limitCheck.usage,
        upgradeUrl: 'https://zechat.site/pricing'
      });
    }

    // Envoyer le message via ZenChat API
    const result = await sendMessageAndTrack(
      instanceName,
      instanceToken,
      number,
      message
    );

    if (result.success) {
      // Mettre à jour le statut de l'instance
      await WhatsAppInstance.findByIdAndUpdate(
        instance._id,
        { lastSeen: new Date(), status: 'connected' }
      );

      return res.status(200).json({
        success: true,
        message: "Message envoyé avec succès",
        data: result.data,
        usage: limitCheck.usage
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Échec de l'envoi du message via Evolution API",
        details: result.error
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi WhatsApp:', error.message);
    
    // Messages d'erreur clairs
    let errorMessage = "Erreur lors de l'envoi du message";
    
    if (error.message?.includes('token') || error.message?.includes('auth') || error.message?.includes('401')) {
      errorMessage = "Token d'accès erroné ou expiré. Vérifiez votre token.";
    } else if (error.message?.includes('instance') || error.message?.includes('404')) {
      errorMessage = "Instance non disponible. Vérifiez que l'instance existe et est connectée.";
    } else if (error.message?.includes('number') || error.message?.includes('phone')) {
      errorMessage = "Numéro de téléphone invalide. Vérifiez le format.";
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorMessage = "Serveur WhatsApp injoignable. Vérifiez votre connexion.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

/**
 * @route   GET /api/v1/external/whatsapp/instances
 * @desc    Lister les instances WhatsApp d'un utilisateur
 * @access  Public (Sécurisé par userId)
 */
router.get('/instances', requireEcomAuth, async (req, res) => {
  try {
    const requester = req.ecomUser;
    const requestedUserId = req.query.userId ? String(req.query.userId) : String(requester._id);
    const isSuperAdmin = requester.role === 'super_admin';

    // Non super-admin users must stay in their own workspace scope.
    const effectiveUserId = isSuperAdmin ? requestedUserId : String(requester._id);

    let query = { userId: effectiveUserId, isActive: true };

    if (!isSuperAdmin && requester.workspaceId) {
      const workspaceMembers = await EcomUser.find({ workspaceId: requester.workspaceId }).select('_id').lean();
      const workspaceUserIds = workspaceMembers.map((u) => String(u._id));
      query = {
        isActive: true,
        $or: [
          { workspaceId: requester.workspaceId },
          { userId: { $in: workspaceUserIds } },
        ],
      };
    }

    const instances = await WhatsAppInstance.find(query);

    console.log(`📋 [INSTANCES] Trouvé ${instances.length} instance(s) pour scope: ${isSuperAdmin ? `userId=${effectiveUserId}` : `workspaceId=${requester.workspaceId || 'N/A'}`}`);
    instances.forEach(inst => {
      console.log(`   - ${inst.instanceName} | status: ${inst.status} | workspaceId: ${inst.workspaceId || 'N/A'}`);
    });

    res.status(200).json({
      success: true,
      instances
    });
  } catch (error) {
    console.error('❌ Erreur lors du listage WhatsApp:', error.message);
    
    let errorMessage = "Erreur lors de la récupération des instances";
    if (error.message?.includes('Mongo') || error.message?.includes('connection')) {
      errorMessage = "Erreur de base de données. Réessayez dans quelques instants.";
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

/**
 * @route   GET /api/v1/external/whatsapp/instances/all
 * @desc    DIAGNOSTIC - Lister TOUTES les instances dans la DB
 * @access  Public
 */
router.get('/instances/all', async (req, res) => {
  try {
    const allInstances = await WhatsAppInstance.find({});
    
    console.log(`🔍 [DIAGNOSTIC] Total instances dans DB: ${allInstances.length}`);
    allInstances.forEach(inst => {
      console.log(`   - ${inst.instanceName} | userId: ${inst.userId} | workspaceId: ${inst.workspaceId || 'N/A'} | status: ${inst.status} | isActive: ${inst.isActive}`);
    });

    res.status(200).json({
      success: true,
      total: allInstances.length,
      instances: allInstances
    });
  } catch (error) {
    console.error('❌ Erreur diagnostic:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/refresh-status
 * @desc    Rafraîchir le statut des instances via Evolution API
 * @access  Public (Sécurisé par userId)
 */
router.post('/refresh-status', requireEcomAuth, async (req, res) => {
  try {
    const requester = req.ecomUser;
    const requestedUserId = req.body?.userId ? String(req.body.userId) : String(requester._id);
    const isSuperAdmin = requester.role === 'super_admin';
    const effectiveUserId = isSuperAdmin ? requestedUserId : String(requester._id);

    let query = { userId: effectiveUserId, isActive: true };

    if (!isSuperAdmin && requester.workspaceId) {
      const workspaceMembers = await EcomUser.find({ workspaceId: requester.workspaceId }).select('_id').lean();
      const workspaceUserIds = workspaceMembers.map((u) => String(u._id));
      query = {
        isActive: true,
        $or: [
          { workspaceId: requester.workspaceId },
          { userId: { $in: workspaceUserIds } },
        ],
      };
    }

    const instances = await WhatsAppInstance.find(query);

    const updated = await Promise.all(instances.map(async (inst) => {
      try {
        const apiStatus = await evolutionApiService.getInstanceStatus(
          inst.instanceName,
          inst.instanceToken
        );

        let newStatus = inst.status;
        if (apiStatus?.instance?.state === 'open') {
          newStatus = 'connected';
        } else if (apiStatus?.instance?.state === 'close' || apiStatus?.instance?.state === 'connecting') {
          newStatus = 'disconnected';
        }

        if (newStatus !== inst.status) {
          await WhatsAppInstance.findByIdAndUpdate(inst._id, { status: newStatus, lastSeen: new Date() });
        }

        return { ...inst.toObject(), status: newStatus };
      } catch {
        return inst.toObject();
      }
    }));

    res.status(200).json({
      success: true,
      instances: updated
    });
  } catch (error) {
    console.error('❌ Erreur refresh-status WhatsApp:', error.message);
    res.status(500).json({
      success: false,
      error: "Erreur lors de la mise à jour des statuts"
    });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/instances/:id/webhook
 * @desc    Configurer le webhook Evolution API d'une instance
 * @access  Private
 */
router.post('/instances/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, enabled, url, webhookByEvents, webhookBase64, events } = req.body;

    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });
    if (enabled && !url) return res.status(400).json({ success: false, error: 'URL requise pour activer le webhook' });
    if (enabled && (!events || events.length === 0)) return res.status(400).json({ success: false, error: 'Au moins un événement est requis' });

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable ou non autorisée' });

    const result = await evolutionApiService.setWebhook(instance.instanceName, instance.instanceToken, {
      enabled: !!enabled,
      url: url || '',
      webhookByEvents: !!webhookByEvents,
      webhookBase64: !!webhookBase64,
      events: events || []
    });

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Erreur configuration webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/webhook
 * @desc    Récupérer la config webhook actuelle d'une instance
 * @access  Private
 */
router.get('/instances/:id/webhook', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable ou non autorisée' });

    const result = await evolutionApiService.getWebhook(instance.instanceName, instance.instanceToken);
    if (!result.success) {
      return res.status(200).json({ success: false, data: null, error: result.error });
    }

    res.status(200).json({ success: true, data: result.data });
  } catch (error) {
    console.error('❌ Erreur récupération webhook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/activate
 * @desc    Active ou désactive le webhook Evolution API sur l'instance sélectionnée (ou toutes si pas d'instanceId).
 *          Appelé automatiquement quand Rita IA est activé/désactivé.
 */
router.post('/activate', async (req, res) => {
  try {
    const { userId, agentId, enabled, instanceId } = req.body;

    // Utiliser agentId s'il est fourni, sinon userId
    const targetId = agentId || userId;
    if (!targetId) return res.status(400).json({ success: false, error: 'userId ou agentId requis' });

    console.log(`\n🔧 ═══════════════════════════════════════════════════`);
    console.log(`🔧 [ACTIVATE] ${agentId ? 'agentId' : 'userId'}=${targetId} enabled=${enabled} instanceId=${instanceId || 'ALL'}`);

    // Si agentId est fourni, chercher l'agent pour récupérer son userId
    let actualUserId = userId;
    if (agentId) {
      const agent = await Agent.findById(agentId).select('userId').lean();
      if (agent?.userId) {
        actualUserId = agent.userId;
        console.log(`🔧 [ACTIVATE] Agent trouvé, userId résolu: ${actualUserId}`);
      } else {
        console.log(`⚠️ [ACTIVATE] Agent introuvable ou sans userId associé`);
        return res.status(400).json({ success: false, error: 'Agent introuvable' });
      }
    }

    // Chercher l'instance spécifique OU toutes les instances actives
    let instances;
    if (instanceId) {
      const inst = await WhatsAppInstance.findOne({ _id: instanceId, userId: actualUserId, isActive: true });
      instances = inst ? [inst] : [];
      console.log(`🔧 [ACTIVATE] Instance ciblée: ${inst ? inst.instanceName : 'INTROUVABLE (id=' + instanceId + ')'}`);
    } else {
      instances = await WhatsAppInstance.find({ userId: actualUserId, isActive: true });
      console.log(`🔧 [ACTIVATE] Toutes les instances: ${instances.map(i => i.instanceName).join(', ') || 'aucune'}`);
    }

    if (!instances.length) {
      console.log(`⚠️ [ACTIVATE] Aucune instance trouvée`);
      console.log(`🔧 ═══════════════════════════════════════════════════\n`);
      return res.status(200).json({ success: true, message: 'Aucune instance à configurer', configured: 0, results: [] });
    }

    const webhookBaseUrl = resolveWebhookBaseUrl(req);
    const webhookUrl = `${webhookBaseUrl}/api/ecom/v1/external/whatsapp/incoming`;
    const events = ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'];
    const isLocalWebhook = /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(webhookUrl);
    console.log(`🔧 [ACTIVATE] Webhook URL: ${webhookUrl}`);
    if (isLocalWebhook) {
      console.log('⚠️ [ACTIVATE] Webhook local détecté. Evolution API doit pouvoir joindre cette machine (même réseau, tunnel ngrok/cloudflared, ou Evolution local).');
    }
    console.log(`🔧 [ACTIVATE] Events: ${events.join(', ')}`);

    const results = await Promise.all(instances.map(async (inst) => {
      try {
        console.log(`📡 [ACTIVATE] Configuration webhook sur "${inst.instanceName}" (token: ${inst.instanceToken?.substring(0, 8)}...)`);
        const result = await evolutionApiService.setWebhook(
          inst.instanceName,
          inst.instanceToken,
          { enabled: !!enabled, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events }
        );
        console.log(`${result.success ? '✅' : '❌'} [ACTIVATE] Webhook ${enabled ? 'activé' : 'désactivé'} sur ${inst.instanceName}`, result.success ? '' : result.error);
        return { instanceName: inst.customName || inst.instanceName, instanceId: inst._id, success: result.success, error: result.error || null };
      } catch (err) {
        console.error(`❌ [ACTIVATE] Erreur pour ${inst.instanceName}:`, err.message);
        return { instanceName: inst.customName || inst.instanceName, instanceId: inst._id, success: false, error: err.message };
      }
    }));

    const configured = results.filter(r => r.success).length;
    console.log(`📡 [ACTIVATE] Résultat: ${configured}/${instances.length} instances configurées (enabled=${enabled})`);

    // Envoyer un message WhatsApp de confirmation au propriétaire si activation réussie
    if (enabled && configured > 0) {
      try {
        const owner = await EcomUser.findById(actualUserId).lean();
        const ownerPhone = owner?.phone?.replace(/\D/g, '');
        console.log(`📲 [ACTIVATE] Propriétaire: ${owner?.email || 'inconnu'}, téléphone: ${ownerPhone || 'NON RENSEIGNÉ'}`);
        if (ownerPhone) {
          const targetInst = instances[0];
          // Chercher la RitaConfig par agentId ou userId
          const ritaConfig = agentId
            ? await RitaConfig.findOne({ agentId }).lean()
            : await RitaConfig.findOne({ userId: actualUserId }).lean();
          const agentName = ritaConfig?.agentName || 'Rita';
          const confirmMsg = `✅ *${agentName} IA est maintenant active !*\n\n` +
            `Instance: ${targetInst.customName || targetInst.instanceName}\n` +
            `Envoyez un message ici pour tester la réponse automatique en temps réel.\n\n` +
            `— ${agentName} 🤖`;
          const sendResult = await sendMessageAndTrack(targetInst.instanceName, targetInst.instanceToken, ownerPhone, confirmMsg);
          console.log(`📲 [ACTIVATE] Message de confirmation envoyé à ${ownerPhone} via ${targetInst.instanceName}:`, sendResult.success ? '✅ OK' : `❌ ${sendResult.error}`);
        } else {
          console.log(`⚠️ [ACTIVATE] Pas de numéro de téléphone pour le propriétaire — message de confirmation non envoyé`);
        }
      } catch (confirmErr) {
        console.warn('⚠️ [ACTIVATE] Impossible d\'envoyer le message de confirmation:', confirmErr.message);
      }
    }

    console.log(`🔧 ═══════════════════════════════════════════════════\n`);
    res.status(200).json({ success: true, configured, total: instances.length, results, webhookUrl, webhookBaseUrl });
  } catch (error) {
    console.error('❌ Erreur activation webhooks:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/upload-image
 * @desc    Upload une image produit Rita → retourne l'URL publique
 */
router.post('/upload-image', requireEcomAuth, _upload.any(), async (req, res) => {
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ success: false, error: 'Aucun fichier reçu' });

  try {
    // Si R2 est configuré et qu'on a un buffer (memoryStorage) → upload R2
    if (isR2Configured() && file.buffer) {
      const result = await uploadImageToR2(file.buffer, file.originalname, {
        workspaceId: req.user?.workspaceId || 'rita',
        uploadedBy: req.user?._id || 'rita',
        mimeType: file.mimetype,
      });
      console.log(`✅ [RITA] Image uploadée vers R2: ${result.url}`);
      return res.json({ success: true, url: result.url });
    }

    // Fallback: fichier local (diskStorage)
    const baseUrl = HARD_CODED_WEBHOOK_BASE_URL;
    const url = `${baseUrl}/uploads/${file.filename}`;
    console.log(`📁 [RITA] Image uploadée localement: ${url}`);
    res.json({ success: true, url });
  } catch (err) {
    console.error(`❌ [RITA] Erreur upload image:`, err.message);
    // Si R2 échoue et qu'on a un buffer, sauver sur disque en fallback
    if (file.buffer) {
      try {
        const ext = path.extname(file.originalname) || '.jpg';
        const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
        const filename = `rita-${safeName}-${Date.now()}${ext}`;
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
        const url = `${HARD_CODED_WEBHOOK_BASE_URL}/uploads/${filename}`;
        console.log(`📁 [RITA] Fallback disque après erreur R2: ${url}`);
        return res.json({ success: true, url });
      } catch (diskErr) {
        console.error(`❌ [RITA] Fallback disque échoué:`, diskErr.message);
      }
    }
    res.status(500).json({ success: false, error: 'Échec upload image' });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/fish-voice
 * @desc    Crée une voix Fish.audio à partir d'un ou plusieurs échantillons audio et l'enregistre dans Rita
 */
router.post('/fish-voice', requireEcomAuth, _uploadAudioMemory.any(), async (req, res) => {
  try {
    const files = req.files || [];
    const { userId, title, description = '', visibility = 'private' } = req.body;
    let texts = req.body.texts || [];

    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });
    if (!title?.trim()) return res.status(400).json({ success: false, error: 'Nom de voix requis' });
    if (!files.length) return res.status(400).json({ success: false, error: 'Au moins un fichier audio est requis' });

    if (!Array.isArray(texts)) texts = texts ? [texts] : [];

    const form = new FormData();
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('visibility', visibility);
    form.append('type', 'tts');
    form.append('train_mode', 'fast');
    form.append('enhance_audio_quality', 'true');

    files.forEach((file) => {
      const blob = new Blob([file.buffer], { type: file.mimetype || 'audio/mpeg' });
      form.append('voices', blob, file.originalname || `sample-${Date.now()}.mp3`);
    });

    texts.filter(Boolean).forEach((text) => {
      form.append('texts', String(text));
    });

    const fishResponse = await fetch('https://api.fish.audio/model', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FISH_AUDIO_DIRECT_API_KEY}`,
      },
      body: form,
    });

    const fishResult = await fishResponse.json();
    if (!fishResponse.ok) {
      return res.status(fishResponse.status).json({
        success: false,
        error: fishResult?.message || fishResult?.error || 'Création de voix Fish.audio échouée',
        details: fishResult,
      });
    }

    const voiceId = fishResult.id || fishResult._id;
    if (!voiceId) {
      return res.status(500).json({ success: false, error: 'Fish.audio n\'a pas retourné d\'identifiant de voix' });
    }

    const voiceEntry = {
      id: voiceId,
      name: fishResult.title || title.trim(),
      description: fishResult.description || description.trim(),
      state: fishResult.state || 'ready',
      visibility: fishResult.visibility || visibility,
      createdAt: fishResult.created_at || new Date(),
      sampleCount: files.length,
      source: 'fish.audio',
    };

    const existingConfig = await RitaConfig.findOne({ userId }).lean();
    const existingVoices = Array.isArray(existingConfig?.fishAudioVoices) ? existingConfig.fishAudioVoices : [];
    const dedupedVoices = [
      voiceEntry,
      ...existingVoices.filter((voice) => voice?.id !== voiceId),
    ];

    const updated = await RitaConfig.findOneAndUpdate(
      { userId },
      {
        userId,
        fishAudioVoices: dedupedVoices,
        fishAudioReferenceId: voiceId,
        ttsProvider: 'fishaudio',
      },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(200).json({ success: true, voice: voiceEntry, config: updated, fish: fishResult });
  } catch (error) {
    console.error('❌ Erreur création fish-voice:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message || 'Erreur création Fish.audio' });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/incoming
 * @desc    Endpoint de diagnostic pour vérifier que l'URL webhook est bien exposée.
 */
router.get('/incoming', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook WhatsApp Rita disponible',
    method: 'Utiliser POST pour les événements Evolution API',
    webhookUrl: 'https://api.scalor.net/api/ecom/v1/external/whatsapp/incoming'
  });
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/incoming
 * @desc    Reçoit les événements entrants d'Evolution API (MESSAGES_UPSERT, CONNECTION_UPDATE, etc.)
 *          Ce endpoint est configuré automatiquement comme webhook URL sur toutes les instances.
 */
router.post('/incoming', async (req, res) => {
  // Répondre immédiatement (Evolution API n'attend pas plus de 5 secondes)
  res.status(200).json({ success: true, received: true });

  const { event, instance, data } = req.body;
  if (!event) return;
  const normalizedEvent = String(event).toUpperCase().replace(/\./g, '_');

  console.log(`\n📩 ═══════════════════════════════════════════════════`);
  console.log(`📩 [WH INCOMING] event=${event} instance=${instance}`);
  console.log(`📩 [WH INCOMING] normalizedEvent=${normalizedEvent}`);
  console.log(`📩 [WH INCOMING] data keys: ${Object.keys(data || {}).join(', ')}`);

  // Traitement asynchrone
  setImmediate(async () => {
    try {
      if (normalizedEvent === 'MESSAGES_UPSERT') {
        const messages = Array.isArray(data?.messages)
          ? data.messages
          : (data?.key && data?.message ? [data] : []);
        console.log(`📩 [WH INCOMING] ${messages.length} message(s) reçu(s)`);

        // Trouver l'instance WhatsApp correspondante pour récupérer le userId
        const instanceDoc = await resolveIncomingInstanceDoc(instance, data);

        if (instanceDoc) {
          console.log(`📩 [WH INCOMING] Instance trouvée: ${instanceDoc.instanceName} (userId=${instanceDoc.userId})`);
        }

        for (const msg of messages) {
          const fromMe = msg.key?.fromMe;
          const from = msg.key?.remoteJid || msg.key?.participant || msg.participant || '';
          const messageContent = unwrapMessageContent(msg.message);

          // ─── Détecter message vocal / audio ───
          const isAudio = !!(messageContent?.audioMessage || messageContent?.pttMessage);
          let text = extractIncomingText(messageContent);
          const pushName = msg.pushName || data?.pushName || '';

          // ─── Détecter message cité (reply/quote) et injecter le contexte ───
          const contextInfo = extractContextInfo(messageContent);
          if (contextInfo?.quotedMessage) {
            const quotedText = extractIncomingText(contextInfo.quotedMessage);
            if (quotedText) {
              const quotedFrom = contextInfo.participant || '';
              const isQuotedFromBot = msg.key?.fromMe === false && (contextInfo.quotedMessage?.key?.fromMe || !quotedFrom || quotedFrom === from);
              const quotedLabel = isQuotedFromBot ? 'ton propre message précédent' : 'un message précédent';
              text = `[Le client répond à ${quotedLabel} : "${quotedText.substring(0, 800)}"] ${text}`;
              console.log(`💬 [RITA] Message cité détecté: "${quotedText.substring(0, 100)}"`);
            }
          }

          console.log(`📩 [WH INCOMING] Message — from=${from} fromMe=${fromMe} isAudio=${isAudio} text="${(text || '').substring(0, 80)}"`);
          if (pushName) {
            console.log(`📩 [WH INCOMING] pushName=${pushName}`);
          }

          if (fromMe) {
            console.log(`⏩ [RITA] Message envoyé par le bot (fromMe=true), ignoré.`);
            continue;
          }
          // Ignorer les messages venant de groupes WhatsApp (JID se termine par @g.us)
          if (from && from.endsWith('@g.us')) {
            console.log(`⏩ [RITA] Message de groupe ignoré (${from}).`);
            continue;
          }
          if (!from) {
            console.log(`⏩ [RITA] Message sans expéditeur, ignoré.`);
            continue;
          }

          const senderPhone = extractPhoneFromJid(from);
          if (!senderPhone) {
            console.log(`⏩ [RITA] Numéro expéditeur non exploitable (${from}), message ignoré.`);
            continue;
          }
          const senderJid = `${senderPhone}@s.whatsapp.net`;

          // ─── Résoudre le userId via le workspace owner ───
          // La RitaConfig est toujours sauvegardée avec userId = workspace.owner
          // (cohérence avec resolveRitaTargetUserId dans l'API)
          let userId = instanceDoc ? instanceDoc.userId : null;
          if (instanceDoc?.workspaceId) {
            try {
              const ws = await Workspace.findById(instanceDoc.workspaceId).select('owner').lean();
              if (ws?.owner) userId = String(ws.owner);
            } catch (e) {
              console.warn('⚠️ [RITA] Impossible de résoudre le workspace owner, fallback sur instanceDoc.userId:', e.message);
            }
          }
          console.log(`💬 [RITA] userId résolu: ${userId} (instance.userId=${instanceDoc?.userId}, workspaceId=${instanceDoc?.workspaceId})`);

          // ─── Résoudre l'agentId via l'instanceId stocké dans RitaConfig ───
          let agentId = null;
          if (instanceDoc?._id) {
            const instCfg = await RitaConfig.findOne({ instanceId: String(instanceDoc._id) }).select('agentId').lean();
            agentId = instCfg?.agentId || null;
            if (agentId) console.log(`🤖 [RITA] agentId résolu: ${agentId}`);
          }

          // ─── Enregistrer le contact dès qu'il écrit (avant tout traitement) ───
          if (instanceDoc && userId) {
            (async () => {
              try {
                const earlyPhone = senderPhone;
                // Exclure le numéro du boss
                const earlyCfg = await RitaConfig.findOne(agentId ? { agentId } : { userId }).select('bossPhone').lean();
                const bossPhoneClean = (earlyCfg?.bossPhone || '').replace(/\D/g, '');
                if (bossPhoneClean && earlyPhone.replace(/\D/g, '') === bossPhoneClean) return;

                // Vérifier si le contact existe déjà
                const existing = await RitaContact.findOne({ userId, phone: earlyPhone }).select('_id pushName clientNumber').lean();

                if (existing) {
                  // Mise à jour atomique
                  const upd = { $set: { lastMessageAt: new Date() }, $inc: { messageCount: 1 } };
                  if (pushName && !existing.pushName) {
                    upd.$set.pushName = pushName;
                  }
                  await RitaContact.updateOne({ userId, phone: earlyPhone }, upd);
                } else {
                  // Nouveau contact — numéro auto-incrémenté de façon atomique
                  const lc = await RitaContact.findOne({ userId }).sort({ clientNumber: -1 }).select('clientNumber').lean();
                  const nn = (lc?.clientNumber || 0) + 1;
                  await RitaContact.create({
                    userId,
                    phone: earlyPhone,
                    pushName: pushName || '',
                    clientNumber: nn,
                    firstMessageAt: new Date(),
                    lastMessageAt: new Date(),
                    messageCount: 1,
                  });
                  console.log(`📇 [RITA] Nouveau contact: Client ${nn} (${earlyPhone}, ${pushName || 'sans nom'})`);
                }
              } catch (contactErr) {
                // Duplicate key (11000) = race condition, le contact est déjà créé → ignorer
                if (contactErr.code !== 11000) {
                  console.error('⚠️ [RITA] Erreur enregistrement contact:', contactErr.message);
                }
              }
            })();
          }

          // ─── Transcription vocale si c'est un audio ───
          if (isAudio && instanceDoc) {
            console.log(`🎤 [RITA] Message vocal détecté — téléchargement en cours...`);
            try {
              const mediaData = await evolutionApiService.getMediaBase64(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                msg.key
              );
              if (mediaData?.base64) {
                // Déterminer la langue pour Whisper
                const ritaCfgLang = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
                const langHint = ritaCfgLang?.language || 'fr';
                const transcribed = await transcribeAudio(mediaData.base64, mediaData.mimetype, langHint);
                if (transcribed) {
                  text = transcribed;
                  console.log(`🎤 [RITA] Vocal transcrit: "${transcribed.substring(0, 200)}"`);
                  if (userId) logRitaActivity(userId, 'vocal_transcribed', { customerPhone: from.replace(/@.*$/, ''), details: transcribed.substring(0, 200) });
                } else {
                  console.log(`🎤 [RITA] Transcription échouée, message ignoré.`);
                  continue;
                }
              } else {
                console.log(`🎤 [RITA] Impossible de télécharger le vocal, ignoré.`);
                continue;
              }
            } catch (audioErr) {
              console.error(`❌ [RITA] Erreur transcription vocale:`, audioErr.message);
              continue;
            }
          }

          // ─── Détecter message image ───
          const isImage = !!(messageContent?.imageMessage);
          let imageAnalysisResult = null;

          if (isImage && instanceDoc) {
            console.log(`🖼️ [RITA] Image détectée — téléchargement en cours...`);
            try {
              const mediaData = await evolutionApiService.getMediaBase64(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                msg.key
              );
              if (mediaData?.base64) {
                const workspaceId = instanceDoc.workspaceId;
                if (workspaceId) {
                  imageAnalysisResult = await analyzeProductImage(
                    mediaData.base64,
                    mediaData.mimetype || messageContent?.imageMessage?.mimetype || 'image/jpeg',
                    workspaceId
                  );
                  console.log(`🖼️ [RITA] Analyse image:`, {
                    description: imageAnalysisResult.description,
                    isProduct: imageAnalysisResult.isProductImage,
                    matched: imageAnalysisResult.matchedProductName,
                    confidence: imageAnalysisResult.confidence
                  });
                  // Injecter le contexte image dans le texte pour que Rita le traite
                  const imageCaption = messageContent?.imageMessage?.caption || '';
                  if (imageAnalysisResult.isProductImage && imageAnalysisResult.matchedProductName) {
                    const confLevel = imageAnalysisResult.confidence >= 80 ? 'forte' : imageAnalysisResult.confidence >= 50 ? 'moyenne' : 'faible';
                    text = `[Le client a envoyé une image du produit "${imageAnalysisResult.matchedProductName}" (confiance: ${confLevel}, ${imageAnalysisResult.confidence}%). Description: ${imageAnalysisResult.description}]${imageCaption ? ' ' + imageCaption : ''}`;
                    if (imageAnalysisResult.confidence < 50) {
                      text += '\n[Note système: confiance faible — demande au client de confirmer le produit avant de poursuivre]';
                    }
                  } else if (imageAnalysisResult.isProductImage) {
                    text = `[Le client a envoyé une image d'un produit non identifié dans notre catalogue. Description: ${imageAnalysisResult.description}]${imageCaption ? ' ' + imageCaption : ''}`;
                  } else {
                    text = `[Le client a envoyé une image. Description: ${imageAnalysisResult.description}]${imageCaption ? ' ' + imageCaption : ''}`;
                  }
                  if (userId) logRitaActivity(userId, 'image_analyzed', { customerPhone: from.replace(/@.*$/, ''), details: imageAnalysisResult.description?.substring(0, 200) });
                } else {
                  console.log(`⚠️ [RITA] Pas de workspaceId, analyse image impossible.`);
                }
              } else {
                console.log(`🖼️ [RITA] Impossible de télécharger l'image.`);
              }
            } catch (imgErr) {
              console.error(`❌ [RITA] Erreur analyse image:`, imgErr.message);
            }
          }

          if (!text) {
            console.log(`⏩ [RITA] Message vide, ignoré.`);
            continue;
          }

          console.log(`💬 [RITA] ══════════════════════════════════════`);
          console.log(`💬 [RITA] Message entrant de ${from}`);
          console.log(`💬 [RITA] Contenu: "${text.substring(0, 200)}"`);

          if (!instanceDoc) {
            console.warn(`⚠️ [RITA] Instance "${instance}" introuvable en base, message ignoré.`);
            continue;
          }

          console.log(`💬 [RITA] Traitement pour userId=${userId}...`);

          // ─── Détecter si c'est le boss (escalade OU mode boss) ───
          {
            const ritaCfgEsc = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
            const bossRaw = (ritaCfgEsc?.bossPhone || '').replace(/\D/g, '');
              const fromRaw  = senderPhone;
            if (bossRaw && fromRaw === bossRaw) {
              // D'abord vérifier s'il y a une escalade en attente
              const pending = ritaCfgEsc?.bossEscalationEnabled ? shiftPendingEscalation(userId) : null;
              if (pending) {
                console.log(`🤝 [BOSS] Réponse boss reçue → transmission au client ${pending.clientPhone}`);
                const clientJid = `${pending.clientPhone}@s.whatsapp.net`;

                // Détecter si le boss envoie un media (image, vidéo, document)
                const bossImage = messageContent?.imageMessage;
                const bossVideo = messageContent?.videoMessage;
                const bossDocument = messageContent?.documentMessage;
                const bossHasMedia = !!(bossImage || bossVideo || bossDocument);

                if (bossHasMedia) {
                  // Télécharger le media du boss et le transmettre au client
                  try {
                    const mediaData = await evolutionApiService.getMediaBase64(
                      instanceDoc.instanceName,
                      instanceDoc.instanceToken,
                      msg.key
                    );
                    if (mediaData?.base64) {
                      const mimetype = mediaData.mimetype || bossImage?.mimetype || bossVideo?.mimetype || bossDocument?.mimetype || 'application/octet-stream';
                      const caption = bossImage?.caption || bossVideo?.caption || text || '';
                      const isVideoMedia = !!bossVideo || /video/i.test(mimetype);
                      const isImageMedia = !!bossImage || /image/i.test(mimetype);

                      if (isVideoMedia) {
                        const dataUri = `data:${mimetype};base64,${mediaData.base64}`;
                        const result = await evolutionApiService.sendVideo(
                          instanceDoc.instanceName, instanceDoc.instanceToken,
                          clientJid, dataUri, caption, 'video.mp4'
                        );
                        console.log(`${result.success ? '✅' : '❌'} [BOSS] Vidéo boss transférée au client ${pending.clientPhone}`);
                      } else if (isImageMedia) {
                        const dataUri = `data:${mimetype};base64,${mediaData.base64}`;
                        const result = await evolutionApiService.sendMedia(
                          instanceDoc.instanceName, instanceDoc.instanceToken,
                          clientJid, dataUri, caption, 'image.jpg'
                        );
                        console.log(`${result.success ? '✅' : '❌'} [BOSS] Image boss transférée au client ${pending.clientPhone}`);
                      } else {
                        // Document ou autre — envoyer en tant que media
                        const fileName = bossDocument?.fileName || 'document';
                        const dataUri = `data:${mimetype};base64,${mediaData.base64}`;
                        const result = await evolutionApiService.sendMedia(
                          instanceDoc.instanceName, instanceDoc.instanceToken,
                          clientJid, dataUri, caption, fileName
                        );
                        console.log(`${result.success ? '✅' : '❌'} [BOSS] Document boss transféré au client ${pending.clientPhone}`);
                      }

                      // Si le boss a aussi du texte en plus du media, l'envoyer aussi
                      if (text && !caption) {
                        await sendMessageAndTrack(
                          instanceDoc.instanceName, instanceDoc.instanceToken,
                          clientJid, text
                        );
                      }
                    } else {
                      console.error(`❌ [BOSS] Impossible de télécharger le media du boss`);
                      // Fallback: envoyer au moins le texte s'il y en a
                      if (text) {
                        await sendMessageAndTrack(
                          instanceDoc.instanceName, instanceDoc.instanceToken,
                          clientJid, text
                        );
                      }
                    }
                  } catch (mediaErr) {
                    console.error(`❌ [BOSS] Erreur transfert media boss:`, mediaErr.message);
                    if (text) {
                      await sendMessageAndTrack(
                        instanceDoc.instanceName, instanceDoc.instanceToken,
                        clientJid, text
                      );
                    }
                  }
                } else {
                  // Le boss envoie du texte simple → transmettre tel quel
                  await sendMessageAndTrack(
                    instanceDoc.instanceName,
                    instanceDoc.instanceToken,
                    clientJid,
                    text
                  );
                }

                logRitaActivity(userId, 'message_replied', { customerPhone: pending.clientPhone, details: `[Boss reply${bossHasMedia ? ' +media' : ''}] ${(text || '').substring(0, 200)}` });
                console.log(`✅ [BOSS] Réponse transmise au client ${pending.clientPhone}`);
                continue; // Ne pas traiter ce message comme une conversation client
              } else {
                // ─── MODE BOSS : le boss envoie un message sans escalade en attente ───
                console.log(`🧑‍💼 [BOSS-MODE] Message du boss détecté — activation mode boss`);
                try {
                  const bossReply = await processBossMessage(userId, from, text);
                  if (bossReply) {
                    console.log(`🧑‍💼 [BOSS-MODE] Réponse générée: "${bossReply.substring(0, 300)}"`);

                    // Détecter si c'est une instruction d'exécution [BOSS_EXEC:...]
                    const execMatch = bossReply.match(/\[BOSS_EXEC:([^\]]*)\]\s*/);
                    if (execMatch) {
                      // Mode Exécution : envoyer le message au client ciblé
                      const execTarget = execMatch[1].trim();
                      const messageForClient = bossReply.replace(/\[BOSS_EXEC:[^\]]*\]\s*/g, '').trim();
                      console.log(`⚙️ [BOSS-EXEC] Instruction d'exécution détectée → cible: "${execTarget}"`);

                      // Chercher le dernier client actif pour ce userId en cas de cible générique
                      let targetPhone = null;
                      if (/^\d{8,15}$/.test(execTarget.replace(/\D/g, ''))) {
                        targetPhone = execTarget.replace(/\D/g, '');
                      }

                      if (targetPhone && messageForClient) {
                        await sendMessageAndTrack(
                          instanceDoc.instanceName,
                          instanceDoc.instanceToken,
                          targetPhone,
                          messageForClient,
                          2,
                          1500
                        );
                        // Confirmer au boss
                        const confirmMsg = `✅ Message envoyé au client ${targetPhone}`;
                        await sendMessageAndTrack(
                          instanceDoc.instanceName,
                          instanceDoc.instanceToken,
                          fromRaw,
                          confirmMsg
                        );
                        logRitaActivity(userId, 'boss_exec', { customerPhone: targetPhone, details: `${messageForClient.substring(0, 200)}` });
                      } else {
                        // Pas de numéro clair — renvoyer la réponse au boss
                        await sendMessageAndTrack(
                          instanceDoc.instanceName,
                          instanceDoc.instanceToken,
                          fromRaw,
                          bossReply
                        );
                        logRitaActivity(userId, 'boss_message', { customerPhone: fromRaw, details: `[Exec sans cible] ${bossReply.substring(0, 200)}` });
                      }
                    } else {
                      // Mode Analyse / Conversation : renvoyer la réponse au boss
                      await sendMessageAndTrack(
                        instanceDoc.instanceName,
                        instanceDoc.instanceToken,
                        fromRaw,
                        bossReply
                      );
                      logRitaActivity(userId, 'boss_message', { customerPhone: fromRaw, details: bossReply.substring(0, 200) });
                    }
                  } else {
                    console.log(`ℹ️ [BOSS-MODE] Pas de réponse générée pour le boss`);
                  }
                } catch (bossErr) {
                  console.error(`❌ [BOSS-MODE] Erreur traitement message boss:`, bossErr.message);
                }
                continue; // Ne pas traiter comme un message client
              }
            }
          }

          // Log message reçu
          logRitaActivity(userId, 'message_received', { customerPhone: senderPhone, customerName: pushName || '', details: text.substring(0, 200) });

          // ─── Vérifier si ce client est en attente d'une réponse boss (escalade) ───
          const cleanFromEarly = senderPhone;
          if (hasPendingEscalation(userId, cleanFromEarly)) {
            const escQueue = pendingBossEscalations.get(userId) || [];
            const clientEsc = escQueue.find(e => e.clientPhone === cleanFromEarly);
            const elapsedEscMin = clientEsc ? (Date.now() - clientEsc.askedAt) / 60000 : Infinity;
            const timeoutMin = clientEsc?.timeoutMin || 30;
            if (elapsedEscMin < timeoutMin) {
              // Toujours en attente, timeout pas encore expiré
              console.log(`⏳ [BOSS] Client ${cleanFromEarly} en attente de réponse boss (${Math.round(elapsedEscMin)} min / ${timeoutMin} min)`);
              const waitMsg = `Je suis toujours en train de vérifier pour toi 🙏 Une petite patience, j'arrive !`;
              await sendMessageAndTrack(instanceDoc.instanceName, instanceDoc.instanceToken, cleanFromEarly, waitMsg, 2, 1500);
              continue;
            } else {
              // Timeout expiré → retirer l'escalade, laisser Rita improviser
              console.log(`⏰ [BOSS] Timeout écoulé pour ${cleanFromEarly} — Rita improvise`);
              const queue2 = (pendingBossEscalations.get(userId) || []).filter(e => e.clientPhone !== cleanFromEarly);
              pendingBossEscalations.set(userId, queue2);
            }
          }

          // Générer la réponse IA
          const startTime = Date.now();
          const reply = await processIncomingMessage(userId, senderJid, text, { agentId, pushName });
          const elapsed = Date.now() - startTime;

          if (!reply) {
            console.log(`ℹ️ [RITA] Rita désactivée ou pas de réponse pour userId=${userId} (${elapsed}ms)`);
            continue;
          }

          console.log(`🤖 [RITA] Réponse générée en ${elapsed}ms pour ${from}:`);
          console.log(`🤖 [RITA] "${reply.substring(0, 300)}"`);
          console.log(`🤖 [RITA] Tags détectés: IMAGE=${/\[IMAGE:/.test(reply)} VIDEO=${/\[VIDEO:/.test(reply)} ORDER=${/\[ORDER_DATA:/.test(reply)} ASK_BOSS=${/\[ASK_BOSS:/.test(reply)}`);
          // Extraire le numéro propre depuis le JID WhatsApp (ex: 33612345678@s.whatsapp.net)
          const cleanFrom = senderPhone;

          // ─── Détecter tag [ORDER_DATA:{...}] pour enregistrer la commande ───
          // Extraction robuste supportant le JSON imbriqué (ex: objets adresse)
          function extractOrderDataTag(text) {
            const startIdx = text.indexOf('[ORDER_DATA:');
            if (startIdx === -1) return null;
            let depth = 0;
            let jsonStart = startIdx + 12; // longueur de '[ORDER_DATA:'
            let jsonEnd = -1;
            for (let i = jsonStart; i < text.length; i++) {
              if (text[i] === '{') depth++;
              if (text[i] === '}') {
                depth--;
                if (depth === 0) { jsonEnd = i + 1; break; }
              }
            }
            if (jsonEnd === -1) return null;
            const tagEnd = text[jsonEnd] === ']' ? jsonEnd + 1 : jsonEnd;
            return {
              json: text.substring(jsonStart, jsonEnd),
              fullTag: text.substring(startIdx, tagEnd),
            };
          }
          const orderTagExtracted = extractOrderDataTag(reply);
          let replyClean = reply;

          if (orderTagExtracted) {
            replyClean = reply.replace(orderTagExtracted.fullTag, '').trim();
            try {
              const orderData = JSON.parse(orderTagExtracted.json);
              console.log(`📦 [RITA] Commande détectée:`, JSON.stringify(orderData));
              await WhatsAppOrder.create({
                userId,
                instanceName: instanceDoc.instanceName,
                customerPhone: cleanFrom,
                customerName: orderData.name || '',
                customerCity: orderData.city || '',
                pushName: pushName || '',
                productName: orderData.product || '',
                productPrice: orderData.price || '',
                deliveryDate: orderData.delivery_date || '',
                deliveryTime: orderData.delivery_time || '',
                status: 'pending',
                conversationSummary: `${orderData.product} → ${orderData.name} (${orderData.city})`,
              });
              console.log(`✅ [RITA] WhatsAppOrder enregistrée pour ${cleanFrom}`);
              logRitaActivity(userId, 'order_confirmed', { customerPhone: cleanFrom, customerName: orderData.name || '', product: orderData.product || '', price: orderData.price || '' });

              // ─── Déclencher les flows sur order_confirmed ───
              try {
                await processFlows(userId, 'order_confirmed', { text: text || '', phone: cleanFrom, pushName });
              } catch (flowErr) { console.error('⚠️ [FlowEngine] order_confirmed:', flowErr.message); }

              // Marquer le contact comme ayant commandé + enrichir avec nom/ville
              try {
                const contactUpdate = { hasOrdered: true };
                if (orderData.name) contactUpdate.nom = orderData.name;
                if (orderData.city) contactUpdate.ville = orderData.city;
                if (orderData.address) contactUpdate.adresse = orderData.address;
                await RitaContact.findOneAndUpdate(
                  { userId, phone: cleanFrom },
                  contactUpdate
                );
              } catch (_) { /* ignore */ }

              // ─── Créer aussi une vraie commande dans ecom_orders (source: rita) ───
              if (instanceDoc.workspaceId) {
                try {
                  const phoneVal = cleanFrom || '';
                  const priceVal = parseFloat(String(orderData.price || '0').replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
                  const ritaOrder = new Order({
                    workspaceId: instanceDoc.workspaceId,
                    orderId: `#RITA_${Date.now().toString(36)}`,
                    date: new Date(),
                    clientName: orderData.name || pushName || '',
                    clientPhone: phoneVal,
                    clientPhoneNormalized: normalizePhone(phoneVal, '237'),
                    city: orderData.city || '',
                    product: orderData.product || '',
                    quantity: 1,
                    price: priceVal,
                    status: 'confirmed',
                    notes: `Via Rita WhatsApp — ${orderData.delivery_date || ''} ${orderData.delivery_time || ''}`.trim(),
                    tags: ['rita'],
                    source: 'rita',
                    sheetRowId: `rita_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    sheetRowIndex: 999999,
                  });
                  await ritaOrder.save();
                  console.log(`✅ [RITA] Commande ecom créée: ${ritaOrder.orderId} (workspaceId=${instanceDoc.workspaceId})`);
                } catch (orderErr) {
                  console.error(`❌ [RITA] Erreur création commande ecom:`, orderErr.message);
                }
              } else {
                console.warn(`⚠️ [RITA] Pas de workspaceId sur l'instance, commande ecom non créée`);
              }

              // ─── Notification WhatsApp au boss ───
              try {
                const ritaCfgBoss = await RitaConfig.findOne({ userId }).lean();
                if (ritaCfgBoss?.bossNotifications && ritaCfgBoss?.bossPhone && ritaCfgBoss?.notifyOnOrder) {
                  const bossMsg = `📦 *Nouvelle commande confirmée par Rita*\n\n👤 Client: ${orderData.name || 'N/A'}\n📱 Tél: ${cleanFrom}\n📍 Ville: ${orderData.city || 'N/A'}\n🛍️ Produit: ${orderData.product || 'N/A'}\n💰 Prix: ${orderData.price || 'N/A'}\n📅 Livraison: ${orderData.delivery_date || ''} ${orderData.delivery_time || ''}\n⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}`;
                  const bossPhone = ritaCfgBoss.bossPhone.replace(/\D/g, '');
                  await sendMessageAndTrack(
                    instanceDoc.instanceName,
                    instanceDoc.instanceToken,
                    bossPhone,
                    bossMsg
                  );
                  console.log(`✅ [RITA] Notification boss envoyée à ${bossPhone}`);
                }
              } catch (bossErr) {
                console.error(`⚠️ [RITA] Erreur notification boss:`, bossErr.message);
              }
            } catch (parseErr) {
              console.error(`❌ [RITA] Erreur parsing ORDER_DATA:`, parseErr.message);
            }
          }

          // ─── Filet de sécurité image (code-level) ───
          // Cas 1 : Rita a demandé "Tu veux voir l'image ?" sans envoyer le tag → on remplace par le tag
          if (!replyClean.includes('[IMAGE:') && /tu veux voir l[a']? ?image|voir (la |une )?photo|je t'envoie (la |une )?image/i.test(replyClean)) {
            try {
              const ritaCfgSafeImg = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
              const safeImgCatalog = (ritaCfgSafeImg?.productCatalog || []).filter(p => p.name && p.images?.length);
              const allProducts = ritaCfgSafeImg?.productCatalog || [];
              const safeImgMatched = findProductByName(safeImgCatalog, replyClean);
              if (safeImgMatched) {
                replyClean = replyClean
                  .replace(/[,.]?\s*Tu veux voir l[a']? ?image\s*[?!]?/gi, '')
                  .replace(/[,.]?\s*Tu veux voir (la |une )?photo\s*[?!]?/gi, '')
                  .trim();
                replyClean += ` [IMAGE:${safeImgMatched.name}]`;
                console.log(`🔧 [RITA] Filet sécurité: question image remplacée par tag [IMAGE:${safeImgMatched.name}]`);
              } else {
                // Produit sans image
                replyClean = replyClean
                  .replace(/[,.]?\s*Tu veux voir l[a']? ?image\s*[?!]?/gi, '')
                  .replace(/[,.]?\s*Tu veux voir (la |une )?photo\s*[?!]?/gi, '')
                  .trim();
                replyClean += `\n\nDésolé, on n'a pas encore la photo de ce produit 🙏`;
                console.log(`🔧 [RITA] Filet sécurité: pas d'image disponible pour ce produit`);
              }
            } catch (safeImgErr) { console.error('❌ [RITA] Filet image cas 1:', safeImgErr.message); }
          }
          // Cas 2 : Client répond "oui" à une question d'image → forcer l'envoi
          const isAffirmative = /^(oui|yes|ok|ouais|yep|d'accord|dac|oki|okay|y|si|sure|yeah|mh|mhm)[\s!.]*$/i.test(text.trim());
          if (isAffirmative && !replyClean.includes('[IMAGE:')) {
            try {
              const lastBot = getLastAssistantMessage(userId, from);
              if (lastBot && /image|photo|voir/i.test(lastBot)) {
                const ritaCfgSafeImg2 = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
                const safeImgCatalog2 = (ritaCfgSafeImg2?.productCatalog || []).filter(p => p.name && p.images?.length);
                const allProds2 = ritaCfgSafeImg2?.productCatalog || [];
                const safeImgMatched2 = findProductByName(safeImgCatalog2, lastBot);
                if (safeImgMatched2) {
                  replyClean = replyClean.replace(/[,.]?\s*Tu veux voir l[a']? ?image\s*[?!]?/gi, '').trim();
                  replyClean += ` [IMAGE:${safeImgMatched2.name}]`;
                  console.log(`🔧 [RITA] Filet sécurité: "oui" → image injectée [IMAGE:${safeImgMatched2.name}]`);
                } else {
                  const noImgProduct = findProductByName(allProds2, lastBot);
                  if (noImgProduct) {
                    replyClean += `\n\nDésolé, on n'a pas encore la photo de ce produit 🙏`;
                    console.log(`🔧 [RITA] Filet sécurité: pas d'image pour ${noImgProduct.name}`);
                  }
                }
              }
            } catch (safeImgErr2) { console.error('❌ [RITA] Filet image cas 2:', safeImgErr2.message); }
          }

          // ─── Détecter tag [ASK_BOSS:question] pour escalade boss ───
          const askBossMatch = replyClean.match(/\[ASK_BOSS:(.+?)\]/);
          if (askBossMatch) {
            replyClean = replyClean.replace(/\s*\[ASK_BOSS:.+?\]/g, '').trim();
            try {
              const ritaCfgEsc2 = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
              if (ritaCfgEsc2?.bossEscalationEnabled && ritaCfgEsc2?.bossPhone) {
                const question = askBossMatch[1].trim();
                const bossPhone = ritaCfgEsc2.bossPhone.replace(/\D/g, '');
                const currentCleanFrom = from.replace(/@.*$/, '');
                const timeoutMin = ritaCfgEsc2.bossEscalationTimeoutMin || 30;
                // Stocker l'escalade
                addPendingEscalation(userId, {
                  clientPhone: currentCleanFrom,
                  question,
                  askedAt: Date.now(),
                  timeoutMin,
                  instanceName: instanceDoc.instanceName,
                  instanceToken: instanceDoc.instanceToken,
                });
                // Notifier le boss
                const bossMsg = `❓ *Question client sans réponse — Rita*\n\n📱 Client: ${currentCleanFrom}\n❓ Question: ${question}\n\nRéponds à ce message pour que Rita transmette ta réponse automatiquement au client.\n_(Si pas de réponse dans ${timeoutMin} min, Rita improvisera.)_`;
                await sendMessageAndTrack(
                  instanceDoc.instanceName,
                  instanceDoc.instanceToken,
                  bossPhone,
                  bossMsg
                );
                console.log(`🤝 [BOSS] Escalade envoyée au boss (${bossPhone}) pour client ${currentCleanFrom}: ${question}`);
                logRitaActivity(userId, 'escalation', { customerPhone: currentCleanFrom, details: question });
              } else {
                console.log(`ℹ️ [BOSS] Escalade détectée mais bossEscalationEnabled=false ou bossPhone absent — Rita répond normalement`);
              }
            } catch (escErr) {
              console.error(`❌ [BOSS] Erreur escalade:`, escErr.message);
            }
          }

          // ─── Détecter tag [IMAGES_ALL:Nom du produit] pour envoi de TOUTES les photos ───
          const imagesAllTagMatch = replyClean.match(/\[IMAGES_ALL:(.+?)\]/);
          // ─── Détecter tag [IMAGE:Nom du produit] pour envoi de photos ───
          const imageTagMatch = !imagesAllTagMatch ? replyClean.match(/\[IMAGE:(.+?)\]/) : null;
          // ─── Détecter tag [VIDEO:Nom du produit] pour envoi de vidéos ───
          const videoTagMatch = replyClean.match(/\[VIDEO:(.+?)\]/);
          let textToSend = replyClean;
          let imageUrl = null;
          let imageProductName = null;
          let videoUrl = null;
          let videoProductName = null;
          let matchedProductForMedia = null;
          let sendAllImages = false; // flag pour envoyer toutes les images

          if (imagesAllTagMatch) {
            // Mode: envoyer TOUTES les images du produit
            imageProductName = imagesAllTagMatch[1].trim();
            textToSend = textToSend.replace(/\s*\[IMAGES_ALL:.+?\]/g, '').trim();
            console.log(`📸📸 [RITA] Tag IMAGES_ALL détecté pour produit: "${imageProductName}"`);

            const ritaCfg = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
            const catalog = ritaCfg?.productCatalog || [];
            const product = findProductByName(catalog, imageProductName);
            console.log(`📸📸 [RITA] Produit trouvé: ${product ? product.name : 'AUCUN'} | images: ${product?.images?.length || 0}`);

            if (product?.images?.length) {
              imageUrl = product.images[0];
              if (imageUrl && imageUrl.startsWith('/')) {
                imageUrl = `https://api.scalor.net${imageUrl}`;
              }
              matchedProductForMedia = product;
              sendAllImages = true;
              console.log(`📸📸 [RITA] ${product.images.length} image(s) à envoyer pour ${product.name}`);
            } else {
              console.log(`📸📸 [RITA] Aucune image pour "${imageProductName}"`);
              const noImgMsg = `Désolé, on n'a pas encore de photos de ce produit 🙏 Mais je peux te donner tous les détails !`;
              if (!textToSend) { textToSend = noImgMsg; } else { textToSend += `\n\n${noImgMsg}`; }
            }
          } else if (imageTagMatch) {
            imageProductName = imageTagMatch[1].trim();
            textToSend = textToSend.replace(/\s*\[IMAGE:.+?\]/g, '').trim();
            console.log(`📸 [RITA] Tag image détecté pour produit: "${imageProductName}"`);

            const ritaCfg = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
            const catalog = ritaCfg?.productCatalog || [];
            const product = findProductByName(catalog, imageProductName);
            console.log(`📸 [RITA] Produit trouvé: ${product ? product.name : 'AUCUN'} | images: ${product?.images?.length || 0}`);

            if (product?.images?.length) {
              imageUrl = product.images[0];
              if (imageUrl && imageUrl.startsWith('/')) {
                imageUrl = `https://api.scalor.net${imageUrl}`;
              }
              matchedProductForMedia = product;
              console.log(`📸 [RITA] Image trouvée: ${imageUrl}`);
            } else {
              console.log(`📸 [RITA] Aucune image pour "${imageProductName}"`);
              const noImgMsg = `Désolé, on n'a pas encore la photo de ce produit 🙏 Mais je peux te donner tous les détails !`;
              if (!textToSend) {
                textToSend = noImgMsg;
              } else {
                textToSend += `\n\n${noImgMsg}`;
              }
            }
          }

          if (videoTagMatch && !imageTagMatch && !imagesAllTagMatch) {
            videoProductName = videoTagMatch[1].trim();
            textToSend = textToSend.replace(/\s*\[VIDEO:.+?\]/g, '').trim();
            console.log(`🎬 [RITA] Tag vidéo détecté pour produit: "${videoProductName}"`);

            const ritaCfgV = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
            const catalogV = ritaCfgV?.productCatalog || [];
            const productV = findProductByName(catalogV, videoProductName);
            console.log(`🎬 [RITA] Produit vidéo trouvé: ${productV ? productV.name : 'AUCUN'} | vidéos: ${productV?.videos?.length || 0}`);
            if (productV?.videos?.length) {
              videoUrl = productV.videos[0];
              if (videoUrl && videoUrl.startsWith('/')) {
                videoUrl = `https://api.scalor.net${videoUrl}`;
              }
              matchedProductForMedia = productV;
              console.log(`🎬 [RITA] Vidéo trouvée: ${videoUrl}`);
            } else {
              console.log(`🎬 [RITA] Aucune vidéo trouvée pour "${videoProductName}"`);
              // Essayer d'escalader vers le boss si activé
              try {
                const ritaCfgNoVid = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
                if (ritaCfgNoVid?.bossEscalationEnabled && ritaCfgNoVid?.bossPhone) {
                  const bossPhone = ritaCfgNoVid.bossPhone.replace(/\D/g, '');
                  const currentCleanFrom = from.replace(/@.*$/, '');
                  const timeoutMin = ritaCfgNoVid.bossEscalationTimeoutMin || 30;
                  const question = `Le client demande la vidéo du produit "${videoProductName}" — aucune vidéo configurée`;
                  addPendingEscalation(userId, {
                    clientPhone: currentCleanFrom,
                    question,
                    askedAt: Date.now(),
                    timeoutMin,
                    instanceName: instanceDoc.instanceName,
                    instanceToken: instanceDoc.instanceToken,
                  });
                  const bossMsg = `❓ *Question client sans réponse — Rita*\n\n📱 Client: ${currentCleanFrom}\n❓ Question: ${question}\n\nRéponds à ce message pour que Rita transmette ta réponse automatiquement au client.\n_(Si pas de réponse dans ${timeoutMin} min, Rita improvisera.)_`;
                  await sendMessageAndTrack(
                    instanceDoc.instanceName,
                    instanceDoc.instanceToken,
                    bossPhone,
                    bossMsg
                  );
                  console.log(`🤝 [BOSS] Escalade vidéo envoyée au boss pour client ${currentCleanFrom}`);
                  logRitaActivity(userId, 'escalation', { customerPhone: currentCleanFrom, details: question });
                  // Message rassurant pour le client
                  const reassureMsg = `Je vérifie avec mon responsable si on a une vidéo pour ce produit, patiente 🙏`;
                  if (!textToSend) {
                    textToSend = reassureMsg;
                  } else if (!textToSend.includes('responsable') && !textToSend.includes('vérif')) {
                    textToSend += `\n\n${reassureMsg}`;
                  }
                } else {
                  const noVideoMsg = `Désolé, on n'a pas encore de vidéo pour ce produit 🙏 Mais je peux te montrer les photos ou te donner plus de détails !`;
                  if (!textToSend) {
                    textToSend = noVideoMsg;
                  } else {
                    textToSend += `\n\n${noVideoMsg}`;
                  }
                }
              } catch (noVidErr) {
                console.error(`❌ [RITA] Erreur escalade vidéo manquante:`, noVidErr.message);
                const noVideoMsg = `Désolé, on n'a pas encore de vidéo pour ce produit 🙏 Mais je peux te montrer les photos ou te donner plus de détails !`;
                if (!textToSend) {
                  textToSend = noVideoMsg;
                } else {
                  textToSend += `\n\n${noVideoMsg}`;
                }
              }
            }
          }

          // ─── Détecter tag [TESTIMONIAL:index] pour envoi de médias témoignage ───
          const testimonialTagMatch = replyClean.match(/\[TESTIMONIAL:(\d+)\]/);
          let testimonialMediaUrl = null;
          let testimonialMediaType = null; // 'image' ou 'video'
          if (testimonialTagMatch && !imageTagMatch && !imagesAllTagMatch && !videoTagMatch) {
            const tIdx = parseInt(testimonialTagMatch[1], 10);
            textToSend = textToSend.replace(/\s*\[TESTIMONIAL:\d+\]/g, '').trim();
            console.log(`🗣️ [RITA] Tag TESTIMONIAL détecté, index: ${tIdx}`);

            const ritaCfgT = await RitaConfig.findOne(agentId ? { agentId } : { userId }).lean();
            const testimonial = ritaCfgT?.testimonials?.[tIdx];
            if (testimonial) {
              if (testimonial.videos?.length) {
                testimonialMediaUrl = testimonial.videos[0];
                testimonialMediaType = 'video';
              } else if (testimonial.images?.length) {
                testimonialMediaUrl = testimonial.images[0];
                testimonialMediaType = 'image';
              }
              if (testimonialMediaUrl && testimonialMediaUrl.startsWith('/')) {
                testimonialMediaUrl = `https://api.scalor.net${testimonialMediaUrl}`;
              }
              console.log(`🗣️ [RITA] Témoignage #${tIdx} média: ${testimonialMediaType || 'aucun'} → ${testimonialMediaUrl || 'N/A'}`);
            } else {
              console.log(`🗣️ [RITA] Témoignage #${tIdx} non trouvé`);
            }
          }

          // ─── Déterminer le mode de réponse ───
          const ritaCfgVoice = await RitaConfig.findOne({ userId }).lean();
          // Utiliser la clé API de la config Rita OU celle du .env en fallback
          const effectiveApiKey = ritaCfgVoice?.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || '';
          const effectiveFishKey = ritaCfgVoice?.fishAudioApiKey || FISH_AUDIO_DIRECT_API_KEY;
          const ttsConfig = { ...ritaCfgVoice, elevenlabsApiKey: effectiveApiKey, fishAudioApiKey: effectiveFishKey };
          // responseMode: 'text' | 'voice' | 'both'. Legacy compat: voiceMode=true → 'voice'
          const responseMode = ritaCfgVoice?.responseMode || (ritaCfgVoice?.voiceMode ? 'voice' : 'text');
          const mixedVoiceReplyChance = Math.max(0, Math.min(100, Number(ritaCfgVoice?.mixedVoiceReplyChance ?? 65) || 65));
          const isFishAudio = ritaCfgVoice?.ttsProvider === 'fishaudio';
          const canDoVoice = !!((isFishAudio ? effectiveFishKey : effectiveApiKey) && textToSend);

          // Détecter le tag [VOICE] dans la réponse → Rita a décidé d'envoyer un vocal
          const hasVoiceTag = /\[VOICE\]/i.test(textToSend);
          if (hasVoiceTag) {
            textToSend = textToSend.replace(/\[VOICE\]\s*/gi, '').trim();
            console.log(`🎙️ [RITA] Tag [VOICE] détecté — forçage vocal pour ce tour`);
          }

          // Délai de réponse configuré (en secondes) → converti en ms pour Evolution API
          const responseDelayMs = Math.max(500, Math.min(30000, (ritaCfgVoice?.responseDelay || 2) * 1000));
          if (responseDelayMs > 1500) {
            // Attendre avant d'envoyer (simule une vraie frappe humaine)
            await new Promise(r => setTimeout(r, responseDelayMs - 1000));
          }

          // Déterminer vocal vs texte pour ce tour :
          // 1. Si mode "voice" → toujours vocal
          // 2. Si mode "both" → plus de vocal sur confirmations, tags [VOICE] et réponses longues
          // 3. Si mode "text" → toujours texte
          let useVoiceThisTurn = false;
          if (responseMode === 'voice' && canDoVoice) {
            // Mode full vocal : toujours vocal
            useVoiceThisTurn = true;
          } else if (responseMode === 'both' && canDoVoice) {
            const isLongExplanation =
              textToSend.length >= 180 ||
              /\n|•|▪|◦|\d+\.\s|:/.test(textToSend) ||
              splitWhatsAppMessage(textToSend, 220).length > 1;
            const voiceChance = hasVoiceTag
              ? 1
              : isLongExplanation
                ? mixedVoiceReplyChance / 100
                : Math.max(0.15, Math.min(0.5, mixedVoiceReplyChance / 200));

            if (orderTagExtracted) {
              useVoiceThisTurn = true;
              console.log(`🎙️ [RITA] Commande confirmée — vocal pour confirmation (mode both)`);
            } else {
              const randomChance = Math.random() < voiceChance;
              if (randomChance) {
                useVoiceThisTurn = true;
                console.log(`🎙️ [RITA] Vocal accordé (${Math.round(voiceChance * 100)}%, mode both${isLongExplanation ? ', réponse longue' : ''})`);
              } else {
                console.log(`🔇 [RITA] Texte cette fois (tirage ${Math.round(voiceChance * 100)}%, mode both${isLongExplanation ? ', réponse longue' : ''})`);
              }
            }
          }
          let sendText  = responseMode === 'text' || (!useVoiceThisTurn && responseMode !== 'voice');
          let sendVoice = (responseMode === 'voice' || useVoiceThisTurn) && canDoVoice;

          if ((responseMode === 'voice' || useVoiceThisTurn) && !canDoVoice) {
            console.warn(`⚠️ [RITA] Mode vocal demandé mais aucune voix n'est disponible — fallback texte pour ${cleanFrom}`);
            sendText = !!textToSend;
            sendVoice = false;
          }

          console.log(`🎚️ [RITA] Mode: ${responseMode} | tour: ${useVoiceThisTurn ? 'vocal' : 'texte'} | voiceTag: ${hasVoiceTag} | mixChance: ${mixedVoiceReplyChance}% | apiKey: ${effectiveApiKey ? 'oui' : 'non'}`);


          // ── Envoyer le texte (avec découpage [SPLIT] puis splitWhatsAppMessage) ──
          if (textToSend && sendText) {
            // 1. Découpage par tag [SPLIT] (décidé par Rita dans sa réponse)
            const splitParts = textToSend.split(/\s*\[SPLIT\]\s*/).map(p => p.trim()).filter(Boolean);
            // 2. Chaque partie est ensuite découpée si encore trop longue (> 1500 chars)
            const messageParts = splitParts.flatMap(p => splitWhatsAppMessage(p, 1500));
            console.log(`📤 [RITA] Envoi réponse texte à ${cleanFrom} (${messageParts.length} partie(s), délai: ${responseDelayMs}ms)...`);
            for (let partIdx = 0; partIdx < messageParts.length; partIdx++) {
              const part = messageParts[partIdx];
              const sendResult = await sendMessageAndTrack(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                cleanFrom,
                part,
                2,
                partIdx === 0 ? responseDelayMs : 1500
              );
              if (sendResult.success) {
                console.log(`✅ [RITA] Réponse texte partie ${partIdx + 1}/${messageParts.length} envoyée`);
              } else {
                console.error(`❌ [RITA] Échec envoi texte partie ${partIdx + 1}:`, sendResult.error);
              }
              // Délai entre les parties pour lisibilité sur WhatsApp
              if (partIdx < messageParts.length - 1) {
                await new Promise(r => setTimeout(r, 1200));
              }
            }
            logRitaActivity(userId, 'message_replied', { customerPhone: cleanFrom, details: textToSend.substring(0, 200) });
          }

          // ── Envoyer la note vocale ──
          if (textToSend && sendVoice && canDoVoice) {
            console.log(`🎙️ [RITA] Génération TTS...`);
            try {
              const audioBuffer = await textToSpeech(textToSend, ttsConfig);
              if (audioBuffer) {
                const audioBase64 = audioBuffer.toString('base64');
                const audioResult = await evolutionApiService.sendAudio(
                  instanceDoc.instanceName,
                  instanceDoc.instanceToken,
                  cleanFrom,
                  `data:audio/mpeg;base64,${audioBase64}`
                );
                if (audioResult.success) {
                  console.log(`✅ [RITA] Note vocale envoyée`);
                  logRitaActivity(userId, 'vocal_sent', { customerPhone: cleanFrom });
                } else {
                  console.error(`❌ [RITA] Échec vocal, fallback texte:`, audioResult.error);
                  await sendMessageAndTrack(instanceDoc.instanceName, instanceDoc.instanceToken, cleanFrom, textToSend);
                }
              } else {
                console.warn(`⚠️ [RITA] TTS null, fallback texte`);
                await sendMessageAndTrack(instanceDoc.instanceName, instanceDoc.instanceToken, cleanFrom, textToSend);
              }
            } catch (ttsErr) {
              console.error(`❌ [RITA] Erreur TTS:`, ttsErr.message);
              await sendMessageAndTrack(instanceDoc.instanceName, instanceDoc.instanceToken, cleanFrom, textToSend);
            }
          }

          // Envoyer l'image (ou TOUTES les images) si disponible
          if (imageUrl) {
            if (sendAllImages && matchedProductForMedia?.images?.length > 1) {
              // ─── MODE TOUTES LES IMAGES ───
              console.log(`📸📸 [RITA] Envoi de ${matchedProductForMedia.images.length} images à ${cleanFrom}`);
              let imagesSentCount = 0;
              for (let imgIdx = 0; imgIdx < matchedProductForMedia.images.length; imgIdx++) {
                let imgUrl = matchedProductForMedia.images[imgIdx];
                if (!imgUrl) continue;
                if (imgUrl.startsWith('/')) imgUrl = `https://api.scalor.net${imgUrl}`;
                const ext = (imgUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
                try {
                  const result = await evolutionApiService.sendMedia(
                    instanceDoc.instanceName,
                    instanceDoc.instanceToken,
                    cleanFrom,
                    imgUrl,
                    '',
                    `product_${imgIdx + 1}.${ext}`
                  );
                  if (result.success) {
                    imagesSentCount++;
                    console.log(`✅ [RITA] Image ${imgIdx + 1}/${matchedProductForMedia.images.length} envoyée`);
                    logRitaActivity(userId, 'image_sent', { customerPhone: cleanFrom });
                  } else {
                    console.error(`❌ [RITA] Échec image ${imgIdx + 1}: ${result.error}`);
                  }
                  // Petit délai entre chaque image pour éviter le flood
                  if (imgIdx < matchedProductForMedia.images.length - 1) {
                    await new Promise(r => setTimeout(r, 800));
                  }
                } catch (imgErr) {
                  console.error(`❌ [RITA] Erreur envoi image ${imgIdx + 1}:`, imgErr.message);
                }
              }
              if (imagesSentCount === 0) {
                await sendMessageAndTrack(
                  instanceDoc.instanceName, instanceDoc.instanceToken, cleanFrom,
                  `Désolé, je n'arrive pas à envoyer les photos en ce moment 🙏 Mais le produit est bien disponible !`
                );
              } else {
                console.log(`📸📸 [RITA] ${imagesSentCount}/${matchedProductForMedia.images.length} images envoyées à ${cleanFrom}`);
              }
            } else {
              // ─── MODE IMAGE UNIQUE (défaut) ───
              const imgExt = (imageUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
              const imgFileName = `product.${imgExt}`;
              console.log(`📸 [RITA] Envoi image à ${cleanFrom}... URL: ${imageUrl}`);
              let imageSent = false;

              const mediaResult = await evolutionApiService.sendMedia(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                cleanFrom,
                imageUrl,
                '',
                imgFileName
              );
              if (mediaResult.success) {
                imageSent = true;
                console.log(`✅ [RITA] Image envoyée avec succès à ${cleanFrom}`);
                logRitaActivity(userId, 'image_sent', { customerPhone: cleanFrom });
              } else {
                console.error(`❌ [RITA] Échec envoi image (tentative 1) à ${cleanFrom}:`, mediaResult.error);
                if (matchedProductForMedia?.images?.length > 1) {
                  for (let imgIdx = 1; imgIdx < matchedProductForMedia.images.length; imgIdx++) {
                    let altUrl = matchedProductForMedia.images[imgIdx];
                    if (altUrl && altUrl.startsWith('/')) altUrl = `https://api.scalor.net${altUrl}`;
                    if (!altUrl) continue;
                    const altExt = (altUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
                    console.log(`📸 [RITA] Retry avec image alternative ${imgIdx + 1}: ${altUrl}`);
                    const retryResult = await evolutionApiService.sendMedia(
                      instanceDoc.instanceName,
                      instanceDoc.instanceToken,
                      cleanFrom,
                      altUrl,
                      '',
                      `product.${altExt}`
                    );
                    if (retryResult.success) {
                      imageSent = true;
                      console.log(`✅ [RITA] Image alternative ${imgIdx + 1} envoyée avec succès`);
                      logRitaActivity(userId, 'image_sent', { customerPhone: cleanFrom });
                      break;
                    }
                  }
                }
              }

              if (!imageSent) {
                console.error(`❌ [RITA] Toutes les tentatives d'envoi image ont échoué pour ${cleanFrom}`);
                console.error(`   URL tentée: ${imageUrl}`);
                console.error(`   Produit: ${matchedProductForMedia?.name || 'N/A'}, Images: ${JSON.stringify(matchedProductForMedia?.images || [])}`);
                await sendMessageAndTrack(
                  instanceDoc.instanceName,
                  instanceDoc.instanceToken,
                  cleanFrom,
                  `Désolé, je n'arrive pas à envoyer la photo en ce moment 🙏 Mais le produit est bien disponible, tu veux qu'on te le réserve ?`
                );
              }
            }

            // ─── RELANCE après image: proposer achat avec prix ───
            // Seulement si le texte de Rita ne contient pas déjà une offre de closing
            // ET si le texte de Rita est vide/très court (image seule)
            const textAlreadyCloses = /confirm|réserv|commande|livr|veux qu|tu veux|on fait|je te prépare|prix|fcfa|\d{3,}/i.test(textToSend);
            const textAlreadySubstantial = textToSend && textToSend.length > 30;
            if (matchedProductForMedia && !textAlreadyCloses && !textAlreadySubstantial && !sendAllImages) {
              const p = matchedProductForMedia;
              const followUp = p.price
                ? `${p.name} à ${p.price} 👍 Tu veux qu'on te le réserve ?`
                : `Tu veux qu'on te réserve le ${p.name} ? 👍`;

              await new Promise(r => setTimeout(r, 1500));
              await sendMessageAndTrack(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                cleanFrom,
                followUp
              );
              console.log(`📤 [RITA] Relance après image envoyée à ${cleanFrom}`);
            } else {
              console.log(`ℹ️ [RITA] Pas de relance après image — texte Rita déjà suffisant (${textToSend.length} chars, closes=${textAlreadyCloses})`);
            }
          }

          // Envoyer la vidéo si disponible
          if (videoUrl) {
            console.log(`🎬 [RITA] Envoi vidéo à ${cleanFrom}...`);
            await new Promise(r => setTimeout(r, 1000));
            const videoResult = await evolutionApiService.sendVideo(
              instanceDoc.instanceName,
              instanceDoc.instanceToken,
              cleanFrom,
              videoUrl,
              matchedProductForMedia?.name || '',
              'product.mp4'
            );
            if (videoResult.success) {
              console.log(`✅ [RITA] Vidéo envoyée avec succès à ${cleanFrom}`);
              logRitaActivity(userId, 'video_sent', { customerPhone: cleanFrom });
            } else {
              console.error(`❌ [RITA] Échec envoi vidéo à ${cleanFrom}:`, videoResult.error);
            }
          }

          // ─── Envoi média de témoignage si détecté ───
          if (testimonialMediaUrl) {
            console.log(`🗣️ [RITA] Envoi média témoignage (${testimonialMediaType}) à ${cleanFrom}...`);
            await new Promise(r => setTimeout(r, 1000));
            if (testimonialMediaType === 'video') {
              const tResult = await evolutionApiService.sendVideo(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                cleanFrom,
                testimonialMediaUrl,
                '',
                'testimonial.mp4'
              );
              if (tResult.success) {
                console.log(`✅ [RITA] Vidéo témoignage envoyée à ${cleanFrom}`);
                logRitaActivity(userId, 'testimonial_video_sent', { customerPhone: cleanFrom });
              } else {
                console.error(`❌ [RITA] Échec envoi vidéo témoignage:`, tResult.error);
              }
            } else {
              const tExt = (testimonialMediaUrl.split('?')[0].split('.').pop() || 'jpg').toLowerCase();
              const tResult = await evolutionApiService.sendMedia(
                instanceDoc.instanceName,
                instanceDoc.instanceToken,
                cleanFrom,
                testimonialMediaUrl,
                '',
                `testimonial.${tExt}`
              );
              if (tResult.success) {
                console.log(`✅ [RITA] Image témoignage envoyée à ${cleanFrom}`);
                logRitaActivity(userId, 'testimonial_image_sent', { customerPhone: cleanFrom });
              } else {
                console.error(`❌ [RITA] Échec envoi image témoignage:`, tResult.error);
              }
            }
          }

          // ─── Déclencher les flows sur message_received ───
          try {
            await processFlows(userId, 'message_received', { text: text || '', phone: cleanFrom, pushName });
          } catch (flowErr) { console.error('⚠️ [FlowEngine] message_received:', flowErr.message); }

          console.log(`💬 [RITA] ══════════════════════════════════════`);
        }
      } else if (normalizedEvent === 'MESSAGES_UPDATE') {
        // Accusés de réception / statuts de livraison — log discret
        const statusLabels = { 0: 'ERROR', 1: 'PENDING', 2: 'SERVER_ACK', 3: 'DELIVERY_ACK', 4: 'READ', 5: 'PLAYED' };
        const label = statusLabels[data?.status] || data?.status || '?';
        console.log(`📬 [WH] Statut message: ${label} — from=${data?.remoteJid || '?'} fromMe=${data?.fromMe} instance=${instance}`);
      } else if (normalizedEvent === 'SEND_MESSAGE') {
        // Écho des messages sortants — log discret
        console.log(`📤 [WH] Message sortant confirmé — to=${data?.key?.remoteJid || '?'} type=${data?.messageType || '?'} instance=${instance}`);
      } else if (normalizedEvent === 'CONNECTION_UPDATE') {
        console.log(`🔌 [WH] Connexion mise à jour — instance: ${instance}, état: ${JSON.stringify(data?.state)}`);
      } else {
        console.log(`ℹ️ [WH INCOMING] Événement non traité: ${event}`);
      }
      console.log(`📩 ═══════════════════════════════════════════════════\n`);
    } catch (err) {
      console.error('❌ [WH INCOMING] Erreur traitement:', err.message);
      console.error(err.stack);
    }
  });
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/usage
 * @desc    Consulter la consommation de messages d'une instance
 * @access  Public (Sécurisé par userId)
 */
router.get('/instances/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, error: "userId est requis" });
    }

    const instance = await WhatsAppInstance.findOne({ _id: id, userId });
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance introuvable ou non autorisée" });
    }

    const usage = await getInstanceUsage(id);

    res.status(200).json({
      success: true,
      instanceName: instance.customName || instance.instanceName,
      usage
    });
  } catch (error) {
    console.error('❌ Erreur récupération usage:', error.message);
    res.status(500).json({ success: false, error: "Erreur lors de la récupération des statistiques" });
  }
});

/**
 * @route   PATCH /api/ecom/v1/external/whatsapp/instances/:id/plan
 * @desc    Active un plan (free/pro/plus) pour une instance et applique les quotas associés
 * @access  Private (ecom_admin / super_admin)
 */
router.patch('/instances/:id/plan', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const role = req.ecomUser?.role;
    if (!['ecom_admin', 'super_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Action non autorisée' });
    }

    const { plan } = req.body || {};
    const normalizedPlan = normalizeInstancePlan(plan);
    if (!INSTANCE_PLAN_LIMITS[normalizedPlan]) {
      return res.status(400).json({ success: false, error: 'Plan invalide. Utilisez free, pro ou plus.' });
    }

    const instance = await WhatsAppInstance.findOne({ _id: req.params.id, userId, isActive: true });
    if (!instance) {
      return res.status(404).json({ success: false, error: 'Instance introuvable ou non autorisée' });
    }

    const limits = INSTANCE_PLAN_LIMITS[normalizedPlan];
    instance.plan = normalizedPlan;
    instance.dailyLimit = limits.daily;
    instance.monthlyLimit = limits.monthly;

    const limitExceeded = (instance.messagesSentToday || 0) >= limits.daily || (instance.messagesSentThisMonth || 0) >= limits.monthly;
    instance.limitExceeded = limitExceeded;
    instance.limitExceededAt = limitExceeded ? (instance.limitExceededAt || new Date()) : null;

    await instance.save();

    res.status(200).json({
      success: true,
      message: `Plan ${normalizedPlan.toUpperCase()} activé`,
      stats: {
        plan: normalizedPlan,
        messagesSentToday: instance.messagesSentToday || 0,
        messagesSentThisMonth: instance.messagesSentThisMonth || 0,
        dailyLimit: limits.daily,
        monthlyLimit: limits.monthly,
        limitExceeded: instance.limitExceeded || false,
      },
    });
  } catch (error) {
    console.error('❌ Erreur changement plan instance:', error.message);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/test-boss-notification
 * @desc    Envoyer un message de test au numéro WhatsApp du boss
 */
router.post('/test-boss-notification', async (req, res) => {
  try {
    const { userId, bossPhone } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const phone = (bossPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 8) {
      return res.status(400).json({ success: false, error: 'Numéro WhatsApp invalide' });
    }

    const instance = await WhatsAppInstance.findOne({
      userId,
      isActive: true,
      status: { $in: ['connected', 'active'] }
    }).lean();

    if (!instance) {
      return res.status(400).json({ success: false, error: "Aucune instance WhatsApp connectée. Connectez d'abord une instance." });
    }

    const testMsg = `✅ *Test Rita — Notifications Boss*\n\nBonjour ! 👋 Ce message confirme que les notifications Rita sont bien configurées.\n\n📱 Instance: *${instance.instanceName}*\n⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })}\n\n🔔 Vous recevrez désormais les alertes pour:\n• 📦 Chaque commande confirmée\n• 📊 Le rapport quotidien\n\n_Généré par Rita IA_`;

    await sendMessageAndTrack(
      instance.instanceName,
      instance.instanceToken,
      phone,
      testMsg
    );

    console.log(`✅ [RITA] Test notification boss envoyé à ${phone} (userId=${userId})`);
    res.status(200).json({ success: true, message: `Message de test envoyé au ${phone}` });
  } catch (error) {
    console.error('❌ Erreur test notification boss:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/rita-config
 * @desc    Sauvegarder la configuration Rita IA (supporte userId et agentId)
 */
router.post('/rita-config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { config, agentId, userId: bodyUserId } = req.body;

    // Utiliser agentId s'il est fourni, sinon userId
    let queryKey, queryValue;

    if (agentId) {
      queryKey = 'agentId';
      queryValue = agentId;
    } else {
      queryKey = 'userId';
      queryValue = bodyUserId || (await resolveRitaTargetUserId(req));
    }

    if (!queryValue || !config) {
      return res.status(400).json({ success: false, error: `${queryKey} et config requis` });
    }

    // Retirer les champs Mongoose pour éviter un conflit _id lors de l'upsert
    const { _id, __v, createdAt, updatedAt, userId: _u, agentId: _a, ...cleanConfig } = config;

    // Nettoyer les _id des sous-documents (productCatalog, quantityOffers, etc.)
    // Mongoose génère des _id auto sur les sous-documents et ça crée des conflits à l'upsert
    if (Array.isArray(cleanConfig.productCatalog)) {
      cleanConfig.productCatalog = cleanConfig.productCatalog.map(p => {
        const { _id: _pid, ...cleanProduct } = p;
        if (Array.isArray(cleanProduct.quantityOffers)) {
          cleanProduct.quantityOffers = cleanProduct.quantityOffers.map(o => {
            const { _id: _oid, ...cleanOffer } = o;
            return cleanOffer;
          });
        }
        return cleanProduct;
      });
    }
    if (Array.isArray(cleanConfig.testimonials)) {
      cleanConfig.testimonials = cleanConfig.testimonials.map(t => {
        const { _id: _tid, ...cleanT } = t;
        return cleanT;
      });
    }
    if (Array.isArray(cleanConfig.firstMessageRules)) {
      cleanConfig.firstMessageRules = cleanConfig.firstMessageRules.map(r => {
        const { _id: _rid, ...cleanR } = r;
        return cleanR;
      });
    }

    const updated = await RitaConfig.findOneAndUpdate(
      { [queryKey]: queryValue },
      { [queryKey]: queryValue, ...cleanConfig },
      { upsert: true, new: true, runValidators: false }
    );

    res.status(200).json({ success: true, config: updated });
  } catch (error) {
    console.error('❌ Erreur sauvegarde rita-config:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-config/:agentId
 * @desc    Charger la configuration Rita IA d'un agent spécifique
 */
router.get('/rita-config/:agentId', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!agentId) return res.status(400).json({ success: false, error: 'agentId requis' });

    const config = await RitaConfig.findOne({ agentId }).lean();
    res.status(200).json({ success: true, config: config || null });
  } catch (error) {
    console.error('❌ Erreur chargement rita-config agent:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-config
 * @desc    Charger la configuration Rita IA d'un utilisateur
 */
router.get('/rita-config', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveRitaTargetUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const config = await RitaConfig.findOne({ userId }).lean();
    res.status(200).json({ success: true, config: config || null });
  } catch (error) {
    console.error('❌ Erreur chargement rita-config:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-activity
 * @desc    Récupérer l'activité Rita pour le dashboard (aujourd'hui + stats)
 */
router.get('/rita-activity', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { days } = req.query;
    const userId = await resolveRitaTargetUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const RitaActivity = (await import('../models/RitaActivity.js')).default;
    const daysBack = parseInt(days) || 1;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    since.setHours(0, 0, 0, 0);

    const activities = await RitaActivity.find({ userId, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Compute stats
    const stats = {
      messagesReceived: activities.filter(a => a.type === 'message_received').length,
      messagesReplied: activities.filter(a => a.type === 'message_replied').length,
      ordersConfirmed: activities.filter(a => a.type === 'order_confirmed').length,
      vocalsTranscribed: activities.filter(a => a.type === 'vocal_transcribed').length,
      vocalsSent: activities.filter(a => a.type === 'vocal_sent').length,
      imagesSent: activities.filter(a => a.type === 'image_sent').length,
      uniqueClients: new Set(activities.filter(a => a.customerPhone).map(a => a.customerPhone)).size,
    };

    // Recent activities (last 50 for timeline)
    const recent = activities.slice(0, 50).map(a => ({
      type: a.type,
      customerPhone: a.customerPhone,
      customerName: a.customerName,
      product: a.product,
      price: a.price,
      details: a.details,
      date: a.createdAt,
    }));

    res.status(200).json({ success: true, stats, recent, total: activities.length });
  } catch (error) {
    console.error('❌ Erreur chargement rita-activity:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-contacts
 * @desc    Liste tous les contacts Rita enregistrés automatiquement
 */
router.get('/rita-contacts', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const { page, limit: lim } = req.query;
    const userId = await resolveRitaTargetUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(lim) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [contacts, total] = await Promise.all([
      RitaContact.find({ userId })
        .sort({ clientNumber: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      RitaContact.countDocuments({ userId }),
    ]);

    res.status(200).json({
      success: true,
      contacts: contacts.map(c => ({
        clientNumber: c.clientNumber,
        phone: c.phone,
        pushName: c.pushName,
        nom: c.nom,
        ville: c.ville,
        adresse: c.adresse,
        messageCount: c.messageCount,
        hasOrdered: c.hasOrdered,
        firstMessageAt: c.firstMessageAt,
        lastMessageAt: c.lastMessageAt,
        notes: c.notes,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('❌ Erreur chargement rita-contacts:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/rita-contacts/export
 * @desc    Exporte tous les contacts Rita en CSV
 */
router.get('/rita-contacts/export', requireEcomAuth, requireRitaAgentAccess, async (req, res) => {
  try {
    const userId = await resolveRitaTargetUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'userId requis' });

    const contacts = await RitaContact.find({ userId }).sort({ clientNumber: 1 }).lean();

    const header = ['N°', 'Téléphone', 'Nom', 'Ville', 'Adresse', 'Nb Messages', 'A commandé', 'Premier contact', 'Dernier contact', 'Notes'];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = contacts.map(c => [
      c.clientNumber,
      c.phone,
      c.nom || c.pushName || '',
      c.ville || '',
      c.adresse || '',
      c.messageCount,
      c.hasOrdered ? 'Oui' : 'Non',
      c.firstMessageAt ? new Date(c.firstMessageAt).toLocaleString('fr-FR') : '',
      c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString('fr-FR') : '',
      c.notes || '',
    ].map(escape).join(','));

    const csv = '\uFEFF' + [header.map(escape).join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rita-contacts.csv"');
    res.send(csv);
  } catch (error) {
    console.error('❌ Erreur export rita-contacts CSV:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/preview-voice
 * @desc    Génère un court échantillon audio ElevenLabs pour prévisualiser une voix
 */
router.get('/preview-voice', async (req, res) => {
  try {
    const { voiceId, voiceStylePreset } = req.query;
    if (!voiceId) return res.status(400).json({ success: false, error: 'voiceId requis' });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'Clé ElevenLabs non configurée' });

    const sampleText = 'Bonjour ! Je suis Rita, votre assistante commerciale. Comment puis-je vous aider aujourd\'hui ?';
    const voiceSettings = getTtsVoiceSettings({ voiceStylePreset });

    const response = await (await import('axios')).default.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { text: sampleText, model_id: 'eleven_turbo_v2_5', voice_settings: voiceSettings },
      { headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, responseType: 'arraybuffer', timeout: 20000 }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');
    res.json({ success: true, audio: audioBase64 });
  } catch (error) {
    console.error('❌ Erreur preview-voice:', error.response?.data ? Buffer.from(error.response.data).toString('utf8') : error.message);
    res.status(500).json({ success: false, error: 'Génération audio échouée' });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/preview-voice-fish
 * @desc    Génère un court échantillon audio Fish.audio pour prévisualiser une voix
 */
router.get('/preview-voice-fish', async (req, res) => {
  try {
    const { referenceId, model } = req.query;
    const apiKey = FISH_AUDIO_DIRECT_API_KEY;
    if (!apiKey) return res.status(500).json({ success: false, error: 'Clé Fish.audio non configurée' });

    const sampleText = 'Bonjour ! Je suis Rita, votre assistante commerciale. Comment puis-je vous aider aujourd\'hui ?';
    const refId = referenceId || '13f7f6e260f94079b9d51c961fa6c9e2';
    const fishModel = model || 's2-pro';

    const response = await (await import('axios')).default.post(
      'https://api.fish.audio/v1/tts',
      { text: sampleText, reference_id: refId, format: 'mp3' },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'model': fishModel,
        },
        responseType: 'arraybuffer',
        timeout: 20000,
      }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');
    res.json({ success: true, audio: audioBase64 });
  } catch (error) {
    console.error('❌ Erreur preview-voice-fish:', error.response?.data ? Buffer.from(error.response.data).toString('utf8') : error.message);
    res.status(500).json({ success: false, error: 'Génération audio Fish.audio échouée' });
  }
});

/**
 * @route   POST /api/ecom/v1/external/whatsapp/test-chat
 * @desc    Envoie un message au simulateur Rita et retourne la réponse IA (Groq)
 */
router.post('/test-chat', async (req, res) => {
  try {
    const { userId, messages } = req.body;
    if (!userId || !messages) return res.status(400).json({ success: false, error: 'userId et messages requis' });

    const config = await RitaConfig.findOne({ userId }).lean();
    if (!config) return res.status(404).json({ success: false, error: 'Configuration Rita introuvable. Enregistrez d\'abord.' });

    const reply = await generateTestReply(config, messages);
    res.status(200).json({ success: true, reply });
  } catch (error) {
    console.error('❌ Erreur test-chat:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// COMMANDES WHATSAPP (Orders)
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/ecom/v1/external/whatsapp/orders
 * @desc    Liste les commandes WhatsApp d'un utilisateur
 */
router.get('/orders', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const { status, product } = req.query;
    const filter = { userId };

    const statusVariants = resolveStatusVariants(status);
    if (Array.isArray(statusVariants) && statusVariants.length > 0) {
      filter.status = statusVariants.length === 1 ? statusVariants[0] : { $in: statusVariants };
    }

    let orders = await WhatsAppOrder.find(filter).sort({ createdAt: -1 }).limit(200).lean();

    const productQuery = normalizeFilterValue(product);
    if (productQuery) {
      orders = orders.filter(order => normalizeFilterValue(order.productName).includes(productQuery));
    }

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   PATCH /api/ecom/v1/external/whatsapp/orders/:id
 * @desc    Mettre à jour le statut d'une commande (accepter, refuser, etc.)
 */
router.patch('/orders/:id', requireEcomAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    const userId = req.ecomUser._id.toString();
    const { status, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;

    const order = await WhatsAppOrder.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: update },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Commande introuvable' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/orders/stats
 * @desc    Stats rapides des commandes
 */
router.get('/orders/stats', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const [pending, accepted, refused, total] = await Promise.all([
      WhatsAppOrder.countDocuments({ userId, status: 'pending' }),
      WhatsAppOrder.countDocuments({ userId, status: 'accepted' }),
      WhatsAppOrder.countDocuments({ userId, status: 'refused' }),
      WhatsAppOrder.countDocuments({ userId }),
    ]);
    res.json({ success: true, stats: { pending, accepted, refused, total } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Création directe d'instance via Scalot (sans passer par ZenChat)
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/ecom/v1/external/whatsapp/create-instance
 * @desc    Crée une instance WhatsApp directement depuis Scalot via Evolution Master API Key
 */
router.post('/create-instance', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const workspaceId = req.workspaceId;
    const { customName } = req.body;

    // Générer un nom d'instance unique basé sur le userId
    const slug = (customName || 'scalot').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20).toLowerCase();
    const instanceName = `${slug}_${userId.slice(-6)}_${Date.now().toString(36)}`;

    console.log(`🚀 [CREATE] Création instance "${instanceName}" pour user ${userId}`);

    // 1. Créer l'instance sur Evolution API
    const result = await evolutionApiService.createInstance(instanceName);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || "Impossible de créer l'instance sur Evolution API" });
    }

    // Extraire le token de l'instance créée
    const instanceToken = result.data?.hash || result.data?.instance?.apikey || result.data?.apikey || result.data?.token;
    if (!instanceToken) {
      console.error('❌ [CREATE] Pas de token dans la réponse:', JSON.stringify(result.data));
      return res.status(500).json({ success: false, error: "Instance créée mais pas de token retourné" });
    }

    // 2. Sauvegarder en base de données
    const instance = await WhatsAppInstance.create({
      userId,
      workspaceId,
      instanceName,
      instanceToken,
      customName: customName || instanceName,
      status: 'disconnected',
      isActive: true,
      plan: 'free',
    });

    console.log(`✅ [CREATE] Instance "${instanceName}" créée et sauvegardée (ID: ${instance._id})`);

    // 3. Récupérer le QR code immédiatement
    const qrResult = await evolutionApiService.getQrCode(instanceName, instanceToken);

    res.status(201).json({
      success: true,
      message: 'Instance créée avec succès',
      data: {
        id: instance._id,
        instanceName,
        customName: instance.customName,
        instanceToken,
        status: 'disconnected',
      },
      qrcode: qrResult.success ? qrResult.qrcode : null,
      pairingCode: qrResult.success ? qrResult.pairingCode : null,
    });
  } catch (error) {
    console.error('❌ [CREATE] Erreur création instance:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/qrcode
 * @desc    Récupère le QR code pour connecter l'instance WhatsApp
 */
router.get('/instances/:id/qrcode', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const instance = await WhatsAppInstance.findOne({ _id: req.params.id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable' });
    const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.refresh || '').toLowerCase());

    // Vérifier si déjà connectée
    const statusResult = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
    if (statusResult?.instance?.state === 'open') {
      instance.status = 'connected';
      instance.lastSeen = new Date();
      await instance.save();
      return res.json({ success: true, connected: true, status: 'connected', message: 'Déjà connectée' });
    }

    // Récupérer le QR code
    const qrResult = await evolutionApiService.getQrCode(instance.instanceName, instance.instanceToken, forceRefresh);
    if (!qrResult.success) {
      return res.status(400).json({ success: false, error: qrResult.error || 'Impossible de récupérer le QR code' });
    }

    res.json({
      success: true,
      connected: false,
      qrcode: qrResult.qrcode,
      pairingCode: qrResult.pairingCode,
    });
  } catch (error) {
    console.error('❌ Erreur récupération QR code:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/connection-status
 * @desc    Vérifie le statut de connexion en temps réel (polling pendant scan QR)
 */
router.get('/instances/:id/connection-status', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const instance = await WhatsAppInstance.findOne({ _id: req.params.id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable' });

    const statusResult = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
    const state = statusResult?.instance?.state;
    let status = instance.status;

    if (state === 'open') {
      status = 'connected';
      instance.status = 'connected';
      instance.lastSeen = new Date();
      await instance.save();
    } else if (state === 'close' || state === 'connecting') {
      status = 'disconnected';
    }

    res.json({ success: true, status, state: state || 'unknown' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/instances/:id/message-stats
 * @desc    Récupère les statistiques détaillées de messages pour une instance
 */
router.get('/instances/:id/message-stats', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const instance = await WhatsAppInstance.findOne({ _id: req.params.id, userId });
    if (!instance) return res.status(404).json({ success: false, error: 'Instance introuvable' });

    const usage = await getInstanceUsage(instance._id);
    const limits = resolveInstanceLimits(instance);

    // Récupérer le statut Evolution API
    const statusResult = await evolutionApiService.getInstanceStatus(instance.instanceName, instance.instanceToken);
    const state = statusResult?.instance?.state || 'unknown';

    res.json({
      success: true,
      instanceName: instance.customName || instance.instanceName,
      status: instance.status,
      connectionState: state,
      usage,
      stats: {
        messagesSentToday: instance.messagesSentToday || 0,
        messagesSentThisMonth: instance.messagesSentThisMonth || 0,
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit,
        plan: limits.normalizedPlan,
        limitExceeded: instance.limitExceeded || false,
        lastSeen: instance.lastSeen,
        createdAt: instance.createdAt,
      },
    });
  } catch (error) {
    console.error('❌ Erreur message-stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route   GET /api/ecom/v1/external/whatsapp/dashboard-stats
 * @desc    Stats globales de toutes les instances (résumé dashboard)
 */
router.get('/dashboard-stats', requireEcomAuth, async (req, res) => {
  try {
    const userId = req.ecomUser._id.toString();
    const allInstances = await WhatsAppInstance.find({ userId, isActive: true });

    let totalSentToday = 0;
    let totalSentMonth = 0;
    let totalDailyLimit = 0;
    let totalMonthlyLimit = 0;
    let connected = 0;
    let disconnected = 0;

    for (const inst of allInstances) {
      const limits = resolveInstanceLimits(inst);
      totalSentToday += inst.messagesSentToday || 0;
      totalSentMonth += inst.messagesSentThisMonth || 0;
      totalDailyLimit += limits.dailyLimit;
      totalMonthlyLimit += limits.monthlyLimit;
      if (inst.status === 'connected' || inst.status === 'active') connected++;
      else disconnected++;
    }

    res.json({
      success: true,
      stats: {
        totalInstances: allInstances.length,
        connected,
        disconnected,
        totalSentToday,
        totalSentMonth,
        totalDailyLimit,
        totalMonthlyLimit,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
