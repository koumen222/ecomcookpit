import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const ProductReportDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState('all');
  const [filter, setFilter] = useState({
    dateStart: '',
    dateEnd: ''
  });

  useEffect(() => {
    loadProductReport();
  }, [productId, filter]);

  const loadProductReport = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('📊 Chargement rapport produit:', productId);
      
      const params = { productId };
      if (filter.dateStart) params.dateStart = filter.dateStart;
      if (filter.dateEnd) params.dateEnd = filter.dateEnd;

      // Charger les infos du produit
      const productRes = await ecomApi.get(`/products/${productId}`);
      setProduct(productRes.data?.data || productRes.data);

      // Charger les stats du produit
      const statsRes = await ecomApi.get('/reports/product-stats', { params });
      const productData = statsRes.data?.data || {};
      setStats(productData.stats || {});
      setHistoricalData(productData.reports || []);
    } catch (err) {
      console.error('❌ Erreur chargement rapport produit:', err);
      
      if (err.response?.status === 404) {
        setError('Produit non trouvé');
      } else if (err.response?.status === 400) {
        setError('ID de produit invalide');
      } else if (err.response?.status === 500) {
        setError('Erreur serveur - Veuillez réessayer plus tard');
      } else {
        setError('Erreur lors du chargement du rapport produit');
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Reçues', 'Livrées', 'Taux %', 'Pub', 'CA', 'Bénéfice'];
    const rows = historicalData.map(item => [
      new Date(item.date).toLocaleDateString('fr-FR'),
      item.ordersReceived || 0,
      item.ordersDelivered || 0,
      item.ordersReceived > 0 ? ((item.ordersDelivered / item.ordersReceived) * 100).toFixed(1) : 0,
      item.adSpend || 0,
      item.revenue || 0,
      item.profit || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_${product?.name || 'produit'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getDeliveryRateColor = (rate) => {
    if (rate >= 75) return 'text-green-600 bg-green-100';
    if (rate >= 50) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getDeliveryRateBadge = (rate) => {
    if (rate >= 75) return { color: 'bg-green-500', label: 'Excellent' };
    if (rate >= 50) return { color: 'bg-orange-500', label: 'Moyen' };
    return { color: 'bg-red-500', label: 'Faible' };
  };

  if (loading) return (
    <div className="p-4 sm:p-6">
      <div className="h-8 w-52 bg-gray-200 rounded-lg animate-pulse mb-6" />
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );

  if (!product) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          Produit non trouvé
        </div>
      </div>
    );
  }

  const deliveryRate = stats.totalReceived > 0 
    ? ((stats.totalDelivered / stats.totalReceived) * 100).toFixed(1) 
    : 0;
  const roas = stats.totalAdSpend > 0 
    ? (stats.totalRevenue / stats.totalAdSpend).toFixed(2) 
    : 0;
  const badge = getDeliveryRateBadge(parseFloat(deliveryRate));
  const chartData = [...historicalData]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7);
  const maxOrders = Math.max(...chartData.map(d => d.ordersReceived || 0), 0);
  const maxRevenue = Math.max(...chartData.map(d => d.revenue || 0), 0);

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => navigate('/ecom/reports')}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Rapport détaillé : {product.name}
          </h1>
        </div>
        <p className="text-sm text-gray-500 ml-7">
          Analyse complète des performances du produit
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filtre période */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Période d'analyse</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setDateRangePreset('all');
                setFilter({ dateStart: '', dateEnd: '' });
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Toute la période
            </button>
            <button
              onClick={() => {
                setDateRangePreset('week');
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setFilter({ dateStart: weekAgo.toISOString().split('T')[0], dateEnd: today.toISOString().split('T')[0] });
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'week' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              7 derniers jours
            </button>
            <button
              onClick={() => {
                setDateRangePreset('month');
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                setFilter({ dateStart: firstDay.toISOString().split('T')[0], dateEnd: today.toISOString().split('T')[0] });
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'month' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Ce mois
            </button>
            <button
              onClick={() => {
                setDateRangePreset('custom');
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'custom' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Personnalisé
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date début</label>
            <input
              type="date"
              value={filter.dateStart}
              onChange={(e) => {
                setDateRangePreset('custom');
                setFilter(prev => ({ ...prev, dateStart: e.target.value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label>
            <input
              type="date"
              value={filter.dateEnd}
              onChange={(e) => {
                setDateRangePreset('custom');
                setFilter(prev => ({ ...prev, dateEnd: e.target.value }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              📥 Exporter CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Commandes reçues</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalReceived || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Commandes livrées</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalDelivered || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Taux de livraison</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-2xl font-bold ${deliveryRate >= 75 ? 'text-green-600' : deliveryRate >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
              {deliveryRate}%
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color} text-white`}>
              {badge.label}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full ${deliveryRate >= 75 ? 'bg-green-500' : deliveryRate >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(deliveryRate, 100)}%` }}
            ></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Quantité vendue</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.totalQuantity || 0}</p>
        </div>
      </div>

      {/* KPIs Financiers - masqué pour closeuse */}
      {user?.role !== 'ecom_closeuse' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{fmt(stats.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Dépenses pub</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{fmt(stats.totalAdSpend)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">Bénéfice net</p>
            <p className={`text-2xl font-bold mt-1 ${(stats.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(stats.totalProfit)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs font-medium text-gray-500 uppercase">ROAS</p>
            <p className={`text-2xl font-bold mt-1 ${roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {roas}
            </p>
          </div>
        </div>
      )}

      {/* Graphiques simples (texte pour l'instant - à remplacer par Chart.js) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Évolution des commandes</h3>
          <div className="h-48 flex items-end justify-around gap-1">
            {chartData.map((item, idx) => {
              const height = maxOrders > 0 ? ((item.ordersReceived || 0) / maxOrders) * 100 : 0;
              return (
                <div key={idx} className="flex-1 h-full flex flex-col items-center">
                  <div className="w-full flex-1 flex items-end">
                    <div className="w-full bg-emerald-600 rounded-t" style={{ height: `${Math.max(height, 2)}%` }}></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">{new Date(item.date).getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {user?.role !== 'ecom_closeuse' && (
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Évolution du CA</h3>
            <div className="h-48 flex items-end justify-around gap-1">
              {chartData.map((item, idx) => {
                const height = maxRevenue > 0 ? ((item.revenue || 0) / maxRevenue) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 h-full flex flex-col items-center">
                    <div className="w-full flex-1 flex items-end">
                      <div className="w-full bg-green-500 rounded-t" style={{ height: `${Math.max(height, 2)}%` }}></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{new Date(item.date).getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tableau historique */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Historique détaillé</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reçues</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Livrées</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taux</th>
              {user?.role !== 'ecom_closeuse' && (
                <>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pub</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéfice</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {historicalData.length === 0 ? (
              <tr>
                <td colSpan={user?.role === 'ecom_closeuse' ? 4 : 7} className="px-6 py-8 text-center text-gray-500">
                  Aucune donnée disponible pour cette période
                </td>
              </tr>
            ) : (
              historicalData.map((item) => {
                const rate = item.ordersReceived > 0 
                  ? ((item.ordersDelivered / item.ordersReceived) * 100).toFixed(1) 
                  : 0;
                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      {item.ordersReceived || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      {item.ordersDelivered || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        rate >= 75 ? 'bg-green-100 text-green-800' : rate >= 50 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                    {user?.role !== 'ecom_closeuse' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {fmt(item.adSpend)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                          {fmt(item.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          <span className={item.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {fmt(item.profit)}
                          </span>
                        </td>
                      </>
                    )}
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

export default ProductReportDetail;
