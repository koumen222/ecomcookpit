import Groq from 'groq-sdk';
import { isDeepseekConfigured, callDeepseekChat, hasImageContent } from './deepseekChatService.js';
import { isKieConfigured, callKieResponses, callKieGemini } from './kieTransport.js';

/**
 * Cascade texte de la plateforme — point d'entrée UNIQUE.
 *
 *   DeepSeek (primaire)  →  Groq (secours)  →  KIE (dernier recours)
 *
 * Règle de bascule : on ne passe au provider suivant que sur erreur
 * TRANSITOIRE (timeout, 429, 5xx, réseau, réponse vide, clé absente).
 * Une erreur déterministe — requête malformée — échouerait à l'identique
 * chez le suivant : on la remonte tout de suite au lieu de tripler la latence.
 * Override d'urgence : AI_FALLBACK_ON_ALL_ERRORS=true.
 *
 * Rien ne court-circuite plus la cascade. Une image en entrée — que ni DeepSeek
 * ni Groq n'acceptent — est d'abord DÉCRITE par KIE, puis la rédaction repart
 * normalement en tête de cascade sur le texte obtenu. Le function calling reste
 * lui aussi dans la cascade : DeepSeek l'accepte au format OpenAI, Groq est
 * simplement retiré de la chaîne car ce service ne lui transmet pas `tools`.
 * Conséquence : tout texte publié par la plateforme est écrit par DeepSeek tant
 * que DEEPSEEK_API_KEY répond. KIE ne rédige plus — il regarde.
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_ON_ALL_ERRORS = String(process.env.AI_FALLBACK_ON_ALL_ERRORS || '').toLowerCase() === 'true';
// Tête de cascade forçable sans redéploiement : AI_TEXT_PRIMARY=groq|kie|deepseek
const TEXT_PRIMARY = String(process.env.AI_TEXT_PRIMARY || 'deepseek').trim().toLowerCase();

// Statuts où réessayer ailleurs est inutile : la requête elle-même est en cause.
const DETERMINISTIC_STATUSES = new Set([400, 413, 422]);

let _groq = null;
function getGroq() {
  if (!GROQ_API_KEY) return null;
  if (!_groq) _groq = new Groq({ apiKey: GROQ_API_KEY });
  return _groq;
}

export function isGroqConfigured() {
  return !!GROQ_API_KEY;
}

/**
 * Au moins un provider texte est disponible.
 * À utiliser à la place de isKieConfigured() dans toutes les gardes texte :
 * gater le texte sur la présence de KIE_API_KEY cassait la plateforme dès
 * qu'on retirait la clé KIE, alors même que DeepSeek était configuré.
 */
export function isTextProviderConfigured() {
  return isDeepseekConfigured() || isGroqConfigured() || isKieConfigured();
}

export function isTransientAiError(err) {
  if (FALLBACK_ON_ALL_ERRORS) return true;
  if (!err) return true;
  const status = err?.response?.status ?? err?.status;
  if (DETERMINISTIC_STATUSES.has(Number(status))) return false;
  return true;
}

async function callGroqChat({ messages, temperature = 0.4, maxTokens = 4096, responseFormat, models }) {
  const client = getGroq();
  if (!client) throw new Error('GROQ_API_KEY non configurée');

  // Groq attend des contenus string : on aplatit les contenus structurés.
  const flat = (messages || []).map((m) => {
    const role = ['system', 'user', 'assistant'].includes(m?.role) ? m.role : 'user';
    let content = m?.content;
    if (Array.isArray(content)) {
      content = content.map((c) => (typeof c === 'string' ? c : c?.text || '')).filter(Boolean).join('\n');
    }
    return { role, content: String(content ?? '') };
  });

  const candidates = Array.isArray(models) && models.length > 0
    ? models
    : [{ model: GROQ_MODEL }];

  let lastError = null;
  for (const cfg of candidates) {
    try {
      const params = {
        model: cfg.model,
        messages: flat,
        temperature,
        max_completion_tokens: maxTokens,
      };
      if (cfg.reasoning_effort) params.reasoning_effort = cfg.reasoning_effort;
      if (responseFormat) params.response_format = responseFormat;

      const completion = await client.chat.completions.create(params);
      const choice = completion?.choices?.[0];
      let content = choice?.message?.content?.trim() || '';

      // Certains modèles Groq renvoient la réponse dans `reasoning` après </think>
      if (!content && choice?.message?.reasoning) {
        const reasoning = choice.message.reasoning;
        const thinkEnd = reasoning.lastIndexOf('</think>');
        if (thinkEnd !== -1) content = reasoning.substring(thinkEnd + 8).trim();
      }

      if (content) {
        return { content, usage: completion?.usage || null, raw: completion, modelUsed: cfg.model };
      }
      lastError = new Error(`Groq ${cfg.model} a retourné une réponse vide`);
    } catch (error) {
      lastError = error;
      // Une requête malformée échouera sur tous les modèles Groq : on sort.
      if (!isTransientAiError(error)) throw error;
    }
  }
  throw lastError || new Error('Réponse Groq vide');
}

// ─── Pont vision → texte ─────────────────────────────────────────────────────
// Ni DeepSeek ni Groq n'acceptent une image en entrée. Envoyer toute la
// rédaction chez KIE dès qu'une photo est jointe sortait de la cascade la
// génération la plus lourde de la plateforme : la page produit part TOUJOURS
// avec ses photos. Le partage se fait donc sur la nature de la tâche —
// KIE REGARDE et décrit, la cascade ÉCRIT à partir de cette description.
const VISION_SYSTEM = "Tu es un observateur. Décris uniquement ce que montrent les images : produit, packaging, couleurs, matière, format, texte lisible sur l'emballage, décor, personnes présentes. Aucune interprétation commerciale, aucune promesse, aucun adjectif vendeur — un constat. 12 lignes maximum.";

function collectImageUrls(messages = []) {
  const urls = [];
  for (const message of messages || []) {
    if (!Array.isArray(message?.content)) continue;
    for (const part of message.content) {
      if (part?.type === 'image_url') urls.push(part.image_url?.url || part.image_url || '');
      else if (part?.type === 'input_image') urls.push(part.image_url || '');
    }
  }
  return urls.filter(Boolean);
}

// Aplatit en texte pur et greffe la description sur le dernier message
// utilisateur — là où le prompt attend le produit.
function flattenMessages(messages = [], description = '') {
  const flat = (messages || []).map((message) => {
    if (!Array.isArray(message?.content)) return { ...message };
    const text = message.content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c?.type === 'text' || c?.type === 'input_text') return c.text || '';
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return { ...message, content: text };
  });
  if (!description) return flat;
  for (let i = flat.length - 1; i >= 0; i -= 1) {
    if (flat[i].role === 'user') {
      flat[i] = { ...flat[i], content: `${flat[i].content}\n\n[PHOTOS DU PRODUIT — description factuelle]\n${description}` };
      return flat;
    }
  }
  return flat;
}

async function describeThenFlatten({ messages, timeoutMs, contextLabel }) {
  let description = '';
  const urls = collectImageUrls(messages);
  try {
    if (urls.length > 0) {
      const { content } = await callKieGemini({
        messages: [
          { role: 'system', content: VISION_SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Décris ces photos de produit.' },
              ...urls.slice(0, 3).map((url) => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
            ],
          },
        ],
        timeoutMs: Math.min(timeoutMs || 90000, 90000),
      });
      description = (content || '').trim();
      console.log(`👁️ [${contextLabel}] ${urls.length} photo(s) décrite(s) par KIE (${description.length} car.) — rédaction par la cascade`);
    }
  } catch (error) {
    // Perdre la description coûte du détail, pas la génération : on écrit quand même.
    console.warn(`⚠️ [${contextLabel}] description des photos échouée (${error.message}) — rédaction sans les photos`);
  }
  return flattenMessages(messages, description);
}

/**
 * Appel texte avec cascade.
 * @returns {Promise<{content:string, usage:object|null, raw:object, provider:string, modelUsed?:string}>}
 */
export async function callTextCompletion({
  messages,
  temperature = 0.4,
  maxTokens = 4096,
  responseFormat,
  timeoutMs,
  tools,
  reasoningEffort = 'low',
  groqModels,
  kieMode = 'responses', // 'responses' (gpt-5-4) | 'gemini'
  contextLabel = 'TEXTE',
} = {}) {
  const vision = hasImageContent(messages);
  const needsTools = Array.isArray(tools) && tools.length > 0;

  // Une photo ne sort plus la rédaction de la cascade : KIE la décrit, puis
  // DeepSeek écrit à partir du texte. Le function calling reste dans la cascade
  // aussi — DeepSeek l'accepte au format OpenAI.
  let workMessages = messages;
  if (vision) {
    if (!isKieConfigured()) {
      throw new Error('KIE_API_KEY requise pour lire une image — DeepSeek et Groq ne le supportent pas');
    }
    workMessages = await describeThenFlatten({ messages, timeoutMs, contextLabel });
  }

  const legs = {
    deepseek: {
      available: isDeepseekConfigured,
      run: () => callDeepseekChat({ messages: workMessages, temperature, maxTokens, responseFormat, tools, timeoutMs }),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    },
    groq: {
      available: isGroqConfigured,
      run: () => callGroqChat({ messages: workMessages, temperature, maxTokens, responseFormat, models: groqModels }),
      model: GROQ_MODEL,
    },
    kie: {
      available: isKieConfigured,
      run: () => (kieMode === 'gemini'
        ? callKieGemini({ messages: workMessages, responseFormat, timeoutMs })
        : callKieResponses({ messages: workMessages, tools, reasoningEffort, timeoutMs })),
      model: kieMode === 'gemini' ? 'kie-gemini' : 'kie-gpt-5-4',
    },
  };

  const DEFAULT_ORDER = ['deepseek', 'groq', 'kie'];
  const order = DEFAULT_ORDER.includes(TEXT_PRIMARY)
    ? [TEXT_PRIMARY, ...DEFAULT_ORDER.filter((p) => p !== TEXT_PRIMARY)]
    : DEFAULT_ORDER;

  // callGroqChat ne transmet pas `tools` : le laisser dans la chaîne rendrait du
  // texte libre là où l'appelant attend un tool_call.
  const capable = needsTools ? order.filter((name) => name !== 'groq') : order;
  const chain = capable.filter((name) => legs[name].available());

  if (chain.length === 0) {
    throw new Error('Aucun provider texte configuré — renseigner DEEPSEEK_API_KEY (ou GROQ_API_KEY / KIE_API_KEY)');
  }

  let lastError = null;
  for (let i = 0; i < chain.length; i += 1) {
    const name = chain[i];
    const leg = legs[name];
    try {
      const result = await leg.run();
      if (i > 0) console.warn(`✅ [${contextLabel}] réponse servie par le secours ${name}`);
      return { ...result, provider: name, modelUsed: result.modelUsed || leg.model };
    } catch (error) {
      lastError = error;
      const transient = isTransientAiError(error);
      const next = chain[i + 1];
      if (!transient) {
        console.error(`❌ [${contextLabel}] ${name} — erreur déterministe, pas de bascule: ${error.message}`);
        throw error;
      }
      if (!next) {
        console.error(`❌ [${contextLabel}] ${name} — dernier provider de la cascade, échec: ${error.message}`);
        throw error;
      }
      console.warn(`⚠️ [${contextLabel}] ${name} indisponible (${error.message}) → bascule sur ${next}`);
    }
  }
  throw lastError || new Error('Cascade texte épuisée');
}

/**
 * Adaptateur drop-in compatible SDK OpenAI/Groq, adossé à la cascade :
 *   const ai = textClient; await ai.chat.completions.create({ messages, ... })
 * Renvoie toujours une réponse au format chat-completions, quel que soit le
 * provider qui a servi (KIE Responses est normalisé ici).
 */
export const textClient = {
  chat: {
    completions: {
      create: async ({ messages, temperature, max_tokens, response_format, model } = {}) => {
        const r = await callTextCompletion({
          messages,
          temperature: temperature ?? 0.4,
          maxTokens: max_tokens ?? 4096,
          responseFormat: response_format,
          contextLabel: 'TEXTE',
        });
        return {
          id: r.raw?.id || null,
          model: r.modelUsed || model || null,
          provider: r.provider,
          choices: [{
            index: 0,
            message: { role: 'assistant', content: r.content },
            finish_reason: r.raw?.choices?.[0]?.finish_reason || 'stop',
          }],
          usage: r.usage || null,
        };
      },
    },
  },
};

/**
 * Variante prompt simple → texte.
 */
export async function completeText(prompt, { system, ...opts } = {}) {
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: String(prompt) },
  ];
  const { content } = await callTextCompletion({ messages, ...opts });
  return content;
}
