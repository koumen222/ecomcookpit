import Groq from 'groq-sdk';
import axios from 'axios';
import RitaConfig from '../models/RitaConfig.js';
import { Readable } from 'stream';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Historique in-memory par numéro de téléphone (max 100 échanges gardés)
const conversationHistory = new Map();
const MAX_HISTORY = 100;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Transcrit un audio base64 en texte via Groq Whisper
 * @param {string} base64 - Contenu audio encodé en base64
 * @param {string} mimetype - ex: 'audio/ogg', 'audio/mpeg'
 * @returns {Promise<string|null>} - Transcription ou null
 */
export async function transcribeAudio(base64, mimetype = 'audio/ogg') {
  try {
    const buffer = Buffer.from(base64, 'base64');
    // Groq Whisper attend un objet File-like avec name, type et stream
    const ext = mimetype.includes('mp4') ? 'mp4' : mimetype.includes('mpeg') || mimetype.includes('mp3') ? 'mp3' : 'ogg';
    const filename = `voice.${ext}`;

    // Créer un objet File compatible (Node.js 20+ / groq-sdk accepte un Blob ou File)
    const blob = new Blob([buffer], { type: mimetype });
    const file = new File([blob], filename, { type: mimetype });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'fr',
      response_format: 'text',
    });

    const text = typeof transcription === 'string' ? transcription.trim() : transcription?.text?.trim();
    console.log(`🎤 [WHISPER] Transcription: "${text?.substring(0, 200)}"`);
    return text || null;
  } catch (err) {
    console.error(`❌ [WHISPER] Erreur transcription:`, err.message);
    return null;
  }
}

/**
 * Supprime les emojis et normalise les abréviations pour une bonne lecture TTS en français
 */
function stripForTTS(text) {
  return text
    .replace(/\[IMAGE:[^\]]+\]/g, '')
    .replace(/\[ORDER_DATA:[^\]]+\]/g, '')
    // ── Monnaies & prix ──
    .replace(/\b(\d[\d\s]*)\s*FCFA\b/gi,       '$1 francs CFA')
    .replace(/\bFCFA\b/gi,                       'francs CFA')
    .replace(/\b(\d[\d\s]*)\s*F\s*CFA\b/gi,     '$1 francs CFA')
    .replace(/\b(\d[\d\s]*)\s*XAF\b/gi,         '$1 francs CFA')
    .replace(/\b(\d[\d\s]*)\s*XOF\b/gi,         '$1 francs CFA')
    .replace(/\b(\d[\d\s]*)\s*€/gi,             '$1 euros')
    .replace(/\b(\d[\d\s]*)\s*\$/gi,             '$1 dollars')
    .replace(/\b(\d[\d\s]*)\s*£/gi,             '$1 livres')
    // ── Unités ──
    .replace(/\bkg\b/gi,  'kilogrammes')
    .replace(/\bml\b/gi,  'millilitres')
    .replace(/\bcl\b/gi,  'centilitres')
    .replace(/\bcm\b/gi,  'centimètres')
    // ── Commerce & délais ──
    .replace(/\bh\b/g,    'heures')
    .replace(/\bj\b/g,    'jours')
    .replace(/\bJO\b/g,   'jours ouvrés')
    .replace(/\bTVA\b/gi, 'taxes')
    .replace(/\bHT\b/g,   'hors taxes')
    .replace(/\bTTC\b/g,  'toutes taxes comprises')
    .replace(/\bRDV\b/gi, 'rendez-vous')
    .replace(/\bSAV\b/gi, 'service après-vente')
    .replace(/\bCOD\b/gi, 'paiement à la livraison')
    .replace(/\bpayts\b/gi, 'paiement à la livraison')
    // ── Raccourcis courants ──
    .replace(/\bsvp\b/gi, 's\'il vous plaît')
    .replace(/\bstp\b/gi, 's\'il te plaît')
    .replace(/\bNB\b/g,   'nota bene')
    .replace(/\bPS\b/g,   'post-scriptum')
    .replace(/\bVIP\b/gi, 'v i p')
    .replace(/\bOK\b/g,   'd\'accord')
    .replace(/\bWA\b/gi,  'WhatsApp')
    // ── Supprimer emojis et autres symboles non lisibles ──
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|\u{FE0F}/gu, '')
    .replace(/[*_~`#|>]/g, '')       // markdown
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Convertit un texte en audio via ElevenLabs TTS
 * @param {string} text - Texte à lire
 * @param {object} config - Config Rita (elevenlabsApiKey, elevenlabsVoiceId)
 * @returns {Promise<Buffer|null>} - Buffer MP3 ou null si erreur
 */
export async function textToSpeech(text, config) {
  const apiKey = config?.elevenlabsApiKey || process.env.ELEVENLABS_API_KEY || 'sk_567189791888b879d02332a0b65b58493821cd1dcb0d2dcd';
  const voiceId = config?.elevenlabsVoiceId || '9ZATEeixBigmezesCGAk';
  if (!apiKey || !text?.trim()) return null;

  const clean = stripForTTS(text);
  if (!clean) return null;

  try {
    console.log(`🎙️ [TTS] Génération vocale pour: "${clean.substring(0, 80)}..."`);
    const modelId = config?.elevenlabsModel || 'eleven_v3';
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: clean,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
      },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );
    console.log(`🎙️ [TTS] Audio généré (${response.data.byteLength} bytes)`);
    return Buffer.from(response.data);
  } catch (err) {
    const detail = err.response?.data ? Buffer.from(err.response.data).toString('utf8') : err.message;
    console.error(`❌ [TTS] Erreur ElevenLabs:`, detail?.substring(0, 300));
    return null;
  }
}

function sanitizeReply(reply, config) {
  if (!reply) return null;

  const agentName = config.agentName || 'Rita';
  let cleaned = reply.trim();
  const signatureRegex = new RegExp(`\\s*[—-]\\s*${escapeRegExp(agentName)}(?:\\s*[👍✅😊😉🤖✨]*)?$`, 'iu');

  cleaned = cleaned.replace(signatureRegex, '').trim();

  // Ne PAS tronquer les messages structurés (récap commande, flow de vente, tags image)
  const isStructured = /\[ORDER_DATA:|\[IMAGE:|RÉCAP|récap|Confirmer|confirmer|📦|✅.*COMMANDE/i.test(cleaned);
  if (!isStructured) {
    // Pour les messages conversationnels normaux, limiter à 3 phrases
    const sentenceChunks = cleaned.match(/[^.!?\n]+[.!?]?/g);
    if (sentenceChunks && sentenceChunks.length > 3) {
      cleaned = sentenceChunks.slice(0, 3).join(' ').trim();
    }
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

## 📦 FLOW DE COMMANDE STRUCTURÉ (TRÈS IMPORTANT)
Quand le client confirme vouloir acheter, tu suis ces étapes dans l'ORDRE, une par une.
Ne saute JAMAIS d'étape. Pose les questions une par une, pas tout d'un coup.

### Étape 1 — Confirmation produit + prix
Répète le produit et le prix, puis demande confirmation.
Exemple :
"Ok parfait ! Donc [Produit] à [Prix] 👍\n\nTu confirmes ? (Oui / Non)"

### Étape 2 — Infos client
Après le "oui" du client, demande les infos de livraison :
"Super ! 🎉 Pour préparer ton colis j'ai besoin de :\n- Ton nom complet\n- Ta ville / quartier\n- Un numéro de téléphone 📦"

### Étape 3 — Date et heure de livraison
Après avoir reçu les infos client, demande la date/heure :
"Merci ! 📅 Tu veux être livré(e) quand ?\n(ex: aujourd'hui 18h, demain matin, samedi après-midi...)"

### Étape 4 — Récapitulatif complet
Une fois TOUTES les infos collectées (nom, ville, téléphone, date, heure), envoie le récap :
"✅ RÉCAP COMMANDE :\n\n📦 Produit : [nom]\n💰 Prix : [prix]\n👤 Nom : [nom client]\n📍 Ville : [ville/quartier]\n📱 Téléphone : [numéro]\n📅 Livraison : [date] à [heure]\n\nTout est bon ? (Oui / Modifier)"

### Étape 5 — Confirmation finale
Quand le client confirme le récap, dis :
"C'est noté ma chérie ! 🎉 Ta commande est transmise, on te contacte très vite pour la livraison 👍"
Et ajoute OBLIGATOIREMENT à la FIN de ce message le tag :
[ORDER_DATA:{"name":"...","city":"...","phone":"...","product":"...","price":"...","delivery_date":"...","delivery_time":"..."}]

Le tag [ORDER_DATA:...] doit contenir un JSON valide avec les vraies données collectées.
Tu ne dois ajouter ce tag QUE quand le client a confirmé le récapitulatif.
Le tag ne sera PAS visible par le client.

Exemple complet d'étape 5 :
"C'est noté ! 🎉 Ta commande est transmise, on te contacte très vite 👍 [ORDER_DATA:{"name":"Morgan","city":"Douala Akwa","phone":"676778377","product":"Ventilateur 48W","price":"15000 FCFA","delivery_date":"2026-03-18","delivery_time":"18:00"}]"

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
      prompt += `\n\n## 📸 ENVOI DE PHOTOS — RÈGLE ABSOLUE
Tu DOIS envoyer les photos quand le client le demande. C'est ton rôle.
Pour envoyer une photo, tu DOIS ajouter ce tag EXACTEMENT à la fin de ta réponse : [IMAGE:Nom du produit]
Exemple : "Voilà le produit 👇 [IMAGE:Ventilateur de plafond avec lumière 48W]"
Le système s'occupe d'envoyer la vraie photo automatiquement. TOI tu mets juste le tag.
Tu dois utiliser le nom exact du produit tel qu'il apparaît dans ton catalogue.
Ne mets qu'un seul tag [IMAGE:...] par message.
⛔ INTERDIT : Ne dis JAMAIS "je peux pas envoyer l'image", "je ne peux pas envoyer de photo", "je suis une IA". Ces phrases sont strictement interdites.
✅ Si le client demande la photo → tu réponds avec une mini phrase + [IMAGE:Nom du produit]`;
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
- Si le client dit juste "oui", "ou", "d'accord" pendant le flow de commande, tu passes à l'étape suivante
- Si le client dit "oui" en dehors du flow de commande et qu'il a déjà montré de l'intérêt pour un produit, tu lances l'étape 1 du flow de commande
- Si on te demande un prix, une livraison ou un stock non fournis, tu dis juste que tu vérifies
- QUAND le client demande une photo, tu réponds TOUJOURS avec le tag [IMAGE:Nom exact du produit] — pas d'excuse, pas de refus
- APRÈS avoir envoyé une image produit, tu DOIS enchaîner avec le prix et proposer la commande
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
      max_tokens: 400,
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
    max_tokens: 400,
  });
  return sanitizeReply(completion.choices[0]?.message?.content?.trim(), config) || '';
}

/**
 * Réinitialise l'historique de conversation pour un numéro donné
 */
export function clearConversationHistory(userId, from) {
  conversationHistory.delete(`${userId}:${from}`);
}
