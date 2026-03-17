import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  delivered: 'Livrée', returned: 'Retour', cancelled: 'Annulée',
  confirmed: 'Confirmée', shipped: 'En transit', pending: 'En attente',
};
const STATUS_META = {
  delivered: { bg: '#ecfdf5', text: '#065f46' },
  returned: { bg: '#fff7ed', text: '#9a3412' },
  cancelled: { bg: '#fef2f2', text: '#991b1b' },
};

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'delivered', label: 'Livré' },
  { key: 'returned', label: 'Retour' },
  { key: 'cancelled', label: 'Annulé' },
];

const LivreurHistoryPage = () => {
  const { user } = useEcomAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { loadHistory(); }, [page]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get('/orders/livreur/history', { params: { page, limit: 20 } });
      const data = res.data?.data || {};
      setOrders(data.orders || data || []);
      setHasMore(data.hasMore || false);
    } catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  };

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  const groupByDate = (items) => {
    const groups = {};
    items.forEach(o => {
      const d = new Date(o.deliveredAt || o.updatedAt || o.date || o.createdAt);
      const key = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.entries(groups);
  };

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📋 Historique</h1>
        <p className="text-sm text-gray-400 mt-0.5">Toutes vos livraisons terminées</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500 font-medium">Aucun historique</p>
          <p className="text-xs text-gray-400 mt-1">Vos livraisons terminées apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupByDate(filtered).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{date}</p>
              <div className="space-y-2">
                {items.map(order => {
                  const sm = STATUS_META[order.status] || { bg: '#f9fafb', text: '#374151' };
                  return (
                    <Link key={order._id} to={`/ecom/livreur/delivery/${order._id}`} className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-900">{order.clientName || order.clientPhone || 'Client'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.text }}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{order.city || '—'}{order.product ? ` · ${order.product}` : ''}</span>
                        {order.price && <span className="font-semibold text-gray-600">{Number(order.price).toLocaleString('fr-FR')} FCFA</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 text-xs font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-30">
            ← Précédent
          </button>
          <span className="text-xs text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!hasMore} className="px-4 py-2 text-xs font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition disabled:opacity-30">
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
};

export default LivreurHistoryPage;
