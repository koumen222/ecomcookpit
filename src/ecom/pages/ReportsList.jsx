import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import { getCache, setCache } from '../utils/cacheUtils.js';

const ListSkeleton = ({ rows = 7 }) => (
  <div className="space-y-2">
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    ))}
  </div>
);

const ReportsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [reports, setReports] = useState([]);
  const [financialStats, setFinancialStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    dateStart: '',
    dateEnd: '',
    status: '',
    productId: ''
  });
  const [dateRangePreset, setDateRangePreset] = useState('all');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filter.dateStart) params.startDate = filter.dateStart;
      if (filter.dateEnd) params.endDate = filter.dateEnd;
      if (filter.status) params.status = filter.status;
      if (filter.productId) params.productId = filter.productId;
      
      // Charger les rapports (obligatoire)
      const reportsRes = await ecomApi.get('/reports', { params });
      const reportsData = reportsRes.data?.data?.reports || [];
      setReports(Array.isArray(reportsData) ? reportsData : []);

      // Charger les stats financières (optionnel - peut échouer pour certains rôles)
      try {
        const statsRes = await ecomApi.get('/reports/stats/financial', { params });
        setFinancialStats(statsRes.data?.data || {});
      } catch {
        setFinancialStats({});
      }
    } catch (error) {
      setError(getContextualError(error, 'load_stats'));
      console.error(error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) return;
    
    try {
      await ecomApi.delete(`/reports/${reportId}`);
      loadData();
    } catch (error) {
      setError(getContextualError(error, 'delete_order'));
      console.error(error);
    }
  };

  const formatCurrency = (amount) => {
    return `${(amount || 0).toLocaleString('fr-FR')} FCFA`;
  };

  // Stats calculées depuis les rapports chargés
  const totalReceived = reports.reduce((sum, r) => sum + (r.ordersReceived || 0), 0);
  const totalDelivered = reports.reduce((sum, r) => sum + (r.ordersDelivered || 0), 0);
  const totalAdSpend = reports.reduce((sum, r) => sum + (r.adSpend || 0), 0);
  const totalRevenue = financialStats.totalRevenue || reports.reduce((sum, r) => sum + (r.revenue || 0), 0);
  const totalProfit = financialStats.totalProfit || reports.reduce((sum, r) => sum + (r.profit || 0), 0);
  const totalProductCost = financialStats.totalProductCost || reports.reduce((sum, r) => sum + (r.productCost || 0), 0);
  const totalDeliveryCost = financialStats.totalDeliveryCost || reports.reduce((sum, r) => sum + (r.deliveryCost || 0), 0);
  const totalCost = financialStats.totalCost || reports.reduce((sum, r) => sum + (r.cost || 0), 0);
  const roas = financialStats.roas ?? (totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0);
  const deliveryRate = totalReceived > 0 ? ((totalDelivered / totalReceived) * 100).toFixed(1) : 0;

  const getReportProfit = (report) => {
    if ((report.profit || 0) !== 0) return report.profit || 0;
    const revenue = report.revenue || 0;
    const cost = report.cost || 0;
    if (revenue !== 0 || cost !== 0) return revenue - cost;
    return -(report.adSpend || 0);
  };

  const dayProfitMap = reports.reduce((acc, report) => {
    const dateKey = new Date(report.date).toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = { date: dateKey, profit: 0, reports: 0, delivered: 0, revenue: 0 };
    }
    acc[dateKey].profit += getReportProfit(report);
    acc[dateKey].reports += 1;
    acc[dateKey].delivered += report.ordersDelivered || 0;
    acc[dateKey].revenue += report.revenue || 0;
    return acc;
  }, {});

  const topProfitDays = Object.values(dayProfitMap)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  const agencyMap = reports.reduce((acc, report) => {
    (report.deliveries || []).forEach((delivery) => {
      const agencyName = (delivery.agencyName || '').trim();
      if (!agencyName) return;

      if (!acc[agencyName]) {
        acc[agencyName] = {
          agencyName,
          ordersDelivered: 0,
          deliveryCost: 0,
          reportsCount: 0
        };
      }

      acc[agencyName].ordersDelivered += delivery.ordersDelivered || 0;
      acc[agencyName].deliveryCost += delivery.deliveryCost || 0;
      acc[agencyName].reportsCount += 1;
    });
    return acc;
  }, {});

  const topAgencies = Object.values(agencyMap)
    .map((agency) => {
      const avgCostPerDelivery = agency.ordersDelivered > 0
        ? agency.deliveryCost / agency.ordersDelivered
        : 0;
      const efficiencyScore = avgCostPerDelivery > 0
        ? agency.ordersDelivered / avgCostPerDelivery
        : agency.ordersDelivered;

      return {
        ...agency,
        avgCostPerDelivery,
        efficiencyScore
      };
    })
    .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
    .slice(0, 3);

  const productMap = reports.reduce((acc, report) => {
    const productName = report.productId?.name || 'Produit inconnu';
    if (!acc[productName]) {
      acc[productName] = {
        productName,
        ordersDelivered: 0,
        revenue: 0,
        profit: 0,
        reportsCount: 0
      };
    }

    acc[productName].ordersDelivered += report.ordersDelivered || 0;
    acc[productName].revenue += report.revenue || 0;
    acc[productName].profit += getReportProfit(report);
    acc[productName].reportsCount += 1;
    return acc;
  }, {});

  const topProducts = Object.values(productMap)
    .sort((a, b) => b.ordersDelivered - a.ordersDelivered)
    .slice(0, 3);

  if (loading) return <ListSkeleton />;

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Rapports</h1>
        <div className="flex gap-2">
          <Link
            to="/ecom/stats/rapports"
            className="flex items-center gap-2 bg-emerald-700 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-emerald-800 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Stats produits
          </Link>
          <Link
            to="/ecom/reports/new"
            className="bg-emerald-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-emerald-700 text-sm"
          >
            + Nouveau
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Période</label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => {
                setDateRangePreset('all');
                setFilter(prev => ({ ...prev, dateStart: '', dateEnd: '' }));
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'all' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Toute la période
            </button>
            <button
              onClick={() => {
                setDateRangePreset('today');
                const today = new Date().toISOString().split('T')[0];
                setFilter(prev => ({ ...prev, dateStart: today, dateEnd: today }));
              }}
              className={`px-3 py-1.5 text-sm rounded-md ${dateRangePreset === 'today' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => {
                setDateRangePreset('week');
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setFilter(prev => ({ ...prev, dateStart: weekAgo.toISOString().split('T')[0], dateEnd: today.toISOString().split('T')[0] }));
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
                setFilter(prev => ({ ...prev, dateStart: firstDay.toISOString().split('T')[0], dateEnd: today.toISOString().split('T')[0] }));
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tous</option>
              <option value="validated">Validé</option>
              <option value="pending">En attente</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateRangePreset('all');
                setFilter({ dateStart: '', dateEnd: '', status: '', productId: '' });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard KPIs - masqué pour la closeuse */}
      {user?.role !== 'ecom_closeuse' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Chiffre d'affaires</p>
            <p className="text-base sm:text-xl font-bold text-emerald-600 mt-1">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Bénéfice net</p>
            <p className={`text-xl font-bold mt-1 ${(totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(totalProfit)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Frais livraison</p>
            <p className="text-base sm:text-xl font-bold text-yellow-600 mt-1">{fmt(totalDeliveryCost)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Dépenses pub</p>
            <p className="text-base sm:text-xl font-bold text-red-600 mt-1">{fmt(totalAdSpend)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">ROAS</p>
            <p className={`text-xl font-bold mt-1 ${roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {roas.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Stats commandes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Rapports</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{reports.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Cmd reçues</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{totalReceived}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Cmd livrées</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1">{totalDelivered}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Taux livraison</p>
          <div className="flex items-center mt-1">
            <p className={`text-xl sm:text-2xl font-bold ${deliveryRate >= 70 ? 'text-green-600' : deliveryRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {deliveryRate}%
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div 
              className={`h-1.5 rounded-full ${deliveryRate >= 70 ? 'bg-green-500' : deliveryRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(deliveryRate, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Insights rentabilité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Top 3 jours rentables</h3>
            <Link
              to="/ecom/reports/insights?tab=days"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
            >
              Voir plus
            </Link>
          </div>
          {topProfitDays.length > 0 ? (
            <div className="space-y-2">
              {topProfitDays.map((day, index) => (
                <div key={day.date} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{index + 1} {new Date(day.date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-gray-500">{day.delivered} livrées • {day.reports} rapport{day.reports > 1 ? 's' : ''}</p>
                  </div>
                  <p className={`text-sm font-semibold ${day.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(day.profit)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune donnée de rentabilité disponible</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Agences les plus efficaces</h3>
            <Link
              to="/ecom/reports/insights?tab=agencies"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
            >
              Voir plus
            </Link>
          </div>
          {topAgencies.length > 0 ? (
            <div className="space-y-2">
              {topAgencies.map((agency, index) => (
                <div key={agency.agencyName} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{index + 1} {agency.agencyName}</p>
                    <p className="text-xs text-gray-500">{agency.ordersDelivered} livrées • {agency.reportsCount} rapport{agency.reportsCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Coût moyen/livraison</p>
                    <p className="text-sm font-semibold text-emerald-700">{fmt(agency.avgCostPerDelivery)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune donnée d'agence disponible</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Top 3 produits</h3>
            <Link
              to="/ecom/stats/rapports"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
            >
              Voir plus
            </Link>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div key={`${product.productName}-${index}`} className="flex items-center justify-between border border-gray-100 rounded-md px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{index + 1} {product.productName}</p>
                    <p className="text-xs text-gray-500">{product.ordersDelivered} livrées • {product.reportsCount} rapport{product.reportsCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">CA</p>
                    <p className="text-sm font-semibold text-emerald-700">{fmt(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune donnée produit disponible</p>
          )}
        </div>
      </div>

      {/* Répartition coûts - masqué pour la closeuse */}
      {totalCost > 0 && user?.role !== 'ecom_closeuse' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition des coûts</h3>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
            <div 
              className="bg-red-500" 
              style={{ width: `${(totalProductCost / totalCost * 100)}%` }}
              title={`Produits: ${fmt(totalProductCost)}`}
            ></div>
            <div 
              className="bg-yellow-500" 
              style={{ width: `${(totalDeliveryCost / totalCost * 100)}%` }}
              title={`Livraison: ${fmt(totalDeliveryCost)}`}
            ></div>
            <div 
              className="bg-emerald-600" 
              style={{ width: `${(totalAdSpend / totalCost * 100)}%` }}
              title={`Pub: ${fmt(totalAdSpend)}`}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Produits {fmt(totalProductCost)}</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>Livraison {fmt(totalDeliveryCost)}</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-emerald-600 rounded-full mr-1"></span>Pub {fmt(totalAdSpend)}</span>
          </div>
        </div>
      )}

      {/* Liste des rapports */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reçues</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Livrées</th>
              {user?.role !== 'ecom_closeuse' && <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pub</th>}
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taux</th>
              <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.length === 0 ? (
              <tr>
                <td colSpan={user?.role === 'ecom_closeuse' ? 6 : 7} className="px-6 py-4 text-center text-gray-500">
                  Aucun rapport trouvé
                </td>
              </tr>
            ) : (
              reports.map((report) => {
                const rate = report.ordersReceived > 0 
                  ? ((report.ordersDelivered / report.ordersReceived) * 100).toFixed(0) 
                  : 0;
                return (
                  <tr key={report._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/ecom/reports/${report._id}`} className="text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline">
                        {new Date(report.date).toLocaleDateString('fr-FR')}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.productId?._id ? (
                        <Link 
                          to={`/ecom/reports/product/${report.productId._id}`} 
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"
                          onClick={() => console.log('🔗 Navigation vers produit:', report.productId._id, 'Nom:', report.productId.name)}
                        >
                          {report.productId.name}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-900">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-emerald-600">{report.ordersReceived}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">{report.ordersDelivered}</div>
                    </td>
                    {user?.role !== 'ecom_closeuse' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{fmt(report.adSpend)}</div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        rate >= 70 ? 'bg-green-100 text-green-800' : rate >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {rate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/ecom/reports/${report._id}`}
                        className="text-emerald-700 hover:text-emerald-900 mr-3"
                      >
                        Voir
                      </Link>
                      {(user.role === 'ecom_admin' || user.role === 'ecom_closeuse') && (
                        <>
                          <Link
                            to={`/ecom/reports/${report._id}/edit`}
                            className="text-emerald-600 hover:text-emerald-900 mr-3"
                          >
                            Modifier
                          </Link>
                          <button
                            onClick={() => deleteReport(report._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
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

export default ReportsList;
