import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ShoppingBag, ChevronLeft, ChevronRight, Phone, MessageCircle, Filter, SlidersHorizontal, X, Check, Shield, Truck, Headphones, ArrowUpDown } from 'lucide-react';
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

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Plus récents' },
  { value: 'price', label: 'Prix croissant' },
  { value: '-price', label: 'Prix décroissant' },
  { value: 'name', label: 'Nom A-Z' },
];

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
  const [sortBy, setSortBy] = useState('-createdAt');
  const [availability, setAvailability] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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

  const fetchProducts = useCallback(async (page = 1, cat = selectedCategory, searchTerm = search, sortValue = sortBy) => {
    setLoadingProducts(true);
    try {
      const params = { page, limit: 20, sort: sortValue };
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
  }, [subdomain, selectedCategory, search, sortBy]);

  // Debounced search
  useEffect(() => {
    if (!store) return;
    const timer = setTimeout(() => {
      fetchProducts(1, selectedCategory, search, sortBy);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, sortBy, store, fetchProducts]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
  };

  const filteredProducts = products.filter((product) => {
    if (availability === 'in-stock') return Number(product.stock || 0) > 0;
    if (availability === 'out-of-stock') return Number(product.stock || 0) <= 0;
    return true;
  });

  const activeFilters = [
    selectedCategory ? { key: 'category', label: selectedCategory, clear: () => setSelectedCategory('') } : null,
    search ? { key: 'search', label: `Recherche: ${search}`, clear: () => setSearch('') } : null,
    availability !== 'all' ? { key: 'availability', label: availability === 'in-stock' ? 'En stock' : 'Rupture', clear: () => setAvailability('all') } : null,
  ].filter(Boolean);

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSearch('');
    setAvailability('all');
    setSortBy('-createdAt');
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

  const sidebarCardStyle = {
    backgroundColor: 'var(--sf-surface)',
    border: '1px solid var(--sf-soft-border)',
    borderRadius: 'var(--sf-radius)',
    boxShadow: 'var(--sf-shadow)',
  };

  const sectionLabelStyle = {
    color: 'var(--s-text)',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '-0.01em',
  };

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

      <main className="max-w-7xl mx-auto px-4 pb-12 pt-6 lg:pt-8">
        <section className="mb-6 lg:mb-8" style={{ ...sidebarCardStyle, padding: '20px 22px' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--s-text2)' }}>
                <span>Boutique</span>
                <span>/</span>
                <span>Produits</span>
              </div>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--s-text)' }}>Catalogue</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--s-text2)' }}>
                Découvrez les produits disponibles avec une navigation plus claire, des filtres visibles et un affichage catalogue plus structuré.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold lg:hidden"
              style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
            >
              {mobileFiltersOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
              Filtres
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="space-y-4 lg:sticky lg:top-24">
              <div style={{ ...sidebarCardStyle, padding: '18px' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold" style={{ color: 'var(--s-text)' }}>Filter Options</h3>
                  {activeFilters.length > 0 && (
                    <button type="button" onClick={clearAllFilters} className="text-xs font-semibold" style={{ color: 'var(--s-primary)' }}>
                      Effacer
                    </button>
                  )}
                </div>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--s-text2)' }} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--s-bg)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)', borderRadius: 'calc(var(--sf-radius) - 6px)' }}
                  />
                </div>
              </div>

              <div style={{ ...sidebarCardStyle, padding: '18px' }}>
                <div style={sectionLabelStyle}>Catégories</div>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('')}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition"
                    style={selectedCategory === '' ? { backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' } : { color: 'var(--s-text2)', border: '1px solid transparent' }}
                  >
                    <span>Toutes les catégories</span>
                    {selectedCategory === '' && <Check className="w-4 h-4" style={{ color: 'var(--s-primary)' }} />}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition"
                      style={selectedCategory === cat ? { backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' } : { color: 'var(--s-text2)', border: '1px solid transparent' }}
                    >
                      <span>{cat}</span>
                      {selectedCategory === cat && <Check className="w-4 h-4" style={{ color: 'var(--s-primary)' }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ ...sidebarCardStyle, padding: '18px' }}>
                <div style={sectionLabelStyle}>Disponibilité</div>
                <div className="mt-4 space-y-2">
                  {[
                    { value: 'all', label: 'Tout afficher' },
                    { value: 'in-stock', label: 'En stock' },
                    { value: 'out-of-stock', label: 'Rupture' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAvailability(option.value)}
                      className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition"
                      style={availability === option.value ? { backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' } : { color: 'var(--s-text2)', border: '1px solid transparent' }}
                    >
                      <span>{option.label}</span>
                      {availability === option.value && <Check className="w-4 h-4" style={{ color: 'var(--s-primary)' }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
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
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 mx-auto" style={{ color: 'var(--s-text2)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--s-text2)' }}>
              {search || availability !== 'all' || selectedCategory ? 'Aucun produit trouvé avec ces filtres' : 'Aucun produit disponible'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-4" style={{ ...sidebarCardStyle, padding: '16px 18px' }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--s-text)' }}>
                    Showing {filteredProducts.length} of {pagination.total} results
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text2)' }}>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    Sort by
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--s-bg)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)', borderRadius: '999px' }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filterItem) => (
                    <button
                      key={filterItem.key}
                      type="button"
                      onClick={filterItem.clear}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
                    >
                      <span>{filterItem.label}</span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((product) => (
                <a
                  key={product._id}
                  href={storeUrl(`/product/${product.slug}`)}
                  className="overflow-hidden text-left transition duration-300 group cursor-pointer"
                  style={{ backgroundColor: 'var(--sf-surface)', borderRadius: 'var(--sf-radius)', border: '1px solid var(--sf-soft-border)', boxShadow: 'var(--sf-shadow)' }}
                  title={`Voir les détails de ${product.name}`}
                >
                  <div className="aspect-[0.95/1] overflow-hidden relative" style={{ backgroundColor: 'var(--sf-soft-surface)' }}>
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
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <div className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ backgroundColor: 'var(--s-primary)', color: '#fff' }}>
                        Promo
                      </div>
                    )}
                  </div>

                  <div className="p-3 sm:p-4">
                    {product.category && (
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--s-text2)' }}>
                        {product.category}
                      </div>
                    )}
                    <h3 className="line-clamp-2 text-sm font-extrabold leading-snug sm:text-base" style={{ color: 'var(--s-text)' }}>
                      {product.name}
                    </h3>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-base font-black sm:text-lg" style={{ color: 'var(--s-primary)' }}>
                        {formatPrice(product.price, product.currency || store.currency)}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-xs line-through sm:text-sm" style={{ color: 'var(--s-text2)' }}>
                          {formatPrice(product.compareAtPrice, product.currency || store.currency)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={Number(product.stock || 0) > 0 ? { backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)' } : { backgroundColor: 'color-mix(in srgb, #ef4444 12%, var(--s-bg))', color: '#dc2626' }}>
                        {Number(product.stock || 0) > 0 ? 'En stock' : 'Rupture'}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--s-text2)' }}>Voir détails</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => fetchProducts(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 disabled:opacity-40 transition"
                  style={{ borderRadius: 'calc(var(--sf-radius) - 4px)', border: '1px solid var(--sf-soft-border)', color: 'var(--s-text2)', backgroundColor: 'var(--sf-surface)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(pagination.pages, 5) }, (_, index) => {
                  const pageNumber = index + 1;
                  const active = pageNumber === pagination.page;
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => fetchProducts(pageNumber)}
                      className="h-10 w-10 text-sm font-bold transition"
                      style={active ? { borderRadius: '999px', backgroundColor: 'var(--s-primary)', color: '#fff' } : { borderRadius: '999px', backgroundColor: 'var(--sf-surface)', color: 'var(--s-text2)', border: '1px solid var(--sf-soft-border)' }}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                {pagination.pages > 5 && <span className="px-1 text-sm" style={{ color: 'var(--s-text2)' }}>…</span>}
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
          </section>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: Truck, title: 'Livraison rapide', text: 'Des expéditions organisées avec un suivi clair.' },
            { icon: Shield, title: 'Paiement flexible', text: 'Des options simples et rassurantes selon votre boutique.' },
            { icon: Headphones, title: 'Support disponible', text: 'Une assistance accessible pour accompagner la commande.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ ...sidebarCardStyle, padding: '18px 18px 16px' }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-primary)' }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold" style={{ color: 'var(--s-text)' }}>{item.title}</h3>
                    <p className="mt-1 text-sm leading-6" style={{ color: 'var(--s-text2)' }}>{item.text}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>

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
