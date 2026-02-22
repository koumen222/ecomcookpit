import axios from 'axios';

// Service API spécial pour l'incarnation
const isDev = import.meta.env.DEV;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

class ImpersonationAPI {
  constructor() {
    this.baseURL = isDev ? '/api/ecom' : `${BACKEND_URL}/api/ecom`;
  }

  // Récupérer les headers avec le token FRAIS (pas celui du constructeur)
  getHeaders() {
    const token = localStorage.getItem('ecomToken');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Récupérer les données d'un utilisateur spécifique avec son workspace
  async getUserWithWorkspace(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/super-admin/users/${userId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erreur récupération utilisateur avec workspace:', error);
      throw error;
    }
  }

  // Récupérer les produits du workspace d'un utilisateur
  async getWorkspaceProducts(workspaceId) {
    try {
      const response = await axios.get(`${this.baseURL}/products`, {
        headers: this.getHeaders(),
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
      const response = await axios.get(`${this.baseURL}/orders`, {
        headers: this.getHeaders(),
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
      const response = await axios.get(`${this.baseURL}/clients`, {
        headers: this.getHeaders(),
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
      const response = await axios.get(`${this.baseURL}/stock`, {
        headers: this.getHeaders(),
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
      const response = await axios.get(`${this.baseURL}/transactions`, {
        headers: this.getHeaders(),
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
      const response = await axios.get(`${this.baseURL}/reports`, {
        headers: this.getHeaders(),
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
