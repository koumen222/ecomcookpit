import { useState, useEffect } from 'react';
import axios from 'axios';

const resolvePublicStoreApiBase = () => {
  const explicitStoreApi = import.meta.env.VITE_STORE_API_URL;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  if (explicitStoreApi) return explicitStoreApi.replace(/\/+$/, '');
  if (backendUrl) return backendUrl.replace(/\/+$/, '');

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }

  return 'http://localhost:8080';
};

/**
 * Hook pour charger les données d'une boutique publique
 * Utilisé par le storefront public (koumen1.scalor.net)
 */
export const useStorefront = (subdomain) => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState(null);
  const [pixels, setPixels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!subdomain) {
      setLoading(false);
      return;
    }

    const loadStore = async () => {
      try {
        setLoading(true);
        setError(null);

        // Appel à l'API publique
        const apiUrl = resolvePublicStoreApiBase();
        console.log('[useStorefront] API base resolved:', apiUrl, '| subdomain:', subdomain);
        const res = await axios.get(`${apiUrl}/public/store/${subdomain}`);

        if (res.data?.success) {
          const d = res.data.data;
          setStore(d.store);
          setProducts(d.products || []);
          setCategories(d.categories || []);
          setSections(d.sections ?? null); // null = pas configuré, [] = page vierge builder
          setPixels(d.pixels || null);
        } else {
          setError('Boutique introuvable');
        }
      } catch (err) {
        console.error('Error loading storefront:', err);
        setError(err.response?.data?.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadStore();
  }, [subdomain]);

  return { store, products, categories, sections, pixels, loading, error };
};

/**
 * Hook pour détecter le sous-domaine actuel
 */
export const useSubdomain = () => {
  const [subdomain, setSubdomain] = useState(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Extraire le sous-domaine
    // koumen1.scalor.net → koumen1
    // localhost → null
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // En dev, on peut tester avec ?subdomain=koumen1
      const params = new URLSearchParams(window.location.search);
      setSubdomain(params.get('subdomain'));
    } else {
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        // koumen1.scalor.net → koumen1
        setSubdomain(parts[0]);
      }
    }
  }, []);

  return subdomain;
};
