import axios from 'axios';

/**
 * Service pour appeler l'Evolution API directement
 * 
 * Architecture:
 *   Ce backend (scalor) → Evolution API
 * 
 * Auth: Utilise EVOLUTION_ADMIN_TOKEN (apikey globale)
 * Endpoints: /instance/*, /message/*
 */
class ExternalWhatsappApiService {
  constructor() {
    this.baseUrl = process.env.EVOLUTION_API_URL || 'https://evolution-api-production-77b9.up.railway.app';
    this.adminToken = process.env.EVOLUTION_ADMIN_TOKEN;
  }

  // ─── Authentification ───────────────────────────────────────────────────────

  /**
   * Headers pour les appels à Evolution API
   */
  buildHeaders(workspaceId = null) {
    if (!this.adminToken) {
      console.error('❌ [ExtWhatsappAPI] EVOLUTION_ADMIN_TOKEN manquant dans .env');
      throw new Error('EVOLUTION_ADMIN_TOKEN non configuré');
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.adminToken
    };
    
    if (workspaceId) {
      headers['X-Workspace-Id'] = workspaceId;
      console.log(`   📦 [ExtWhatsappAPI] Header X-Workspace-Id: ${workspaceId}`);
    }
    
    return headers;
  }

  /**
   * Wrapper pour les appels HTTP
   */
  async callApi(fn, workspaceId = null) {
    try {
      return await fn(this.buildHeaders(workspaceId));
    } catch (error) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data || {});
      console.error(`❌ [ExtWhatsappAPI] Erreur HTTP ${status}: ${error.message} | Body: ${body}`);
      throw error;
    }
  }

  // ─── Instances ──────────────────────────────────────────────────────────────

  /**
   * Lister toutes les instances du compte de service
   * Endpoint: GET /api/instance/fetchInstances
   */
  async getInstances(userId, _tokenIgnored = null, workspaceId = null) {
    console.log(`📡 [ExtWhatsappAPI] getInstances pour userId=${userId}, workspaceId=${workspaceId}`);
    try {
      const result = await this.callApi(async (headers) => {
        const url = `${this.baseUrl}/instance/fetchInstances`;
        console.log(`   → GET ${url}`);
        const response = await axios.get(url, { headers, timeout: 10000 });
        return response.data;
      }, workspaceId);

      // L'API retourne un tableau ou un objet avec instances
      const rawInstances = Array.isArray(result) ? result : (result.instances || result.data || []);
      console.log(`   ✅ Total instances reçues: ${rawInstances.length}`);

      // Filtrer les instances appartenant à cet userId (préfixe user_{userId}_)
      const userInstances = rawInstances.filter(inst => {
        const name = inst.instance?.instanceName || inst.instanceName || inst.name || '';
        return name.startsWith(`user_${userId}_`) || inst.userId === userId;
      });

      console.log(`   ✅ Instances filtrées pour userId=${userId}: ${userInstances.length}`);

      // Normaliser le format
      const normalized = userInstances.map(inst => this.normalizeInstance(inst));

      return { success: true, instances: normalized };
    } catch (error) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data || {});
      console.error(`❌ [ExtWhatsappAPI] getInstances échoué (HTTP ${status}): ${error.message} | Body: ${body}`);
      throw error;
    }
  }

  /**
   * Récupérer une instance par ID ou nom
   */
  async getInstance(instanceId, userId, _tokenIgnored = null, workspaceId = null) {
    console.log(`📡 [ExtWhatsappAPI] getInstance instanceId=${instanceId} userId=${userId}`);
    try {
      const { instances } = await this.getInstances(userId, null, workspaceId);
      const instance = instances.find(inst => inst._id === instanceId || inst.id === instanceId || inst.instanceName === instanceId);
      console.log(`   ${instance ? '✅ Instance trouvée' : '⚠️ Instance non trouvée'}: ${instanceId}`);
      return instance || null;
    } catch (error) {
      console.error(`❌ [ExtWhatsappAPI] getInstance échoué: ${error.message}`);
      return null;
    }
  }

  /**
   * Créer une instance WhatsApp
   * Endpoint: POST /api/instance/create
   */
  async linkInstance(data, _tokenIgnored = null, workspaceId = null) {
    console.log(`📡 [ExtWhatsappAPI] linkInstance instanceName=${data.instanceName}`);
    try {
      const result = await this.callApi(async (headers) => {
        const url = `${this.baseUrl}/instance/create`;
        console.log(`   → POST ${url}`);
        const response = await axios.post(url, {
          instanceName: data.instanceName,
          token: data.instanceToken,
          qrcode: true
        }, { headers, timeout: 15000 });
        return response.data;
      }, workspaceId || data.workspaceId);

      console.log(`   ✅ Instance créée:`, JSON.stringify(result).substring(0, 200));
      return { success: true, data: this.normalizeInstance(result) };
    } catch (error) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data || {});
      console.error(`❌ [ExtWhatsappAPI] linkInstance échoué (HTTP ${status}): ${error.message} | Body: ${body}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Vérifier le statut de connexion d'une instance
   * Endpoint: GET /api/instance/connectionState/:name
   */
  async verifyInstance(instanceId, _tokenIgnored = null, workspaceId = null) {
    console.log(`📡 [ExtWhatsappAPI] verifyInstance instanceId=${instanceId}`);
    try {
      const result = await this.callApi(async (headers) => {
        const url = `${this.baseUrl}/instance/connectionState/${instanceId}`;
        console.log(`   → GET ${url}`);
        const response = await axios.get(url, { headers, timeout: 10000 });
        return response.data;
      }, workspaceId);

      const state = result.instance?.state || result.state || result.connectionState;
      const isConnected = state === 'open';
      console.log(`   ✅ État instance ${instanceId}: ${state}`);

      return {
        success: isConnected,
        status: isConnected ? 'connected' : 'disconnected',
        evolutionState: state,
        message: isConnected ? 'Instance connectée ✅' : `Instance non connectée (état: ${state})`
      };
    } catch (error) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data || {});
      console.error(`❌ [ExtWhatsappAPI] verifyInstance échoué (HTTP ${status}): ${error.message} | Body: ${body}`);
      return { success: false, status: 'disconnected', error: error.message };
    }
  }

  /**
   * Supprimer une instance
   * Endpoint: DELETE /api/instance/delete/:name
   */
  async deleteInstance(instanceId, userId, _tokenIgnored = null, workspaceId = null) {
    console.log(`📡 [ExtWhatsappAPI] deleteInstance instanceId=${instanceId} userId=${userId}`);
    try {
      // D'abord récupérer le nom de l'instance
      const instance = await this.getInstance(instanceId, userId, null, workspaceId);
      const instanceName = instance?.instanceName || instanceId;

      const result = await this.callApi(async (headers) => {
        const url = `${this.baseUrl}/instance/delete/${instanceName}`;
        console.log(`   → DELETE ${url}`);
        const response = await axios.delete(url, { headers, timeout: 10000 });
        return response.data;
      }, workspaceId);

      console.log(`   ✅ Instance ${instanceName} supprimée`);
      return { success: true, message: `Instance "${instanceName}" supprimée avec succès` };
    } catch (error) {
      const status = error.response?.status;
      const body = JSON.stringify(error.response?.data || {});
      console.error(`❌ [ExtWhatsappAPI] deleteInstance échoué (HTTP ${status}): ${error.message} | Body: ${body}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  /**
   * Rechercher des instances par critères (filtre local après fetch)
   */
  async findInstances(filter, _tokenIgnored = null) {
    const { userId, workspaceId, isActive, status } = filter;

    if (!userId) {
      console.error('❌ [ExtWhatsappAPI] findInstances: userId est requis');
      return [];
    }

    try {
      const { instances } = await this.getInstances(userId, null, workspaceId);

      let filtered = instances;

      if (isActive !== undefined) {
        filtered = filtered.filter(inst => inst.isActive === isActive);
      }
      if (status !== undefined) {
        if (Array.isArray(status)) {
          filtered = filtered.filter(inst => status.includes(inst.status));
        } else {
          filtered = filtered.filter(inst => inst.status === status);
        }
      }

      console.log(`📋 [ExtWhatsappAPI] findInstances(userId=${userId}, status=${JSON.stringify(status)}): ${filtered.length}/${instances.length}`);
      return filtered;
    } catch (error) {
      console.error(`❌ [ExtWhatsappAPI] findInstances échoué: ${error.message}`);
      return [];
    }
  }

  /**
   * Compter les instances
   */
  async countInstances(filter, _tokenIgnored = null) {
    const instances = await this.findInstances(filter);
    return instances.length;
  }

  // ─── Utilitaires ────────────────────────────────────────────────────────────

  /**
   * Normaliser le format d'une instance retournée par l'API externe
   */
  normalizeInstance(raw) {
    if (!raw) return null;

    // L'API peut retourner { instance: { instanceName, ... }, ... }
    const inst = raw.instance || raw;

    return {
      _id: raw.id || raw._id || inst.instanceName,
      id: raw.id || raw._id || inst.instanceName,
      instanceName: inst.instanceName || raw.instanceName || raw.name,
      customName: raw.customName || inst.instanceName || raw.instanceName,
      status: this.mapConnectionState(inst.connectionStatus || inst.state || raw.state),
      isActive: raw.isActive !== undefined ? raw.isActive : true,
      instanceToken: raw.token || raw.instanceToken || inst.token,
      workspaceId: raw.workspaceId,
      userId: raw.userId,
      lastSeen: raw.updatedAt || raw.lastSeen,
      _raw: raw
    };
  }

  /**
   * Convertir l'état Evolution en statut lisible
   */
  mapConnectionState(state) {
    if (!state) return 'unknown';
    if (state === 'open') return 'connected';
    if (state === 'close' || state === 'closed') return 'disconnected';
    if (state === 'connecting') return 'disconnected';
    return state;
  }
}

export default new ExternalWhatsappApiService();
