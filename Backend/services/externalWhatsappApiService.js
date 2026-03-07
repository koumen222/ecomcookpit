import axios from 'axios';

/**
 * Service pour appeler l'API externe WhatsApp (backend séparé)
 * Base URL: https://api.ecomcookpit.site
 */
class ExternalWhatsappApiService {
  constructor() {
    this.baseUrl = process.env.EXTERNAL_WHATSAPP_API_URL || 'https://api.ecomcookpit.site';
  }

  /**
   * Créer les headers d'authentification pour l'API externe
   */
  getAuthHeaders(token, workspaceId) {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (workspaceId) {
      headers['X-Workspace-Id'] = workspaceId;
    }
    
    return headers;
  }

  /**
   * Lister les instances WhatsApp d'un utilisateur
   */
  async getInstances(userId, token = null, workspaceId = null) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur getInstances:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer une instance par ID
   */
  async getInstance(instanceId, userId, token = null, workspaceId = null) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 10000
      });
      
      if (response.data.success && response.data.instances) {
        const instance = response.data.instances.find(inst => inst._id === instanceId);
        return instance || null;
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur getInstance:', error.message);
      return null;
    }
  }

  /**
   * Lier/créer une instance WhatsApp
   */
  async linkInstance(data, token = null, workspaceId = null) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/external/whatsapp/link`, data, {
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur linkInstance:', error.message);
      throw error;
    }
  }

  /**
   * Vérifier le statut d'une instance
   */
  async verifyInstance(instanceId, token = null, workspaceId = null) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/ecom/v1/external/whatsapp/verify-instance`, {
        instanceId
      }, {
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 15000
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur verifyInstance:', error.message);
      throw error;
    }
  }

  /**
   * Supprimer une instance
   */
  async deleteInstance(instanceId, userId, token = null, workspaceId = null) {
    try {
      const response = await axios.delete(`${this.baseUrl}/api/ecom/v1/external/whatsapp/instances/${instanceId}`, {
        params: { userId },
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur deleteInstance:', error.message);
      throw error;
    }
  }

  /**
   * Mettre à jour une instance (fallback si l'API externe le supporte)
   */
  async updateInstance(instanceId, userId, updates, token = null, workspaceId = null) {
    try {
      // Si l'API externe n'a pas de PUT, on peut faire un re-link
      const response = await axios.put(`${this.baseUrl}/api/ecom/v1/external/whatsapp/instances/${instanceId}`, {
        userId,
        ...updates
      }, {
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur updateInstance:', error.message);
      // Fallback: retourner null si l'endpoint n'existe pas
      return null;
    }
  }

  /**
   * Rechercher des instances par critères
   */
  async findInstances(filter, token = null) {
    try {
      const { userId, workspaceId, isActive, status } = filter;
      
      if (!userId) {
        throw new Error('userId est requis pour findInstances');
      }

      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
        headers: this.getAuthHeaders(token, workspaceId),
        timeout: 10000
      });

      if (!response.data.success || !response.data.instances) {
        return [];
      }

      let instances = response.data.instances;

      // Filtrer localement selon les critères
      if (workspaceId !== undefined) {
        instances = instances.filter(inst => inst.workspaceId?.toString() === workspaceId?.toString());
      }
      if (isActive !== undefined) {
        instances = instances.filter(inst => inst.isActive === isActive);
      }
      if (status !== undefined) {
        if (Array.isArray(status)) {
          instances = instances.filter(inst => status.includes(inst.status));
        } else {
          instances = instances.filter(inst => inst.status === status);
        }
      }

      return instances;
    } catch (error) {
      console.error('❌ Erreur findInstances:', error.message);
      return [];
    }
  }

  /**
   * Compter les instances
   */
  async countInstances(filter, token = null) {
    const instances = await this.findInstances(filter, token);
    return instances.length;
  }
}

export default new ExternalWhatsappApiService();
