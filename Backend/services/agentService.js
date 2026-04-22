import Groq from 'groq-sdk';
import AgentConversation from '../models/AgentConversation.js';
import AgentMessage from '../models/AgentMessage.js';
import ProductConfig from '../models/ProductConfig.js';
import Order from '../models/Order.js';
import Workspace from '../models/Workspace.js';
import RitaConfig from '../models/RitaConfig.js';
import { analyzeImage, buildImageResponsePrompt } from './agentImageService.js';
import { callKieChatCompletion, isKieConfigured } from './kieChatService.js';

let groqClient = null;

const initGroq = () => {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log('✅ Service Agent Groq initialisé');
  }
  return groqClient;
};

const INTENT_KEYWORDS = {
  confirmation: ['oui', 'ok', 'd\'accord', 'daccord', 'parfait', 'c\'est bon', 'je confirme', 'confirme', 'yes', 'yeah', 'super', 'nickel', 'top', 'génial', 'excellent', 'validé', 'je prends', 'on fait comme ça', 'ça marche', 'allons-y', 'go'],
  cancellation: ['non', 'annule', 'annuler', 'je ne veux plus', 'pas intéressé', 'laisse tomber', 'oublie', 'cancel', 'stop', 'arrête', 'je refuse', 'plus la peine', 'c\'est mort'],
  negotiation: ['demain', 'après-demain', 'la semaine prochaine', 'plus tard', 'autre jour', 'pas aujourd\'hui', 'matin', 'soir', 'midi', 'heure', 'à quelle heure', 'vers', 'entre', 'disponible'],
  question: ['c\'est quoi', 'comment', 'pourquoi', 'combien', 'quel', 'quelle', 'est-ce que', 'ya quoi', 'expliquez', 'dites-moi', 'je voulais savoir', '?'],
  objection: ['trop cher', 'cher', 'prix', 'réduction', 'promo', 'remise', 'discount', 'moins cher', 'pas confiance', 'arnaque', 'faux', 'qualité', 'garantie'],
  reseller: ['revendeur', 'grossiste', 'gros', 'en gros', 'prix de gros', 'revendre', 'ma boutique', 'mon commerce', 'pour revendre', 'lot', 'par lot', 'quantité', 'wholesale'],
  greeting: ['bonjour', 'salut', 'hello', 'hi', 'bonsoir', 'coucou', 'hey'],
  thanks: ['merci', 'thanks', 'remercie', 'sympa', 'gentil', 'cool']
};

const SENTIMENT_KEYWORDS = {
  positive: ['merci', 'super', 'génial', 'parfait', 'excellent', 'top', 'nickel', 'content', 'heureux', 'satisfait', 'bien', 'cool', 'formidable', '👍', '😊', '🙏', '❤️', '💪'],
  negative: ['nul', 'mauvais', 'horrible', 'déçu', 'mécontent', 'énervé', 'colère', 'arnaque', 'faux', 'menteur', 'voleur', 'honteux', '😡', '😤', '👎', '💩'],
  neutral: []
};

const analyzeIntent = (message) => {
  const normalizedMsg = message.toLowerCase().trim();
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedMsg.includes(keyword)) {
        return intent;
      }
    }
  }
  
  return 'unknown';
};

const analyzeSentiment = (message) => {
  const normalizedMsg = message.toLowerCase().trim();
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const keyword of SENTIMENT_KEYWORDS.positive) {
    if (normalizedMsg.includes(keyword)) positiveCount++;
  }
  
  for (const keyword of SENTIMENT_KEYWORDS.negative) {
    if (normalizedMsg.includes(keyword)) negativeCount++;
  }
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
};

const calculateConfidenceImpact = (intent, sentiment) => {
  let impact = 0;
  
  switch (intent) {
    case 'confirmation':
      impact = 30;
      break;
    case 'cancellation':
      impact = -50;
      break;
    case 'negotiation':
      impact = 10;
      break;
    case 'question':
      impact = 5;
      break;
    case 'objection':
      impact = -10;
      break;
    case 'reseller':
      impact = 20;
      break;
    case 'greeting':
    case 'thanks':
      impact = 5;
      break;
    default:
      impact = 0;
  }
  
  if (sentiment === 'positive') impact += 10;
  if (sentiment === 'negative') impact -= 15;
  
  return impact;
};

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const extractFirstName = (fullName = '') => {
    const [firstName] = String(fullName).trim().split(/\s+/);
    return firstName || '';
  };

  const formatPriceFcfa = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return String(value || '');
    return String(Math.round(parsed));
  };

  const formatCurrencyLabel = (currency) => {
    const normalized = String(currency || '').trim().toUpperCase();
    if (!normalized) return 'XAF';
    if (['XAF', 'XOF', 'FCFA'].includes(normalized)) return 'FCFA';
    return normalized;
  };

  const isCityDeliverable = (city, zones = []) => {
    if (!city || !Array.isArray(zones) || zones.length === 0) return false;

    const normalizedCity = normalizeText(city);
    return zones.some((zone) => {
      const normalizedZone = normalizeText(zone);
      if (!normalizedZone) return false;
      return (
        normalizedCity === normalizedZone ||
        normalizedCity.includes(normalizedZone) ||
        normalizedZone.includes(normalizedCity)
      );
    });
  };

  const buildInitialMessageContext = (conversation, order, productConfig, workspace) => {
    const clientName = order?.clientName || conversation.clientName || '';
    const product = order?.product || conversation.productName || productConfig?.productName || '';
    const price = order?.price ?? conversation.productPrice ?? productConfig?.pricing?.sellingPrice ?? '';
    const quantity = order?.quantity || order?.rawData?.productQuantity || 1;
    const orderNumber = order?.orderId || order?.rawData?.orderNumber || '';
    const city = order?.city || order?.deliveryLocation || '';
    const address = order?.address || '';
    const country = order?.country || workspace?.storeSettings?.country || workspace?.storeSettings?.storeCountry || '';
    const storeName = workspace?.storeSettings?.storeName || workspace?.name || '';
    const currency = order?.currency || workspace?.storeSettings?.storeCurrency || workspace?.storeSettings?.currency || 'XAF';
    const currencyLabel = formatCurrencyLabel(currency);

    return {
      first_name: extractFirstName(clientName),
      client_name: clientName,
      order_number: orderNumber,
      product,
      price: formatPriceFcfa(price),
      price_with_currency: `${formatPriceFcfa(price)} ${currencyLabel}`,
      quantity: String(quantity),
      city,
      address,
      country,
      currency,
      currency_label: currencyLabel,
      store_name: storeName,
    };
  };

  const renderMessageTemplate = (template, context = {}) => {
    if (!template || typeof template !== 'string') return '';

    let rendered = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
      const value = context[key];
      return value === undefined || value === null ? '' : String(value);
    });

    const legacyMap = {
      PRODUIT: context.product,
      PRIX: context.price,
      CLIENT: context.client_name,
      QUANTITE: context.quantity,
      VILLE: context.city,
      COMMANDE: context.order_number,
    };

    rendered = rendered.replace(/\{(PRODUIT|PRIX|CLIENT|QUANTITE|VILLE|COMMANDE)\}/g, (_match, key) => {
      const value = legacyMap[key];
      return value === undefined || value === null ? '' : String(value);
    });

    return rendered;
  };

const buildSystemPrompt = (productConfig, conversation) => {
  const tonalityMap = {
    friendly: 'Tu es chaleureux, proche et utilise un ton amical comme un ami qui conseille.',
    professional: 'Tu es professionnel mais accessible, tu inspires confiance.',
    casual: 'Tu es décontracté, tu parles comme un pote, naturel et spontané.',
    formal: 'Tu es formel et respectueux, tu vouvoies le client.',
    vouvoiement: 'Tu es formel et respectueux, tu vouvoies systématiquement le client.',
    tutoiement: 'Tu es proche, naturel et chaleureux, tu tutoies le client.',
    humorous: 'Tu es naturel et chaleureux. Tu peux glisser une blague légère quand le contexte s’y prête, sans jamais devenir lourde ni irrespectueuse.'
  };

  const tonality = tonalityMap[productConfig?.agentConfig?.tonality || 'friendly'];
  
  let systemPrompt = `Tu es une vendeuse camerounaise professionnelle et expérimentée pour une boutique en ligne.
${tonality}

🎯 OBJECTIF PRINCIPAL: Identifier ce que le prospect veut et lui proposer le bon produit.
Le prospect t'écrit parce qu'il a vu une annonce → il a déjà un produit en tête.
Tu dois COMPRENDRE rapidement quel produit l'intéresse, le lui proposer avec le prix, et pousser vers la livraison.

🧠 MODE RÉFLEXION (OBLIGATOIRE):
Avant CHAQUE réponse, tu analyses mentalement :
- Que veut VRAIMENT le client ? (intention profonde)
- À quel stade est-il ? (découverte → intérêt → décision → achat)
- Quel est son niveau d'intérêt ? (curieux, intéressé, prêt à acheter)
- Quelle réponse va lui donner envie de CONTINUER ?
Si ce n'est pas clair → pose UNE question directe.

💬 STRUCTURE DE CHAQUE RÉPONSE:
1. Répondre clairement à la question/besoin du client
2. Ajouter un bénéfice ou une explication utile
3. Poser une question ou faire une proposition pour avancer

📋 RÈGLES STRICTES:
1. COMPRENDS avant de répondre — analyse l'intention, le besoin, le niveau d'intérêt
2. Si le prospect dit juste "bonjour", "salut", "hello" → commence TOUJOURS par: "Bonjour 👌 quel produit vous intéresse ?"
3. Ne donne JAMAIS le prix directement au premier message
4. Avant de vendre, pose toujours 1 ou 2 questions pour comprendre le besoin précis du client
5. Dès que le produit est identifié → explique à quoi il sert, ses bénéfices, comment il marche, puis donne le prix si pertinent
4. Réponds TOUJOURS aux questions du client de manière complète
6. Rassure le client sur ses inquiétudes avec paiement à la livraison + vérification avant paiement
7. Utilise parfois une preuve sociale naturelle comme: "beaucoup de clientes à Douala utilisent déjà ça"
8. Ramène TOUJOURS la conversation vers la commande, mais progressivement et naturellement
9. Termine CHAQUE message par une question ou une proposition concrète
10. Messages courts (max 3-4 phrases)
11. Utilise des emojis avec modération (1-2 max)
12. Adapte ton langage au contexte camerounais
13. Ne sois JAMAIS robotique — chaque réponse doit être unique et naturelle
14. N'envoie JAMAIS des infos non demandées ou des images inutiles (anti-spam)
15. Ne spamme jamais "tu veux que je réserve" — propose la suite naturellement

🖼️ SI LE CLIENT ENVOIE UNE IMAGE:
- Tu recevras la description de l'image entre crochets
- Si c'est un de tes produits → confirme le nom, donne le prix, propose la commande
- Si c'est pas dans ton catalogue → dis-le poliment et propose ce que tu as
- Réagis toujours naturellement à l'image

🛒 INFORMATIONS PRODUIT:
- Nom: ${productConfig?.productName || conversation.productName || 'Non spécifié'}
- Prix: ${productConfig?.pricing?.sellingPrice || conversation.productPrice || 'Non spécifié'} FCFA
- Livraison: ${productConfig?.delivery?.estimatedTime || 'Dans la journée'}
${productConfig?.guarantee?.hasGuarantee ? `- Garantie: ${productConfig.guarantee.duration} - ${productConfig.guarantee.description}` : ''}

`;

  if (productConfig?.advantages?.length > 0) {
    systemPrompt += `\n💪 AVANTAGES À METTRE EN AVANT:\n`;
    productConfig.advantages.forEach(adv => {
      systemPrompt += `- ${adv.title}: ${adv.description}\n`;
    });
  }

  if (productConfig?.faq?.length > 0) {
    systemPrompt += `\n❓ FAQ (utilise ces réponses si pertinent):\n`;
    productConfig.faq.slice(0, 5).forEach(f => {
      systemPrompt += `Q: ${f.question}\nR: ${f.answer}\n`;
    });
  }

  if (productConfig?.objections?.length > 0) {
    systemPrompt += `\n🛡️ OBJECTIONS COURANTES (utilise ces réponses):\n`;
    productConfig.objections.slice(0, 5).forEach(obj => {
      systemPrompt += `Objection: ${obj.objection}\nRéponse: ${obj.response}\n`;
    });
  }

  systemPrompt += `\n📊 ÉTAT DE LA CONVERSATION:
- Score de confiance: ${conversation.confidenceScore}%
- Niveau de persuasion: ${conversation.persuasionLevel}/3
- Refus comptés: ${conversation.refusalCount}

`;

  if (conversation.persuasionLevel > 0) {
    const persuasionArgs = productConfig?.persuasionArguments || {};
    const levelArgs = persuasionArgs[`level${conversation.persuasionLevel}`] || [];
    if (levelArgs.length > 0) {
      const arg = levelArgs[Math.floor(Math.random() * levelArgs.length)];
      systemPrompt += `💡 ARGUMENT DE PERSUASION À UTILISER (niveau ${conversation.persuasionLevel}):\n${arg}\n\n`;
    }
  }

  if (conversation.refusalCount >= 2) {
    systemPrompt += `⚠️ Le client a refusé 2 fois aujourd'hui. ACCEPTE de reporter à demain tout en gardant un ton positif.\n\n`;
  }

  systemPrompt += `🎭 COMPORTEMENT SELON LE SENTIMENT:
- Si client POSITIF → Closing direct, confirme la livraison
- Si client NEUTRE → Persuasion normale, avantages du produit
- Si client NÉGATIF → Ton rassurant, empathie, puis arguments

� GESTION DES SITUATIONS:
- Client demande prix → donner le prix + valoriser le produit + proposer un visuel
- Client demande photo → envoyer 1 image + demander son avis
- Client hésite → poser une question pour comprendre ce qui bloque
- Client trouve cher → expliquer la valeur + comparer + demander son budget
- Client revendeur/grossiste → proposer offre de gros + poser questions business (quantité, boutique, fréquence)
- Client silencieux → relancer de manière naturelle et chaleureuse
- Client frustré → empathie courte (1 phrase) + relance avec question/proposition

🚫 ANTI-SPAM:
- N'envoie JAMAIS des infos non demandées
- N'envoie JAMAIS plusieurs images inutilement
- Chaque message = réponse au besoin du client, pas un monologue
- Comprends d'abord, réponds ensuite

🔄 ANTI-RÉPÉTITION: Ne répète jamais exactement la même question deux fois. Varie tes formulations.

🧭 GUIDE LE CLIENT: Si le client hésite ou est indécis, propose des options numérotées plutôt qu'une question ouverte.

🛡️ RASSURANCE: Si le client doute → mentionne toujours paiement à la livraison + vérification avant paiement.

⏰ URGENCE: Utilise UNE phrase d'urgence par conversation (stock limité, très demandé, dernier passage du livreur...)

⚡ CLOSING RAPIDE: Dès que le produit est identifié → "C'est [Prix] FCFA 👍 Tu veux que je te le réserve ?"

🧩 COHÉRENCE: Ne jamais se contredire. Si tu as dit un prix, garde ce prix. Si tu as dit en stock, garde cette info.

🚨 INTERDICTIONS:
- Ne jamais répondre sans avoir compris l'intention du client
- Ne jamais envoyer des messages génériques ou robotiques
- Ne jamais ignorer le message du client
- Ne jamais envoyer des images sans logique
- Ne jamais dire seulement "vous confirmez ?" sans contexte

Réponds UNIQUEMENT le message à envoyer, sans introduction ni explication.`;

  return systemPrompt;
};

const buildUserPrompt = (clientMessage, conversationHistory, intent, sentiment, clientFirstName) => {
  let prompt = `Message client: "${clientMessage}"

Analyse:
- Intention: ${intent}
- Sentiment: ${sentiment}
- Prénom client: ${clientFirstName}

Historique conversation récent:
${conversationHistory}

Génère une réponse qui:
1. Répond directement à la question/concern du client
2. Utilise les informations produit pertinentes
3. Pousse vers la livraison aujourd'hui
4. Termine par une question claire
5. Adapte le ton au sentiment détecté
6. Maximum 3-4 phrases
7. Commence par le prénom du client si approprié`;

  return prompt;
};

const generateAgentResponse = async (conversation, clientMessage, intent, sentiment) => {
  const groq = initGroq();
  if (!isKieConfigured() && !groq) {
    throw new Error('Aucun modele texte configure (KIE_API_KEY ou GROQ_API_KEY manquant)');
  }

  const productConfig = await ProductConfig.findByProductName(
    conversation.workspaceId,
    conversation.productName
  );

  const conversationHistory = await AgentMessage.formatForPrompt(conversation._id, 10);

  // Extraire le prénom du client
  const clientFirstName = conversation.clientName ? conversation.clientName.split(' ')[0] : 'cher client';

  const systemPrompt = buildSystemPrompt(productConfig, conversation);
  const userPrompt = buildUserPrompt(clientMessage, conversationHistory, intent, sentiment, clientFirstName);

  try {
    const startTime = Date.now();
    let response = '';
    let tokensUsed = 0;
    let modelUsed = process.env.KIE_MODEL_PATH || 'kie-gpt-5-2';

    try {
      const kieResult = await callKieChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        maxTokens: 300,
        temperature: 0.7,
        reasoningEffort: process.env.KIE_REASONING_EFFORT || 'low',
        includeThoughts: false,
      });
      response = kieResult.content;
      tokensUsed = kieResult?.usage?.total_tokens || 0;
    } catch (kieErr) {
      if (!groq) throw kieErr;
      console.warn(`⚠️ [AGENT] KIE indisponible, fallback Groq: ${kieErr.message}`);
      const completion = await groq.chat.completions.create({
        model: process.env.AGENT_GROQ_MODEL || 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      });
      response = completion.choices[0].message.content.trim();
      tokensUsed = completion.usage?.total_tokens || 0;
      modelUsed = process.env.AGENT_GROQ_MODEL || 'openai/gpt-oss-20b';
    }

    const processingTime = Date.now() - startTime;

    // Personnaliser la réponse avec le prénom du client
    if (!response.toLowerCase().includes(clientFirstName.toLowerCase())) {
      // Ajouter le prénom si pas déjà présent
      response = `${clientFirstName}, ${response}`;
    }

    return {
      response,
      promptUsed: systemPrompt.substring(0, 500) + '...',
      gptModel: modelUsed,
      tokensUsed,
      processingTime
    };
  } catch (error) {
    console.error('❌ Erreur génération réponse Groq:', error.message);
    throw error;
  }
};

const processIncomingMessage = async (conversation, messageContent, whatsappMessageId) => {
  console.log('🧠 ==================== ANALYSE MESSAGE ====================');
  console.log('💬 Message:', messageContent);
  console.log('👤 Client:', conversation.clientName);
  console.log('📞 Conversation ID:', conversation._id);
  
  // Check if message was already processed (handle both method and array cases)
  const isProcessed = conversation.isMessageProcessed 
    ? conversation.isMessageProcessed(whatsappMessageId)
    : (conversation.processedMessageIds || []).includes(whatsappMessageId);
    
  if (isProcessed) {
    console.log(`⚠️ Message ${whatsappMessageId} déjà traité, ignoré`);
    return null;
  }

  const intent = analyzeIntent(messageContent);
  const sentiment = analyzeSentiment(messageContent);
  const confidenceImpact = calculateConfidenceImpact(intent, sentiment);

  console.log('🔍 Analyse:', { intent, sentiment, confidenceImpact });

  const clientMessage = new AgentMessage({
    conversationId: conversation._id,
    workspaceId: conversation.workspaceId,
    direction: 'inbound',
    sender: 'client',
    content: messageContent,
    whatsappMessageId,
    intent,
    sentiment,
    confidenceImpact,
    deliveryStatus: 'delivered'
  });
  await clientMessage.save();
  console.log('💾 Message client sauvegardé:', clientMessage._id);

  // Handle methods that may not exist on plain objects
  if (conversation.markMessageProcessed) {
    conversation.markMessageProcessed(whatsappMessageId);
  } else {
    // Fallback: manually add to processedMessageIds
    if (!conversation.processedMessageIds) conversation.processedMessageIds = [];
    if (!conversation.processedMessageIds.includes(whatsappMessageId)) {
      conversation.processedMessageIds.push(whatsappMessageId);
    }
  }
  
  if (conversation.updateConfidenceScore) {
    conversation.updateConfidenceScore(confidenceImpact);
  } else {
    // Fallback: manually update confidence score
    conversation.confidenceScore = Math.max(0, Math.min(100, (conversation.confidenceScore || 50) + confidenceImpact));
  }
  
  conversation.sentiment = sentiment;
  conversation.lastInteractionAt = new Date();
  conversation.lastMessageFromClient = new Date();
  if (!conversation.metadata) conversation.metadata = {};
  conversation.metadata.messageCount = (conversation.metadata.messageCount || 0) + 1;
  conversation.metadata.clientMessageCount = (conversation.metadata.clientMessageCount || 0) + 1;

  console.log('📊 Nouveau score confiance:', conversation.confidenceScore);

  // État de la conversation selon l'intention
  if (intent === 'confirmation' && conversation.confidenceScore > 70) {
    conversation.state = 'confirmed';
    conversation.confirmedAt = new Date();
    console.log('✅ Conversation confirmée!');
  } else if (intent === 'objection' && conversation.confidenceScore < 30) {
    conversation.persuasionLevel = Math.min(3, (conversation.persuasionLevel || 0) + 1);
    console.log('⚠️ Objection détectée, niveau persuasion:', conversation.persuasionLevel);
  }

  // Escalade si sentiment négatif persistant
  if (sentiment === 'negative' && conversation.confidenceScore < 30) {
    conversation.state = 'escalated';
    conversation.escalatedAt = new Date();
    conversation.escalationReason = 'Sentiment négatif persistant';
    console.log('🚨 Conversation escaladée!');
  }

  await conversation.save();
  console.log('💾 Conversation mise à jour');

  let agentResponse = null;
  
  if (conversation.active && conversation.state !== 'escalated') {
    console.log('🤖 ==================== GÉNÉRATION RÉPONSE ====================');
    try {
      const gptResult = await generateAgentResponse(
        conversation,
        messageContent,
        intent,
        sentiment
      );

      console.log('✨ Réponse GPT générée:', {
        length: gptResult.response?.length,
        tokens: gptResult.tokensUsed,
        processingTime: gptResult.processingTime + 'ms'
      });

      agentResponse = new AgentMessage({
        conversationId: conversation._id,
        workspaceId: conversation.workspaceId,
        direction: 'outbound',
        sender: 'agent',
        content: gptResult.response,
        intent: intent === 'confirmation' ? 'closing' : 'follow_up',
        promptUsed: gptResult.promptUsed,
        gptModel: gptResult.gptModel,
        gptTokensUsed: gptResult.tokensUsed,
        deliveryStatus: 'pending',
        metadata: {
          processingTime: gptResult.processingTime
        }
      });
      await agentResponse.save();
      console.log('💾 Réponse agent sauvegardée:', agentResponse._id);

      conversation.lastMessageFromAgent = new Date();
      conversation.metadata.agentMessageCount = (conversation.metadata.agentMessageCount || 0) + 1;
      await conversation.save();

    } catch (error) {
      console.error('❌ Erreur génération réponse agent:', error.message);
    }
  } else {
    console.log('⏸️ Pas de réponse générée (inactive ou escaladée)');
  }

  const result = {
    clientMessage,
    agentResponse,
    conversationState: conversation.state,
    confidenceScore: conversation.confidenceScore,
    shouldSendResponse: agentResponse !== null && conversation.active
  };

  console.log('📋 Résultat final:', {
    hasAgentResponse: !!result.agentResponse,
    shouldSend: result.shouldSendResponse,
    state: result.conversationState
  });

  return result;
};

const createConversationForOrder = async (order, workspaceId) => {
  const existingConversation = await AgentConversation.findOne({
    orderId: order._id,
    active: true
  });

  if (existingConversation) {
    console.log(`⚠️ Conversation active existe déjà pour la commande ${order._id}`);
    return existingConversation;
  }

  const cleanedPhone = order.clientPhone.replace(/\D/g, '');
  const whatsappChatId = `${cleanedPhone}@c.us`;

  const conversation = new AgentConversation({
    workspaceId,
    orderId: order._id,
    clientPhone: cleanedPhone,
    clientName: order.clientName || '',
    whatsappChatId: whatsappChatId,  // S'assurer que le champ est bien défini
    productName: order.product || '',
    productPrice: order.price || 0,
    state: 'pending_confirmation',
    confidenceScore: 50,
    relanceCount: 0,
    active: true,
    processedMessageIds: []
  });

  await conversation.save();
  console.log(`✅ Conversation créée pour commande ${order._id}, client ${cleanedPhone}`);

  return conversation;
};

const LEGACY_DEFAULT_DELIVERABLE_TEMPLATE = 'Bonjour {{first_name}} 👋\n\nJ\'espère que vous allez bien !\n\nIci le service client Zendo.\n\nNous accusons réception de votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nNous pouvons vous livrer aujourd\'hui (si la commande est passée avant 16h) ou demain (si elle est passée après 16h) 🙏🏼';
const LEGACY_DEFAULT_NON_DELIVERABLE_TEMPLATE = 'Bonjour {{first_name}} 👋\n\nNous avons bien reçu votre commande n°{{order_number}} ✅\n\nLe produit {{product}} coûte {{price}} FCFA l\'unité pour une quantité de {{quantity}}.\n\nMalheureusement, nous ne livrons pas encore dans votre ville ({{city}}). Nous vous contacterons dès que la livraison sera disponible dans votre zone. 🙏';

const buildDefaultInitialMessageTemplate = ({ deliverable, country }) => {
  if (deliverable) {
    return [
      'Bonjour {{first_name}} 👋',
      'Nous avons bien reçu votre commande n°{{order_number}} chez {{store_name}} ✅',
      'Produit : {{product}}',
      'Quantité : {{quantity}}',
      'Montant : {{price_with_currency}}',
      `Notre équipe vous contactera rapidement pour confirmer la livraison${country ? ` au ${country}` : ''}. 🙏`,
    ].join('\n\n');
  }

  return [
    'Bonjour {{first_name}} 👋',
    'Nous avons bien reçu votre commande n°{{order_number}} chez {{store_name}} ✅',
    'Produit : {{product}}',
    'Quantité : {{quantity}}',
    'Montant : {{price_with_currency}}',
    `Pour le moment, la livraison n\'est pas encore disponible dans votre ville ({{city}}). Nous vous recontacterons dès qu\'une option sera disponible${country ? ` au ${country}` : ''}. 🙏`,
  ].join('\n\n');
};

const resolveInitialTemplate = ({ template, legacyTemplate, fallbackTemplate }) => {
  if (!template || String(template).trim() === String(legacyTemplate).trim()) {
    return fallbackTemplate;
  }
  return template;
};

const generateInitialMessage = async (conversation) => {
  const [order, workspace, productConfig] = await Promise.all([
    conversation.orderId ? Order.findById(conversation.orderId).lean() : null,
    Workspace.findById(conversation.workspaceId, { owner: 1, name: 1, storeSettings: 1 }).lean(),
    ProductConfig.findByProductName(conversation.workspaceId, conversation.productName),
  ]);

  // Résoudre la RitaConfig via l'owner du workspace
  let ritaConfig = null;
  if (workspace?.owner) {
    ritaConfig = await RitaConfig.findOne({ userId: workspace.owner.toString() }).lean();
  }

  const context = buildInitialMessageContext(conversation, order, productConfig, workspace);

  // Priorité: RitaConfig > ProductConfig > valeur par défaut
  const cityRoutingEnabled = !!(ritaConfig?.enableCityRouting ?? productConfig?.delivery?.enableCityRoutingForInitialMessage);
  const deliveryZones = (ritaConfig?.deliverableZones?.length ? ritaConfig.deliverableZones : null)
    ?? productConfig?.delivery?.zones
    ?? [];
  const deliverable = isCityDeliverable(context.city, deliveryZones);
  const defaultDeliverableTemplate = buildDefaultInitialMessageTemplate({ deliverable: true, country: context.country });
  const defaultNonDeliverableTemplate = buildDefaultInitialMessageTemplate({ deliverable: false, country: context.country });

  let selectedTemplate;
  if (cityRoutingEnabled && !deliverable) {
    selectedTemplate = resolveInitialTemplate({
      template: ritaConfig?.orderConfirmationMessageNonDeliverable || productConfig?.initialMessageNonDeliverable,
      legacyTemplate: LEGACY_DEFAULT_NON_DELIVERABLE_TEMPLATE,
      fallbackTemplate: defaultNonDeliverableTemplate,
    });
  } else {
    selectedTemplate = resolveInitialTemplate({
      template: ritaConfig?.orderConfirmationMessage || productConfig?.initialMessage,
      legacyTemplate: LEGACY_DEFAULT_DELIVERABLE_TEMPLATE,
      fallbackTemplate: defaultDeliverableTemplate,
    });
  }

  const initialMessage = renderMessageTemplate(selectedTemplate, context);

  const message = new AgentMessage({
    conversationId: conversation._id,
    workspaceId: conversation.workspaceId,
    direction: 'outbound',
    sender: 'agent',
    content: initialMessage,
    intent: 'initial_message',
    deliveryStatus: 'pending'
  });
  await message.save();

  conversation.initialMessageSentAt = new Date();
  conversation.lastMessageFromAgent = new Date();
  conversation.lastInteractionAt = new Date();
  if (!conversation.metadata) conversation.metadata = {};
  conversation.metadata.agentMessageCount = (conversation.metadata.agentMessageCount || 0) + 1;
  await conversation.save();

  return {
    message,
    content: initialMessage
  };
};

const generateRelanceMessage = async (conversation) => {
  const relanceNumber = conversation.relanceCount + 1;
  
  const productConfig = await ProductConfig.findByProductName(
    conversation.workspaceId,
    conversation.productName
  );

  let relanceContent;
  
  if (productConfig) {
    relanceContent = productConfig.getRelanceMessage(relanceNumber);
  } else {
    const defaultRelances = {
      1: 'Bonjour 👋 Je voulais juste m\'assurer que vous avez bien reçu mon message. On peut toujours vous livrer aujourd\'hui si ça vous arrange ?',
      2: 'Coucou ! Notre livreur passe dans votre quartier cet après-midi. C\'est le dernier passage de la journée, vous confirmez ?',
      3: 'Bonjour ! Je voulais savoir si vous êtes toujours intéressé(e) par votre commande. On peut organiser la livraison demain si vous préférez 😊'
    };
    relanceContent = defaultRelances[relanceNumber] || defaultRelances[1];
  }

  const message = new AgentMessage({
    conversationId: conversation._id,
    workspaceId: conversation.workspaceId,
    direction: 'outbound',
    sender: 'agent',
    content: relanceContent,
    intent: 'follow_up',
    deliveryStatus: 'pending',
    metadata: {
      isRelance: true,
      relanceNumber
    }
  });
  await message.save();

  conversation.relanceCount = relanceNumber;
  conversation.metadata.lastRelanceAt = new Date();
  conversation.lastMessageFromAgent = new Date();
  conversation.lastInteractionAt = new Date();
  conversation.metadata.agentMessageCount += 1;
  await conversation.save();

  return {
    message,
    content: relanceContent,
    relanceNumber
  };
};

const getConversationsNeedingRelance = async (workspaceId = null) => {
  const query = {
    active: true,
    state: { $in: ['pending_confirmation', 'negotiating_time'] },
    relanceCount: { $lt: 3 }
  };

  if (workspaceId) {
    query.workspaceId = workspaceId;
  }

  const conversations = await AgentConversation.find(query);
  
  return conversations.filter(conv => conv.shouldRelance());
};

const deactivateStaleConversations = async (workspaceId = null) => {
  const query = {
    active: true,
    $or: [
      { lastInteractionAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      { relanceCount: { $gte: 3 } }
    ]
  };

  if (workspaceId) {
    query.workspaceId = workspaceId;
  }

  const result = await AgentConversation.updateMany(query, {
    $set: { active: false }
  });

  return result.modifiedCount;
};

/**
 * Traite un message image entrant du client.
 * Télécharge l'image, l'analyse via OpenAI Vision, cherche une correspondance produit,
 * puis génère une réponse agent adaptée.
 *
 * @param {Object} conversation  - Document AgentConversation
 * @param {string} base64Image   - Image en base64
 * @param {string} mimetype      - ex: 'image/jpeg'
 * @param {string} caption       - Légende envoyée avec l'image (optionnel)
 * @param {string} whatsappMessageId
 * @returns {Promise<Object|null>}
 */
const processIncomingImageMessage = async (conversation, base64Image, mimetype, caption, whatsappMessageId) => {
  console.log('🖼️ ==================== ANALYSE IMAGE ====================');
  console.log('📞 Conversation ID:', conversation._id);
  console.log('👤 Client:', conversation.clientName);
  console.log('📝 Caption:', caption || '(aucune)');

  // Vérifier doublon
  const isProcessed = conversation.isMessageProcessed
    ? conversation.isMessageProcessed(whatsappMessageId)
    : (conversation.processedMessageIds || []).includes(whatsappMessageId);

  if (isProcessed) {
    console.log(`⚠️ Message image ${whatsappMessageId} déjà traité, ignoré`);
    return null;
  }

  // 1. Analyser l'image avec OpenAI Vision
  let imageAnalysis;
  try {
    imageAnalysis = await analyzeImage(base64Image, mimetype, conversation.workspaceId);
    console.log('🔍 Analyse image:', {
      description: imageAnalysis.description,
      isProduct: imageAnalysis.isProductImage,
      matched: imageAnalysis.matchedProductName,
      confidence: imageAnalysis.confidence
    });
  } catch (error) {
    console.error('❌ Erreur analyse image:', error.message);
    imageAnalysis = {
      description: 'Image non analysée (erreur)',
      isProductImage: false,
      matchedProductName: null,
      matchedProduct: null,
      confidence: 0,
      details: error.message,
      tokensUsed: 0,
      processingTime: 0
    };
  }

  // 2. Sauvegarder le message image du client
  const contentText = caption || `[Image: ${imageAnalysis.description || 'image envoyée'}]`;
  const intent = caption ? analyzeIntent(caption) : 'question';
  const sentiment = caption ? analyzeSentiment(caption) : 'neutral';
  const confidenceImpact = calculateConfidenceImpact(intent, sentiment);

  const clientMessage = new AgentMessage({
    conversationId: conversation._id,
    workspaceId: conversation.workspaceId,
    direction: 'inbound',
    sender: 'client',
    content: contentText,
    whatsappMessageId,
    messageType: 'image',
    intent,
    sentiment,
    confidenceImpact,
    deliveryStatus: 'delivered',
    imageAnalysis: {
      description: imageAnalysis.description,
      isProductImage: imageAnalysis.isProductImage,
      matchedProductName: imageAnalysis.matchedProductName,
      confidence: imageAnalysis.confidence
    }
  });
  await clientMessage.save();
  console.log('💾 Message image client sauvegardé:', clientMessage._id);

  // Mettre à jour la conversation
  if (conversation.markMessageProcessed) {
    conversation.markMessageProcessed(whatsappMessageId);
  } else {
    if (!conversation.processedMessageIds) conversation.processedMessageIds = [];
    if (!conversation.processedMessageIds.includes(whatsappMessageId)) {
      conversation.processedMessageIds.push(whatsappMessageId);
    }
  }

  if (conversation.updateConfidenceScore) {
    conversation.updateConfidenceScore(confidenceImpact);
  } else {
    conversation.confidenceScore = Math.max(0, Math.min(100, (conversation.confidenceScore || 50) + confidenceImpact));
  }

  conversation.sentiment = sentiment;
  conversation.lastInteractionAt = new Date();
  conversation.lastMessageFromClient = new Date();
  if (!conversation.metadata) conversation.metadata = {};
  conversation.metadata.messageCount = (conversation.metadata.messageCount || 0) + 1;
  conversation.metadata.clientMessageCount = (conversation.metadata.clientMessageCount || 0) + 1;
  await conversation.save();

  // 3. Générer une réponse agent basée sur l'analyse
  let agentResponse = null;

  if (conversation.active && conversation.state !== 'escalated') {
    console.log('🤖 ==================== GÉNÉRATION RÉPONSE IMAGE ====================');
    try {
      const imageContext = buildImageResponsePrompt(imageAnalysis, conversation);
      const gptResult = await generateAgentImageResponse(conversation, imageContext, caption);

      console.log('✨ Réponse GPT (image) générée:', {
        length: gptResult.response?.length,
        tokens: gptResult.tokensUsed,
        processingTime: gptResult.processingTime + 'ms'
      });

      agentResponse = new AgentMessage({
        conversationId: conversation._id,
        workspaceId: conversation.workspaceId,
        direction: 'outbound',
        sender: 'agent',
        content: gptResult.response,
        intent: imageAnalysis.isProductImage ? 'follow_up' : 'question',
        promptUsed: gptResult.promptUsed,
        gptModel: gptResult.gptModel,
        gptTokensUsed: gptResult.tokensUsed,
        deliveryStatus: 'pending',
        metadata: {
          processingTime: gptResult.processingTime,
          extractedInfo: {
            imageAnalysis: {
              isProductImage: imageAnalysis.isProductImage,
              matchedProductName: imageAnalysis.matchedProductName,
              confidence: imageAnalysis.confidence
            }
          }
        }
      });
      await agentResponse.save();
      console.log('💾 Réponse agent (image) sauvegardée:', agentResponse._id);

      conversation.lastMessageFromAgent = new Date();
      conversation.metadata.agentMessageCount = (conversation.metadata.agentMessageCount || 0) + 1;
      await conversation.save();
    } catch (error) {
      console.error('❌ Erreur génération réponse agent (image):', error.message);
    }
  }

  return {
    clientMessage,
    agentResponse,
    imageAnalysis,
    conversationState: conversation.state,
    confidenceScore: conversation.confidenceScore,
    shouldSendResponse: agentResponse !== null && conversation.active
  };
};

/**
 * Génère une réponse agent en tenant compte du contexte image.
 */
const generateAgentImageResponse = async (conversation, imageContext, caption) => {
  const groq = initGroq();
  if (!isKieConfigured() && !groq) throw new Error('Aucun modele texte configure (KIE_API_KEY ou GROQ_API_KEY manquant)');

  const productConfig = await ProductConfig.findByProductName(
    conversation.workspaceId,
    conversation.productName
  );

  const conversationHistory = await AgentMessage.formatForPrompt(conversation._id, 10);
  const clientFirstName = conversation.clientName ? conversation.clientName.split(' ')[0] : 'cher client';

  const systemPrompt = buildSystemPrompt(productConfig, conversation);
  const userPrompt = `${imageContext}

${caption ? `Le client a aussi écrit: "${caption}"` : ''}

Prénom client: ${clientFirstName}

Historique récent:
${conversationHistory}

Génère une réponse naturelle qui:
1. Réagit à l'image envoyée
2. Si c'est un produit du catalogue → confirme et pousse vers la livraison
3. Si ce n'est pas un produit du catalogue → oriente vers nos produits
4. Maximum 3-4 phrases, ton naturel`;

  const startTime = Date.now();

  let response = '';
  let tokensUsed = 0;
  let modelUsed = process.env.KIE_MODEL_PATH || 'kie-gpt-5-2';

  try {
    const kieResult = await callKieChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      maxTokens: 300,
      temperature: 0.7,
      reasoningEffort: process.env.KIE_REASONING_EFFORT || 'low',
      includeThoughts: false,
    });
    response = kieResult.content;
    tokensUsed = kieResult?.usage?.total_tokens || 0;
  } catch (kieErr) {
    if (!groq) throw kieErr;
    console.warn(`⚠️ [AGENT] KIE indisponible (image-context), fallback Groq: ${kieErr.message}`);
    const completion = await groq.chat.completions.create({
      model: process.env.AGENT_GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });
    response = completion.choices[0].message.content.trim();
    tokensUsed = completion.usage?.total_tokens || 0;
    modelUsed = process.env.AGENT_GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  }

  const processingTime = Date.now() - startTime;

  if (!response.toLowerCase().includes(clientFirstName.toLowerCase())) {
    response = `${clientFirstName}, ${response}`;
  }

  return {
    response,
    promptUsed: systemPrompt.substring(0, 500) + '...',
    gptModel: modelUsed,
    tokensUsed,
    processingTime
  };
};

const getConversationStats = async (workspaceId, dateFrom = null, dateTo = null) => {
  const matchQuery = { workspaceId };
  
  if (dateFrom || dateTo) {
    matchQuery.createdAt = {};
    if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo);
  }

  const stats = await AgentConversation.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$state',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidenceScore' }
      }
    }
  ]);

  const totalConversations = stats.reduce((sum, s) => sum + s.count, 0);
  const confirmed = stats.find(s => s._id === 'confirmed')?.count || 0;
  const cancelled = stats.find(s => s._id === 'cancelled')?.count || 0;
  const pending = stats.find(s => s._id === 'pending_confirmation')?.count || 0;
  const negotiating = stats.find(s => s._id === 'negotiating_time')?.count || 0;
  const escalated = stats.find(s => s._id === 'escalated')?.count || 0;

  return {
    total: totalConversations,
    confirmed,
    cancelled,
    pending,
    negotiating,
    escalated,
    conversionRate: totalConversations > 0 ? ((confirmed / totalConversations) * 100).toFixed(2) : 0,
    cancellationRate: totalConversations > 0 ? ((cancelled / totalConversations) * 100).toFixed(2) : 0,
    avgConfidenceScore: stats.reduce((sum, s) => sum + (s.avgConfidence || 0), 0) / (stats.length || 1)
  };
};

export {
  initGroq,
  analyzeIntent,
  analyzeSentiment,
  calculateConfidenceImpact,
  generateAgentResponse,
  processIncomingMessage,
  processIncomingImageMessage,
  createConversationForOrder,
  generateInitialMessage,
  generateRelanceMessage,
  getConversationsNeedingRelance,
  deactivateStaleConversations,
  getConversationStats
};
