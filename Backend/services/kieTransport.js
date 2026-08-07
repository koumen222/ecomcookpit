import axios from 'axios';

/**
 * Transport brut KIE — AUCUNE logique de routage ici.
 * Sert de dernier maillon à la cascade texte (voir textProviderService.js)
 * et de chemin direct pour les cas que DeepSeek/Groq ne savent pas traiter :
 * entrées image (vision) et function calling au format Responses.
 */

const KIE_API_KEY = process.env.KIE_API_KEY || '';
const KIE_BASE_URL = (process.env.KIE_BASE_URL || 'https://api.kie.ai').replace(/\/+$/, '');
// Timeout dur par défaut : 5 min. Sans ça (ancienne valeur 0 = infini), un appel
// KIE qui cale laissait la requête HTTP pendre pour toujours → wizard bloqué à 95%.
const KIE_TIMEOUT_MS = Number(process.env.KIE_TIMEOUT_MS) || 300000;
const KIE_GEMINI_MODEL = process.env.KIE_GEMINI_MODEL || 'gemini-2.5-flash';

export function isKieConfigured() {
  return !!KIE_API_KEY;
}

export function normalizeKieMessages(messages = []) {
  return (messages || []).map((message) => {
    const role = ['system', 'user', 'assistant'].includes(message?.role)
      ? message.role
      : 'user';

    if (Array.isArray(message?.content)) {
      const content = message.content.map((c) => {
        if (typeof c === 'string') return { type: 'input_text', text: c };
        if (c?.type === 'text') return { type: 'input_text', text: c.text || '' };
        if (c?.type === 'input_text') return c;
        if (c?.type === 'image_url') return { type: 'input_image', image_url: c.image_url?.url || c.image_url || '' };
        if (c?.type === 'input_image') return c;
        return { type: 'input_text', text: String(c?.text || c || '') };
      });
      return { role, content };
    }

    return {
      role,
      content: [{ type: 'input_text', text: String(message?.content || '') }],
    };
  });
}

export function extractKieContent(data = {}) {
  // Format 1: output[].type === 'message' with content array
  if (Array.isArray(data?.output)) {
    const messagePart = data.output.find((o) => o.type === 'message');
    if (messagePart?.content) {
      if (typeof messagePart.content === 'string') return messagePart.content.trim();
      if (Array.isArray(messagePart.content)) {
        return messagePart.content
          .map((c) => (typeof c === 'string' ? c : c?.text || c?.content || ''))
          .join('')
          .trim();
      }
    }
    // Format: output[].type === 'text' directly
    const textParts = data.output.filter((o) => o.type === 'output_text' || o.type === 'text');
    if (textParts.length > 0) {
      return textParts.map((t) => t.text || t.content || '').join('').trim();
    }
  }

  // Format 2: OpenAI-style choices[].message.content
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk;
        if (chunk?.type === 'text') return chunk?.text || '';
        if (chunk?.type === 'output_text') return chunk?.text || '';
        return '';
      })
      .join('')
      .trim();
  }

  // Format 3: direct data.text or data.content
  if (typeof data?.text === 'string') return data.text.trim();
  if (typeof data?.content === 'string') return data.content.trim();

  // Format 4: output_text in output[].content[]
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        const texts = item.content.filter((c) => c.type === 'output_text' || c.type === 'text');
        if (texts.length > 0) return texts.map((t) => t.text || '').join('').trim();
      }
    }
  }

  return '';
}

/**
 * KIE — endpoint Responses (gpt-5-4 via /codex/v1/responses).
 * Seul chemin qui accepte le function calling au format Responses.
 */
export async function callKieResponses({
  messages,
  tools,
  reasoningEffort = 'low',
  timeoutMs,
}) {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY non configurée');

  const payload = {
    model: 'gpt-5-4',
    stream: false,
    input: normalizeKieMessages(messages),
    reasoning: { effort: reasoningEffort || 'low' },
  };
  if (Array.isArray(tools) && tools.length > 0) payload.tools = tools;

  const response = await axios.post(`${KIE_BASE_URL}/codex/v1/responses`, payload, {
    headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: timeoutMs || KIE_TIMEOUT_MS,
  });

  // KIE peut retourner HTTP 200 avec un message d'erreur dans le body
  const kieBodyError = response.data?.message || response.data?.error || '';
  if (kieBodyError && !response.data?.output && !response.data?.choices) {
    throw new Error(`KIE GPT5: ${kieBodyError}`);
  }
  const text = extractKieContent(response.data);
  if (!text) {
    console.error('[KIE] Structure de réponse inattendue:', JSON.stringify(response.data, null, 2).slice(0, 2000));
    throw new Error('Réponse KIE vide');
  }

  return { content: text, usage: response.data?.usage || null, raw: response.data };
}

/**
 * KIE — endpoint Gemini OpenAI-compatible. Accepte le multimodal
 * (content array [{type:'text'},{type:'image_url',image_url:{url}}]).
 * ⚠️ stream et include_thoughts sont true PAR DÉFAUT côté KIE → forcés à false.
 */
export async function callKieGemini({ messages, responseFormat, timeoutMs }) {
  if (!KIE_API_KEY) throw new Error('KIE_API_KEY non configurée');

  const payload = {
    messages, // format OpenAI natif — passé tel quel
    stream: false,
    include_thoughts: false,
  };
  if (responseFormat) payload.response_format = responseFormat;

  const response = await axios.post(
    `${KIE_BASE_URL}/${KIE_GEMINI_MODEL}/v1/chat/completions`,
    payload,
    {
      headers: { 'Authorization': `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: timeoutMs || KIE_TIMEOUT_MS,
    }
  );

  const kieBodyError = response.data?.message || response.data?.error || '';
  if (kieBodyError && !response.data?.choices) {
    throw new Error(`KIE Gemini: ${kieBodyError}`);
  }
  const content = response.data?.choices?.[0]?.message?.content;
  const text = typeof content === 'string' ? content.trim() : extractKieContent(response.data);
  if (!text) {
    console.error('[KIE Gemini] Structure de réponse inattendue:', JSON.stringify(response.data, null, 2).slice(0, 1500));
    throw new Error('Réponse Gemini vide');
  }

  return { content: text, usage: response.data?.usage || null, raw: response.data };
}
