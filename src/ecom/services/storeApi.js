import ecomApi from './ecommApi.js';
import axios from 'axios';

const STORE_PRODUCT_TEMPLATE_COLUMNS = [
  'Title',
  'URL handle',
  'Description',
  'Vendor',
  'Product category',
  'Type',
  'Tags',
  'Published on online store',
  'Status',
  'SKU',
  'Barcode',
  'Option1 name',
  'Option1 value',
  'Option1 Linked To',
  'Option2 name',
  'Option2 value',
  'Option2 Linked To',
  'Option3 name',
  'Option3 value',
  'Option3 Linked To',
  'Price',
  'Compare-at price',
  'Cost per item',
  'Charge tax',
  'Tax code',
  'Unit price total measure',
  'Unit price total measure unit',
  'Unit price base measure',
  'Unit price base measure unit',
  'Inventory tracker',
  'Inventory quantity',
  'Continue selling when out of stock',
  'Weight value (grams)',
  'Weight unit for display',
  'Requires shipping',
  'Fulfillment service',
  'Product image URL',
  'Image position',
  'Image alt text',
  'Variant image URL',
  'Gift card',
  'SEO title',
  'SEO description',
  'Color (product.metafields.shopify.color-pattern)',
  'Google Shopping / Google product category',
  'Google Shopping / Gender',
  'Google Shopping / Age group',
  'Google Shopping / Manufacturer part number (MPN)',
  'Google Shopping / Ad group name',
  'Google Shopping / Ads labels',
  'Google Shopping / Condition',
  'Google Shopping / Custom product',
  'Google Shopping / Custom label 0',
  'Google Shopping / Custom label 1',
  'Google Shopping / Custom label 2',
  'Google Shopping / Custom label 3',
  'Google Shopping / Custom label 4'
];

const STORE_PRODUCT_SCALOR_COLUMNS = [
  'Scalor linked product ID',
  'Scalor currency',
  'Scalor target market',
  'Scalor country',
  'Scalor city',
  'Scalor locale',
  'Scalor videos JSON',
  'Scalor features JSON',
  'Scalor testimonials JSON',
  'Scalor testimonials config JSON',
  'Scalor FAQ JSON',
  'Scalor page data JSON',
  'Scalor page builder JSON',
  'Scalor product page config JSON',
  'Scalor created at',
  'Scalor updated at'
];

const STORE_PRODUCT_CSV_COLUMNS = [...STORE_PRODUCT_TEMPLATE_COLUMNS, ...STORE_PRODUCT_SCALOR_COLUMNS];

function sanitizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeCsvValue(value) {
  const stringValue = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildStoreProductCsvBlob(product) {
  const handle = sanitizeSlug(product.slug || product.name || 'product');
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [{ url: '', alt: '', order: 0 }];

  const rowObjects = images.map((image, index) => ({
    Title: index === 0 ? (product.name || '') : '',
    'URL handle': handle,
    Description: index === 0 ? (product.description || '') : '',
    Vendor: '',
    'Product category': index === 0 ? (product.category || '') : '',
    Type: index === 0 ? (product.category || '') : '',
    Tags: index === 0 ? (product.tags || []).join(', ') : '',
    'Published on online store': index === 0 ? (product.isPublished ? 'TRUE' : 'FALSE') : '',
    Status: index === 0 ? (product.isPublished ? 'Active' : 'Draft') : '',
    SKU: '',
    Barcode: '',
    'Option1 name': '',
    'Option1 value': '',
    'Option1 Linked To': '',
    'Option2 name': '',
    'Option2 value': '',
    'Option2 Linked To': '',
    'Option3 name': '',
    'Option3 value': '',
    'Option3 Linked To': '',
    Price: index === 0 ? (product.price ?? '') : '',
    'Compare-at price': index === 0 ? (product.compareAtPrice ?? '') : '',
    'Cost per item': '',
    'Charge tax': index === 0 ? 'TRUE' : '',
    'Tax code': '',
    'Unit price total measure': '',
    'Unit price total measure unit': '',
    'Unit price base measure': '',
    'Unit price base measure unit': '',
    'Inventory tracker': index === 0 ? 'shopify' : '',
    'Inventory quantity': index === 0 ? (product.stock ?? 0) : '',
    'Continue selling when out of stock': index === 0 ? 'DENY' : '',
    'Weight value (grams)': '',
    'Weight unit for display': index === 0 ? 'g' : '',
    'Requires shipping': index === 0 ? 'TRUE' : '',
    'Fulfillment service': index === 0 ? 'manual' : '',
    'Product image URL': image?.url || '',
    'Image position': image?.url ? (index + 1) : '',
    'Image alt text': image?.alt || '',
    'Variant image URL': '',
    'Gift card': index === 0 ? 'FALSE' : '',
    'SEO title': index === 0 ? (product.seoTitle || '') : '',
    'SEO description': index === 0 ? (product.seoDescription || '') : '',
    'Color (product.metafields.shopify.color-pattern)': '',
    'Google Shopping / Google product category': index === 0 ? (product.category || '') : '',
    'Google Shopping / Gender': '',
    'Google Shopping / Age group': '',
    'Google Shopping / Manufacturer part number (MPN)': '',
    'Google Shopping / Ad group name': '',
    'Google Shopping / Ads labels': '',
    'Google Shopping / Condition': index === 0 ? 'New' : '',
    'Google Shopping / Custom product': index === 0 ? 'FALSE' : '',
    'Google Shopping / Custom label 0': '',
    'Google Shopping / Custom label 1': '',
    'Google Shopping / Custom label 2': '',
    'Google Shopping / Custom label 3': '',
    'Google Shopping / Custom label 4': '',
    'Scalor linked product ID': index === 0 ? (product.linkedProductId || '') : '',
    'Scalor currency': index === 0 ? (product.currency || '') : '',
    'Scalor target market': index === 0 ? (product.targetMarket || '') : '',
    'Scalor country': index === 0 ? (product.country || '') : '',
    'Scalor city': index === 0 ? (product.city || '') : '',
    'Scalor locale': index === 0 ? (product.locale || '') : '',
    'Scalor videos JSON': index === 0 ? JSON.stringify(product.videos || []) : '',
    'Scalor features JSON': index === 0 ? JSON.stringify(product.features || []) : '',
    'Scalor testimonials JSON': index === 0 ? JSON.stringify(product.testimonials || []) : '',
    'Scalor testimonials config JSON': index === 0 ? (product.testimonialsConfig ? JSON.stringify(product.testimonialsConfig) : '') : '',
    'Scalor FAQ JSON': index === 0 ? JSON.stringify(product.faq || []) : '',
    'Scalor page data JSON': index === 0 ? (product._pageData ? JSON.stringify(product._pageData) : '') : '',
    'Scalor page builder JSON': index === 0 ? (product.pageBuilder ? JSON.stringify(product.pageBuilder) : '') : '',
    'Scalor product page config JSON': index === 0 ? (product.productPageConfig ? JSON.stringify(product.productPageConfig) : '') : '',
    'Scalor created at': index === 0 && product.createdAt ? new Date(product.createdAt).toISOString() : '',
    'Scalor updated at': index === 0 && product.updatedAt ? new Date(product.updatedAt).toISOString() : '',
  }));

  const csv = [
    STORE_PRODUCT_CSV_COLUMNS.join(','),
    ...rowObjects.map((row) => STORE_PRODUCT_CSV_COLUMNS.map((column) => escapeCsvValue(row[column] ?? '')).join(','))
  ].join('\n');

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

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
  exportCsv: (params = {}) => ecomApi.get('/store-products/export/csv', { params, responseType: 'blob' }),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return ecomApi.post('/store-products/import/csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  exportProductCsv: async (id) => {
    try {
      return await ecomApi.get(`/store-products/${id}/export/csv`, { responseType: 'blob' });
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      const productResponse = await ecomApi.get(`/store-products/${id}`);
      const product = productResponse.data?.data;
      if (!product) throw error;
      return { data: buildStoreProductCsvBlob(product) };
    }
  },
  importProductCsv: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return ecomApi.post(`/store-products/${id}/import/csv`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

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
