import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  MapPin,
  Package,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { livreurApi } from '../services/livreurApi.js';

const STATUS_CONFIG = {
  delivered: { label: 'Livré', color: 'bg-green-100 text-green-800', icon: '✅' },
  returned: { label: 'Retour', color: 'bg-orange-100 text-orange-800', icon: '↩️' },
  cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-800', icon: '❌' },
};

export default function LivreurHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const loadHistory = useCallback(async (p = 1, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const res = await livreurApi.getHistory(params);
      const data = res.data?.data || [];
      const pages = res.data?.pages || 1;
      const tot = res.data?.total || 0;
      setTotal(tot);
      setOrders((prev) => (reset || p === 1 ? data : [...prev, ...data]));
      setHasMore(p < pages);
      setPage(p);
    } catch {
      setError('Erreur lors du chargement de l\'historique.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadHistory(1, true);
  }, [loadHistory]);

  const filterTabs = [
    { id: '', label: 'Tout' },
    { id: 'delivered', label: '✅ Livré' },
    { id: 'returned', label: '↩️ Retour' },
    { id: 'cancelled', label: '❌ Annulé' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-0 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Historique</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{total} livraison{total !== 1 ? 's' : ''}</span>
            <button
              onClick={() => loadHistory(1, true)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95"
            >
              <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0 -mx-1 px-1 scrollbar-hide">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); }}
              className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        {loading && page === 1 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History size={48} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">Aucun historique</p>
            <p className="text-gray-400 text-sm mt-1">Vos livraisons terminées apparaîtront ici</p>
          </div>
        ) : (
          <>
            {/* Group by date */}
            <HistoryList orders={orders} />

            {hasMore && (
              <button
                onClick={() => loadHistory(page + 1)}
                disabled={loading}
                className="w-full py-3 mt-4 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium active:scale-95 disabled:opacity-60"
              >
                {loading ? 'Chargement...' : 'Charger plus'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HistoryList({ orders }) {
  // Group by date
  const groups = {};
  orders.forEach((order) => {
    const d = new Date(order.updatedAt || order.date || order.createdAt);
    const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
  });

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            {date}
          </p>
          <div className="space-y-2">
            {items.map((order) => (
              <HistoryCard key={order._id} order={order} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryCard({ order }) {
  const config = STATUS_CONFIG[order.status] || {
    label: order.status,
    color: 'bg-gray-100 text-gray-700',
    icon: '📦',
  };

  return (
    <Link
      to={`/ecom/livreur/delivery/${order._id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 text-xl">
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm truncate">
          {order.clientName || order.clientPhone || 'Client'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 text-gray-400 text-xs">
          <MapPin size={11} />
          <span className="truncate">{order.city || order.address || '—'}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
          {config.label}
        </span>
        {order.price && (
          <span className="text-xs text-indigo-600 font-semibold">
            {Number(order.price).toLocaleString('fr-FR')} F
          </span>
        )}
      </div>
    </Link>
  );
}
