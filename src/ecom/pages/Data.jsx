import React, { useEffect, useState } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const Data = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();

  const [overview, setOverview] = useState(null);
  const [txSummary, setTxSummary] = useState(null);
  const [stockOverview, setStockOverview] = useState(null);
  const [stockAlerts, setStockAlerts] = useState(null);
  const [productsStats, setProductsStats] = useState(null);
  const [stockLocationsSummary, setStockLocationsSummary] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        setAiAnalysis('');

        const params = { ...dateRange };
        const results = await Promise.allSettled([
          ecomApi.get('/reports/overview', { params }),
          ecomApi.get('/transactions/summary', { params }),
          ecomApi.get('/stock/overview'),
          ecomApi.get('/stock/alerts'),
          ecomApi.get('/products/stats/overview'),
          ecomApi.get('/stock-locations/summary')
        ]);

        const getData = (idx) => {
          const r = results[idx];
          if (!r || r.status !== 'fulfilled') return null;
          return r.value?.data?.data ?? null;
        };

        const overviewData = getData(0);
        setOverview(overviewData);
        setTxSummary(getData(1));
        setStockOverview(getData(2));
        setStockAlerts(getData(3));
        setProductsStats(getData(4));
        setStockLocationsSummary(getData(5));

        const overviewResult = results[0];
        if (!overviewData && overviewResult?.status === 'rejected') {
          setError(overviewResult.reason?.response?.data?.message || 'Impossible de charger les données');
        }
      } catch (err) {
        setOverview(null);
        setTxSummary(null);
        setStockOverview(null);
        setStockAlerts(null);
        setProductsStats(null);
        setStockLocationsSummary(null);
        setError(err.response?.data?.message || 'Impossible de charger les données');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [dateRange.startDate, dateRange.endDate]);

  const handleAnalyzeGlobal = async () => {
    try {
      setAnalyzing(true);
      setError('');

      const res = await ecomApi.post(
        '/reports/analyze-global',
        { startDate: dateRange.startDate, endDate: dateRange.endDate },
        { timeout: 120000 }
      );
      const analysis = res.data?.data?.analysis || '';
      setAiAnalysis(analysis);
    } catch (err) {
      setAiAnalysis('');
      setError(err.response?.data?.message || 'Erreur lors de l\'analyse ChatGPT');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const pct = (ratio) => `${((ratio || 0) * 100).toFixed(1)}%`;
  const num = (value) => (value || 0).toLocaleString('fr-FR');

  const kpis = overview?.kpis;
  const ordersByStatus = overview?.orders?.byStatus || [];
  const topProducts = overview?.topProducts || [];
  const daily = overview?.daily || [];

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Data</h1>
          <p className="text-sm text-gray-600 mt-1">Analyse globale des performances</p>
          {user?.role === 'ecom_closeuse' && (
            <p className="text-xs text-gray-500 mt-1">Certaines données peuvent être limitées selon ton accès.</p>
          )}
        </div>
        <button
          onClick={handleAnalyzeGlobal}
          disabled={analyzing || !overview?.kpis}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
            analyzing || !overview?.kpis
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
          }`}
        >
          {analyzing ? 'Analyse en cours…' : 'Analyser avec ChatGPT'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Période</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date début</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date fin</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setDateRange({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
              })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              30 derniers jours
            </button>
          </div>
        </div>
      </div>

      {kpis ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Chiffre d'affaires</p>
                <p className="text-base sm:text-lg font-bold text-blue-600 mt-1">{fmt(kpis.totalRevenue)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Bénéfice net</p>
                <p className={`text-base sm:text-lg font-bold mt-1 ${(kpis.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(kpis.totalProfit)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Coûts totaux</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{fmt(kpis.totalCost)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">ROAS</p>
                <p className={`text-base sm:text-lg font-bold mt-1 ${(kpis.roas || 0) >= 3 ? 'text-green-600' : (kpis.roas || 0) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>{(kpis.roas || 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Cmd reçues</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(kpis.totalOrdersReceived)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Cmd livrées</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(kpis.totalOrdersDelivered)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Taux livraison</p>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{pct(kpis.deliveryRate)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Dépenses pub</p>
                <p className="text-base sm:text-lg font-bold text-red-600 mt-1">{fmt(kpis.totalAdSpend)}</p>
              </div>
            </div>

            {aiAnalysis && (
              <div className="mt-4 border border-gray-200 rounded-lg p-3 sm:p-4 bg-white">
                <p className="text-xs font-semibold text-gray-700 mb-2">Analyse ChatGPT</p>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{aiAnalysis}</div>
              </div>
            )}
          </div>

          {(txSummary || stockOverview || productsStats || stockAlerts || stockLocationsSummary) && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Autres chiffres</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                {txSummary && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Entrées (transactions)</p>
                      <p className="text-base sm:text-lg font-bold text-green-700 mt-1">{fmt(txSummary.totalIncome)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Sorties (transactions)</p>
                      <p className="text-base sm:text-lg font-bold text-red-700 mt-1">{fmt(txSummary.totalExpense)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Solde (transactions)</p>
                      <p className={`text-base sm:text-lg font-bold mt-1 ${(txSummary.balance || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(txSummary.balance)}</p>
                    </div>
                  </>
                )}

                {stockOverview && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Produits actifs</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockOverview.totalProducts)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Stock total</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockOverview.totalStock)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Valeur stock</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{fmt(stockOverview.totalStockValue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Ruptures</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockOverview.outOfStockCount)}</p>
                    </div>
                  </>
                )}

                {stockAlerts?.summary && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Stock bas</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockAlerts.summary.lowStockCount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Retards transit</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockAlerts.summary.delayedOrdersCount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Arrivées (48h)</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockAlerts.summary.upcomingOrdersCount)}</p>
                    </div>
                  </>
                )}

                {productsStats && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-gray-500 uppercase">Total produits (stats)</p>
                    <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(productsStats.totalActiveProducts)}</p>
                  </div>
                )}

                {stockLocationsSummary?.totals && (
                  <>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Stock (emplacements)</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockLocationsSummary.totals.totalQuantity)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Valeur (emplacements)</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{fmt(stockLocationsSummary.totals.totalValue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Villes</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockLocationsSummary.totals.citiesCount)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium text-gray-500 uppercase">Agences</p>
                      <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">{num(stockLocationsSummary.totals.agenciesCount)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {ordersByStatus.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Commandes par statut</h3>
              <div className="flex flex-wrap gap-2">
                {ordersByStatus.map((s) => (
                  <div key={s.status} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-[10px] uppercase text-gray-500 font-medium">{s.status}</p>
                    <p className="text-sm font-semibold text-gray-900">{num(s.count)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topProducts.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top produits (profit)</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reçues</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Livrées</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Taux</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CA</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pub</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROAS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topProducts.map((p) => (
                    <tr key={p._id}>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(p.ordersReceived)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(p.ordersDelivered)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{pct(p.deliveryRate)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(p.revenue)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(p.adSpend)}</td>
                      <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${(p.profit || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(p.profit)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{(p.roas || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {daily.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendance jour par jour</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reçues</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Livrées</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Taux</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CA</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pub</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROAS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {daily.slice(-31).map((d) => (
                    <tr key={d._id}>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{d._id}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(d.ordersReceived)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(d.ordersDelivered)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{pct(d.deliveryRate)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(d.revenue)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(d.adSpend)}</td>
                      <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${(d.profit || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(d.profit)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{(d.roas || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Array.isArray(productsStats?.byStatus) && productsStats.byStatus.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Produits par statut</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produits</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valeur stock</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marge moyenne</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productsStats.byStatus.map((s) => (
                    <tr key={s._id}>
                      <td className="px-3 py-2 text-sm text-gray-900">{s._id}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(s.count)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(s.totalStock)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(s.totalValue)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(s.avgMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Array.isArray(txSummary?.byCategory) && txSummary.byCategory.length > 0 && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Transactions par catégorie</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nb</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {txSummary.byCategory.slice(0, 20).map((c, idx) => (
                    <tr key={`${c._id?.type || 't'}_${c._id?.category || 'c'}_${idx}`}>
                      <td className="px-3 py-2 text-sm text-gray-900">{c._id?.type}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{c._id?.category}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{fmt(c.total)}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{num(c.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stockAlerts && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Alertes stock (détails)</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {Array.isArray(stockAlerts.lowStockProducts) && stockAlerts.lowStockProducts.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Produits en stock bas</p>
                    <div className="space-y-2">
                      {stockAlerts.lowStockProducts.slice(0, 12).map((p) => (
                        <div key={p._id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-800 truncate">{p.name}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{num(p.stock)} / {num(p.reorderThreshold)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(stockAlerts.delayedOrders) && stockAlerts.delayedOrders.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Commandes de stock en retard</p>
                    <div className="space-y-2">
                      {stockAlerts.delayedOrders.slice(0, 10).map((o) => (
                        <div key={o._id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-800 truncate">{o.productId?.name || o.productName || 'Produit'}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{num(o.delayDays)} j</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stockLocationsSummary?.totals && (
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 overflow-x-auto">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock par emplacement (résumé)</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                {Array.isArray(stockLocationsSummary.byCity) && stockLocationsSummary.byCity.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Top villes</p>
                    <div className="space-y-2">
                      {stockLocationsSummary.byCity.slice(0, 10).map((c) => (
                        <div key={c._id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-800 truncate">{c._id || 'N/A'}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{num(c.totalQuantity)} / {fmt(c.totalValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(stockLocationsSummary.byAgency) && stockLocationsSummary.byAgency.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Top agences</p>
                    <div className="space-y-2">
                      {stockLocationsSummary.byAgency.slice(0, 10).map((a) => (
                        <div key={a._id} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-800 truncate">{a._id || 'N/A'}</span>
                          <span className="text-xs text-gray-600 whitespace-nowrap">{num(a.totalQuantity)} / {fmt(a.totalValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Aucune donnée disponible (ou accès insuffisant).</p>
        </div>
      )}
    </div>
  );
};

export default Data;
