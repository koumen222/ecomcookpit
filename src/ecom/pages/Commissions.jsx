import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const SL = { pending:'En attente', confirmed:'Confirmé', shipped:'Expédié', delivered:'Livré', returned:'Retour', cancelled:'Annulé', unreachable:'Injoignable', called:'Appelé', postponed:'Reporté' };
const SC = {
  pending:'bg-yellow-50 text-yellow-700 border-yellow-200',
  confirmed:'bg-emerald-50 text-emerald-700 border-emerald-200',
  shipped:'bg-emerald-50 text-emerald-800 border-emerald-200',
  delivered:'bg-green-50 text-green-700 border-green-200',
  returned:'bg-orange-50 text-orange-700 border-orange-200',
  cancelled:'bg-red-50 text-red-700 border-red-200',
  unreachable:'bg-gray-50 text-gray-600 border-gray-200',
  called:'bg-cyan-50 text-cyan-700 border-cyan-200',
  postponed:'bg-amber-50 text-amber-700 border-amber-200',
};

const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const PERIODS = [{v:'today',l:"Aujourd'hui"},{v:'week',l:'7 jours'},{v:'month',l:'Ce mois'},{v:'year',l:'Cette année'}];

const Commissions = () => {
  const { user } = useEcomAuth();
  const { fmt } = useMoney();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showOrders, setShowOrders] = useState(false);

  const fetchCommissions = async (p) => {
    try {
      setLoading(true);
      const res = await ecomApi.get(`/orders/my-commissions?period=${p}`);
      console.log('📊 Commissions data:', res.data);
      if (res.data.success) {
        setData(res.data.data);
        console.log('✅ Data set:', res.data.data);
        console.log('💰 Commission:', res.data.data.totalCommission);
        console.log('📦 Delivered count:', res.data.data.deliveredCount);
        console.log('📈 Rate:', res.data.data.commissionRate);
        console.log('📋 ByStatus:', res.data.data.byStatus);
      }
    } catch (e) {
      console.error('❌ Error fetching commissions:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveredOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await ecomApi.get('/orders?status=delivered&limit=200');
      setDeliveredOrders(res.data.data.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => { fetchCommissions(period); }, [period]);

  const handleToggleOrders = () => {
    if (!showOrders && deliveredOrders.length === 0) fetchDeliveredOrders();
    setShowOrders(v => !v);
  };

  const firstName = user?.name?.split(' ')[0] || 'vous';
  const maxBar = data?.monthlyHistory?.length ? Math.max(...data.monthlyHistory.map(m => m.count), 1) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/ecom/dashboard/closeuse" className="text-xs text-gray-400 hover:text-gray-600 transition">← Accueil</Link>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Mes Commissions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {data?.commissionRate ? `${data.commissionRate.toLocaleString('fr-FR')} FCFA par commande livrée` : 'Chargement...'}
            </p>
          </div>
          {/* Sélecteur période */}
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm self-start sm:self-auto">
            {PERIODS.map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === p.v ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-amber-600">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Calcul des commissions...</span>
          </div>
        ) : data ? (
          <>
            {/* HERO — Commission totale */}
            <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 rounded-3xl p-6 mb-5 shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-10 -mb-10" />
              <div className="relative z-10">
                <p className="text-sm font-semibold text-amber-100 mb-1 uppercase tracking-wide">Commission totale</p>
                <p className="text-5xl font-black tracking-tight mb-2">
                  {data?.totalCommission > 0 ? fmt(data.totalCommission) : `0 FCFA`}
                </p>
                <div className="flex items-center gap-4 text-amber-100 text-sm">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    {data?.deliveredCount || 0} livrées
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    {data?.totalOrders || 0} total
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                    {data?.totalOrders > 0 ? Math.round((data.deliveredCount / data.totalOrders) * 100) : 0}% taux
                  </span>
                </div>
              </div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Commission', value: fmt(data.totalCommission || 0), sub: 'période sélectionnée', bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', text: 'text-amber-700', icon: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
                { label: 'Livrées', value: data.deliveredCount || 0, sub: `sur ${data.totalOrders || 0} commandes`, bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-700', icon: <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
                { label: 'Taux livraison', value: `${data.totalOrders > 0 ? Math.round((data.deliveredCount / data.totalOrders) * 100) : 0}%`, sub: 'commandes livrées', bg: 'from-emerald-50 to-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
                { label: 'Par livraison', value: fmt(data.commissionRate || 0), sub: 'taux fixe', bg: 'from-emerald-50 to-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
              ].map((k, i) => (
                <div key={i} className={`bg-gradient-to-br ${k.bg} rounded-2xl border ${k.border} p-4 shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{k.label}</p>
                    <div>{k.icon}</div>
                  </div>
                  <p className={`text-xl font-extrabold ${k.text} leading-tight mb-0.5`}>{k.value}</p>
                  <p className="text-[10px] text-gray-400">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* BARRE DE PROGRESSION */}
            {data.totalOrders > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800">Progression des livraisons</h3>
                  <span className="text-sm font-black text-green-600">{Math.round((data.deliveredCount / data.totalOrders) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-green-500 h-3 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(Math.round((data.deliveredCount / data.totalOrders) * 100), 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0</span>
                  <span className="font-semibold text-gray-600">{data.deliveredCount} livrées / {data.totalOrders} total</span>
                  <span>{data.totalOrders}</span>
                </div>
              </div>
            )}

            {/* RÉPARTITION PAR STATUT */}
            {data.byStatus && Object.keys(data.byStatus).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Répartition par statut</h3>
                <div className="space-y-2.5">
                  {Object.entries(data.byStatus)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([status, info]) => {
                      const pct = data.totalOrders > 0 ? Math.round((info.count / data.totalOrders) * 100) : 0;
                      const colors = {
                        delivered: '#10B981', confirmed: '#0A5740', pending: '#F59E0B',
                        shipped: '#0F6B4F', returned: '#f97316', cancelled: '#EF4444',
                        unreachable: '#94a3b8', called: '#14855F', postponed: '#ec4899'
                      };
                      const color = colors[status] || '#94a3b8';
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${SC[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                            {SL[status] || status}
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-6 text-right flex-shrink-0">{info.count}</span>
                          <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{pct}%</span>
                          {status === 'delivered' && (
                            <span className="text-xs font-bold text-amber-600 flex-shrink-0">{fmt(info.count * (data.commissionRate || 0))}</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* HISTORIQUE MENSUEL */}
            {data.monthlyHistory && data.monthlyHistory.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Historique mensuel (12 mois)</h3>
                <div className="flex items-end gap-2 h-28 mb-3">
                  {data.monthlyHistory.map((m, i) => {
                    const height = maxBar > 0 ? Math.max((m.count / maxBar) * 100, 4) : 4;
                    const isCurrentMonth = m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${MONTH_NAMES[m.month - 1]} ${m.year}: ${m.count} livrées — ${m.commission.toLocaleString('fr-FR')} FCFA`}>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {m.count} livrées<br />{m.commission.toLocaleString('fr-FR')} FCFA
                        </div>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 ${isCurrentMonth ? 'bg-gradient-to-t from-amber-500 to-orange-400' : 'bg-gradient-to-t from-amber-200 to-amber-300 group-hover:from-amber-400 group-hover:to-amber-300'}`}
                          style={{ height: `${height}%` }}
                        />
                        <span className={`text-[9px] font-medium ${isCurrentMonth ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                          {MONTH_NAMES[m.month - 1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Totaux mensuels */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                  {(() => {
                    const total = data.monthlyHistory.reduce((s, m) => s + m.count, 0);
                    const totalComm = data.monthlyHistory.reduce((s, m) => s + m.commission, 0);
                    const avg = data.monthlyHistory.length > 0 ? Math.round(total / data.monthlyHistory.length) : 0;
                    return [
                      { label: 'Total livrées (12m)', value: total },
                      { label: 'Commission totale (12m)', value: fmt(totalComm) },
                      { label: 'Moyenne / mois', value: `${avg} livrées` },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <p className="text-sm font-extrabold text-gray-800">{s.value}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* COMMANDES LIVRÉES */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
              <button
                onClick={handleToggleOrders}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">Commandes livrées</p>
                    <p className="text-xs text-gray-400">Détail de chaque commission</p>
                  </div>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showOrders ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {showOrders && (
                <div className="border-t border-gray-100">
                  {loadingOrders ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
                      <span className="text-sm">Chargement...</span>
                    </div>
                  ) : deliveredOrders.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Aucune commande livrée</p>
                  ) : (
                    <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                      {deliveredOrders.map(order => (
                        <div key={order._id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{order.clientName || order.clientPhone || '—'}</p>
                            <p className="text-xs text-gray-400 truncate">{order.product || ''} {order.city ? `· ${order.city}` : ''}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-amber-600">+{(data.commissionRate || 0).toLocaleString('fr-FR')} FCFA</p>
                            <p className="text-[10px] text-gray-400">{order.date ? new Date(order.date).toLocaleDateString('fr-FR') : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {deliveredOrders.length > 0 && (
                    <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-700">{deliveredOrders.length} commandes livrées</span>
                      <span className="text-sm font-extrabold text-amber-700">{fmt(deliveredOrders.length * (data.commissionRate || 0))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/ecom/orders?status=delivered"
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Mes commandes</p>
                  <p className="text-xs text-gray-400 mt-0.5">Voir toutes les commandes</p>
                </div>
              </Link>
              <Link to="/ecom/reports/new"
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Rapport du jour</p>
                  <p className="text-xs text-gray-400 mt-0.5">Saisir mes résultats</p>
                </div>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-sm font-medium">Aucune donnée de commission disponible</p>
            <p className="text-xs mt-1">Vérifiez que vous avez des sources assignées</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Commissions;
