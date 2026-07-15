// ─────────────────────────────────────────────────────────────────────────────
//  Routes Telegram — connexion d'un bot + réception des messages (webhook).
//    POST /api/ecom/telegram/connect      { botToken }  (auth) → valide + webhook
//    GET  /api/ecom/telegram/status                     (auth) → statut
//    POST /api/ecom/telegram/disconnect                 (auth) → déconnecte
//    POST /api/ecom/telegram/webhook/:workspaceId       (PUBLIC) → updates Telegram
//
//  Les messages entrants sont routés vers Rita IA (processIncomingMessage),
//  exactement comme WhatsApp, et la réponse repart via sendMessage.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import crypto from 'crypto';
import { requireEcomAuth } from '../middleware/ecomAuth.js';
import TelegramBot from '../models/TelegramBot.js';
import { getMe, setWebhook, deleteWebhook, sendTelegramMessage, sendTyping } from '../services/telegramService.js';
import { processIncomingMessage } from '../services/ritaAgentService.js';

const router = express.Router();

const publicBase = () =>
  String(process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_URL || '').replace(/\/+$/, '');

// ─── Connexion : valide le token, enregistre le webhook, persiste ─────────────
router.post('/connect', requireEcomAuth, async (req, res) => {
  try {
    const botToken = String(req.body?.botToken || '').trim();
    if (!/^\d+:[\w-]{30,}$/.test(botToken)) {
      return res.status(400).json({ success: false, message: 'Bot token Telegram invalide (format 123456:ABC...).' });
    }
    const base = publicBase();
    if (!/^https:\/\//i.test(base)) {
      return res.status(400).json({ success: false, message: 'URL publique HTTPS manquante (PUBLIC_BACKEND_URL) — requise par Telegram.' });
    }

    // 1. Valider le token
    const me = await getMe(botToken);

    // 2. Enregistrer le webhook (secret aléatoire pour authentifier les updates)
    const webhookSecret = crypto.randomBytes(24).toString('hex');
    const webhookUrl = `${base}/api/ecom/telegram/webhook/${req.workspaceId}`;
    await setWebhook(botToken, webhookUrl, webhookSecret);

    // 3. Persister (un bot par workspace)
    const bot = await TelegramBot.findOneAndUpdate(
      { workspaceId: req.workspaceId },
      {
        $set: {
          userId: String(req.ecomUser?._id || req.user?.id || ''),
          botToken, botId: me.id, botUsername: me.username, botFirstName: me.firstName,
          webhookSecret, isConnected: true, lastError: null, connectedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return res.json({
      success: true,
      bot: { username: bot.botUsername, firstName: bot.botFirstName, isConnected: true, connectedAt: bot.connectedAt },
    });
  } catch (err) {
    const msg = err?.response?.data?.description || err.message || 'Échec de connexion Telegram';
    console.error('[Telegram] connect error:', msg);
    return res.status(502).json({ success: false, message: msg });
  }
});

// ─── Statut ───────────────────────────────────────────────────────────────────
router.get('/status', requireEcomAuth, async (req, res) => {
  try {
    const bot = await TelegramBot.findOne({ workspaceId: req.workspaceId })
      .select('botUsername botFirstName isConnected connectedAt lastError').lean();
    return res.json({ success: true, bot: bot || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Déconnexion ──────────────────────────────────────────────────────────────
router.post('/disconnect', requireEcomAuth, async (req, res) => {
  try {
    const bot = await TelegramBot.findOne({ workspaceId: req.workspaceId });
    if (bot?.botToken) await deleteWebhook(bot.botToken);
    if (bot) { bot.isConnected = false; await bot.save(); }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Webhook public : updates Telegram → Rita IA → réponse ────────────────────
router.post('/webhook/:workspaceId', async (req, res) => {
  // Répondre 200 tout de suite (Telegram réessaie sinon) puis traiter en async.
  res.sendStatus(200);
  try {
    const update = req.body || {};
    const msg = update.message;
    const text = String(msg?.text || '').trim();
    const chatId = msg?.chat?.id;
    if (!text || !chatId) return;

    const bot = await TelegramBot.findOne({ workspaceId: req.params.workspaceId, isConnected: true }).lean();
    if (!bot) return;

    // Authenticité : le secret Telegram doit correspondre.
    const secret = req.get('x-telegram-bot-api-secret-token');
    if (bot.webhookSecret && secret !== bot.webhookSecret) {
      console.warn('[Telegram] webhook secret mismatch — ignoré');
      return;
    }

    await sendTyping(bot.botToken, chatId);

    const pushName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || 'Client';
    const reply = await processIncomingMessage(bot.userId, `tg:${chatId}`, text, {
      agentId: bot.agentId,
      pushName,
      channel: 'telegram',
    });

    if (reply) await sendTelegramMessage(bot.botToken, chatId, reply);
  } catch (err) {
    console.error('[Telegram] webhook error:', err.message);
  }
});

export default router;
