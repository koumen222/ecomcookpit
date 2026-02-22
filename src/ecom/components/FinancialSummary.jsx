import React from 'react';
import { useMoney } from '../hooks/useMoney.js';

const FinancialSummary = ({ data, loading = false, showDetails = true }) => {
  const { fmt } = useMoney();

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getProfitColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getROASColor = (value) => {
    if (value >= 3) return 'text-green-600';
    if (value >= 2) return 'text-yellow-600';
    if (value >= 1) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMarginColor = (value) => {
    if (value >= 0.3) return 'text-green-600'; // 30%+
    if (value >= 0.2) return 'text-yellow-600'; // 20-30%
    if (value >= 0.1) return 'text-orange-600'; // 10-20%
    return 'text-red-600'; // <10%
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const profitMargin = data.totalRevenue > 0 ? data.totalProfit / data.totalRevenue : 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Résumé Financier</h3>
      </div>
      
      <div className="p-6">
        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{fmt(data.totalRevenue)}</div>
            <p className="text-sm text-gray-500">Chiffre d'Affaires</p>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold mb-1 ${getProfitColor(data.totalProfit)}`}>
              {fmt(data.totalProfit)}
            </div>
            <p className="text-sm text-gray-500">Bénéfice Net</p>
          </div>
        </div>

        {/* Détail des coûts */}
        {showDetails && (
          <>
            <div className="border-t border-gray-100 pt-6 mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Détail des Coûts</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-gray-700">Coûts Produits</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {fmt(data.totalProductCost)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-gray-700">Coûts Livraison</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {fmt(data.totalDeliveryCost)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                    <span className="text-gray-700">Dépenses Pub</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {fmt(data.totalAdSpend)}
                  </span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Coûts Totaux</span>
                    <span className="font-bold text-red-600">
                      {fmt(data.totalCost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Barre de répartition des coûts */}
              {data.totalCost > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="flex h-full">
                      <div 
                        className="bg-red-500"
                        style={{ width: `${(data.totalProductCost / data.totalCost) * 100}%` }}
                        title="Coûts Produits"
                      ></div>
                      <div 
                        className="bg-yellow-500"
                        style={{ width: `${(data.totalDeliveryCost / data.totalCost) * 100}%` }}
                        title="Coûts Livraison"
                      ></div>
                      <div 
                        className="bg-purple-500"
                        style={{ width: `${(data.totalAdSpend / data.totalCost) * 100}%` }}
                        title="Dépenses Pub"
                      ></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Produits</span>
                    <span>Livraison</span>
                    <span>Pub</span>
                  </div>
                </div>
              )}
            </div>

            {/* Indicateurs de performance */}
            <div className="border-t border-gray-100 pt-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">Indicateurs de Performance</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">ROAS</span>
                    <span className={`font-bold ${getROASColor(data.roas)}`}>
                      {data.roas?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {data.roas >= 3 ? '✅ Excellent' : 
                     data.roas >= 2 ? '⚠️ Bon' : 
                     data.roas >= 1 ? '❌ Faible' : '🚨 Critique'}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Marge Nette</span>
                    <span className={`font-bold ${getMarginColor(profitMargin)}`}>
                      {formatPercent(profitMargin)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {profitMargin >= 0.3 ? '✅ Excellente' : 
                     profitMargin >= 0.2 ? '⚠️ Bonne' : 
                     profitMargin >= 0.1 ? '❌ Faible' : '🚨 Critique'}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Taux de Livraison</span>
                    <span className={`font-bold ${data.deliveryRate >= 0.7 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercent(data.deliveryRate)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {data.deliveryRate >= 0.8 ? '✅ Excellent' : 
                     data.deliveryRate >= 0.7 ? '⚠️ Acceptable' : '🚨 Critique'}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Panier Moyen</span>
                    <span className="font-bold text-gray-900">
                      {fmt(data.totalOrdersDelivered > 0 ? data.totalRevenue / data.totalOrdersDelivered : 0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {data.totalOrdersDelivered} commande{data.totalOrdersDelivered > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Recommandations */}
        {showDetails && (
          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">💡 Recommandations</h4>
            <div className="space-y-2 text-sm">
              {data.roas < 2 && (
                <div className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span className="text-gray-700">ROAS faible ({data.roas?.toFixed(2)}). Optimisez vos campagnes publicitaires.</span>
                </div>
              )}
              {data.deliveryRate < 0.7 && (
                <div className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span className="text-gray-700">Taux de livraison faible ({formatPercent(data.deliveryRate)}). Améliorez la logistique.</span>
                </div>
              )}
              {profitMargin < 0.1 && profitMargin > 0 && (
                <div className="flex items-start">
                  <span className="text-yellow-600 mr-2">•</span>
                  <span className="text-gray-700">Marge faible ({formatPercent(profitMargin)}). Augmentez les prix ou réduisez les coûts.</span>
                </div>
              )}
              {data.totalProfit < 0 && (
                <div className="flex items-start">
                  <span className="text-red-600 mr-2">•</span>
                  <span className="text-gray-700">Perte nette de {fmt(Math.abs(data.totalProfit))}. Action corrective requise.</span>
                </div>
              )}
              {data.roas >= 3 && data.deliveryRate >= 0.8 && profitMargin >= 0.2 && (
                <div className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span className="text-gray-700">Excellentes performances! Considérez le scaling.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialSummary;
