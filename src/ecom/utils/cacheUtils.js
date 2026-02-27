/**
 * Utilitaire de cache simple avec localStorage
 * Les données restent en cache jusqu'à suppression manuelle
 */

const CACHE_PREFIX = 'ecom_cache_';

/**
 * Sauvegarder des données dans le cache
 * @param {string} key - Clé du cache
 * @param {any} data - Données à mettre en cache
 */
export const setCache = (key, data) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde du cache:', error);
  }
};

/**
 * Récupérer des données du cache
 * @param {string} key - Clé du cache
 * @returns {any|null} - Données du cache ou null si non trouvé
 */
export const getCache = (key) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération du cache:', error);
    return null;
  }
};

/**
 * Supprimer une entrée du cache
 * @param {string} key - Clé du cache
 */
export const removeCache = (key) => {
  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Erreur lors de la suppression du cache:', error);
  }
};

/**
 * Vider tout le cache
 */
export const clearAllCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Erreur lors du vidage du cache:', error);
  }
};

/**
 * Hook personnalisé pour utiliser le cache avec React
 * @param {string} key - Clé du cache
 * @param {Function} fetchFn - Fonction pour récupérer les données
 * @returns {Object} - { data, loading, error, refresh }
 */
export const useCachedData = (key, fetchFn) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const loadData = async (useCache = true) => {
    try {
      // Essayer de charger depuis le cache d'abord
      if (useCache) {
        const cached = getCache(key);
        if (cached) {
          setData(cached);
          setLoading(false);
          return;
        }
      }

      // Si pas de cache, charger depuis l'API
      setLoading(true);
      const result = await fetchFn();
      setData(result);
      setCache(key, result);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => loadData(false);

  React.useEffect(() => {
    loadData(true);
  }, [key]);

  return { data, loading, error, refresh };
};
