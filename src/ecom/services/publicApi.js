import axios from 'axios';

// Configuration de base pour les API publiques (sans authentification)
const isDev = import.meta.env.DEV;

const resolvePublicApiBase = () => {
  if (isDev) return '/api/ecom';

  const explicitStoreApi = import.meta.env.VITE_STORE_API_URL;
  const explicitApiBase = import.meta.env.VITE_API_BASE_URL;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const candidate = explicitStoreApi || explicitApiBase || backendUrl;
  if (candidate) {
    const clean = String(candidate).replace(/\/+$/, '');
    return clean.endsWith('/api/ecom') ? clean : `${clean}/api/ecom`;
  }

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net/api/ecom';
  }

  return 'http://localhost:8080/api/ecom';
};

const API_BASE = resolvePublicApiBase();
console.log('[publicApi] API_BASE =', API_BASE);

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
    // NE PAS rediriger vers login pour les API publiques
    // Laisser l'appelant gérer l'erreur
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
