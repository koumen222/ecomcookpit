import Groq from 'groq-sdk';
import RitaConfig from '../models/RitaConfig.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Historique in-memory par numéro de téléphone (max 20 échanges gardés)
const conversationHistory = new Map();
const MAX_HISTORY = 20;

/**
 * Construit le system prompt Rita à partir de la config utilisateur.
 * Style : vendeur humain WhatsApp — messages courts, naturels, zéro hallucination.
 */
function buildSystemPrompt(config) {
  const langMap = { fr: 'français', en: 'anglais', ar: 'arabe', es: 'espagnol' };
  const lang = langMap[config.language] || config.language || 'français';
  const name = config.agentName || 'Rita';

  let prompt = `Tu es ${name}, un vendeur humain qui répond sur WhatsApp en ${lang}.
Tu ne dois JAMAIS parler comme une IA.

## 🎯 Ton objectif
Aider le client à acheter, simplement et naturellement.

## 💬 Style OBLIGATOIRE
- Messages courts (1 à 2 phrases max)
- Ton naturel, comme un vrai humain sur WhatsApp
- Pas de phrases trop parfaites ou littéraires
- Pas de langage robotique
- Tu peux écrire comme dans une vraie discussion WhatsApp

Exemples de style :
- "Oui je vois 👍"
- "Ok parfait"
- "Tu veux quel modèle ?"
- "Je te montre"

## ⚠️ RÈGLE CRITIQUE — ANTI-HALLUCINATION
Tu ne dois JAMAIS inventer :
- des produits
- des prix
- des délais de livraison
- des fonctionnalités
- des politiques commerciales

Si tu n'as pas l'information :
→ tu dis que tu vérifies
→ ou tu poses une question

Exemples :
- "Je vérifie ça pour toi 👍"
- "Tu parles de quel modèle exactement ?"
- "Je regarde si on a ça"
- "Je check et je te dis"

## ⚠️ RÈGLE CRITIQUE — PAS DE FAUSSE PROMESSE
Tu ne dois JAMAIS dire :
- que tu envoies un SMS
- que la commande est confirmée
- que la livraison est en cours
- qu'un paiement est reçu
…sauf si c'est explicitement dans les données fournies.

## 🧠 Comportement
1. Comprendre le besoin du client
2. Poser une question si c'est flou
3. Répondre simplement avec les données que tu as
4. Avancer vers l'achat

## ❌ INTERDIT
- Phrases longues
- Ton robot / IA
- Inventer des infos
- Faire des promesses fausses
- Générer du code, HTML ou markdown
- Dire que tu es une IA (sauf si le client le demande directement)`;

  // — Données business injectées depuis la config —

  if (config.businessContext) {
    prompt += `\n\n## 🏢 Contexte business\n${config.businessContext}`;
  }

  if (config.products?.length) {
    prompt += `\n\n## 🛒 Produits / Services (TES SEULES DONNÉES)\nTu proposes UNIQUEMENT ces produits. Si un produit n'est pas dans cette liste → tu ne l'inventes pas, tu demandes une précision ou tu dis que tu vérifies.\n${config.products.map(p => `- ${p}`).join('\n')}`;
  }

  if (config.faq?.length) {
    prompt += `\n\n## ❓ FAQ\n${config.faq.map(f => `- ${f}`).join('\n')}`;
  }

  if (config.competitiveAdvantages?.length) {
    prompt += `\n\n## 💪 Avantages\n${config.competitiveAdvantages.map(a => `- ${a}`).join('\n')}`;
  }

  if (config.objectionsHandling) {
    prompt += `\n\n## 🛡️ Gestion des objections\n${config.objectionsHandling}`;
  }

  if (config.usefulLinks?.length) {
    prompt += `\n\n## 🔗 Liens utiles\n${config.usefulLinks.map(l => `- ${l}`).join('\n')}`;
  }

  if (config.closingTechnique) {
    const closeMap = {
      soft: 'douce et sans pression',
      assertive: 'directe, tu proposes la commande naturellement',
      consultative: 'tu poses des questions pour comprendre et adapter',
    };
    prompt += `\n\n## 🎯 Technique de closing\n${closeMap[config.closingTechnique] || config.closingTechnique}`;
  }

  if (config.qualificationQuestions?.length) {
    prompt += `\n\n## 🔍 Questions de qualification (à poser naturellement)\n${config.qualificationQuestions.map(q => `- ${q}`).join('\n')}`;
  }

  if (config.signMessages && name) {
    prompt += `\n\nTermine chaque message par "— ${name}"`;
  }

  if (config.useEmojis) {
    prompt += `\nTu peux utiliser des emojis de façon naturelle (👍 ✅ 😊) mais sans en abuser.`;
  }

  return prompt;
}

/**
 * Traite un message entrant et génère une réponse IA via Groq
 * @param {string} userId  - ID de l'utilisateur/propriétaire
 * @param {string} from    - numéro WhatsApp expéditeur (JID: 33612...@s.whatsapp.net)
 * @param {string} text    - Texte du message reçu
 * @returns {Promise<string|null>} - Réponse générée ou null si Rita désactivée
 */
export async function processIncomingMessage(userId, from, text) {
  // Charger la config Rita
  const config = await RitaConfig.findOne({ userId }).lean();
  if (!config || !config.enabled) {
    return null; // Rita désactivée pour cet utilisateur
  }

  // Clé unique par (userId, numéro expéditeur)
  const historyKey = `${userId}:${from}`;
  if (!conversationHistory.has(historyKey)) {
    conversationHistory.set(historyKey, []);
  }
  const history = conversationHistory.get(historyKey);

  // Ajouter le message de l'utilisateur à l'historique
  history.push({ role: 'user', content: text });

  // Garder seulement les N derniers messages
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }

  const systemPrompt = buildSystemPrompt(config);

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
      ],
      temperature: 0.5,
      max_tokens: 150,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (reply) {
      // Ajouter la réponse de l'agent à l'historique
      history.push({ role: 'assistant', content: reply });
    }
    return reply || null;
  } catch (error) {
    console.error('❌ [RITA] Erreur Groq:', error.message);
    return config.fallbackMessage || null;
  }
}

/**
 * Génère une réponse IA pour le simulateur de test (sans historique persistant)
 * @param {object} config - la config Rita complète
 * @param {Array} messages - historique du chat [{role:'user'|'assistant', content:'...'}]
 * @returns {Promise<string>}
 */
export async function generateTestReply(config, messages) {
  const systemPrompt = buildSystemPrompt(config);
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.5,
    max_tokens: 150,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

/**
 * Réinitialise l'historique de conversation pour un numéro donné
 */
export function clearConversationHistory(userId, from) {
  conversationHistory.delete(`${userId}:${from}`);
}
