import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Déterminer le mimetype depuis l'extension du fichier ou de l'URL
    const urlForExt = mediaUrl.split('?')[0];
    const ext = (fileName.split('.').pop() || urlForExt.split('.').pop() || 'jpg').toLowerCase();
    const mimetypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
      'png': 'image/png', 'gif': 'image/gif',
      'webp': 'image/webp', 'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
      'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    let mimetype = mimetypes[ext] || 'image/jpeg';
    const videoExt = ['mp4', 'webm', 'mov', 'avi'];
    const documentExt = ['pdf', 'doc', 'docx'];
    const mediatype = videoExt.includes(ext)
      ? 'video'
      : documentExt.includes(ext)
        ? 'document'
        : 'image';

    // ── Résoudre le média : fichier local → base64, URL externe → envoi direct ──
    let mediaPayload = mediaUrl;
    console.log(`📸 [Evolution] sendMedia — URL source: ${mediaUrl}`);
    try {
      // Détecter si c'est une URL locale (api.scalor.net/uploads/...) → lire depuis le disque
      const localMatch = mediaUrl.match(/(?:https?:\/\/(?:api\.scalor\.net|localhost[:\d]*))\/uploads\/(.+)$/);
      if (localMatch) {
        const decodedFile = decodeURIComponent(localMatch[1]);
        const localPath = path.resolve(__dirname, '..', 'uploads', decodedFile);
        console.log(`📸 [Evolution] Fichier local détecté: ${localPath}`);
        if (fs.existsSync(localPath)) {
          const fileBuffer = fs.readFileSync(localPath);
          const b64 = fileBuffer.toString('base64');
          mediaPayload = `data:${mimetype};base64,${b64}`;
          console.log(`📸 [Evolution] Fichier local lu (${Math.round(fileBuffer.byteLength / 1024)} KB) → envoi base64`);
        } else {
          console.warn(`⚠️ [Evolution] Fichier local introuvable: ${localPath} — image perdue (stockage éphémère)`);
          return { success: false, error: `Fichier local introuvable: ${decodedFile} — l'image doit être re-uploadée vers R2` };
        }
      } else if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
        // URL externe (R2, CDN, etc.) → envoyer l'URL directement à Evolution API
        // Evolution API téléchargera l'image elle-même
        mediaPayload = mediaUrl;
        // Détecter le vrai mimetype depuis l'extension de l'URL
        const urlExt = urlForExt.split('.').pop()?.toLowerCase();
        if (urlExt && mimetypes[urlExt]) {
          mimetype = mimetypes[urlExt];
        }
        console.log(`📸 [Evolution] URL externe → envoi direct à Evolution API (mimetype: ${mimetype})`);
      }
    } catch (dlErr) {
      console.error(`❌ [Evolution] Erreur résolution média: ${dlErr.message}`);
      console.error(`   URL: ${mediaUrl}`);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: cleanNumber,
          mediatype,
          mimetype: mimetype,
          caption: caption,
          media: mediaPayload,
          fileName: fileName,
          delay: 1200
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 45000,
          maxBodyLength: 50 * 1024 * 1024
        }
      );

      console.log(`✅ [Evolution API] Média envoyé à ${cleanNumber} via ${instanceName}`);
      console.log(`   📋 Response: ${JSON.stringify(response.data?.key || response.data?.status || 'OK').substring(0, 200)}`);
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data;
      console.error(`❌ Erreur Evolution API (sendMedia):`, JSON.stringify(errorData, null, 2) || error.message);
      console.error(`   URL tentée: ${this.baseUrl}/message/sendMedia/${instanceName}`);
      console.error(`   Numéro: ${cleanNumber}, Media: ${mediaUrl}`);

      let detailedError = errorData?.message || error.message;
      if (Array.isArray(errorData?.response?.message)) {
        detailedError = errorData.response.message.map(m => JSON.stringify(m)).join(', ');
      }

      return { success: false, error: detailedError };
    }
  }

  /**
   * Envoie une vidéo via WhatsApp
   */
  async sendVideo(instanceName, instanceToken, number, videoUrl, caption = '', fileName = 'video.mp4') {
    const cleanNumber = number.replace(/\D/g, '');
    const ext = fileName.split('.').pop().toLowerCase();
    const mimetypes = { 'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo' };
    const mimetype = mimetypes[ext] || 'video/mp4';

    // ── Résoudre la vidéo : fichier local → base64, URL externe → envoi direct ──
    let mediaPayload = videoUrl;
    console.log(`🎬 [Evolution] sendVideo — URL source: ${videoUrl}`);
    try {
      // Détecter si c'est une URL locale (api.scalor.net/uploads/...) → lire depuis le disque
      const localMatch = videoUrl.match(/(?:https?:\/\/(?:api\.scalor\.net|localhost[:\d]*))\/uploads\/(.+)$/);
      if (localMatch) {
        const decodedFile = decodeURIComponent(localMatch[1]);
        const filePath = path.join(process.cwd(), 'uploads', decodedFile);
        const fileData = fs.readFileSync(filePath);
        mediaPayload = `data:${mimetype};base64,${fileData.toString('base64')}`;
        console.log(`🎬 [Evolution] Vidéo locale détectée → conversion base64`);
      }
    } catch (readErr) {
      console.warn(`⚠️ [Evolution] Impossible de lire vidéo locale, tentative URL directe:`, readErr.message);
      mediaPayload = videoUrl;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        { number: cleanNumber, mediatype: 'video', mimetype, caption, media: mediaPayload, fileName, delay: 1500 },
        { headers: { 'Content-Type': 'application/json', 'apikey': instanceToken }, timeout: 60000 }
      );
      console.log(`✅ [Evolution API] Vidéo envoyée à ${cleanNumber}`);
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data;
      console.error(`❌ Erreur Evolution API (sendVideo):`, JSON.stringify(errorData, null, 2) || error.message);
      console.error(`   URL tentée: ${videoUrl}`);
      console.error(`   Numéro: ${cleanNumber}`);
      let detailedError = errorData?.message || error.message;
      if (Array.isArray(errorData?.response?.message)) {
        detailedError = errorData.response.message.map(m => JSON.stringify(m)).join(', ');
      }
      return { success: false, error: detailedError };
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

  // ═══════════════════════════════════════════════════════════════
  // Test de connexion à Evolution API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Teste la connexion à l'Evolution API
   * @returns {Promise<{success: boolean, error?: string, details?: object}>}
   */
  async testConnection() {
    const masterKey = process.env.EVOLUTION_ADMIN_TOKEN || process.env.EVOLUTION_MASTER_API_KEY || this.apiKey;
    try {
      console.log(`🔍 [Evolution API] Test connexion vers ${this.baseUrl}`);
      console.log(`🔑 [Evolution API] Token: ${masterKey ? masterKey.substring(0, 8) + '...' : 'NON CONFIGURÉ'}`);

      const response = await axios.get(
        `${this.baseUrl}/instance/fetchInstances`,
        {
          headers: { 'apikey': masterKey },
          timeout: 10000,
        }
      );
      console.log(`✅ [Evolution API] Connexion OK - ${response.data?.length || 0} instance(s) existante(s)`);
      return { success: true, instances: response.data };
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`❌ [Evolution API] Échec connexion:`, { status, data: JSON.stringify(data), message: error.message });
      return {
        success: false,
        error: data?.message || error.message,
        status,
        details: data
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Création d'instance via Master API Key
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crée une nouvelle instance WhatsApp sur Evolution API
   * Utilise la MASTER API KEY (globale) pour créer l'instance
   * @param {string} instanceName - Nom unique pour l'instance
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async createInstance(instanceName) {
    const masterKey = process.env.EVOLUTION_ADMIN_TOKEN || process.env.EVOLUTION_MASTER_API_KEY || this.apiKey;
    try {
      const response = await axios.post(
        `${this.baseUrl}/instance/create`,
        {
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          rejectCall: false,
          groupsIgnore: true,
          alwaysOnline: false,
          readMessages: false,
          readStatus: false,
          syncFullHistory: false,
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': masterKey },
          timeout: 30000,
        }
      );
      console.log(`✅ [Evolution API] Instance "${instanceName}" créée`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (createInstance):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Récupère le QR code de connexion d'une instance
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {boolean} forceRefresh - Force la regeneration d'un nouveau QR code
   * @returns {Promise<{success: boolean, qrcode?: string, error?: string}>}
   */
  async getQrCode(instanceName, instanceToken, forceRefresh = false) {
    try {
      const endpoint = `${this.baseUrl}/instance/connect/${instanceName}${forceRefresh ? `?refresh=true&t=${Date.now()}` : ''}`;
      const response = await axios.get(
        endpoint,
        {
          headers: { 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      const qr = response.data?.base64 || response.data?.qrcode?.base64 || response.data?.code;
      console.log(`📱 [Evolution API] QR code récupéré pour "${instanceName}"`);
      return { success: true, qrcode: qr, pairingCode: response.data?.pairingCode, raw: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (getQrCode):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Supprime une instance de Evolution API
   * @param {string} instanceName
   * @param {string} instanceToken
   */
  async deleteInstance(instanceName, instanceToken) {
    const masterKey = process.env.EVOLUTION_ADMIN_TOKEN || process.env.EVOLUTION_MASTER_API_KEY || this.apiKey;
    try {
      await axios.delete(
        `${this.baseUrl}/instance/delete/${instanceName}`,
        { headers: { 'apikey': masterKey }, timeout: 15000 }
      );
      console.log(`🗑️ [Evolution API] Instance "${instanceName}" supprimée`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (deleteInstance):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Déconnecte une instance (logout) sans la supprimer
   * @param {string} instanceName
   * @param {string} instanceToken
   */
  async logoutInstance(instanceName, instanceToken) {
    try {
      await axios.delete(
        `${this.baseUrl}/instance/logout/${instanceName}`,
        { headers: { 'apikey': instanceToken }, timeout: 15000 }
      );
      console.log(`🔌 [Evolution API] Instance "${instanceName}" déconnectée`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (logoutInstance):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Enregistre (ou met à jour) un contact dans le carnet d'adresses de l'instance WhatsApp
   * Endpoint Evolution API : POST /chat/contacts/{instance}
   * Utilise Baileys upsertContacts pour que le nom s'affiche dans les conversations.
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} phone - numéro international sans +
   * @param {string} name  - nom d'affichage
   */
  async saveContact(instanceName, instanceToken, phone, name) {
    const cleanPhone = phone.replace(/\D/g, '');
    const displayName = (name || '').trim() || cleanPhone;
    try {
      await axios.post(
        `${this.baseUrl}/chat/contacts/${instanceName}`,
        {
          contacts: [{
            fullName: displayName,
            wuid: `${cleanPhone}@s.whatsapp.net`,
            phoneNumber: cleanPhone,
          }]
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 10000,
        }
      );
      console.log(`📇 [Evolution API] Contact enregistré sur l'appareil: ${displayName} (${cleanPhone})`);
      return { success: true };
    } catch {
      // Silencieux — certaines versions d'Evolution API n'exposent pas cet endpoint
      return { success: false };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Statuts WhatsApp (Stories)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Publie un statut WhatsApp (image ou texte)
   * POST /status/send/{instance}
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {object} opts
   * @param {string} opts.type - 'image' | 'text'
   * @param {string} [opts.mediaUrl] - URL ou base64 de l'image (si type=image)
   * @param {string} [opts.caption] - Texte/légende
   * @param {string} [opts.backgroundColor] - Couleur de fond pour statut texte (ex: '#0F6B4F')
   */
  async sendStatus(instanceName, instanceToken, opts = {}) {
    const { type = 'text', mediaUrl, caption = '', backgroundColor = '#0F6B4F' } = opts;

    let payload;
    let media = mediaUrl;

    if ((type === 'image' || type === 'video') && mediaUrl) {
      // Résoudre fichier local → base64
      try {
        const localMatch = mediaUrl.match(/(?:https?:\/\/(?:api\.scalor\.net|localhost[:\d]*))\/uploads\/(.+)$/);
        if (localMatch) {
          const decodedFile = decodeURIComponent(localMatch[1]);
          const localPath = path.resolve(__dirname, '..', 'uploads', decodedFile);
          if (fs.existsSync(localPath)) {
            const buf = fs.readFileSync(localPath);
            const ext = decodedFile.split('.').pop().toLowerCase();
            const mime = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
              mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm', mkv: 'video/x-matroska'
            }[ext] || (type === 'video' ? 'video/mp4' : 'image/jpeg');
            media = `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      } catch { /* garder l'URL originale */ }

      payload = type === 'video'
        ? {
          type: 'video',
          video: media,
          caption,
        }
        : {
          type: 'image',
          image: media,
          caption,
        };
    } else {
      payload = {
        type: 'text',
        value: caption,
        backgroundColor,
        font: 1,
      };
    }

    const resolvedType = (payload.type === 'image' || payload.type === 'video') && media ? payload.type : 'text';
    const modernStatusPayload = resolvedType === 'text'
      ? {
        type: 'text',
        content: caption,
        backgroundColor,
        font: 1,
        allContacts: true,
      }
      : {
        type: resolvedType,
        content: media,
        caption,
        allContacts: true,
      };

    const requestVariants = [
      {
        url: `${this.baseUrl}/message/sendStatus/${instanceName}`,
        payload: modernStatusPayload,
      },
      {
        url: `${this.baseUrl}/message/sendStatus/${instanceName}`,
        payload: {
          statusMessage: modernStatusPayload,
        },
      },
      {
        url: `${this.baseUrl}/status/send/${instanceName}`,
        payload,
      },
    ];

    const formatStatusError = (errorData, fallbackMessage) => {
      if (Array.isArray(errorData?.response?.message)) {
        return errorData.response.message
          .map((message) => (typeof message === 'string' ? message : JSON.stringify(message)))
          .join(', ');
      }

      if (Array.isArray(errorData?.message)) {
        return errorData.message
          .map((message) => (typeof message === 'string' ? message : JSON.stringify(message)))
          .join(', ');
      }

      return errorData?.message || fallbackMessage;
    };

    let lastError = null;

    for (const variant of requestVariants) {
      try {
        const response = await axios.post(
          variant.url,
          variant.payload,
          {
            headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
            timeout: 45000,
            maxBodyLength: 50 * 1024 * 1024,
          }
        );
        console.log(`✅ [Evolution API] Statut publié via ${instanceName}`);
        return { success: true, data: response.data };
      } catch (error) {
        lastError = error;
        const errorData = error.response?.data;
        const detailedError = formatStatusError(errorData, error.message);
        console.error(`❌ Erreur Evolution API (sendStatus):`, JSON.stringify(errorData, null, 2) || error.message);
        console.error(`   URL tentée: ${variant.url}`);

        const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(detailedError || '');
        if (isTimeout) {
          console.warn(`⚠️ [Evolution API] Timeout sendStatus pour ${instanceName} — statut probablement publié`);
          return {
            success: true,
            assumedSuccess: true,
            warning: 'Evolution API a expiré avant de répondre, mais le statut a probablement été publié.',
            data: { timeout: true },
          };
        }

        const isRetryableVariantError = [400, 404].includes(error.response?.status)
          || /cannot post|not found|requires property|must have required property|bad request/i.test(detailedError || '');

        if (!isRetryableVariantError) {
          return { success: false, error: detailedError };
        }
      }
    }

    const lastErrorData = lastError?.response?.data;
    return { success: false, error: formatStatusError(lastErrorData, lastError?.message || 'Erreur inconnue lors de la publication du statut.') };
  }

  // ═══════════════════════════════════════════════════════════════
  // Gestion des Groupes WhatsApp
  // ═══════════════════════════════════════════════════════════════

  /**
   * Crée un groupe WhatsApp
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} subject - Nom du groupe
   * @param {string[]} participants - Numéros au format "2376XXXXXXX"
   * @param {string} [description] - Description du groupe
   */
  async createGroup(instanceName, instanceToken, subject, participants = [], description = '') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/group/create/${instanceName}`,
        {
          subject,
          description,
          participants: participants.map(p => p.replace(/\D/g, '')),
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      console.log(`✅ [Evolution API] Groupe créé: "${subject}"`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (createGroup):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Ajoute des participants à un groupe
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} groupJid - ID du groupe (ex: "120363XXXXX@g.us")
   * @param {string[]} participants - Numéros internationaux
   */
  async addGroupParticipants(instanceName, instanceToken, groupJid, participants) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/group/updateParticipant/${instanceName}`,
        {
          groupJid,
          action: 'add',
          participants: participants.map(p => `${p.replace(/\D/g, '')}@s.whatsapp.net`),
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      console.log(`✅ [Evolution API] ${participants.length} participant(s) ajouté(s) au groupe`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (addGroupParticipants):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Récupère le code d'invitation d'un groupe
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} groupJid - ID du groupe
   * @returns {Promise<{success: boolean, inviteCode?: string, inviteUrl?: string}>}
   */
  async getGroupInviteCode(instanceName, instanceToken, groupJid) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/group/inviteCode/${instanceName}?groupJid=${encodeURIComponent(groupJid)}`,
        {
          headers: { 'apikey': instanceToken },
          timeout: 15000,
        }
      );
      const code = response.data?.inviteCode || response.data?.code || response.data;
      const inviteCode = typeof code === 'string' ? code : String(code);
      console.log(`🔗 [Evolution API] Invite code obtenu pour groupe`);
      return { success: true, inviteCode, inviteUrl: `https://chat.whatsapp.com/${inviteCode}` };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (getGroupInviteCode):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Liste les groupes de l'instance
   * @param {string} instanceName
   * @param {string} instanceToken
   */
  async listGroups(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
        {
          headers: { 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      const groups = Array.isArray(response.data) ? response.data : (response.data?.groups || []);
      return { success: true, groups };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (listGroups):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message, groups: [] };
    }
  }

  /**
   * Envoie un message dans un groupe
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} groupJid - ID du groupe (xxx@g.us)
   * @param {string} message
   */
  async sendGroupMessage(instanceName, instanceToken, groupJid, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendText/${instanceName}`,
        {
          number: groupJid,
          text: message,
          delay: 1200,
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (sendGroupMessage):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Envoie une image dans un groupe
   */
  async sendGroupMedia(instanceName, instanceToken, groupJid, mediaUrl, caption = '') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: groupJid,
          media: mediaUrl,
          caption,
          mediatype: 'image',
        },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (sendGroupMedia):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Rejoint un groupe via un code d'invitation WhatsApp
   * @param {string} instanceName
   * @param {string} instanceToken
   * @param {string} inviteCode - Le code d'invitation (partie après https://chat.whatsapp.com/)
   * @returns {Promise<{success: boolean, groupJid?: string}>}
   */
  async acceptGroupInvite(instanceName, instanceToken, inviteCode) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/group/acceptInvite/${instanceName}`,
        { inviteCode },
        {
          headers: { 'Content-Type': 'application/json', 'apikey': instanceToken },
          timeout: 30000,
        }
      );
      const groupJid = response.data?.groupJid || response.data?.id || response.data?.gid || response.data;
      console.log(`✅ [Evolution API] Rejoint le groupe via invite: ${inviteCode}`);
      return { success: true, groupJid: typeof groupJid === 'string' ? groupJid : String(groupJid) };
    } catch (error) {
      console.error(`❌ Erreur Evolution API (acceptGroupInvite):`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

export default new EvolutionApiService();
