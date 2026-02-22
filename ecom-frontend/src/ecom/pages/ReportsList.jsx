import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const ReportsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [reports, setReports] = useState([]);
  const [financialStats, setFinancialStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    date: '',
    status: ''
  });

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (filter.date) params.date = filter.date;
      if (filter.status) params.status = filter.status;
      
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
      setError('Erreur lors du chargement des rapports');
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
      setError('Erreur lors de la suppression du rapport');
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
  const deliveryRate = totalReceived > 0 ? ((totalDelivered / totalReceived) * 100).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Rapports</h1>
        <Link
          to="/ecom/reports/new"
          className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 text-sm"
        >
          + Nouveau
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Dashboard KPIs - masqué pour la closeuse */}
      {user?.role !== 'ecom_closeuse' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Chiffre d'affaires</p>
            <p className="text-base sm:text-xl font-bold text-blue-600 mt-1">{fmt(financialStats.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Bénéfice net</p>
            <p className={`text-xl font-bold mt-1 ${(financialStats.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(financialStats.totalProfit)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Dépenses pub</p>
            <p className="text-base sm:text-xl font-bold text-red-600 mt-1">{fmt(totalAdSpend)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase">ROAS</p>
            <p className={`text-xl font-bold mt-1 ${(financialStats.roas || 0) >= 3 ? 'text-green-600' : (financialStats.roas || 0) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
              {financialStats.roas?.toFixed(2) || '0.00'}
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
          <p className="text-xl sm:text-2xl font-bold text-blue-600 mt-1">{totalReceived}</p>
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

      {/* Répartition coûts - masqué pour la closeuse */}
      {financialStats.totalCost > 0 && user?.role !== 'ecom_closeuse' && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Répartition des coûts</h3>
          <div className="flex h-4 rounded-full overflow-hidden bg-gray-200">
            <div 
              className="bg-red-500" 
              style={{ width: `${(financialStats.totalProductCost / financialStats.totalCost * 100)}%` }}
              title={`Produits: ${fmt(financialStats.totalProductCost)}`}
            ></div>
            <div 
              className="bg-yellow-500" 
              style={{ width: `${(financialStats.totalDeliveryCost / financialStats.totalCost * 100)}%` }}
              title={`Livraison: ${fmt(financialStats.totalDeliveryCost)}`}
            ></div>
            <div 
              className="bg-purple-500" 
              style={{ width: `${(financialStats.totalAdSpend / financialStats.totalCost * 100)}%` }}
              title={`Pub: ${fmt(financialStats.totalAdSpend)}`}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Produits {fmt(financialStats.totalProductCost)}</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>Livraison {fmt(financialStats.totalDeliveryCost)}</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-purple-500 rounded-full mr-1"></span>Pub {fmt(financialStats.totalAdSpend)}</span>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={filter.date}
              onChange={(e) => setFilter(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Tous</option>
              <option value="validated">Validé</option>
              <option value="pending">En attente</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilter({ date: '', status: '' })}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

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
                      <Link to={`/ecom/reports/${report._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                        {new Date(report.date).toLocaleDateString('fr-FR')}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.productId?._id ? (
                        <Link to={`/ecom/products/${report.productId._id}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline">{report.productId.name}</Link>
                      ) : (
                        <span className="text-sm text-gray-900">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-blue-600">{report.ordersReceived}</div>
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
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Voir
                      </Link>
                      {(user.role === 'ecom_admin' || user.role === 'ecom_closeuse') && (
                        <>
                          <Link
                            to={`/ecom/reports/${report._id}/edit`}
                            className="text-blue-600 hover:text-blue-900 mr-3"
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
