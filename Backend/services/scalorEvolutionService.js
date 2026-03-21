import axios from 'axios';

/**
 * Scalor Evolution API Service
 * Proxy layer between Scalor SaaS platform and Evolution API
 * 
 * IMPORTANT: Evolution API URL and credentials are NEVER exposed to clients.
 * All requests go through this service.
 */
class ScalorEvolutionService {
  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || 'https://api.evolution-api.com';
    this.masterKey = process.env.EVOLUTION_ADMIN_TOKEN || process.env.EVOLUTION_MASTER_API_KEY || process.env.EVOLUTION_API_KEY;
  }

  _headers(token) {
    return {
      'Content-Type': 'application/json',
      'apikey': token || this.masterKey
    };
  }

  // ═══════════════════════════════════════════════════════
  // Instance Management
  // ═══════════════════════════════════════════════════════

  async createInstance(instanceName) {
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
        { headers: this._headers(), timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ [Scalor] createInstance error:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async deleteInstance(instanceName) {
    try {
      await axios.delete(
        `${this.baseUrl}/instance/delete/${instanceName}`,
        { headers: this._headers(), timeout: 15000 }
      );
      return { success: true };
    } catch (error) {
      console.error(`❌ [Scalor] deleteInstance error:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async getConnectionState(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/connectionState/${instanceName}`,
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async getQrCode(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instance/connect/${instanceName}`,
        { headers: this._headers(instanceToken), timeout: 30000 }
      );
      const qr = response.data?.base64 || response.data?.qrcode?.base64 || response.data?.code;
      return { success: true, qrcode: qr, pairingCode: response.data?.pairingCode };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async logoutInstance(instanceName, instanceToken) {
    try {
      await axios.delete(
        `${this.baseUrl}/instance/logout/${instanceName}`,
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async restartInstance(instanceName, instanceToken) {
    try {
      const response = await axios.put(
        `${this.baseUrl}/instance/restart/${instanceName}`,
        {},
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // Messaging
  // ═══════════════════════════════════════════════════════

  async sendText(instanceName, instanceToken, number, message) {
    const cleanNumber = number.replace(/\D/g, '');
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendText/${instanceName}`,
        { number: cleanNumber, text: message, delay: 1200, linkPreview: false },
        { headers: this._headers(instanceToken), timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`❌ [Scalor] sendText error:`, error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async sendMedia(instanceName, instanceToken, number, mediaUrl, caption = '', fileName = 'image.jpg') {
    const cleanNumber = number.replace(/\D/g, '');
    const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
    const mimetypes = {
      'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
      'gif': 'image/gif', 'webp': 'image/webp', 'pdf': 'application/pdf'
    };
    const mimetype = mimetypes[ext] || 'image/jpeg';

    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: cleanNumber, mediatype: 'image', mimetype,
          caption, media: mediaUrl, fileName, delay: 1200
        },
        { headers: this._headers(instanceToken), timeout: 45000, maxBodyLength: 50 * 1024 * 1024 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async sendAudio(instanceName, instanceToken, number, audioUrl) {
    const cleanNumber = number.replace(/\D/g, '');
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendWhatsAppAudio/${instanceName}`,
        { number: cleanNumber, audio: audioUrl, delay: 1200 },
        { headers: this._headers(instanceToken), timeout: 45000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async sendVideo(instanceName, instanceToken, number, videoUrl, caption = '', fileName = 'video.mp4') {
    const cleanNumber = number.replace(/\D/g, '');
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: cleanNumber, mediatype: 'video',
          mimetype: 'video/mp4', caption, media: videoUrl, fileName, delay: 1500
        },
        { headers: this._headers(instanceToken), timeout: 60000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async sendDocument(instanceName, instanceToken, number, documentUrl, fileName = 'document.pdf') {
    const cleanNumber = number.replace(/\D/g, '');
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendMedia/${instanceName}`,
        {
          number: cleanNumber, mediatype: 'document',
          mimetype: 'application/pdf', media: documentUrl, fileName, delay: 1200
        },
        { headers: this._headers(instanceToken), timeout: 45000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // Contacts & Chat
  // ═══════════════════════════════════════════════════════

  async checkNumber(instanceName, instanceToken, numbers) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/whatsappNumbers/${instanceName}`,
        { numbers: Array.isArray(numbers) ? numbers : [numbers] },
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // Webhook
  // ═══════════════════════════════════════════════════════

  async setWebhook(instanceName, instanceToken, { url, events, enabled = true }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/webhook/set/${instanceName}`,
        { webhook: { enabled, url, webhookByEvents: false, webhookBase64: false, events } },
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async getWebhook(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/webhook/find/${instanceName}`,
        { headers: this._headers(instanceToken), timeout: 15000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // Groups
  // ═══════════════════════════════════════════════════════

  async fetchGroups(instanceName, instanceToken) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
        { headers: this._headers(instanceToken), timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async sendGroupMessage(instanceName, instanceToken, groupId, message) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sendText/${instanceName}`,
        { number: groupId, text: message, delay: 1200 },
        { headers: this._headers(instanceToken), timeout: 30000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }
}

// Singleton
const scalorEvolutionService = new ScalorEvolutionService();
export default scalorEvolutionService;
