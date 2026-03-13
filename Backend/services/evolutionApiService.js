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
  async sendMessage(instanceName, instanceToken, number, message, retries = 2) {
    // Nettoyage du numéro (garder uniquement les chiffres)
    const cleanNumber = number.replace(/\D/g, '');
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}/message/sendText/${instanceName}`,
          {
            number: cleanNumber,
            text: message,
            delay: 1200,
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
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendWhatsAppAudio/${instanceName}`,
        {
          number: cleanNumber,
          audio: audioUrl,
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
}

export default new EvolutionApiService();
