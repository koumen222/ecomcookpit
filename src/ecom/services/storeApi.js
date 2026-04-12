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
  generateHomepage: (data) => ecomApi.post('/store-manage/generate-homepage', data),
  regenerateHomepage: (data) => ecomApi.post('/store-manage/regenerate-homepage', data),
  generateLogos: (data) => ecomApi.post('/store-manage/generate-logos', data),
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

  // ─── AI review generation ─────────────────────────────────────────────
  generateReviews: (data) =>
    ecomApi.post('/store-products/generate-reviews', data),

  // ─── Image Upload via R2 ──────────────────────────────────────────────
  uploadImages: (files) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    return ecomApi.post('/store-products/upload', formData);
  },

  // ─── Product Page Builder ─────────────────────────────────────────────
  savePageBuilder: (id, pageBuilder) =>
    ecomApi.put(`/store-products/${id}`, { pageBuilder }),
  duplicateProduct: (id, data = {}) =>
    ecomApi.post(`/store-products/${id}/duplicate`, data),
};

export const storeOrdersApi = {
  // ─── Store Orders Management ──────────────────────────────────────────
  getOrders: (params = {}) => ecomApi.get('/store-orders', { params }),
  getOrder: (id) => ecomApi.get(`/store-orders/${id}`),
  updateOrderStatus: (id, status) => ecomApi.put(`/store-orders/${id}/status`, { status }),
  deleteOrder: (id) => ecomApi.delete(`/store-orders/${id}`),
  bulkDelete: (ids) => ecomApi.post('/store-orders/bulk-delete', { ids }),
  bulkStatus: (ids, status) => ecomApi.put('/store-orders/bulk-status', { ids, status }),
  getStats: () => ecomApi.get('/store-orders/stats'),
};

export const quantityOffersApi = {
  // ─── Quantity Offers CRUD ──────────────────────────────────────────────
  getOffers: (params = {}) => ecomApi.get('/quantity-offers', { params }),
  getOffer: (id) => ecomApi.get(`/quantity-offers/${id}`),
  createOffer: (data) => ecomApi.post('/quantity-offers', data),
  updateOffer: (id, data) => ecomApi.put(`/quantity-offers/${id}`, data),
  deleteOffer: (id) => ecomApi.delete(`/quantity-offers/${id}`),
  duplicateOffer: (id, data = {}) => ecomApi.post(`/quantity-offers/${id}/duplicate`, data),
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

  // Server-side tracking bridge (Meta CAPI dedup)
  trackEvent: (subdomain, payload) => publicApi.post(`/${subdomain}/track`, payload),

  // Place a public order (guest checkout)
  placeOrder: (subdomain, orderData) => publicApi.post(`/${subdomain}/orders`, orderData),
};


// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-STORE APIs (authenticated — CRUD on Store documents)
// ═══════════════════════════════════════════════════════════════════════════════

export const storesApi = {
  getStores:      ()              => ecomApi.get('/stores'),
  createStore:    (data)          => ecomApi.post('/stores', data),
  getStore:       (id)            => ecomApi.get(`/stores/${id}`),
  updateStore:    (id, data)      => ecomApi.put(`/stores/${id}`, data),
  setSubdomain:   (id, subdomain) => ecomApi.put(`/stores/${id}/subdomain`, { subdomain }),
  checkSubdomain: (subdomain, excludeStoreId) => ecomApi.get(`/stores/check-subdomain/${subdomain}${excludeStoreId ? `?excludeStoreId=${excludeStoreId}` : ''}`),
  setPrimary:     (id)            => ecomApi.post(`/stores/${id}/set-primary`),
  deleteStore:    (id)            => ecomApi.delete(`/stores/${id}`),
};
