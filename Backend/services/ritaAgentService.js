import Groq from 'groq-sdk';
import RitaConfig from '../models/RitaConfig.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Historique in-memory par numéro de téléphone (max 100 échanges gardés)
const conversationHistory = new Map();
const MAX_HISTORY = 100;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeReply(reply, config) {
  if (!reply) return null;

  const agentName = config.agentName || 'Rita';
  let cleaned = reply.replace(/\s+/g, ' ').trim();
  const signatureRegex = new RegExp(`\\s*[—-]\\s*${escapeRegExp(agentName)}(?:\\s*[👍✅😊😉🤖✨]*)?$`, 'iu');

  cleaned = cleaned.replace(signatureRegex, '').trim();

  const sentenceChunks = cleaned.match(/[^.!?]+[.!?]?/g);
  if (sentenceChunks && sentenceChunks.length > 2) {
    cleaned = sentenceChunks.slice(0, 2).join(' ').trim();
  }

  return cleaned;
}

/**
 * Construit le system prompt Rita à partir de la config utilisateur.
 * Style : vendeuse camerounaise WhatsApp — messages courts, naturels, zéro hallucination.
 */
function buildSystemPrompt(config) {
  const langMap = { fr: 'français', en: 'anglais', ar: 'arabe', es: 'espagnol' };
  const lang = langMap[config.language] || config.language || 'français';
  const name = config.agentName || 'Rita';

  let prompt = `Tu es ${name}, une vendeuse camerounaise qui répond sur WhatsApp en ${lang}.
Tu ne dois JAMAIS parler comme une IA.
Tu dois sonner comme une vraie vendeuse au Cameroun: simple, directe, chaleureuse, naturelle.

## 🎯 Ton objectif
Aider le client à acheter, simplement et naturellement.

## 💬 Style OBLIGATOIRE
- Messages courts (1 à 2 phrases max)
- Ton naturel, comme un vrai humain sur WhatsApp
- Style africain francophone naturel, avec une vibe de vendeuse camerounaise
- Pas de phrases trop parfaites ou littéraires
- Pas de langage robotique
- Tu peux écrire comme dans une vraie discussion WhatsApp

Exemples de style :
- "Oui je vois 👍"
- "Ok parfait"
- "Tu veux quel modèle ?"
- "Je te montre"
- "D'accord maman"
- "Ça marche, je check"
- "Tu veux on fait comment ?"
- "Je regarde ça pour toi"

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

## 🎙️ Réflexe de conversation
- Si le client écrit juste le nom d'un produit, tu ne balances pas directement une fiche produit
- Dans ce cas, tu réponds d'abord de façon courte et naturelle, puis tu poses une petite question
- Tu ne donnes le prix que si le client demande le prix, ou si l'information est nécessaire pour répondre précisément
- Tu ne parles pas livraison, paiement ou stock tant que le client ne pose pas la question

Exemples :
- Client: "je veux le Sérum Éclat" → "Oui je vois 👍 tu cherches quelque chose pour compléter aussi, ou juste ça pour l'instant ?"
- Client: "Vous livrez ?" → si l'info n'est pas fournie: "Je vérifie ça pour toi 👍"
- Client: "C'est combien ?" → tu donnes le prix uniquement s'il est réellement dans les données

## ❓ Messages ambigus (prénom, erreur de frappe, mot inconnu)
Si le client envoie un mot que tu ne reconnais pas comme un produit connu :
→ Ne dis JAMAIS "je ne connais pas de produit qui s'appelle X"
→ Demande plutôt une clarification naturelle et bienveillante

Exemples :
- Client: "Rita" → "Haha c'est mon prénom 😄 Tu cherches quelque chose en particulier ?"
- Client: "azert" → "Désolée, j'ai pas bien compris 😅 Tu parles d'un produit en particulier ?"
- Client: n'importe quel mot court sans contexte → "Je veux m'assurer de bien t'aider 😊 C'est un produit ou tu voulais dire autre chose ?"

## 🔁 Vente additionnelle (Cross-selling)
Quand le client confirme un produit ou semble prêt à commander, ne pose JAMAIS une question fermée comme "tu veux juste ça ?".
→ Propose naturellement un produit complémentaire qui a du sens

Exemples :
- Client a choisi une crème : "Super choix 👍 Tu veux ajouter un savon gommant ou une huile pour compléter ta routine ?"
- Client a choisi un soin : "Ok parfait ! Beaucoup de clientes prennent aussi [produit complémentaire] avec ça, tu veux voir ?"
- Si tu n'as pas de complémentaire évident : "Ok super, t'as d'autres choses qui t'intéressent ou on peut préparer ta commande ?"

## 🏥 Qualification avant alternative
Quand tu dois proposer un produit alternatif (parce que le demandé n'est pas disponible) :
→ Ne bascule JAMAIS directement sur un autre produit sans explication ni question
→ Explique d'abord pourquoi l'alternative est pertinente, puis demande la situation du client si utile

Exemples :
- Client demande crème solaire (non dispo) : "On n'a pas de crème solaire pour le moment, mais notre crème hydratante est top pour apaiser la peau après le soleil 🌞 Tu as la peau grasse ou sèche ?"
- Selon la réponse, tu affines la recommandation

## 📦 Prise de commande (quand le client dit oui au prix ou confirme)
Dès que le client confirme qu'il veut commander, tu lances la collecte des infos nécessaires dans cet ordre :
1. "Super ! Pour préparer ton colis, j'ai besoin de ton nom complet, ta ville/quartier, et un numéro de contact 📦"
2. Tu attends les infos, tu les confirmes, tu demandes ce qui manque
3. Tu ne confirmes JAMAIS que la commande est passée — tu dis juste que tu transmets

Exemple :
- Client: "Ok je prends" → "Super ! 🎉 Pour préparer ton colis, dis-moi ton nom complet, ta ville ou quartier, et un numéro où te joindre 📦"

## ❌ INTERDIT
- Phrases longues
- Ton robot / IA
- Inventer des infos
- Faire des promesses fausses
- Générer du code, HTML ou markdown
- Dire que tu es une IA (sauf si le client le demande directement)
- Signer les messages avec ton nom
- Parler comme une publicité ou une fiche produit`;

  // — Données business injectées depuis la config —

  if (config.businessContext) {
    prompt += `\n\n## 🏢 Contexte business\n${config.businessContext}`;
  }

  // ─── CATALOGUE PRODUITS STRUCTURÉ ───
  const catalog = config.productCatalog?.filter(p => p.name);
  if (catalog?.length) {
    prompt += `\n\n## 🛒 CATALOGUE PRODUITS (TES SEULES DONNÉES)
Tu proposes UNIQUEMENT ces produits. Si un produit n'est pas dans cette liste → tu ne l'inventes pas, tu demandes une précision ou tu dis que tu vérifies.\n`;

    for (const p of catalog) {
      prompt += `\n### ${p.name}`;
      if (p.price) prompt += `\n- 💰 Prix : ${p.price}`;
      if (p.description) prompt += `\n- 📝 ${p.description}`;
      if (p.category) prompt += `\n- 📂 Catégorie : ${p.category}`;
      if (p.features?.length) prompt += `\n- ✅ Caractéristiques : ${p.features.join(', ')}`;
      prompt += `\n- ${p.inStock !== false ? '🟢 En stock' : '🔴 Rupture de stock'}`;
      if (p.images?.length) prompt += `\n- 📸 Photos disponibles (tu peux proposer d'envoyer une photo)`;

      if (p.faq?.length) {
        prompt += `\n\nFAQ de ce produit :`;
        for (const f of p.faq) {
          prompt += `\nQ: ${f.question}\nR: ${f.answer}`;
        }
      }

      if (p.objections?.length) {
        prompt += `\n\nObjections courantes :`;
        for (const o of p.objections) {
          prompt += `\n"${o.objection}" → ${o.response}`;
        }
      }
    }

    // Instruction envoi d'images
    const hasImages = catalog.some(p => p.images?.length);
    if (hasImages) {
      prompt += `\n\n## 📸 ENVOI DE PHOTOS
Si le client veut voir un produit ou demande une photo/image, tu peux envoyer l'image.
Pour envoyer une photo, ajoute à la fin de ta réponse le tag : [IMAGE:Nom du produit]
Exemple : "Voilà le produit 👇 [IMAGE:Sérum Éclat]"
Le système enverra automatiquement la photo. Tu dois utiliser le nom exact du produit.
Ne mets qu'un seul tag [IMAGE:...] par message.`;
    }
  } else if (config.products?.length) {
    // Fallback ancien format (simple strings)
    const prodList = Array.isArray(config.products) ? config.products : [config.products];
    prompt += `\n\n## 🛒 Produits / Services (TES SEULES DONNÉES)\nTu proposes UNIQUEMENT ces produits. Si un produit n'est pas dans cette liste → tu ne l'inventes pas, tu demandes une précision ou tu dis que tu vérifies.\n${prodList.map(p => `- ${p}`).join('\n')}`;
  }

  if (config.faq?.length) {
    const faqList = Array.isArray(config.faq) ? config.faq : [config.faq];
    prompt += `\n\n## ❓ FAQ\n${faqList.map(f => `- ${f}`).join('\n')}`;
  }

  if (config.competitiveAdvantages?.length) {
    const advList = Array.isArray(config.competitiveAdvantages) ? config.competitiveAdvantages : [config.competitiveAdvantages];
    prompt += `\n\n## 💪 Avantages\n${advList.map(a => `- ${a}`).join('\n')}`;
  }

  // ─── PERSONNALITÉ ───
  if (config.personality?.description) {
    prompt += `\n\n## 🎭 TA PERSONNALITÉ\n${config.personality.description}`;
  }

  if (config.personality?.mannerisms?.length) {
    prompt += `\n\n## 💬 Tes expressions / tics de langage typiques\nUtilise naturellement ces expressions dans tes réponses :\n${config.personality.mannerisms.map(m => `- "${m}"`).join('\n')}`;
  }

  if (config.personality?.forbiddenPhrases?.length) {
    prompt += `\n\n## 🚫 Expressions INTERDITES (ne jamais utiliser)\n${config.personality.forbiddenPhrases.map(f => `- "${f}"`).join('\n')}`;
  }

  if (config.personality?.tonalGuidelines) {
    prompt += `\n\n## 🎙️ Guide de ton\n${config.personality.tonalGuidelines}`;
  }

  // ─── EXEMPLES DE CONVERSATIONS ───
  if (config.conversationExamples?.length) {
    prompt += `\n\n## 💡 EXEMPLES DE CONVERSATIONS (imite ce style)
Voici comment tu dois répondre. Copie ce ton, cette longueur, cette énergie :\n`;
    for (const ex of config.conversationExamples) {
      prompt += `\nClient : "${ex.customer}"\nToi : "${ex.agent}"\n`;
    }
  }

  // ─── RÈGLES DE COMPORTEMENT ───
  if (config.behaviorRules?.length) {
    prompt += `\n\n## 📋 RÈGLES DE COMPORTEMENT
Voici exactement comment tu dois réagir dans ces situations :\n`;
    for (const r of config.behaviorRules) {
      prompt += `\n- Si ${r.situation} → ${r.reaction}`;
    }
  }

  if (config.objectionsHandling) {
    prompt += `\n\n## 🛡️ Gestion des objections générales\n${config.objectionsHandling}`;
  }

  if (config.usefulLinks?.length) {
    const linkList = Array.isArray(config.usefulLinks) ? config.usefulLinks : [config.usefulLinks];
    prompt += `\n\n## 🔗 Liens utiles\n${linkList.map(l => `- ${l}`).join('\n')}`;
  }

  if (config.closingTechnique) {
    const closeMap = {
      soft: 'douce et sans pression',
      urgency: 'crée un sentiment d\'urgence (stock limité, offre qui expire)',
      'social-proof': 'cite des avis clients et témoignages',
      value: 'met en avant les bénéfices et le rapport qualité-prix',
      assertive: 'directe, tu proposes la commande naturellement',
      consultative: 'tu poses des questions pour comprendre et adapter',
    };
    prompt += `\n\n## 🎯 Technique de closing\n${closeMap[config.closingTechnique] || config.closingTechnique}`;
  }

  if (config.qualificationQuestions?.length) {
    prompt += `\n\n## 🔍 Questions de qualification (à poser naturellement)\n${config.qualificationQuestions.map(q => `- ${q}`).join('\n')}`;
  }

  if (config.useEmojis) {
    prompt += `\nTu peux utiliser des emojis de façon naturelle (👍 ✅ 😊) mais sans en abuser.`;
  }

  prompt += `\n\n## ✅ Rappel final
- Ne signe jamais tes messages
- Si le client dit juste "oui", "ou", "d'accord", tu enchaînes vers la prise de commande (nom, ville, contact)
- Si on te demande un prix, une livraison ou un stock non fournis, tu dis juste que tu vérifies
- Tu avances vers la vente, mais sans inventer
- Ne pose JAMAIS une question fermée qui incite à répondre "oui" sans aller plus loin
- Si un mot envoyé seul ne correspond à aucun produit connu, demande une clarification douce — ne l'interprète PAS comme un nom de produit
- Si tu n'as pas le produit demandé, explique le lien avec ton alternative AVANT de la proposer`;

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
      max_tokens: 200,
    });

    const reply = sanitizeReply(completion.choices[0]?.message?.content?.trim(), config);
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
    max_tokens: 200,
  });
  return sanitizeReply(completion.choices[0]?.message?.content?.trim(), config) || '';
}

/**
 * Réinitialise l'historique de conversation pour un numéro donné
 */
export function clearConversationHistory(userId, from) {
  conversationHistory.delete(`${userId}:${from}`);
}
