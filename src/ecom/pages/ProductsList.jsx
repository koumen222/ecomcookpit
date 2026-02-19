import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

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
    console.log('🔄 ProductsList useEffect - Début du chargement');
    loadProducts();
  }, [searchTerm, statusFilter, isActiveFilter]);

  const loadProducts = async () => {
    try {
      console.log('📦 loadProducts - Début de la requête API');
      setLoading(true);
      
      // Construction des paramètres de requête
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (isActiveFilter !== '') params.append('isActive', isActiveFilter);
      
      const url = params.toString() ? `/products?${params.toString()}` : '/products';
      const response = await ecomApi.get(url);
      console.log('📩 Réponse API produits:', response.data);
      
      // Correction: les produits sont directement dans response.data.data
      const productsData = response.data?.data || [];
      console.log('📋 Données produits extraites:', productsData);
      setProducts(Array.isArray(productsData) ? productsData : []);
      console.log('✅ Produits chargés:', productsData.length);
    } catch (error) {
      console.error('❌ Erreur loadProducts:', error);
      setError('Erreur lors du chargement des produits');
      console.error(error);
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

  const updateSellingPrice = async (productId, newPrice) => {
    try {
      await ecomApi.patch(`/products/${productId}`, {
        sellingPrice: newPrice
      });
      loadProducts(); // Recharger la liste
    } catch (error) {
      setError('Erreur lors de la mise à jour du prix');
      console.error(error);
    }
  };

  // Supprimer la fonction formatCurrency locale car nous utilisons maintenant useMoney

  const deleteProduct = async (productId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;
    
    try {
      await ecomApi.delete(`/products/${productId}`);
      loadProducts(); // Recharger la liste
    } catch (error) {
      setError('Erreur lors de la suppression du produit');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Produits</h1>
        <Link
          to="/ecom/products/new"
          className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                      <Link to={`/ecom/products/${product._id}`} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">{product.name}</Link>
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
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
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
