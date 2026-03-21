import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const ProductSkeleton = () => (
  <div className="p-3 sm:p-4 lg:p-6">
    <div className="flex justify-between items-center mb-4 sm:mb-6">
      <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
      <div className="h-9 w-24 bg-gray-200 rounded-lg animate-pulse" />
    </div>
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    </div>
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-100">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 sm:px-6 py-4">
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse ml-auto" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse hidden sm:block" />
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse hidden sm:block" />
            <div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ProductsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  useEffect(() => {
    loadProducts();
  }, [searchTerm, statusFilter, isActiveFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (isActiveFilter !== '') params.append('isActive', isActiveFilter);
      const url = params.toString() ? `/products?${params.toString()}` : '/products';
      const response = await ecomApi.get(url);
      const productsData = Array.isArray(response.data?.data) ? response.data.data : [];
      
      setProducts(productsData);
    } catch (error) {
      setError(getContextualError(error, 'load_products'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateBenefit = (product) => {
    const sellingPrice = product.sellingPrice || 0;
    const productCost = product.productCost || 0;
    const deliveryCost = product.deliveryCost || 0;
    const avgAdsCost = product.avgAdsCost || 0;
    const totalCost = productCost + deliveryCost + avgAdsCost;
    return sellingPrice - totalCost;
  };

  const getProductStatusBadge = (status) => {
    const styles = {
      test: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      scale: 'bg-orange-100 text-orange-800 border-orange-200',
      scal: 'bg-orange-100 text-orange-800 border-orange-200',
      stable: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      winner: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pause: 'bg-gray-100 text-gray-700 border-gray-200',
      stop: 'bg-red-100 text-red-800 border-red-200',
    };
    const labels = {
      test: 'TEST',
      scale: 'SCALE',
      scal: 'SCALE',
      stable: 'STABLE',
      winner: 'WINNER',
      pause: 'PAUSE',
      stop: 'STOP',
    };
    return { style: styles[status] || 'bg-slate-100 text-slate-700 border-slate-200', label: labels[status] || status?.toUpperCase() || '—' };
  };
  const calculateSuggestedPrice = (product) => {
    const productCost = product.productCost || 0;
    
    let suggestedPrice;
    
    if (productCost < 10000) {
      // Si < 10 000 : multiplier par 3
      suggestedPrice = productCost * 3;
    } else {
      // Si >= 10 000 : multiplier par 2,25
      suggestedPrice = productCost * 2.25;
    }
    
    // Le prix ne doit JAMAIS être inférieur à 10 000
    if (suggestedPrice < 10000) {
      suggestedPrice = 10000;
    }
    
    // Arrondir au multiple de 50 supérieur pour un prix psychologique
    return Math.ceil(suggestedPrice / 50) * 50;
  };

  const productStats = useMemo(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.isActive).length;
    const inactiveProducts = totalProducts - activeProducts;

    const totalPotentialBenefit = products.reduce((sum, p) => sum + calculateBenefit(p), 0);
    const profitableProducts = products.filter(p => calculateBenefit(p) > 0).length;

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      totalPotentialBenefit,
      profitableProducts
    };
  }, [products]);

  const updateSellingPrice = async (productId, newPrice) => {
    try {
      await ecomApi.patch(`/products/${productId}`, { sellingPrice: newPrice });
      loadProducts();
    } catch (error) {
      setError(getContextualError(error, 'save_product'));
    }
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    try {
      await ecomApi.delete(`/products/${productId}`);
      loadProducts();
    } catch (error) {
      setError(getContextualError(error, 'delete_product'));
    }
  };

  if (loading) return <ProductSkeleton />;

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Produits</h1>
        <Link
          to="/ecom/products/new"
          className="bg-emerald-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-emerald-700 text-sm"
        >
          + Produit
        </Link>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Champ de recherche */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recherche
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom ou statut..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>
          
          {/* Filtre par statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            >
              <option value="">Tous les statuts</option>
              <option value="test">Test</option>
              <option value="stable">Stable</option>
              <option value="winner">Winner</option>
              <option value="pause">Pause</option>
              <option value="stop">Stop</option>
            </select>
          </div>
          
          {/* Filtre par activité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Activité
            </label>
            <select
              value={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            >
              <option value="">Tous</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        </div>
        
        {/* Bouton de réinitialisation */}
        {(searchTerm || statusFilter || isActiveFilter) && (
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setIsActiveFilter('');
              }}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-[10px] sm:text-xs text-gray-500">Produits</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{productStats.totalProducts}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-lg p-3">
          <p className="text-[10px] sm:text-xs text-green-700">Actifs</p>
          <p className="text-lg sm:text-xl font-bold text-green-700">{productStats.activeProducts}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-lg p-3">
          <p className="text-[10px] sm:text-xs text-red-700">Inactifs</p>
          <p className="text-lg sm:text-xl font-bold text-red-700">{productStats.inactiveProducts}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-lg p-3">
          <p className="text-[10px] sm:text-xs text-emerald-700">Produits rentables</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-700">{productStats.profitableProducts}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg p-3 col-span-2 lg:col-span-1">
          <p className="text-[10px] sm:text-xs text-amber-700">Bénéfice total estimé</p>
          <p className={`text-sm sm:text-base font-bold ${productStats.totalPotentialBenefit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {fmt(productStats.totalPotentialBenefit)}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Coût
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Bénéfice
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  {searchTerm || statusFilter || isActiveFilter 
                    ? 'Aucun produit trouvé pour ces critères de recherche' 
                    : 'Aucun produit trouvé'}
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const benefit = calculateBenefit(product);
                const totalCost = (product.productCost || 0) + (product.deliveryCost || 0) + (product.avgAdsCost || 0);
                const isProfitable = benefit > 0;
                
                return (
                  <tr key={product._id}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link to={`/ecom/products/${product._id}`} className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline">{product.name}</Link>
                        {(() => {
                          const badge = getProductStatusBadge(product.status);
                          return (
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badge.style}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <div className="text-xs sm:text-sm text-gray-900">{fmt(product.sellingPrice)}</div>
                        <button
                          onClick={() => {
                            const suggestedPrice = calculateSuggestedPrice(product);
                            if (confirm(`Prix suggéré: ${fmt(suggestedPrice)}\n\nAppliquer ce prix au produit "${product.name}" ?`)) {
                              updateSellingPrice(product._id, suggestedPrice);
                            }
                          }}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                          title="Calculer un prix de vente raisonnable"
                        >
                          Suggérer prix
                        </button>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="text-xs sm:text-sm text-gray-900">{fmt(totalCost)}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className={`text-xs sm:text-sm font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(benefit)}
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        product.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/ecom/products/${product._id}/edit`}
                        className="text-emerald-700 hover:text-emerald-900 mr-4"
                      >
                        Modifier
                      </Link>
                      <button
                        onClick={() => deleteProduct(product._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductsList;
