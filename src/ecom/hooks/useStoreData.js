/**
 * useStoreData — Loads public store config + products, injects CSS variables.
 *
 * Single source of truth for the public storefront.
 * Fetches store info + first page of products in parallel.
 * Injects --s-* CSS variables on <html> for instant theming.
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
  const r = document.documentElement.style;
  const primary = store.primaryColor || '#0F6B4F';
  const accent = store.accentColor || '#059669';
  const bg = store.backgroundColor || '#FFFFFF';
  const text = store.textColor || '#111827';
  const fontFamily = FONT_FAMILIES[store.font] || FONT_FAMILIES.inter;

  r.setProperty('--s-primary', primary);
  r.setProperty('--s-accent', accent);
  r.setProperty('--s-bg', bg);
  r.setProperty('--s-text', text);
  r.setProperty('--s-text2', '#6B7280');
  r.setProperty('--s-font', fontFamily);
  r.setProperty('--s-border', '#E5E7EB');

  loadGoogleFont(store.font || 'inter');

  // Dark header text or light depending on bg luminance
  document.documentElement.style.backgroundColor = bg;
}

export function useStoreData(subdomain) {
  const [store, setStore] = useState(null);
  const [sections, setSections] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [storeRes, productsRes] = await Promise.all([
          publicStoreApi.getStore(subdomain),
          publicStoreApi.getProducts(subdomain, { limit: 50 }),
        ]);

        if (cancelled) return;

        const responseData = storeRes.data?.data || {};
        // Handle both API structures: { store: {...}, sections: [...] } or flat { name, ... }
        const storeData = responseData.store || responseData;
        const sectionsData = responseData.sections ?? null;
        const productsData = productsRes.data?.data?.products || [];

        injectStoreCssVars(storeData);
        setStore(storeData);
        setSections(sectionsData);
        setProducts(productsData);
      } catch (err) {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Boutique introuvable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [subdomain]);

  return { store, sections, products, loading, error };
}

export function useStoreProduct(subdomain, slug) {
  const [product, setProduct] = useState(null);
  const [store, setStore] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain || !slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [storeRes, productRes] = await Promise.all([
          publicStoreApi.getStore(subdomain),
          publicStoreApi.getProduct(subdomain, slug),
        ]);

        if (cancelled) return;

        const responseData = storeRes.data?.data || {};
        const storeData = responseData.store || responseData; // Gérer les deux structures API
        const productData = productRes.data?.data || null;

        console.log('[StoreProduct] Store data reçu:', storeData);
        console.log('[StoreProduct] Couleurs:', {
          primaryColor: storeData.primaryColor,
          accentColor: storeData.accentColor,
          backgroundColor: storeData.backgroundColor,
          textColor: storeData.textColor
        });

        injectStoreCssVars(storeData);
        setStore(storeData);
        setProduct(productData);

        // Load related products (same category, exclude current)
        if (productData?.category) {
          try {
            const relRes = await publicStoreApi.getProducts(subdomain, {
              category: productData.category,
              limit: 4,
            });
            if (!cancelled) {
              const all = relRes.data?.data?.products || [];
              setRelated(all.filter(p => p._id !== productData._id).slice(0, 4));
            }
          } catch (_) {}
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

  return { store, product, related, loading, error };
}
