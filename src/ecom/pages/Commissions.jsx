import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const SL = { pending:'En attente', confirmed:'Confirmé', shipped:'Expédié', delivered:'Livré', returned:'Retour', cancelled:'Annulé', unreachable:'Injoignable', called:'Appelé', postponed:'Reporté' };

const STATUS_META = {
  delivered:   { color:'#10B981', bg:'#ecfdf5', text:'#065f46' },
  confirmed:   { color:'#3B82F6', bg:'#eff6ff', text:'#1e40af' },
  pending:     { color:'#F59E0B', bg:'#fffbeb', text:'#92400e' },
  called:      { color:'#8B5CF6', bg:'#f5f3ff', text:'#6b21a8' },
  shipped:     { color:'#0EA5E9', bg:'#f0f9ff', text:'#0369a1' },
  postponed:   { color:'#EC4899', bg:'#fdf2f8', text:'#9d174d' },
  unreachable: { color:'#94A3B8', bg:'#f8fafc', text:'#475569' },
  returned:    { color:'#F97316', bg:'#fff7ed', text:'#9a3412' },
  cancelled:   { color:'#EF4444', bg:'#fef2f2', text:'#991b1b' },
};

const MONTH_NAMES = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const PERIODS = [{v:'today',l:"Aujourd'hui"},{v:'week',l:'7 jours'},{v:'month',l:'Ce mois'},{v:'year',l:'Cette année'}];

const Commissions = () => {
  const { user } = useEcomAuth();
  const { fmt, symbol } = useMoney();
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
      if (res.data.success) {
        setData(res.data.data);
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

  const maxBar = data?.monthlyHistory?.length ? Math.max(...data.monthlyHistory.map(m => m.count), 1) : 1;

  // Commission display helpers
  const commRate = data?.commissionRate ?? 0;
  const commType = data?.commissionType ?? 'fixed';
  const commLabel = commRate > 0
    ? (commType === 'percentage' ? `${commRate}% du CA livré` : `${fmt(commRate)} / livraison`)
    : 'Non configurée';

  // Scalor Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#0F6B4F] animate-spin" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8FAFC' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ── HEADER ── */}
        <div className="mb-5">
          <Link
            to="/ecom/dashboard/closeuse"
            className="inline-flex items-center text-xs font-semibold text-[#0F6B4F] active:text-[#0A5740] transition-colors mb-2 gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour
          </Link>
          <h1 className="text-2xl font-black text-gray-900 leading-tight">
            Mes Commissions 💰
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{commLabel}</p>
        </div>

        {/* ── PERIOD TABS ── */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-5 shadow-sm overflow-x-auto no-scrollbar">
          {PERIODS.map(p => (
            <button
              key={p.v}
              onClick={() => setPeriod(p.v)}
              className={`flex-1 min-w-[70px] px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                period === p.v
                  ? 'bg-[#0F6B4F] text-white shadow'
                  : 'text-gray-500 hover:text-gray-700 active:bg-gray-100'
              }`}
            >
              {p.l}
            </button>
          ))}
        </div>

        {data ? (
          <div className="space-y-4">

            {/* ── HERO STATS ROW ── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Commission Totale */}
              <div
                className="col-span-2 rounded-2xl border shadow-sm p-5 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#065f46 0%,#047857 100%)', borderColor: '#047857' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">Gains Totaux</span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-200" />
                  </span>
                </div>
                <p className="text-3xl sm:text-4xl font-black text-white leading-none">
                  {data?.totalCommission > 0 ? fmt(data.totalCommission) : `0 ${symbol}`}
                </p>
                <p className="text-xs text-emerald-300 mt-1.5">{commLabel}</p>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/5" />
                <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/3" />
              </div>

              {/* Livrées */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Livrées</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 leading-none">{data?.deliveredCount || 0}</p>
                <p className="text-xs text-gray-400 mt-1">commandes livrées</p>
              </div>

              {/* Total */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 leading-none">{data?.totalOrders || 0}</p>
                <p className="text-xs text-gray-400 mt-1">toutes commandes</p>
              </div>
            </div>

            {/* ── TAUX DE SUCCÈS ── */}
            {data.totalOrders > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Taux de Succès</h3>
                    <p className="text-xs text-gray-400">Commandes livrées / total</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black leading-none text-emerald-500">
                      {Math.round((data.deliveredCount / data.totalOrders) * 100)}%
                    </p>
                  </div>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-0 h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(Math.round((data.deliveredCount / data.totalOrders) * 100), 100)}%`,
                      background: 'linear-gradient(90deg,#10B98188,#10B981)'
                    }}
                  />
                </div>
              </div>
            )}

            {/* ── STATUTS + HISTORIQUE ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Status Breakdown */}
              {data.byStatus && Object.keys(data.byStatus).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    Répartition
                  </h3>
                  <div className="space-y-2.5">
                    {Object.entries(data.byStatus)
                      .sort((a, b) => b[1].count - a[1].count)
                      .map(([status, info]) => {
                        const pct = data.totalOrders > 0 ? Math.round((info.count / data.totalOrders) * 100) : 0;
                        const meta = STATUS_META[status] || { color: '#94A3B8', bg: '#f8fafc', text: '#475569' };
                        return (
                          <div key={status} className="flex items-center gap-2.5">
                            <span
                              className="text-[11px] font-semibold w-20 flex-shrink-0 truncate"
                              style={{ color: meta.text }}
                            >
                              {SL[status] || status}
                            </span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: meta.color }}
                              />
                            </div>
                            <span className="text-xs font-black text-gray-700 w-5 text-right">{info.count}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Monthly History */}
              {data.monthlyHistory && data.monthlyHistory.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#C56A2D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    12 Mois
                  </h3>
                  <div className="flex items-end gap-1.5 h-36">
                    {data.monthlyHistory.map((m, i) => {
                      const height = maxBar > 0 ? Math.max((m.count / maxBar) * 100, 5) : 5;
                      const isCurrentMonth = m.year === new Date().getFullYear() && m.month === new Date().getMonth() + 1;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative min-w-0">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-20 shadow-xl">
                            <div className="text-gray-400 text-[9px] uppercase tracking-wider mb-0.5">{MONTH_NAMES[m.month - 1]} {m.year}</div>
                            {m.count} livrées<br /><span className="text-emerald-400">{fmt(m.commission)}</span>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                          </div>

                          <div
                            className={`w-full rounded-lg transition-all duration-500 cursor-pointer ${
                              isCurrentMonth
                                ? 'shadow-lg'
                                : 'group-hover:opacity-80'
                            }`}
                            style={{
                              height: `${height}%`,
                              background: isCurrentMonth
                                ? 'linear-gradient(180deg,#0F6B4F,#0A5740)'
                                : '#E2E8F0',
                              boxShadow: isCurrentMonth ? '0 4px 12px rgba(15,107,79,0.3)' : 'none'
                            }}
                          />
                          <span className={`text-[9px] sm:text-[10px] font-bold truncate w-full text-center ${
                            isCurrentMonth ? 'text-[#0F6B4F]' : 'text-gray-400'
                          }`}>
                            {MONTH_NAMES[m.month - 1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── CA Livré (si on a une commission au %) ── */}
            {commType === 'percentage' && data.deliveredRevenue > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">CA Livré</h3>
                    <p className="text-xs text-gray-400">Chiffre d'affaires des commandes livrées</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-gray-900">{fmt(data.deliveredRevenue)}</p>
                    <p className="text-xs text-[#C56A2D] font-semibold">{commRate}% → {fmt(data.totalCommission)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── DELIVERED ORDERS COLLAPSIBLE ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={handleToggleOrders}
                className="w-full flex items-center justify-between p-4 sm:p-5 active:bg-gray-50 transition-colors focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#0F6B4F,#0A5740)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-800 leading-tight">Détails des Livraisons</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Consultez chaque commande</p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center transition-transform duration-300 flex-shrink-0 ${
                  showOrders ? 'rotate-180 bg-[#0F6B4F]/10 text-[#0F6B4F]' : 'text-gray-400'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {showOrders && (
                <div className="border-t border-gray-100">
                  {loadingOrders ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#0F6B4F]">
                      <div className="w-7 h-7 border-3 border-gray-200 border-t-[#0F6B4F] rounded-full animate-spin" />
                      <span className="text-xs font-semibold">Chargement…</span>
                    </div>
                  ) : deliveredOrders.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-10">Aucune commande livrée.</p>
                  ) : (
                    <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                      {deliveredOrders.map((order, idx) => (
                        <div key={order._id} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors">
                          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
                              {order.clientName || order.clientPhone || 'Client inconnu'}
                            </p>
                            <p className="text-xs text-gray-400 truncate flex items-center gap-1.5">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">{order.product || 'Produit'}</span>
                              {order.city && <span>📍 {order.city}</span>}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black text-emerald-600">
                              +{commType === 'percentage'
                                ? fmt(Math.round((order.price || 0) * (order.quantity || 1) * commRate / 100))
                                : fmt(commRate)
                              }
                            </p>
                            <p className="text-[10px] text-gray-400">{order.date ? new Date(order.date).toLocaleDateString('fr-FR') : ''}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {deliveredOrders.length > 0 && (
                    <div className="px-4 py-4 flex items-center justify-between border-t border-gray-100"
                      style={{ background: 'linear-gradient(90deg,#ecfdf5,#f0fdf4)' }}>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">{deliveredOrders.length} livraisons</span>
                      <span className="text-lg font-black text-emerald-600">{fmt(data.totalCommission)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { to: '/ecom/orders?status=delivered', emoji: '📦', label: 'Commandes', sub: 'Voir tout', color: '#0F6B4F' },
                { to: '/ecom/dashboard/closeuse', emoji: '🏠', label: 'Accueil', sub: 'Dashboard', color: '#0A5740' },
                { to: '/ecom/reports/new', emoji: '📝', label: 'Rapport', sub: 'Saisir', color: '#C56A2D' },
              ].map(({ to, emoji, label, sub, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:shadow-none active:translate-y-0.5 transition-all text-center"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-0.5"
                    style={{ background: `${color}12` }}
                  >
                    {emoji}
                  </div>
                  <p className="text-xs font-bold text-gray-900">{label}</p>
                  <p className="text-[10px] text-gray-400">{sub}</p>
                </Link>
              ))}
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 mb-5 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">Aucune donnée</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Vérifiez avec votre administrateur que des sources vous ont bien été assignées.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Commissions;
