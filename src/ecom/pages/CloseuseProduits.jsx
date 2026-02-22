import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const CloseuseProduits = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [myAssignments, setMyAssignments] = useState({ productAssignments: [] });
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadMyProducts();
  }, []);

  const loadMyProducts = async () => {
    try {
      setLoading(true);
      
      const [productsRes, assignmentsRes] = await Promise.all([
        ecomApi.get('/products?isActive=true'),
        ecomApi.get('/assignments/my-assignments')
      ]);

      setMyAssignments(assignmentsRes.data.data);

      // Filtrer uniquement les produits affectés à cette closeuse
      const assignments = assignmentsRes.data.data;
      let filteredProducts = productsRes.data.data;
      
      // Collecter les noms de produits Google Sheets assignés
      const sheetProductNames = (assignments.productAssignments || []).flatMap(pa => pa.sheetProductNames || []);
      
      if (assignments.productAssignments && assignments.productAssignments.length > 0) {
        const assignedProductIds = assignments.productAssignments.flatMap(pa => 
          (pa.productIds || []).map(p => p._id)
        );
        if (assignedProductIds.length > 0) {
          filteredProducts = filteredProducts.filter(product => assignedProductIds.includes(product._id));
        }
      }
      
      // Ajouter les produits Google Sheets comme des objets virtuels
      const sheetProductObjects = sheetProductNames.map((name, idx) => ({
        _id: `sheet_${idx}`,
        name,
        isSheetProduct: true,
        status: 'active',
        sellingPrice: '-',
        stock: '-'
      }));
      
      setProducts([...filteredProducts, ...sheetProductObjects]);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      setMessage('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      test: 'bg-yellow-100 text-yellow-800',
      stable: 'bg-blue-100 text-blue-800',
      winner: 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mes Produits Affectés</h1>
        <p className="text-gray-600 mt-1">
          Produits que vous êtes autorisée à gérer
        </p>
      </div>

      {message && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 text-red-800">
          {message}
        </div>
      )}

      {/* Affichage des sources affectées */}
      {myAssignments.productAssignments && myAssignments.productAssignments.length > 0 && (
        <div className="mb-6 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">📦 Vos affectations par source</h3>
          <div className="space-y-2">
            {myAssignments.productAssignments.map((pa, paIdx) => {
              const totalProducts = (pa.productIds?.length || 0) + (pa.sheetProductNames?.length || 0);
              return (
                <div key={paIdx} className="flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: (pa.sourceId?.color || '#3B82F6') + '20', color: pa.sourceId?.color || '#3B82F6' }}
                  >
                    {pa.sourceId?.icon} {pa.sourceId?.name}
                  </span>
                  <span className="text-sm text-gray-600">
                    → {totalProducts} produit{totalProducts > 1 ? 's' : ''}
                  </span>
                  {pa.sheetProductNames?.length > 0 && (
                    <div className="flex flex-wrap gap-1 ml-2">
                      {pa.sheetProductNames.map((name, nIdx) => (
                        <span key={nIdx} className="inline-flex px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des produits */}
      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun produit affecté
          </h3>
          <p className="text-gray-600">
            Contactez votre administrateur pour qu'il vous affecte des produits à gérer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(product.status)}`}>
                    {product.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Prix de vente:</span>
                    <span className="font-medium text-gray-900">{product.sellingPrice} FCFA</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Stock disponible:</span>
                    <span className={`font-medium ${product.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                      {product.stock} unités
                    </span>
                  </div>
                  {product.supplier && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Fournisseur:</span>
                      <span className="font-medium text-gray-900">{product.supplier}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Link
                    to={`/ecom/products/${product._id}`}
                    className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Voir les détails
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-yellow-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-yellow-900 mb-1">
              Information importante
            </h4>
            <p className="text-sm text-yellow-800">
              Vous ne pouvez gérer que les produits qui vous sont affectés par l'administrateur. 
              Pour créer des commandes, utilisez uniquement ces produits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloseuseProduits;
