import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import { getCache, setCache } from '../utils/cacheUtils.js';

import {
  ArrowLeft, TrendingUp, Package, DollarSign, Truck,
  RefreshCw, Award, Crown, Medal, Calendar, BarChart3,
  AlertCircle, Percent, ShoppingCart, Target
} from 'lucide-react';

const RapportsSkeleton = () => (
  <div className="p-4 sm:p-6">
    <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-6" />
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

const RankBadge = ({ rank }) => {
  const icons = [Crown, Medal, Award];
  const Icon = icons[rank - 1] || Award;
  const colors = ['text-yellow-600 bg-yellow-100', 'text-gray-600 bg-gray-200', 'text-orange-600 bg-orange-100'];
  const colorClass = colors[rank - 1] || 'text-gray-500 bg-gray-100';

  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
      {rank <= 3 ? <Icon size={14} /> : <span className="text-xs font-bold">{rank}</span>}
    </div>
  );
};

const TABS = [
  { key: 'sold', label: 'Plus vendus', icon: ShoppingCart, color: 'blue', sortKey: 'ordersDelivered', desc: 'Par nombre de commandes livrées' },
  { key: 'delivery', label: 'Meilleur taux livraison', icon: Truck, color: 'green', sortKey: 'deliveryRate', desc: 'Par taux de livraison (livrées / reçues)' },
  { key: 'revenue', label: 'Meilleur CA', icon: DollarSign, color: 'emerald', sortKey: 'revenue', desc: 'Par chiffre d\'affaires total' },
  { key: 'profit', label: 'Meilleur bénéfice', icon: TrendingUp, color: 'purple', sortKey: 'profit', desc: 'Par bénéfice net total' },
  { key: 'profitability', label: 'Plus rentables', icon: Target, color: 'amber', sortKey: 'profitabilityRate', desc: 'Par taux de rentabilité (bénéfice / CA)' },
];

const StatsRapports = () => {
  const navigate = useNavigate();
  const { fmt } = useMoney();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('sold');
  const [dateRange, setDateRange] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (dateRange === 'custom' && startDate) params.startDate = startDate;
      if (dateRange === 'custom' && endDate) params.endDate = endDate;
      if (dateRange === '7d') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        params.startDate = d.toISOString().split('T')[0];
      } else if (dateRange === '30d') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString().split('T')[0];
      } else if (dateRange === '90d') {
        const d = new Date(); d.setDate(d.getDate() - 90);
        params.startDate = d.toISOString().split('T')[0];
      }

      const cacheKey = `rapports:${dateRange}:${startDate}:${endDate}`;
      const cached = getCache(cacheKey);
      if (cached) { setProducts(cached); setLoading(false); return; }
      const res = await ecomApi.get('/reports/stats/products-ranking', { params });
      setCache(cacheKey, res.data.data || []);
      setProducts(res.data.data || []);
    } catch (err) {
      setError(getContextualError(err, 'load_stats'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, startDate, endDate]);

  const currentTab = TABS.find(t => t.key === activeTab);
  const sorted = [...products].sort((a, b) => {
    const key = currentTab.sortKey;
    return (b[key] || 0) - (a[key] || 0);
  });

  const getBarColor = (tab) => {
    const colors = {
      sold: 'bg-emerald-600',
      delivery: 'bg-green-500',
      revenue: 'bg-emerald-500',
      profit: 'bg-emerald-600',
      profitability: 'bg-amber-500',
    };
    return colors[tab] || 'bg-emerald-600';
  };

  const getBarBg = (tab) => {
    const colors = {
      sold: 'bg-emerald-100',
      delivery: 'bg-green-100',
      revenue: 'bg-emerald-100',
      profit: 'bg-emerald-100',
      profitability: 'bg-amber-100',
    };
    return colors[tab] || 'bg-emerald-100';
  };

  const formatValue = (product) => {
    switch (activeTab) {
      case 'sold':
        return `${product.ordersDelivered} livrées`;
      case 'delivery':
        return `${(product.deliveryRate || 0).toFixed(1)}%`;
      case 'revenue':
        return fmt(product.revenue || 0);
      case 'profit':
        return fmt(product.profit || 0);
      case 'profitability':
        return `${(product.profitabilityRate || 0).toFixed(1)}%`;
      default:
        return '';
    }
  };

  const getMaxValue = () => {
    if (sorted.length === 0) return 1;
    const key = currentTab.sortKey;
    return Math.max(...sorted.map(p => Math.abs(p[key] || 0)), 1);
  };

  const getBarWidth = (product) => {
    const key = currentTab.sortKey;
    const max = getMaxValue();
    return Math.max(((Math.abs(product[key] || 0)) / max) * 100, 2);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle size={20} className="text-red-500" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ecom/stats')} className="p-2.5 hover:bg-gray-100 rounded-xl transition border border-gray-200 shadow-sm">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stats produits (Rapports)</h1>
            <p className="text-sm text-gray-500">Classements basés sur les rapports quotidiens</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-transparent">
            <option value="all">Tout le temps</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="custom">Personnalisé</option>
          </select>
          {dateRange === 'custom' && (
            <>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="px-1.5 sm:px-3 py-1 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-sm w-[110px] sm:w-auto" />
              <span className="text-gray-400 text-[10px] sm:text-sm">→</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="px-1.5 sm:px-3 py-1 sm:py-2 border border-gray-200 rounded-lg text-[10px] sm:text-sm w-[110px] sm:w-auto" />
            </>
          )}
          <button onClick={fetchData} className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition shadow-sm">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <RapportsSkeleton />
      ) : (
        <>
          {/* Description */}
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
            <BarChart3 size={16} />
            <span>{currentTab.desc} — <strong>{sorted.length}</strong> produit{sorted.length > 1 ? 's' : ''}</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 w-12">#</th>
                    <th className="text-left py-3 px-4">Produit</th>
                    <th className="text-right py-3 px-4">Reçues</th>
                    <th className="text-right py-3 px-4">Livrées</th>
                    <th className="text-right py-3 px-4">Taux livr.</th>
                    <th className="text-right py-3 px-4">CA</th>
                    <th className="text-right py-3 px-4">Bénéfice</th>
                    <th className="text-right py-3 px-4">Rentabilité</th>
                    <th className="text-right py-3 px-4">Pub</th>
                    <th className="py-3 px-4 w-36"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p, i) => {
                    const isProfit = (p.profit || 0) >= 0;
                    return (
                      <tr key={p._id || i} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                        <td className="py-3 px-4">
                          <RankBadge rank={i + 1} />
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[220px]" title={p.productName}>
                            {p.productName || 'Produit inconnu'}
                          </p>
                          <p className="text-xs text-gray-400">{p.reportsCount} rapport{p.reportsCount > 1 ? 's' : ''}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-gray-700">{p.ordersReceived}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-semibold text-gray-900">{p.ordersDelivered}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-medium ${(p.deliveryRate || 0) >= 50 ? 'text-green-600' : (p.deliveryRate || 0) >= 30 ? 'text-yellow-600' : 'text-red-500'}`}>
                            {(p.deliveryRate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-medium text-gray-900">{fmt(p.revenue || 0)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-semibold ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                            {isProfit ? '+' : ''}{fmt(p.profit || 0)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            (p.profitabilityRate || 0) >= 30 ? 'bg-green-100 text-green-700' :
                            (p.profitabilityRate || 0) >= 10 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {(p.profitabilityRate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs text-gray-500">{fmt(p.adSpend || 0)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 whitespace-nowrap w-20 text-right">
                              {formatValue(p)}
                            </span>
                            <div className={`flex-1 h-2 rounded-full ${getBarBg(activeTab)} overflow-hidden`}>
                              <div className={`h-2 rounded-full ${getBarColor(activeTab)} transition-all`}
                                style={{ width: `${getBarWidth(p)}%` }}></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sorted.length === 0 && (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Aucun rapport trouvé pour cette période</p>
                <p className="text-gray-400 text-xs mt-1">Créez des rapports quotidiens pour voir les statistiques</p>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {sorted.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
              {TABS.map(tab => {
                const best = [...products].sort((a, b) => (b[tab.sortKey] || 0) - (a[tab.sortKey] || 0))[0];
                if (!best) return null;
                const Icon = tab.icon;
                const colorMap = {
                  blue: 'from-emerald-50 to-emerald-100 border-emerald-200',
                  green: 'from-green-50 to-green-100 border-green-200',
                  emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
                  purple: 'from-emerald-50 to-emerald-100 border-emerald-200',
                  amber: 'from-amber-50 to-amber-100 border-amber-200',
                };
                const textColorMap = {
                  blue: 'text-emerald-600',
                  green: 'text-green-600',
                  emerald: 'text-emerald-600',
                  purple: 'text-emerald-700',
                  amber: 'text-amber-600',
                };
                return (
                  <div key={tab.key}
                    className={`bg-gradient-to-br ${colorMap[tab.color]} rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={16} className={textColorMap[tab.color]} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{tab.label}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate" title={best.productName}>
                      {best.productName || 'Inconnu'}
                    </p>
                    <p className={`text-lg font-bold ${textColorMap[tab.color]} mt-1`}>
                      {tab.sortKey === 'ordersDelivered' && `${best.ordersDelivered}`}
                      {tab.sortKey === 'deliveryRate' && `${(best.deliveryRate || 0).toFixed(1)}%`}
                      {tab.sortKey === 'revenue' && fmt(best.revenue || 0)}
                      {tab.sortKey === 'profit' && fmt(best.profit || 0)}
                      {tab.sortKey === 'profitabilityRate' && `${(best.profitabilityRate || 0).toFixed(1)}%`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StatsRapports;
