import ecomApi from '../../services/ecommApi.js';

export const livreurApi = {
  // Commandes disponibles
  getAvailable: (params = {}) => ecomApi.get('/orders/available', { params }),

  // Mes livraisons en cours
  getMyDeliveries: (userId) =>
    ecomApi.get('/orders', { params: { assignedLivreur: userId, limit: 50 } }),

  // Détail d'une commande
  getOrder: (id) => ecomApi.get(`/orders/${id}`),

  // Accepter une course
  assignOrder: (id) => ecomApi.post(`/orders/${id}/assign`),

  // Actions livreur (pickup_confirmed, delivered, refused, issue)
  livreurAction: (id, action) =>
    ecomApi.patch(`/orders/${id}/livreur-action`, { action }),

  // Historique
  getHistory: (params = {}) => ecomApi.get('/orders/livreur/history', { params }),

  // Stats & gains
  getStats: () => ecomApi.get('/orders/livreur/stats'),

  // Profil
  getProfile: () => ecomApi.get('/users/me'),
  updateProfile: (data) => ecomApi.put('/users/me', data),
};
