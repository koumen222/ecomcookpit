import axios from 'axios';

const isDev = import.meta.env.DEV;

function resolveAffiliateApiBase() {
  if (isDev) return '';

  const candidate = import.meta.env.VITE_STORE_API_URL
    || import.meta.env.VITE_BACKEND_URL;
  if (candidate) return String(candidate).replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }

  return 'https://api.scalor.net';
}

const API_BASE = resolveAffiliateApiBase();

export const AFFILIATE_API_BASE = API_BASE;

const AFFILIATE_TOKEN_KEY = 'affiliateToken';

export function getAffiliateToken() {
  return localStorage.getItem(AFFILIATE_TOKEN_KEY) || '';
}

export function setAffiliateToken(token) {
  if (token) localStorage.setItem(AFFILIATE_TOKEN_KEY, token);
}

export function clearAffiliateToken() {
  localStorage.removeItem(AFFILIATE_TOKEN_KEY);
}

const affiliateApi = axios.create({
  baseURL: `${API_BASE}/api/affiliate`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

affiliateApi.interceptors.request.use((config) => {
  const token = getAffiliateToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const affiliatePortalApi = {
  register: (payload) => affiliateApi.post('/auth/register', payload),
  login: (payload) => affiliateApi.post('/auth/login', payload),
  me: () => affiliateApi.get('/auth/me'),
  getDashboard: () => affiliateApi.get('/dashboard'),
  getLinks: () => affiliateApi.get('/links'),
  createLink: (payload) => affiliateApi.post('/links', payload),
  getConversions: (params = {}) => affiliateApi.get('/conversions', { params })
};
