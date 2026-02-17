import axios from 'axios';

// Configuration de base pour les API publiques (sans authentification)
const API_BASE = window.location.origin.includes('localhost') 
  ? 'http://localhost:3001/api/ecom' 
  : '/api/ecom';

// Créer une instance axios pour les API publiques
const publicApi = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Gestion des erreurs
publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      // Rediriger vers login si nécessaire (pour les routes protégées)
      window.location.href = '/ecom/login';
    }
    return Promise.reject(error);
  }
);

// Services de recherche publique
export const publicSearch = {
  // Recherche de produits
  searchProducts: async (query, options = {}) => {
    try {
      console.log(' Recherche produits:', query, 'API_BASE:', API_BASE);
      
      const params = {
        search: query,
        limit: options.limit || 20,
        ...options
      };
      
      const response = await publicApi.get('/products/search', { params });
      console.log(' Réponse recherche:', response.data);
      return response.data;
    } catch (error) {
      console.error(' Erreur recherche produits:', error);
      throw error;
    }
  },

  // Liste des produits populaires
  getPopularProducts: async (limit = 10) => {
    const response = await publicApi.get('/products/search', { 
      params: { 
        status: 'winner,stable',
        limit,
        isActive: true
      } 
    });
    return response.data;
  },

  // Détails d'un produit public
  getProductDetails: async (productId) => {
    const response = await publicApi.get('/products/search', {
      params: { 
        search: productId,
        limit: 1 
      }
    });
    return response.data;
  }
};

export default publicApi;
