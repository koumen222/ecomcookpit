import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { playConfirmSound } from '../services/soundService.js';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Acceptée', shipped: 'En cours',
  delivered: 'Livrée', returned: 'Retour', cancelled: 'Annulée',
};
const STATUS_META = {
  delivered: { bg: '#ecfdf5', text: '#065f46' },
  confirmed: { bg: '#eff6ff', text: '#053326' },
  pending: { bg: '#fffbeb', text: '#92400e' },
  shipped: { bg: '#eef2ff', text: '#3730a3' },
  returned: { bg: '#fff7ed', text: '#9a3412' },
  cancelled: { bg: '#fef2f2', text: '#991b1b' },
};

const formatRemaining = (deadline) => {
  if (!deadline) return null;
  const seconds = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
  return `${seconds}s`;
};

const getOfferMeta = (order) => order.livreurView || {};

const NoWorkspace = ({ user }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-sm w-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center mx-auto mb-5 text-3xl">🚚</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
      <p className="text-sm text-gray-500 mb-6">Rejoignez une équipe existante via un lien d'invitation ou créez votre espace.</p>
      <Link to="/ecom/workspace-setup" className="block py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition">Créer un espace</Link>
      <p className="text-xs text-gray-400 mt-4">Pour rejoindre un espace, demandez un lien d'invitation à votre administrateur.</p>
    </div>
  </div>
);

const Loader = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-4">
    <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
    <p className="text-sm text-gray-400 font-medium">Chargement…</p>
  </div>
);

const LivreurDashboard = () => {
  const { user } = useEcomAuth();
  const [stats, setStats] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const seenOffersRef = useRef(new Set());
  const [, setTick] = useState(0);

  if (!user?.workspaceId) return <NoWorkspace user={user} />;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, myRes, availRes] = await Promise.all([
        ecomApi.get('/orders/livreur/stats'),
        ecomApi.get('/orders', { params: { assignedLivreur: user._id, limit: 20 } }),
        ecomApi.get('/orders/available', { params: { limit: 10 } }),
      ]);
      setStats(statsRes.data?.data || null);
      const allMy = myRes.data?.data?.orders || myRes.data?.data || [];
      setMyOrders(allMy.filter(o => ['confirmed', 'shipped'].includes(o.status)).slice(0, 5));
      setAvailableOrders(availRes.data?.data || []);
    } catch {
      setError('Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (orderId) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError(''); setSuccess('');
    try {
      await ecomApi.post(`/orders/${orderId}/assign`);
      setSuccess('Course acceptée !');
      setAvailableOrders(p => p.filter(o => o._id !== orderId));
      loadData();
      setTimeout(() => setSuccess(''), 6000);
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
      setAvailableOrders((prev) => prev.filter((order) => order._id !== orderId));
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setAssigning(p => ({ ...p, [orderId]: false }));
    }
  };

  const handleAction = async (orderId, action) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError('');
    try {
      await ecomApi.patch(`/orders/${orderId}/livreur-action`, { action });
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : action === 'pickup_confirmed' ? 'Récupération confirmée !' : 'Action enregistrée.');
      loadData();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setAssigning(p => ({ ...p, [orderId]: false }));
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Livreur';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    loadData();
    const pollId = setInterval(() => loadData(), 10000);
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
        loadData();
      }
    };

    window.addEventListener('ecom:notification', onNotification);
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      window.removeEventListener('ecom:notification', onNotification);
    };
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{greeting}, {firstName} 🚚</h1>
          <p className="text-sm text-gray-400 capitalize mt-0.5">{today}</p>
        </div>
        <button onClick={loadData} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-600">↻ Actualiser</button>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Disponibles', value: stats.available || 0, iconBg: '#fffbeb', icon: <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>, sub: 'courses' },
            { label: 'En cours', value: stats.inProgress || 0, iconBg: '#eef2ff', icon: <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>, sub: 'livraisons' },
            { label: 'Ce mois', value: stats.thisMonth?.delivered || 0, iconBg: '#ecfdf5', icon: <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, sub: 'livrées' },
            { label: 'Semaine', value: stats.thisWeek?.delivered || 0, iconBg: '#f5f3ff', icon: <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, sub: 'livrées' },
            { label: 'Total', value: stats.allTime?.delivered || 0, iconBg: '#f0fdf4', icon: <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, sub: 'livrées' },
          ].map((k, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{k.label}</p>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.iconBg }}>{k.icon}</div>
              </div>
              <p className="text-3xl font-black text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gains rapide */}
      {stats && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">💰 Gains</h2>
            <Link to="/ecom/livreur/earnings" className="text-xs text-[#0F6B4F] font-medium hover:underline">Voir tout →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Ce mois</p>
              <p className="text-2xl font-black text-gray-900">{(stats.thisMonth?.amount || 0).toLocaleString('fr-FR')} <span className="text-sm font-medium text-gray-400">FCFA</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total cumulé</p>
              <p className="text-2xl font-black text-[#0F6B4F]">{(stats.allTime?.amount || 0).toLocaleString('fr-FR')} <span className="text-sm font-medium text-gray-400">FCFA</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Deux colonnes : livraisons en cours + courses disponibles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Mes livraisons actives */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">🚚 En cours</h2>
            <Link to="/ecom/livreur/deliveries" className="text-xs text-[#0F6B4F] font-medium hover:underline">Tout voir →</Link>
          </div>
          {myOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Aucune livraison active</p>
              <Link to="/ecom/livreur/available" className="text-xs text-[#0F6B4F] font-medium mt-2 inline-block">Accepter une course →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myOrders.map(order => {
                const sm = STATUS_META[order.status] || { bg: '#f9fafb', text: '#374151' };
                return (
                  <div key={order._id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900 truncate">{order.clientName || order.clientPhone || 'Client'}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sm.bg, color: sm.text }}>{STATUS_LABELS[order.status] || order.status}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{order.address || order.city || '—'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {order.status === 'confirmed' && (
                        <button onClick={() => handleAction(order._id, 'pickup_confirmed')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50">
                          {assigning[order._id] ? '…' : '📦 Récupéré'}
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button onClick={() => handleAction(order._id, 'delivered')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50">
                          {assigning[order._id] ? '…' : '✅ Livré'}
                        </button>
                      )}
                      <Link to={`/ecom/livreur/delivery/${order._id}`} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition">Détails</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Courses disponibles */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">📦 Disponibles</h2>
            <Link to="/ecom/livreur/available" className="text-xs text-[#0F6B4F] font-medium hover:underline">Tout voir →</Link>
          </div>
          {availableOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">Aucune course disponible</p>
              <p className="text-xs text-gray-300 mt-1">Revenez dans quelques instants</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableOrders.map(order => (
                <div key={order._id} className="rounded-xl border border-gray-100 p-3 hover:bg-gray-50 transition">
                  {(() => {
                    const meta = getOfferMeta(order);
                    const remaining = formatRemaining(meta.responseDeadline);
                    return (
                      <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 truncate">{order.clientName || order.clientPhone || 'Client'}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-gray-300">{order.orderId}</span>
                      {meta.isTargeted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Ciblée</span>}
                      {remaining && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">{remaining}</span>}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{order.city || order.address || '—'}{order.product ? ` · ${order.product}` : ''}</p>
                  {meta.destination && <p className="text-xs text-gray-400 truncate mt-1">🎯 {meta.destination}</p>}
                  {(meta.gainLabel || meta.estimatedDistanceLabel) && <p className="text-xs text-gray-400 truncate mt-1">💸 {meta.gainLabel || '—'} · 📏 {meta.estimatedDistanceLabel || 'À estimer'}</p>}
                  {order.price && <p className="text-xs font-semibold text-[#0F6B4F] mt-0.5">{Number(order.price).toLocaleString('fr-FR')} FCFA</p>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => handleAssign(order._id)} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-[#0F6B4F] text-white rounded-lg font-medium hover:bg-[#0a5740] transition disabled:opacity-50 flex-1">
                      {assigning[order._id] ? 'Assignation…' : '✓ Accepter'}
                    </button>
                    <button onClick={() => handleRefuse(order._id)} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50 flex-1">
                      {assigning[order._id] ? '…' : '✕ Refuser'}
                    </button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/ecom/livreur/available', icon: '📦', label: 'Courses disponibles', sub: 'Accepter de nouvelles courses' },
          { href: '/ecom/livreur/history', icon: '📋', label: 'Historique', sub: 'Toutes vos livraisons terminées' },
          { href: '/ecom/livreur/earnings', icon: '💰', label: 'Mes gains', sub: 'Détail de vos revenus' },
        ].map((a, i) => (
          <Link key={i} to={a.href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition group flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">{a.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-400 truncate">{a.sub}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default LivreurDashboard;
