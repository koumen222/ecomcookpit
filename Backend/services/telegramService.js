// ─────────────────────────────────────────────────────────────────────────────
//  telegramService — appels à l'API Bot Telegram (https://core.telegram.org/bots/api)
//
//  Un bot = un token (via @BotFather). Toutes les méthodes sont appelées sur
//  https://api.telegram.org/bot<token>/<method>. On expose :
//    - getMe        : valider le token + récupérer l'identité du bot
//    - setWebhook   : enregistrer notre endpoint public + un secret
//    - deleteWebhook: déconnecter
//    - sendMessage  : répondre à un chat
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

const api = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

/** Valide le token et renvoie l'identité du bot, ou lève une erreur claire. */
export async function getMe(token) {
  const res = await axios.get(api(token, 'getMe'), { timeout: 15000 });
  if (!res.data?.ok || !res.data?.result) throw new Error('Token Telegram invalide');
  const b = res.data.result;
  return { id: String(b.id), username: b.username || '', firstName: b.first_name || '' };
}

/**
 * Enregistre le webhook Telegram. `secret` est renvoyé par Telegram dans
 * l'en-tête X-Telegram-Bot-Api-Secret-Token à chaque update → on l'utilise
 * pour vérifier l'authenticité côté endpoint.
 */
export async function setWebhook(token, url, secret) {
  const res = await axios.post(api(token, 'setWebhook'), {
    url,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  }, { timeout: 15000 });
  if (!res.data?.ok) throw new Error(res.data?.description || 'Échec setWebhook Telegram');
  return true;
}

/** Supprime le webhook (déconnexion). Best-effort. */
export async function deleteWebhook(token) {
  try {
    await axios.post(api(token, 'deleteWebhook'), { drop_pending_updates: false }, { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/** Envoie un message texte à un chat. */
export async function sendTelegramMessage(token, chatId, text) {
  const clean = String(text || '').slice(0, 4096); // limite Telegram
  if (!clean.trim()) return null;
  const res = await axios.post(api(token, 'sendMessage'), {
    chat_id: chatId,
    text: clean,
    disable_web_page_preview: true,
  }, { timeout: 20000 });
  return res.data?.result || null;
}

/** Indique "en train d'écrire…" (feedback pendant que Rita réfléchit). Best-effort. */
export async function sendTyping(token, chatId) {
  try {
    await axios.post(api(token, 'sendChatAction'), { chat_id: chatId, action: 'typing' }, { timeout: 8000 });
  } catch { /* non bloquant */ }
}
