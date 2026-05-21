import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const STATUS_CONFIG = {
  test:   { label: 'Test',   bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-400'   },
  scale:  { label: 'Scale',  bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  scal:   { label: 'Scale',  bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  stable: { label: 'Stable', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  winner: { label: 'Winner', bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  pause:  { label: 'Pause',  bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
  stop:   { label: 'Stop',   bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-400'     },
};

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'test',   label: 'Test' },
  { value: 'scale',  label: 'Scale' },
  { value: 'stable', label: 'Stable' },
  { value: 'winner', label: 'Winner' },
  { value: 'pause',  label: 'Pause' },
  { value: 'stop',   label: 'Stop' },
];

const calcBenefit = (p) => {
  if (p.sellingPrice == null) return null;
  return p.sellingPrice - (p.productCost ?? 0) - (p.deliveryCost ?? 0) - (p.avgAdsCost ?? 0);
};

const calcMarginPct = (p) => {
  const b = calcBenefit(p);
  if (b === null || !p.sellingPrice) return null;
  return Math.round((b / p.sellingPrice) * 100);
};

const calcSuggestedPrice = (p) => {
  const base = (p.productCost ?? 0) + (p.deliveryCost ?? 0);
  if (base === 0) return null;
  return Math.ceil(Math.max(base * (base < 10000 ? 3 : 2.25), 10000) / 50) * 50;
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

const StatusChip = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? { label: status?.toUpperCase() ?? '—', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const MarginBar = ({ pct }) => {
  if (pct === null) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct >= 40 ? 'bg-emerald-500' : pct >= 20 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-[10px] font-semibold tabular-nums ${pct >= 40 ? 'text-emerald-600' : pct >= 20 ? 'text-amber-600' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  );
};

const ProductAvatar = ({ product, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const img = product.images?.[0] || product.image || product.imageUrl;
  const initials = (product.name || '?').slice(0, 2).toUpperCase();
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-[10px]' : size === 'lg' ? 'w-16 h-16 text-lg' : 'w-10 h-10 text-xs';

  if (img && !imgError) {
    return (
      <div className={`${sizeClass} rounded-xl overflow-hidden shrink-0 bg-gray-100`}>
        <img src={img} alt={product.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      </div>
    );
  }

  const colors = ['bg-violet-100 text-violet-600', 'bg-blue-100 text-blue-600', 'bg-emerald-100 text-emerald-600', 'bg-orange-100 text-orange-600', 'bg-pink-100 text-pink-600'];
  const colorClass = colors[(product.name?.charCodeAt(0) ?? 0) % colors.length];

  return (
    <div className={`${sizeClass} ${colorClass} rounded-xl flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  );
};

const SortIcon = ({ active, dir }) => {
  if (!active) return <span className="text-gray-300 ml-1 text-[10px]">↕</span>;
  return <span className="text-emerald-600 ml-1 text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>;
};


/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function ProductsList() {
  const { fmt } = useMoney();
  const [products, setProducts]  = useState([]);
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState('');
  const [search, setSearch]      = useState('');
  const [statusFilter, setStatus] = useState('');
  const [activeFilter, setActive] = useState('');
  const [view, setView]          = useState('table'); // 'table' | 'grid'
  const [sort, setSort]          = useState({ key: null, dir: 'desc' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams();
      if (search)              p.append('search',   search);
      if (statusFilter)        p.append('status',   statusFilter);
      if (activeFilter !== '') p.append('isActive', activeFilter);
      const res = await ecomApi.get(p.toString() ? `/products?${p}` : '/products');
      setProducts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getContextualError(err, 'load_products'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const applyPrice = async (id, price) => {
    try { await ecomApi.patch(`/products/${id}`, { sellingPrice: price }); load(); }
    catch (err) { setError(getContextualError(err, 'save_product')); }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce produit définitivement ?')) return;
    try { await ecomApi.delete(`/products/${id}`); load(); }
    catch (err) { setError(getContextualError(err, 'delete_product')); }
  };

  const toggleSort = (key) => {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'desc' }
    );
  };

  const sorted = useMemo(() => {
    if (!sort.key) return products;
    return [...products].sort((a, b) => {
      let av, bv;
      if (sort.key === 'name')    { av = a.name ?? ''; bv = b.name ?? ''; }
      if (sort.key === 'price')   { av = a.sellingPrice ?? 0; bv = b.sellingPrice ?? 0; }
      if (sort.key === 'benefit') { av = calcBenefit(a) ?? -Infinity; bv = calcBenefit(b) ?? -Infinity; }
      if (sort.key === 'margin')  { av = calcMarginPct(a) ?? -Infinity; bv = calcMarginPct(b) ?? -Infinity; }
      if (typeof av === 'string') return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === 'asc' ? av - bv : bv - av;
    });
  }, [products, sort]);

  const stats = useMemo(() => ({
    total:   products.length,
    active:  products.filter(p => p.isActive).length,
    profits: products.filter(p => (calcBenefit(p) ?? 0) > 0).length,
    ben:     products.reduce((s, p) => s + (calcBenefit(p) ?? 0), 0),
  }), [products]);

  const hasFilters = search || statusFilter || activeFilter;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-7 h-7 rounded-full border-[3px] border-gray-200 border-t-emerald-600 animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">

      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Produits</h1>
          <p className="text-xs text-gray-400 mt-0.5 leading-none">{stats.total} produit{stats.total !== 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md transition-all ${view === 'table' ? 'bg-white shadow text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vue tableau"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 6h4M10 18h4M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white shadow text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
              title="Vue grille"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
          <Link
            to="/ecom/products/new"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg shadow-sm shadow-emerald-200 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nouveau produit
          </Link>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 space-y-4">

        {/* ── KPI cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              icon: (
                <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              ),
              label: 'Total produits', value: stats.total, sub: 'dans le catalogue',
              iconBg: 'bg-violet-100', val: 'text-gray-900',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              label: 'Actifs', value: stats.active,
              sub: `${stats.total - stats.active} inactif${stats.total - stats.active !== 1 ? 's' : ''}`,
              iconBg: 'bg-emerald-100', val: 'text-gray-900',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              ),
              label: 'Rentables', value: stats.profits,
              sub: `${stats.total - stats.profits} déficitaire${stats.total - stats.profits !== 1 ? 's' : ''}`,
              iconBg: 'bg-blue-100', val: 'text-gray-900',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                </svg>
              ),
              label: 'Bénéfice estimé', value: fmt(stats.ben),
              sub: 'prix − coût − livraison − pub',
              iconBg: stats.ben >= 0 ? 'bg-amber-100' : 'bg-red-100',
              val: stats.ben >= 0 ? 'text-gray-900' : 'text-red-600',
              iconColor: stats.ben >= 0 ? 'text-amber-600' : 'text-red-500',
            },
          ].map(c => (
            <div key={c.label} className="bg-white ring-1 ring-gray-100 rounded-xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 ${c.iconBg} rounded-lg flex items-center justify-center shrink-0`}>
                {c.icon}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-400 leading-none mb-1">{c.label}</p>
                <p className={`text-xl font-bold leading-none truncate ${c.val}`}>{c.value}</p>
                {c.sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{c.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters bar ──────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:bg-white transition"
            />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                  statusFilter === f.value
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Active toggle */}
          <select
            value={activeFilter}
            onChange={e => setActive(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
          >
            <option value="">Actifs &amp; inactifs</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setStatus(''); setActive(''); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Effacer
            </button>
          )}
          {hasFilters && (
            <span className="ml-auto text-xs text-gray-400">{products.length} résultat{products.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {error && (
          <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.25a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {sorted.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm py-20 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">
                {hasFilters ? 'Aucun produit pour ces critères' : 'Aucun produit'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {hasFilters ? 'Essayez de modifier vos filtres' : 'Créez votre premier produit pour commencer'}
              </p>
            </div>
            {!hasFilters && (
              <Link
                to="/ecom/products/new"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Créer un produit
              </Link>
            )}
          </div>
        )}

        {/* ── TABLE view ───────────────────────────────────────── */}
        {view === 'table' && sorted.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="px-5 py-3.5 text-left">
                      <button
                        onClick={() => toggleSort('name')}
                        className="inline-flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition-colors"
                      >
                        Produit
                        <SortIcon active={sort.key === 'name'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggleSort('price')}
                        className="inline-flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition-colors ml-auto"
                      >
                        Prix vente
                        <SortIcon active={sort.key === 'price'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-right hidden md:table-cell">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Coût</span>
                    </th>
                    <th className="px-5 py-3.5 text-right hidden sm:table-cell">
                      <button
                        onClick={() => toggleSort('benefit')}
                        className="inline-flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition-colors ml-auto"
                      >
                        Bénéfice
                        <SortIcon active={sort.key === 'benefit'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="px-5 py-3.5 hidden lg:table-cell" style={{ width: 120 }}>
                      <button
                        onClick={() => toggleSort('margin')}
                        className="inline-flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-700 transition-colors"
                      >
                        Marge
                        <SortIcon active={sort.key === 'margin'} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">État</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((product, i) => {
                    const benefit    = calcBenefit(product);
                    const cost       = product.productCost ?? 0;
                    const profitable = benefit !== null && benefit > 0;
                    const suggest    = calcSuggestedPrice(product);
                    const margin     = calcMarginPct(product);
                    const lowStock   = product.stock != null && product.reorderThreshold != null && product.stock <= product.reorderThreshold;

                    return (
                      <tr
                        key={product._id}
                        className={`group border-b border-gray-50 last:border-0 hover:bg-emerald-50/30 transition-colors ${i % 2 === 1 ? 'bg-gray-50/20' : ''}`}
                      >
                        {/* Produit */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <ProductAvatar product={product} size="md" />
                            <div className="min-w-0">
                              <Link
                                to={`/ecom/products/${product._id}`}
                                className="font-semibold text-gray-800 hover:text-emerald-700 transition-colors leading-snug block truncate"
                              >
                                {product.name}
                              </Link>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <StatusChip status={product.status} />
                                {!product.isActive && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                                    Inactif
                                  </span>
                                )}
                                {lowStock && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                                    ⚠ Stock bas: {product.stock}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Prix vente */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-gray-900 tabular-nums">
                              {product.sellingPrice != null ? fmt(product.sellingPrice) : <span className="text-gray-300 font-normal">—</span>}
                            </span>
                            {suggest && !product.sellingPrice && (
                              <button
                                onClick={() => confirm(`Appliquer ${fmt(suggest)} pour "${product.name}" ?`) && applyPrice(product._id, suggest)}
                                className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium"
                              >
                                Suggéré : {fmt(suggest)}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Coût */}
                        <td className="px-5 py-3.5 text-right hidden md:table-cell">
                          <span className="text-gray-500 tabular-nums">{fmt(cost)}</span>
                        </td>

                        {/* Bénéfice */}
                        <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                          {benefit === null ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            <span className={`font-bold tabular-nums ${profitable ? 'text-emerald-700' : 'text-red-600'}`}>
                              {profitable ? '+' : ''}{fmt(benefit)}
                            </span>
                          )}
                        </td>

                        {/* Margin bar */}
                        <td className="px-5 py-3.5 hidden lg:table-cell" style={{ width: 120 }}>
                          <MarginBar pct={margin} />
                        </td>

                        {/* Statut actif */}
                        <td className="px-5 py-3.5 text-center">
                          {product.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Inactif
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              to={`/ecom/products/${product._id}/edit`}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Modifier"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => remove(product._id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Supprimer"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{sorted.length} produit{sorted.length !== 1 ? 's' : ''}{hasFilters ? ' (filtré)' : ''}</p>
              <p className="text-xs text-gray-400 hidden sm:block">Bénéfice = Prix − Coût − Livraison − Pub</p>
            </div>
          </div>
        )}

        {/* ── GRID view ────────────────────────────────────────── */}
        {view === 'grid' && sorted.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(product => {
              const benefit    = calcBenefit(product);
              const profitable = benefit !== null && benefit > 0;
              const margin     = calcMarginPct(product);
              const lowStock   = product.stock != null && product.reorderThreshold != null && product.stock <= product.reorderThreshold;

              return (
                <div
                  key={product._id}
                  className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden group"
                >
                  {/* Image / avatar banner */}
                  <div className="h-32 bg-gray-50 flex items-center justify-center relative overflow-hidden">
                    <ProductAvatar product={product} size="lg" />
                    {!product.isActive && (
                      <div className="absolute inset-0 bg-gray-900/10 flex items-end p-2">
                        <span className="text-[10px] font-bold text-white bg-gray-700 px-1.5 py-0.5 rounded-md">Inactif</span>
                      </div>
                    )}
                    {lowStock && (
                      <div className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        ⚠ {product.stock} restant
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-4 py-3 flex flex-col gap-2">
                    <div>
                      <Link
                        to={`/ecom/products/${product._id}`}
                        className="font-bold text-gray-800 hover:text-emerald-700 transition-colors text-sm leading-snug block"
                      >
                        {product.name}
                      </Link>
                      <div className="mt-1">
                        <StatusChip status={product.status} />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Prix vente</p>
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {product.sellingPrice != null ? fmt(product.sellingPrice) : <span className="text-gray-300">—</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Coût prod.</p>
                        <p className="text-sm font-semibold text-gray-600 tabular-nums">{fmt(product.productCost ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Bénéfice</p>
                        <p className={`text-sm font-bold tabular-nums ${benefit === null ? 'text-gray-300' : profitable ? 'text-emerald-700' : 'text-red-600'}`}>
                          {benefit === null ? '—' : `${profitable ? '+' : ''}${fmt(benefit)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">Stock</p>
                        <p className="text-sm font-semibold text-gray-600 tabular-nums">
                          {product.stock ?? <span className="text-gray-300">—</span>}
                        </p>
                      </div>
                    </div>

                    {/* Margin bar */}
                    {margin !== null && (
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium mb-1">Marge</p>
                        <MarginBar pct={margin} />
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      {product.isActive ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Actif
                        </span>
                      ) : (
                        <span className="text-gray-400">Inactif</span>
                      )}
                    </span>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/ecom/products/${product._id}/edit`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="Modifier"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        onClick={() => remove(product._id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
