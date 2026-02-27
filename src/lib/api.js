import axios from "axios";

/**
 * Client API centralisé — optimisé pour la performance
 * - Parsing JSON natif (plus rapide que text + JSON.parse)
 * - Déduplication des requêtes GET concurrentes
 * - Cache court (5s) pour les appels répétés
 */

// ── Request deduplication ──
const _inflight = new Map();

// ── Simple GET cache (5s TTL) ──
const _cache = new Map();
const CACHE_TTL = 5000;

function getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  _cache.delete(key);
  return null;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/ecom",
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  },
  // Timeout to avoid hanging requests
  timeout: 15000,
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // GET deduplication: if same GET is already in-flight, reuse the promise
    if (config.method === 'get' || !config.method) {
      const key = config.baseURL + (config.url || '') + JSON.stringify(config.params || {});

      // Check cache first
      const cached = getCached(key);
      if (cached) {
        const source = axios.CancelToken.source();
        config.cancelToken = source.token;
        config._fromCache = true;
        // Resolve immediately with cached data
        source.cancel({ __cached: true, data: cached });
        return config;
      }

      // Deduplicate concurrent identical GET requests
      if (_inflight.has(key)) {
        const source = axios.CancelToken.source();
        config.cancelToken = source.token;
        config._dedup = true;
        _inflight.get(key).then(
          res => source.cancel({ __dedup: true, data: res }),
          () => {} // let the duplicate fail silently
        );
        return config;
      }

      config._cacheKey = key;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs globales + cache
api.interceptors.response.use(
  (response) => {
    // Store successful GET responses in cache
    const key = response.config?._cacheKey;
    if (key) {
      _cache.set(key, { data: response, ts: Date.now() });
      _inflight.delete(key);
    }
    return response;
  },
  (error) => {
    // Handle cached/deduped responses (returned via cancel)
    if (axios.isCancel(error)) {
      const msg = error.message;
      if (msg?.__cached || msg?.__dedup) {
        return msg.data;
      }
    }

    // Clean up inflight tracking
    const key = error.config?._cacheKey;
    if (key) _inflight.delete(key);

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
