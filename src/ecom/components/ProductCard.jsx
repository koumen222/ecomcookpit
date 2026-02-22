import React from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';

const ProductCard = ({ product, showActions = true, onEdit, onDelete }) => {
  const { fmt } = useMoney();
  const getStatusColor = (status) => {
    const colors = {
      test: 'bg-yellow-100 text-yellow-800',
      stable: 'bg-blue-100 text-blue-800',
      winner: 'bg-green-100 text-green-800',
      pause: 'bg-orange-100 text-orange-800',
      stop: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStockColor = (stock, threshold) => {
    if (stock === 0) return 'text-red-600 font-bold';
    if (stock <= threshold / 2) return 'text-orange-600 font-semibold';
    if (stock <= threshold) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Utilise fmt de useMoney pour la conversion dynamique

  const calculateMargin = () => {
    if (!product.sellingPrice || !product.productCost || !product.deliveryCost || !product.avgAdsCost) {
      return 0;
    }
    return product.sellingPrice - product.productCost - product.deliveryCost - product.avgAdsCost;
  };

  const margin = calculateMargin();

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(product.status)}`}>
                {product.status}
              </span>
              {!product.isActive && (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                  Inactif
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Informations principales */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Prix de vente</p>
            <p className="font-semibold text-gray-900">{fmt(product.sellingPrice)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Stock</p>
            <p className={`font-semibold ${getStockColor(product.stock, product.reorderThreshold)}`}>
              {product.stock} unités
            </p>
          </div>
        </div>

        {/* Métriques financières */}
        <div className="border-t border-gray-100 pt-4 mb-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Coût produit</p>
              <p className="font-medium">{fmt(product.productCost)}</p>
            </div>
            <div>
              <p className="text-gray-500">Coût livraison</p>
              <p className="font-medium">{fmt(product.deliveryCost)}</p>
            </div>
            <div>
              <p className="text-gray-500">Coût pub moyen</p>
              <p className="font-medium">{fmt(product.avgAdsCost)}</p>
            </div>
            <div>
              <p className="text-gray-500">Marge/unité</p>
              <p className={`font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(margin)}
              </p>
            </div>
          </div>
        </div>

        {/* Alertes */}
        {product.isLowStock?.() && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-yellow-800">
                Stock bas! Seuil: {product.reorderThreshold} unités
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex space-x-2">
              <Link
                to={`/products/${product._id}`}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition"
              >
                Voir
              </Link>
              {onEdit && (
                <button
                  onClick={() => onEdit(product)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition"
                >
                  Modifier
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(product)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition"
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="text-xs text-gray-400">
              ID: {product._id.slice(-8)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
