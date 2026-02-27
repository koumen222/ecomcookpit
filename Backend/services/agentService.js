import OpenAI from 'openai';
import AgentConversation from '../models/AgentConversation.js';
import AgentMessage from '../models/AgentMessage.js';
import ProductConfig from '../models/ProductConfig.js';
import Order from '../models/Order.js';

let openai = null;

const initOpenAI = () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ Service Agent OpenAI initialisé');
  }
  return openai;
};

const INTENT_KEYWORDS = {
  confirmation: ['oui', 'ok', 'd\'accord', 'daccord', 'parfait', 'c\'est bon', 'je confirme', 'confirme', 'yes', 'yeah', 'super', 'nickel', 'top', 'génial', 'excellent', 'validé', 'je prends', 'on fait comme ça', 'ça marche', 'allons-y', 'go'],
  cancellation: ['non', 'annule', 'annuler', 'je ne veux plus', 'pas intéressé', 'laisse tomber', 'oublie', 'cancel', 'stop', 'arrête', 'je refuse', 'plus la peine', 'c\'est mort'],
  negotiation: ['demain', 'après-demain', 'la semaine prochaine', 'plus tard', 'autre jour', 'pas aujourd\'hui', 'matin', 'soir', 'midi', 'heure', 'à quelle heure', 'vers', 'entre', 'disponible'],
  question: ['c\'est quoi', 'comment', 'pourquoi', 'combien', 'quel', 'quelle', 'est-ce que', 'ya quoi', 'expliquez', 'dites-moi', 'je voulais savoir', '?'],
  objection: ['trop cher', 'cher', 'prix', 'réduction', 'promo', 'remise', 'discount', 'moins cher', 'pas confiance', 'arnaque', 'faux', 'qualité', 'garantie'],
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

const buildSystemPrompt = (productConfig, conversation) => {
  const tonalityMap = {
    friendly: 'Tu es chaleureux, proche et utilise un ton amical comme un ami qui conseille.',
    professional: 'Tu es professionnel mais accessible, tu inspires confiance.',
    casual: 'Tu es décontracté, tu parles comme un pote, naturel et spontané.',
    formal: 'Tu es formel et respectueux, tu vouvoies le client.'
  };

  const tonality = tonalityMap[productConfig?.agentConfig?.tonality || 'friendly'];
  
  let systemPrompt = `Tu es un vendeur camerounais expérimenté et persuasif pour une boutique en ligne.
${tonality}

🎯 OBJECTIF PRINCIPAL: Confirmer la livraison AUJOURD'HUI.

📋 RÈGLES STRICTES:
1. Réponds TOUJOURS aux questions du client de manière complète
2. Rassure le client sur ses inquiétudes
3. Ramène TOUJOURS la conversation vers la livraison aujourd'hui
4. Termine CHAQUE message par une question ou une proposition concrète
5. Messages courts (max 3-4 phrases)
6. Utilise des emojis avec modération (1-2 max)
7. Adapte ton langage au contexte camerounais

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
  initOpenAI();
  
  if (!openai) {
    throw new Error('OpenAI non configuré - OPENAI_API_KEY manquante');
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
    
    const completion = await openai.chat.completions.create({
      model: process.env.AGENT_GPT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const processingTime = Date.now() - startTime;
    let response = completion.choices[0].message.content.trim();
    const tokensUsed = completion.usage?.total_tokens || 0;

    // Personnaliser la réponse avec le prénom du client
    if (!response.toLowerCase().includes(clientFirstName.toLowerCase())) {
      // Ajouter le prénom si pas déjà présent
      response = `${clientFirstName}, ${response}`;
    }

    return {
      response,
      promptUsed: systemPrompt.substring(0, 500) + '...',
      gptModel: process.env.AGENT_GPT_MODEL || 'gpt-4o-mini',
      tokensUsed,
      processingTime
    };
  } catch (error) {
    console.error('❌ Erreur génération réponse GPT:', error.message);
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

const generateInitialMessage = async (conversation) => {
  // Message initial fixe personnalisé
  const initialMessage = `Bonjour 👋 Nous avons bien reçu votre commande du Montre Connectée Pro. Le livreur est déjà dans votre zone aujourd'hui. On vous livre dans l'après-midi ?`;

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
  initOpenAI,
  analyzeIntent,
  analyzeSentiment,
  calculateConfidenceImpact,
  generateAgentResponse,
  processIncomingMessage,
  createConversationForOrder,
  generateInitialMessage,
  generateRelanceMessage,
  getConversationsNeedingRelance,
  deactivateStaleConversations,
  getConversationStats
};
