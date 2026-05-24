import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, ShoppingBag, ChevronLeft, ChevronRight, Phone, MessageCircle, Filter, SlidersHorizontal, X, Check, Shield, Truck, Headphones, ArrowUpDown } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { injectStoreCssVars } from '../hooks/useStoreData.js';
import { injectPixelScripts, firePixelEvent } from '../utils/pixelTracking.js';
import { formatMoney } from '../utils/currency.js';

// Cache sessionStorage SUPPRIMÉ — on lit toujours frais depuis l'API.
// (cf. useStoreData.js pour la justification : trop de bugs "modif pas visible")
function _sfRead(_key) { return null; }
function _sfWrite(_key, _data) { /* no-op */ }

const SF_ANIM_CSS = `
@keyframes _sfin { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
.sf-in { animation: _sfin 0.28s ease both; }
@keyframes _sfpbar { 0%{width:0%} 60%{width:75%} 100%{width:100%} }
.sf-pbar { position:fixed;top:0;left:0;height:2px;z-index:9999;pointer-events:none;animation:_sfpbar 8s ease-out forwards; }
`;

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
  const _mainFetchComplete = useRef(false);
  const [error, setError] = useState('');
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('-createdAt');
  const [availability, setAvailability] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!subdomain) return;

    // Reset all state for the new subdomain
    _mainFetchComplete.current = false;
    setError('');
    setSearch('');
    setSelectedCategory('');
    setSortBy('-createdAt');
    setAvailability('all');
    setLoadingTimeout(false);

    // Check cache for this specific subdomain
    const cacheKey = `sf_${subdomain}`;
    const cached = _sfRead(cacheKey);
    const hasCachedProducts = !!(cached?.store && cached?.products?.length);

    if (hasCachedProducts) {
      // Show cached data immediately, revalidate in background
      setStore(cached.store);
      setProducts(cached.products);
      setCategories(cached.categories || []);
      setPagination(cached.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      setLoading(false);
      injectStoreCssVars(cached.store);
    } else {
      // Cold load — show skeleton
      setStore(null);
      setProducts([]);
      setCategories([]);
      setPagination({ page: 1, limit: 20, total: 0, pages: 0 });
      setLoading(true);
    }

    let timeoutId;
    if (!hasCachedProducts) {
      timeoutId = setTimeout(() => setLoadingTimeout(true), 8000);
    }

    (async () => {
      try {
        const res = await publicStoreApi.getStore(subdomain);
        const data = res.data?.data;
        const storeData = data?.store;
        const newProducts = data?.products || [];
        const newPagination = data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 };
        const newCategories = data?.categories || [];

        setStore(storeData);
        setProducts(newProducts);
        setPagination(newPagination);
        setCategories(newCategories);
        _mainFetchComplete.current = true;

        if (storeData) injectStoreCssVars(storeData);

        _sfWrite(cacheKey, { store: storeData, products: newProducts, pagination: newPagination, categories: newCategories, pixels: data?.pixels });

        if (data?.pixels) {
          injectPixelScripts(data.pixels);
          firePixelEvent('PageView');
        }
      } catch (err) {
        if (!hasCachedProducts) {
          console.error('Store loading error:', err);
          setError('Boutique introuvable');
        }
      } finally {
        clearTimeout(timeoutId);
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

  // Debounced search — fires only when user changes filters (search/category/sort)
  // Does NOT include store in deps to avoid triggering on initial data arrival
  useEffect(() => {
    if (!_mainFetchComplete.current) return;
    const timer = setTimeout(() => {
      fetchProducts(1, selectedCategory, search, sortBy);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, selectedCategory, sortBy, fetchProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
  };

  const filteredProducts = products.filter((product) => {
    if (availability === 'in-stock') return Number(product.stock || 0) > 0;
    if (availability === 'out-of-stock') return Number(product.stock || 0) <= 0;
    return true;
  });

  const categoryCounts = products.reduce((acc, product) => {
    const category = product.category || 'Autres';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const priceValues = filteredProducts.map((product) => Number(product.price || 0)).filter((price) => Number.isFinite(price) && price > 0);
  const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length ? Math.max(...priceValues) : 0;

  const activeFilters = [
    selectedCategory ? { key: 'category', label: selectedCategory, clear: () => setSelectedCategory('') } : null,
    search ? { key: 'search', label: `Recherche: ${search}`, clear: () => setSearch('') } : null,
    availability !== 'all' ? { key: 'availability', label: availability === 'in-stock' ? 'En stock' : 'Rupture', clear: () => setAvailability('all') } : null,
  ].filter(Boolean);

  const totalVisibleProducts = filteredProducts.length;

  const getDiscountPercent = (product) => {
    const comparePrice = Number(product.compareAtPrice || 0);
    const currentPrice = Number(product.price || 0);
    if (!comparePrice || comparePrice <= currentPrice || currentPrice <= 0) return null;
    return Math.round(((comparePrice - currentPrice) / comparePrice) * 100);
  };

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

  // Error only after loading is done — never block render with a skeleton
  if (error && !loading) {
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
    <div className="min-h-screen" style={{ backgroundColor: store ? 'var(--s-bg)' : '#f9fafb', color: 'var(--s-text)', fontFamily: 'var(--s-font-base, var(--s-font, Inter, sans-serif))', ...(shellVars || {}) }}>
      <style>{SF_ANIM_CSS}</style>

      {/* Thin progress bar — only on cold load, no skeleton */}
      {loading && !store && (
        <div className="sf-pbar" style={{ backgroundColor: '#10b981' }} />
      )}

      {/* Store Header — appears as soon as store data is ready */}
      {store && <header className="sf-in sticky top-0 z-40" style={{ backgroundColor: 'var(--sf-surface)', borderBottom: '1px solid var(--sf-soft-border)', backdropFilter: 'blur(14px)' }}>
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
      </header>}

      {store && <main className="sf-in max-w-6xl mx-auto px-4 pb-12 pt-8 lg:pt-10">
        <section className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--s-text2)' }}>
            Accueil / Produits
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl" style={{ color: 'var(--s-text)' }}>
            Tous nos produits
          </h2>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--s-text2)' }}>
            {pagination.total || totalVisibleProducts} article{(pagination.total || totalVisibleProducts) > 1 ? 's' : ''} disponible{(pagination.total || totalVisibleProducts) > 1 ? 's' : ''}
          </p>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => handleCategoryChange('')}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition"
            style={selectedCategory === '' ? { backgroundColor: 'var(--s-text)', color: 'var(--s-bg)' } : { backgroundColor: 'var(--sf-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
          >
            <span>Tout</span>
            <span className="text-xs opacity-70">{pagination.total || products.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition"
              style={selectedCategory === cat ? { backgroundColor: 'var(--s-text)', color: 'var(--s-bg)' } : { backgroundColor: 'var(--sf-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
            >
              <span>{cat}</span>
              <span className="text-xs opacity-70">{categoryCounts[cat] || 0}</span>
            </button>
          ))}
        </section>

        <section className="mt-6" style={{ ...sidebarCardStyle, padding: '16px 18px' }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--s-text2)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un produit"
                className="w-full pl-10 pr-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--s-bg)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)', borderRadius: '999px' }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold md:hidden"
                style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
              >
                {mobileFiltersOpen ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
                Filtres
              </button>

              <div className="hidden md:flex items-center gap-2">
                {[
                  { value: 'all', label: 'Tout' },
                  { value: 'in-stock', label: 'En stock' },
                  { value: 'out-of-stock', label: 'Rupture' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAvailability(option.value)}
                    className="rounded-full px-4 py-2 text-sm font-semibold transition"
                    style={availability === option.value ? { backgroundColor: 'var(--s-text)', color: 'var(--s-bg)' } : { backgroundColor: 'var(--sf-surface)', color: 'var(--s-text2)', border: '1px solid var(--sf-soft-border)' }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text2)' }}>
                <ArrowUpDown className="w-3.5 h-3.5" />
                Trier
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--s-bg)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)', borderRadius: '999px' }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {mobileFiltersOpen && (
            <div className="mt-4 flex flex-wrap gap-2 md:hidden">
              {[
                { value: 'all', label: 'Tout' },
                { value: 'in-stock', label: 'En stock' },
                { value: 'out-of-stock', label: 'Rupture' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAvailability(option.value)}
                  className="rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={availability === option.value ? { backgroundColor: 'var(--s-text)', color: 'var(--s-bg)' } : { backgroundColor: 'var(--sf-surface)', color: 'var(--s-text2)', border: '1px solid var(--sf-soft-border)' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {(activeFilters.length > 0 || minPrice || maxPrice) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--s-text2)' }}>
              {activeFilters.map((filterItem) => (
                <button
                  key={filterItem.key}
                  type="button"
                  onClick={filterItem.clear}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold"
                  style={{ backgroundColor: 'var(--sf-soft-surface)', color: 'var(--s-text)', border: '1px solid var(--sf-soft-border)' }}
                >
                  <span>{filterItem.label}</span>
                  <X className="w-3 h-3" />
                </button>
              ))}
              {(minPrice || maxPrice) ? <span>Prix: {formatPrice(minPrice, store.currency)} - {formatPrice(maxPrice, store.currency)}</span> : null}
              {activeFilters.length > 0 && (
                <button type="button" onClick={clearAllFilters} className="font-semibold" style={{ color: 'var(--s-primary)' }}>
                  Effacer les filtres
                </button>
              )}
            </div>
          )}
        </section>

        <section className="min-w-0 mt-6" style={{ opacity: loadingProducts ? 0.5 : 1, transition: 'opacity 0.2s ease' }}>
        {filteredProducts.length === 0 && !loadingProducts ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 mx-auto" style={{ color: 'var(--s-text2)' }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--s-text2)' }}>
              {search || availability !== 'all' || selectedCategory ? 'Aucun produit trouvé avec ces filtres' : 'Aucun produit disponible'}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 text-center text-sm font-medium" style={{ color: 'var(--s-text2)' }}>
              {totalVisibleProducts} produit{totalVisibleProducts > 1 ? 's' : ''} affiché{totalVisibleProducts > 1 ? 's' : ''}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <a
                  key={product._id}
                  href={storeUrl(`/product/${product.slug}`)}
                  className="overflow-hidden text-left transition duration-300 group cursor-pointer"
                  style={{ backgroundColor: 'var(--sf-surface)', borderRadius: 'calc(var(--sf-radius) - 4px)', border: '1px solid var(--sf-soft-border)' }}
                  title={`Voir les détails de ${product.name}`}
                >
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
                    {getDiscountPercent(product) ? (
                      <div className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ backgroundColor: 'var(--s-primary)', color: '#fff' }}>
                        -{getDiscountPercent(product)}%
                      </div>
                    ) : null}
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
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--s-text2)' }}>Voir le produit</span>
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
      </main>}

      {/* Fixed WhatsApp FAB for mobile */}
      {store?.whatsapp && (
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
