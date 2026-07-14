import axios from 'axios';

/**
 * Service central DeepSeek — TOUTE la génération de texte de la plateforme
 * passe par ici (décision produit : texte = DeepSeek uniquement).
 *
 * Interface volontairement identique aux helpers KIE historiques :
 * retourne { content, usage, raw }.
 *
 * Limites : DeepSeek ne prend pas d'images en entrée — les appels vision
 * doivent rester sur leur provider (voir hasImageContent pour router).
 */

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
const DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS) || 300000;

export function isDeepseekConfigured() {
  return !!DEEPSEEK_API_KEY;
}

// Détecte des contenus image (format OpenAI ou KIE) dans les messages
export function hasImageContent(messages = []) {
  return (messages || []).some((m) => Array.isArray(m?.content)
    && m.content.some((c) => c?.type === 'image_url' || c?.type === 'input_image'));
}

// Aplatit les contenus structurés en texte simple (DeepSeek attend des strings)
function toDeepseekMessages(messages = []) {
  return (messages || []).map((m) => {
    const role = ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user';
    let content = m?.content;
    if (Array.isArray(content)) {
      content = content
        .map((c) => (typeof c === 'string' ? c : c?.text || ''))
        .filter(Boolean)
        .join('\n');
    }
    return { role, content: String(content ?? '') };
  });
}

/**
 * Appel chat completions DeepSeek.
 * @param {object} opts { messages, temperature, maxTokens, responseFormat, timeoutMs }
 * @returns {Promise<{content: string, usage: object|null, raw: object}>}
 */
export async function callDeepseekChat({
  messages,
  temperature = 0.4,
  maxTokens = 4096,
  responseFormat,
  timeoutMs,
} = {}) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY non configurée');
  if (hasImageContent(messages)) {
    throw new Error('DeepSeek ne supporte pas les images en entrée — utiliser le provider vision');
  }

  const payload = {
    model: DEEPSEEK_MODEL,
    messages: toDeepseekMessages(messages),
    stream: false,
    temperature,
    max_tokens: maxTokens,
    // v4-pro pense par défaut (reasoning_content) et peut épuiser le budget de
    // tokens AVANT d'écrire la réponse finale → content vide. On désactive la
    // réflexion : nos usages sont des sorties directes (JSON, copywriting).
    thinking: { type: process.env.DEEPSEEK_THINKING === 'enabled' ? 'enabled' : 'disabled' },
  };
  if (responseFormat) payload.response_format = responseFormat;

  const doPost = (body) => axios.post(DEEPSEEK_URL, body, {
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: timeoutMs || DEEPSEEK_TIMEOUT_MS,
  });

  let response;
  try {
    response = await doPost(payload);
  } catch (err) {
    // Si l'API refuse le paramètre thinking (400), on réessaie sans
    const apiMsg = err?.response?.data?.error?.message || '';
    if (err?.response?.status === 400 && /thinking/i.test(apiMsg)) {
      const { thinking, ...withoutThinking } = payload;
      response = await doPost(withoutThinking);
    } else {
      throw err;
    }
  }

  const choice = response.data?.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) {
    const finishReason = choice?.finish_reason || 'inconnu';
    const hadReasoning = Boolean(choice?.message?.reasoning_content);
    console.error(`[DeepSeek] Réponse vide (finish_reason=${finishReason}, reasoning=${hadReasoning}):`, JSON.stringify(response.data || {}, null, 2).slice(0, 800));
    throw new Error(`Réponse DeepSeek vide (finish_reason=${finishReason}${hadReasoning ? ', budget consommé par la réflexion' : ''})`);
  }

  return { content: text, usage: response.data?.usage || null, raw: response.data };
}

/**
 * Adaptateur drop-in compatible SDK OpenAI/Groq :
 *   const ai = deepseekClient; await ai.chat.completions.create({ messages, ... })
 * Le paramètre `model` est ignoré (DEEPSEEK_MODEL fait foi), la réponse brute
 * DeepSeek est déjà au format chat-completions (choices[0].message.content).
 */
export const deepseekClient = {
  chat: {
    completions: {
      create: async ({ messages, temperature, max_tokens, response_format } = {}) => {
        const { raw } = await callDeepseekChat({
          messages,
          temperature: temperature ?? 0.4,
          maxTokens: max_tokens ?? 4096,
          responseFormat: response_format,
        });
        return raw;
      },
    },
  },
};

/**
 * Variante minimaliste : prompt simple → texte.
 */
export async function deepseekComplete(prompt, { system, temperature = 0.4, maxTokens = 4096, responseFormat, timeoutMs } = {}) {
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: String(prompt) },
  ];
  const { content } = await callDeepseekChat({ messages, temperature, maxTokens, responseFormat, timeoutMs });
  return content;
}
