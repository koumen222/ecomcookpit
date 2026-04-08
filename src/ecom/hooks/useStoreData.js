/**
 * useStoreData — Store data with stale-while-revalidate cache.
 *
 * Performance strategy:
 * - Single API call: /api/store/:subdomain returns store + sections + products in one response
 * - sessionStorage cache (5min TTL): instant render on navigation within session
 * - CSS vars injected immediately from cache → no FOUC on subsequent visits
 */
import { useState, useEffect } from 'react';
import { publicStoreApi } from '../services/storeApi';

const FONT_FAMILIES = {
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  satoshi: "'Satoshi', Inter, system-ui, sans-serif",
};

const FONT_GFONTS = {
  inter: 'Inter:wght@400;500;600;700;900',
  poppins: 'Poppins:wght@400;500;600;700;900',
  'dm-sans': 'DM+Sans:wght@400;500;600;700',
  montserrat: 'Montserrat:wght@400;500;600;700;900',
};

function loadGoogleFont(fontId) {
  const gfont = FONT_GFONTS[fontId];
  if (!gfont) return;
  const id = `gfont-${fontId}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
  document.head.appendChild(link);
}

export function injectStoreCssVars(store) {
  if (!store) return;
  const r = document.documentElement.style;
  // Design overrides from productPageConfig take priority
  const d = store.productPageConfig?.design;
  r.setProperty('--s-primary', d?.buttonColor || store.primaryColor || '#0F6B4F');
  r.setProperty('--s-accent', d?.buttonColor || store.accentColor || '#059669');
  r.setProperty('--s-bg', d?.backgroundColor || store.backgroundColor || '#FFFFFF');
  r.setProperty('--s-text', d?.textColor || store.textColor || '#111827');
  r.setProperty('--s-text2', '#6B7280');
  r.setProperty('--s-font', FONT_FAMILIES[store.font] || FONT_FAMILIES.inter);
  r.setProperty('--s-border', '#E5E7EB');
  document.documentElement.style.backgroundColor = d?.backgroundColor || store.backgroundColor || '#FFFFFF';
  loadGoogleFont(store.font || 'inter');
}

// ─── sessionStorage cache ─────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { d, t } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL) { sessionStorage.removeItem(key); return null; }
    return d;
  } catch { return null; }
}

function writeCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ d: data, t: Date.now() })); } catch {}
}

const productPrefetchRequests = new Map();

function getProductCacheKey(subdomain, slug) {
  if (!subdomain || !slug) return null;
  return `sfp_${subdomain}_${slug}`;
}

function toProductPreview(product) {
  if (!product) return null;

  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    stock: product.stock,
    images: product.images?.length
      ? product.images
      : (product.image ? [{ url: product.image, alt: product.name }] : []),
    category: product.category,
    tags: product.tags || [],
    seoTitle: product.seoTitle || '',
    seoDescription: product.seoDescription || '',
    features: product.features || [],
    faq: product.faq || []
  };
}

export async function prefetchStoreProduct(subdomain, slug) {
  const cacheKey = getProductCacheKey(subdomain, slug);
  if (!cacheKey) return null;

  const cachedProduct = readCache(cacheKey);
  if (cachedProduct) return cachedProduct;

  const requestKey = `${subdomain}:${slug}`;
  if (productPrefetchRequests.has(requestKey)) {
    return productPrefetchRequests.get(requestKey);
  }

  const request = publicStoreApi.getProduct(subdomain, slug)
    .then((res) => {
      const productData = res.data?.data || null;
      if (productData) {
        writeCache(cacheKey, productData);
      }
      return productData;
    })
    .catch(() => null)
    .finally(() => {
      productPrefetchRequests.delete(requestKey);
    });

  productPrefetchRequests.set(requestKey, request);
  return request;
}

// ─── useStoreData ─────────────────────────────────────────────────────────────
export function useStoreData(subdomain) {
  const cacheKey = subdomain ? `sf_${subdomain}` : null;
  const cached = cacheKey ? readCache(cacheKey) : null;

  // Initialise with cached data → instant render, no loading flash
  const [store, setStore] = useState(cached?.store || null);
  const [sections, setSections] = useState(cached?.sections ?? null);
  const [products, setProducts] = useState(cached?.products || []);
  const [pixels, setPixels] = useState(cached?.pixels || null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain) { setLoading(false); return; }

    // Inject CSS vars immediately from cache (no FOUC)
    if (cached?.store) injectStoreCssVars(cached.store);

    let cancelled = false;

    async function load() {
      try {
        // Single request — returns store + sections + products + categories in one shot
        const res = await publicStoreApi.getStore(subdomain);
        if (cancelled) return;

        const data = res.data?.data || {};
        const storeData = data.store || data;
        const sectionsData = data.sections ?? null;
        // products come from the combined endpoint — no second getProducts call needed
        const productsData = data.products || [];

        const pixelsData = data.pixels || null;
        if (cacheKey) writeCache(cacheKey, { store: storeData, sections: sectionsData, products: productsData, pixels: pixelsData });

        injectStoreCssVars(storeData);
        setStore(storeData);
        setSections(sectionsData);
        setProducts(productsData);
        setPixels(pixelsData);
      } catch (err) {
        if (cancelled) return;
        // Only show error if there's nothing to show from cache
        if (!cached) setError(err?.response?.data?.message || 'Boutique introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subdomain]);

  return { store, sections, products, pixels, loading, error };
}

// ─── useStoreProduct ──────────────────────────────────────────────────────────
export function useStoreProduct(subdomain, slug) {
  const storeCacheKey = subdomain ? `sf_${subdomain}` : null;
  const cachedStore = storeCacheKey ? readCache(storeCacheKey) : null;
  const productCacheKey = getProductCacheKey(subdomain, slug);
  const cachedProduct = productCacheKey ? readCache(productCacheKey) : null;
  const previewProduct = cachedProduct || toProductPreview(cachedStore?.products?.find((item) => item.slug === slug));

  const [store, setStore] = useState(cachedStore?.store || null);
  const [pixels, setPixels] = useState(cachedStore?.pixels || null);
  const [product, setProduct] = useState(previewProduct);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(!previewProduct);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain || !slug) { setLoading(false); return; }

    // CSS vars from cached store → no FOUC on product page
    if (cachedStore?.store) injectStoreCssVars(cachedStore.store);

    let cancelled = false;

    setProduct(previewProduct);
    setRelated([]);
    setError(null);
    setLoading(!previewProduct);

    async function load() {
      try {
        // Always fetch both product AND store to get latest config (productPageConfig, theme, etc.)
        const [productRes, storeRes] = await Promise.all([
          publicStoreApi.getProduct(subdomain, slug),
          publicStoreApi.getStore(subdomain),
        ]);

        if (cancelled) return;

        const productData = productRes.data?.data || null;
        if (productCacheKey && productData) {
          writeCache(productCacheKey, productData);
        }

        let storeData = cachedStore?.store;
        let pixelsData = cachedStore?.pixels || null;
        if (storeRes) {
          const data = storeRes.data?.data || {};
          storeData = data.store || data;
          pixelsData = data.pixels || null;
          // Cache store data for future navigations
          if (storeCacheKey) writeCache(storeCacheKey, {
            store: storeData,
            sections: data.sections ?? null,
            products: data.products || [],
            pixels: pixelsData,
          });
        }

        injectStoreCssVars(storeData);
        setStore(storeData);
        setPixels(pixelsData);
        setProduct(productData);

        // Related products — non-blocking, doesn't delay paint
        if (productData?.category) {
          publicStoreApi.getProducts(subdomain, { category: productData.category, limit: 4 })
            .then(r => {
              if (!cancelled) {
                const all = r.data?.data?.products || [];
                setRelated(all.filter(p => p._id !== productData._id).slice(0, 4));
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Produit introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subdomain, slug]);

  return { store, pixels, product, related, loading, error };
}
