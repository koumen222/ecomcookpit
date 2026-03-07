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
   * Lister les instances WhatsApp d'un utilisateur
   */
  async getInstances(userId) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
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
  async getInstance(instanceId, userId) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
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
  async linkInstance(data) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/external/whatsapp/link`, data, {
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
  async verifyInstance(instanceId) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/ecom/v1/external/whatsapp/verify-instance`, {
        instanceId
      }, {
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
  async deleteInstance(instanceId, userId) {
    try {
      const response = await axios.delete(`${this.baseUrl}/api/ecom/v1/external/whatsapp/instances/${instanceId}`, {
        params: { userId },
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
  async updateInstance(instanceId, userId, updates) {
    try {
      // Si l'API externe n'a pas de PUT, on peut faire un re-link
      const response = await axios.put(`${this.baseUrl}/api/ecom/v1/external/whatsapp/instances/${instanceId}`, {
        userId,
        ...updates
      }, {
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
  async findInstances(filter) {
    try {
      const { userId, workspaceId, isActive, status } = filter;
      
      if (!userId) {
        throw new Error('userId est requis pour findInstances');
      }

      const response = await axios.get(`${this.baseUrl}/api/v1/external/whatsapp/instances`, {
        params: { userId },
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
  async countInstances(filter) {
    const instances = await this.findInstances(filter);
    return instances.length;
  }
}

export default new ExternalWhatsappApiService();
