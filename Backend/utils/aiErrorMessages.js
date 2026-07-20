// ─────────────────────────────────────────────────────────────────────────────
// Erreurs IA côté utilisateur — ne jamais exposer la stack technique.
//
// Les messages d'erreur internes contiennent des noms de fournisseurs, de
// modèles, de variables d'env ou de clés API (DeepSeek, GPT, Groq, KIE,
// *_API_KEY…). Ces détails restent dans les logs serveur et les journaux
// internes (GenerationLog / super-admin), mais tout message destiné à
// l'utilisateur final passe par toUserAiError() qui neutralise les fuites.
// ─────────────────────────────────────────────────────────────────────────────

export const GENERIC_AI_ERROR = 'La génération a échoué. Réessayez dans quelques instants.';

// Marqueurs techniques ou sensibles : noms de fournisseurs/modèles, clés,
// variables d'env, erreurs réseau/parsing bas niveau.
const SENSITIVE_RE = new RegExp([
  'api[_-]?key',
  'deepseek', 'groq', 'openai', 'gpt', 'kie', 'gemini', 'claude', 'anthropic',
  'mistral', 'llama', 'qwen', 'fal\\.ai', 'runpod', 'cloudflare', 'r2\\b',
  'non configur', 'not configured', 'configur\\w* manquante',
  'response vide', 'réponse vide', 'json non parsable', 'non parsable', 'parse',
  'token', 'quota', 'rate.?limit', 'billing',
  'econn', 'etimedout', 'enotfound', 'socket', 'timeout', 'axios', 'fetch failed',
  'status (?:4|5)\\d\\d', '\\b(?:401|403|404|429|500|502|503|504)\\b',
  'process\\.env', '_KEY\\b', '_SECRET\\b', '_TOKEN\\b',
].join('|'), 'i');

/**
 * Retourne un message d'erreur montrable à l'utilisateur final.
 * - Message technique/sensible → message générique.
 * - Message métier rédigé pour l'utilisateur (ex. « Crédits insuffisants »)
 *   → conservé tel quel.
 */
export function toUserAiError(error, fallback = GENERIC_AI_ERROR) {
  const msg = String(error?.message || error || '').trim();
  if (!msg) return fallback;
  if (SENSITIVE_RE.test(msg)) return fallback;
  return msg;
}

export default { toUserAiError, GENERIC_AI_ERROR };
