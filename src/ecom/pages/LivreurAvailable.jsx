import React, { useEffect, useRef, useState } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { playConfirmSound } from '../services/soundService.js';

const formatRemaining = (deadline) => {
  if (!deadline) return null;
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${seconds}s`;
};

const getOfferMeta = (order) => order.livreurView || {};

const LivreurAvailable = () => {
  const { user } = useEcomAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);
  const seenOffersRef = useRef(new Set());

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get('/orders/available', { params: { limit: 50 } });
      setOrders(res.data?.data || []);
    } catch { setError('Erreur de chargement.'); }
    finally { setLoading(false); }
  };

  const handleAssign = async (orderId) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError(''); setSuccess('');
    try {
      await ecomApi.post(`/orders/${orderId}/assign`);
      setSuccess('Course acceptée !');
      setOrders(p => p.filter(o => o._id !== orderId));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setAssigning(p => ({ ...p, [orderId]: false }));
    }
  };

  const handleRefuse = async (orderId) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError('');
    setSuccess('');
    try {
      await ecomApi.post(`/orders/${orderId}/refuse`);
      setSuccess('Course refusée.');
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
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
    const tickId = setInterval(() => setTick((value) => value + 1), 1000);

    const onNotification = (event) => {
      const detail = event.detail || {};
      const orderId = detail.metadata?.orderId || detail.data?.orderId;
      if (detail.type === 'course' && orderId && !seenOffersRef.current.has(String(orderId))) {
        seenOffersRef.current.add(String(orderId));
        playConfirmSound();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      if (detail.type === 'course' || detail.type === 'order_taken') {
        loadOrders();
      }
    };

    window.addEventListener('ecom:notification', onNotification);
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      window.removeEventListener('ecom:notification', onNotification);
    };
  }, []);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.clientName || '').toLowerCase().includes(q) ||
      (o.clientPhone || '').includes(q) ||
      (o.city || '').toLowerCase().includes(q) ||
      (o.product || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📦 Courses disponibles</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} course{orders.length !== 1 ? 's' : ''} en attente</p>
        </div>
        <button onClick={loadOrders} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-600">↻ Actualiser</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* Recherche */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, ville, produit…"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none transition"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 text-2xl">📦</div>
          <p className="text-gray-500 font-medium">Aucune course disponible</p>
          <p className="text-xs text-gray-400 mt-1">{search ? 'Essayez un autre terme de recherche' : 'Revenez dans quelques instants'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const meta = getOfferMeta(order);
            const remaining = formatRemaining(meta.responseDeadline);
            return (
            <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-gray-900">{order.clientName || 'Client'}</span>
                    {order.orderId && <span className="text-xs font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">#{order.orderId}</span>}
                    {meta.isTargeted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Ciblée</span>}
                    {remaining && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{remaining}</span>}
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    {order.clientPhone && <p>📞 {order.clientPhone}</p>}
                    {(order.city || order.address) && <p>📍 {order.city}{order.address ? `, ${order.address}` : ''}</p>}
                    {order.product && <p>📦 {order.product}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</p>}
                    {meta.pickupLocation && <p>🏪 Récupération: {meta.pickupLocation}</p>}
                    {meta.destination && <p>🎯 Destination: {meta.destination}</p>}
                    {(meta.gainLabel || meta.estimatedDistanceLabel) && <p>💸 Gain: {meta.gainLabel || '—'} · 📏 {meta.estimatedDistanceLabel || 'À estimer'}</p>}
                  </div>
                  {order.price && (
                    <p className="text-sm font-bold text-[#0F6B4F] mt-2">{Number(order.price).toLocaleString('fr-FR')} FCFA</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleAssign(order._id)}
                    disabled={assigning[order._id]}
                    className="px-4 py-2 bg-[#0F6B4F] text-white rounded-xl text-xs font-semibold hover:bg-[#0a5740] transition disabled:opacity-50 shrink-0"
                  >
                    {assigning[order._id] ? '…' : '✓ Accepter'}
                  </button>
                  <button
                    onClick={() => handleRefuse(order._id)}
                    disabled={assigning[order._id]}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50 shrink-0"
                  >
                    {assigning[order._id] ? '…' : '✕ Refuser'}
                  </button>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
};

export default LivreurAvailable;
