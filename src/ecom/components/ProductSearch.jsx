import React, { useState, useEffect } from 'react';
import { publicSearch } from '../services/publicApi.js';

const ProductSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchTerm.trim()) {
      const timeoutId = setTimeout(() => {
        searchProducts(searchTerm);
      }, 300); // Debounce de 300ms

      return () => clearTimeout(timeoutId);
    } else {
      setProducts([]);
      setShowResults(false);
    }
  }, [searchTerm]);

  const searchProducts = async (term) => {
    try {
      setLoading(true);
      setError('');
      
      const result = await publicSearch.searchProducts(term, { limit: 10 });
      
      if (result.success) {
        setProducts(result.data);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Erreur recherche produits:', error);
      setError('Erreur lors de la recherche');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      winner: { color: 'bg-emerald-100 text-emerald-800', label: '🏆 Winner' },
      stable: { color: 'bg-blue-100 text-blue-800', label: '📈 Stable' },
      test: { color: 'bg-amber-100 text-amber-800', label: '🧪 Test' },
      pause: { color: 'bg-gray-100 text-gray-800', label: '⏸️ Pause' },
      stop: { color: 'bg-red-100 text-red-800', label: '🛑 Stop' }
    };
    
    const config = statusConfig[status] || statusConfig.test;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Champ de recherche */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setShowResults(true)}
            placeholder="Rechercher un produit..."
            className="w-full px-4 py-3 pl-12 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            ) : (
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Résultats de recherche */}
        {showResults && (
          <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto">
            {error && (
              <div className="p-4 text-red-600 text-sm">
                {error}
              </div>
            )}
            
            {!loading && !error && products.length === 0 && searchTerm && (
              <div className="p-4 text-gray-500 text-center">
                Aucun produit trouvé pour "{searchTerm}"
              </div>
            )}
            
            {products.map((product) => (
              <div key={product._id} className="p-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="font-medium text-blue-600">{formatPrice(product.sellingPrice)}</span>
                      {getStatusBadge(product.status)}
                    </div>
                    {product.stock > 0 && (
                      <div className="mt-1 text-xs text-gray-500">
                        Stock: {product.stock} unités
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {products.length > 0 && (
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <button 
                  onClick={() => window.location.href = '/ecom/login'}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
                >
                  Voir tous les produits →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggestions populaires */}
      {!searchTerm && !showResults && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 mb-3">Produits populaires:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {['Gummies', 'Sérum', 'Ceinture', 'Crème'].map((term) => (
              <button
                key={term}
                onClick={() => setSearchTerm(term)}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSearch;
