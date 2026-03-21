import axios from 'axios';

// ═══════════════════════════════════════════════
// Scalor SaaS WhatsApp API - Frontend Service
// ═══════════════════════════════════════════════

const SCALOR_API_BASE = import.meta.env.VITE_SCALOR_API_URL
  || (import.meta.env.PROD ? 'https://api.scalor.net' : '')
  || '';

const scalorApi = axios.create({
  baseURL: `${SCALOR_API_BASE}/api/scalor`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

// ─── Auth token management ────────────────────
const TOKEN_KEY = 'scalor_token';
const USER_KEY = 'scalor_user';

export function getScalorToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getScalorUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch { return null; }
}

export function setScalorSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearScalorSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Attach JWT token to all requests
scalorApi.interceptors.request.use(config => {
  const token = getScalorToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle expired tokens
scalorApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && error.response?.data?.error === 'token_expired') {
      clearScalorSession();
    }
    return Promise.reject(error);
  }
);

// ─── Authentication ───────────────────────────
export async function scalorRegister({ email, password, name, company, phone }) {
  const { data } = await scalorApi.post('/auth/register', { email, password, name, company, phone });
  if (data.token) {
    setScalorSession(data.token, data.user);
  }
  return data;
}

export async function scalorLogin({ email, password }) {
  const { data } = await scalorApi.post('/auth/login', { email, password });
  if (data.token) {
    setScalorSession(data.token, data.user);
  }
  return data;
}

/**
 * Auto-login via ecom session: passes the ecom JWT so the backend
 * creates/retrieves the linked Scalor account without a password.
 */
export async function scalorLoginFromEcom() {
  const ecomToken = localStorage.getItem('ecomToken');
  if (!ecomToken) throw new Error('no_ecom_token');
  const { data } = await scalorApi.post('/auth/from-ecom', {}, {
    headers: { Authorization: `Bearer ${ecomToken}` }
  });
  if (data.token) {
    setScalorSession(data.token, data.user);
  }
  return data;
}

export async function scalorGetMe() {
  const { data } = await scalorApi.get('/auth/me');
  return data;
}

// ─── API Keys ─────────────────────────────────
export async function scalorCreateApiKey(nameOrPayload, type = 'live') {
  const payload = typeof nameOrPayload === 'object' && nameOrPayload !== null
    ? { name: nameOrPayload.name, type: nameOrPayload.type || type }
    : { name: nameOrPayload, type };
  const { data } = await scalorApi.post('/auth/api-keys', payload);
  return data;
}

export async function scalorDeleteApiKey(keyId) {
  const { data } = await scalorApi.delete(`/auth/api-keys/${keyId}`);
  return data;
}

// ─── Instances ────────────────────────────────
export async function scalorCreateInstance(nameOrPayload) {
  const name = typeof nameOrPayload === 'object' && nameOrPayload !== null
    ? (nameOrPayload.name || nameOrPayload.displayName)
    : nameOrPayload;
  const { data } = await scalorApi.post('/instance/create', { name });
  return data;
}

export async function scalorListInstances() {
  const { data } = await scalorApi.get('/instance');
  return data;
}

export async function scalorGetInstance(id) {
  const { data } = await scalorApi.get(`/instance/${id}`);
  return data;
}

export async function scalorGetQrCode(id) {
  const { data } = await scalorApi.get(`/instance/${id}/qrcode`);
  return data;
}

export async function scalorDisconnectInstance(id) {
  const { data } = await scalorApi.post(`/instance/${id}/disconnect`);
  return data;
}

export async function scalorRestartInstance(id) {
  const { data } = await scalorApi.post(`/instance/${id}/restart`);
  return data;
}

export async function scalorDeleteInstance(id) {
  const { data } = await scalorApi.delete(`/instance/${id}`);
  return data;
}

export async function scalorSetWebhook(id, urlOrPayload, events) {
  const payload = typeof urlOrPayload === 'object' && urlOrPayload !== null
    ? { url: urlOrPayload.url || urlOrPayload.webhookUrl, events: urlOrPayload.events || events }
    : { url: urlOrPayload, events };
  const { data } = await scalorApi.put(`/instance/${id}/webhook`, payload);
  return data;
}

// ─── Messages ─────────────────────────────────
export async function scalorSendText({ instanceName, number, message }) {
  const { data } = await scalorApi.post('/message/send/text', { instanceName, number, message });
  return data;
}

export async function scalorSendMedia({ instanceName, number, mediaUrl, caption, fileName }) {
  const { data } = await scalorApi.post('/message/send/media', { instanceName, number, mediaUrl, caption, fileName });
  return data;
}

export async function scalorSendBulk({ instanceName, messages }) {
  const { data } = await scalorApi.post('/message/send/bulk', { instanceName, messages });
  return data;
}

export async function scalorGetMessageLogs({ instanceName, status, limit, page } = {}) {
  const params = new URLSearchParams();
  if (instanceName) params.set('instanceName', instanceName);
  if (status) params.set('status', status);
  if (limit) params.set('limit', limit);
  if (page) params.set('page', page);
  const { data } = await scalorApi.get(`/message/logs?${params}`);
  return data;
}

// ─── Dashboard ────────────────────────────────
export async function scalorGetDashboard() {
  const { data } = await scalorApi.get('/dashboard/dashboard');
  return data;
}

export async function scalorGetUsage() {
  const { data } = await scalorApi.get('/dashboard/usage');
  return data;
}

// ─── Plan ─────────────────────────────────────
export async function scalorUpgradePlan(plan) {
  const { data } = await scalorApi.put('/auth/plan', { plan });
  return data;
}

export default scalorApi;
