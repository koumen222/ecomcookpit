import { useState, useEffect, useCallback } from 'react';
import ecomApi, { apiUtils } from '../services/ecommApi.js';

// Hook générique pour les données avec chargement, erreur et rafraîchissement
export const useEcomData = (apiFunction, params = {}, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiFunction(params);
      setData(response.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = apiUtils.handleError(err);
      setError(errorMessage);
      console.error('Erreur chargement données:', err);
    } finally {
      setLoading(false);
    }
  }, [apiFunction, params]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch
  };
};

// Hook pour les produits
export const useProducts = (params = {}) => {
  return useEcomData(
    (params) => ecomApi.get('/products', { params }),
    params
  );
};

// Hook pour un produit spécifique
export const useProduct = (id) => {
  return useEcomData(
    () => ecomApi.get(`/products/${id}`),
    {},
    [id]
  );
};

// Hook pour les rapports quotidiens
export const useReports = (params = {}) => {
  return useEcomData(
    (params) => ecomApi.get('/reports', { params }),
    params
  );
};

// Hook pour les statistiques financières
export const useFinancialStats = (params = {}) => {
  return useEcomData(
    (params) => ecomApi.get('/reports/stats/financial', { params }),
    params
  );
};

// Hook pour les alertes de stock
export const useStockAlerts = () => {
  return useEcomData(() => ecomApi.get('/stock/alerts'));
};

// Hook pour les commandes de stock
export const useStockOrders = (params = {}) => {
  return useEcomData(
    (params) => ecomApi.get('/stock/orders', { params }),
    params
  );
};

// Hook pour les décisions
export const useDecisions = (params = {}) => {
  return useEcomData(
    (params) => ecomApi.get('/decisions', { params }),
    params
  );
};

// Hook pour le dashboard des décisions
export const useDecisionDashboard = () => {
  return useEcomData(() => ecomApi.get('/decisions/dashboard/overview'));
};

// Hook pour les opérations CRUD avec état de chargement
export const useEcomMutation = (apiFunction, options = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (mutationData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiFunction(mutationData);
      setData(response.data);
      
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }
      
      return response.data;
    } catch (err) {
      const errorMessage = apiUtils.handleError(err);
      setError(errorMessage);
      
      if (options.onError) {
        options.onError(errorMessage);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, options]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    reset
  };
};

// Hook pour créer/mettre à jour des produits
export const useProductMutation = (options = {}) => {
  return useEcomMutation(
    (data) => {
      if (data._id) {
        return ecomApi.put(`/products/${data._id}`, data);
      } else {
        return ecomApi.post('/products', data);
      }
    },
    options
  );
};

// Hook pour créer des rapports
export const useReportMutation = (options = {}) => {
  return useEcomMutation(
    (data) => ecomApi.post('/reports', data),
    options
  );
};

// Hook pour les commandes de stock
export const useStockOrderMutation = (options = {}) => {
  return useEcomMutation(
    (data) => ecomApi.post('/stock/orders', data),
    options
  );
};

// Hook pour les décisions
export const useDecisionMutation = (options = {}) => {
  return useEcomMutation(
    (data) => ecomApi.post('/decisions', data),
    options
  );
};

// Hook pour le dashboard complet selon le rôle
export const useDashboardData = (userRole) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const requests = [];
      
      // Requêtes communes à tous les rôles
      requests.push(ecomApi.get('/products?isActive=true'));
      
      // Requêtes spécifiques au rôle
      if (userRole === 'ecom_admin') {
        requests.push(
          ecomApi.get('/stock/alerts'),
          ecomApi.get('/reports/stats/financial'),
          ecomApi.get('/decisions/dashboard/overview')
        );
      } else if (userRole === 'ecom_compta') {
        requests.push(
          ecomApi.get('/reports/stats/financial'),
          ecomApi.get('/products/stats/overview')
        );
      } else if (userRole === 'ecom_closeuse') {
        const today = new Date().toISOString().split('T')[0];
        requests.push(ecomApi.get(`/reports?date=${today}`));
      }
      
      const responses = await Promise.all(requests);
      
      // Organiser les données selon le rôle
      const dashboardData = {
        products: responses[0]?.data?.data || []
      };

      if (userRole === 'ecom_admin') {
        dashboardData.stockAlerts = responses[1]?.data?.data || {};
        dashboardData.financialStats = responses[2]?.data?.data || {};
        dashboardData.decisions = responses[3]?.data?.data || {};
      } else if (userRole === 'ecom_compta') {
        dashboardData.financialStats = responses[1]?.data?.data || {};
        dashboardData.productStats = responses[2]?.data?.data || {};
      } else if (userRole === 'ecom_closeuse') {
        dashboardData.todayReports = responses[1]?.data?.data?.reports || [];
      }
      
      setData(dashboardData);
    } catch (err) {
      const errorMessage = apiUtils.handleError(err);
      setError(errorMessage);
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (userRole) {
      loadDashboardData();
    }
  }, [userRole, loadDashboardData]);

  return {
    data,
    loading,
    error,
    refetch: loadDashboardData
  };
};

// Hook pour la pagination
export const usePagination = (initialPage = 1, initialLimit = 20) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const nextPage = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPage(prev => Math.max(1, prev - 1));
  }, []);

  const goToPage = useCallback((newPage) => {
    setPage(Math.max(1, newPage));
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
  }, [initialPage]);

  return {
    page,
    limit,
    setPage,
    setLimit,
    nextPage,
    prevPage,
    goToPage,
    reset
  };
};

// Hook pour les filtres
export const useFilters = (initialFilters = {}) => {
  const [filters, setFilters] = useState(initialFilters);

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const clearFilter = useCallback((key) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const hasActiveFilters = useCallback(() => {
    return Object.keys(filters).some(key => 
      filters[key] !== undefined && 
      filters[key] !== null && 
      filters[key] !== ''
    );
  }, [filters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilter,
    clearFilters,
    hasActiveFilters
  };
};

// Hook pour la recherche avec debounce
export const useSearch = (initialValue = '', delay = 300) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, delay]);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm
  };
};
