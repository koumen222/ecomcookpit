import WhatsAppLog from '../models/WhatsAppLog.js';

let whatsappProvider = null;
let providerType = null;
let warmupCompleted = false; // Flag pour le warm-up

const initWhatsAppService = async () => {
  // Configuration Green API uniquement
  const greenApiId = process.env.GREEN_API_ID_INSTANCE;
  const greenApiToken = process.env.GREEN_API_TOKEN_INSTANCE;
  
  if (greenApiId && greenApiToken) {
    providerType = 'green_api';
    // ✅ 1️⃣ Utiliser l'URL correcte de Green API
    const apiUrl = process.env.GREEN_API_URL || 'https://api.green-api.com';
    whatsappProvider = {
      idInstance: greenApiId,
      apiTokenInstance: greenApiToken,
      apiUrl: apiUrl
    };
    
    console.log('✅ Service WhatsApp Green API configuré');
    console.log(`   - Instance ID: ${greenApiId}`);
    console.log(`   - API URL: ${whatsappProvider.apiUrl}`);
    
    // Warm-up automatique pour Green API
    warmupCompleted = false;
    return;
  }
  
  // Green API non configuré
  throw new Error('Variables d\'environnement GREEN_API_ID_INSTANCE et GREEN_API_TOKEN_INSTANCE requises');
};

/**
 * Nettoie et normalise un numéro de téléphone
 * Supprime espaces, +, tirets, parenthèses
 * Conserve uniquement les chiffres
 */
const sanitizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return null;
  }
  
  // Supprimer tous les caractères non numériques
  let cleaned = phone.replace(/\D/g, '');
  
  // Si vide après nettoyage, retourner null
  if (!cleaned || cleaned.length === 0) {
    return null;
  }
  
  return cleaned;
};

/**
 * Vérifie si un numéro de téléphone est valide
 * Doit commencer par un indicatif pays valide
 * Doit avoir une longueur raisonnable (8-15 chiffres)
 */
const isValidPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  const cleaned = sanitizePhoneNumber(phone);
  if (!cleaned) {
    return false;
  }
  
  // Liste des indicatifs pays courants (à étendre selon vos besoins)
  const countryCodes = [
    '237', // Cameroun
    '221', // Sénégal
    '229', // Bénin
    '226', // Burkina Faso
    '225', // Côte d'Ivoire
    '223', // Mali
    '241', // Gabon
    '242', // Congo
    '33',  // France
    '1',   // USA/Canada
    '212', // Maroc
    '213', // Algérie
    '216', // Tunisie
    '20',  // Égypte
    '234', // Nigeria
    '254', // Kenya
    '27',  // Afrique du Sud
  ];
  
  // Vérifier si le numéro commence par un indicatif valide
  const hasValidCountryCode = countryCodes.some(code => cleaned.startsWith(code));
  
  // Vérifier la longueur (8-15 chiffres est une plage raisonnable)
  const isValidLength = cleaned.length >= 8 && cleaned.length <= 15;
  
  return hasValidCountryCode && isValidLength;
};

/**
 * Vérifie si un numéro possède WhatsApp via Green API
 * Retourne { exists: boolean, error: string|null }
 * Note: Cette fonction est optionnelle, le retry intelligent gère mieux les erreurs
 */
const checkWhatsappNumber = async (phone) => {
  if (!whatsappProvider || providerType !== 'green_api') {
    return { exists: true, error: null };
  }
  
  const cleaned = sanitizePhoneNumber(phone);
  if (!cleaned || !isValidPhoneNumber(cleaned)) {
    return { exists: false, error: 'Numéro invalide' };
  }
  
  try {
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;
    const apiUrl = whatsappProvider.apiUrl || `https://${whatsappProvider.idInstance}.api.greenapi.com`;
    const endpoint = `${apiUrl}/waInstance${whatsappProvider.idInstance}/checkWhatsapp/${whatsappProvider.apiTokenInstance}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: cleaned
      })
    });
    
    // ✅ 6️⃣ Sécuriser le JSON.parse
    const responseText = await response.text();
    
    if (!responseText || responseText.trim() === '') {
      return { exists: false, error: `Réponse vide Green API (HTTP ${response.status})` };
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (err) {
      return { exists: false, error: `Réponse non JSON valide (HTTP ${response.status})` };
    }
    
    if (!response.ok) {
      if (response.status === 466) {
        return { exists: false, error: 'Numéro invalide (HTTP 466)' };
      }
      return { exists: false, error: data.error || `HTTP ${response.status}` };
    }
    
    if (data.exists === false) {
      return { exists: false, error: 'Numéro sans WhatsApp' };
    }
    
    return { exists: true, error: null };
  } catch (error) {
    // En cas d'erreur de vérification, on assume que ça existe pour ne pas bloquer
    return { exists: true, error: null };
  }
};

/**
 * Fonction de délai (sleep)
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Normalise un numéro de téléphone (fonction legacy pour compatibilité)
 */
const normalizePhone = (phone) => {
  const cleaned = sanitizePhoneNumber(phone);
  return cleaned || phone; // Fallback sur le numéro original si nettoyage échoue
};

/**
 * Warm-up automatique pour Green API
 * Envoie 2-3 messages de test vers des numéros de confiance pour réveiller la session
 * Ces messages ne créent PAS de logs dans la base de données (pas de campaignId)
 */
const performWarmup = async () => {
  if (warmupCompleted || !whatsappProvider || providerType !== 'green_api') {
    return;
  }
  
  // Numéros de confiance pour le warm-up (peuvent être configurés via env)
  const warmupPhones = process.env.WHATSAPP_WARMUP_PHONES 
    ? process.env.WHATSAPP_WARMUP_PHONES.split(',').map(p => p.trim()).filter(p => p)
    : [];
  
  if (warmupPhones.length === 0) {
    warmupCompleted = true;
    return;
  }
  
  const warmupMessage = 'Test warm-up';
  let successCount = 0;
  
  for (let i = 0; i < Math.min(warmupPhones.length, 3); i++) {
    const phone = sanitizePhoneNumber(warmupPhones[i]);
    if (!phone || !isValidPhoneNumber(phone)) {
      continue;
    }
    
    try {
      const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;
      const apiUrl = whatsappProvider.apiUrl || `https://${whatsappProvider.idInstance}.api.greenapi.com`;
      const endpoint = `${apiUrl}/waInstance${whatsappProvider.idInstance}/sendMessage/${whatsappProvider.apiTokenInstance}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: `${phone}@c.us`,
          message: warmupMessage
        })
      });
      
      // ✅ 6️⃣ Sécuriser le JSON.parse
      const responseText = await response.text();
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (err) {
        // Erreur silencieuse pour le warm-up
        continue;
      }
      
      // Utiliser les VRAIES réponses de l'API Green API
      if (response.ok && data.idMessage) {
        successCount++;
      }
      
      // Délai entre chaque message de warm-up
      if (i < Math.min(warmupPhones.length, 3) - 1) {
        await sleep(7000);
      }
    } catch (error) {
      // Erreur silencieuse pour le warm-up
    }
  }
  
  warmupCompleted = true;
};

/**
 * Envoie un message WhatsApp (fonction interne, appelée par sendMessageWithDelay)
 * Cette fonction ne gère PAS le retry, elle fait juste un essai unique
 * ⚠️ IMPORTANT: Cette fonction REJETTE immédiatement les numéros mal formatés
 * 🆕 ANTI-SPAM: Validation du contenu avant envoi
 */
const sendWhatsAppMessage = async ({ to, message, campaignId, previewId, userId, firstName, attemptNumber = 1 }) => {
  if (!whatsappProvider || providerType !== 'green_api') {
    throw new Error('Service WhatsApp Green API non configuré');
  }
  
  // Warm-up automatique (une seule fois)
  if (!warmupCompleted) {
    await performWarmup();
  }
  
  // 1️⃣ Nettoyage du numéro (OBLIGATOIRE)
  const cleanedPhone = sanitizePhoneNumber(to);
  if (!cleanedPhone) {
    throw new Error('Numéro de téléphone invalide ou vide');
  }
  
  // 2️⃣ Validation STRICTE du format (OBLIGATOIRE)
  if (!isValidPhoneNumber(cleanedPhone)) {
    throw new Error(`Numéro invalide: ${cleanedPhone} (doit commencer par un indicatif pays valide et avoir 8-15 chiffres)`);
  }
  
  // 🆕 3️⃣ VALIDATION ANTI-SPAM du contenu
  if (!validateMessageBeforeSend(message, userId)) {
    throw new Error('Message rejeté - risque spam trop élevé');
  }
  
  const whatsappLog = new WhatsAppLog({
    campaignId,
    previewId,  // ✅ Ajouter previewId pour les previews
    userId,
    phone: cleanedPhone,
    firstName: firstName || null,
    messageSent: message || null,
    status: 'pending'
  });
  
  try {
    // 🆕 Simulation de comportement humain avant envoi
    await simulateHumanBehavior();
    
    const fetchModule = await import('node-fetch');
    const fetch = fetchModule.default;
    
    // Envoi via Green API uniquement
    const apiUrl = whatsappProvider.apiUrl;
    const endpoint = `${apiUrl}/waInstance${whatsappProvider.idInstance}/sendMessage/${whatsappProvider.apiTokenInstance}`;
    
    // 🆕 Log "1 fois" pour vérifier l'URL appelée
    console.log('[GreenAPI] POST', endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatId: `${cleanedPhone}@c.us`,
        message: message
      })
    });
    
    // ✅ 2️⃣ Sécuriser le JSON.parse
    const responseText = await response.text();
    
    // ✅ 4️⃣ Logs de debug temporaires
    console.log('� ENDPOINT:', endpoint);
    console.log('🔎 STATUS:', response.status);
    console.log('🔎 RAW:', responseText);
    
    if (!responseText || responseText.trim() === '') {
      throw new Error(`Réponse vide Green API (HTTP ${response.status})`);
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (err) {
      throw new Error(`Réponse non JSON valide (HTTP ${response.status}): ${err.message}`);
    }
    
    // Utiliser les VRAIS logs de l'API Green API
    // Gestion de l'erreur HTTP 466 (vraie réponse de l'API)
    if (response.status === 466) {
      const apiError = data.error || data.errorMessage || `HTTP ${response.status}`;
      whatsappLog.status = 'failed';
      whatsappLog.error = apiError;
      whatsappLog.providerResponse = {
        error: apiError,
        statusCode: response.status,
        apiResponse: data
      };
      await whatsappLog.save();
      throw new Error('HTTP_466'); // Code spécial pour déclencher le retry dans la fonction appelante
    }
    
    // Autres erreurs HTTP (vraies réponses de l'API)
    if (!response.ok) {
      const errorMsg = data.error || data.errorMessage || `HTTP ${response.status}`;
      whatsappLog.status = 'failed';
      whatsappLog.error = errorMsg;
      whatsappLog.providerResponse = {
        error: errorMsg,
        statusCode: response.status,
        apiResponse: data
      };
      await whatsappLog.save();
      throw new Error(`Erreur Green API: ${errorMsg}`);
    }
    
    // Erreur dans la réponse JSON (vraie réponse de l'API)
    if (data.error) {
      const errorMsg = data.error || data.errorMessage || 'Erreur Green API';
      whatsappLog.status = 'failed';
      whatsappLog.error = errorMsg;
      whatsappLog.providerResponse = {
        error: data.error,
        errorMessage: data.errorMessage,
        apiResponse: data
      };
      await whatsappLog.save();
      throw new Error(errorMsg);
    }
    
    // Succès (vraie réponse de l'API avec idMessage)
    whatsappLog.status = data.idMessage ? 'sent' : 'failed';
    whatsappLog.messageId = data.idMessage;
    whatsappLog.providerResponse = {
      idMessage: data.idMessage,
      timestamp: data.timestamp,
      status: data.status || 'sent',
      apiResponse: data
    };
    
    whatsappLog.sentAt = new Date();
    await whatsappLog.save();
    
    return { success: true, logId: whatsappLog._id, messageId: whatsappLog.messageId, apiResponse: data };
  } catch (error) {
    // Ne sauvegarder le log que si ce n'est pas déjà fait
    if (whatsappLog.status === 'pending') {
      whatsappLog.status = 'failed';
      whatsappLog.error = error.message;
      await whatsappLog.save();
    }
    
    // Propager l'erreur pour que la fonction appelante gère le retry
    throw error;
  }
};

/**
 * Envoie un message WhatsApp avec retry intelligent pour HTTP 466
 * Chaque numéro est traité INDÉPENDAMMENT avec son propre compteur d'essais
 * ⚠️ IMPORTANT: Distinction entre HTTP 466 "limite atteinte" et HTTP 466 "numéro invalide"
 * ⚠️ IMPORTANT: Les numéros mal formatés sont REJETÉS immédiatement (pas de retry)
 */
const sendMessageWithDelay = async (messageData, isRateLimit = false) => {
  const originalPhone = messageData.to;
  
  // VALIDATION PRÉALABLE STRICTE (avant même d'essayer d'envoyer)
  // Nettoyer et valider le numéro AVANT toute tentative d'envoi
  const cleanedPhone = sanitizePhoneNumber(originalPhone);
  if (!cleanedPhone) {
    return { 
      success: false, 
      phone: originalPhone, 
      error: 'Numéro vide après nettoyage',
      skipped: true
    };
  }
  
  if (!isValidPhoneNumber(cleanedPhone)) {
    return { 
      success: false, 
      phone: cleanedPhone, 
      error: 'Format de numéro invalide (doit commencer par un indicatif pays valide et avoir 8-15 chiffres)',
      skipped: true
    };
  }
  
  // Mettre à jour le numéro nettoyé pour l'envoi
  messageData.to = cleanedPhone;
  
  // Compteur d'essais LOCAL à ce numéro (jamais global)
  let attempts = 0;
  const maxAttempts = 2; // Maximum 2 essais par numéro
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Tentative d'envoi avec le numéro d'essai
      // Le numéro est déjà validé et nettoyé, donc sendWhatsAppMessage ne devrait pas rejeter
      const result = await sendWhatsAppMessage({ 
        ...messageData, 
        attemptNumber: attempts 
      });
      
      // Succès : retourner immédiatement
      if (attempts > 1) {
        return { success: true, phone: cleanedPhone, ...result, retried: true };
      }
      
      return { success: true, phone: cleanedPhone, ...result };
      
    } catch (error) {
      const errorMessage = error.message || 'Erreur inconnue';
      
      // Si erreur de validation (format invalide), rejeter immédiatement (pas de retry)
      if (errorMessage.includes('invalide') || errorMessage.includes('vide')) {
        return { 
          success: false, 
          phone: cleanedPhone, 
          error: errorMessage,
          skipped: true,
          attempts: attempts
        };
      }
      
      // Gestion spécifique du HTTP 466 (vraie réponse de l'API)
      if (errorMessage === 'HTTP_466' || errorMessage.includes('HTTP 466')) {
        // Si c'est un retry après une pause (limite de débit), attendre plus longtemps
        if (isRateLimit && attempts === 1) {
          await sleep(15000);
          continue;
        }
        
        // Si c'est le premier essai normal, on retry
        if (attempts === 1) {
          await sleep(10000);
          continue;
        } else {
          // 2ème essai aussi en HTTP 466 : ce numéro est vraiment invalide (vraie réponse API)
          return { 
            success: false, 
            phone: cleanedPhone, 
            error: 'Numéro invalide (HTTP 466 après 2 tentatives)',
            skipped: true,
            attempts: attempts
          };
        }
      }
      
      // Autres erreurs : ne pas retry, retourner l'erreur (vraie réponse API)
      return { 
        success: false, 
        phone: cleanedPhone, 
        error: errorMessage,
        attempts: attempts
      };
    }
  }
  
  // Ne devrait jamais arriver ici, mais sécurité
  return { 
    success: false, 
    phone: cleanedPhone, 
    error: 'Nombre maximum d\'essais atteint',
    skipped: true
  };
};

/**
 * Envoie plusieurs messages WhatsApp de manière séquentielle avec délais
 * ⚠️ CRITIQUE: Green API limite à 3 messages actifs
 * Après 3 messages, attendre 10-15 secondes avant de continuer
 * 🆕 ANTI-SPAM: Délais augmentés et variation pour e-commerce
 */
const sendBulkWhatsApp = async (messages) => {
  const results = [];
  
  // 🆕 Délai entre chaque message: 30 secondes (comme demandé)
  const delayBetweenMessages = 30000; // 30 secondes (uniforme comme demandé)
  
  // Compteur de messages actifs (limite Green API: 3 messages)
  let activeMessages = 0;
  const MAX_ACTIVE_MESSAGES = 3; // Limite stricte Green API
  
  if (!whatsappProvider || providerType !== 'green_api') {
    throw new Error('Service WhatsApp Green API non configuré');
  }
  
  // Log initial uniquement pour le démarrage
  console.log(`📱 Envoi de ${messages.length} messages WhatsApp via Green API (mode anti-spam)`);
  
  // Warm-up automatique au début (une seule fois)
  if (!warmupCompleted) {
    await performWarmup();
  }
  
  for (let i = 0; i < messages.length; i++) {
    const messageData = messages[i];
    const originalPhone = messageData.to;
    
    // VALIDATION PRÉALABLE STRICTE (avant même d'appeler sendMessageWithDelay)
    // Nettoyer le numéro avant traitement
    const cleanedPhone = sanitizePhoneNumber(originalPhone);
    if (!cleanedPhone) {
      results.push({ 
        success: false, 
        phone: originalPhone, 
        error: 'Numéro vide après nettoyage',
        skipped: true
      });
      continue;
    }
    
    // Vérifier la validité STRICTE du format
    if (!isValidPhoneNumber(cleanedPhone)) {
      results.push({ 
        success: false, 
        phone: cleanedPhone, 
        error: 'Format de numéro invalide (doit commencer par un indicatif pays valide et avoir 8-15 chiffres)',
        skipped: true
      });
      continue;
    }
    
    // 🆕 VALIDATION ANTI-SPAM du contenu
    if (!validateMessageBeforeSend(messageData.message, messageData.userId)) {
      results.push({ 
        success: false, 
        phone: cleanedPhone, 
        error: 'Message rejeté - risque spam trop élevé',
        skipped: true
      });
      continue;
    }
    
    // Mettre à jour le numéro nettoyé et validé
    messageData.to = cleanedPhone;
    
    // ⚠️ GESTION DE LA LIMITE DE 3 MESSAGES ACTIFS
    // Vérifier AVANT d'envoyer le message
    let justPaused = false;
    if (activeMessages >= MAX_ACTIVE_MESSAGES) {
      const pauseTime = 15000; // 15 secondes (augmenté)
      console.log(`⏸️ Pause de ${Math.round(pauseTime / 1000)}s (limite de 3 messages actifs)`);
      await sleep(pauseTime);
      activeMessages = 0; // Réinitialiser le compteur
      justPaused = true; // Marquer qu'on vient de faire une pause
    }
    
    // Envoyer UNIQUEMENT aux numéros bien formatés
    // sendMessageWithDelay fera une double vérification pour sécurité
    // Passer isRateLimit=true si on vient de faire une pause (pour distinguer limite de numéro invalide)
    const result = await sendMessageWithDelay(messageData, justPaused);
    results.push(result);
    
    // Incrémenter le compteur seulement si succès
    // Un message réussi compte comme un message actif
    if (result.success) {
      activeMessages++;
    }
    
    // 🆕 Délai OBLIGATOIRE entre chaque message avec variation (ANTI-BLOCAGE)
    if (i < messages.length - 1) {
      if (result.retried) {
        // Si retry effectué, le délai de 10s a déjà été pris dans le retry
        // On attend juste un peu plus pour éviter le rate limiting
        await sleep(4000); // 4 secondes supplémentaires après un retry
      } else {
        // 🆕 Pas de retry, délai variable avec variation humaine
        const variableDelay = getHumanDelayWithVariation();
        const delaySeconds = Math.round(variableDelay / 1000);
        console.log(`   ⏱️ Délai variable de ${delaySeconds}s avant le prochain message...`);
        await sleep(variableDelay);
      }
    }
    
    // Afficher la progression tous les 10 messages (statistiques basées sur les vraies réponses API)
    if ((i + 1) % 10 === 0) {
      const successCount = results.filter(r => r.success).length;
      const skippedCount = results.filter(r => r.skipped).length;
      const failedCount = results.filter(r => !r.success && !r.skipped).length;
      console.log(`📊 Progression: ${i + 1}/${messages.length} | ✅ ${successCount} | ⚠️ ${skippedCount} | ❌ ${failedCount}`);
    }
  }
  
  // Statistiques finales basées sur les vraies réponses de l'API
  const successCount = results.filter(r => r.success).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const failedCount = results.filter(r => !r.success && !r.skipped).length;
  
  console.log(`✅ Envoi terminé (mode anti-spam): ${successCount}/${messages.length} succès | ${skippedCount} ignorés | ${failedCount} échecs`);
  
  return results;
};

/**
 * Envoie un message en 2 parties et les envoie séquentiellement
 * 1. "Salut [PRENOM]"
 * 2. Attendre 4 secondes
 * 3. Suite du message + lien
 */
const sendMessageInParts = async ({ to, message, campaignId, userId, firstName }) => {
  // Remplacer [PRENOM] dans le message complet d'abord
  let fullMessage = message;
  if (firstName) {
    fullMessage = fullMessage.replace(/\[PRENOM\]/g, firstName);
    console.log(`📝 [sendMessageInParts] Prénom remplacé pour ${to}: ${firstName}`);
  } else if (fullMessage && fullMessage.includes('[PRENOM]')) {
    // Si pas de prénom mais [PRENOM] présent, le supprimer
    fullMessage = fullMessage.replace(/\[PRENOM\]/g, '');
    console.log(`⚠️ [sendMessageInParts] Pas de prénom pour ${to}, [PRENOM] supprimé`);
  }
  
  const part1 = firstName ? `Salut ${firstName}` : 'Salut';
  const part2 = fullMessage.trim();
  
  const results = [];
  
  // Envoyer la partie 1
  if (part1.trim()) {
    try {
      const result1 = await sendWhatsAppMessage({
        to,
        message: part1.trim(),
        campaignId,
        userId,
        firstName,
        attemptNumber: 1
      });
      results.push({ part: 1, ...result1 });
      
      // Attendre 4 secondes avant la partie 2
      await sleep(4000);
    } catch (error) {
      results.push({ part: 1, success: false, error: error.message });
      return { success: false, results, error: 'Erreur envoi partie 1' };
    }
  }
  
  // Envoyer la partie 2
  if (part2) {
    try {
      const result2 = await sendWhatsAppMessage({
        to,
        message: part2,
        campaignId,
        userId,
        firstName,
        attemptNumber: 1
      });
      results.push({ part: 2, ...result2 });
    } catch (error) {
      results.push({ part: 2, success: false, error: error.message });
      return { success: false, results, error: 'Erreur envoi partie 2' };
    }
  }
  
  // Succès si toutes les parties ont été envoyées
  const allSuccess = results.every(r => r.success);
  return { 
    success: allSuccess, 
    results,
    message: allSuccess ? 'Message envoyé en 2 parties' : 'Erreur lors de l\'envoi de certaines parties'
  };
};

/**
 * Sélectionne une variante aléatoire parmi les variantes disponibles
 * @param {string[]} variants - Tableau de variantes de messages
 * @returns {string} - Une variante aléatoire
 */
const getRandomVariant = (variants) => {
  if (!variants || variants.length === 0) {
    return null;
  }
  // Filtrer les variantes vides
  const validVariants = variants.filter(v => v && v.trim());
  if (validVariants.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * validVariants.length);
  return validVariants[randomIndex].trim();
};

/**
 * Génère un délai de 30 secondes entre chaque message
 * @returns {number} - Délai en millisecondes (30000ms)
 */
const getHumanDelay = () => {
  return 30 * 1000; // 30 secondes exact
};

/**
 * Génère une pause longue de 5 minutes
 * @returns {number} - Délai en millisecondes (300000ms)
 */
const getLongPause = () => {
  return 5 * 60 * 1000; // 5 minutes (fixe)
};

/**
 * Vérifie si l'heure actuelle est dans la plage horaire autorisée (08h00 - 19h00)
 * @returns {boolean} - true si dans la plage autorisée
 */
const checkTimeWindow = () => {
  const now = new Date();
  const hour = now.getHours();
  // Plage horaire : 08h00 - 19h00
  return hour >= 8 && hour < 19;
};

// Map pour stocker les connexions SSE par campaignId
const sseConnections = new Map();

/**
 * Émet un événement SSE pour une campagne
 */
const emitCampaignEvent = (campaignId, event, data) => {
  const connections = sseConnections.get(campaignId);
  if (connections && connections.length > 0) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    connections.forEach(res => {
      try {
        res.write(message);
      } catch (error) {
        console.error('Erreur envoi SSE:', error);
      }
    });
  }
};

/**
 * Ajoute une connexion SSE pour une campagne
 */
const addSSEConnection = (campaignId, res) => {
  if (!sseConnections.has(campaignId)) {
    sseConnections.set(campaignId, []);
  }
  sseConnections.get(campaignId).push(res);
  
  // Nettoyer la connexion quand elle se ferme
  res.on('close', () => {
    const connections = sseConnections.get(campaignId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
      if (connections.length === 0) {
        sseConnections.delete(campaignId);
      }
    }
  });
};

/**
 * Envoie une newsletter WhatsApp avec variantes et rythme humain
 * - Sélection aléatoire d'une variante par contact
 * - Délai de 30 secondes entre chaque message
 * - Pause de 5 minutes toutes les 10 personnes
 * - Vérification de la plage horaire (08h-19h)
 * - Gestion des erreurs 466 (quota) avec pause immédiate
 * 
 * @param {Array} contacts - Tableau de contacts avec { to, userId, campaignId, profileLink? }
 * @param {string[]} variants - Tableau de variantes de messages (1 à 3)
 * @param {Function} onProgress - Callback de progression (index, total, stats)
 * @returns {Promise<Object>} - Résultats de l'envoi
 */
const sendNewsletterCampaign = async (contacts, variants, onProgress = null) => {
  const results = [];
  let paused = false;
  let quotaReached = false;
  
  if (!whatsappProvider || providerType !== 'green_api') {
    throw new Error('Service WhatsApp Green API non configuré');
  }
  
  // Vérifier la plage horaire
  if (!checkTimeWindow()) {
    throw new Error('Envoi autorisé uniquement entre 08h00 et 19h00');
  }
  
  // Filtrer les variantes valides
  const validVariants = variants.filter(v => v && v.trim());
  if (validVariants.length === 0) {
    throw new Error('Au moins une variante valide doit être fournie');
  }
  
  // Warm-up automatique au début (une seule fois)
  if (!warmupCompleted) {
    await performWarmup();
  }
  
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < contacts.length; i++) {
    // Vérifier si on doit faire une pause longue (toutes les 10 personnes)
    if (i > 0 && i % 10 === 0 && !paused) {
      const pauseDuration = getLongPause();
      const pauseMinutes = Math.round(pauseDuration / 60000);
      console.log(`⏸️ Pause longue de ${pauseMinutes} minutes après ${i} messages...`);
      await sleep(pauseDuration);
      paused = false; // Réinitialiser le flag après la pause
    }
    
    // Vérifier la plage horaire avant chaque envoi
    if (!checkTimeWindow()) {
      console.log(`⏰ Plage horaire dépassée (08h-19h), arrêt de la campagne`);
      quotaReached = true;
      break;
    }
    
    const contact = contacts[i];
    const originalPhone = contact.to;
    
    // VALIDATION PRÉALABLE STRICTE
    const cleanedPhone = sanitizePhoneNumber(originalPhone);
    if (!cleanedPhone) {
      results.push({ 
        success: false, 
        phone: originalPhone, 
        error: 'Numéro vide après nettoyage',
        skipped: true
      });
      skippedCount++;
      continue;
    }
    
    if (!isValidPhoneNumber(cleanedPhone)) {
      results.push({ 
        success: false, 
        phone: cleanedPhone, 
        error: 'Format de numéro invalide',
        skipped: true
      });
      skippedCount++;
      continue;
    }
    
    // Sélectionner une variante aléatoire pour ce contact
    let selectedVariant = getRandomVariant(validVariants);
    if (!selectedVariant) {
      results.push({ 
        success: false, 
        phone: cleanedPhone, 
        error: 'Aucune variante valide disponible',
        skipped: true
      });
      skippedCount++;
      continue;
    }
    
    // Remplacer [LIEN_PROFIL] par le lien approprié (profil pour non-actifs, accueil pour actifs)
    if (contact.profileLink && selectedVariant.includes('[LIEN_PROFIL]')) {
      selectedVariant = selectedVariant.replace(/\[LIEN_PROFIL\]/g, contact.profileLink);
    }
    
    // Remplacer [PRENOM] par le prénom de l'utilisateur
    if (contact.firstName) {
      // Toujours remplacer [PRENOM] si un prénom est disponible
      selectedVariant = selectedVariant.replace(/\[PRENOM\]/g, contact.firstName);
      console.log(`✅ Prénom remplacé pour ${cleanedPhone}: ${contact.firstName}`);
    } else if (selectedVariant.includes('[PRENOM]')) {
      // Si pas de prénom disponible, remplacer par une chaîne vide
      selectedVariant = selectedVariant.replace(/\[PRENOM\]/g, '');
      console.log(`⚠️ Pas de prénom disponible pour ${cleanedPhone}, [PRENOM] supprimé`);
    }
    
    // Remplacer aussi les liens directs si présents dans les messages pré-définis
    // (pour les campagnes de bienvenue qui ont déjà le lien dans le message)
    // Pas besoin de modification supplémentaire car les messages sont déjà complets
    
    // Préparer le message avec la variante sélectionnée (et personnalisée)
    const messageData = {
      to: cleanedPhone,
      message: selectedVariant,
      campaignId: contact.campaignId,
      userId: contact.userId || null,
      firstName: contact.firstName || null
    };
    
    try {
      // Envoyer le message en 3 parties séparées avec délai de 4 secondes
      const result = await sendMessageInParts(messageData);
      
      // Émettre un événement SSE pour chaque partie envoyée
      if (result.results && result.results.length > 0) {
        result.results.forEach((partResult, idx) => {
          emitCampaignEvent(contact.campaignId, 'message', {
            phone: cleanedPhone,
            firstName: contact.firstName || '',
            message: idx === 0 ? 'Bonjour ' + (contact.firstName || '') + '...' : `Partie ${idx + 1}...`,
            status: partResult.success ? 'sent' : 'failed',
            error: partResult.error || null,
            timestamp: new Date().toISOString(),
            part: idx + 1
          });
        });
      }
      
      results.push({
        ...result,
        variant: selectedVariant.substring(0, 50) + '...' // Stocker un aperçu de la variante
      });
      
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        
        // Si erreur 466 (quota), faire une pause immédiate
        if (result.error && result.error.includes('HTTP 466')) {
          console.log(`⚠️ Erreur 466 détectée, pause immédiate de 5 minutes...`);
          await sleep(5 * 60 * 1000); // Pause de 5 minutes
          quotaReached = true;
          // Ne pas arrêter complètement, mais continuer avec prudence
        }
      }
      
      // Émettre un événement de progression
      emitCampaignEvent(contact.campaignId, 'progress', {
        current: i + 1,
        total: contacts.length,
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount
      });
      
      // Callback de progression
      if (onProgress) {
        onProgress(i + 1, contacts.length, {
          sent: sentCount,
          failed: failedCount,
          skipped: skippedCount,
          total: i + 1
        });
      }
      
      // Délai de 30 secondes entre chaque message
      // Sauf pour le dernier message
      if (i < contacts.length - 1 && !quotaReached) {
        const delay = getHumanDelay();
        const delaySeconds = Math.round(delay / 1000);
        console.log(`   ⏱️ Délai de ${delaySeconds} secondes avant le prochain message...`);
        await sleep(delay);
      }
      
    } catch (error) {
      failedCount++;
      results.push({ 
        success: false, 
        phone: cleanedPhone, 
        error: error.message || 'Erreur inconnue'
      });
      
      // Si erreur critique, arrêter
      if (error.message && error.message.includes('quota')) {
        quotaReached = true;
        break;
      }
    }
  }
  
  return {
    total: contacts.length,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
    quotaReached,
    results
  };
};

export {
  initWhatsAppService,
  sendWhatsAppMessage,
  sendBulkWhatsApp,
  sendNewsletterCampaign,
  sendMessageInParts,
  emitCampaignEvent,
  addSSEConnection,
  sanitizePhoneNumber,
  isValidPhoneNumber,
  checkWhatsappNumber,
  sendMessageWithDelay,
  getRandomVariant,
  getHumanDelay,
  getLongPause,
  checkTimeWindow,
  sleep,
  // 🆕 Fonctions anti-spam
  analyzeSpamRisk,
  validateMessageBeforeSend,
  getHumanDelayWithVariation,
  simulateHumanBehavior,
  getMessageWithRotation,
  monitorSpamMetrics
};

// ============================================
// 🆕 FONCTIONS ANTI-SPAM POUR E-COMMERCE
// ============================================

/**
 * Mots et patterns déclencheurs de spam à éviter
 */
const spamTriggers = [
  'GRATUIT', 'PROMOTION', 'OFFRE SPÉCIALE',
  'CLIQUEZ ICI', 'URGENT', 'LIMITÉ',
  'ACHETEZ MAINTENANT', '100% GRATUIT',
  'GAGNEZ', 'CONCOURS', 'BONUS',
  'ARGENT RAPIDE', 'DEVENEZ RICHE',
  'MULTI-LEVEL', 'MARKETING',
  'LIEN SPONSORISÉ', 'PUBLICITÉ',
  'DEMANDEZ', 'SOLLICITEZ', 'IMMÉDIAT'
];

/**
 * Analyse le risque de spam d'un message
 * @param {string} message - Message à analyser
 * @returns {Object} - Analyse de risque avec score et warnings
 */
const analyzeSpamRisk = (message) => {
  if (!message || typeof message !== 'string') {
    return { score: 0, risk: 'LOW', warnings: ['Message vide'] };
  }

  let riskScore = 0;
  const warnings = [];
  
  // Vérifier les mots déclencheurs (insensible à la casse)
  spamTriggers.forEach(trigger => {
    if (message.toUpperCase().includes(trigger)) {
      riskScore += 10;
      warnings.push(`Mot déclencheur: ${trigger}`);
    }
  });
  
  // Vérifier les formats problématiques
  if (message === message.toUpperCase() && message.length > 20) {
    riskScore += 5;
    warnings.push('Message entièrement en majuscules');
  }
  
  if ((message.match(/!/g) || []).length > 2) {
    riskScore += 5;
    warnings.push('Trop de points d\'exclamation');
  }
  
  if ((message.match(/\?/g) || []).length > 2) {
    riskScore += 3;
    warnings.push('Trop de points d\'interrogation');
  }
  
  // Vérifier les caractères répétitifs
  if (message.match(/(.)\1{3,}/)) {
    riskScore += 5;
    warnings.push('Caractères répétitifs détectés');
  }
  
  // Vérifier la longueur
  if (message.length > 500) {
    riskScore += 3;
    warnings.push('Message trop long (>500 caractères)');
  }
  
  if (message.length < 15) {
    riskScore += 2;
    warnings.push('Message très court (<15 caractères)');
  }
  
  // Vérifier les liens multiples
  const linkCount = (message.match(/https?:\/\//g) || []).length;
  if (linkCount > 1) {
    riskScore += 8;
    warnings.push('Multiples liens détectés');
  }
  
  // Vérifier les numéros de téléphone
  if (/\d{10,}/.test(message)) {
    riskScore += 6;
    warnings.push('Numéro de téléphone détecté dans le message');
  }
  
  return {
    score: riskScore,
    risk: riskScore > 15 ? 'HIGH' : riskScore > 8 ? 'MEDIUM' : 'LOW',
    warnings,
    recommendations: getRecommendations(riskScore, warnings)
  };
};

/**
 * Génère des recommandations basées sur l'analyse
 */
const getRecommendations = (score, warnings) => {
  const recommendations = [];
  
  if (score > 15) {
    recommendations.push('⚠️ Message à haut risque - Réécrire complètement');
  } else if (score > 8) {
    recommendations.push('🔄 Message à risque moyen - Modifier avant envoi');
  }
  
  if (warnings.some(w => w.includes('majuscules'))) {
    recommendations.push('✍️ Utiliser une casse normale (mixte)');
  }
  
  if (warnings.some(w => w.includes('points d\'exclamation'))) {
    recommendations.push('📝 Limiter à 1-2 points d\'exclamation maximum');
  }
  
  if (warnings.some(w => w.includes('Mot déclencheur'))) {
    recommendations.push('🚫 Remplacer les mots promotionnels par des alternatives');
  }
  
  if (warnings.some(w => w.includes('trop long'))) {
    recommendations.push('✂️ Raccourcir le message (<300 caractères idéalement)');
  }
  
  return recommendations;
};

/**
 * Valide un message avant envoi
 * @param {string} message - Message à valider
 * @param {string} userId - ID utilisateur pour tracking
 * @returns {boolean} - True si le message peut être envoyé
 */
const validateMessageBeforeSend = (message, userId) => {
  const analysis = analyzeSpamRisk(message);
  
  console.log(`🔍 Analyse spam pour message: score=${analysis.score}, risque=${analysis.risk}`);
  
  if (analysis.risk === 'HIGH') {
    console.error('🚫 MESSAGE REJETÉ - Risque spam élevé:', analysis.warnings);
    console.log('💡 Recommandations:', analysis.recommendations);
    return false;
  }
  
  if (analysis.risk === 'MEDIUM') {
    console.warn('⚠️ MESSAGE À RISQUE - Envoi avec délai prolongé:', analysis.warnings);
    // On peut quand même envoyer mais avec délai plus long
    return true;
  }
  
  console.log('✅ Message validé - Risque faible');
  return true;
};

/**
 * Génère un délai humain avec variation aléatoire
 * @returns {number} - Délai en millisecondes
 */
const getHumanDelayWithVariation = () => {
  // Délai fixe de 30 secondes comme demandé
  const baseDelay = 30000; // 30 secondes exact
  const variation = Math.random() * 1000 - 500; // ±0.5 secondes (variation minimale)
  const finalDelay = baseDelay + variation; // 29.5 à 30.5 secondes
  
  console.log(`⏱️ Délai humain calculé: ${Math.round(finalDelay / 1000)}s`);
  return finalDelay;
};

/**
 * Simule un comportement humain (lecture/écriture)
 */
const simulateHumanBehavior = async () => {
  // Simuler "l'écriture" du message
  const typingTime = Math.random() * 2000 + 1000; // 1-3 secondes
  console.log(`⌨️ Simulation d'écriture: ${Math.round(typingTime / 1000)}s`);
  await sleep(typingTime);
  
  // Simuler "la lecture" avant de répondre
  const readingTime = Math.random() * 3000 + 2000; // 2-5 secondes
  console.log(`👀 Simulation de lecture: ${Math.round(readingTime / 1000)}s`);
  await sleep(readingTime);
};

/**
 * Pool de messages variés pour éviter la répétition
 */
const messagePool = {
  greetings: [
    "Salut [PRENOM] ! 😊",
    "Bonjour [PRENOM] ! Comment allez-vous ?",
    "Hey [PRENOM] ! J'espère que vous passez une bonne journée 👋",
    "Bonjour [PRENOM] ! Je pense à vous aujourd'hui",
    "Salut [PRENOM] ! Tout va bien ?"
  ],
  
  content_intro: [
    "Je voulais partager quelque chose d'intéressant avec vous...",
    "Petite découverte qui pourrait vous plaire...",
    "Je suis tombé sur ça et ça m'a fait penser à vous...",
    "J'ai quelque chose qui pourrait vous intéresser...",
    "Petite info qui pourrait être utile pour vous..."
  ],
  
  followup: [
    "Qu'en pensez-vous ?",
    "Ça vous intéresse de savoir plus ?",
    "N'hésitez pas si vous avez des questions !",
    "Dites-moi ce que vous en pensez...",
    "Votre avis m'intéresse !"
  ],
  
  closing: [
    "Bonne journée !",
    "À bientôt peut-être 😊",
    "Passez une belle journée !",
    "Au plaisir de vous lire",
    "Prenez soin de vous !"
  ]
};

/**
 * Sélectionne un message avec rotation pour éviter la répétition
 * @param {string} userId - ID utilisateur
 * @param {string} messageType - Type de message
 * @returns {string} - Message sélectionné
 */
const getMessageWithRotation = (userId, messageType) => {
  const messages = messagePool[messageType];
  if (!messages || messages.length === 0) {
    return '';
  }
  
  // Pour l'instant, sélection aléatoire simple
  // TODO: Implémenter un système de mémoire des messages envoyés
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};

/**
 * Monitor les métriques anti-spam pour une campagne
 * @param {string} campaignId - ID de la campagne
 * @returns {Object} - Métriques et alertes
 */
const monitorSpamMetrics = async (campaignId) => {
  try {
    const logModule = await import('../models/WhatsAppLog.js');
    const WhatsAppLog = logModule.default;
    const logs = await WhatsAppLog.find({ campaignId });
    
    if (logs.length === 0) {
      return { total: 0, metrics: {}, alerts: [] };
    }
    
    const metrics = {
      total: logs.length,
      sent: logs.filter(l => l.status === 'sent').length,
      delivered: logs.filter(l => l.status === 'delivered').length,
      read: logs.filter(l => l.status === 'read').length,
      failed: logs.filter(l => l.status === 'failed').length,
      pending: logs.filter(l => l.status === 'pending').length,
      
      delivery_rate: 0,
      read_rate: 0,
      failure_rate: 0,
      response_rate: 0
    };
    
    // Calculer les taux
    metrics.delivery_rate = metrics.delivered / metrics.total;
    metrics.read_rate = metrics.read / metrics.total;
    metrics.failure_rate = metrics.failed / metrics.total;
    
    const alerts = [];
    
    // Alertes selon les seuils
    if (metrics.delivery_rate < 0.85) {
      alerts.push({
        level: 'WARNING',
        message: `Taux de livraison faible: ${Math.round(metrics.delivery_rate * 100)}%`,
        threshold: 85,
        current: Math.round(metrics.delivery_rate * 100)
      });
    }
    
    if (metrics.failure_rate > 0.15) {
      alerts.push({
        level: 'ERROR',
        message: `Taux d'échec élevé: ${Math.round(metrics.failure_rate * 100)}%`,
        threshold: 15,
        current: Math.round(metrics.failure_rate * 100)
      });
    }
    
    if (metrics.read_rate < 0.20 && metrics.delivered > 10) {
      alerts.push({
        level: 'INFO',
        message: `Taux de lecture faible: ${Math.round(metrics.read_rate * 100)}%`,
        threshold: 20,
        current: Math.round(metrics.read_rate * 100)
      });
    }
    
    console.log(`📊 Métriques campagne ${campaignId}:`, {
      total: metrics.total,
      delivery: `${Math.round(metrics.delivery_rate * 100)}%`,
      read: `${Math.round(metrics.read_rate * 100)}%`,
      failure: `${Math.round(metrics.failure_rate * 100)}%`,
      alerts: alerts.length
    });
    
    return {
      metrics,
      alerts,
      recommendation: getOverallRecommendation(metrics, alerts)
    };
    
  } catch (error) {
    console.error('❌ Erreur monitoring spam metrics:', error);
    return { error: error.message };
  }
};

/**
 * Génère une recommandation globale basée sur les métriques
 */
const getOverallRecommendation = (metrics, alerts) => {
  if (alerts.some(a => a.level === 'ERROR')) {
    return {
      action: 'STOP_CAMPAIGN',
      reason: 'Taux d\'échec critique détecté',
      priority: 'HIGH'
    };
  }
  
  if (alerts.some(a => a.level === 'WARNING')) {
    return {
      action: 'SLOW_DOWN',
      reason: 'Performance sous les seuils optimaux',
      priority: 'MEDIUM'
    };
  }
  
  if (metrics.delivery_rate > 0.95 && metrics.read_rate > 0.40) {
    return {
      action: 'CONTINUE',
      reason: 'Performance excellente',
      priority: 'LOW'
    };
  }
  
  return {
    action: 'MONITOR',
    reason: 'Performance acceptable',
    priority: 'LOW'
  };
};
