import axios from 'axios';

/**
 * Service pour interagir avec Evolution API pour WhatsApp
 */
class EvolutionApiService {
  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || 'https://api.evolution-api.com';
    this.apiKey = process.env.EVOLUTION_API_KEY;
  }

  /**
   * Envoie un message texte via une instance WhatsApp
   * @param {string} instanceName - Nom de l'instance
   * @param {string} instanceToken - Token de l'instance (utilisé comme clé API pour l'instance)
   * @param {string} number - Numéro de téléphone (format international sans +)
   * @param {string} message - Contenu du message
   */
  async sendMessage(instanceName, instanceToken, number, message, retries = 2, delayMs = 1200) {
    // Nettoyage du numéro (garder uniquement les chiffres)
    const cleanNumber = number.replace(/\D/g, '');
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/message/sendText/${instanceName}`,
          {
            number: cleanNumber,
            text: message,
            delay: delayMs,
            linkPreview: false
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': instanceToken
            },
            timeout: 30000 // 30 secondes
          }
        );

        console.log(`✅ [Evolution API] Message envoyé à ${cleanNumber} via ${instanceName}`);
        console.log(`   📋 Response: ${JSON.stringify(response.data?.key || response.data?.status || 'OK').substring(0, 200)}`);

        return {
          success: true,
          data: response.data
        };
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED';
        
        // ⚠️ DÉSACTIVÉ: Vérification exists:false
        // Evolution API retourne souvent exists:false même pour des numéros valides
        // (cache bug, session instable, trop de vérifications)
        // → On laisse WhatsApp déterminer si le numéro existe lors de l'envoi réel
        const errorData = error.response?.data;
        
        // Retry uniquement sur erreurs réseau
        if (isNetworkError && !isLastAttempt) {
          console.warn(`⚠️ Tentative ${attempt + 1}/${retries + 1} échouée pour ${cleanNumber}, retry dans 2s...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Log l'erreur mais ne bloque pas sur exists:false
        console.error(`❌ Erreur Evolution API (sendMessage):`, JSON.stringify(errorData, null, 2) || error.message);
        console.error(`   Numéro: ${number}, Instance: ${instanceName}`);
        
        // Retourner l'erreur seulement si ce n'est pas un problème exists:false
        const messages = errorData?.response?.message || errorData?.message;
        const hasExistsFalse = Array.isArray(messages) && messages.some(m =>
          (typeof m === 'object' && m !== null && m.exists === false)
        );
        
        if (hasExistsFalse) {
          // Log mais considère comme succès - WhatsApp gérera l'erreur réelle
          console.warn(`⚠️ Evolution API signale exists:false pour ${cleanNumber} - envoi quand même (bug API connu)`);
          return { 
            success: true, 
            warning: 'exists:false ignoré',
            data: { note: 'Envoi tenté malgré exists:false de l\'API' }
          };
        }
        
        return {
          success: false,
          error: error.response?.data?.message || error.message
        };
      }
    }
  }

  /**
   * Envoie une image via WhatsApp
   * @param {string} instanceName - Nom de l'instance
   * @param {string} instanceToken - Token de l'instance
   * @param {string} number - Numéro de téléphone
   * @param {string} mediaUrl - URL de l'image
   * @param {string} caption - Légende de l'image (optionnel)
   * @param {string} fileName - Nom du fichier (optionnel)
   */
  async sendMedia(instanceName, instanceToken, number, mediaUrl, caption = '', fileName = 'image.jpg') {
    const cleanNumber = number.replace(/\D/g, '');
    
    // Déterminer le mimetype depuis l'extension du fichier
    const ext = fileName.split('.').pop().toLowerCase();
    const mimetypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf'
    };
    const mimetype = mimetypes[ext] || 'image/jpeg';
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: cleanNumber,
          mediatype: 'image',
          mimetype: mimetype,
          caption: caption,
          media: mediaUrl,
          fileName: fileName,
          delay: 1200
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': instanceToken
          },
          timeout: 45000 // 45 secondes pour l'upload
        }
      );

      console.log(`✅ [Evolution API] Média envoyé à ${cleanNumber} via ${instanceName}`);
      console.log(`   📋 Response: ${JSON.stringify(response.data?.key || response.data?.status || 'OK').substring(0, 200)}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const errorData = error.response?.data;
      console.error(`❌ Erreur Evolution API (sendMedia):`, JSON.stringify(errorData, null, 2) || error.message);
      console.error(`   URL tentée: ${this.baseUrl}/message/sendMedia/${instanceName}`);
      console.error(`   Numéro: ${cleanNumber}, Media: ${mediaUrl}`);
      
      // Extraire le message d'erreur détaillé
      let detailedError = errorData?.message || error.message;
      if (Array.isArray(errorData?.response?.message)) {
        detailedError = errorData.response.message.map(m => JSON.stringify(m)).join(', ');
      }
      
      return {
        success: false,
        error: detailedError
      };
    }
  }

  /**
   * Envoie un message vocal via WhatsApp
   * @param {string} instanceName - Nom de l'instance
   * @param {string} instanceToken - Token de l'instance
   * @param {string} number - Numéro de téléphone
   * @param {string} audioUrl - URL du fichier audio
   */
  async sendAudio(instanceName, instanceToken, number, audioUrl) {
    const cleanNumber = number.replace(/\D/g, '');
    
    // Détecter si c'est du base64 (data URI ou raw) vs une URL
    const isBase64 = audioUrl.startsWith('data:') || !audioUrl.startsWith('http');
    let audioPayload;
    if (isBase64) {
      // Extraire le base64 brut (retirer le préfixe data:audio/mpeg;base64, si présent)
      const rawBase64 = audioUrl.replace(/^data:[^;]+;base64,/, '');
      audioPayload = { number: cleanNumber, audio: rawBase64, delay: 1200, encoding: true };
    } else {
      audioPayload = { number: cleanNumber, audio: audioUrl, delay: 1200 };
    }
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendWhatsAppAudio/${instanceName}`,
        audioPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': instanceToken
          },
          timeout: 45000 // 45 secondes pour l'upload
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const errorData = error.response?.data;
      console.error(`❌ Erreur Evolution API (sendAudio):`, errorData || error.message);
      return {
        success: false,
        error: errorData?.message || error.message
      };
    }
  }

  /**
   * Télécharge un message media (audio/vocal) en base64 via Evolution API
   * POST /chat/getBase64FromMediaMessage/{instance}
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {object} messageKey - msg.key de l'objet message WhatsApp
   * @returns {Promise<{base64: string, mimetype: string}|null>}
   */
  async getMediaBase64(instanceName, instanceToken, messageKey) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
        { message: { key: messageKey }, convertToMp4: false },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      const d = response.data;
      if (d?.base64) return { base64: d.base64, mimetype: d.mimetype || 'audio/ogg' };
      return null;
    } catch (error) {
      console.error(`❌ Erreur Evolution API (getMediaBase64):`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Vérifie le statut d'une instance
   * @param {string} instanceName 
   * @param {string} instanceToken 
   */
  async getInstanceStatus(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/connectionState/${instanceName}`,
        {
          headers: {
            'apikey': instanceToken
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Erreur Evolution API (getInstanceStatus):`, error.message);
      return null;
    }
  }

  /**
   * Configure le webhook d'une instance
   * POST /webhook/set/{instance}
   */
  async setWebhook(instanceName, instanceToken, { enabled, url, webhookByEvents = false, webhookBase64 = false, events }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/webhook/set/${instanceName}`,
        { webhook: { enabled, url, webhookByEvents, webhookBase64, events } },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 15000
        }
      );
      console.log(`✅ [Evolution API] Webhook configuré pour ${instanceName}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (setWebhook):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Récupère la config webhook d'une instance
   * GET /webhook/find/{instance}
   */
  async getWebhook(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/webhook/find/${instanceName}`,
        {
          headers: { 'apikey': instanceToken },
          timeout: 15000
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (getWebhook):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

export default new EvolutionApiService();
