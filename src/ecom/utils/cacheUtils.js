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
  // ❌ CACHE DÉSACTIVÉ - Ne stocke plus rien
  return;
};

/**
 * Récupérer des données du cache
 * @param {string} key - Clé du cache
 * @returns {any|null} - Données du cache ou null si non trouvé
 */
export const getCache = (key) => {
  // ❌ CACHE DÉSACTIVÉ - Retourne toujours null
  return null;
};

/**
 * Supprimer une entrée du cache
 * @param {string} key - Clé du cache
 */
export const removeCache = (key) => {
  // ❌ CACHE DÉSACTIVÉ - Ne fait rien
  return;
};

/**
 * Supprimer toutes les entrées du cache commençant par un préfixe
 * @param {string} prefix - Préfixe des clés à supprimer
 */
export const invalidatePrefix = (prefix) => {
  // ❌ CACHE DÉSACTIVÉ - Ne fait rien
  return;
};

/**
 * Vider tout le cache
 */
export const clearAllCache = () => {
  // ❌ CACHE DÉSACTIVÉ - Ne fait rien
  return;
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
      // ❌ CACHE DÉSACTIVÉ - Toujours charger depuis l'API
      setLoading(true);
      const result = await fetchFn();
      setData(result);
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
