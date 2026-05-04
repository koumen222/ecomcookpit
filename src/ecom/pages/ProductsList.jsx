import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const STATUS_CONFIG = {
  test:   { label: 'Test',   bg: 'bg-amber-50',    text: 'text-amber-600',   ring: 'ring-amber-200',   dot: 'bg-amber-400'   },
  scale:  { label: 'Scale',  bg: 'bg-orange-50',   text: 'text-orange-600',  ring: 'ring-orange-200',  dot: 'bg-orange-400'  },
  scal:   { label: 'Scale',  bg: 'bg-orange-50',   text: 'text-orange-600',  ring: 'ring-orange-200',  dot: 'bg-orange-400'  },
  stable: { label: 'Stable', bg: 'bg-emerald-50',  text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  winner: { label: 'Winner', bg: 'bg-emerald-50',  text: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  pause:  { label: 'Pause',  bg: 'bg-slate-50',    text: 'text-slate-500',   ring: 'ring-slate-200',   dot: 'bg-slate-400'   },
  stop:   { label: 'Stop',   bg: 'bg-red-50',      text: 'text-red-600',     ring: 'ring-red-200',     dot: 'bg-red-400'     },
};

const calcBenefit = (p) => {
  if (p.sellingPrice == null) return null;
  return p.sellingPrice - (p.productCost ?? 0) - (p.deliveryCost ?? 0) - (p.avgAdsCost ?? 0);
};

const calcSuggestedPrice = (p) => {
  const base = (p.productCost ?? 0) + (p.deliveryCost ?? 0);
  if (base === 0) return null;
  return Math.ceil(Math.max(base * (base < 10000 ? 3 : 2.25), 10000) / 50) * 50;
};

const Chip = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? { label: status?.toUpperCase() ?? '—', bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ring-1 ${c.bg} ${c.text} ${c.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

const Skeleton = () => (
  <div className="flex flex-col h-full animate-pulse">
    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
      <div className="h-6 w-28 bg-gray-200 rounded-md" />
      <div className="h-9 w-36 bg-gray-200 rounded-lg" />
    </div>
    <div className="px-6 pt-5 pb-4 grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
    </div>
    <div className="px-6 pb-4">
      <div className="h-10 bg-gray-100 rounded-lg" />
    </div>
    <div className="flex-1 mx-6 mb-6 bg-white rounded-xl border border-gray-100 overflow-hidden">
      {[...Array(7)].map((_, i) => (
        <div key={i} className="flex gap-6 px-5 py-4 border-b border-gray-50">
          <div className="h-4 w-52 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded ml-auto" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
          <div className="h-5 w-14 bg-gray-100 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

export default function ProductsList() {
  const { fmt } = useMoney();
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [activeFilter, setActive]   = useState('');

  useEffect(() => { load(); }, [search, statusFilter, activeFilter]);

  const load = async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams();
      if (search)               p.append('search',   search);
      if (statusFilter)         p.append('status',   statusFilter);
      if (activeFilter !== '')  p.append('isActive', activeFilter);
      const res = await ecomApi.get(p.toString() ? `/products?${p}` : '/products');
      setProducts(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getContextualError(err, 'load_products'));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const applyPrice = async (id, price) => {
    try { await ecomApi.patch(`/products/${id}`, { sellingPrice: price }); load(); }
    catch (err) { setError(getContextualError(err, 'save_product')); }
  };

  const remove = async (id) => {
    if (!confirm('Supprimer ce produit définitivement ?')) return;
    try { await ecomApi.delete(`/products/${id}`); load(); }
    catch (err) { setError(getContextualError(err, 'delete_product')); }
  };

  const stats = useMemo(() => ({
    total:   products.length,
    active:  products.filter(p => p.isActive).length,
    profits: products.filter(p => (calcBenefit(p) ?? 0) > 0).length,
    ben:     products.reduce((s, p) => s + (calcBenefit(p) ?? 0), 0),
  }), [products]);

  const hasFilters = search || statusFilter || activeFilter;

  if (loading) return <Skeleton />;

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">

      {/* ── Topbar ───────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">Produits</h1>
          <p className="text-xs text-gray-400 mt-0.5 leading-none">{stats.total} produit{stats.total !== 1 ? 's' : ''} au total</p>
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

      <div className="flex-1 px-6 py-5 space-y-4">

        {/* ── KPI cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              icon: (
                <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
              ),
              label: 'Total produits', value: stats.total,
              bg: 'bg-violet-50', ring: 'ring-violet-100', val: 'text-violet-700',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              label: 'Actifs', value: stats.active,
              bg: 'bg-emerald-50', ring: 'ring-emerald-100', val: 'text-emerald-700',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
              ),
              label: 'Rentables', value: stats.profits,
              bg: 'bg-blue-50', ring: 'ring-blue-100', val: 'text-blue-700',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                </svg>
              ),
              label: 'Bénéfice estimé', value: fmt(stats.ben),
              bg: stats.ben >= 0 ? 'bg-amber-50' : 'bg-red-50',
              ring: stats.ben >= 0 ? 'ring-amber-100' : 'ring-red-100',
              val: stats.ben >= 0 ? 'text-amber-700' : 'text-red-600',
            },
          ].map(c => (
            <div key={c.label} className={`${c.bg} ring-1 ${c.ring} rounded-xl px-4 py-3.5 flex items-center gap-3`}>
              <div className="shrink-0">{c.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500 leading-none mb-1">{c.label}</p>
                <p className={`text-xl font-bold leading-none truncate ${c.val}`}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filtres ────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2 shadow-sm">
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

          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition"
          >
            <option value="">Tous les statuts</option>
            <option value="test">Test</option>
            <option value="scale">Scale</option>
            <option value="stable">Stable</option>
            <option value="winner">Winner</option>
            <option value="pause">Pause</option>
            <option value="stop">Stop</option>
          </select>

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

        {/* ── Table ──────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Produit</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Prix vente</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Coût produit</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Bénéfice</th>
                  <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">État</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-20 text-center">
                      <div className="inline-flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-500">
                          {hasFilters ? 'Aucun produit pour ces critères' : 'Aucun produit'}
                        </p>
                        {!hasFilters && (
                          <Link to="/ecom/products/new" className="text-xs text-emerald-600 hover:underline font-medium">
                            Créer votre premier produit →
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : products.map((product, i) => {
                  const benefit   = calcBenefit(product);
                  const cost      = product.productCost ?? 0;
                  const profitable = benefit !== null && benefit > 0;
                  const suggest   = calcSuggestedPrice(product);
                  const margin    = product.sellingPrice > 0 && benefit !== null
                    ? Math.round((benefit / product.sellingPrice) * 100)
                    : null;

                  return (
                    <tr
                      key={product._id}
                      className={`group border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      {/* Nom + badge */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Link
                            to={`/ecom/products/${product._id}`}
                            className="font-semibold text-gray-800 hover:text-emerald-700 transition-colors leading-snug"
                          >
                            {product.name}
                          </Link>
                          <Chip status={product.status} />
                        </div>
                      </td>

                      {/* Prix vente */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-bold text-gray-900 tabular-nums">
                            {product.sellingPrice != null ? fmt(product.sellingPrice) : <span className="text-gray-300 font-normal">—</span>}
                          </span>
                          {suggest && (
                            <button
                              onClick={() => confirm(`Appliquer le prix suggéré ${fmt(suggest)} pour "${product.name}" ?`) && applyPrice(product._id, suggest)}
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

                      {/* Bénéfice + marge */}
                      <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                        {benefit === null ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`font-bold tabular-nums ${profitable ? 'text-emerald-700' : 'text-red-600'}`}>
                              {profitable ? '+' : ''}{fmt(benefit)}
                            </span>
                            {margin !== null && (
                              <span className={`text-[10px] font-medium ${profitable ? 'text-emerald-500' : 'text-red-400'}`}>
                                {margin}% marge
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actif/Inactif */}
                      <td className="px-5 py-3.5 text-center">
                        {product.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-500 ring-1 ring-gray-200">
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

          {products.length > 0 && (
            <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{products.length} produit{products.length !== 1 ? 's' : ''}{hasFilters ? ' (filtré)' : ''}</p>
              <p className="text-xs text-gray-400 hidden sm:block">Bénéfice = Prix − Coût produit − Livraison − Pub</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
