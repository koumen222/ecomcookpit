import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Hook pour charger les données d'une boutique publique
 * Utilisé par le storefront public (koumen1.scalor.net)
 */
export const useStorefront = (subdomain) => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
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
        const apiUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        const res = await axios.get(`${apiUrl}/api/store/${subdomain}`);

        if (res.data?.success) {
          setStore(res.data.data.store);
          setProducts(res.data.data.products || []);
          setCategories(res.data.data.categories || []);
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

  return { store, products, categories, loading, error };
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
