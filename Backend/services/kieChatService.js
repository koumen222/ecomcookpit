import { callTextCompletion } from './textProviderService.js';

/**
 * Compat KIE — ces deux helpers ne parlent PLUS à KIE directement.
 * Ils délèguent à la cascade texte : DeepSeek → Groq → KIE.
 * KIE n'est plus qu'un dernier recours (et le chemin obligé pour la vision
 * et le function calling format Responses, que DeepSeek/Groq ne gèrent pas).
 *
 * Conservés pour ne pas casser les 7 modules qui les importent. Nouveau code :
 * importer callTextCompletion depuis textProviderService.js.
 */

export {
  isKieConfigured,
  normalizeKieMessages,
  extractKieContent,
  callKieResponses,
  callKieGemini,
} from './kieTransport.js';

export async function callKieGeminiChat({ messages, responseFormat, timeoutMs, contextLabel = 'GEMINI' }) {
  return callTextCompletion({
    messages,
    responseFormat,
    timeoutMs,
    kieMode: 'gemini',
    contextLabel,
  });
}

export async function callKieChatCompletion({
  messages,
  temperature = 0.4,
  maxTokens = 4096,
  tools,
  reasoningEffort = 'low',
  includeThoughts, // eslint-disable-line no-unused-vars — obsolète, KIE force false
  timeoutMs,
  contextLabel = 'TEXTE',
}) {
  return callTextCompletion({
    messages,
    temperature,
    maxTokens,
    tools,
    reasoningEffort,
    timeoutMs,
    kieMode: 'responses',
    contextLabel,
  });
}
