import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ShoppingBag, ChevronLeft, ChevronRight, Phone, MessageCircle, Filter } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { injectStoreCssVars } from '../hooks/useStoreData.js';
import { injectPixelScripts, firePixelEvent } from '../utils/pixelTracking.js';
import { formatMoney } from '../utils/currency.js';

const RADIUS_MAP = {
  none: '0px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  full: '999px',
};

const SHADOW_MAP = {
  none: 'none',
  soft: '0 10px 28px rgba(15, 23, 42, 0.08)',
  medium: '0 16px 40px rgba(15, 23, 42, 0.12)',
  strong: '0 24px 56px rgba(15, 23, 42, 0.16)',
};

const resolveRadius = (value, fallback = '18px') => {
  if (typeof value === 'number') return `${value}px`;
  if (!value) return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (RADIUS_MAP[normalized]) return RADIUS_MAP[normalized];
  if (/^\d+$/.test(normalized)) return `${normalized}px`;

  return value;
};

const resolveShadow = (value) => SHADOW_MAP[String(value || 'soft').trim().toLowerCase()] || SHADOW_MAP.soft;

const buildButtonVars = (design = {}) => {
  const buttonStyle = String(design.buttonStyle || '').trim().toLowerCase();
  const solidBg = design.ctaButtonColor || design.buttonColor || 'var(--s-primary)';

  if (buttonStyle === 'outline') {
    return {
      '--sf-btn-bg': 'transparent',
      '--sf-btn-text': 'var(--s-primary)',
      '--sf-btn-border': 'var(--s-primary)',
    };
  }

  if (buttonStyle === 'soft') {
    return {
      '--sf-btn-bg': 'color-mix(in srgb, var(--s-primary) 12%, var(--s-bg))',
      '--sf-btn-text': 'var(--s-primary)',
      '--sf-btn-border': 'transparent',
    };
  }

  if (buttonStyle === 'gradient') {
    return {
      '--sf-btn-bg': 'linear-gradient(135deg, var(--s-primary) 0%, var(--s-accent) 100%)',
      '--sf-btn-text': '#ffffff',
      '--sf-btn-border': 'transparent',
    };
  }

  return {
    '--sf-btn-bg': solidBg,
    '--sf-btn-text': '#ffffff',
    '--sf-btn-border': 'transparent',
  };
};

/**
 * StoreFront — Public-facing product grid page.
 * Mobile-first, SEO-friendly, fast loading.
 * Loads only published products for the specific store (workspace).
 * Uses lazy loading for images to minimize bandwidth (African markets).
 * 
 * Subdomain detection:
 * - On koumen.scalor.net → useSubdomain() returns "koumen"
 * - On scalor.net/store/koumen → useParams() returns "koumen"
 */
const StoreFront = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: hostSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();

  // Build store URLs (always use full subdomain URLs)
  const storeUrl = (path = '/') => {
    if (!subdomain) return '#';
    return `https://${subdomain}.scalor.net${path}`;
  };

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Load store config + products + categories in a SINGLE call
  // The unified /api/store/:subdomain endpoint returns everything at once
  // This reduces 3 HTTP requests to 1 — critical for African market latency
  useEffect(() => {
    (async () => {
      // Set timeout for slow loading
      const timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000); // 8 seconds

      try {
        const res = await publicStoreApi.getStore(subdomain);
        const data = res.data?.data;
        const storeData = data?.store;
        setStore(storeData);
        setProducts(data?.products || []);
        setPagination(data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        setCategories(data?.categories || []);

        // Injecter les couleurs et le thème du store
        if (storeData) {
          injectStoreCssVars(storeData);
        }

        // Injecter les pixels de tracking et fire PageView
        if (data?.pixels) {
          injectPixelScripts(data.pixels);
          firePixelEvent('PageView');
        }
        
        clearTimeout(timeoutId);
      } catch (err) {
        clearTimeout(timeoutId);
        console.error('Store loading error:', err);
        setError('Boutique introuvable');
      } finally {
        setLoading(false);
        setLoadingTimeout(false);
      }
    })();
  }, [subdomain]);

  const fetchProducts = useCallback(async (page = 1, cat = selectedCategory, searchTerm = search) => {
    setLoadingProducts(true);
    try {
      const params = { page, limit: 20 };
      if (cat) params.category = cat;
      if (searchTerm) params.search = searchTerm;
      const res = await publicStoreApi.getProducts(subdomain, params);
      setProducts(res.data?.data?.products || []);
      setPagination(res.data?.data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch {
      // Silent fail — keep existing products
    } finally {
      setLoadingProducts(false);
    }
  }, [subdomain, selectedCategory, search]);

  // Debounced search
  useEffect(() => {
    if (!store) return;
    const timer = setTimeout(() => {
      fetchProducts(1, selectedCategory, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, store, fetchProducts]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
  };

  const formatPrice = (price, currency) => formatMoney(price, currency);

  const design = store?.productPageConfig?.design || {};
  const themeColor = store?.themeColor || '#0F6B4F';
  const shellVars = store ? {
    '--sf-radius': resolveRadius(design.borderRadius || store.borderRadius || 'lg'),
    '--sf-radius-sm': resolveRadius(design.borderRadius || store.borderRadius || 'lg', '14px'),
    '--sf-shadow': resolveShadow(design.shadow),
    '--sf-surface': 'color-mix(in srgb, var(--s-bg) 94%, white)',
    '--sf-soft-surface': 'color-mix(in srgb, var(--s-primary) 6%, var(--s-bg))',
    '--sf-soft-border': 'color-mix(in srgb, var(--s-primary) 18%, var(--s-border))',
    ...buildButtonVars(design),
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--s-bg, #ffffff)', color: 'var(--s-text, #111827)', fontFamily: 'var(--s-font-base, var(--s-font, Inter, sans-serif))', ...shellVars }}>
        {/* Logo/Icon animation */}
        <div className="mb-8 w-16 h-16 flex items-center justify-center" style={{ backgroundColor: 'var(--sf-soft-surface)', borderRadius: 'var(--sf-radius)' }}>
          <ShoppingBag className="w-7 h-7" style={{ color: 'var(--s-primary)' }} />
        </div>
        
        {/* Loading text */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--s-text)' }}>
            {loadingTimeout ? 'Prend plus de temps que prévu...' : 'Chargement de la boutique'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--s-text2)' }}>
            {loadingTimeout 
              ? 'Veuillez patienter, cela peut prendre quelques secondes...' 
              : 'Préparation de votre expérience d\'achat...'
            }
          </p>
        </div>
        
        {/* Animated dots */}
        <div className="mt-4 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-primary)' }}>
          Chargement initial…
        </div>
        
        {/* Subtle progress bar */}
        <div className="mt-6 text-xs" style={{ color: 'var(--s-text2)' }}>Préparation du catalogue…</div>
        
        {/* Retry button after timeout */}
        {loadingTimeout && (
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--s-text)' }}
          >
            Réessayer
          </button>
        )}
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--s-bg, #ffffff)', color: 'var(--s-text, #111827)', fontFamily: 'var(--s-font-base, var(--s-font, Inter, sans-serif))' }}>
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 mx-auto" style={{ color: 'var(--s-text2, #9ca3af)' }} />
          <h1 className="text-xl font-bold mt-4" style={{ color: 'var(--s-text, #111827)' }}>Boutique introuvable</h1>
          <p className="text-sm mt-2" style={{ color: 'var(--s-text2, #6b7280)' }}>Cette boutique n'existe pas ou n'est pas encore activée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--s-bg)', color: 'var(--s-text)', fontFamily: 'var(--s-font-base, var(--s-font, Inter, sans-serif))', ...shellVars }}>
      {/* Add custom styles for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
      
      {/* Store Header */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--sf-surface)', borderBottom: '1px solid var(--sf-soft-border)', backdropFilter: 'blur(14px)' }}>
        {/* Banner */}
        {store.banner && (
          <div className="h-32 sm:h-44 overflow-hidden">
            <img 
              src={store.banner} 
              alt={store.name} 
              className="w-full h-full object-cover" 
              loading="eager"
              width="1200"
              height="352"
              style={{
                contentVisibility: 'auto',
                containIntrinsicSize: '1200px 352px'
              }}
            />
            <link rel="preload" as="image" href={store.banner} />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {store.logo && (
              <img 
                src={store.logo} 
                alt={store.name} 
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" 
                width="40"
                height="40"
                loading="eager"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate" style={{ color: 'var(--s-text)' }}>{store.name}</h1>
              {store.description && (
                <p className="text-xs truncate" style={{ color: 'var(--s-text2)' }}>{store.description}</p>
              )}
            </div>
            {/* Contact buttons */}
            <div className="flex items-center gap-2">
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full text-white transition"
                  style={{ backgroundColor: '#25D366' }}
                  title="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              )}
              {store.phone && (
                <a
                  href={`tel:${store.phone}`}
                  className="p-2 rounded-full text-white transition"
                  style={{ background: 'var(--sf-btn-bg)', color: 'var(--sf-btn-text)', border: '1px solid var(--sf-btn-border)' }}
                  title="Appeler"
                >
                  <Phone className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search + Categories */}
      <div className="max-w-6xl mx-auto px-4 py-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--s-text2)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{
              '--tw-ring-color': 'var(--s-primary)',
              backgroundColor: 'var(--sf-surface)',
              color: 'var(--s-text)',
              border: '1px solid var(--sf-soft-border)',
              borderRadius: 'var(--sf-radius)',
              boxShadow: 'var(--sf-shadow)',
            }}
          />
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => handleCategoryChange('')}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition"
              style={selectedCategory === '' ? {
                background: 'var(--sf-btn-bg)',
                color: 'var(--sf-btn-text)',
                border: '1px solid var(--sf-btn-border)',
              } : {
                backgroundColor: 'var(--sf-surface)',
                color: 'var(--s-text2)',
                border: '1px solid var(--sf-soft-border)',
              }}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition"
                style={selectedCategory === cat ? {
                  background: 'var(--sf-btn-bg)',
                  color: 'var(--sf-btn-text)',
                  border: '1px solid var(--sf-btn-border)',
                } : {
                  backgroundColor: 'var(--sf-surface)',
                  color: 'var(--s-text2)',
                  border: '1px solid var(--sf-soft-border)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        {loadingProducts ? (
          <div className="space-y-4">
            {/* Loading skeleton cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="overflow-hidden" style={{ backgroundColor: 'var(--sf-surface)', borderRadius: 'var(--sf-radius)', border: '1px solid var(--sf-soft-border)' }}>
                  {/* Image skeleton */}
                  <div className="aspect-square shimmer" style={{ backgroundColor: 'var(--sf-soft-surface)' }}>
                    <div className="w-full h-full bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse"></div>
                  </div>
                  {/* Content skeleton */}
                  <div className="p-2.5 sm:p-3 space-y-2">
                    <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                    <div className="h-5 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
            {/* Loading text */}
            <div className="text-center py-4">
              <span className="text-sm" style={{ color: 'var(--s-text2)' }}>Chargement des produits...</span>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 mx-auto" style={{ color: 'var(--s-text2)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--s-text2)' }}>
              {search ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--s-text2)' }}>{pagination.total} produit{pagination.total !== 1 ? 's' : ''}</p>

            {/* Responsive grid: 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => (
                <a
                  key={product._id}
                  href={storeUrl(`/product/${product.slug}`)}
                  className="overflow-hidden text-left transition-shadow duration-200 group cursor-pointer"
                  style={{ backgroundColor: 'var(--sf-surface)', borderRadius: 'var(--sf-radius)', border: '1px solid var(--sf-soft-border)', boxShadow: 'var(--sf-shadow)' }}
                  title={`Voir les détails de ${product.name}`}
                >
                  {/* Product image */}
                  <div className="aspect-square overflow-hidden relative" style={{ backgroundColor: 'var(--sf-soft-surface)' }}>
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                        width="300"
                        height="300"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        style={{
                          contentVisibility: 'auto',
                          containIntrinsicSize: '300px 300px'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--sf-surface)', color: 'var(--s-text)' }}>
                        Voir détails
                      </div>
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="p-2.5 sm:p-3">
                    <h3 className="text-lg font-semibold line-clamp-2 leading-tight transition-colors" style={{ color: 'var(--s-text)' }}>
                      {product.name}
                    </h3>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-sm font-bold" style={{ color: 'var(--s-primary)' }}>
                        {formatPrice(product.price, product.currency || store.currency)}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-xs line-through" style={{ color: 'var(--s-text2)' }}>
                          {formatPrice(product.compareAtPrice, product.currency || store.currency)}
                        </span>
                      )}
                    </div>
                    {product.stock <= 0 && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: 'color-mix(in srgb, #ef4444 12%, var(--s-bg))', color: '#dc2626' }}>
                        Rupture
                      </span>
                    )}
                    {/* Category tag */}
                    {product.category && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded" style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text2)' }}>
                        {product.category}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => fetchProducts(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 disabled:opacity-40 transition"
                  style={{ borderRadius: 'calc(var(--sf-radius) - 4px)', border: '1px solid var(--sf-soft-border)', color: 'var(--s-text2)', backgroundColor: 'var(--sf-surface)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm" style={{ color: 'var(--s-text2)' }}>{pagination.page} / {pagination.pages}</span>
                <button
                  onClick={() => fetchProducts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 disabled:opacity-40 transition"
                  style={{ borderRadius: 'calc(var(--sf-radius) - 4px)', border: '1px solid var(--sf-soft-border)', color: 'var(--s-text2)', backgroundColor: 'var(--sf-surface)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed WhatsApp FAB for mobile */}
      {store.whatsapp && (
        <a
          href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 p-3.5 rounded-full text-white shadow-lg z-50 sm:hidden"
          style={{ backgroundColor: '#25D366' }}
        >
          <MessageCircle className="w-6 h-6" />
        </a>
      )}
    </div>
  );
};

export default StoreFront;
