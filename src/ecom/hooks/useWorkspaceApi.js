import { useEcomAuth } from './useEcomAuth';
import ecomApi from '../services/ecommApi.js';

// Hook pour les appels API qui tiennent compte du workspace incarné
export const useWorkspaceApi = () => {
  const { user } = useEcomAuth();

  // Obtenir le workspace actif
  const getActiveWorkspace = () => {
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    if (workspace) {
      console.log('🏢 Utilisation workspace localStorage:', workspace.name);
      return workspace;
    }
    
    console.log('🏢 Aucun workspace trouvé');
    return null;
  };

  // Wrapper pour les appels API avec workspace
  const apiWithWorkspace = {
    // Produits
    getProducts: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('📦 Appel getProducts avec workspace:', workspace?.name);
      return ecomApi.get('/products', { params });
    },

    // Commandes
    getOrders: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('📋 Appel getOrders avec workspace:', workspace?.name);
      return ecomApi.get('/orders', { params });
    },

    // Clients
    getClients: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('👥 Appel getClients avec workspace:', workspace?.name);
      return ecomApi.get('/clients', { params });
    },

    // Stock
    getStock: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('📦 Appel getStock avec workspace:', workspace?.name);
      return ecomApi.get('/stock', { params });
    },

    // Transactions
    getTransactions: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('💰 Appel getTransactions avec workspace:', workspace?.name);
      return ecomApi.get('/transactions', { params });
    },

    // Rapports
    getReports: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('📊 Appel getReports avec workspace:', workspace?.name);
      return ecomApi.get('/reports', { params });
    },

    // Données analytics
    getData: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('📈 Appel getData avec workspace:', workspace?.name);
      return ecomApi.get('/data', { params });
    },

    // Objectifs
    getGoals: async (params = {}) => {
      const workspace = getActiveWorkspace();
      if (workspace) {
        params.workspaceId = workspace._id;
      }
      console.log('🎯 Appel getGoals avec workspace:', workspace?.name);
      return ecomApi.get('/goals', { params });
    }
  };

  return {
    apiWithWorkspace,
    getActiveWorkspace,
    currentWorkspace: getActiveWorkspace()
  };
};

export default useWorkspaceApi;
