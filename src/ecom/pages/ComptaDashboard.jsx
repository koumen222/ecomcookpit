import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const ComptaDashboard = () => {
  const { user, logout } = useEcomAuth();
  const { fmt } = useMoney();
  const [financialStats, setFinancialStats] = useState({});
  const [productStats, setProductStats] = useState([]);
  const [txSummary, setTxSummary] = useState({});
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadFinancialData();
  }, [dateRange]);

  const loadFinancialData = async () => {
    try {
      setLoadingStats(true);
      
      const [statsRes, productsRes, txSummaryRes, txListRes] = await Promise.all([
        ecomApi.get('/reports/stats/financial', { params: dateRange }).catch(() => ({ data: { data: {} } })),
        ecomApi.get('/products/stats/overview').catch(() => ({ data: { data: { byStatus: [] } } })),
        ecomApi.get('/transactions/summary', { params: { startDate: dateRange.startDate, endDate: dateRange.endDate } }).catch(() => ({ data: { data: {} } })),
        ecomApi.get('/transactions', { params: { startDate: dateRange.startDate, endDate: dateRange.endDate, limit: 5 } }).catch(() => ({ data: { data: { transactions: [] } } }))
      ]);

      setFinancialStats(statsRes.data.data || {});
      setProductStats(productsRes.data.data?.byStatus || []);
      setTxSummary(txSummaryRes.data.data || {});
      setRecentTransactions(txListRes.data.data?.transactions || []);
    } catch (error) {
      console.error('Erreur chargement données financières:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF'
    }).format(amount || 0);
  };

  const formatPercent = (value) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getProfitColor = (value) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getROASColor = (value) => {
    if (value >= 3) return 'text-green-600';
    if (value >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loadingStats && !financialStats.totalRevenue && !txSummary.totalIncome) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Actions rapides */}
        <div className="mb-4 sm:mb-8 bg-white rounded-lg shadow">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Actions rapides</h3>
          </div>
          <div className="p-3 sm:p-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <Link to="/ecom/transactions/new"
                className="px-3 py-2.5 sm:px-4 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-center font-medium text-xs sm:text-sm block">
                + Transaction
              </Link>
              <Link to="/ecom/transactions"
                className="px-3 py-2.5 sm:px-4 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center font-medium text-xs sm:text-sm block">
                Transactions
              </Link>
              <Link to="/ecom/reports"
                className="px-3 py-2.5 sm:px-4 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-center font-medium text-xs sm:text-sm block">
                Rapports
              </Link>
            </div>
          </div>
        </div>

        {/* Sélecteur de période */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Période d'analyse</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateRange({
                    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    endDate: new Date().toISOString().split('T')[0]
                  });
                }}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                30 derniers jours
              </button>
            </div>
          </div>
        </div>

        {/* KPIs Principaux */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-4 sm:mb-8">
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">F</span>
                </div>
              </div>
              <div className="sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Chiffre d'Affaires</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {fmt(financialStats.totalRevenue)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">-</span>
                </div>
              </div>
              <div className="sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Coûts Totaux</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900">
                  {fmt(financialStats.totalCost)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">+</span>
                </div>
              </div>
              <div className="sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Bénéfice Net</p>
                <p className={`text-lg sm:text-2xl font-bold ${getProfitColor(financialStats.totalProfit)}`}>
                  {fmt(financialStats.totalProfit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 hidden sm:block">
                <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">%</span>
                </div>
              </div>
              <div className="sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">Marge Nette</p>
                <p className={`text-lg sm:text-2xl font-bold ${getProfitColor(financialStats.totalProfit / financialStats.totalRevenue)}`}>
                  {financialStats.totalRevenue > 0 ? 
                    formatPercent(financialStats.totalProfit / financialStats.totalRevenue) : '0%'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Détail des coûts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-4 sm:mb-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Répartition des Coûts</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Coûts Produits</span>
                    <span className="font-semibold">{fmt(financialStats.totalProductCost)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${financialStats.totalCost > 0 ? (financialStats.totalProductCost / financialStats.totalCost) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Coûts Livraison</span>
                    <span className="font-semibold">{fmt(financialStats.totalDeliveryCost)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${financialStats.totalCost > 0 ? (financialStats.totalDeliveryCost / financialStats.totalCost) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Dépenses Pub</span>
                    <span className="font-semibold">{fmt(financialStats.totalAdSpend)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${financialStats.totalCost > 0 ? (financialStats.totalAdSpend / financialStats.totalCost) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Indicateurs de performance */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Indicateurs de Performance</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">ROAS (Return on Ad Spend)</span>
                  <span className={`font-semibold ${getROASColor(financialStats.roas)}`}>
                    {financialStats.roas?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taux de Livraison</span>
                  <span className="font-semibold">{formatPercent(financialStats.deliveryRate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Commandes Totales</span>
                  <span className="font-semibold">{financialStats.totalOrdersDelivered || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Panier Moyen</span>
                  <span className="font-semibold">
                    {fmt(financialStats.totalOrdersDelivered > 0 ? 
                      financialStats.totalRevenue / financialStats.totalOrdersDelivered : 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Coût par Commande</span>
                  <span className="font-semibold">
                    {fmt(financialStats.totalOrdersDelivered > 0 ? 
                      financialStats.totalCost / financialStats.totalOrdersDelivered : 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statuts des produits */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Produits par Statut</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              {['test', 'stable', 'winner', 'pause', 'stop'].map((status) => {
                const statusData = productStats.find(s => s._id === status);
                return (
                  <div key={status} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600 capitalize">{status}</span>
                      <span className="text-2xl font-bold text-gray-900">
                        {statusData?.count || 0}
                      </span>
                    </div>
                    {statusData && (
                      <div className="text-xs text-gray-500">
                        <div>Stock total: {statusData.totalStock || 0}</div>
                        <div>Marge moyenne: {fmt(statusData.avgMargin || 0)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bilan Transactions */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Flux de Trésorerie</h3>
            <Link to="/ecom/transactions" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
              Voir tout &rarr;
            </Link>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-green-700 uppercase">Entrées</p>
                <p className="text-xl font-bold text-green-600 mt-1">{fmt(txSummary.totalIncome)}</p>
                <p className="text-xs text-green-500 mt-1">{txSummary.incomeCount || 0} transactions</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-xs font-medium text-red-700 uppercase">Dépenses</p>
                <p className="text-xl font-bold text-red-600 mt-1">{fmt(txSummary.totalExpense)}</p>
                <p className="text-xs text-red-500 mt-1">{txSummary.expenseCount || 0} transactions</p>
              </div>
              <div className={`rounded-lg p-4 text-center ${(txSummary.balance || 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <p className={`text-xs font-medium uppercase ${(txSummary.balance || 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Solde</p>
                <p className={`text-xl font-bold mt-1 ${(txSummary.balance || 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {fmt(txSummary.balance)}
                </p>
                <p className={`text-xs mt-1 ${(txSummary.balance || 0) >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  {(txSummary.balance || 0) >= 0 ? 'Excédent' : 'Déficit'}
                </p>
              </div>
            </div>

            {/* Dernières transactions */}
            {recentTransactions.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Dernières transactions</h4>
                <div className="space-y-2">
                  {recentTransactions.map(tx => (
                    <Link key={tx._id} to={`/ecom/transactions/${tx._id}`} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded -mx-2 px-2 transition">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${tx.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <div>
                          <p className="text-sm text-blue-700 hover:text-blue-900">{tx.description || tx.category}</p>
                          <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>


        {/* Informations importantes */}
        <div className="mt-8 bg-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-3">ℹ️ Informations Comptables</h3>
          <div className="space-y-2 text-sm text-purple-800">
            <p>• <strong>Période actuelle:</strong> Du {new Date(dateRange.startDate).toLocaleDateString('fr-FR')} 
               au {new Date(dateRange.endDate).toLocaleDateString('fr-FR')}</p>
            <p>• <strong>Méthode de calcul:</strong> Comptabilité d'engagement sur commandes livrées</p>
            <p>• <strong>Coûts inclus:</strong> Coûts produits + frais de livraison + dépenses publicitaires</p>
            <p>• <strong>ROAS idéal:</strong> Supérieur à 3.0 (3 FCFA de CA pour 1 FCFA dépensé en pub)</p>
            <p>• <strong>Taux de livraison minimum:</strong> 70% pour maintenir la rentabilité</p>
          </div>
        </div>
    </div>
  );
};

export default ComptaDashboard;
