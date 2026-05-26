import React, { useEffect, useState, useCallback } from 'react';
import {
  Store, ChevronDown, TrendingUp, ShoppingCart, DollarSign, CheckCircle2,
  Users, RefreshCw, AlertTriangle, Trophy, Calendar, Clock, Package,
} from 'lucide-react';
import { superAdminApi } from '../services/ecommApi.js';
import { CenteredSpinner } from '../components/Skeleton.jsx';
import SuperAdminShell from '../components/SuperAdminShell';

/* ── helpers ── */
const nFmt = new Intl.NumberFormat('fr-FR');
const fmtMoney = (v) => `${nFmt.format(Math.round(v || 0))} XAF`;
const fmtTime = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const STATUS_COLORS = {
  livré: 'bg-primary-100 text-primary-700',
  livrée: 'bg-primary-100 text-primary-700',
  livree: 'bg-primary-100 text-primary-700',
  delivered: 'bg-primary-100 text-primary-700',
  confirmé: 'bg-sky-100 text-sky-700',
  confirmed: 'bg-sky-100 text-sky-700',
  annulé: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
  'en attente': 'bg-amber-100 text-amber-700',
};
const statusColor = (s) => STATUS_COLORS[s?.toLowerCase()] || 'bg-slate-100 text-slate-600';

const MEDAL = ['🥇', '🥈', '🥉'];

/* ── KPI card ── */
function KpiCard({ icon: Icon, label, value, sub, accent = '#10b981' }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1"
         style={{ background: '#fff', border: '1px solid #e8edf2', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${accent}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <span className="text-xs font-semibold text-slate-500 truncate">{label}</span>
      </div>
      <span className="text-xl font-black text-slate-800 leading-none">{value}</span>
      {sub && <span className="text-xs text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

/* ── Period section ── */
function PeriodSection({ label, stats, top, icon: Icon }) {
  if (!stats) return null;
  const statusEntries = Object.entries(stats.byStatus || {});
  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ border: '1px solid #e8edf2', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100"
           style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="font-bold text-sm text-slate-700">{label}</span>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard icon={ShoppingCart} label="Commandes" value={nFmt.format(stats.orders)} accent="#6366f1" />
          <KpiCard icon={CheckCircle2} label="Confirmées" value={nFmt.format(stats.confirmed)} accent="#10b981" />
          <KpiCard
            icon={DollarSign} label="CA généré"
            value={stats.revenue >= 1000000
              ? `${(stats.revenue / 1000000).toFixed(1)}M`
              : stats.revenue >= 1000
              ? `${(stats.revenue / 1000).toFixed(0)}k`
              : nFmt.format(Math.round(stats.revenue))}
            sub="XAF"
            accent="#f59e0b"
          />
          <KpiCard
            icon={TrendingUp} label="Taux confirm."
            value={stats.orders > 0 ? `${Math.round((stats.confirmed / stats.orders) * 100)}%` : '—'}
            accent="#0ea5e9"
          />
        </div>

        {/* Right: statuses + top vendors */}
        <div className="flex flex-col gap-3">
          {/* Status breakdown */}
          {statusEntries.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Statuts</p>
              <div className="flex flex-wrap gap-1.5">
                {statusEntries.map(([s, v]) => (
                  <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(s)}`}>
                    {s} <span className="opacity-70">({v.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 closers */}
          {top?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Top vendeurs</p>
              <div className="flex flex-col gap-1.5">
                {top.map((v, i) => (
                  <div key={v.userId || i}
                       className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                       style={{ background: i === 0 ? 'linear-gradient(135deg, #fef9c3, #fef3c7)' : '#f8fafc', border: '1px solid #e8edf2' }}>
                    <span className="text-base leading-none">{MEDAL[i]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{v.name || v.email || `ID ${String(v.userId).slice(-6)}`}</p>
                      <p className="text-[10px] text-slate-400 truncate">{v.role || 'vendeur'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-black text-primary-600">{nFmt.format(v.sold || 0)} ventes</p>
                      <p className="text-[10px] text-slate-400">{nFmt.format(v.orders || 0)} cmdes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!top || top.length === 0) && (
            <p className="text-xs text-slate-400 italic">Aucun vendeur sur cette période</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
const SuperAdminBoutiqueStats = () => {
  const [listData, setListData]     = useState(null); // { workspaces, stores }
  const [statsData, setStatsData]   = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedStore, setSelectedStore]         = useState('');

  /* Load selector list once */
  useEffect(() => {
    superAdminApi.getBoutiqueSelector()
      .then(r => setListData(r.data.data))
      .catch(() => setError('Impossible de charger la liste des boutiques'))
      .finally(() => setListLoading(false));
  }, []);

  /* Load stats when workspace selected */
  const loadStats = useCallback(async (wsId, stId, isRefresh = false) => {
    if (!wsId) return;
    isRefresh ? setRefreshing(true) : setStatsLoading(true);
    setError(null);
    try {
      const params = { workspaceId: wsId };
      if (stId) params.storeId = stId;
      const r = await superAdminApi.getBoutiqueStats(params);
      setStatsData(r.data.data);
    } catch (e) {
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) loadStats(selectedWorkspace, selectedStore);
  }, [selectedWorkspace, selectedStore, loadStats]);

  /* Stores filtered by selected workspace */
  const filteredStores = listData?.stores?.filter(
    s => String(s.workspaceId) === selectedWorkspace
  ) || [];

  /* Selected workspace name */
  const wsName = statsData?.workspace?.name
    || listData?.workspaces?.find(w => String(w._id) === selectedWorkspace)?.name
    || 'Boutique';

  return (
    <SuperAdminShell
      title="Stats Boutique"
      subtitle={selectedWorkspace ? wsName : 'Sélectionnez une boutique'}
      icon={Store}
      refreshing={refreshing}
      onRefresh={selectedWorkspace ? () => loadStats(selectedWorkspace, selectedStore, true) : undefined}
      error={error}
    >
      {/* ── Selector bar ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Workspace selector */}
        <div className="relative">
          <select
            value={selectedWorkspace}
            onChange={e => { setSelectedWorkspace(e.target.value); setSelectedStore(''); setStatsData(null); }}
            className="appearance-none pl-4 pr-8 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            style={{ background: '#fff', border: '1px solid #d1d9e0', minWidth: 220 }}
            disabled={listLoading}
          >
            <option value="">— Choisir une workspace —</option>
            {listData?.workspaces?.map(w => (
              <option key={w._id} value={w._id}>{w.name || w.subdomain || String(w._id).slice(-6)}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Store selector — only when stores exist for this workspace */}
        {selectedWorkspace && filteredStores.length > 0 && (
          <div className="relative">
            <select
              value={selectedStore}
              onChange={e => { setSelectedStore(e.target.value); setStatsData(null); }}
              className="appearance-none pl-4 pr-8 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
              style={{ background: '#fff', border: '1px solid #d1d9e0', minWidth: 180 }}
            >
              <option value="">Toutes les stores</option>
              {filteredStores.map(s => (
                <option key={s._id} value={s._id}>{s.name || s.subdomain || String(s._id).slice(-6)}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── States ── */}
      {listLoading && <CenteredSpinner />}

      {!listLoading && !selectedWorkspace && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))' }}>
            <Store className="w-8 h-8 text-primary-400" />
          </div>
          <div>
            <p className="font-bold text-slate-700">Sélectionnez une boutique</p>
            <p className="text-sm text-slate-400 mt-1">Choisissez une workspace dans le menu ci-dessus pour voir les statistiques</p>
          </div>
        </div>
      )}

      {!listLoading && selectedWorkspace && statsLoading && <CenteredSpinner />}

      {!listLoading && selectedWorkspace && !statsLoading && statsData && (
        <div className="flex flex-col gap-6">
          {/* Workspace info strip */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
               style={{ background: 'linear-gradient(135deg, #0c1425, #162032)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Store className="w-4.5 h-4.5 text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate">{statsData.workspace?.name || wsName}</p>
              {statsData.workspace?.subdomain && (
                <p className="text-xs text-slate-400 truncate">{statsData.workspace.subdomain}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statsData.workspace?.isActive ? 'bg-primary-500/20 text-primary-300' : 'bg-red-500/20 text-red-300'}`}>
                {statsData.workspace?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Period sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <PeriodSection label="Aujourd'hui" stats={statsData.day} top={statsData.topDay} icon={Clock} />
            <PeriodSection label="Cette semaine" stats={statsData.week} top={statsData.topWeek} icon={Calendar} />
            <PeriodSection label="Ce mois" stats={statsData.month} top={statsData.topMonth} icon={TrendingUp} />
          </div>

          {/* Today's orders feed */}
          {statsData.todayOrders?.length > 0 && (
            <div className="rounded-2xl overflow-hidden"
                 style={{ border: '1px solid #e8edf2', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100"
                   style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="font-bold text-sm text-slate-700">Commandes du jour</span>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {statsData.todayOrders.length} cmdes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Client</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Produit</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Prix</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Statut</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Heure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsData.todayOrders.map((o, i) => (
                      <tr key={o._id || i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-700 max-w-[120px] truncate">
                          {o.customerName || o.clientName || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[140px] truncate">
                          {o.product || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                          {o.price ? fmtMoney(o.price) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(o.status)}`}>
                            {o.status || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">
                          {fmtTime(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {statsData.todayOrders?.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 rounded-2xl text-slate-400 text-sm"
                 style={{ border: '1px dashed #d1d9e0' }}>
              <ShoppingCart className="w-4 h-4" />
              Aucune commande aujourd'hui
            </div>
          )}
        </div>
      )}
    </SuperAdminShell>
  );
};

export default SuperAdminBoutiqueStats;
