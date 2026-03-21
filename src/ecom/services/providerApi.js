import axios from 'axios';

function normalizeBase(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const pathname = parsed.pathname.replace(/\/+$/, '');
      if (pathname.endsWith('/api/provider')) {
        return `${parsed.origin}/api/provider`;
      }
      return `${parsed.origin}${pathname}/api/provider`.replace(/\/api\/provider\/api\/provider$/, '/api/provider');
    } catch {
      return value.replace(/\/+$/, '');
    }
  }

  const relative = value.startsWith('/') ? value : `/${value}`;
  if (relative.endsWith('/api/provider')) return relative;
  return `${relative}/api/provider`.replace(/\/api\/provider\/api\/provider$/, '/api/provider');
}

function resolveProviderBaseUrl() {
  const fromApi = normalizeBase(import.meta.env.VITE_API_URL);
  const fromBackend = normalizeBase(import.meta.env.VITE_BACKEND_URL);

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    if (fromApi.includes('api.scalor.net')) return fromApi;
    return 'https://api.scalor.net/api/provider';
  }

  return fromApi || fromBackend || '/api/provider';
}

const providerApi = axios.create({
  baseURL: resolveProviderBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const providerStorage = {
  getToken: () => localStorage.getItem('providerToken') || '',
  setToken: (token) => localStorage.setItem('providerToken', token),
  clear: () => {
    localStorage.removeItem('providerToken');
    localStorage.removeItem('providerProfile');
  },
  getProfile: () => {
    try {
      return JSON.parse(localStorage.getItem('providerProfile') || 'null');
    } catch {
      return null;
    }
  },
  setProfile: (profile) => localStorage.setItem('providerProfile', JSON.stringify(profile || null))
};

providerApi.interceptors.request.use((config) => {
  const token = providerStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function errorMessage(error, fallback = 'Une erreur est survenue') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

export async function registerProvider(payload) {
  try {
    const { data } = await providerApi.post('/register', payload);
    if (data?.provider?.apiToken) {
      providerStorage.setToken(data.provider.apiToken);
    }
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Inscription impossible'));
  }
}

export async function verifyProviderEmail(token) {
  try {
    const { data } = await providerApi.post(`/verify-email/${token}`);
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Verification email impossible'));
  }
}

export async function loginProvider(payload) {
  try {
    const { data } = await providerApi.post('/login', payload);
    if (data?.data?.token) {
      providerStorage.setToken(data.data.token);
    }
    if (data?.data?.provider) {
      providerStorage.setProfile(data.data.provider);
    }
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Connexion impossible'));
  }
}

export async function loginProviderFromEcom() {
  try {
    const ecomToken = localStorage.getItem('ecomToken') || '';
    if (!ecomToken) {
      throw new Error('Session ecom introuvable');
    }

    const { data } = await providerApi.post('/from-ecom', {}, {
      headers: { Authorization: `Bearer ${ecomToken}` }
    });

    if (data?.data?.token) {
      providerStorage.setToken(data.data.token);
    }
    if (data?.data?.provider) {
      providerStorage.setProfile(data.data.provider);
    }

    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Connexion provider automatique impossible'));
  }
}

export async function getProviderMe() {
  try {
    const { data } = await providerApi.get('/me');
    if (data?.data) {
      providerStorage.setProfile(data.data);
    }
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Impossible de recuperer le profil provider'));
  }
}

export async function refreshProviderToken() {
  try {
    const { data } = await providerApi.post('/refresh-token');
    if (data?.data?.token) {
      providerStorage.setToken(data.data.token);
    }
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Refresh token impossible'));
  }
}

export async function listProviderInstances() {
  try {
    const { data } = await providerApi.get('/instances');
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Impossible de charger les instances'));
  }
}

export async function createProviderInstance(payload) {
  try {
    const { data } = await providerApi.post('/instances', payload);
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Creation instance impossible'));
  }
}

export async function updateProviderInstance(instanceId, payload) {
  try {
    const { data } = await providerApi.put(`/instances/${instanceId}`, payload);
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Mise a jour instance impossible'));
  }
}

export async function deleteProviderInstance(instanceId) {
  try {
    const { data } = await providerApi.delete(`/instances/${instanceId}`);
    return data;
  } catch (error) {
    throw new Error(errorMessage(error, 'Suppression instance impossible'));
  }
}

export function providerApiBaseUrl() {
  return providerApi.defaults.baseURL;
}
