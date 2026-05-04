import React, { useEffect, useMemo, useState } from 'react';
import { analyticsApi } from '../services/analytics.js';

const SuperAdminActivity = () => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');
  const [filterTab, setFilterTab] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await analyticsApi.getUsersActivity({ limit: 100 });
        setData(res.data?.data || null);
      } catch (err) {
        console.error('SuperAdminActivity load error:', err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'Hier';
    if (d < 7) return `Il y a ${d}j`;
    if (d < 30) return `Il y a ${Math.floor(d / 7)} sem`;
    return fmtDate(v);
  };

  const roleBadge = {
    super_admin:   'bg-amber-50 text-amber-700 ring-amber-600/10',
    ecom_admin:    'bg-emerald-50 text-emerald-800 ring-emerald-700/10',
    ecom_closeuse: 'bg-sky-50 text-sky-700 ring-sky-600/10',
    ecom_compta:   'bg-violet-50 text-violet-700 ring-violet-600/10',
    ecom_livreur:  'bg-orange-50 text-orange-700 ring-orange-600/10',
  };
  const roleLabels = {
    super_admin: 'Super Admin', ecom_admin: 'Admin',
    ecom_closeuse: 'Closeuse', ecom_compta: 'Comptable', ecom_livreur: 'Livreur',
  };

  /* ── Flatten stores ─────────────────────────────────────────────── */
  const allStores = useMemo(() => {
    if (!data?.boutiqueActivity) return [];
    return data.boutiqueActivity.flatMap(user =>
      (user.stores || []).map(store => ({
        ...store,
        ownerEmail:     user.email,
        ownerName:      user.name,
        ownerRole:      user.role,
        ownerIsActive:  user.isActive,
        ownerLastLogin: user.lastLogin,
      }))
    );
  }, [data]);

  /* ── KPIs ───────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const totalRevenue = allStores.reduce((s, b) => s + (b.totalRevenue || 0), 0);
    const totalOrders  = allStores.reduce((s, b) => s + (b.totalOrders  || 0), 0);
    const active       = allStores.filter(s => s.isActive).length;
    const withOrders   = allStores.filter(s => (s.totalOrders || 0) > 0).length;
    const noOrders     = allStores.length - withOrders;
    const week         = 7 * 24 * 3600 * 1000;
    const recentlyActive = allStores.filter(s => s.lastOrderAt && Date.now() - new Date(s.lastOrderAt).getTime() < week).length;
    const avgRevenue   = allStores.length ? totalRevenue / allStores.length : 0;
    const avgOrders    = allStores.length ? totalOrders  / allStores.length : 0;
    return { total: allStores.length, active, inactive: allStores.length - active, withOrders, noOrders, totalRevenue, avgRevenue, totalOrders, avgOrders: Math.round(avgOrders), recentlyActive };
  }, [allStores]);

  /* ── Activity score ─────────────────────────────────────────────── */
  const activityScore = (store) => {
    let s = 0;
    if ((store.totalOrders || 0) > 0)   s += 2;
    if ((store.totalOrders || 0) >= 10)  s += 1;
    if (store.lastOrderAt && Date.now() - new Date(store.lastOrderAt).getTime() < 7 * 24 * 3600 * 1000) s += 3;
    if ((store.publishedProducts || 0) > 0) s += 1;
    if (store.isActive)       s += 1;
    if (store.ownerIsActive)  s += 1;
    return s; // max 9
  };
  const activityLabel = (score) => {
    if (score >= 7) return { label: 'Très actif',  cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
    if (score >= 4) return { label: 'Actif',        cls: 'bg-blue-50 text-blue-700',         dot: 'bg-blue-500'    };
    if (score >= 2) return { label: 'Faible',       cls: 'bg-amber-50 text-amber-700',       dot: 'bg-amber-400'   };
    return               { label: 'Inactif',       cls: 'bg-gray-100 text-gray-500',         dot: 'bg-gray-400'    };
  };

  /* ── Filter + sort ──────────────────────────────────────────────── */
  const displayed = useMemo(() => {
    let list = [...allStores];
    if (filterTab === 'active')     list = list.filter(s => s.isActive);
    if (filterTab === 'inactive')   list = list.filter(s => !s.isActive);
    if (filterTab === 'withOrders') list = list.filter(s => (s.totalOrders || 0) > 0);
    if (filterTab === 'noOrders')   list = list.filter(s => (s.totalOrders || 0) === 0);
    const term = search.trim().toLowerCase();
    if (term) list = list.filter(s =>
      [s.name, s.subdomain, s.workspaceName, s.ownerEmail, s.ownerName]
        .some(v => String(v || '').toLowerCase().includes(term))
    );
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === 'revenue')   { va = a.totalRevenue || 0; vb = b.totalRevenue || 0; }
      else if (sortBy === 'orders') { va = a.totalOrders || 0; vb = b.totalOrders || 0; }
      else if (sortBy === 'products') { va = a.totalProducts || 0; vb = b.totalProducts || 0; }
      else if (sortBy === 'lastOrder') { va = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0; vb = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0; }
      else if (sortBy === 'createdAt') { va = a.createdAt ? new Date(a.createdAt).getTime() : 0; vb = b.createdAt ? new Date(b.createdAt).getTime() : 0; }
      else if (sortBy === 'score') { va = activityScore(a); vb = activityScore(b); }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return list;
  }, [allStores, filterTab, search, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const top5     = useMemo(() => [...allStores].sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)).slice(0, 5), [allStores]);
  const maxRev   = top5[0]?.totalRevenue || 1;
  const rankedProducts = useMemo(() => {
    return [...(data?.productLeaderboard || [])]
      .sort((a, b) => {
        const unitsDiff = (b.unitsSold || 0) - (a.unitsSold || 0);
        if (unitsDiff !== 0) return unitsDiff;
        const revenueDiff = (b.revenue || 0) - (a.revenue || 0);
        if (revenueDiff !== 0) return revenueDiff;
        return (b.ordersCount || 0) - (a.ordersCount || 0);
      });
  }, [data]);
  const topProducts = rankedProducts.slice(0, 5);
  const maxUnitsSold = topProducts[0]?.unitsSold || 1;
  const recentLogins   = data?.recentLogins || [];
  const boutiqueTotals = data?.boutiqueTotals || {};

  const FILTER_TABS = [
    { key: 'all',        label: 'Toutes',           count: kpis.total      },
    { key: 'active',     label: 'Actives',           count: kpis.active     },
    { key: 'inactive',   label: 'Inactives',         count: kpis.inactive   },
    { key: 'withOrders', label: 'Avec commandes',    count: kpis.withOrders },
    { key: 'noOrders',   label: 'Sans commandes',    count: kpis.noOrders   },
  ];
  const SORT_OPTIONS = [
    { key: 'revenue',   label: 'CA'             },
    { key: 'orders',    label: 'Commandes'      },
    { key: 'products',  label: 'Produits'       },
    { key: 'lastOrder', label: 'Dernière cmd'   },
    { key: 'score',     label: 'Activité'       },
    { key: 'createdAt', label: 'Création'       },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-700 animate-spin" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Chargement de l'activité boutique…</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-[1700px] mx-auto space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Activité boutiques</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {kpis.total} boutiques · {kpis.active} actives · {kpis.withOrders} avec commandes · {kpis.recentlyActive} actives ces 7 derniers jours
          </p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Boutique, owner, workspace, sous-domaine…"
          className="w-full sm:w-80 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* ── KPI band ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Boutiques totales',   value: nFmt.format(kpis.total),                      sub: `${kpis.active} actives / ${kpis.inactive} inactives`,  accent: 'text-gray-900'    },
          { label: 'CA agrégé',           value: fmtMoney(boutiqueTotals.totalRevenue || kpis.totalRevenue), sub: `Moy. ${fmtMoney(kpis.avgRevenue)} / boutique`,      accent: 'text-emerald-700' },
          { label: 'Commandes totales',   value: nFmt.format(boutiqueTotals.totalOrders || kpis.totalOrders), sub: `Moy. ${kpis.avgOrders} / boutique`,                accent: 'text-blue-700'    },
          { label: 'Produits boutique',   value: nFmt.format(boutiqueTotals.totalProducts || 0), sub: 'Créés en boutique',                                  accent: 'text-violet-700'  },
          { label: 'Actives 7j',          value: nFmt.format(kpis.recentlyActive),              sub: 'Commande < 7 jours',                                  accent: 'text-amber-700'   },
          { label: 'Sans commandes',      value: nFmt.format(kpis.noOrders),                    sub: `${Math.round((kpis.noOrders / Math.max(kpis.total, 1)) * 100)}% du parc`,        accent: 'text-red-600'     },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{k.label}</p>
            <p className={`mt-2 text-xl font-extrabold tracking-tight tabular-nums ${k.accent}`}>{k.value}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">

        {/* ── Main list ──────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">

          {/* Best-selling products list */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Produits les plus vendus</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">Liste triée par quantité vendue sur l'ensemble des boutiques</p>
              </div>
              <span className="text-[11px] font-semibold text-gray-500 tabular-nums">
                {rankedProducts.length} produit{rankedProducts.length > 1 ? 's' : ''}
              </span>
            </div>

            {rankedProducts.length === 0 ? (
              <p className="px-5 py-5 text-sm text-gray-400">Aucune vente produit disponible.</p>
            ) : (
              <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
                {rankedProducts.map((product, i) => (
                  <div key={`${product.storeKey}-${product.productId}`} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-xl font-extrabold text-gray-200 w-6 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                          <p className="text-[10px] text-gray-400 truncate">{product.storeName || product.workspaceName || 'Boutique inconnue'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                          <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{nFmt.format(product.unitsSold || 0)} vendus</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{fmtMoney(product.revenue || 0, product.currency || 'XAF')}</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{nFmt.format(product.ordersCount || 0)} cmd</span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
                        <span>Prix moy. : <span className="font-semibold text-gray-700">{fmtMoney(product.averageSellingPrice || 0, product.currency || 'XAF')}</span></span>
                        <span>Marge estimée : <span className="font-semibold text-gray-700">{product.marginPercentEstimate || 0}%</span></span>
                        <span>Dernière vente : <span className="font-semibold text-gray-700">{timeAgo(product.lastOrderAt)}</span></span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {product.url && (
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800"
                          >
                            Voir produit
                          </a>
                        )}
                        {product.storeUrl && (
                          <a
                            href={product.storeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-semibold text-gray-400 hover:text-gray-600"
                          >
                            Voir boutique
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1.5">
              {FILTER_TABS.map(tab => (
                <button key={tab.key} onClick={() => setFilterTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterTab === tab.key
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  {tab.label}
                  <span className={`ml-1.5 text-[10px] ${filterTab === tab.key ? 'text-gray-400' : 'text-gray-400'}`}>{tab.count}</span>
                </button>
              ))}
            </div>
            {/* Sort */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-400">Trier :</span>
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => toggleSort(opt.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    sortBy === opt.key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt.label}
                  {sortBy === opt.key && <span className="opacity-70">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 tabular-nums">{displayed.length} boutique{displayed.length > 1 ? 's' : ''} affichée{displayed.length > 1 ? 's' : ''}</p>

          {/* Store cards */}
          {displayed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-14 text-center text-sm text-gray-400">
              Aucune boutique correspondante.
            </div>
          ) : displayed.map(store => {
            const score    = activityScore(store);
            const activity = activityLabel(score);
            const avgOV    = (store.totalOrders || 0) > 0 ? (store.totalRevenue || 0) / store.totalOrders : 0;
            const pubRatio = (store.totalProducts || 0) > 0 ? Math.round(((store.publishedProducts || 0) / store.totalProducts) * 100) : 0;

            return (
              <div key={store._id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200">

                {/* ── Store header ── */}
                <div className="px-5 py-4 border-b border-gray-50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${store.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {(store.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-base font-bold text-gray-900">{store.name || '—'}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${store.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {store.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {store.isLegacyStore && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">Legacy</span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${activity.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activity.dot}`} />
                            {activity.label}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                          {store.subdomain && (
                            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{store.subdomain}</span>
                          )}
                          {store.workspaceName && (
                            <span>Workspace : <span className="font-semibold text-gray-700">{store.workspaceName}</span></span>
                          )}
                          <span>Créée le <span className="font-semibold text-gray-700">{fmtDate(store.createdAt)}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {/* Owner pill */}
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700 flex-shrink-0">
                          {(store.ownerEmail || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-gray-800 truncate max-w-[130px]">{store.ownerName || store.ownerEmail}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[130px]">{store.ownerEmail}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset flex-shrink-0 ${roleBadge[store.ownerRole] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                          {roleLabels[store.ownerRole] || store.ownerRole || '—'}
                        </span>
                      </div>
                      {store.url && (
                        <a href={store.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors">
                          Voir la boutique
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Metrics row ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-gray-100 border-b border-gray-50">
                  {/* Commandes */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Commandes</p>
                    <p className="mt-1.5 text-2xl font-extrabold text-gray-900 tabular-nums leading-none">{nFmt.format(store.totalOrders || 0)}</p>
                    <p className="mt-1 text-[10px] text-gray-400 leading-tight">Dernière : {timeAgo(store.lastOrderAt)}</p>
                  </div>
                  {/* CA */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">CA total</p>
                    <p className="mt-1.5 text-xl font-extrabold text-emerald-700 tabular-nums leading-none">{fmtMoney(store.totalRevenue || 0, store.currency || 'XAF')}</p>
                    <p className="mt-1 text-[10px] text-gray-400 leading-tight">Brut boutique</p>
                  </div>
                  {/* Panier moyen */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Panier moyen</p>
                    <p className="mt-1.5 text-xl font-extrabold text-gray-900 tabular-nums leading-none">{fmtMoney(avgOV, store.currency || 'XAF')}</p>
                    <p className="mt-1 text-[10px] text-gray-400 leading-tight">Par commande livrée</p>
                  </div>
                  {/* Produits */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Produits</p>
                    <p className="mt-1.5 text-xl font-extrabold text-gray-900 tabular-nums leading-none">{nFmt.format(store.totalProducts || 0)}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pubRatio}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums">{pubRatio}% pub</span>
                    </div>
                  </div>
                  {/* Dernier produit */}
                  <div className="px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Dernier produit</p>
                    <p className="mt-1.5 text-sm font-bold text-gray-900 leading-none">{timeAgo(store.lastProductAt)}</p>
                    <p className="mt-1 text-[10px] text-gray-400 leading-tight">{nFmt.format(store.publishedProducts || 0)} publiés</p>
                  </div>
                  {/* Owner */}
                  <div className="px-4 py-3 col-span-2 sm:col-span-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Owner — dernière cnx</p>
                    <p className="mt-1.5 text-sm font-bold text-gray-900 leading-none">{timeAgo(store.ownerLastLogin)}</p>
                    <p className="mt-1 text-[10px] leading-tight">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${store.ownerIsActive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className={store.ownerIsActive ? 'text-emerald-600' : 'text-red-500'}>{store.ownerIsActive ? 'Compte actif' : 'Désactivé'}</span>
                    </p>
                  </div>
                </div>

                {/* ── Activity score bar ── */}
                <div className="px-5 py-2.5 border-b border-gray-50 flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">Score activité</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${score >= 7 ? 'bg-emerald-500' : score >= 4 ? 'bg-blue-400' : score >= 2 ? 'bg-amber-400' : 'bg-gray-300'}`}
                      style={{ width: `${(score / 9) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 tabular-nums flex-shrink-0">{score}/9</span>
                </div>

              </div>
            );
          })}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Top products */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Top 5 — Produits vendus</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Produits les plus vendus sur l'ensemble des boutiques</p>
            </div>
            <div className="divide-y divide-gray-100">
              {topProducts.map((product, i) => (
                <div key={`${product.storeKey}-${product.productId}`} className="px-5 py-3 flex items-start gap-3">
                  <span className="text-xl font-extrabold text-gray-200 w-5 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{product.storeName || product.workspaceName || 'Boutique inconnue'}</p>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 flex-shrink-0">
                        {nFmt.format(product.unitsSold || 0)} vendus
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span className="font-bold text-emerald-700">{fmtMoney(product.revenue || 0, product.currency || 'XAF')}</span>
                      <span>{nFmt.format(product.ordersCount || 0)} cmd</span>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(((product.unitsSold || 0) / maxUnitsSold) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {product.url && (
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Voir produit
                        </a>
                      )}
                      {product.storeUrl && (
                        <a
                          href={product.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-gray-400 hover:text-gray-600"
                        >
                          Voir boutique
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {topProducts.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">Aucune donnée produit.</p>}
            </div>
          </div>

          {/* Top 5 CA */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Top 5 — CA</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Meilleures boutiques par chiffre d'affaires</p>
            </div>
            <div className="divide-y divide-gray-100">
              {top5.map((store, i) => (
                <div key={store._id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xl font-extrabold text-gray-200 w-5 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{store.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{store.ownerName || store.ownerEmail}</p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span className="font-bold text-emerald-700">{fmtMoney(store.totalRevenue || 0, store.currency || 'XAF')}</span>
                      <span>{nFmt.format(store.totalOrders || 0)} cmd</span>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(((store.totalRevenue || 0) / maxRev) * 100)}%` }} />
                    </div>
                  </div>
                  {store.url && (
                    <a href={store.url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-300 hover:text-emerald-600 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </a>
                  )}
                </div>
              ))}
              {top5.length === 0 && <p className="px-5 py-4 text-sm text-gray-400">Aucune donnée.</p>}
            </div>
          </div>

          {/* Recent logins */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Dernières connexions</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Flux récent d'authentification</p>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
              {recentLogins.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">Aucune connexion.</p>
              ) : recentLogins.slice(0, 25).map((login, i) => (
                <div key={i} className="px-5 py-2.5 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                    {(login.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{login.name || login.email}</p>
                    <p className="text-[10px] text-gray-400 truncate">{login.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset block mb-0.5 ${roleBadge[login.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>
                      {roleLabels[login.role] || login.role || '—'}
                    </span>
                    <span className="text-[10px] text-gray-400">{timeAgo(login.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Attention points */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-amber-200/60">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <h2 className="text-sm font-bold text-amber-900">Points d'attention</h2>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {[
                { label: 'Users sans workspace',   value: data?.noWorkspace        || 0,  sub: null },
                { label: 'Workspaces inactifs',    value: data?.inactiveWorkspaces || 0,  sub: `sur ${nFmt.format(data?.totalWorkspaces || 0)} total` },
                { label: 'Boutiques sans commandes', value: kpis.noOrders,              sub: `${Math.round((kpis.noOrders / Math.max(kpis.total, 1)) * 100)}% du parc` },
                { label: 'Boutiques inactives',    value: kpis.inactive,                sub: `sur ${kpis.total} boutiques` },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-gray-600">{item.label}</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-1 tabular-nums">{nFmt.format(item.value)}</p>
                  {item.sub && <p className="text-[11px] text-gray-400 mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SuperAdminActivity;
