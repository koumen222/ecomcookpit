import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { playConfirmSound } from '../services/soundService.js';
import { useMoney } from '../hooks/useMoney.js';
import { formatMoney } from '../utils/currency.js';
import { Box, MapPin, Package, Phone, RefreshCw, Search, Store } from 'lucide-react';

const formatRemaining = (deadline) => {
  if (!deadline) return null;
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${seconds}s`;
};

const getOfferMeta = (order) => order.livreurView || {};

const LivreurAvailable = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const navigate = useNavigate();
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
      window.location.href = '/ecom/livreur/deliveries';
    } catch (err) {
      console.error('[Assign error]', err);
      setError(err.response?.data?.message || `Erreur: ${err.message || 'impossible d\'accepter cette course. Vérifiez que le serveur est démarré.'}`);
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
    <div className="px-4 py-5 sm:p-8 max-w-[980px] mx-auto space-y-5 pb-28 lg:pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0F6B4F]">Courses</p><h1 className="mt-1 text-2xl sm:text-3xl font-bold text-gray-950">Courses disponibles</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} course{orders.length !== 1 ? 's' : ''} en attente</p>
        </div>
        <button onClick={loadOrders} className="min-h-11 px-4 text-sm font-semibold bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition text-gray-700 flex items-center gap-2"><RefreshCw className="w-4 h-4"/>Actualiser</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* Recherche */}
      <div className="relative bg-white rounded-[20px] border border-gray-200 p-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, ville, produit…"
          className="w-full min-h-12 pl-11 pr-4 border-0 rounded-xl text-base focus:ring-2 focus:ring-[#0F6B4F]/20 outline-none transition"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[24px] border border-gray-200 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0F6B4F] flex items-center justify-center mx-auto mb-4"><Box className="h-6 w-6"/></div>
          <p className="text-gray-500 font-medium">Aucune course disponible</p>
          <p className="text-xs text-gray-400 mt-1">{search ? 'Essayez un autre terme de recherche' : 'Revenez dans quelques instants'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const meta = getOfferMeta(order);
            const remaining = formatRemaining(meta.responseDeadline);
            return (
            <div key={order._id} className="bg-white rounded-[24px] border border-gray-200 p-4 sm:p-5 hover:border-emerald-300 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-gray-900">{order.clientName || 'Client'}</span>
                    {order.orderId && <span className="text-xs font-mono text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">#{order.orderId}</span>}
                    {meta.isTargeted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Ciblée</span>}
                    {remaining && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{remaining}</span>}
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    {order.clientPhone && <p className="flex gap-2"><Phone className="h-4 w-4"/>{order.clientPhone}</p>}
                    {(order.city || order.address) && <p className="flex gap-2"><MapPin className="h-4 w-4"/>{order.city}{order.address ? `, ${order.address}` : ''}</p>}
                    {order.product && <p className="flex gap-2"><Package className="h-4 w-4"/>{order.product}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</p>}
                    {meta.pickupLocation && <p className="flex gap-2"><Store className="h-4 w-4"/>Récupération: {meta.pickupLocation}</p>}
                    {meta.destination && <p className="flex gap-2"><MapPin className="h-4 w-4"/>Destination: {meta.destination}</p>}
                    {(meta.gainLabel || meta.estimatedDistanceLabel) && <p>💸 Montant : {meta.gainLabel || '—'} · 📏 {meta.estimatedDistanceLabel || 'À estimer'}</p>}
                  </div>
                  {order.price && (
                    <p className="text-sm font-bold text-[#0F6B4F] mt-2">{formatMoney(order.price, order.currency || 'XAF')}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 min-w-[104px]">
                  <button
                    onClick={() => handleAssign(order._id)}
                    disabled={assigning[order._id]}
                    className="min-h-11 px-4 bg-[#0F6B4F] text-white rounded-xl text-xs font-semibold hover:bg-[#0a5740] transition disabled:opacity-50 shrink-0"
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
