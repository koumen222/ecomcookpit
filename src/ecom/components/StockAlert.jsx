import React from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';

const StockAlert = ({ alerts, onDismiss }) => {
  const { fmt } = useMoney();
  const getUrgencyColor = (urgency) => {
    const colors = {
      critical: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        icon: 'text-red-600'
      },
      high: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        icon: 'text-orange-600'
      },
      medium: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        icon: 'text-yellow-600'
      }
    };
    return colors[urgency] || colors.medium;
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'critical':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  // Utilise fmt de useMoney pour la conversion dynamique

  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-green-800 font-medium">Aucune alerte de stock</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => {
        const colors = getUrgencyColor(alert.urgency);
        return (
          <div
            key={index}
            className={`${colors.bg} ${colors.border} border rounded-lg p-4`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className={`flex-shrink-0 ${colors.icon}`}>
                  {getUrgencyIcon(alert.urgency)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                      {alert.urgency.toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {alert.product?.name || alert.name}
                    </span>
                  </div>
                  <p className={`text-sm ${colors.text} mb-2`}>
                    {alert.message}
                  </p>
                  
                  {/* Détails du produit */}
                  {alert.product && (
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Stock actuel:</span> {alert.product.stock} unités
                      </div>
                      <div>
                        <span className="font-medium">Seuil:</span> {alert.product.reorderThreshold} unités
                      </div>
                      <div>
                        <span className="font-medium">Valeur stock:</span> {fmt(alert.product.stock * alert.product.sellingPrice)}
                      </div>
                      <div>
                        <span className="font-medium">Statut:</span> 
                        <span className="ml-1 capitalize">{alert.product.status}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions rapides */}
                  <div className="flex space-x-2">
                    <Link
                      to={`/stock/orders/new?productId=${alert.product?._id || alert.productId}`}
                      className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6z" />
                      </svg>
                      Commander
                    </Link>
                    <Link
                      to={`/products/${alert.product?._id || alert.productId}`}
                      className="inline-flex items-center px-3 py-1 bg-gray-600 text-white text-xs font-medium rounded hover:bg-gray-700 transition"
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Détails
                    </Link>
                    {onDismiss && (
                      <button
                        onClick={() => onDismiss(alert)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition"
                      >
                        Ignorer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Résumé des alertes */}
      {alerts.length > 1 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {alerts.length} alerte{alerts.length > 1 ? 's' : ''} de stock
            </span>
            <div className="flex space-x-4 text-xs">
              <span className="text-red-600">
                Critique: {alerts.filter(a => a.urgency === 'critical').length}
              </span>
              <span className="text-orange-600">
                Haute: {alerts.filter(a => a.urgency === 'high').length}
              </span>
              <span className="text-yellow-600">
                Moyenne: {alerts.filter(a => a.urgency === 'medium').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockAlert;
