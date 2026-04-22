import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || 'openai/gpt-oss-20b';

let _groq = null;

function getGroq() {
  if (!_groq && GROQ_API_KEY) {
    _groq = new Groq({ apiKey: GROQ_API_KEY });
  }
  return _groq;
}

export function isKieConfigured() {
  return !!GROQ_API_KEY;
}

export function normalizeKieMessages(messages = []) {
  return (messages || []).map((message) => {
    const role = ['system', 'user', 'assistant'].includes(message?.role)
      ? message.role
      : 'user';

    if (Array.isArray(message?.content)) {
      // Flatten to string for Groq text model
      const text = message.content
        .map((c) => (typeof c === 'string' ? c : c?.text || ''))
        .join('');
      return { role, content: text };
    }

    return {
      role,
      content: String(message?.content || ''),
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
  tools,
  // legacy params kept for call-site compatibility, unused
  reasoningEffort,
  includeThoughts,
  timeoutMs,
}) {
  const groq = getGroq();
  if (!groq) {
    throw new Error('GROQ_API_KEY non configuré');
  }

  const payload = {
    model: GROQ_TEXT_MODEL,
    messages: normalizeKieMessages(messages),
    temperature,
    max_tokens: maxTokens,
  };

  if (Array.isArray(tools) && tools.length > 0) {
    payload.tools = tools;
  }

  const completion = await groq.chat.completions.create(payload);

  const text = completion.choices?.[0]?.message?.content?.trim() || '';
  if (!text) {
    throw new Error('Groq response vide');
  }

  return {
    content: text,
    usage: completion.usage || null,
    raw: completion,
  };
}
