import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock, Search, TrendingUp, ShoppingCart, Store, AlertTriangle,
  Users, Package, ChevronUp, ChevronDown, BarChart2, UserCheck, UserX,
} from 'lucide-react';
import { analyticsApi } from '../services/analytics.js';
import { CenteredSpinner } from '../components/Skeleton.jsx';
import SuperAdminShell from '../components/SuperAdminShell';

/* ─────────────────────────────────────────────── helpers ── */
const nFmt = new Intl.NumberFormat('fr-FR');
const fmtMoney = (v, cur = 'XAF') => `${nFmt.format(Math.round(v || 0))} ${cur}`;
const fmtDate = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
const timeAgo = (v) => {
  if (!v) return 'Jamais';
  const diff = Date.now() - new Date(v).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Hier';
  if (d < 7) return `${d}j`;
  if (d < 30) return `${Math.floor(d / 7)}sem`;
  return fmtDate(v);
};

const ROLE_LABELS = {
  super_admin: 'Super Admin', ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse', ecom_compta: 'Comptable', ecom_livreur: 'Livreur',
};
const ROLE_COLORS = {
  super_admin: 'bg-amber-100 text-amber-700',
  ecom_admin: 'bg-primary-100 text-primary-700',
  ecom_closeuse: 'bg-sky-100 text-sky-700',
  ecom_compta: 'bg-violet-100 text-violet-700',
  ecom_livreur: 'bg-orange-100 text-orange-700',
};

/* ─────────────────────────────────────────────── component ── */
const SuperAdminActivity = () => {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [productLeaderboard, setProductLeaderboard] = useState([]);
  const [productsLoading, setProductsLoading]       = useState(false);

  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');
  const [tab, setTab]         = useState('boutiques'); // boutiques | users | products | logins

  /* ── loaders ── */
  const loadProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await analyticsApi.getProductLeaderboard();
      setProductLeaderboard(res.data?.data?.productLeaderboard || []);
    } catch (err) {
      console.error('products load error:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setPageError(null);
    try {
      const res = await analyticsApi.getUsersActivity({ limit: 100 });
      const payload = res.data?.data || null;
      setData(payload);
      if (!payload) setPageError('Aucune donnée reçue du serveur.');
      else loadProducts();
    } catch (err) {
      setData(null);
      setPageError(err?.response?.data?.message || err?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ── flatten stores ── */
  const allStores = useMemo(() => {
    if (!data?.boutiqueActivity) return [];
    return data.boutiqueActivity.flatMap(user =>
      (user.stores || []).map(store => ({
        ...store,
        ownerEmail: user.email, ownerName: user.name,
        ownerRole: user.role, ownerIsActive: user.isActive,
        ownerLastLogin: user.lastLogin,
      }))
    );
  }, [data]);

  /* ── global KPIs ── */
  const kpis = useMemo(() => {
    const totalRevenue = allStores.reduce((s, b) => s + (b.totalRevenue || 0), 0);
    const totalOrders  = allStores.reduce((s, b) => s + (b.totalOrders  || 0), 0);
    const active       = allStores.filter(s => s.isActive).length;
    const withOrders   = allStores.filter(s => (s.totalOrders || 0) > 0).length;
    const week7        = 7 * 24 * 3600 * 1000;
    const recentlyActive = allStores.filter(s => s.lastOrderAt && Date.now() - new Date(s.lastOrderAt).getTime() < week7).length;
    return {
      total: allStores.length, active, inactive: allStores.length - active,
      withOrders, noOrders: allStores.length - withOrders,
      totalRevenue, totalOrders, recentlyActive,
      avgRevenue: allStores.length ? totalRevenue / allStores.length : 0,
    };
  }, [allStores]);

  /* ── user stats ── */
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort]     = useState('revenue');
  const [userSortDir, setUserSortDir] = useState('desc');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const toggleUserSort = (key) => {
    if (userSort === key) setUserSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setUserSort(key); setUserSortDir('desc'); }
  };
  const UserSortIcon = ({ k }) => userSort === k
    ? (userSortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : null;

  const allUsers = useMemo(() => {
    if (!data?.boutiqueActivity) return [];
    return data.boutiqueActivity;
  }, [data]);

  const roleDistrib = useMemo(() => {
    const map = {};
    allUsers.forEach(u => { map[u.role || 'unknown'] = (map[u.role || 'unknown'] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [allUsers]);

  const userKpis = useMemo(() => {
    const total      = allUsers.length;
    const active     = allUsers.filter(u => u.isActive).length;
    const withOrders = allUsers.filter(u => (u.totalOrders || 0) > 0).length;
    const week7      = 7 * 24 * 3600 * 1000;
    const recentCnx  = allUsers.filter(u => u.lastLogin && Date.now() - new Date(u.lastLogin).getTime() < week7).length;
    const totalRev   = allUsers.reduce((s, u) => s + (u.totalRevenue || 0), 0);
    return { total, active, inactive: total - active, withOrders, noOrders: total - withOrders, recentCnx, totalRev };
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    let list = [...allUsers];
    if (userRoleFilter !== 'all') list = list.filter(u => (u.role || 'unknown') === userRoleFilter);
    const term = userSearch.trim().toLowerCase();
    if (term) list = list.filter(u =>
      [u.email, u.name].some(v => String(v || '').toLowerCase().includes(term))
    );
    list.sort((a, b) => {
      let va = 0, vb = 0;
      if (userSort === 'revenue')  { va = a.totalRevenue || 0; vb = b.totalRevenue || 0; }
      if (userSort === 'orders')   { va = a.totalOrders  || 0; vb = b.totalOrders  || 0; }
      if (userSort === 'boutiques'){ va = a.boutiqueCount || 0; vb = b.boutiqueCount || 0; }
      if (userSort === 'login')    { va = a.lastLogin ? +new Date(a.lastLogin) : 0; vb = b.lastLogin ? +new Date(b.lastLogin) : 0; }
      if (userSort === 'created')  { va = a.createdAt ? +new Date(a.createdAt) : 0; vb = b.createdAt ? +new Date(b.createdAt) : 0; }
      return userSortDir === 'desc' ? vb - va : va - vb;
    });
    return list;
  }, [allUsers, userSearch, userSort, userSortDir, userRoleFilter]);

  /* ── sorted / filtered boutiques ── */
  const filteredStores = useMemo(() => {
    let list = [...allStores];
    const term = search.trim().toLowerCase();
    if (term) list = list.filter(s =>
      [s.name, s.subdomain, s.workspaceName, s.ownerEmail, s.ownerName]
        .some(v => String(v || '').toLowerCase().includes(term))
    );
    list.sort((a, b) => {
      let va = 0, vb = 0;
      if (sortBy === 'revenue')   { va = a.totalRevenue || 0; vb = b.totalRevenue || 0; }
      if (sortBy === 'orders')    { va = a.totalOrders  || 0; vb = b.totalOrders  || 0; }
      if (sortBy === 'products')  { va = a.totalProducts || 0; vb = b.totalProducts || 0; }
      if (sortBy === 'lastOrder') { va = a.lastOrderAt ? +new Date(a.lastOrderAt) : 0; vb = b.lastOrderAt ? +new Date(b.lastOrderAt) : 0; }
      if (sortBy === 'created')   { va = a.createdAt ? +new Date(a.createdAt) : 0; vb = b.createdAt ? +new Date(b.createdAt) : 0; }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return list;
  }, [allStores, search, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };
  const SortIcon = ({ k }) => sortBy === k
    ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)
    : null;

  const recentLogins = data?.recentLogins || [];
  const boutiqueTotals = data?.boutiqueTotals || {};

  if (loading) return <CenteredSpinner message="Chargement activité boutiques…" />;

  const subtitle = data
    ? `${kpis.total} boutiques · ${kpis.active} actives · ${fmtMoney(kpis.totalRevenue)} CA total`
    : 'Données non disponibles';

  const TABS = [
    { key: 'boutiques', label: 'Boutiques',       icon: Store,      count: kpis.total },
    { key: 'users',     label: 'Utilisateurs',    icon: Users,      count: allUsers.length },
    { key: 'products',  label: 'Produits',        icon: Package,    count: productLeaderboard.length },
    { key: 'logins',    label: 'Connexions',      icon: Clock,      count: recentLogins.length },
  ];

  return (
    <SuperAdminShell
      title="Activité boutiques"
      subtitle={subtitle}
      icon={Store}
      error={pageError}
      refreshing={refreshing}
      onRefresh={() => load(true)}
    >
      {pageError && !data ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <div>
            <p className="text-base font-bold text-slate-700">Impossible de charger les données</p>
            <p className="text-sm text-slate-500 mt-1">{pageError}</p>
          </div>
          <button onClick={() => load(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── KPI band ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
            {[
              { label: 'Boutiques',      value: nFmt.format(kpis.total),                             sub: `${kpis.active} actives`,               icon: Store,       accent: 'text-slate-800'   },
              { label: 'CA total',       value: fmtMoney(boutiqueTotals.totalRevenue || kpis.totalRevenue), sub: `Moy. ${fmtMoney(kpis.avgRevenue)}/boutique`, icon: TrendingUp,  accent: 'text-primary-700' },
              { label: 'Commandes',      value: nFmt.format(boutiqueTotals.totalOrders || kpis.totalOrders), sub: 'Total commandes',                 icon: ShoppingCart, accent: 'text-blue-700'   },
              { label: 'Produits',       value: nFmt.format(boutiqueTotals.totalProducts || 0),      sub: 'En boutique',                           icon: Package,     accent: 'text-violet-700'  },
              { label: 'Actives 7j',     value: nFmt.format(kpis.recentlyActive),                   sub: 'Commande < 7 jours',                    icon: BarChart2,   accent: 'text-amber-700'   },
              { label: 'Sans commandes', value: nFmt.format(kpis.noOrders),                         sub: `${Math.round((kpis.noOrders / Math.max(kpis.total, 1)) * 100)}% du parc`, icon: AlertTriangle, accent: 'text-red-600' },
            ].map(k => (
              <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
                  <k.icon className="w-3.5 h-3.5 text-slate-300" />
                </div>
                <p className={`text-xl font-extrabold tabular-nums tracking-tight ${k.accent}`}>{k.value}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* tab bar */}
            <div className="flex border-b border-slate-100">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all relative flex-shrink-0 ${
                    tab === t.key ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.count}
                    </span>
                  )}
                  {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-t" />}
                </button>
              ))}
            </div>

            {/* ── BOUTIQUES tab ── */}
            {tab === 'boutiques' && (
              <div>
                {/* controls */}
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Boutique, owner, workspace…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-primary-400 bg-slate-50" />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { key: 'revenue', label: 'CA' },
                      { key: 'orders',  label: 'Cmdes' },
                      { key: 'products', label: 'Produits' },
                      { key: 'lastOrder', label: 'Activité' },
                      { key: 'created',  label: 'Date' },
                    ].map(s => (
                      <button key={s.key} onClick={() => toggleSort(s.key)}
                        className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          sortBy === s.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {s.label}<SortIcon k={s.key} />
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium ml-auto">{filteredStores.length} boutique{filteredStores.length > 1 ? 's' : ''}</span>
                </div>

                {filteredStores.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">Aucune boutique.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredStores.map((store, i) => {
                      const avgOV = store.totalOrders > 0 ? (store.totalRevenue || 0) / store.totalOrders : 0;
                      const pubRatio = store.totalProducts > 0 ? Math.round(((store.publishedProducts || 0) / store.totalProducts) * 100) : 0;
                      return (
                        <div key={store._id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            {/* left: name + meta */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${store.isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                                {(store.name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{store.name || '—'}</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${store.isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {store.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                  {store.isLegacyStore && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Legacy</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 text-[11px] text-slate-400">
                                  {store.subdomain && <span className="font-mono">{store.subdomain}</span>}
                                  {store.ownerEmail && <span>{store.ownerName || store.ownerEmail}</span>}
                                  <span>{fmtDate(store.createdAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* right: metrics grid */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <div className="text-center min-w-[52px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">CA</p>
                                <p className="text-sm font-extrabold text-primary-700 tabular-nums">{fmtMoney(store.totalRevenue || 0)}</p>
                              </div>
                              <div className="text-center min-w-[40px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Cmdes</p>
                                <p className="text-sm font-extrabold text-slate-800 tabular-nums">{nFmt.format(store.totalOrders || 0)}</p>
                              </div>
                              <div className="text-center min-w-[48px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Panier</p>
                                <p className="text-sm font-extrabold text-slate-800 tabular-nums">{fmtMoney(avgOV)}</p>
                              </div>
                              <div className="text-center min-w-[44px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Produits</p>
                                <p className="text-sm font-extrabold text-slate-800 tabular-nums">{nFmt.format(store.totalProducts || 0)}</p>
                                <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden w-10 mx-auto">
                                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pubRatio}%` }} />
                                </div>
                              </div>
                              <div className="text-center min-w-[52px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Dernière cmd</p>
                                <p className="text-xs font-bold text-slate-600">{timeAgo(store.lastOrderAt)}</p>
                              </div>
                              {store.url && (
                                <a href={store.url} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-primary-600 hover:text-primary-800 flex-shrink-0">
                                  Voir →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── UTILISATEURS tab ── */}
            {tab === 'users' && (
              <div>
                {/* KPIs utilisateurs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y divide-slate-100 border-b border-slate-100">
                  {[
                    { label: 'Total',            value: nFmt.format(userKpis.total),      icon: Users,      accent: 'text-slate-800'   },
                    { label: 'Actifs',            value: nFmt.format(userKpis.active),     icon: UserCheck,  accent: 'text-primary-700' },
                    { label: 'Inactifs',          value: nFmt.format(userKpis.inactive),   icon: UserX,      accent: 'text-red-600'     },
                    { label: 'Avec boutique',     value: nFmt.format(userKpis.withOrders), icon: Store,      accent: 'text-blue-700'    },
                    { label: 'Actifs cette sem.', value: nFmt.format(userKpis.recentCnx),  icon: BarChart2,  accent: 'text-amber-700'   },
                    { label: 'CA généré',         value: fmtMoney(userKpis.totalRev),      icon: TrendingUp, accent: 'text-primary-700' },
                  ].map(k => (
                    <div key={k.label} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{k.label}</p>
                        <k.icon className="w-3 h-3 text-slate-300" />
                      </div>
                      <p className={`text-lg font-extrabold tabular-nums tracking-tight ${k.accent}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* Distribution par rôle */}
                {roleDistrib.length > 0 && (
                  <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Rôles :</span>
                    {roleDistrib.map(([role, count]) => (
                      <button key={role} onClick={() => setUserRoleFilter(userRoleFilter === role ? 'all' : role)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border ${
                          userRoleFilter === role
                            ? 'bg-slate-800 text-white border-slate-800'
                            : `${ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'} border-transparent`
                        }`}>
                        {ROLE_LABELS[role] || role}
                        <span className={`font-extrabold ${userRoleFilter === role ? 'text-slate-300' : 'text-current opacity-60'}`}>{count}</span>
                      </button>
                    ))}
                    {userRoleFilter !== 'all' && (
                      <button onClick={() => setUserRoleFilter('all')} className="text-[11px] text-slate-400 hover:text-slate-600 underline">Tout</button>
                    )}
                  </div>
                )}

                {/* Search + sort */}
                <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      placeholder="Nom, email…"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-primary-400 bg-slate-50" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { key: 'revenue',   label: 'CA' },
                      { key: 'orders',    label: 'Cmdes' },
                      { key: 'boutiques', label: 'Boutiques' },
                      { key: 'login',     label: 'Connexion' },
                      { key: 'created',   label: 'Inscription' },
                    ].map(s => (
                      <button key={s.key} onClick={() => toggleUserSort(s.key)}
                        className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          userSort === s.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {s.label}<UserSortIcon k={s.key} />
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium ml-auto">{filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}</span>
                </div>

                {/* User list */}
                {filteredUsers.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">Aucun utilisateur.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredUsers.map((user, i) => {
                      const maxRev = filteredUsers[0]?.totalRevenue || 1;
                      const pct = Math.round(((user.totalRevenue || 0) / maxRev) * 100);
                      return (
                        <div key={user.userId} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            {/* avatar */}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${user.isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                              {(user.email || '?').charAt(0).toUpperCase()}
                            </div>
                            {/* info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-bold text-slate-900 truncate max-w-[180px]">{user.name || user.email}</p>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600'}`}>
                                  {ROLE_LABELS[user.role] || user.role || '—'}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${user.isActive ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-600'}`}>
                                  {user.isActive ? 'Actif' : 'Inactif'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{user.email}</p>
                                <span className="text-[11px] text-slate-300">·</span>
                                <p className="text-[11px] text-slate-400">Inscrit {fmtDate(user.createdAt)}</p>
                              </div>
                              {/* CA bar */}
                              {(user.totalRevenue || 0) > 0 && (
                                <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden max-w-[200px]">
                                  <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                            {/* stats */}
                            <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                              <div className="text-right min-w-[80px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">CA total</p>
                                <p className="text-sm font-extrabold text-primary-700 tabular-nums">{fmtMoney(user.totalRevenue || 0)}</p>
                              </div>
                              <div className="text-right min-w-[52px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Cmdes</p>
                                <p className="text-sm font-extrabold text-slate-800 tabular-nums">{nFmt.format(user.totalOrders || 0)}</p>
                              </div>
                              <div className="text-right min-w-[52px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Boutiques</p>
                                <p className="text-sm font-extrabold text-slate-800 tabular-nums">{user.boutiqueCount || 0}</p>
                              </div>
                              <div className="text-right min-w-[60px]">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Dernière cnx</p>
                                <p className="text-xs font-bold text-slate-600">{timeAgo(user.lastLogin)}</p>
                              </div>
                            </div>
                          </div>
                          {/* boutiques chips */}
                          {(user.stores || []).length > 0 && (
                            <div className="mt-2 ml-12 flex flex-wrap gap-1.5">
                              {user.stores.slice(0, 5).map(s => (
                                <span key={s._id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.isActive ? 'bg-primary-500' : 'bg-slate-300'}`} />
                                  <span className="font-semibold truncate max-w-[80px]">{s.name}</span>
                                  {(s.totalRevenue || 0) > 0 && <span className="text-primary-700 font-bold">{fmtMoney(s.totalRevenue)}</span>}
                                  {(s.totalOrders || 0) > 0 && <span className="text-slate-400">{nFmt.format(s.totalOrders)} cmd</span>}
                                </span>
                              ))}
                              {(user.stores || []).length > 5 && (
                                <span className="text-[10px] text-slate-400 self-center">+{user.stores.length - 5} autres</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUCTS tab ── */}
            {tab === 'products' && (
              <div>
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Produits les plus vendus — classement par quantité vendue (12 derniers mois)</p>
                  {productsLoading && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="w-3 h-3 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
                      Calcul…
                    </span>
                  )}
                </div>
                {productsLoading ? (
                  <div className="py-16 flex items-center justify-center gap-2 text-sm text-slate-400">
                    <span className="w-5 h-5 border-2 border-slate-300 border-t-primary-500 rounded-full animate-spin" />
                    Calcul du classement produits…
                  </div>
                ) : productLeaderboard.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">Aucune vente produit disponible.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {productLeaderboard.map((product, i) => (
                      <div key={`${product.storeKey}-${product.productId}`} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                        <span className="text-xl font-extrabold text-slate-200 w-6 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 line-clamp-1">{product.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{product.storeName || 'Boutique inconnue'}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{nFmt.format(product.unitsSold || 0)} vendus</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-700">{fmtMoney(product.revenue || 0, product.currency || 'XAF')}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{nFmt.format(product.ordersCount || 0)} cmd</span>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                            <span>Prix moy. <span className="font-semibold text-slate-700">{fmtMoney(product.averageSellingPrice || 0)}</span></span>
                            <span>Marge <span className="font-semibold text-slate-700">{product.marginPercentEstimate || 0}%</span></span>
                            <span>Dernière vente <span className="font-semibold text-slate-700">{timeAgo(product.lastOrderAt)}</span></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── LOGINS tab ── */}
            {tab === 'logins' && (
              <div>
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="text-xs text-slate-500">Dernières connexions enregistrées</p>
                </div>
                {recentLogins.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">Aucune connexion.</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                    {recentLogins.map((login, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">
                          {(login.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{login.name || login.email}</p>
                          <p className="text-[11px] text-slate-400 truncate">{login.email}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[login.role] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_LABELS[login.role] || login.role || '—'}
                        </span>
                        <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">{timeAgo(login.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Attention points ── */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Sans workspace',     value: data.noWorkspace        || 0 },
                { label: 'Workspaces inactifs', value: data.inactiveWorkspaces || 0, sub: `/${nFmt.format(data.totalWorkspaces || 0)} total` },
                { label: 'Sans commandes',      value: kpis.noOrders,              sub: `${Math.round((kpis.noOrders / Math.max(kpis.total, 1)) * 100)}% des boutiques` },
                { label: 'Boutiques inactives', value: kpis.inactive,              sub: `/${kpis.total} boutiques` },
              ].map(item => (
                <div key={item.label} className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">{item.label}</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{nFmt.format(item.value)}</p>
                  {item.sub && <p className="text-[11px] text-amber-600 mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SuperAdminShell>
  );
};

export default SuperAdminActivity;
