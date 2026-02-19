import axios from 'axios';
import { logApiRequest, logApiResponse, logApiError, logAuthEvent, logPushEvent } from './prodLogger.js';

// Configuration de base pour l'API e-commerce
// Toujours utiliser le chemin relatif /api/ecom — le proxy Cloudflare (ou Vite en dev) forward vers Railway
const ecomApi = axios.create({
  baseURL: '/api/ecom',
  timeout: 30000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token d'authentification et le workspaceId
ecomApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ecomToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Ajouter automatiquement le workspaceId aux requêtes
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const wsId = workspace?._id || workspace?.id;
    
    if (wsId) {
      // Ajouter workspaceId aux params si c'est une requête GET
      if (config.method === 'get' && config.params) {
        config.params.workspaceId = wsId;
      } else if (config.method === 'get' && !config.params) {
        config.params = { workspaceId: wsId };
      }
      // Ajouter workspaceId au body si c'est une requête POST/PUT/DELETE
      else if (['post', 'put', 'patch'].includes(config.method) && config.data) {
        config.data.workspaceId = wsId;
      } else if (['post', 'put', 'patch'].includes(config.method) && !config.data) {
        config.data = { workspaceId: wsId };
      }
    }

    // Marquer le timestamp de départ pour mesurer la durée
    config._startTime = Date.now();

    // Log complet de chaque requête
    logApiRequest(config);

    return config;
  },
  (error) => {
    logApiError(error);
    return Promise.reject(error);
  }
);

// Flag pour éviter les boucles de refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercepteur pour gérer les erreurs et auto-refresh token
ecomApi.interceptors.response.use(
  (response) => {
    logApiResponse(response);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Gérer les erreurs réseau (backend inaccessible)
    if (!error.response) {
      logApiError(error);
      console.error('🌐 Erreur réseau - backend inaccessible:', error.message);
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    }

    // Auto-refresh sur 401 (token expiré)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Ne pas refresh sur les routes d'auth
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Attendre que le refresh en cours se termine
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return ecomApi(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        logAuthEvent('token_refresh_start', { url: originalRequest.url });
        const response = await ecomApi.post('/auth/refresh');
        
        if (response.data?.success && response.data?.data?.token) {
          const newToken = response.data.data.token;
          localStorage.setItem('ecomToken', newToken);
          
          // Mettre à jour le workspace si fourni
          if (response.data.data.workspace) {
            localStorage.setItem('ecomWorkspace', JSON.stringify(response.data.data.workspace));
          }
          
          logAuthEvent('token_refresh_ok', { url: originalRequest.url });
          processQueue(null, newToken);
          
          // Rejouer la requête originale avec le nouveau token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return ecomApi(originalRequest);
        }
      } catch (refreshError) {
        logAuthEvent('token_refresh_fail', { message: refreshError.message, url: originalRequest.url });
        processQueue(refreshError, null);
        
        // Token invalide — déconnecter l'utilisateur
        localStorage.removeItem('ecomToken');
        localStorage.removeItem('ecomUser');
        localStorage.removeItem('ecomWorkspace');
        window.location.href = '/ecom/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Log toutes les autres erreurs HTTP
    logApiError(error);
    return Promise.reject(error);
  }
);

// Services d'API organisés par ressource
export const authApi = {
  // Connexion
  login: (credentials) => ecomApi.post('/auth/login', credentials),
  
  // Rafraîchir le token
  refresh: () => ecomApi.post('/auth/refresh'),
  
  // Inscription (admin seulement)
  register: (userData) => ecomApi.post('/auth/register', userData),
  
  // Obtenir le profil utilisateur
  getProfile: () => ecomApi.get('/auth/me'),
  
  // Mettre à jour le profil (name, phone)
  updateProfile: (data) => ecomApi.put('/auth/profile', data),
  
  // Changer le mot de passe
  changePassword: (passwords) => ecomApi.put('/auth/change-password', passwords),
  
  // Changer la devise
  changeCurrency: (data) => ecomApi.put('/auth/currency', data),
  
  // Enregistrer un appareil pour session persistante
  registerDevice: (data) => ecomApi.post('/auth/register-device', data)
};

export const productsApi = {
  // Liste des produits
  getProducts: (params = {}) => ecomApi.get('/products', { params }),
  
  // Détail d'un produit
  getProduct: (id) => ecomApi.get(`/products/${id}`),
  
  // Créer un produit
  createProduct: (data) => ecomApi.post('/products', data),
  
  // Mettre à jour un produit
  updateProduct: (id, data) => ecomApi.put(`/products/${id}`, data),
  
  // Supprimer un produit
  deleteProduct: (id) => ecomApi.delete(`/products/${id}`),
  
  // Statistiques produits
  getStats: () => ecomApi.get('/products/stats/overview')
};

export const reportsApi = {
  // Liste des rapports
  getReports: (params = {}) => ecomApi.get('/reports', { params }),
  
  // Détail d'un rapport
  getReport: (id) => ecomApi.get(`/reports/${id}`),
  
  // Créer un rapport
  createReport: (data) => ecomApi.post('/reports', data),
  
  // Mettre à jour un rapport
  updateReport: (id, data) => ecomApi.put(`/reports/${id}`, data),
  
  // Supprimer un rapport
  deleteReport: (id) => ecomApi.delete(`/reports/${id}`),
  
  // Statistiques financières
  getFinancialStats: (params = {}) => ecomApi.get('/reports/stats/financial', { params })
};

export const stockApi = {
  // Commandes de stock
  getStockOrders: (params = {}) => ecomApi.get('/stock/orders', { params }),
  
  // Détail d'une commande de stock
  getStockOrder: (id) => ecomApi.get(`/stock/orders/${id}`),
  
  // Créer une commande de stock
  createStockOrder: (data) => ecomApi.post('/stock/orders', data),
  
  // Marquer une commande comme reçue
  receiveStockOrder: (id, data) => ecomApi.put(`/stock/orders/${id}/receive`, data),
  
  // Annuler une commande de stock
  cancelStockOrder: (id) => ecomApi.put(`/stock/orders/${id}/cancel`),
  
  // Alertes de stock
  getStockAlerts: () => ecomApi.get('/stock/alerts'),
  
  // Vue d'ensemble du stock
  getStockOverview: () => ecomApi.get('/stock/overview')
};

export const decisionsApi = {
  // Liste des décisions
  getDecisions: (params = {}) => ecomApi.get('/decisions', { params }),
  
  // Détail d'une décision
  getDecision: (id) => ecomApi.get(`/decisions/${id}`),
  
  // Créer une décision
  createDecision: (data) => ecomApi.post('/decisions', data),
  
  // Assigner une décision
  assignDecision: (id, data) => ecomApi.put(`/decisions/${id}/assign`, data),
  
  // Marquer une décision comme complétée
  completeDecision: (id, data) => ecomApi.put(`/decisions/${id}/complete`, data),
  
  // Annuler une décision
  cancelDecision: (id) => ecomApi.put(`/decisions/${id}/cancel`),
  
  // Dashboard des décisions
  getDecisionDashboard: () => ecomApi.get('/decisions/dashboard/overview')
};

 export const usersApi = {
   // Liste des utilisateurs (admin seulement)
   getUsers: (params = {}) => ecomApi.get('/users', { params }),
 
   // Détail d'un utilisateur (admin seulement)
   getUser: (id) => ecomApi.get(`/users/${id}`),
 
   // Créer un utilisateur (admin seulement)
   createUser: (data) => ecomApi.post('/users', data),
 
   // Modifier un utilisateur (admin seulement)
   updateUser: (id, data) => ecomApi.put(`/users/${id}`, data),
 
   // Réinitialiser le mot de passe (admin seulement)
   resetPassword: (id, newPassword) => ecomApi.put(`/users/${id}/reset-password`, { newPassword }),
 
   // Supprimer un utilisateur (admin seulement)
   deleteUser: (id) => ecomApi.delete(`/users/${id}`),
 
   // Liste des livreurs actifs (accessible par tous les authés)
   getLivreurs: () => ecomApi.get('/users/livreurs/list')
 };

export const importApi = {
  // Valider un spreadsheet
  validate: (data) => ecomApi.post('/import/validate', data),

  // Aperçu des données et colonnes
  preview: (data) => ecomApi.post('/import/preview', data),

  // Lancer l'import
  run: (data, config = {}) => ecomApi.post('/import/run', data, { timeout: 180000, ...config }),

  // Historique des imports
  getHistory: (params = {}) => ecomApi.get('/import/history', { params }),

  // Détail d'un import
  getImportDetail: (id) => ecomApi.get(`/import/history/${id}`)
};

export const pushApi = {
  // Obtenir la clé publique VAPID (endpoint principal hors /api/ecom)
  getVapidPublicKey: () => axios.get('/api/push/public-key').catch(() =>
    // Fallback vers l'endpoint ecom
    ecomApi.get('/push/vapid-public-key')
  ),
  
  // S'abonner aux notifications push
  subscribe: (subscription) => ecomApi.post('/push/subscribe', subscription),
  
  // Se désabonner
  unsubscribe: (data) => ecomApi.delete('/push/unsubscribe', { data }),
  
  // Envoyer une notification de test
  sendTest: () => ecomApi.post('/push/test')
};

export const notificationsApi = {
  getNotifications: (params = {}) => ecomApi.get('/notifications', { params }),
  getUnreadCount: () => ecomApi.get('/notifications/unread-count'),
  markAsRead: (id) => ecomApi.put(`/notifications/${id}/read`),
  markAllAsRead: () => ecomApi.put('/notifications/read-all'),
  deleteNotification: (id) => ecomApi.delete(`/notifications/${id}`)
};

export const settingsApi = {
  // Préférences de notifications push
  getPushNotificationPreferences: () => ecomApi.get('/orders/settings/push-notifications'),
  updatePushNotificationPreferences: (preferences) => ecomApi.put('/orders/settings/push-notifications', preferences)
};

export const assignmentsApi = {
  // Liste des affectations
  getAssignments: (params = {}) => ecomApi.get('/assignments', { params }),
  
  // Affectation d'une closeuse spécifique
  getAssignment: (closeuseId) => ecomApi.get(`/assignments/closeuse/${closeuseId}`),
  
  // Mes affectations (closeuse connectée)
  getMyAssignments: () => ecomApi.get('/assignments/my-assignments'),
  
  // Créer ou mettre à jour une affectation
  createAssignment: (data) => ecomApi.post('/assignments', data),
  
  // Mettre à jour une affectation
  updateAssignment: (id, data) => ecomApi.put(`/assignments/${id}`, data),
  
  // Supprimer une affectation
  deleteAssignment: (id) => ecomApi.delete(`/assignments/${id}`),
  
  // Obtenir les sources disponibles
  getSources: () => ecomApi.get('/assignments/sources')
};

// Export par défaut l'instance axios pour usage direct
export default ecomApi;

// Utilitaires pour les requêtes courantes
export const apiUtils = {
  // Gestion des erreurs standardisée
  handleError: (error) => {
    const message = error.response?.data?.message || error.message || 'Erreur inconnue';
    console.error('Erreur API:', message, error);
    return message;
  },
  
  // Vérifier si l'erreur est une erreur d'authentification
  isAuthError: (error) => {
    return error.response?.status === 401 || error.response?.status === 403;
  },
  
  // Vérifier si l'erreur est une erreur de validation
  isValidationError: (error) => {
    return error.response?.status === 400 && error.response?.data?.errors;
  },
  
  // Extraire les erreurs de validation
  getValidationErrors: (error) => {
    return error.response?.data?.errors || [];
  },
  
  // Formatage des paramètres de requête
  formatQueryParams: (params) => {
    const filtered = Object.entries(params).filter(([_, value]) => 
      value !== undefined && value !== null && value !== ''
    );
    return Object.fromEntries(filtered);
  }
};

// Fonctions utilitaires pour les opérations courantes
export const quickApi = {
  // Charger les données du dashboard selon le rôle
  loadDashboardData: async (userRole) => {
    try {
      const requests = [];
      
      // Requêtes communes à tous les rôles
      requests.push(productsApi.getProducts({ isActive: true }));
      
      // Requêtes spécifiques au rôle
      if (userRole === 'ecom_admin') {
        requests.push(
          stockApi.getStockAlerts(),
          reportsApi.getFinancialStats(),
          decisionsApi.getDecisionDashboard()
        );
      } else if (userRole === 'ecom_compta') {
        requests.push(
          reportsApi.getFinancialStats(),
          productsApi.getStats()
        );
      } else if (userRole === 'ecom_closeuse') {
        const today = new Date().toISOString().split('T')[0];
        requests.push(reportsApi.getReports({ date: today }));
      }
      
      const responses = await Promise.all(requests);
      return responses;
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      throw error;
    }
  },
  
  // Créer un rapport quotidien avec validation
  createDailyReport: async (data) => {
    try {
      // Validation côté client
      if (data.ordersDelivered > data.ordersReceived) {
        throw new Error('Le nombre de commandes livrées ne peut pas dépasser le nombre de commandes reçues');
      }
      
      return await reportsApi.createReport(data);
    } catch (error) {
      throw error;
    }
  },
  
  // Vérifier les permissions avant une action
  checkPermissions: async (action, resource) => {
    try {
      // Cette fonction pourrait faire une vérification côté serveur
      // Pour l'instant, on fait une vérification locale basée sur le token
      const token = localStorage.getItem('ecomToken');
      if (!token) {
        throw new Error('Non authentifié');
      }
      
      // Le token sera validé par l'intercepteur axios
      return true;
    } catch (error) {
      return false;
    }
  }
};
