/**
 * useStoreData — Store data with stale-while-revalidate cache.
 *
 * Performance strategy:
 * - Single API call: /api/store/:subdomain returns store + sections + products in one response
 * - sessionStorage cache (5min TTL): instant render on navigation within session
 * - CSS vars injected immediately from cache → no FOUC on subsequent visits
 */
import { useState, useEffect, useCallback } from 'react';
import { publicStoreApi } from '../services/storeApi';
import { normalizeHomepageSections } from '../utils/homepageSections';
import { useStoreUpdates } from './useThemeSocket';

const FONT_FAMILIES = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  inter: "'Inter', system-ui, sans-serif",
  poppins: "'Poppins', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  satoshi: "'Satoshi', Inter, system-ui, sans-serif",
  nunito: "'Nunito', sans-serif",
  roboto: "'Roboto', sans-serif",
  playfair: "'Playfair Display', serif",
  lora: "'Lora', serif",
  outfit: "'Outfit', sans-serif",
  'space-grotesk': "'Space Grotesk', sans-serif",
  raleway: "'Raleway', sans-serif",
  oswald: "'Oswald', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  geist: "'Geist', sans-serif",
  'plus-jakarta': "'Plus Jakarta Sans', sans-serif",
  urbanist: "'Urbanist', sans-serif",
  syne: "'Syne', sans-serif",
  josefin: "'Josefin Sans', sans-serif",
  merriweather: "'Merriweather', serif",
  cormorant: "'Cormorant Garamond', serif",
  bebas: "'Bebas Neue', cursive",
  archivo: "'Archivo', sans-serif",
};

const FONT_GFONTS = {
  inter: 'Inter:wght@400;500;600;700;900',
  poppins: 'Poppins:wght@400;500;600;700;900',
  'dm-sans': 'DM+Sans:wght@400;500;600;700',
  montserrat: 'Montserrat:wght@400;500;600;700;900',
  nunito: 'Nunito:wght@400;500;600;700;900',
  roboto: 'Roboto:wght@400;500;700;900',
  playfair: 'Playfair+Display:wght@400;600;700;900',
  lora: 'Lora:wght@400;500;600;700',
  outfit: 'Outfit:wght@400;500;600;700;800',
  'space-grotesk': 'Space+Grotesk:wght@400;500;600;700',
  raleway: 'Raleway:wght@400;500;600;700;800;900',
  oswald: 'Oswald:wght@400;500;600;700',
  'open-sans': 'Open+Sans:wght@400;500;600;700;800',
  geist: 'Geist:wght@400;500;600;700;800;900',
  'plus-jakarta': 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
  urbanist: 'Urbanist:wght@400;500;600;700;800;900',
  syne: 'Syne:wght@400;500;600;700;800',
  josefin: 'Josefin+Sans:wght@400;500;600;700',
  merriweather: 'Merriweather:wght@400;700;900',
  cormorant: 'Cormorant+Garamond:wght@400;500;600;700',
  bebas: 'Bebas+Neue:wght@400',
  archivo: 'Archivo:wght@400;500;600;700;800;900',
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

export function applyFont(fontId) {
  if (!fontId) return;
  const family = FONT_FAMILIES[fontId];
  if (family) document.documentElement.style.setProperty('--s-font', family);
  loadGoogleFont(fontId);
}

function withAlpha(color, alphaHex, fallback) {
  if (typeof color === 'string' && color.startsWith('#')) return `${color}${alphaHex}`;
  return fallback;
}

const isTransparentThemeColor = (value) => {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, '');
  return !normalized
    || normalized === 'transparent'
    || normalized === 'none'
    || normalized === 'inherit'
    || normalized === 'initial'
    || normalized === 'unset'
    || normalized === '#0000'
    || normalized === '#00000000'
    || /^rgba\([^)]*,0(?:\.0+)?\)$/.test(normalized)
    || /^hsla\([^)]*,0(?:\.0+)?\)$/.test(normalized);
};

const resolveThemeColor = (...values) => values.find((value) => !isTransparentThemeColor(value)) || null;

export function injectStoreCssVars(store) {
  if (!store) return;
  const r = document.documentElement.style;
  // Design overrides from productPageConfig take priority
  const d = store.productPageConfig?.design || {};
  // formButtonColor is scoped to the order form only — never use it for global CSS vars
  const primaryColor = resolveThemeColor(d.buttonColor, store.primaryColor, '#0F6B4F') || '#0F6B4F';
  const accentColor = resolveThemeColor(d.ctaButtonColor, d.buttonColor, store.accentColor, primaryColor, '#059669') || '#059669';
  const sectionColors = {
    socialProof: store.sectionColors?.socialProof || store.accentColor || store.primaryColor || '#7C3AED',
    benefits: store.sectionColors?.benefits || store.primaryColor || '#0F6B4F',
    trust: store.sectionColors?.trust || store.accentColor || store.primaryColor || '#2563EB',
    problem: store.sectionColors?.problem || store.errorColor || d.badgeColor || '#DC2626',
    solution: store.sectionColors?.solution || d.buttonColor || store.primaryColor || '#059669',
    faq: store.sectionColors?.faq || store.accentColor || store.primaryColor || '#7C3AED',
  };
  r.setProperty('--s-primary', primaryColor);
  r.setProperty('--s-accent', accentColor);
  r.setProperty('--s-bg', d.backgroundColor || store.backgroundColor || '#FFFFFF');
  r.setProperty('--s-text', d.textColor || store.textColor || '#111827');
  r.setProperty('--s-text2', '#6B7280');
  const fontId = d.fontFamily || store.font || 'inter';
  r.setProperty('--s-font', FONT_FAMILIES[fontId] || FONT_FAMILIES.inter);
  r.setProperty('--s-border', '#E5E7EB');
  // Extended design tokens
  r.setProperty('--s-badge', d.badgeColor || '#EF4444');
  r.setProperty('--s-radius', d.borderRadius || '12px');
  r.setProperty('--s-btn-style', d.buttonStyle || 'filled');
  r.setProperty('--s-badge-style', d.badgeStyle || 'filled');
  r.setProperty('--s-font-base', (d.fontBase || 14) + 'px');
  r.setProperty('--s-font-weight', d.fontWeight || '600');
  r.setProperty('--s-shadow', d.shadow !== false ? '0 2px 8px rgba(0,0,0,0.08)' : 'none');
  Object.entries(sectionColors).forEach(([key, color]) => {
    r.setProperty(`--s-section-${key}`, color);
    r.setProperty(`--s-section-${key}-soft`, withAlpha(color, '12', 'rgba(15,107,79,0.08)'));
    r.setProperty(`--s-section-${key}-border`, withAlpha(color, '33', 'rgba(15,107,79,0.18)'));
    r.setProperty(`--s-section-${key}-shadow`, `0 12px 30px ${withAlpha(color, '1F', 'rgba(15,107,79,0.12)')}`);
  });
  document.documentElement.style.backgroundColor = d.backgroundColor || store.backgroundColor || '#FFFFFF';
  loadGoogleFont(fontId);
}

// ─── Server-injected initial data (SSR-style) ────────────────────────────────
// The backend injects window.__SCALOR_INITIAL__ with store + product data so
// React can render instantly without a network round-trip on the first load.
function consumeInitialData() {
  if (typeof window === 'undefined' || !window.__SCALOR_INITIAL__) return null;
  const data = window.__SCALOR_INITIAL__;
  // Consume once — subsequent navigations go through the normal fetch path
  window.__SCALOR_INITIAL__ = null;
  return data;
}

// ─── sessionStorage cache ─────────────────────────────────────────────────────
const CACHE_TTL = 2 * 60 * 1000; // 2 min — short enough that admin changes show quickly

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

// If server returns a newer configVersion than what we cached, discard the cache
function isCacheStale(cachedStore, freshStore) {
  if (!cachedStore || !freshStore) return false;
  const cachedV = cachedStore.configVersion;
  const freshV = freshStore.configVersion;
  if (!cachedV || !freshV) return false;
  return freshV > cachedV;
}

const productPrefetchRequests = new Map();

function getProductCacheKey(subdomain, slug) {
  if (!subdomain || !slug) return null;
  return `sfp_${subdomain}_${slug}`;
}

function toProductPreview(product, fallbackCurrency) {
  if (!product) return null;

  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description || '',
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency || fallbackCurrency || 'XAF',
    targetMarket: product.targetMarket || '',
    country: product.country || '',
    city: product.city || '',
    locale: product.locale || '',
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
  const requestKey = `${subdomain}:${slug}`;
  if (productPrefetchRequests.has(requestKey)) {
    return productPrefetchRequests.get(requestKey);
  }

  const request = publicStoreApi.getProduct(subdomain, slug)
    .then((res) => res.data?.data || null)
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

  // Bootstrap from server-injected data on first load (SSR-style, zero API call)
  const initial = !cached ? consumeInitialData() : null;
  const bootstrap = cached || (initial ? {
    store: initial.store,
    sections: initial.sections ?? null,
    products: initial.products || [],
    pixels: initial.store?.pixels || null,
    footer: initial.footer || null,
    legalPages: initial.legalPages || null,
  } : null);

  // Write bootstrap into sessionStorage so navigating away and back is also instant
  if (initial && cacheKey) writeCache(cacheKey, bootstrap);

  const normalizedCachedSections = normalizeHomepageSections(bootstrap?.sections ?? null);

  // Initialise with cached/bootstrap data → instant render, no loading flash
  const [store, setStore] = useState(bootstrap?.store || null);
  const [sections, setSections] = useState(normalizedCachedSections ?? null);
  const [products, setProducts] = useState(bootstrap?.products || []);
  const [pixels, setPixels] = useState(bootstrap?.pixels || null);
  const [footer, setFooter] = useState(bootstrap?.footer || null);
  const [legalPages, setLegalPages] = useState(bootstrap?.legalPages || null);
  const [loading, setLoading] = useState(!bootstrap);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain) { setLoading(false); return; }

    // Inject CSS vars immediately from cache (no FOUC)
    if (bootstrap?.store) injectStoreCssVars(bootstrap.store);

    let cancelled = false;

    async function load() {
      try {
        // Single request — returns store + sections + products + categories in one shot
        const res = await publicStoreApi.getStore(subdomain);
        if (cancelled) return;

        const data = res.data?.data || {};
        const storeData = data.store || data;
        const sectionsData = normalizeHomepageSections(data.sections ?? null);
        // products come from the combined endpoint — no second getProducts call needed
        const productsData = data.products || [];

        const pixelsData = data.pixels || null;
        const footerData = data.footer || null;
        const legalPagesData = data.legalPages || null;

        // If configVersion changed (admin saved changes), purge all product caches for this store
        if (cacheKey && isCacheStale(bootstrap?.store, storeData)) {
          try {
            const prefix = `sfp_${subdomain}_`;
            const toRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
              const k = sessionStorage.key(i);
              if (k && k.startsWith(prefix)) toRemove.push(k);
            }
            toRemove.forEach(k => sessionStorage.removeItem(k));
          } catch {}
        }

        if (cacheKey) writeCache(cacheKey, { store: storeData, sections: sectionsData, products: productsData, pixels: pixelsData, footer: footerData, legalPages: legalPagesData });

        injectStoreCssVars(storeData);
        setStore(storeData);
        setSections(sectionsData);
        setProducts(productsData);
        setPixels(pixelsData);
        setFooter(footerData);
        setLegalPages(legalPagesData);
      } catch (err) {
        if (cancelled) return;
        // Only show error if there's nothing to show from cache/bootstrap
        if (!bootstrap) setError(err?.response?.data?.message || 'Boutique introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subdomain]);

  // Refetch silently when admin saves any change
  const refetchStore = useCallback(() => {
    if (!subdomain) return;
    publicStoreApi.getStore(subdomain)
      .then(res => {
        const data = res.data?.data || {};
        const storeData = data.store || data;
        const sectionsData = normalizeHomepageSections(data.sections ?? null);
        const productsData = data.products || [];
        injectStoreCssVars(storeData);
        setStore(storeData);
        setSections(sectionsData);
        setProducts(productsData);
        if (data.pixels !== undefined) setPixels(data.pixels);
        if (data.footer !== undefined) setFooter(data.footer);
        if (data.legalPages !== undefined) setLegalPages(data.legalPages);
        if (cacheKey) writeCache(cacheKey, { store: storeData, sections: sectionsData, products: productsData, pixels: data.pixels || null, footer: data.footer || null, legalPages: data.legalPages || null });
      })
      .catch(() => {});
  }, [subdomain]);

  useStoreUpdates(subdomain, refetchStore);

  return { store, sections, products, pixels, footer, legalPages, loading, error };
}

// ─── useStoreProduct ──────────────────────────────────────────────────────────
export function useStoreProduct(subdomain, slug) {
  const storeCacheKey = subdomain ? `sf_${subdomain}` : null;
  const productCacheKey = getProductCacheKey(subdomain, slug);

  // Bootstrap only from server-injected data (SSR first load) — no sessionStorage cache reads
  const initial = consumeInitialData();
  const bootstrapProduct = initial?.product?.slug === slug ? initial.product : null;
  const bootstrapStore = initial?.store || null;

  if (initial?.store && storeCacheKey) {
    writeCache(storeCacheKey, {
      store: initial.store,
      sections: initial.sections ?? null,
      products: initial.products || [],
      pixels: initial.store?.pixels || null,
      footer: initial.footer || null,
      legalPages: initial.legalPages || null,
    });
  }

  const [store, setStore] = useState(bootstrapStore);
  const [pixels, setPixels] = useState(initial?.store?.pixels ?? null);
  const [storeFooter, setStoreFooter] = useState(initial?.footer || null);
  const [product, setProduct] = useState(bootstrapProduct);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain || !slug) { setLoading(false); return; }

    // CSS vars from bootstrap store
    if (bootstrapStore) injectStoreCssVars(bootstrapStore);

    let cancelled = false;

    setProduct(bootstrapProduct);
    setRelated([]);
    setError(null);
    setLoading(true);

    async function fetchWithRetry(fn, retries = 2, delayMs = 800) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          const isLast = attempt === retries;
          const status = err?.response?.status;
          // Don't retry 404 — product genuinely not found
          if (isLast || status === 404) throw err;
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        }
      }
    }

    async function load() {
      try {
        let productData, storeData, pixelsData, footerData;

        // Always fetch fresh — no cache reads
        const pageRes = await fetchWithRetry(() => publicStoreApi.getProductPage(subdomain, slug));
        if (cancelled) return;
        const pageData = pageRes?.data?.data || {};
        productData = pageData.product || null;
        storeData = pageData.store || null;
        pixelsData = pageData.pixels || null;
        footerData = pageData.footer || null;

        injectStoreCssVars(storeData);
        setStore(storeData);
        setPixels(pixelsData);
        setStoreFooter(footerData);
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
        const status = err?.response?.status;
        // Only show the error page for genuine 404s — for network/server errors,
        // keep showing whatever we have (cache preview) rather than a blank error screen
        if (status === 404) {
          setError(err?.response?.data?.message || 'Produit introuvable');
        }
        // else: stay silent — skeleton stays up, user can retry by scrolling/waiting
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subdomain, slug]);

  // Refetch silently when admin saves any change
  const refetch = useCallback(() => {
    if (!subdomain || !slug) return;
    publicStoreApi.getProductPage(subdomain, slug)
      .then(res => {
        const d = res?.data?.data || {};
        if (d.product) setProduct(d.product);
        if (d.store) { injectStoreCssVars(d.store); setStore(d.store); }
        if (d.pixels !== undefined) setPixels(d.pixels);
        if (d.footer !== undefined) setStoreFooter(d.footer);
      })
      .catch(() => {});
  }, [subdomain, slug]);

  useStoreUpdates(subdomain, refetch);

  return { store, pixels, product, related, loading, error };
}
