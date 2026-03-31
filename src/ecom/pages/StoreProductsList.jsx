import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, Plus, Search, Edit, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight, Loader2, AlertCircle, Image, Sparkles, ExternalLink, Zap } from 'lucide-react';
import { storeProductsApi, storeManageApi } from '../services/storeApi.js';
import ecomApi from '../services/ecommApi.js';
import ProductPageGeneratorModal from '../components/ProductPageGeneratorModal.jsx';

/**
 * StoreProductsList — Dashboard page listing all store catalog products.
 * Features: pagination, search, publish/unpublish toggle, delete.
 */
const StoreProductsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showPageGeneratorModal, setShowPageGeneratorModal] = useState(false);
  const [storeSubdomain, setStoreSubdomain] = useState(null);
  const [generationsInfo, setGenerationsInfo] = useState(null);

  // Récupérer le subdomain du store pour l'aperçu
  useEffect(() => {
    storeManageApi.getStoreConfig()
      .then(res => setStoreSubdomain(res.data?.data?.subdomain))
      .catch(() => {});
  }, []);

  // Récupérer les infos de générations
  const fetchGenerationsInfo = useCallback(async () => {
    try {
      const response = await ecomApi.get('/billing/generations-info');
      if (response.data?.success && response.data?.generations) {
        setGenerationsInfo(response.data.generations);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des infos de générations:', err);
    }
  }, []);

  useEffect(() => {
    fetchGenerationsInfo();
  }, [fetchGenerationsInfo]);

  const handleViewProduct = (product) => {
    if (!storeSubdomain || !product.slug) return;
    const url = `https://${storeSubdomain}.scalor.net/product/${product.slug}`;
    window.open(url, '_blank');
  };

  const handlePageGeneratorApply = (productData) => {
    navigate(`${basePath}/products/new`, { state: { prefill: productData } });
  };

  const handlePageGeneratorClose = () => {
    setShowPageGeneratorModal(false);
    fetchGenerationsInfo(); // Rafraîchir les infos après fermeture du modal
  };

  const fetchProducts = useCallback(async (page = 1, searchTerm = '') => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (searchTerm) params.search = searchTerm;
      const res = await storeProductsApi.getProducts(params);
      const data = res.data?.data;
      setProducts(data?.products || []);
      setPagination(data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } catch (err) {
      setError('Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(1, '');
  }, [fetchProducts]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  const handleTogglePublish = async (product) => {
    try {
      await storeProductsApi.updateProduct(product._id, { isPublished: !product.isPublished });
      setProducts(prev => prev.map(p =>
        p._id === product._id ? { ...p, isPublished: !p.isPublished } : p
      ));
    } catch (err) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce produit de la boutique ?')) return;
    try {
      await storeProductsApi.deleteProduct(id);
      setProducts(prev => prev.filter(p => p._id !== id));
      setPagination(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const formatPrice = (price, currency = 'XAF') => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' ' + currency;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            Produits Boutique
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{pagination.total} produit{pagination.total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPageGeneratorModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-violet-600 hover:to-purple-700 transition shadow-sm relative"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Générer Page IA</span>
            {generationsInfo && (generationsInfo.freeRemaining + generationsInfo.paidRemaining) > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {generationsInfo.freeRemaining + generationsInfo.paidRemaining}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate(`${basePath}/products/new`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            <Plus className="w-4 h-4" />
            Ajouter un produit
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {showPageGeneratorModal && (
        <ProductPageGeneratorModal
          onClose={handlePageGeneratorClose}
          onApply={handlePageGeneratorApply}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Products Table / List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 mt-3 text-sm">Aucun produit dans la boutique</p>
          <button
            onClick={() => navigate(`${basePath}/products/new`)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
          >
            <Plus className="w-4 h-4" />
            Créer le premier produit
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Produit</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Prix</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Stock</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Catégorie</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">Statut</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product._id} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Image className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPrice(product.price, product.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${product.stock <= 0 ? 'text-red-600' : product.stock <= 5 ? 'text-amber-600' : 'text-gray-700'}`}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTogglePublish(product)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${
                          product.isPublished
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {product.isPublished ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {product.isPublished ? 'Publié' : 'Brouillon'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewProduct(product)}
                          disabled={!storeSubdomain || !product.slug}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition disabled:opacity-40"
                          title="Voir le produit"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`${basePath}/products/${product._id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {products.map((product) => (
              <div key={product._id} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  {product.images?.[0]?.url ? (
                    <img src={product.images[0].url} alt={product.name} className="w-12 h-12 rounded-lg object-cover border" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Image className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">{formatPrice(product.price, product.currency)} · Stock: {product.stock}</p>
                  </div>
                  <button
                    onClick={() => handleTogglePublish(product)}
                    className={`p-1.5 rounded-lg ${product.isPublished ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-100'}`}
                  >
                    {product.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button 
                    onClick={() => handleViewProduct(product)} 
                    disabled={!storeSubdomain || !product.slug}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg disabled:opacity-40"
                  >
                    Voir
                  </button>
                  <button onClick={() => navigate(`${basePath}/products/${product._id}/edit`)} className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg">Modifier</button>
                  <button onClick={() => handleDelete(product._id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg">Supprimer</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} sur {pagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(pagination.page - 1, search)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchProducts(pagination.page + 1, search)}
              disabled={pagination.page >= pagination.pages}
              className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductsList;
