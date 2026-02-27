import api from '../../lib/api.js';

// Service API spécial pour l'incarnation avec fix UTF-8
class ImpersonationAPI {
  // Récupérer les données d'un utilisateur spécifique avec son workspace
  async getUserWithWorkspace(userId) {
    try {
      const response = await api.get(`/super-admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération utilisateur avec workspace:', error);
      throw error;
    }
  }

  // Récupérer les produits du workspace d'un utilisateur
  async getWorkspaceProducts(workspaceId) {
    try {
      const response = await api.get('/products', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération produits workspace:', error);
      throw error;
    }
  }

  // Récupérer les commandes du workspace d'un utilisateur
  async getWorkspaceOrders(workspaceId) {
    try {
      const response = await api.get('/orders', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération commandes workspace:', error);
      throw error;
    }
  }

  // Récupérer les clients du workspace d'un utilisateur
  async getWorkspaceClients(workspaceId) {
    try {
      const response = await api.get('/clients', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération clients workspace:', error);
      throw error;
    }
  }

  // Récupérer le stock du workspace d'un utilisateur
  async getWorkspaceStock(workspaceId) {
    try {
      const response = await api.get('/stock', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération stock workspace:', error);
      throw error;
    }
  }

  // Récupérer les transactions du workspace d'un utilisateur
  async getWorkspaceTransactions(workspaceId) {
    try {
      const response = await api.get('/transactions', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération transactions workspace:', error);
      throw error;
    }
  }

  // Récupérer les rapports du workspace d'un utilisateur
  async getWorkspaceReports(workspaceId) {
    try {
      const response = await api.get('/reports', {
        params: { workspaceId }
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération rapports workspace:', error);
      throw error;
    }
  }
}

export default new ImpersonationAPI();
