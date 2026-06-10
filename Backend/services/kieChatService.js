import axios from 'axios';

const KIE_API_KEY = process.env.KIE_API_KEY || '';
const KIE_BASE_URL = (process.env.KIE_BASE_URL || 'https://api.kie.ai').replace(/\/+$/, '');
const KIE_TIMEOUT_MS = Number(process.env.KIE_TIMEOUT_MS) || 0; // 0 = pas de timeout

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

export async function callKieChatCompletion({
  messages,
  temperature = 0.4,
  maxTokens = 4096,
  tools,
  reasoningEffort = 'low',
  includeThoughts,
  timeoutMs,
}) {
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY non configurée');
  }

  const normalizedMessages = normalizeKieMessages(messages);

  const payload = {
    model: 'gpt-5-4',
    stream: false,
    input: normalizedMessages,
    reasoning: {
      effort: reasoningEffort || 'low',
    },
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  const response = await axios.post(
    `${KIE_BASE_URL}/codex/v1/responses`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs || KIE_TIMEOUT_MS,
    }
  );

  // KIE peut retourner HTTP 200 avec un message d'erreur dans le body
  const kieBodyError = response.data?.message || response.data?.error || '';
  if (kieBodyError && !response.data?.output && !response.data?.choices) {
    throw new Error(`KIE GPT5: ${kieBodyError}`);
  }
  const text = extractKieContent(response.data);
  if (!text) {
    console.error('[KIE] Response data structure:', JSON.stringify(response.data, null, 2).slice(0, 2000));
    throw new Error('GPT 5.4 response vide');
  }

  return {
    content: text,
    usage: response.data?.usage || null,
    raw: response.data,
  };
}
