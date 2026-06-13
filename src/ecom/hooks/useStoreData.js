/**
 * useStoreData — Store data, always fresh from API.
 *
 * Stratégie :
 * - Premier paint instantané grâce à window.__SCALOR_INITIAL__ injecté en SSR
 *   par publicStorefront.js (pas un cache : une nouvelle valeur à chaque requête HTML).
 * - Refetch immédiat en arrière-plan pour avoir la donnée la plus fraîche.
 * - Socket store:updated → refetch dès qu'un admin sauve.
 * - AUCUN cache sessionStorage : on a eu trop de bugs "j'ai modifié, ça ne s'affiche pas".
 *   Mongo + index sur subdomain répond en quelques ms — la cohérence vaut le coût.
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
  // formButtonColor is form-only — never use it for page-level --s-primary
  const primaryColor = resolveThemeColor(d.ctaButtonColor, d.buttonColor, store.primaryColor, '#0F6B4F') || '#0F6B4F';
  const accentColor = primaryColor;
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

function scheduleIdle(callback, timeout = 2500) {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, Math.min(timeout, 1200));
  return () => window.clearTimeout(id);
}

// ─── Product page cache ───────────────────────────────────────────────────────
// Short-lived in-memory cache (15s) per product page key.
// - Eliminates duplicate API calls when the user navigates back within a session.
// - 15s is short enough that price/theme changes are always visible quickly.
// - The backend also sets Cache-Control: public, max-age=60, stale-while-revalidate=600
//   so CDN/browser layer handles repeat visitors at the network level.
// - On admin save, both server caches are explicitly invalidated.
const _productPageCache = new Map(); // key → { data, expiresAt }
const _PP_TTL = 5 * 60_000; // 5 min — aligné sur s-maxage serveur

function _ppGet(key) {
  const e = _productPageCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { _productPageCache.delete(key); return null; }
  return e.data;
}
function _ppSet(key, data) {
  _productPageCache.set(key, { data, expiresAt: Date.now() + _PP_TTL });
}
export function invalidateProductPageCache(subdomain, slug) {
  if (subdomain && slug) _productPageCache.delete(`${subdomain}:${slug}`);
  else _productPageCache.clear();
}

const productPrefetchRequests = new Map();

export async function prefetchStoreProduct(subdomain, slug) {
  const requestKey = `${subdomain}:${slug}`;
  if (productPrefetchRequests.has(requestKey)) {
    return productPrefetchRequests.get(requestKey);
  }

  const request = publicStoreApi.getProductPage(subdomain, slug)
    .then((res) => {
      const data = res.data?.data || null;
      if (data) _ppSet(`${subdomain}:${slug}`, data);
      return data?.product || null;
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
  // Bootstrap from server-injected data on first load (SSR, frais à chaque requête).
  const initial = consumeInitialData();
  const bootstrap = initial ? {
    store: initial.store,
    sections: initial.sections ?? null,
    products: initial.products || [],
    pixels: initial.store?.pixels || null,
    footer: initial.footer || null,
    legalPages: initial.legalPages || null,
  } : null;

  const normalizedBootstrapSections = normalizeHomepageSections(bootstrap?.sections ?? null);

  // Initial state : SSR data si dispo, sinon null + loading (skeleton).
  const [store, setStore] = useState(bootstrap?.store || null);
  const [sections, setSections] = useState(normalizedBootstrapSections ?? null);
  const [products, setProducts] = useState(bootstrap?.products || []);
  const [pixels, setPixels] = useState(bootstrap?.pixels || null);
  const [footer, setFooter] = useState(bootstrap?.footer || null);
  const [legalPages, setLegalPages] = useState(bootstrap?.legalPages || null);
  const [loading, setLoading] = useState(!bootstrap);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain) { setLoading(false); return; }

    // Inject CSS vars immediately from bootstrap (no FOUC)
    if (bootstrap?.store) injectStoreCssVars(bootstrap.store);

    let cancelled = false;
    let cancelIdleRefetch = null;

    async function load({ force = false } = {}) {
      try {
        if (!bootstrap) setLoading(true);
        // Toujours refetch depuis l'API pour avoir la donnée fraîche.
        // Si bootstrap est dispo, on est déjà en train d'afficher quelque chose
        // donc la latence ne se voit pas.
        const res = await publicStoreApi.getStore(subdomain, force ? { force: true } : {});
        if (cancelled) return;

        const data = res.data?.data || {};
        const storeData = data.store || data;
        const sectionsData = normalizeHomepageSections(data.sections ?? null);
        const productsData = data.products || [];
        const pixelsData = data.pixels || null;
        const footerData = data.footer || null;
        const legalPagesData = data.legalPages || null;

        injectStoreCssVars(storeData);
        setStore(storeData);
        setSections(sectionsData);
        setProducts(productsData);
        setPixels(pixelsData);
        setFooter(footerData);
        setLegalPages(legalPagesData);
      } catch (err) {
        if (cancelled) return;
        // Only show error if there's nothing to show from bootstrap
        if (!bootstrap) setError(err?.response?.data?.message || 'Boutique introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (bootstrap?.store) {
      setLoading(false);
      cancelIdleRefetch = scheduleIdle(() => load({ force: true }), 6000);
    } else {
      load();
    }

    return () => {
      cancelled = true;
      if (cancelIdleRefetch) cancelIdleRefetch();
    };
  }, [subdomain]);

  // Refetch silently when admin saves any change (socket store:updated)
  const refetchStore = useCallback(() => {
    if (!subdomain) return;
    publicStoreApi.getStore(subdomain, { force: true })
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
      })
      .catch(() => {});
  }, [subdomain]);

  useStoreUpdates(subdomain, refetchStore);

  return { store, sections, products, pixels, footer, legalPages, loading, error };
}

// ─── useStoreProduct ──────────────────────────────────────────────────────────
export function useStoreProduct(subdomain, slug) {
  // Bootstrap only from server-injected data (SSR first load) — no sessionStorage cache reads
  const initial = consumeInitialData();
  const bootstrapProduct = initial?.product?.slug === slug ? initial.product : null;
  const bootstrapStore = initial?.store || null;
  const bootstrapRelated = bootstrapProduct && Array.isArray(initial?.products)
    ? initial.products
      .filter((item) => item?.slug !== slug && (!bootstrapProduct.category || item?.category === bootstrapProduct.category))
      .slice(0, 4)
    : [];

  const [store, setStore] = useState(bootstrapStore);
  const [pixels, setPixels] = useState(initial?.store?.pixels ?? null);
  const [storeFooter, setStoreFooter] = useState(initial?.footer || null);
  const [product, setProduct] = useState(bootstrapProduct);
  const [related, setRelated] = useState(bootstrapRelated);
  const [loading, setLoading] = useState(!bootstrapProduct);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain || !slug) { setLoading(false); return; }

    // CSS vars from bootstrap store
    if (bootstrapStore) injectStoreCssVars(bootstrapStore);

    let cancelled = false;
    let cancelIdleRefetch = null;
    const hasBootstrap = Boolean(bootstrapProduct && bootstrapStore);

    setProduct(bootstrapProduct);
    setRelated(bootstrapRelated);
    setError(null);
    setLoading(!hasBootstrap);

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

    async function load({ force = false, useCache = true } = {}) {
      try {
        let productData, storeData, pixelsData, footerData;

        const cacheKey = `${subdomain}:${slug}`;
        const cached = useCache ? _ppGet(cacheKey) : null;
        if (cached) {
          // Instant render from cache — also kick off a background revalidation
          productData = cached.product;
          storeData = cached.store;
          pixelsData = cached.pixels;
          footerData = cached.footer;
          injectStoreCssVars(storeData);
          setStore(storeData);
          setPixels(pixelsData);
          setStoreFooter(footerData);
          setProduct(productData);
          if (!cancelled) setLoading(false);
          // Revalidation silencieuse SANS force — utilise le cache serveur (s-maxage=300s).
          // force: true bypassait Cloudflare et frappait MongoDB à chaque visite.
          scheduleIdle(() => {
            if (cancelled) return;
            publicStoreApi.getProductPage(subdomain, slug).then(pageRes => {
              if (cancelled) return;
              const d = pageRes?.data?.data || {};
              _ppSet(cacheKey, d);
              if (d.store) { injectStoreCssVars(d.store); setStore(d.store); }
              if (d.product) setProduct(d.product);
              if (d.pixels !== undefined) setPixels(d.pixels);
              if (d.footer !== undefined) setStoreFooter(d.footer);
            }).catch(() => {});
          }, 4000);
          return;
        }

        const pageRes = await fetchWithRetry(() => publicStoreApi.getProductPage(subdomain, slug, force ? { force: true } : {}));
        if (cancelled) return;
        const pageData = pageRes?.data?.data || {};
        _ppSet(cacheKey, pageData);
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
        if (productData?.category && bootstrapRelated.length === 0) {
          publicStoreApi.getProducts(subdomain, { category: productData.category, limit: 4 }, force ? { force: true } : {})
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

    if (hasBootstrap) {
      cancelIdleRefetch = scheduleIdle(() => load({ force: true, useCache: false }), 5000);
    } else {
      load();
    }

    return () => {
      cancelled = true;
      if (cancelIdleRefetch) cancelIdleRefetch();
    };
  }, [subdomain, slug]);

  // Refetch silently when admin saves any change
  const refetch = useCallback(() => {
    if (!subdomain || !slug) return;
    publicStoreApi.getProductPage(subdomain, slug, { force: true })
      .then(res => {
        const d = res?.data?.data || {};
        _ppSet(`${subdomain}:${slug}`, d);
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
