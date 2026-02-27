import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';
import { getCache, setCache } from '../utils/cacheUtils.js';

const IconFillLoader = ({ backgroundClassName = 'bg-gray-50' }) => {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const durationMs = 1200;
    const tick = (t) => {
      if (!start) start = t;
      const elapsed = t - start;
      const progress = (elapsed % durationMs) / durationMs;
      setP(Math.min(100, Math.round(progress * 100)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`w-full h-full min-h-screen ${backgroundClassName} flex items-center justify-center`}>
      <div className="relative w-20 h-20">
        <img
          src="/icon.png"
          alt="Loading"
          className="w-20 h-20 object-contain opacity-20"
        />
        <div
          className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out"
          style={{ clipPath: `inset(${100 - p}% 0 0 0)` }}
        >
          <img
            src="/icon.png"
            alt="Loading"
            className="w-20 h-20 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

function getStockStatus(current) {
  if (current <= 5) return { label: 'Stock faible  réassort urgent', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' };
  if (current <= 15) return { label: 'Stock correct  à surveiller', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' };
  return { label: 'Bon stock', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
}

const EMPTY_FORM = {
  productId: '', city: '', agency: '',
  quantity: '', sales: '', notes: ''
};

const StockManagement = () => {
  const [entries, setEntries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterAgency, setFilterAgency] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async (useCache = true) => {
    setLoading(true);
    try {
      // Charger depuis le cache si disponible
      if (useCache) {
        const cached = getCache('stock_management');
        if (cached) {
          setEntries(cached.entries);
          setProducts(cached.products);
          setLoading(false);
          return;
        }
      }

      const [entriesRes, productsRes] = await Promise.all([
        ecomApi.get('/stock-locations'),
        ecomApi.get('/products')
      ]);
      const entries = entriesRes.data.data || [];
      const products = productsRes.data.data?.products || productsRes.data.data || [];
      
      setEntries(entries);
      setProducts(products);
      
      // Sauvegarder dans le cache
      setCache('stock_management', { entries, products });
    } catch (err) {
      setError(getContextualError(err, 'load_stats'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <IconFillLoader />;
  }

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      productId: entry.productId?._id || entry.productId || '',
      city: entry.city || '',
      agency: entry.agency || '',
      quantity: entry.quantity?.toString() || '',
      sales: entry.sales?.toString() || '0',
      notes: entry.notes || ''
    });
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(EMPTY_FORM); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productId || !form.quantity) { setError('Produit et stock initial sont requis'); return; }
    setSubmitting(true); setError('');
    try {
      const payload = {
        productId: form.productId,
        city: form.city.trim(),
        agency: form.agency.trim(),
        quantity: parseInt(form.quantity) || 0,
        sales: parseInt(form.sales) || 0,
        notes: form.notes
      };
      if (editingId) {
        const res = await ecomApi.put(`/stock-locations/${editingId}`, payload);
        setEntries(prev => prev.map(e => e._id === editingId ? res.data.data : e));
        setSuccess('Ligne mise à jour');
      } else {
        const res = await ecomApi.post('/stock-locations', payload);
        setEntries(prev => [...prev, res.data.data]);
        setSuccess('Ligne ajoutée');
      }
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette ligne ?')) return;
    try {
      await ecomApi.delete(`/stock-locations/${id}`);
      setEntries(prev => prev.filter(e => e._id !== id));
      setSuccess('Ligne supprimée');
    } catch (err) { setError(getContextualError(err, 'delete_order')); }
  };

  const uniqueCities = [...new Set(entries.map(e => e.city).filter(Boolean))].sort();
  const uniqueAgencies = [...new Set(entries.map(e => e.agency).filter(Boolean))].sort();

  const filtered = entries.filter(e => {
    if (filterProduct && e.productId?._id !== filterProduct) return false;
    if (filterCity && e.city !== filterCity) return false;
    if (filterAgency && e.agency !== filterAgency) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.productId?.name || '').toLowerCase().includes(q) &&
          !(e.city || '').toLowerCase().includes(q) &&
          !(e.agency || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalStock = filtered.reduce((s, e) => s + Math.max(0, (e.quantity || 0) - (e.sales || 0)), 0);
  const totalSales = filtered.reduce((s, e) => s + (e.sales || 0), 0);
  const lowStock = filtered.filter(e => Math.max(0, (e.quantity || 0) - (e.sales || 0)) <= 5).length;

  const calcActuel = (q, s) => Math.max(0, parseInt(q || 0) - parseInt(s || 0));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <svg className="w-8 h-8 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  return (
    <div className="space-y-5">
      {error && !showModal && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-3 text-emerald-400 hover:text-emerald-600">&times;</button>
        </div>
      )}

      {/* KPI Cards - Mobile optimized */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1">Stock actuel total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalStock.toLocaleString('fr-FR')}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">unités disponibles</p>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1">Total ventes</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{totalSales.toLocaleString('fr-FR')}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">unités vendues</p>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-4">
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5 sm:mb-1">Ruptures / faibles</p>
          <p className={`text-lg sm:text-2xl font-bold ${lowStock > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{lowStock}</p>
          <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{lowStock > 0 ? 'réassort urgent' : 'tout est OK'}</p>
        </div>
      </div>

      {/* Toolbar - Mobile optimized */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm p-2.5 sm:p-3 space-y-2.5 sm:space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher produit, ville, agence..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none" />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 flex-wrap">
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className="px-2.5 sm:px-3 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 outline-none">
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            className="px-2.5 sm:px-3 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 outline-none">
            <option value="">Toutes les villes</option>
            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterAgency} onChange={e => setFilterAgency(e.target.value)}
            className="px-2.5 sm:px-3 py-2 border border-gray-200 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 outline-none col-span-2 sm:col-span-1">
            <option value="">Toutes les agences</option>
            {uniqueAgencies.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={openAdd}
            className="col-span-2 sm:col-span-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* Table - Mobile cards on small screens */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">Aucune entrée de stock</p>
                <button onClick={openAdd} className="text-sm text-emerald-600 font-medium hover:underline">+ Ajouter une ligne</button>
              </div>
            </div>
          ) : filtered.map(entry => {
            const stockActuel = Math.max(0, (entry.quantity || 0) - (entry.sales || 0));
            const status = getStockStatus(stockActuel);
            return (
              <div key={entry._id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{entry.productId?.name || ''}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {entry.city && (
                        <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{entry.city}</span>
                      )}
                      {entry.agency && (
                        <span className="inline-flex items-center text-[10px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-full">{entry.agency}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(entry)}
                      className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(entry._id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 uppercase font-medium mb-0.5">Stock initial</p>
                    <p className="text-sm font-bold text-gray-900">{(entry.quantity || 0).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-600 uppercase font-medium mb-0.5">Ventes</p>
                    <p className="text-sm font-bold text-emerald-600">{(entry.sales || 0).toLocaleString('fr-FR')}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${stockActuel <= 5 ? 'bg-red-50' : stockActuel <= 15 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                    <p className={`text-[10px] uppercase font-medium mb-0.5 ${stockActuel <= 5 ? 'text-red-600' : stockActuel <= 15 ? 'text-orange-600' : 'text-emerald-600'}`}>Actuel</p>
                    <p className={`text-sm font-bold ${stockActuel <= 5 ? 'text-red-600' : stockActuel <= 15 ? 'text-orange-500' : 'text-emerald-600'}`}>{stockActuel.toLocaleString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`}></span>
                    {status.label}
                  </span>
                  {entry.createdAt && (
                    <span className="text-[10px] text-gray-400">{new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Produit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ville</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Agence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock initial</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Ventes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock actuel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">État</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500">Aucune entrée de stock</p>
                      <button onClick={openAdd} className="text-sm text-emerald-600 font-medium hover:underline">+ Ajouter une ligne</button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(entry => {
                const stockActuel = Math.max(0, (entry.quantity || 0) - (entry.sales || 0));
                const status = getStockStatus(stockActuel);
                return (
                  <tr key={entry._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium text-gray-900">{entry.productId?.name || ''}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      {entry.city
                        ? <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{entry.city}</span>
                        : <span className="text-gray-400"></span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {entry.agency
                        ? <span className="inline-flex items-center text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">{entry.agency}</span>
                        : <span className="text-gray-400"></span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{(entry.quantity || 0).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600">{(entry.sales || 0).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`font-bold text-base ${stockActuel <= 5 ? 'text-red-600' : stockActuel <= 15 ? 'text-orange-500' : 'text-emerald-600'}`}>
                        {stockActuel.toLocaleString('fr-FR')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`}></span>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(entry)}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Modifier">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(entry._id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtered.length} ligne{filtered.length > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Stock total: <strong className="text-gray-800">{totalStock.toLocaleString('fr-FR')}</strong></span>
              <span>Ventes: <strong className="text-emerald-600">{totalSales.toLocaleString('fr-FR')}</strong></span>
              {lowStock > 0 && <span className="text-red-600 font-medium">{lowStock} en rupture</span>}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingId ? 'Modifier la ligne' : 'Ajouter une ligne de stock'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Produit *</label>
                  <select value={form.productId} onChange={e => {
                    const p = products.find(p => p._id === e.target.value);
                    setForm(prev => ({ ...prev, productId: e.target.value, productName: p?.name || '' }));
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none" required>
                    <option value="">-- Choisir un produit --</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="Ex: Douala" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Agence</label>
                  <input type="text" value={form.agency} onChange={e => setForm(p => ({ ...p, agency: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="Ex: Lygos, Anka" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stock initial *</label>
                  <input type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="100" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ventes (stock vendu)</label>
                  <input type="number" min="0" value={form.sales} onChange={e => setForm(p => ({ ...p, sales: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                    placeholder="0" />
                </div>
              </div>
              {form.quantity !== '' && (
                <div className="rounded-xl p-3 bg-gray-50 border border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stock actuel calculé</span>
                  <span className={`text-lg font-bold ${calcActuel(form.quantity, form.sales) <= 5 ? 'text-red-600' : calcActuel(form.quantity, form.sales) <= 15 ? 'text-orange-500' : 'text-emerald-600'}`}>
                    {calcActuel(form.quantity, form.sales).toLocaleString('fr-FR')} unités
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
                  placeholder="Notes optionnelles..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium transition">
                  {submitting ? (editingId ? 'Modification...' : 'Ajout...') : (editingId ? 'Modifier' : 'Ajouter')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
