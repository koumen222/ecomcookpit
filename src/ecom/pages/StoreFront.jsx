import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, ChevronLeft, ChevronRight, Loader2, Phone, MessageCircle, Filter } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';

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

  // Build store-relative paths (subdomain: /product/x, root: /store/sub/product/x)
  const storePath = (path) => isStoreDomain ? path : `/store/${subdomain}${path}`;

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Load store info + initial products + categories in parallel
  useEffect(() => {
    (async () => {
      try {
        const [storeRes, productsRes, catRes] = await Promise.all([
          publicStoreApi.getStore(subdomain),
          publicStoreApi.getProducts(subdomain, { page: 1, limit: 20 }),
          publicStoreApi.getCategories(subdomain)
        ]);
        setStore(storeRes.data?.data);
        setProducts(productsRes.data?.data?.products || []);
        setPagination(productsRes.data?.data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
        setCategories(catRes.data?.data || []);
      } catch {
        setError('Boutique introuvable');
      } finally {
        setLoading(false);
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const themeColor = store?.themeColor || '#0F6B4F';

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900 mt-4">Boutique introuvable</h1>
          <p className="text-sm text-gray-500 mt-2">Cette boutique n'existe pas ou n'est pas encore activée.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        {/* Banner */}
        {store.banner && (
          <div className="h-32 sm:h-44 overflow-hidden">
            <img src={store.banner} alt={store.name} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {store.logo && (
              <img src={store.logo} alt={store.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">{store.name}</h1>
              {store.description && (
                <p className="text-xs text-gray-500 truncate">{store.description}</p>
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
                  style={{ backgroundColor: themeColor }}
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': themeColor }}
          />
        </div>

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => handleCategoryChange('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === '' ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={selectedCategory === '' ? { backgroundColor: themeColor } : {}}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat ? 'text-white' : 'bg-white border border-gray-200 text-gray-600'
                }`}
                style={selectedCategory === cat ? { backgroundColor: themeColor } : {}}
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
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">
              {search ? 'Aucun produit trouvé' : 'Aucun produit disponible'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">{pagination.total} produit{pagination.total !== 1 ? 's' : ''}</p>

            {/* Responsive grid: 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {products.map((product) => (
                <button
                  key={product._id}
                  onClick={() => navigate(storePath(`/product/${product.slug}`))}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left hover:shadow-md transition group"
                >
                  {/* Product image */}
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="p-2.5 sm:p-3">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-tight">
                      {product.name}
                    </h3>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-sm font-bold" style={{ color: themeColor }}>
                        {formatPrice(product.price)} {product.currency || store.currency}
                      </span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className="text-xs text-gray-400 line-through">
                          {formatPrice(product.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    {product.stock <= 0 && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-medium rounded">
                        Rupture
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => fetchProducts(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-500">{pagination.page} / {pagination.pages}</span>
                <button
                  onClick={() => fetchProducts(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
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
