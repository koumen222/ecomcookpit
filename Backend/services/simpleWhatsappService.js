// Service WhatsApp simplifié - Envoi de message basique

let whatsappConfig = null;

// Initialiser la configuration WhatsApp
export const initWhatsApp = () => {
  const instanceId = process.env.WHATSAPP_INSTANCE_ID;
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;

  if (instanceId && apiKey) {
    whatsappConfig = {
      instanceId: instanceId,
      apiKey: apiKey,
      apiUrl: apiUrl || 'https://api.ecomcookpit.site'
    };
    console.log('✅ WhatsApp Service initialisé (ZeChat)');
    console.log('📱 Instance ID:', instanceId);
    return true;
  }

  // WhatsApp n'est pas configuré globalement (utilisation par instances)
  return false;
};

// Fonction simple pour envoyer un message
export const sendMessage = async (phoneNumber, message) => {
  console.log('\n🚀 ==================== ENVOI MESSAGE ====================');
  console.log('📱 Numéro destinataire:', phoneNumber);
  console.log('💬 Message:', message);
  
  // Initialiser si pas encore fait
  if (!whatsappConfig) {
    console.log('🔧 Initialisation WhatsApp...');
    const initialized = initWhatsApp();
    if (!initialized) {
      console.error('❌ Impossible d\'initialiser WhatsApp');
      return { success: false, error: 'WhatsApp non configuré' };
    }
  }

  try {
    // Formater le numéro au format WhatsApp (ex: 237698459328@c.us)
    let chatId = phoneNumber;
    
    console.log('🔍 Numéro brut reçu:', phoneNumber);
    
    if (!chatId.includes('@c.us')) {
      // Nettoyer le numéro (enlever espaces, tirets, +, etc.)
      let cleanNumber = phoneNumber.replace(/\D/g, '');
      console.log('🧹 Numéro nettoyé:', cleanNumber);
      
      // Ajouter 237 si le numéro commence par 6 et a 9 chiffres (format Cameroun)
      if (cleanNumber.length === 9 && cleanNumber.startsWith('6')) {
        cleanNumber = '237' + cleanNumber;
        console.log('🇨🇲 Ajout indicatif Cameroun:', cleanNumber);
      }
      
      // Si le numéro ne commence pas par 237, l'ajouter
      if (!cleanNumber.startsWith('237') && cleanNumber.length >= 9) {
        cleanNumber = '237' + cleanNumber;
        console.log('🌍 Ajout indicatif 237:', cleanNumber);
      }
      
      chatId = `${cleanNumber}@c.us`;
    }
    
    console.log('📞 ChatId formaté FINAL:', chatId);
    console.log('🔍 Vérification format: ' + (chatId.includes('@c.us') ? '✅' : '❌'));
    console.log('🔍 Longueur numéro: ' + chatId.replace('@c.us', '').length);

    // Construire l'URL de l'API Evolution
    const url = `${whatsappConfig.apiUrl}/api/instance/send-message`;
    console.log('🔗 URL API:', url);

    // Importer fetch
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;

    // Nettoyer le numéro pour ZeChat (sans @c.us)
    const cleanPhone = chatId.replace('@c.us', '');

    // Préparer le payload Evolution API
    const payload = {
      instanceName: whatsappConfig.instanceId,
      number: cleanPhone,
      message: message
    };
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    // Envoyer la requête
    console.log('📤 Envoi de la requête...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EVOLUTION_GLOBAL_API_KEY?.trim() || ''}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('📥 Réponse ZeChat API:');
    console.log('   Status HTTP:', response.status, response.statusText);
    console.log('   Body:', JSON.stringify(data, null, 2));

    if (response.ok && data.idMessage) {
      console.log('✅ ==================== MESSAGE REÇU ====================');
      console.log('✅ Message envoyé avec succès !');
      console.log('🆔 Message ID:', data.idMessage);
      console.log('⏰ Timestamp:', data.timestamp || new Date().toISOString());
      console.log('✅ =========================================================\n');
      
      return {
        success: true,
        messageId: data.idMessage,
        timestamp: data.timestamp
      };
    } else {
      console.error('❌ ==================== ERREUR GREEN API ====================');
      console.error('❌ Status HTTP:', response.status, response.statusText);
      console.error('❌ Erreur Green API:', data.error || data.message || 'Erreur inconnue');
      console.error('📄 Réponse complète:', JSON.stringify(data, null, 2));
      console.error('🔍 ChatId utilisé:', chatId);
      console.error('🔍 Message envoyé:', message);
      console.error('❌ =========================================================\n');
      
      return {
        success: false,
        error: data.error || data.message || 'Erreur lors de l\'envoi',
        statusCode: response.status,
        responseData: data
      };
    }

  } catch (error) {
    console.error('❌ ==================== ERREUR ENVOI ====================');
    console.error('❌ Type erreur:', error.name);
    console.error('❌ Message erreur:', error.message);
    console.error('📍 Stack:', error.stack);
    
    // Si c'est une erreur réseau, afficher plus de détails
    if (error.cause) {
      console.error('🔍 Cause:', error.cause);
    }
    
    console.error('❌ =========================================================\n');
    
    return {
      success: false,
      error: error.message,
      errorType: error.name
    };
  }
};

// Fonction pour recevoir un message (webhook)
export const handleIncomingMessage = async (webhookData) => {
  console.log('\n📨 ==================== MESSAGE REÇU ====================');
  console.log('📱 Instance:', webhookData.instanceData?.wid || 'non défini');
  console.log('👤 Expéditeur:', webhookData.senderData?.sender || 'non défini');
  console.log('💬 Message:', webhookData.messageData?.textMessageData?.textMessage || 'non défini');
  console.log('⏰ Timestamp:', webhookData.timestamp || 'non défini');
  console.log('📨 =========================================================\n');

  // Extraire les infos
  const senderPhone = webhookData.senderData?.sender?.replace('@c.us', '').replace('@g.us', '');
  const messageText = webhookData.messageData?.textMessageData?.textMessage;

  if (!messageText) {
    console.log('⏭️ Message ignoré (pas de texte)');
    return { success: true, message: 'Message sans texte ignoré' };
  }

  // Répondre automatiquement
  const replyMessage = `Bonjour ! J'ai bien reçu votre message : "${messageText}"`;
  
  console.log('🤖 Envoi de la réponse automatique...');
  const result = await sendMessage(senderPhone, replyMessage);

  return {
    success: true,
    processed: true,
    responseSent: result.success
  };
};
