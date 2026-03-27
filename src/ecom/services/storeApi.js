import ecomApi from './ecommApi.js';
import axios from 'axios';

/**
 * Store API service layer.
 * 
 * Two sections:
 * 1. storeManageApi — authenticated dashboard calls (store config, products CRUD, orders)
 * 2. publicStoreApi — unauthenticated public store calls (storefront)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD APIs (authenticated — uses ecomApi with token interceptor)
// ═══════════════════════════════════════════════════════════════════════════════

export const storeManageApi = {
  // ─── Store Configuration ──────────────────────────────────────────────
  getStoreConfig: () => ecomApi.get('/store-manage/config'),
  updateStoreConfig: (data) => ecomApi.put('/store-manage/config', data),
  setSubdomain: (subdomain) => ecomApi.put('/store-manage/subdomain', { subdomain }),
  checkSubdomain: (subdomain) => ecomApi.get(`/store-manage/subdomain/check/${subdomain}`),

  // ─── Theme & Pages (builder) ──────────────────────────────────────────
  getTheme: () => ecomApi.get('/store/theme'),
  updateTheme: (data) => ecomApi.put('/store/theme', data),
  getPages: () => ecomApi.get('/store/pages'),
  updatePages: (data) => ecomApi.put('/store/pages', data),

  // ─── AI Homepage Generation ───────────────────────────────────────────
  generateHomepage: () => ecomApi.post('/store-manage/generate-homepage'),
  regenerateHomepage: () => ecomApi.post('/store-manage/regenerate-homepage'),
};

export const storeProductsApi = {
  // ─── Store Products CRUD ──────────────────────────────────────────────
  getProducts: (params = {}) => ecomApi.get('/store-products', { params }),
  getProduct: (id) => ecomApi.get(`/store-products/${id}`),
  createProduct: (data) => ecomApi.post('/store-products', data),
  updateProduct: (id, data) => ecomApi.put(`/store-products/${id}`, data),
  deleteProduct: (id) => ecomApi.delete(`/store-products/${id}`),
  getCategories: () => ecomApi.get('/store-products/categories/list'),

  // ─── System product picker (link store product to main catalogue) ─────
  getSystemProducts: (search = '') =>
    // Same source as /ecom/products page
    ecomApi.get('/products', { params: { search } }),

  // ─── AI product generation ────────────────────────────────────────────
  generateProduct: (input, inputType) =>
    ecomApi.post('/store-products/generate', { input, inputType }),

  // ─── Image Upload via R2 ──────────────────────────────────────────────
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    return ecomApi.post('/store-products/upload', formData);
  }
};

export const storeOrdersApi = {
  // ─── Store Orders Management ──────────────────────────────────────────
  getOrders: (params = {}) => ecomApi.get('/store-orders', { params }),
  getOrder: (id) => ecomApi.get(`/store-orders/${id}`),
  updateOrderStatus: (id, status) => ecomApi.put(`/store-orders/${id}/status`, { status }),
  getStats: () => ecomApi.get('/store-orders/stats'),
};

export const storeDeliveryZonesApi = {
  // ─── Delivery Zones Management ────────────────────────────────────────
  getZones: () => ecomApi.get('/store/delivery-zones'),
  saveZones: (data) => ecomApi.put('/store/delivery-zones', data),
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC STORE APIs (no auth — direct calls to api.scalor.net)
// ═══════════════════════════════════════════════════════════════════════════════

// API base URL:
// Production: https://api.scalor.net (wildcard DNS → Railway)
// Dev: falls back to VITE_BACKEND_URL or Railway direct URL
const API_BASE = import.meta.env.VITE_STORE_API_URL
  || (import.meta.env.PROD ? 'https://api.scalor.net' : null)
  || import.meta.env.VITE_BACKEND_URL
  || 'https://api.scalor.net';

const publicApi = axios.create({
  baseURL: `${API_BASE}/api/store`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

export const publicStoreApi = {
  // Get store config + initial products (single call — optimized for African markets)
  getStore: (subdomain) => publicApi.get(`/${subdomain}`),

  // Get published products (paginated, filtered)
  getProducts: (subdomain, params = {}) => publicApi.get(`/${subdomain}/products`, { params }),

  // Get single product by slug
  getProduct: (subdomain, slug) => publicApi.get(`/${subdomain}/products/${slug}`),

  // Get store categories
  getCategories: (subdomain) => publicApi.get(`/${subdomain}/categories`),

  // Get delivery zones for checkout
  getDeliveryZones: (subdomain) => publicApi.get(`/${subdomain}/delivery-zones`),

  // Place a public order (guest checkout)
  placeOrder: (subdomain, orderData) => publicApi.post(`/${subdomain}/orders`, orderData),
};
