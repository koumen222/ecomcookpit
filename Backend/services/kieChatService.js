import axios from 'axios';

const KIE_API_KEY = process.env.KIE_API_KEY || process.env.NANOBANANA_API_KEY || '';
const KIE_BASE_URL = (process.env.KIE_BASE_URL || 'https://api.kie.ai').replace(/\/+$/, '');
const KIE_MODEL_PATH = process.env.KIE_MODEL_PATH || '/gemini-3.1-pro/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = Number(process.env.KIE_TIMEOUT_MS || 120000);

export function isKieConfigured() {
  return !!KIE_API_KEY;
}

export function normalizeKieMessages(messages = []) {
  return (messages || []).map((message) => {
    const role = ['developer', 'system', 'user', 'assistant', 'tool'].includes(message?.role)
      ? message.role
      : 'user';

    if (Array.isArray(message?.content)) {
      return {
        role,
        content: message.content,
      };
    }

    return {
      role,
      content: [
        {
          type: 'text',
          text: String(message?.content || ''),
        },
      ],
    };
  });
}

export function extractKieContent(data = {}) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk;
        if (chunk?.type === 'text') return chunk?.text || '';
        return '';
      })
      .join('')
      .trim();
  }

  return '';
}

export async function callKieChatCompletion({
  messages,
  temperature = 0.4,
  maxTokens = 4096,
  reasoningEffort = 'high',
  includeThoughts = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  tools,
}) {
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY non configure');
  }

  const payload = {
    messages: normalizeKieMessages(messages),
    stream: false,
    include_thoughts: includeThoughts,
    reasoning_effort: reasoningEffort,
    max_tokens: maxTokens,
    temperature,
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  const response = await axios.post(`${KIE_BASE_URL}${KIE_MODEL_PATH}`, payload, {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: Number(timeoutMs) || DEFAULT_TIMEOUT_MS,
  });

  const text = extractKieContent(response.data);
  if (!text) {
    throw new Error('KIE response vide');
  }

  return {
    content: text,
    usage: response.data?.usage || null,
    raw: response.data,
  };
}
