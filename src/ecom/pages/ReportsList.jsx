import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import { getCache, setCache } from '../utils/cacheUtils.js';
import {
  TrendingUp, Package, DollarSign, Truck, BarChart3,
  Zap, Plus, RefreshCw, Calendar, Filter, X,
  Crown, Medal, Award, ChevronRight, ArrowUpRight,
  ShoppingCart, CheckCircle2, AlertTriangle
} from 'lucide-react';

const ListSkeleton = ({ rows = 7 }) => (
  <div className="space-y-3 p-6">
    <div className="h-8 w-48 bg-gray-200 rounded-xl animate-pulse mb-6" />
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
        <div className="h-9 w-9 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
      </div>
    ))}
  </div>
);

const RankIcon = ({ rank }) => {
  if (rank === 1) return <Crown size={14} className="text-amber-500" />;
  if (rank === 2) return <Medal size={14} className="text-slate-400" />;
  return <Award size={14} className="text-orange-400" />;
};

const ReportsList = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [reports, setReports] = useState([]);
  const [financialStats, setFinancialStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoModal, setAutoModal] = useState(false);
  const [autoDate, setAutoDate] = useState(new Date().toISOString().split('T')[0]);
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoEndDate, setAutoEndDate] = useState('');
  const [autoMode, setAutoMode] = useState('day'); // 'day' | 'range'
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoResult, setAutoResult] = useState(null);
  const [autoStep, setAutoStep] = useState('config'); // 'config' | 'assign' | 'done'
  const [autoProducts, setAutoProducts] = useState([]); // catalogue
  const [autoMappings, setAutoMappings] = useState({}); // { orderProductName: productId }
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

  const openAutoModal = async () => {
    setAutoModal(true);
    setAutoResult(null);
    setAutoStep('config');
    setAutoMappings({});
    // Charger le catalogue produits
    try {
      const res = await ecomApi.get('/products', { params: { isActive: true, limit: 500 } });
      const list = res.data?.data?.products || res.data?.data || [];
      setAutoProducts(Array.isArray(list) ? list : []);
    } catch {
      setAutoProducts([]);
    }
  };

  const generateAutoReports = async (extraMappings = {}) => {
    try {
      setAutoLoading(true);
      setAutoResult(null);
      const dateBody = autoMode === 'day'
        ? { date: autoDate }
        : { startDate: autoStartDate, endDate: autoEndDate };
      const allMappings = Object.entries({ ...autoMappings, ...extraMappings })
        .filter(([, v]) => v)
        .map(([orderProductName, productId]) => ({ orderProductName, productId }));
      const body = { ...dateBody, ...(allMappings.length > 0 ? { mappings: allMappings } : {}) };
      const res = await ecomApi.post('/reports/auto-generate', body);
      setAutoResult(res.data);
      const unmatched = res.data?.data?.unmatched || [];
      if (unmatched.length > 0 && autoStep === 'config') {
        setAutoStep('assign');
      } else {
        setAutoStep('done');
        loadData();
      }
    } catch (err) {
      setAutoResult({ success: false, message: getContextualError(err, 'load_stats') });
    } finally {
      setAutoLoading(false);
    }
  };

  const confirmAssignments = () => {
    generateAutoReports(autoMappings);
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
    <div className="min-h-screen bg-gray-50/60 p-3 sm:p-5 lg:p-7">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Rapports</h1>
          <p className="text-sm text-gray-500 mt-0.5">{reports.length} rapport{reports.length !== 1 ? 's' : ''} chargé{reports.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/ecom/stats-rapports"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition shadow-sm"
          >
            <BarChart3 size={15} />
            Stats produits
          </Link>
          <button
            onClick={openAutoModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 transition shadow-sm"
          >
            <Zap size={15} />
            Rapport automatique
          </button>
          <Link
            to="/ecom/reports/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus size={15} />
            Nouveau
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {/* ─── Modal Rapport automatique ──────────────────────────────────── */}
      {autoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-gray-100">

            {/* Étape 1 : configuration date */}
            {autoStep === 'config' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Rapport automatique</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Génère depuis les commandes <strong>livrées</strong></p>
                  </div>
                  <button onClick={() => { setAutoModal(false); setAutoResult(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400">
                    <X size={18} />
                  </button>
                </div>

                <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                  <button onClick={() => setAutoMode('day')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${autoMode === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Un jour</button>
                  <button onClick={() => setAutoMode('range')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${autoMode === 'range' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Période</button>
                </div>

                {autoMode === 'day' ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input type="date" value={autoDate} onChange={e => setAutoDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Début</label>
                      <input type="date" value={autoStartDate} onChange={e => setAutoStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Fin</label>
                      <input type="date" value={autoEndDate} onChange={e => setAutoEndDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none" />
                    </div>
                  </div>
                )}

                {autoResult && !autoResult.success && (
                  <div className="rounded-xl px-4 py-3 mb-4 text-sm bg-red-50 border border-red-200 text-red-700">{autoResult.message}</div>
                )}

                <div className="flex gap-3 mt-2">
                  <button onClick={() => { setAutoModal(false); setAutoResult(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition">Annuler</button>
                  <button
                    onClick={() => generateAutoReports()}
                    disabled={autoLoading || (autoMode === 'range' && (!autoStartDate || !autoEndDate))}
                    className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {autoLoading ? 'Analyse...' : 'Générer'}
                  </button>
                </div>
              </>
            )}

            {/* Étape 2 : assigner les produits non reconnus */}
            {autoStep === 'assign' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => { setAutoStep('config'); setAutoResult(null); }} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-400">
                    <ChevronRight size={18} className="rotate-180" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Assigner les produits</h2>
                    <p className="text-xs text-gray-500">Produits non reconnus automatiquement</p>
                  </div>
                </div>

                {autoResult?.message && (
                  <div className="rounded-xl px-3 py-2.5 mb-4 text-xs bg-blue-50 border border-blue-200 text-blue-700">{autoResult.message}</div>
                )}

                <div className="space-y-3 mb-5">
                  {(autoResult?.data?.unmatched || []).map((item) => (
                    <div key={item.productName} className="border border-gray-200 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.totalDelivered} commande{item.totalDelivered > 1 ? 's' : ''} livrée{item.totalDelivered > 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">Non reconnu</span>
                      </div>
                      <select
                        value={autoMappings[item.productName] || ''}
                        onChange={e => setAutoMappings(prev => ({ ...prev, [item.productName]: e.target.value }))}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
                      >
                        <option value="">— Ignorer ce produit —</option>
                        {autoProducts.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => { setAutoModal(false); setAutoResult(null); loadData(); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition">Fermer</button>
                  <button
                    onClick={confirmAssignments}
                    disabled={autoLoading}
                    className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 text-sm font-medium disabled:opacity-50 transition"
                  >
                    {autoLoading ? 'Génération...' : 'Confirmer et générer'}
                  </button>
                </div>
              </>
            )}

            {/* Étape 3 : résultat final */}
            {autoStep === 'done' && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Rapport généré</h2>
                </div>
                {autoResult && (
                  <div className={`rounded-xl px-4 py-3.5 mb-4 text-sm ${autoResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                    {autoResult.message}
                    {autoResult.success && autoResult.data?.created?.length > 0 && (
                      <ul className="mt-2 space-y-1">{autoResult.data.created.map((c, i) => <li key={i} className="text-xs flex items-center gap-1"><span className="text-emerald-500">✓</span> {c.productName} — {new Date(c.dateKey).toLocaleDateString('fr-FR')}</li>)}</ul>
                    )}
                    {autoResult.success && autoResult.data?.updated?.length > 0 && (
                      <ul className="mt-2 space-y-1">{autoResult.data.updated.map((c, i) => <li key={i} className="text-xs flex items-center gap-1"><span className="text-blue-500">↻</span> {c.productName} — {new Date(c.dateKey).toLocaleDateString('fr-FR')}</li>)}</ul>
                    )}
                    {autoResult.success && autoResult.data?.unmatched?.length > 0 && (
                      <p className="mt-2 text-xs text-orange-700">{autoResult.data.unmatched.length} produit(s) toujours non assigné(s) ignoré(s)</p>
                    )}
                  </div>
                )}
                <button onClick={() => { setAutoModal(false); setAutoResult(null); setAutoStep('config'); }} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition">Fermer</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Filtres ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Période</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'all', label: 'Toute la période' },
            { key: 'today', label: "Aujourd'hui" },
            { key: 'week', label: '7 derniers jours' },
            { key: 'month', label: 'Ce mois' },
            { key: 'custom', label: 'Personnalisé' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setDateRangePreset(key);
                if (key === 'all') setFilter(prev => ({ ...prev, dateStart: '', dateEnd: '' }));
                if (key === 'today') { const t = new Date().toISOString().split('T')[0]; setFilter(prev => ({ ...prev, dateStart: t, dateEnd: t })); }
                if (key === 'week') { const td = new Date(); const wa = new Date(td.getTime() - 7 * 86400000); setFilter(prev => ({ ...prev, dateStart: wa.toISOString().split('T')[0], dateEnd: td.toISOString().split('T')[0] })); }
                if (key === 'month') { const td = new Date(); const fd = new Date(td.getFullYear(), td.getMonth(), 1); setFilter(prev => ({ ...prev, dateStart: fd.toISOString().split('T')[0], dateEnd: td.toISOString().split('T')[0] })); }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${dateRangePreset === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date début</label>
            <input
              type="date"
              value={filter.dateStart}
              onChange={(e) => { setDateRangePreset('custom'); setFilter(prev => ({ ...prev, dateStart: e.target.value })); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Date fin</label>
            <input
              type="date"
              value={filter.dateEnd}
              onChange={(e) => { setDateRangePreset('custom'); setFilter(prev => ({ ...prev, dateEnd: e.target.value })); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Statut</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="">Tous</option>
              <option value="validated">Validé</option>
              <option value="pending">En attente</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setDateRangePreset('all'); setFilter({ dateStart: '', dateEnd: '', status: '', productId: '' }); }}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 text-sm font-medium transition flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* ─── KPIs financiers ─────────────────────────────────────────────── */}
      {user?.role !== 'ecom_closeuse' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <DollarSign size={15} className="text-emerald-600" />
              </div>
              <p className="text-xs font-medium text-gray-500">Chiffre d'affaires</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${(totalProfit || 0) >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <TrendingUp size={15} className={(totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'} />
              </div>
              <p className="text-xs font-medium text-gray-500">Bénéfice net</p>
            </div>
            <p className={`text-lg font-bold ${(totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totalProfit)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Truck size={15} className="text-amber-600" />
              </div>
              <p className="text-xs font-medium text-gray-500">Frais livraison</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{fmt(totalDeliveryCost)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <BarChart3 size={15} className="text-red-500" />
              </div>
              <p className="text-xs font-medium text-gray-500">Dépenses pub</p>
            </div>
            <p className="text-lg font-bold text-gray-900">{fmt(totalAdSpend)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${roas >= 3 ? 'bg-green-100' : roas >= 2 ? 'bg-amber-100' : 'bg-red-100'}`}>
                <ArrowUpRight size={15} className={roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-amber-600' : 'text-red-500'} />
              </div>
              <p className="text-xs font-medium text-gray-500">ROAS</p>
            </div>
            <p className={`text-lg font-bold ${roas >= 3 ? 'text-green-600' : roas >= 2 ? 'text-amber-600' : 'text-red-500'}`}>{roas.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* ─── Stats commandes ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Rapports', value: reports.length, color: 'text-gray-900', icon: <Package size={15} className="text-gray-500" />, bg: 'bg-gray-100' },
          { label: 'Cmd reçues', value: totalReceived, color: 'text-blue-600', icon: <ShoppingCart size={15} className="text-blue-500" />, bg: 'bg-blue-100' },
          { label: 'Cmd livrées', value: totalDelivered, color: 'text-emerald-600', icon: <CheckCircle2 size={15} className="text-emerald-500" />, bg: 'bg-emerald-100' },
          { label: 'Taux livraison', value: `${deliveryRate}%`, color: deliveryRate >= 70 ? 'text-green-600' : deliveryRate >= 50 ? 'text-amber-600' : 'text-red-500', icon: <Truck size={15} className={deliveryRate >= 70 ? 'text-green-500' : deliveryRate >= 50 ? 'text-amber-500' : 'text-red-400'} />, bg: deliveryRate >= 70 ? 'bg-green-100' : deliveryRate >= 50 ? 'bg-amber-100' : 'bg-red-100', progress: deliveryRate },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}>{stat.icon}</div>
              <p className="text-xs font-medium text-gray-500">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            {stat.progress !== undefined && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div className={`h-1.5 rounded-full transition-all ${deliveryRate >= 70 ? 'bg-green-500' : deliveryRate >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${Math.min(deliveryRate, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── Insights Top 3 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Jours rentables */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Top 3 jours rentables</h3>
            <Link to="/ecom/reports/insights?tab=days" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
              Voir plus <ChevronRight size={13} />
            </Link>
          </div>
          {topProfitDays.length > 0 ? (
            <div className="space-y-2.5">
              {topProfitDays.map((day, index) => (
                <div key={day.date} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                    <RankIcon rank={index + 1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">#{index + 1} {new Date(day.date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-xs text-gray-400">{day.delivered} livrées • {day.reports} rapport{day.reports > 1 ? 's' : ''}</p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${day.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(day.profit)}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>}
        </div>

        {/* Agences */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Agences les plus efficaces</h3>
            <Link to="/ecom/reports/insights?tab=agencies" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
              Voir plus <ChevronRight size={13} />
            </Link>
          </div>
          {topAgencies.length > 0 ? (
            <div className="space-y-2.5">
              {topAgencies.map((agency, index) => (
                <div key={agency.agencyName} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                    <RankIcon rank={index + 1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">#{index + 1} {agency.agencyName}</p>
                    <p className="text-xs text-gray-400">{agency.ordersDelivered} livrées • {agency.reportsCount} rapport{agency.reportsCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400">Coût moy.</p>
                    <p className="text-sm font-bold text-emerald-600">{fmt(agency.avgCostPerDelivery)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>}
        </div>

        {/* Produits */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800">Top 3 produits</h3>
            <Link to="/ecom/stats-rapports" className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
              Voir plus <ChevronRight size={13} />
            </Link>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-2.5">
              {topProducts.map((product, index) => (
                <div key={`${product.productName}-${index}`} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                    <RankIcon rank={index + 1} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">#{index + 1} {product.productName}</p>
                    <p className="text-xs text-gray-400">{product.ordersDelivered} livrées • {product.reportsCount} rapport{product.reportsCount > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-gray-400">CA</p>
                    <p className="text-sm font-bold text-emerald-600">{fmt(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p>}
        </div>
      </div>

      {/* ─── Répartition des coûts ───────────────────────────────────────── */}
      {totalCost > 0 && user?.role !== 'ecom_closeuse' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Répartition des coûts</h3>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            <div className="bg-violet-500 rounded-l-full" style={{ width: `${(totalProductCost / totalCost * 100)}%` }} title={`Produits: ${fmt(totalProductCost)}`} />
            <div className="bg-amber-400" style={{ width: `${(totalDeliveryCost / totalCost * 100)}%` }} title={`Livraison: ${fmt(totalDeliveryCost)}`} />
            <div className="bg-red-400 rounded-r-full" style={{ width: `${(totalAdSpend / totalCost * 100)}%` }} title={`Pub: ${fmt(totalAdSpend)}`} />
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 bg-violet-500 rounded-full" />Produits <strong>{fmt(totalProductCost)}</strong></span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full" />Livraison <strong>{fmt(totalDeliveryCost)}</strong></span>
            <span className="flex items-center gap-1.5 text-xs text-gray-600"><span className="w-2.5 h-2.5 bg-red-400 rounded-full" />Pub <strong>{fmt(totalAdSpend)}</strong></span>
          </div>
        </div>
      )}

      {/* ─── Table des rapports ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="px-4 sm:px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 sm:px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produit</th>
                <th className="px-4 sm:px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Reçues</th>
                <th className="px-4 sm:px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Livrées</th>
                {user?.role !== 'ecom_closeuse' && (
                  <th className="px-4 sm:px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Pub</th>
                )}
                <th className="px-4 sm:px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Taux</th>
                <th className="px-4 sm:px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={user?.role === 'ecom_closeuse' ? 6 : 7} className="px-6 py-12 text-center">
                    <Package size={36} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Aucun rapport trouvé</p>
                  </td>
                </tr>
              ) : (
                reports.map((report) => {
                  const rate = report.ordersReceived > 0
                    ? ((report.ordersDelivered / report.ordersReceived) * 100).toFixed(0)
                    : 0;
                  return (
                    <tr key={report._id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap">
                        <Link to={`/ecom/reports/${report._id}`} className="text-sm font-semibold text-emerald-600 hover:text-emerald-800 hover:underline">
                          {new Date(report.date).toLocaleDateString('fr-FR')}
                        </Link>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 whitespace-nowrap max-w-[200px]">
                        {report.productId?._id ? (
                          <Link
                            to={`/ecom/reports/product/${report.productId._id}`}
                            className="text-sm font-medium text-gray-800 hover:text-emerald-700 flex items-center gap-1 group/link"
                            onClick={() => console.log('🔗 Navigation vers produit:', report.productId._id, 'Nom:', report.productId.name)}
                          >
                            <span className="truncate">{report.productId.name}</span>
                            <ChevronRight size={13} className="shrink-0 text-gray-300 group-hover/link:text-emerald-500 transition" />
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-center">
                        <span className="text-sm font-semibold text-gray-700">{report.ordersReceived}</span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-center">
                        <span className="text-sm font-bold text-emerald-600">{report.ordersDelivered}</span>
                      </td>
                      {user?.role !== 'ecom_closeuse' && (
                        <td className="px-4 sm:px-5 py-3.5 text-center">
                          <span className="text-sm text-gray-500">{fmt(report.adSpend)}</span>
                        </td>
                      )}
                      <td className="px-4 sm:px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          rate >= 70 ? 'bg-green-100 text-green-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {rate}%
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/ecom/reports/${report._id}`}
                            className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                          >
                            Voir
                          </Link>
                          {(user.role === 'ecom_admin' || user.role === 'ecom_closeuse') && (
                            <>
                              <Link
                                to={`/ecom/reports/${report._id}/edit`}
                                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                              >
                                Modifier
                              </Link>
                              <button
                                onClick={() => deleteReport(report._id)}
                                className="px-2.5 py-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition"
                              >
                                Supprimer
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsList;
