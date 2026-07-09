import axios from 'axios';
import { logApiRequest, logApiResponse, logApiError, logAuthEvent, logPushEvent } from './prodLogger.js';
import { getErrorMessage } from '../utils/errorMessages.js';

// Configuration de base pour l'API e-commerce
function normalizeBackendBaseUrl(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const pathname = parsed.pathname.replace(/\/+$/, '');

      // Si l'URL pointe déjà sur /api/ecom on la garde telle quelle.
      if (pathname.endsWith('/api/ecom')) {
        return `${parsed.origin}/api/ecom`;
      }

      // Sinon on suffixe vers le namespace API attendu.
      return `${parsed.origin}${pathname}/api/ecom`.replace(/\/api\/ecom\/api\/ecom$/, '/api/ecom');
    } catch {
      return value.replace(/\/+$/, '');
    }
  }

  const relative = value.startsWith('/') ? value : `/${value}`;
  if (relative.endsWith('/api/ecom')) return relative;
  return `${relative}/api/ecom`.replace(/\/api\/ecom\/api\/ecom$/, '/api/ecom');
}

function isLocalhostLike(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return false;

  if (normalized.startsWith('/')) return true;

  try {
    const parsed = new URL(normalized, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(normalized);
  }
}

function resolveEcomApiBaseUrl() {
  const envBackend = import.meta.env.VITE_BACKEND_URL;
  const envApi = import.meta.env.VITE_API_URL;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  // In local Vite dev, prefer the same-origin proxy to avoid brittle direct
  // cross-origin calls to localhost:8080 from the browser.
  if (
    import.meta.env.DEV
    && typeof window !== 'undefined'
    && isLocalhostLike(window.location.origin)
    && (!envApi || isLocalhostLike(envApi))
    && (!envBackend || isLocalhostLike(envBackend))
  ) {
    return '/api/ecom';
  }

  // On production frontends, always target the public API domain first.
  // This avoids production builds accidentally using a direct Railway URL,
  // which triggers preflight failures when that hostname is not exposed.
  if (
    typeof window !== 'undefined'
    && (
      hostname.endsWith('scalor.net')
      || hostname.endsWith('scalor.site')
      || hostname.endsWith('ecomcookpit.pages.dev')
    )
  ) {
    const normalizedFromApi = normalizeBackendBaseUrl(envApi);
    if (normalizedFromApi.includes('api.scalor.net')) {
      return normalizedFromApi;
    }
    return 'https://api.scalor.net/api/ecom';
  }

  // priorité: VITE_API_URL, puis VITE_BACKEND_URL
  const normalizedFromApi = normalizeBackendBaseUrl(envApi);
  if (normalizedFromApi) return normalizedFromApi;

  const normalizedFromBackend = normalizeBackendBaseUrl(envBackend);
  if (normalizedFromBackend) return normalizedFromBackend;

  return 'https://api.scalor.net/api/ecom';
}

const ECOM_API_BASE_URL = resolveEcomApiBaseUrl();
console.log('🔧 [API] ECOM_API_BASE_URL =', ECOM_API_BASE_URL, '| VITE_API_URL =', import.meta.env.VITE_API_URL, '| VITE_BACKEND_URL =', import.meta.env.VITE_BACKEND_URL);

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 2;
// Cold start backend (Railway se rendort) : sur une erreur RÉSEAU, les POST d'auth
// sûrs sont rejoués plus longtemps, avec un backoff progressif, pour laisser au
// serveur le temps de se réveiller au lieu d'afficher tout de suite
// « Impossible de contacter le serveur ».
const AUTH_NETWORK_MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 700;
const RETRY_DELAY_MAX_MS = 6000;

// Endpoints d'auth POST sûrs à rejouer sur une simple erreur réseau / timeout.
// Ils sont idempotents ou protégés côté serveur : un blip de connexion passager
// (fréquent quand le backend "cold start") est réessayé en silence au lieu
// d'afficher "Impossible de contacter le serveur" à l'utilisateur.
// /auth/register est sûr : le backend a un index unique sur email, donc un
// replay retourne 400 "Cet email est déjà utilisé" — pas de doublon possible.
const NETWORK_RETRY_SAFE_PATHS = [
  '/auth/login',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/refresh',
  '/auth/google',
  '/auth/register',
];

function isNetworkRetrySafePath(url = '') {
  return NETWORK_RETRY_SAFE_PATHS.some((p) => url.includes(p));
}

// ─── In-memory GET cache + in-flight deduplication ───────────────────────────
// _cache:    URL → { data, ts }  — serves stale responses within TTL
// _inflight: URL → Promise       — deduplicates simultaneous identical requests
const _cache = new Map();
const _inflight = new Map();

// How long to serve cached responses without re-fetching (milliseconds).
// Endpoints can opt into longer TTLs via config._cacheTtl.
const DEFAULT_CACHE_TTL = 10_000; // 10 s — short enough to stay fresh, long enough to deduplicate bursts
const CACHE_TTLS = {
  // Super-admin (heavy aggregations, server-side cached)
  '/super-admin/dashboard-summary': 300_000, // 5 min
  '/super-admin/dashboard-quick':   120_000, // 2 min
  '/super-admin/users':              30_000, // 30 s
  '/super-admin/workspaces':         30_000, // 30 s
  '/super-admin/settings':           60_000, // 1 min
  '/analytics/engagement':           30_000, // 30 s
  // Store config — changes infrequently, served from sessionStorage on top
  '/store-manage/config':            30_000, // 30 s
  '/store-manage/subdomain':         30_000, // 30 s
  // Static-ish lists
  '/products':                       15_000, // 15 s
  '/delivery-zones':                 60_000, // 1 min
  '/orders/config':                  30_000, // 30 s
};

function getRequestPath(url = '') {
  try {
    return new URL(url, 'http://scalor.local').pathname.replace(/^\/api\/ecom/, '');
  } catch {
    return String(url || '').split('?')[0].replace(/^\/api\/ecom/, '');
  }
}

function isLiveOrdersEndpoint(url = '') {
  const path = getRequestPath(url);
  return path === '/orders'
    || path.startsWith('/orders/')
    || path === '/store-orders'
    || path.startsWith('/store-orders/');
}

function shouldAttachStoreHeader(url = '') {
  const path = getRequestPath(url);
  return !(path === '/orders' || path.startsWith('/orders/'));
}

function getCacheTtl(url = '') {
  for (const [pattern, ttl] of Object.entries(CACHE_TTLS)) {
    if (url.includes(pattern)) return ttl;
  }
  return DEFAULT_CACHE_TTL;
}

function getCacheKey(config) {
  // Strip _t (cache-bust timestamp) so the in-memory cache key is stable
  // across repeated calls to the same endpoint.
  const raw = config.params || {};
  const { _t, ...stableParams } = raw;
  const params = Object.keys(stableParams).length ? JSON.stringify(stableParams) : '';
  return `${config.url}::${params}`;
}

export function clearEcomGetCache() {
  _cache.clear();
  _inflight.clear();
  // Clear all workspace-scoped sessionStorage keys so the next workspace gets fresh data
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (
        k.startsWith('sf_') ||              // StoreFront/StoreProduct public cache
        k.startsWith('sfp_') ||             // StoreProduct public cache
        k.startsWith('dash_summary_') ||    // AdminDashboard range cache
        k.startsWith('boutique_settings_') || // BoutiqueSettings config cache
        k === 'orders_list_filters'         // OrdersList saved filters
      )) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

export function invalidateCacheFor(urlPattern) {
  for (const key of _cache.keys()) {
    if (key.includes(urlPattern)) _cache.delete(key);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableRequestError(error) {
  const config = error?.config;
  if (!config) return false;

  const method = String(config.method || 'get').toLowerCase();
  const attempt = Number(config._retryAttempt || 0);
  const status = error?.response?.status;
  const isNetworkError = !error?.response && !axios.isCancel(error);
  const isRetryableStatus = RETRYABLE_STATUS_CODES.has(status);

  if (config._retry) return false;

  // Erreurs passerelle (502/503/504) : la requête n'a jamais atteint la logique
  // applicative (proxy / cold start). Sûr à rejouer pour TOUTE méthode, y compris
  // les POST d'auth.
  if (isRetryableStatus) return attempt < MAX_RETRY_ATTEMPTS;

  // Erreurs réseau pures / timeouts : rejouer les lectures idempotentes (GET)
  // et uniquement les POST d'auth autorisés (login, otp, refresh, google).
  if (isNetworkError) {
    if (method === 'get') return attempt < MAX_RETRY_ATTEMPTS;
    if (['post', 'put', 'patch'].includes(method) && isNetworkRetrySafePath(config.url || '')) {
      // Cold start : on patiente plus longtemps pour les POST d'auth.
      return attempt < AUTH_NETWORK_MAX_RETRY_ATTEMPTS;
    }
  }

  return false;
}

const ecomApi = axios.create({
  baseURL: ECOM_API_BASE_URL,
  timeout: 30000, // 30 s — was 10 min, which let hung requests block the UI forever
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token d'authentification et le workspaceId
ecomApi.interceptors.request.use(
  (config) => {
    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

    // For multipart requests, let the browser/axios set Content-Type with boundary.
    if (isFormData && config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }

    const token = localStorage.getItem('ecomToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Analytics session correlation
    const sid = sessionStorage.getItem('_a_sid');
    if (sid) {
      config.headers['X-Session-Id'] = sid;
    }

    // Ajouter automatiquement le workspaceId aux requêtes
    // Wrapped in try-catch: corrupted localStorage JSON would otherwise throw
    // a SyntaxError inside the interceptor, causing every API call to fail silently
    // for that user ("erreur de chargement" on every page).
    let workspace = null;
    try {
      workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    } catch {
      // Self-heal: remove the corrupted entry so the user isn't permanently stuck.
      try { localStorage.removeItem('ecomWorkspace'); } catch { /* ignore */ }
    }
    const wsId = workspace?._id || workspace?.id;

    const isSuperAdminEndpoint = typeof config.url === 'string' && config.url.includes('/super-admin');

    if (wsId && !isSuperAdminEndpoint) {
      // Ajouter workspaceId aux params si c'est une requête GET
      if (config.method === 'get' && config.params) {
        config.params.workspaceId = wsId;
        config.params._t = Date.now();
      } else if (config.method === 'get' && !config.params) {
        config.params = { workspaceId: wsId, _t: Date.now() };
      }
      // Ajouter workspaceId au body si c'est une requête POST/PUT/DELETE
      else if (['post', 'put', 'patch'].includes(config.method) && isFormData) {
        if (!config.data.has('workspaceId')) {
          config.data.append('workspaceId', wsId);
        }
      } else if (['post', 'put', 'patch'].includes(config.method) && config.data) {
        if (!config.data.workspaceId) {
          config.data.workspaceId = wsId;
        }
      } else if (['post', 'put', 'patch'].includes(config.method) && !config.data) {
        config.data = { workspaceId: wsId };
      }
    }

    // Inject X-Store-Id for multi-store routing (set by StoreContext)
    const storeId = window.__activeStoreId__;
    if (storeId && !isSuperAdminEndpoint && shouldAttachStoreHeader(config.url)) {
      config.headers['X-Store-Id'] = storeId;
    }

    const isLiveOrdersRead = config.method === 'get' && isLiveOrdersEndpoint(config.url);
    if (isLiveOrdersRead) {
      config._bypassCache = true;
      // Avoid custom request headers here: they trigger a CORS preflight on
      // cross-origin GETs. The URL timestamp + server no-store headers are
      // enough to keep order reads fresh without turning refresh into a
      // browser-level "Network Error".
      config.params = {
        ...(config.params || {}),
        _fresh: Date.now()
      };
    }

    // ── Client-side GET cache ─────────────────────────────────────────────
    // Serves cached responses to avoid duplicate network requests.
    // Bypassed automatically by mutations (POST/PUT/PATCH/DELETE clear the cache).
    if (config.method === 'get' && !config._bypassCache) {
      const key = getCacheKey(config);
      const ttl = config._cacheTtl ?? getCacheTtl(config.url ?? '');
      const entry = _cache.get(key);

      if (entry && Date.now() - entry.ts < ttl) {
        // Return cached data immediately via a custom adapter
        config._fromCache = true;
        config.adapter = () => Promise.resolve({
          data: entry.data,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config,
          request: {},
        });
      } else {
        // Tag the request so the response interceptor can populate the cache
        config._cacheKey = key;
      }
    }

    // Marquer le timestamp de départ pour mesurer la durée
    config._startTime = Date.now();

    // Log complet de chaque requête
    logApiRequest(config);

    // _silent : requêtes en arrière-plan (ex : warm-up backend) qui ne doivent
    // pas afficher la barre de chargement globale.
    if (!config._silent) window.dispatchEvent(new Event('toploader:start'));
    return config;
  },
  (error) => {
    logApiError(error);
    window.dispatchEvent(new Event('toploader:stop'));
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
    const method = String(response.config?.method || 'get').toLowerCase();

    // Skip logging + toploader for cache hits
    if (!response.config?._fromCache) {
      logApiResponse(response);
      window.dispatchEvent(new Event('toploader:stop'));
    }

    // Any successful mutation invalidates short-lived GET cache entries.
    if (method !== 'get') {
      clearEcomGetCache();
      return response;
    }

    // Populate cache for future requests
    const key = response.config?._cacheKey;
    if (key && response.status === 200) {
      _cache.set(key, { data: response.data, ts: Date.now() });
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (isRetryableRequestError(error)) {
      originalRequest._retryAttempt = Number(originalRequest._retryAttempt || 0) + 1;
      // Backoff progressif (exponentiel, plafonné) : 700ms, 1.4s, 2.8s, 5.6s, 6s.
      // Laisse au backend en cold start le temps de se réveiller (~16s cumulés).
      const delay = Math.min(RETRY_DELAY_MS * 2 ** (originalRequest._retryAttempt - 1), RETRY_DELAY_MAX_MS);
      await sleep(delay);
      return ecomApi(originalRequest);
    }

    // Gérer les erreurs réseau (backend inaccessible)
    if (!error.response) {
      logApiError(error);
      window.dispatchEvent(new Event('toploader:stop'));
      if (!error.config?._silent) console.error('🌐 Erreur réseau - backend inaccessible:', error.message);
      // Important: keep original Axios error metadata (code/message/config)
      // so contextual handlers can distinguish timeout vs network vs other failures.
      return Promise.reject(error);
    }

    // Auto-refresh sur 401 (token expiré)
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Ne pas refresh sur les routes d'auth
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // Ne pas redirect si l'utilisateur est sur une page d'auth (register/login/reset).
      // Le loadUser() initial du Provider peut recevoir un 401 pour un vieux token
      // APRÈS que Register ait supprimé le token de localStorage — dans ce cas,
      // un hard redirect casserait le flux d'inscription.
      const isOnAuthPage = /\/(register|login|forgot-password|reset-password|setup-admin)/.test(
        window.location.pathname
      );

      if (isRefreshing) {
        if (isOnAuthPage) return Promise.reject(error);
        // Attendre que le refresh en cours se termine
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return ecomApi(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;

      // Vérifier si on a un token avant de tenter un refresh
      const token = localStorage.getItem('ecomToken');
      if (!token) {
        logAuthEvent('token_missing_on_401', { url: originalRequest.url });
        if (isOnAuthPage) return Promise.reject(error);
        localStorage.removeItem('ecomToken');
        localStorage.removeItem('ecomUser');
        localStorage.removeItem('ecomWorkspace');
        window.location.href = '/ecom/login';
        return Promise.reject(error);
      }

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

        if (isOnAuthPage) return Promise.reject(refreshError);
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

    // Normaliser les messages pour que les refus lies au plan ne ressortent pas
    // comme de simples erreurs techniques dans l'UI.
    const normalizedMessage = getErrorMessage(
      error,
      error.response?.data?.message || error.message || 'Une erreur est survenue.'
    );

    if (normalizedMessage) {
      error.userMessage = normalizedMessage;

      if (error.response?.data && typeof error.response.data === 'object') {
        error.response.data.userMessage = normalizedMessage;
        if (!error.response.data.message || /^Request failed with status code/i.test(error.response.data.message) || /^Erreur\b/i.test(error.response.data.message)) {
          error.response.data.message = normalizedMessage;
        }
      }

      if (!error.message || /^Request failed with status code/i.test(error.message)) {
        error.message = normalizedMessage;
      }
    }

    // Log toutes les autres erreurs HTTP
    logApiError(error);
    window.dispatchEvent(new Event('toploader:stop'));
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
  getProfile: () => ecomApi.get('/auth/me', { _bypassCache: true }),

  // Enregistrer onboarding
  saveOnboarding: (data) => ecomApi.post('/auth/onboarding', data),

  // Mettre à jour le profil (name, phone)
  updateProfile: (data) => ecomApi.put('/auth/profile', data),

  // Mettre à jour l'avatar
  updateAvatar: (data) => ecomApi.put('/auth/avatar', data),

  // Changer le mot de passe
  changePassword: (passwords) => ecomApi.put('/auth/change-password', passwords),

  // Changer la devise
  changeCurrency: (data) => ecomApi.put('/auth/currency', data),

  // Enregistrer un appareil pour session persistante
  registerDevice: (data) => ecomApi.post('/auth/register-device', data),

  // Envoyer un code OTP par email
  sendOtp: (data) => ecomApi.post('/auth/send-otp', data),

  // Vérifier un code OTP
  verifyOtp: (data) => ecomApi.post('/auth/verify-otp', data),

  // Connexion / inscription via Google
  googleAuth: (data) => ecomApi.post('/auth/google', data),

  // Créer un workspace (utilisateur authentifié)
  createWorkspace: (data) => ecomApi.post('/auth/create-workspace', data),

  // Rejoindre un workspace (utilisateur authentifié)
  joinWorkspace: (data) => ecomApi.post('/auth/join-workspace', data),

  // Valider un lien d'invitation
  validateInvite: (token) => ecomApi.get(`/auth/invite/${token}`),

  // Accepter une invitation
  acceptInvite: (data) => ecomApi.post('/auth/accept-invite', data),

  // Générer un lien d'invitation
  generateInvite: () => ecomApi.post('/auth/generate-invite'),

  // Gestion des sessions
  getSessions: () => ecomApi.get('/auth/sessions'),
  disconnectSession: (sessionId) => ecomApi.delete(`/auth/sessions/${sessionId}`),
  disconnectAllSessions: () => ecomApi.delete('/auth/sessions'),

  // Ping léger pour réveiller le backend (cold start)
  health: () => ecomApi.get('/auth/health', { timeout: 20000, _silent: true, _bypassCache: true }),
};

// ── Warm-up backend ──────────────────────────────────────────────────────────
// Réveille le backend (cold start fréquent sur l'hébergeur) dès que l'utilisateur
// arrive sur Login/Register. Le temps qu'il saisisse ses identifiants, le serveur
// est déjà chaud → fini le « Impossible de contacter le serveur » au 1er essai.
// Fire-and-forget : silencieux (pas de barre de chargement), timeout large, et
// jamais d'exception remontée à l'appelant. Les appels concurrents sont mutualisés.
let _warmUpInFlight = null;
export function warmUpBackend() {
  if (_warmUpInFlight) return _warmUpInFlight;
  _warmUpInFlight = authApi.health()
    .catch(() => null)
    .finally(() => { _warmUpInFlight = null; });
  return _warmUpInFlight;
}

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

  // Supprimer une commande de stock
  deleteStockOrder: (id) => ecomApi.delete(`/stock/orders/${id}`),

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
  // Obtenir la clé publique VAPID
  getVapidPublicKey: () => ecomApi.get('/push/vapid-public-key'),

  // S'abonner aux notifications push
  subscribe: (subscription) => ecomApi.post('/push/subscribe', subscription),

  // Se désabonner
  unsubscribe: (data) => ecomApi.delete('/push/unsubscribe', { data }),

  // Envoyer une notification de test
  sendTest: () => ecomApi.post('/push/test')
};

export const superAdminPushApi = {
  stats: () => ecomApi.get('/super-admin/push/stats'),
  sendNow: (data) => ecomApi.post('/super-admin/push/send', data),
  schedule: (data) => ecomApi.post('/super-admin/push/schedule', data),
  listScheduled: (params = {}) => ecomApi.get('/super-admin/push/scheduled', { params }),
  cancelScheduled: (id) => ecomApi.put(`/super-admin/push/scheduled/${id}/cancel`),
  listAutomations: () => ecomApi.get('/super-admin/push/automations'),
  bootstrapAutomations: () => ecomApi.post('/super-admin/push/automations/bootstrap'),
  updateAutomation: (id, data) => ecomApi.put(`/super-admin/push/automations/${id}`, data)
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

export const ordersApi = {
  // Liste des commandes
  getOrders: (params = {}) => ecomApi.get('/orders', { params }),

  // Détail d'une commande
  getOrder: (id) => ecomApi.get(`/orders/${id}`),

  // Créer une commande
  createOrder: (data) => ecomApi.post('/orders', data),

  // Mettre à jour une commande
  updateOrder: (id, data) => ecomApi.put(`/orders/${id}`, data),

  // Supprimer une commande
  deleteOrder: (id) => ecomApi.delete(`/orders/${id}`),

  // Statistiques des commandes
  getStats: (params = {}) => ecomApi.get('/orders/stats', { params }),

  // Exporter les commandes
  exportOrders: (params = {}) => ecomApi.get('/orders/export', { params, responseType: 'blob' }),

  // Mettre à jour le statut
  updateStatus: (id, status) => ecomApi.put(`/orders/${id}/status`, { status }),

  // Assigner un livreur
  assignDelivery: (id, data) => ecomApi.put(`/orders/${id}/assign`, data)
};

export const clientsApi = {
  // Liste des clients
  getClients: (params = {}) => ecomApi.get('/clients', { params }),

  // Détail d'un client
  getClient: (id) => ecomApi.get(`/clients/${id}`),

  // Créer un client
  createClient: (data) => ecomApi.post('/clients', data),

  // Mettre à jour un client
  updateClient: (id, data) => ecomApi.put(`/clients/${id}`, data),

  // Supprimer un client
  deleteClient: (id) => ecomApi.delete(`/clients/${id}`),

  // Statistiques clients
  getStats: () => ecomApi.get('/clients/stats')
};

export const campaignsApi = {
  // Liste des campagnes
  getCampaigns: (params = {}) => ecomApi.get('/campaigns', { params }),

  // Détail d'une campagne
  getCampaign: (id) => ecomApi.get(`/campaigns/${id}`),

  // Créer une campagne
  createCampaign: (data) => ecomApi.post('/campaigns', data),

  // Mettre à jour une campagne
  updateCampaign: (id, data) => ecomApi.put(`/campaigns/${id}`, data),

  // Supprimer une campagne
  deleteCampaign: (id) => ecomApi.delete(`/campaigns/${id}`),

  // Envoyer une campagne
  sendCampaign: (id) => ecomApi.post(`/campaigns/${id}/send`),

  // Statistiques campagne
  getCampaignStats: (id) => ecomApi.get(`/campaigns/${id}/stats`)
};

export const workspacesApi = {
  // Liste des workspaces
  getWorkspaces: (params = {}) => ecomApi.get('/workspaces', { params }),

  // Liste des workspaces accessibles par l'utilisateur (multi-workspace)
  getMyWorkspaces: () => ecomApi.get('/workspaces/workspaces'),

  // Switch workspace actif (met à jour le token)
  switchWorkspace: (workspaceId) => ecomApi.put(`/workspaces/switch-workspace/${workspaceId}`),

  // Détail d'un workspace
  getWorkspace: (id) => ecomApi.get(`/workspaces/${id}`),

  // Mettre à jour un workspace
  updateWorkspace: (id, data) => ecomApi.put(`/workspaces/${id}`, data),

  // Membres du workspace
  getMembers: (id) => ecomApi.get(`/workspaces/${id}/members`),

  // Inviter un membre
  inviteMember: (id, data) => ecomApi.post(`/workspaces/${id}/invite`, data),

  // Retirer un membre
  removeMember: (id, userId) => ecomApi.delete(`/workspaces/${id}/members/${userId}`),

  // Paramètres du workspace
  getSettings: (id) => ecomApi.get(`/workspaces/${id}/settings`),
  updateSettings: (id, data) => ecomApi.put(`/workspaces/${id}/settings`, data)
};

export const messagesApi = {
  // Liste des messages
  getMessages: (params = {}) => ecomApi.get('/messages', { params }),

  // Envoyer un message
  sendMessage: (data) => ecomApi.post('/messages', data),

  // Marquer comme lu
  markAsRead: (id) => ecomApi.put(`/messages/${id}/read`),

  // Supprimer un message
  deleteMessage: (id) => ecomApi.delete(`/messages/${id}`)
};

export const dmApi = {
  // Liste des conversations
  getConversations: (params = {}) => ecomApi.get('/dm/conversations', { params }),

  // Messages d'une conversation
  getMessages: (userId, params = {}) => ecomApi.get(`/dm/${userId}`, { params }),

  // Envoyer un message direct
  sendMessage: (data) => ecomApi.post('/dm/send', data),

  // Marquer comme lu
  markAsRead: (userId) => ecomApi.put(`/dm/${userId}/read`),

  // Nombre de non-lus
  getUnreadCount: () => ecomApi.get('/dm/unread-count')
};

export const mediaApi = {
  // Upload un média
  upload: (formData) => ecomApi.post('/media/upload', formData),

  // Supprimer un média
  deleteMedia: (key) => ecomApi.delete(`/media/${key}`)
};

export const contactApi = {
  // Envoyer un message de contact
  sendMessage: (data) => ecomApi.post('/contact', data)
};

export const agentApi = {
  // Conversations avec l'agent
  getConversations: (params = {}) => ecomApi.get('/agent/conversations', { params }),

  // Messages d'une conversation
  getMessages: (conversationId) => ecomApi.get(`/agent/conversations/${conversationId}/messages`),

  // Envoyer un message à l'agent
  sendMessage: (data) => ecomApi.post('/agent/chat', data),

  // Créer une nouvelle conversation
  createConversation: (data) => ecomApi.post('/agent/conversations', data),

  // Supprimer une conversation
  deleteConversation: (id) => ecomApi.delete(`/agent/conversations/${id}`),

  // Commandes agent
  executeCommand: (command, params = {}) => ecomApi.post('/agent/commands/execute', { command, params })
};

export const goalsApi = {
  // Liste des objectifs
  getGoals: (params = {}) => ecomApi.get('/goals', { params }),

  // Détail d'un objectif
  getGoal: (id) => ecomApi.get(`/goals/${id}`),

  // Créer un objectif
  createGoal: (data) => ecomApi.post('/goals', data),

  // Mettre à jour un objectif
  updateGoal: (id, data) => ecomApi.put(`/goals/${id}`, data),

  // Supprimer un objectif
  deleteGoal: (id) => ecomApi.delete(`/goals/${id}`),

  // Progression des objectifs
  getProgress: (params = {}) => ecomApi.get('/goals/progress', { params })
};

export const transactionsApi = {
  // Liste des transactions
  getTransactions: (params = {}) => ecomApi.get('/transactions', { params }),

  // Détail d'une transaction
  getTransaction: (id) => ecomApi.get(`/transactions/${id}`),

  // Créer une transaction
  createTransaction: (data) => ecomApi.post('/transactions', data),

  // Mettre à jour une transaction
  updateTransaction: (id, data) => ecomApi.put(`/transactions/${id}`, data),

  // Supprimer une transaction
  deleteTransaction: (id) => ecomApi.delete(`/transactions/${id}`),

  // Statistiques financières
  getStats: (params = {}) => ecomApi.get('/transactions/stats', { params }),

  // Exporter les transactions
  exportTransactions: (params = {}) => ecomApi.get('/transactions/export', { params, responseType: 'blob' })
};

export const analyticsApi = {
  // Événements analytics
  trackEvent: (data) => ecomApi.post('/analytics/events', data),

  // Sessions
  getSessions: (params = {}) => ecomApi.get('/analytics/sessions', { params }),

  // Statistiques
  getStats: (params = {}) => ecomApi.get('/analytics/stats', { params }),

  // Dashboard analytics
  getDashboard: (params = {}) => ecomApi.get('/analytics/dashboard', { params })
};

export const superAdminApi = {
  // Utilisateurs
  getUsers: (params = {}) => ecomApi.get('/super-admin/users', { params }),
  getUser: (id) => ecomApi.get(`/super-admin/users/${id}`),
  updateUserRole: (id, role) => ecomApi.put(`/super-admin/users/${id}/role`, { role }),
  toggleUser: (id) => ecomApi.put(`/super-admin/users/${id}/toggle`),
  deleteUser: (id) => ecomApi.delete(`/super-admin/users/${id}`),

  // Workspaces
  getWorkspaces: (params = {}) => ecomApi.get('/super-admin/workspaces', { params }),
  toggleWorkspace: (id) => ecomApi.put(`/super-admin/workspaces/${id}/toggle`),

  // Security & Audit
  getSecurityInfo: () => ecomApi.get('/super-admin/security-info'),
  getAuditLogs: (params = {}) => ecomApi.get('/super-admin/audit-logs', { params }),

  // WhatsApp postulations
  getWhatsAppPostulations: (params = {}) => ecomApi.get('/super-admin/whatsapp-postulations', { params }),
  updateWhatsAppPostulation: (id, data) => ecomApi.put(`/super-admin/whatsapp-postulations/${id}`, data),

  // WhatsApp logs
  getWhatsAppLogs: (params = {}) => ecomApi.get('/super-admin/whatsapp-logs', { params }),

  // Boutique stats
  getBoutiqueSelector: () => ecomApi.get('/super-admin/boutique-stats'),
  getBoutiqueStats: (params = {}) => ecomApi.get('/super-admin/boutique-stats', { params }),
};

export const productResearchApi = {
  // Liste des recherches produits
  getResearches: (params = {}) => ecomApi.get('/products-research', { params }),

  // Détail d'une recherche
  getResearch: (id) => ecomApi.get(`/products-research/${id}`),

  // Créer une recherche
  createResearch: (data) => ecomApi.post('/products-research', data),

  // Mettre à jour une recherche
  updateResearch: (id, data) => ecomApi.put(`/products-research/${id}`, data),

  // Supprimer une recherche
  deleteResearch: (id) => ecomApi.delete(`/products-research/${id}`)
};

export const stockLocationsApi = {
  // Liste des emplacements
  getLocations: (params = {}) => ecomApi.get('/stock-locations', { params }),

  // Détail d'un emplacement
  getLocation: (id) => ecomApi.get(`/stock-locations/${id}`),

  // Créer un emplacement
  createLocation: (data) => ecomApi.post('/stock-locations', data),

  // Mettre à jour un emplacement
  updateLocation: (id, data) => ecomApi.put(`/stock-locations/${id}`, data),

  // Supprimer un emplacement
  deleteLocation: (id) => ecomApi.delete(`/stock-locations/${id}`)
};

export const notificationPreferencesApi = {
  // Obtenir les préférences
  getPreferences: () => ecomApi.get('/notification-preferences'),

  // Mettre à jour les préférences
  updatePreferences: (data) => ecomApi.put('/notification-preferences', data)
};

export const autoSyncApi = {
  // Configuration auto-sync
  getConfig: () => ecomApi.get('/auto-sync/config'),

  // Mettre à jour la configuration
  updateConfig: (data) => ecomApi.put('/auto-sync/config', data),

  // Lancer une synchronisation manuelle
  syncNow: () => ecomApi.post('/auto-sync/sync-now'),

  // Historique des synchronisations
  getHistory: (params = {}) => ecomApi.get('/auto-sync/history', { params })
};

export const ecoreApi = {
  // Analyse de produit
  analyzeProduct: (data) => ecomApi.post('/ecore/analyze', data),

  // Suggestions
  getSuggestions: (params = {}) => ecomApi.get('/ecore/suggestions', { params }),

  // Rapport ecore
  getReport: (id) => ecomApi.get(`/ecore/reports/${id}`)
};

// ─── Store / Storefront APIs ────────────────────────────────────────────────
export const storeManageApiLegacy = {
  getStoreConfig: () => ecomApi.get('/store-manage/config'),
  updateStoreConfig: (data) => ecomApi.put('/store-manage/config', data),
  setSubdomain: (subdomain) => ecomApi.put('/store-manage/subdomain', { subdomain }),
  checkSubdomain: (subdomain) => ecomApi.get(`/store-manage/subdomain/check/${subdomain}`)
};

export const storeProductsApiLegacy = {
  getProducts: (params = {}) => ecomApi.get('/store-products', { params }),
  getProduct: (id) => ecomApi.get(`/store-products/${id}`),
  createProduct: (data) => ecomApi.post('/store-products', data),
  updateProduct: (id, data) => ecomApi.put(`/store-products/${id}`, data),
  deleteProduct: (id) => ecomApi.delete(`/store-products/${id}`),
  getCategories: () => ecomApi.get('/store-products/categories/list')
};

export const storeOrdersApiLegacy = {
  getOrders: (params = {}) => ecomApi.get('/store-orders', { params }),
  getOrder: (id) => ecomApi.get(`/store-orders/${id}`),
  updateOrderStatus: (id, status) => ecomApi.put(`/store-orders/${id}/status`, { status }),
  getStats: () => ecomApi.get('/store-orders/stats')
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
