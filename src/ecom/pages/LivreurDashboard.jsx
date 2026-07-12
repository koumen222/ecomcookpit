import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { playConfirmSound, playNewOrderSound, startOrderAlarm, stopOrderAlarm } from '../services/soundService.js';
import { useMoney } from '../hooks/useMoney.js';
import { formatMoney } from '../utils/currency.js';
import { ArrowRight, Box, CheckCircle2, History, MapPin, Navigation, Package, RefreshCw, Route, Wallet, X } from 'lucide-react';

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
  const { fmt, symbol } = useMoney();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [myOrders, setMyOrders] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const seenOffersRef = useRef(new Set());
  const [, setTick] = useState(0);
  const prevAvailableCountRef = useRef(0);

  // Démarre/arrête l'alarme selon les courses disponibles
  useEffect(() => {
    if (availableOrders.length > 0) {
      startOrderAlarm();
    } else {
      stopOrderAlarm();
    }
    return () => stopOrderAlarm();
  }, [availableOrders.length]);

  if (!user?.workspaceId) return <NoWorkspace user={user} />;

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const [statsRes, myRes, availRes] = await Promise.all([
        ecomApi.get('/orders/livreur/stats'),
        ecomApi.get('/orders', { params: { assignedLivreur: user._id, limit: 20 } }),
        ecomApi.get('/orders/available', { params: { limit: 10 } }),
      ]);
      setStats(statsRes.data?.data || null);
      const allMy = myRes.data?.data?.orders || myRes.data?.data || [];
      setMyOrders(allMy.filter(o => ['confirmed', 'shipped'].includes(o.status)).slice(0, 5));
      const newAvailable = availRes.data?.data || [];
      setAvailableOrders(newAvailable);
      if (!silent) {
        prevAvailableCountRef.current = newAvailable.length;
      } else if (newAvailable.length > prevAvailableCountRef.current) {
        playNewOrderSound();
        if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
        prevAvailableCountRef.current = newAvailable.length;
      } else {
        prevAvailableCountRef.current = newAvailable.length;
      }
    } catch {
      if (!silent) setError('Erreur de chargement.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleAssign = async (orderId) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError(''); setSuccess('');
    try {
      await ecomApi.post(`/orders/${orderId}/assign`);
      stopOrderAlarm();
      window.location.href = '/ecom/livreur/deliveries';
    } catch (err) {
      console.error('[Assign error]', err);
      setError(err.response?.data?.message || `Erreur: ${err.message || 'impossible d\'accepter. Vérifiez que le serveur est démarré.'}`);
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
      stopOrderAlarm();
      setAvailableOrders((prev) => prev.filter((order) => order._id !== orderId));
      loadData(true);
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
      const payload = { action };
      if (action === 'delivered') {
        const selectedOrder = myOrders.find(order => order._id === orderId);
        const entered = window.prompt(`Montant réellement encaissé (${selectedOrder?.currency || 'XAF'})`, String(selectedOrder?.price || 0));
        if (entered === null) return;
        const collectedAmount = Number(entered);
        if (!Number.isFinite(collectedAmount) || collectedAmount < 0) {
          setError('Saisissez un montant encaissé valide.');
          return;
        }
        payload.collectedAmount = collectedAmount;
      }
      await ecomApi.patch(`/orders/${orderId}/livreur-action`, payload);
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : action === 'pickup_confirmed' ? 'Récupération confirmée !' : 'Action enregistrée.');
      loadData(true);
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
    const pollId = setInterval(() => loadData(true), 10000);
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
        loadData(true);
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
    <div className="px-4 py-5 sm:p-8 max-w-[1180px] mx-auto space-y-5 pb-28 lg:pb-10">
      {/* En-tête */}
      <section className="relative overflow-hidden rounded-[28px] bg-[#073c2e] px-5 py-6 sm:px-8 sm:py-8 text-white shadow-[0_20px_50px_-28px_rgba(7,60,46,.8)]">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[32px] border-white/5" />
        <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-200">Tableau de bord</p>
          <h1 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight">{greeting}, {firstName}</h1>
          <p className="text-sm text-white/65 capitalize mt-1">{today}</p>
        </div>
        <button aria-label="Actualiser" onClick={loadData} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15"><RefreshCw className="h-4 w-4"/><span className="hidden sm:inline">Actualiser</span></button>
        </div>
        <div className="relative mt-7 grid grid-cols-3 divide-x divide-white/15 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
          <div><p className="text-2xl font-bold tabular-nums">{stats?.inProgress || 0}</p><p className="mt-1 text-[11px] text-white/65">En cours</p></div>
          <div className="pl-4"><p className="text-2xl font-bold tabular-nums">{stats?.thisWeek?.delivered || 0}</p><p className="mt-1 text-[11px] text-white/65">Cette semaine</p></div>
          <div className="pl-4"><p className="text-2xl font-bold tabular-nums">{fmt(stats?.thisMonth?.collected || 0)}</p><p className="mt-1 text-[11px] text-white/65">Encaissé ce mois</p></div>
        </div>
      </section>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* ─── Courses disponibles — PRIORITÉ ─── */}
      <div className={`rounded-[24px] border overflow-hidden bg-white transition-all ${availableOrders.length > 0 ? 'border-emerald-300 shadow-lg' : 'border-gray-200 shadow-sm'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[#0F6B4F]"><Package className="h-5 w-5" /></div><h2 className="text-sm font-bold text-gray-900">
              Courses disponibles
              {availableOrders.length > 0 && (
                <span className="ml-2 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{availableOrders.length}</span>
              )}
            </h2>
          </div>
          <Link to="/ecom/livreur/available" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-[#0F6B4F]">Tout voir <ArrowRight className="h-4 w-4"/></Link>
        </div>
        <div className="bg-white">
          {availableOrders.length === 0 ? (
            <div className="flex flex-col items-center text-center py-9 px-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><Box className="h-5 w-5"/></div><p className="text-gray-700 font-semibold text-sm">Aucune course disponible</p>
              <p className="text-xs text-gray-400 mt-1">Cette liste se met à jour automatiquement.</p>
            </div>
          ) : (
            <div className="space-y-3 p-3 sm:p-4">
              {availableOrders.map(order => {
                const meta = getOfferMeta(order);
                const remaining = formatRemaining(meta.responseDeadline);
                return (
                  <article key={order._id} className="rounded-[20px] border border-gray-200 bg-gray-50/60 p-4 sm:p-5 transition hover:border-emerald-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Nouvelle mission</p><h3 className="mt-1 text-base font-bold text-gray-950 truncate">{order.clientName || order.clientPhone || 'Client'}</h3></div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-mono text-gray-400">{order.orderId}</span>
                        {meta.isTargeted && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Ciblée</span>}
                        {remaining && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-700">{remaining}</span>}
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white border border-gray-100 p-3 space-y-3">
                      <div className="flex gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#0F6B4F]"><MapPin className="h-4 w-4"/></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-gray-400">Destination</p><p className="text-sm font-medium text-gray-800 line-clamp-2">{meta.destination || [order.address, order.city].filter(Boolean).join(', ') || 'Adresse à confirmer'}</p></div></div>
                      {order.product && <div className="flex gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"><Package className="h-4 w-4"/></div><div className="min-w-0"><p className="text-[10px] font-semibold uppercase text-gray-400">Colis</p><p className="text-sm font-medium text-gray-800 line-clamp-2">{order.product}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</p></div></div>}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">À encaisser</p><p className="mt-0.5 text-xl font-bold text-[#0F6B4F]">{formatMoney(order.price || 0, order.currency || 'XAF')}</p></div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><Route className="h-4 w-4"/>{meta.estimatedDistanceLabel || 'Distance à estimer'}</div>
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <button onClick={() => handleAssign(order._id)} disabled={assigning[order._id]} className="min-h-12 px-4 bg-[#0F6B4F] hover:bg-[#0b5942] text-white rounded-xl text-sm font-bold transition disabled:opacity-50">
                        {assigning[order._id] ? 'Acceptation…' : 'Accepter la course'}
                      </button>
                      <button aria-label="Refuser la course" title="Refuser" onClick={() => handleRefuse(order._id)} disabled={assigning[order._id]} className="h-12 w-12 flex items-center justify-center bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition disabled:opacity-50">
                        <X className="h-5 w-5"/>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Disponibles', value: stats.available || 0, iconBg: '#ecfdf5', icon: <Package className="h-5 w-5 text-emerald-700"/>, sub: 'courses à prendre' },
            { label: 'Livrées ce mois', value: stats.thisMonth?.delivered || 0, iconBg: '#eff6ff', icon: <CheckCircle2 className="h-5 w-5 text-blue-700"/>, sub: 'livraisons terminées' },
            { label: 'Total livré', value: stats.allTime?.delivered || 0, iconBg: '#f5f3ff', icon: <History className="h-5 w-5 text-violet-700"/>, sub: 'depuis le début' },
          ].map((k, i) => (
            <div key={i} className={`${i === 2 ? 'col-span-2 lg:col-span-1' : ''} bg-white rounded-[20px] border border-gray-200 p-4 transition`}>
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

      {/* Montant encaissé */}
      {stats && (
        <div className="bg-white rounded-[24px] border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Wallet className="h-5 w-5 text-[#0F6B4F]"/>Montant encaissé</h2>
            <Link to="/ecom/livreur/earnings" className="text-xs text-[#0F6B4F] font-medium hover:underline">Voir tout →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400">Ce mois</p>
              <p className="text-2xl font-black text-gray-900">{fmt(stats.thisMonth?.collected || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total cumulé</p>
              <p className="text-2xl font-black text-[#0F6B4F]">{fmt(stats.allTime?.collected || 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mes livraisons en cours */}
      <div className="bg-white rounded-[24px] border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900"><Navigation className="h-5 w-5 text-[#0F6B4F]"/>Livraisons en cours</h2>
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
                          {assigning[order._id] ? 'En cours…' : 'Colis récupéré'}
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button onClick={() => handleAction(order._id, 'delivered')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50">
                          {assigning[order._id] ? 'En cours…' : 'Confirmer la livraison'}
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

      {/* Actions rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/ecom/livreur/available', icon: <Package className="h-5 w-5"/>, label: 'Courses disponibles', sub: 'Accepter de nouvelles courses' },
          { href: '/ecom/livreur/history', icon: <History className="h-5 w-5"/>, label: 'Historique', sub: 'Toutes vos livraisons terminées' },
          { href: '/ecom/livreur/earnings', icon: <Wallet className="h-5 w-5"/>, label: 'Montant encaissé', sub: 'Détail de vos encaissements' },
        ].map((a, i) => (
          <Link key={i} to={a.href} className="bg-white rounded-[20px] border border-gray-200 p-4 hover:border-emerald-300 transition group flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0F6B4F] flex items-center justify-center shrink-0">{a.icon}</div>
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
