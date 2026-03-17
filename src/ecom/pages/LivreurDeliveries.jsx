import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  confirmed: 'Acceptée', shipped: 'En cours', delivered: 'Livrée',
  returned: 'Retour', cancelled: 'Annulée', pending: 'En attente',
};
const STATUS_META = {
  confirmed: { bg: '#eff6ff', text: '#053326' },
  shipped: { bg: '#eef2ff', text: '#3730a3' },
  delivered: { bg: '#ecfdf5', text: '#065f46' },
  returned: { bg: '#fff7ed', text: '#9a3412' },
  cancelled: { bg: '#fef2f2', text: '#991b1b' },
  pending: { bg: '#fffbeb', text: '#92400e' },
};

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'confirmed', label: 'Acceptées' },
  { key: 'shipped', label: 'En transit' },
];

const LivreurDeliveries = () => {
  const { user } = useEcomAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('all');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get('/orders', { params: { assignedLivreur: user._id, limit: 100 } });
      const all = res.data?.data?.orders || res.data?.data || [];
      setOrders(all.filter(o => ['confirmed', 'shipped'].includes(o.status)));
    } catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  };

  const handleAction = async (orderId, action) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError('');
    try {
      await ecomApi.patch(`/orders/${orderId}/livreur-action`, { action });
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : 'Action enregistrée.');
      loadOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setAssigning(p => ({ ...p, [orderId]: false }));
    }
  };

  useEffect(() => {
    loadOrders();
    const pollId = setInterval(() => loadOrders(), 10000);
    const onNotification = (event) => {
      const detail = event.detail || {};
      if (detail.type === 'course' || detail.type === 'order_taken' || detail.type === 'order_status') {
        loadOrders();
      }
    };

    window.addEventListener('ecom:notification', onNotification);
    return () => {
      clearInterval(pollId);
      window.removeEventListener('ecom:notification', onNotification);
    };
  }, []);

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">🚚 Mes livraisons</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} livraison{orders.length !== 1 ? 's' : ''} active{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={loadOrders} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-600">↻ Actualiser</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} ({t.key === 'all' ? orders.length : orders.filter(o => o.status === t.key).length})
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
          <p className="text-gray-500 font-medium">Aucune livraison active</p>
          <Link to="/ecom/livreur/available" className="text-xs text-[#0F6B4F] font-medium mt-2 inline-block">Accepter une course →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const sm = STATUS_META[order.status] || { bg: '#f9fafb', text: '#374151' };
            return (
              <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{order.clientName || order.clientPhone || 'Client'}</span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: sm.bg, color: sm.text }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {order.clientPhone && <p>📞 {order.clientPhone}</p>}
                  {(order.city || order.address) && <p>📍 {order.city}{order.address ? `, ${order.address}` : ''}</p>}
                  {order.product && <p>📦 {order.product}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {order.status === 'confirmed' && (
                    <>
                      <button onClick={() => handleAction(order._id, 'pickup_confirmed')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50">
                        {assigning[order._id] ? '…' : '📦 Récupéré'}
                      </button>
                      <button onClick={() => handleAction(order._id, 'refused')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50">
                        {assigning[order._id] ? '…' : '✕ Refuser'}
                      </button>
                    </>
                  )}
                  {order.status === 'shipped' && (
                    <button onClick={() => handleAction(order._id, 'delivered')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50">
                      {assigning[order._id] ? '…' : '✅ Livré'}
                    </button>
                  )}
                  <Link to={`/ecom/livreur/delivery/${order._id}`} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition">
                    Détails
                  </Link>
                  {order.clientPhone && (
                    <a href={`tel:${order.clientPhone}`} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 transition">
                      📞 Appeler
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LivreurDeliveries;
