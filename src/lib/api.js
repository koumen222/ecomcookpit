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
const DEBUG_TAG = '[EcomApi]';

function getHeaderValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
  }
  return headers[name] || headers[name.toLowerCase()] || '';
}

function buildRequestIdentity(config) {
  const storeId = getHeaderValue(config.headers, 'X-Store-Id');
  const workspaceId = getHeaderValue(config.headers, 'X-Workspace-Id');
  return [
    config.baseURL || '',
    config.url || '',
    JSON.stringify(config.params || {}),
    storeId,
    workspaceId,
  ].join('|');
}

function normalizeEnvBaseUrl(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  // Absolute URL
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const pathname = parsed.pathname.replace(/\/+$/, '');

      // Misconfiguration guard: origin only (e.g. https://xxx.up.railway.app)
      // should target API namespace explicitly.
      if (!pathname || pathname === '') {
        return `${parsed.origin}/api/ecom`;
      }

      return `${parsed.origin}${pathname}`;
    } catch {
      return value.replace(/\/+$/, '');
    }
  }

  // Relative URL
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function resolveApiBaseUrl() {
  const envBase = normalizeEnvBaseUrl(import.meta.env.VITE_API_URL);

  // On scalor.net frontend, always target public API domain to avoid
  // accidental Railway/origin redirects that break CORS preflight.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    if (envBase.includes('api.scalor.net')) return envBase;
    return 'https://api.scalor.net/api/ecom';
  }

  return envBase || '/api/ecom';
}

const API_BASE_URL = resolveApiBaseUrl();

function isDebugEndpoint(url = '') {
  return String(url).includes('/store/settings') || String(url).includes('/upload/image');
}

function clearGetCache() {
  _cache.clear();
  _inflight.clear();
}

function getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  _cache.delete(key);
  return null;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  },
  // Timeout to avoid hanging requests
  timeout: 15000,
});

console.log(`${DEBUG_TAG} initialized`, { baseURL: API_BASE_URL });

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    config._meta = {
      startedAt: Date.now(),
      requestId: Math.random().toString(36).slice(2, 10),
    };

    const token = localStorage.getItem("ecomToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const workspaceId = workspace?._id || workspace?.id;
    const isSuperAdminEndpoint = typeof config.url === 'string' && config.url.includes('/super-admin');

    if (workspaceId && !isSuperAdminEndpoint) {
      config.headers['X-Workspace-Id'] = workspaceId;
    }

    const activeStoreId = typeof window !== 'undefined' ? window.__activeStoreId__ : null;
    if (activeStoreId && !isSuperAdminEndpoint) {
      config.headers['X-Store-Id'] = activeStoreId;
    }

    if (isDebugEndpoint(config.url)) {
      console.log(`${DEBUG_TAG} request`, {
        requestId: config._meta.requestId,
        method: (config.method || 'get').toUpperCase(),
        baseURL: config.baseURL,
        url: config.url,
        fullUrl: `${config.baseURL || ''}${config.url || ''}`,
        timeout: config.timeout,
        contentType: config.headers?.['Content-Type'] || config.headers?.['content-type'],
        hasData: config.data !== undefined,
        hasParams: Boolean(config.params),
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
      });
    }

    // GET deduplication: if same GET is already in-flight, reuse the promise
    if (config.method === 'get' || !config.method) {
      const key = buildRequestIdentity(config);

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
    const meta = response.config?._meta;
    const method = String(response.config?.method || 'get').toLowerCase();
    if (isDebugEndpoint(response.config?.url)) {
      console.log(`${DEBUG_TAG} response`, {
        requestId: meta?.requestId,
        method: method.toUpperCase(),
        url: response.config?.url,
        status: response.status,
        durationMs: meta?.startedAt ? Date.now() - meta.startedAt : null,
        responseKeys: Object.keys(response.data || {}),
      });
    }

    // Mutations make previous GET cache entries stale immediately.
    if (method !== 'get') {
      clearGetCache();
      return response;
    }

    // Store successful GET responses in cache
    const key = response.config?._cacheKey;
    if (key) {
      _cache.set(key, { data: response, ts: Date.now() });
      _inflight.delete(key);
    }
    return response;
  },
  (error) => {
    const meta = error.config?._meta;
    if (isDebugEndpoint(error.config?.url)) {
      console.error(`${DEBUG_TAG} response error`, {
        requestId: meta?.requestId,
        method: (error.config?.method || 'get').toUpperCase(),
        url: error.config?.url,
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        durationMs: meta?.startedAt ? Date.now() - meta.startedAt : null,
        timeout: error?.config?.timeout,
        isCancel: axios.isCancel(error),
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        responseData: error?.response?.data,
      });
    }

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

    return Promise.reject(error);
  }
);

export default api;
