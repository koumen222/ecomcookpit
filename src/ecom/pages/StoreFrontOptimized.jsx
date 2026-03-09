/**
 * StoreFrontOptimized.jsx - Page d'accueil Store avec navigation instantanée
 * 
 * Optimisations:
 * - Chargement depuis le cache si disponible
 * - Préchargement des produits au hover
 * - Pas de loader visible pendant le chargement
 * - Pagination optimisée
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { injectStoreCssVars } from '../hooks/useStoreData.js';
import { useStoreCart } from '../hooks/useStoreCart.js';
import { 
  StoreProductCard, 
  useStorePrefetch,
  useStoreCache,
  getCachedStore,
  setCachedStore
} from '../components/StorePrefetch.jsx';

// Composant header minimaliste
const StoreHeader = ({ store, cartCount, storePrefix }) => {
  const navigate = useNavigate();
  
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      backgroundColor: 'var(--s-bg, #fff)',
      borderBottom: '1px solid var(--s-border, #e5e7eb)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 16px',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo / Nom */}
        <button 
          onClick={() => navigate(`${storePrefix}/`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0,
          }}
        >
          {store?.logo ? (
            <img 
              src={store.logo} 
              alt={store?.name} 
              style={{ height: 32, width: 'auto', objectFit: 'contain' }} 
            />
          ) : (
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              backgroundColor: 'var(--s-primary, #10b981)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14,
            }}>
              {(store?.name || 'S')[0].toUpperCase()}
            </span>
          )}
          <span style={{ 
            fontWeight: 600, fontSize: 16, 
            color: 'var(--s-text, #1f2937)',
            display: 'none',
          }} className="sm-block">
            {store?.name}
          </span>
        </button>

        {/* Panier */}
        <button
          onClick={() => navigate(`${storePrefix}/checkout`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 20,
            border: '1.5px solid',
            borderColor: cartCount > 0 ? 'var(--s-primary, #10b981)' : 'var(--s-border, #e5e7eb)',
            backgroundColor: cartCount > 0 ? 'var(--s-primary, #10b981)' : 'transparent',
            color: cartCount > 0 ? '#fff' : 'var(--s-text, #1f2937)',
            fontWeight: 500, fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <ShoppingCart size={16} />
          {cartCount > 0 && <span>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
};

// Grille de produits optimisée
const ProductGrid = ({ products, storePrefix, subdomain, onPrefetch }) => {
  if (!products?.length) {
    return (
      <div style={{ 
        textAlign: 'center', padding: '60px 20px',
        color: 'var(--s-text-secondary, #6b7280)'
      }}>
        Aucun produit disponible
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
    }} className="store-grid">
      {products.map((product) => (
        <StoreProductCard
          key={product._id || product.slug}
          product={product}
          storePrefix={storePrefix}
          onPrefetch={onPrefetch}
        />
      ))}
    </div>
  );
};

/**
 * StoreFront Optimisée
 */
const StoreFrontOptimized = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: hostSubdomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();

  // Utiliser le cache
  const { store: cachedStoreData, isLoading: cacheLoading } = useStoreCache(subdomain);
  const { prefetchProduct, prefetchStore } = useStorePrefetch(subdomain);
  const { itemCount: cartCount } = useStoreCart();

  // États
  const [store, setStore] = useState(cachedStoreData?.store);
  const [products, setProducts] = useState(cachedStoreData?.products || []);
  const [categories, setCategories] = useState(cachedStoreData?.categories || []);
  const [isLoading, setIsLoading] = useState(!cachedStoreData);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [error, setError] = useState('');

  // Build store URLs
  const storePrefix = subdomain ? `https://${subdomain}.scalor.net` : '';

  // Charger les données initiales (depuis cache ou API)
  useEffect(() => {
    if (!subdomain) return;

    // Si données en cache, les utiliser immédiatement
    const cached = getCachedStore(subdomain);
    if (cached?.data) {
      const { store: storeData, products: prods, categories: cats, pagination: pag } = cached.data;
      setStore(storeData);
      setProducts(prods || []);
      setCategories(cats || []);
      setPagination(pag || { page: 1, limit: 20, total: 0, pages: 0 });
      
      // Injecter les couleurs
      if (storeData) {
        injectStoreCssVars(storeData);
      }
      
      // Rafraîchir silencieusement en arrière-plan
      refreshData(false);
      return;
    }

    // Sinon charger depuis l'API
    loadData();
  }, [subdomain]);

  const loadData = async (showLoadingState = true) => {
    if (!subdomain) {
      console.log('[StoreFront] No subdomain provided');
      return;
    }
    
    if (showLoadingState) setIsLoading(true);
    setError('');

    try {
      console.log('[StoreFront] Loading store for subdomain:', subdomain);
      const res = await publicStoreApi.getStore(subdomain);
      console.log('[StoreFront] API response:', res);
      
      // Handle both response formats: res.data.data or res.data
      const responseData = res.data?.data || res.data;
      console.log('[StoreFront] Extracted data:', responseData);
      
      if (responseData) {
        setStore(responseData.store);
        setProducts(responseData.products || []);
        setCategories(responseData.categories || []);
        setPagination(responseData.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        
        // Mettre en cache
        setCachedStore(subdomain, responseData);
        
        // Injecter le thème
        if (responseData.store) {
          injectStoreCssVars(responseData.store);
        }
      } else {
        console.error('[StoreFront] No data in response');
        setError('Aucune donnée reçue de l\'API');
      }
    } catch (err) {
      console.error('[StoreFront] Store loading error:', err);
      if (showLoadingState) {
        setError('Boutique introuvable: ' + (err.message || 'Erreur inconnue'));
      }
    } finally {
      if (showLoadingState) {
        setIsLoading(false);
      }
    }
  };

  const refreshData = async (showLoading = false) => {
    await loadData(showLoading);
  };

  // Recherche debounced
  useEffect(() => {
    if (!store || (!search && !selectedCategory)) return;
    
    const timer = setTimeout(() => {
      fetchProducts(1, selectedCategory, search);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search, selectedCategory, store]);

  const fetchProducts = async (page = 1, cat = selectedCategory, searchTerm = search) => {
    if (!subdomain) return;

    try {
      const params = { page, limit: 20 };
      if (cat) params.category = cat;
      if (searchTerm) params.search = searchTerm;
      
      const res = await publicStoreApi.getProducts(subdomain, params);
      const data = res.data?.data;
      
      setProducts(data?.products || []);
      setPagination(data?.pagination || { page, limit: 20, total: 0, pages: 0 });
    } catch {
      // Garder les anciens produits en cas d'erreur
    }
  };

  // Changement de page
  const handlePageChange = (newPage) => {
    fetchProducts(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Si erreur
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: 'system-ui'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#ef4444' }}>{error}</h1>
          <button 
            onClick={() => loadData()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'var(--s-primary, #10b981)',
              color: '#fff',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Si pas de données après chargement, afficher message
  if (!displayStore && !isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: 'system-ui'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#6b7280' }}>
            {subdomain ? 'Boutique non trouvée' : 'Sous-domaine manquant'}
          </h1>
          <p style={{ marginTop: 8, color: '#9ca3af' }}>
            {subdomain ? `Aucune donnée pour "${subdomain}"` : 'Veuillez spécifier un sous-domaine'}
          </p>
          <button 
            onClick={() => loadData()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'var(--s-primary, #10b981)',
              color: '#fff',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Afficher immédiatement si données en cache, même pendant le chargement
  if (!displayStore && isLoading) {
    // Écran de démarrage minimaliste (transparent)
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
      }}>
        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--s-bg-secondary, #f9fafb)',
      opacity: isLoading ? 0.9 : 1,
      transition: 'opacity 0.2s',
    }}>
      <StoreHeader store={displayStore} cartCount={cartCount} storePrefix={storePrefix} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
        {/* Barre de recherche et filtres */}
        <div style={{ 
          display: 'flex', gap: 12, marginBottom: 20,
          position: 'sticky', top: 60, zIndex: 40,
          backgroundColor: 'var(--s-bg-secondary, #f9fafb)',
          padding: '12px 0',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ 
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--s-text-secondary, #6b7280)'
            }} />
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 40px',
                borderRadius: 10,
                border: '1px solid var(--s-border, #e5e7eb)',
                backgroundColor: 'var(--s-bg, #fff)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>
          
          {categories?.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--s-border, #e5e7eb)',
                backgroundColor: 'var(--s-bg, #fff)',
                fontSize: 14,
              }}
            >
              <option value="">Toutes les catégories</option>
              {categories.map(cat => (
                <option key={cat._id || cat} value={cat._id || cat}>
                  {cat.name || cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Grille de produits */}
        <ProductGrid 
          products={displayProducts}
          storePrefix={storePrefix}
          subdomain={subdomain}
          onPrefetch={prefetchProduct}
        />

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{ 
            display: 'flex', justifyContent: 'center', gap: 8,
            marginTop: 32, padding: '20px 0'
          }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--s-border, #e5e7eb)',
                backgroundColor: 'var(--s-bg, #fff)',
                opacity: pagination.page <= 1 ? 0.5 : 1,
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            
            <span style={{ 
              display: 'flex', alignItems: 'center',
              padding: '0 16px',
              fontSize: 14, fontWeight: 500,
              color: 'var(--s-text, #1f2937)'
            }}>
              Page {pagination.page} sur {pagination.pages}
            </span>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--s-border, #e5e7eb)',
                backgroundColor: 'var(--s-bg, #fff)',
                opacity: pagination.page >= pagination.pages ? 0.5 : 1,
                cursor: pagination.page >= pagination.pages ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default StoreFrontOptimized;
