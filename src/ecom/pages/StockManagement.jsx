import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

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
        <img src="/icon.png" alt="Loading" className="w-20 h-20 object-contain opacity-20" />
        <div className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out" style={{ clipPath: `inset(${100 - p}% 0 0 0)` }}>
          <img src="/icon.png" alt="Loading" className="w-20 h-20 object-contain" />
        </div>
      </div>
    </div>
  );
};

function getStockStatus(current) {
  if (current <= 5) return { label: 'Rupture imminente', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', bar: 'bg-red-400' };
  if (current <= 15) return { label: 'À surveiller', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', bar: 'bg-amber-400' };
  return { label: 'Bon stock', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-400' };
}

const getTodayInputDate = () => new Date().toISOString().split('T')[0];
const toInputDate = (value) => {
  if (!value) return getTodayInputDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getTodayInputDate();
  return parsed.toISOString().split('T')[0];
};
const formatStockDate = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const createEmptyForm = () => ({ productId: '', city: '', agency: '', quantity: '', sales: '', stockDate: getTodayInputDate(), notes: '' });

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
  const [form, setForm] = useState(createEmptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAll();
    const onStoreSwitch = () => loadAll(false);
    window.addEventListener('scalor:store-switch', onStoreSwitch);
    return () => window.removeEventListener('scalor:store-switch', onStoreSwitch);
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [entriesRes, productsRes] = await Promise.all([
        ecomApi.get('/stock-locations'),
        ecomApi.get('/products')
      ]);
      setEntries(entriesRes.data.data || []);
      setProducts(productsRes.data.data?.products || productsRes.data.data || []);
    } catch (err) {
      setError(getContextualError(err, 'load_stats'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <IconFillLoader />;

  const openAdd = () => { setEditingId(null); setForm(createEmptyForm()); setShowModal(true); };
  const openEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      productId: entry.productId?._id || entry.productId || '',
      city: entry.city || '',
      agency: entry.agency || '',
      quantity: entry.quantity?.toString() || '',
      sales: entry.sales?.toString() || '0',
      stockDate: toInputDate(entry.stockDate || entry.createdAt),
      notes: entry.notes || ''
    });
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditingId(null); setForm(createEmptyForm()); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productId || !form.quantity || !form.stockDate) { setError('Produit, date et stock initial sont requis'); return; }
    setSubmitting(true); setError('');
    try {
      const payload = {
        productId: form.productId,
        city: form.city.trim(),
        agency: form.agency.trim(),
        quantity: parseInt(form.quantity) || 0,
        sales: parseInt(form.sales) || 0,
        stockDate: form.stockDate,
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
  const totalInitial = filtered.reduce((s, e) => s + (e.quantity || 0), 0);
  const totalSales = filtered.reduce((s, e) => s + (e.sales || 0), 0);
  const lowStockEntries = filtered.filter(e => Math.max(0, (e.quantity || 0) - (e.sales || 0)) <= 5);
  const lowStockCount = lowStockEntries.length;
  const salesRate = totalInitial > 0 ? Math.round((totalSales / totalInitial) * 100) : 0;
  const stockRate = totalInitial > 0 ? Math.round((totalStock / totalInitial) * 100) : 0;
  const isFiltered = !!(filterProduct || filterCity || filterAgency || search);
  const calcActuel = (q, s) => Math.max(0, parseInt(q || 0) - parseInt(s || 0));

  return (
    <div className="space-y-4">
      {/* Toasts */}
      {error && !showModal && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-3 text-emerald-400 hover:text-emerald-600 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden p-5">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/60 via-white to-white pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary-500 mb-1">Gestion du stock</p>
            <h1 className="text-xl font-bold text-gray-900">État par date, ville & agence</h1>
            <p className="mt-1 text-sm text-gray-500">Suivez chaque entrée avec une date visible sur chaque ligne.</p>
          </div>
          <button
            onClick={openAdd}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition shadow-sm shadow-primary-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Stock actuel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock actuel</p>
            <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalStock.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-gray-400 mt-0.5">unités disponibles</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>taux restant</span>
              <span className="font-semibold text-primary-600">{stockRate}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${stockRate}%` }} />
            </div>
          </div>
        </div>

        {/* Ventes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ventes</p>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalSales.toLocaleString('fr-FR')}</p>
            <p className="text-xs text-gray-400 mt-0.5">unités vendues</p>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>taux d'écoulement</span>
              <span className="font-semibold text-emerald-600">{salesRate}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${salesRate}%` }} />
            </div>
          </div>
        </div>

        {/* Ruptures */}
        <div className={`bg-white rounded-2xl border p-4 space-y-3 ${lowStockCount > 0 ? 'border-red-100' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ruptures</p>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lowStockCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <svg className={`w-4 h-4 ${lowStockCount > 0 ? 'text-red-500' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{lowStockCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">{lowStockCount > 0 ? 'réassort urgent' : 'tout est OK'}</p>
          </div>
          {lowStockCount > 0 && (
            <p className="text-[10px] text-red-500 font-medium truncate">
              {lowStockEntries.map(e => e.productId?.name || '').filter(Boolean).slice(0, 2).join(', ')}
              {lowStockEntries.length > 2 ? ` +${lowStockEntries.length - 2}` : ''}
            </p>
          )}
          {lowStockCount === 0 && <div className="h-4" />}
        </div>

        {/* Lignes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lignes</p>
            <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isFiltered ? `sur ${entries.length} total` : 'entrées de stock'}
            </p>
          </div>
          {isFiltered && (
            <button
              onClick={() => { setSearch(''); setFilterProduct(''); setFilterCity(''); setFilterAgency(''); }}
              className="text-[10px] font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Effacer les filtres
            </button>
          )}
          {!isFiltered && <div className="h-4" />}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 space-y-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher produit, ville, agence..."
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className={`flex-1 min-w-[140px] px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none transition ${filterProduct ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
            <option value="">Tous les produits</option>
            {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
            className={`flex-1 min-w-[120px] px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none transition ${filterCity ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
            <option value="">Toutes les villes</option>
            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterAgency} onChange={e => setFilterAgency(e.target.value)}
            className={`flex-1 min-w-[120px] px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none transition ${filterAgency ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
            <option value="">Toutes les agences</option>
            {uniqueAgencies.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">Aucune entrée de stock</p>
          <p className="text-sm text-gray-400 mb-4">{isFiltered ? 'Essayez d\'élargir vos filtres' : 'Commencez par ajouter une ligne'}</p>
          {!isFiltered && (
            <button onClick={openAdd} className="text-sm text-primary-600 font-semibold hover:underline">+ Ajouter une ligne</button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {filtered.map(entry => {
              const stockActuel = Math.max(0, (entry.quantity || 0) - (entry.sales || 0));
              const status = getStockStatus(stockActuel);
              const rate = (entry.quantity || 0) > 0 ? Math.round((stockActuel / (entry.quantity || 1)) * 100) : 0;
              return (
                <div key={entry._id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{entry.productId?.name || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {entry.city && (
                          <span className="text-[10px] font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{entry.city}</span>
                        )}
                        {entry.agency && (
                          <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{entry.agency}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{formatStockDate(entry.stockDate || entry.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(entry)} className="w-7 h-7 rounded-full hover:bg-primary-50 flex items-center justify-center text-gray-400 hover:text-primary-600 transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(entry._id)} className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-[9px] text-gray-400 uppercase font-semibold mb-0.5">Initial</p>
                      <p className="text-sm font-bold text-gray-800">{(entry.quantity || 0).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2">
                      <p className="text-[9px] text-emerald-600 uppercase font-semibold mb-0.5">Ventes</p>
                      <p className="text-sm font-bold text-emerald-600">{(entry.sales || 0).toLocaleString('fr-FR')}</p>
                    </div>
                    <div className={`rounded-xl p-2 ${stockActuel <= 5 ? 'bg-red-50' : stockActuel <= 15 ? 'bg-amber-50' : 'bg-primary-50'}`}>
                      <p className={`text-[9px] uppercase font-semibold mb-0.5 ${stockActuel <= 5 ? 'text-red-500' : stockActuel <= 15 ? 'text-amber-600' : 'text-primary-600'}`}>Actuel</p>
                      <p className={`text-sm font-bold ${stockActuel <= 5 ? 'text-red-600' : stockActuel <= 15 ? 'text-amber-500' : 'text-primary-600'}`}>{stockActuel.toLocaleString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${status.bar}`} style={{ width: `${rate}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">{rate}% restant</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Produit</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ville</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Agence</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Initial</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Ventes</th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Actuel</th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">État</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(entry => {
                  const stockActuel = Math.max(0, (entry.quantity || 0) - (entry.sales || 0));
                  const status = getStockStatus(stockActuel);
                  const rate = (entry.quantity || 0) > 0 ? Math.round((stockActuel / (entry.quantity || 1)) * 100) : 0;
                  return (
                    <tr key={entry._id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap tabular-nums">
                        {formatStockDate(entry.stockDate || entry.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900 max-w-[240px] truncate">{entry.productId?.name || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        {entry.city
                          ? <span className="inline-flex items-center text-xs font-medium text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full">{entry.city}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        {entry.agency
                          ? <span className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full">{entry.agency}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-700 tabular-nums">{(entry.quantity || 0).toLocaleString('fr-FR')}</td>
                      <td className="px-5 py-4 text-right font-semibold text-emerald-600 tabular-nums">{(entry.sales || 0).toLocaleString('fr-FR')}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${rate}%` }} />
                          </div>
                          <span className={`font-bold tabular-nums ${stockActuel <= 5 ? 'text-red-600' : stockActuel <= 15 ? 'text-amber-500' : 'text-primary-600'}`}>
                            {stockActuel.toLocaleString('fr-FR')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(entry)}
                            className="w-7 h-7 rounded-full hover:bg-primary-50 flex items-center justify-center text-gray-400 hover:text-primary-600 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => handleDelete(entry._id)}
                            className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400 tabular-nums">
                {filtered.length} ligne{filtered.length > 1 ? 's' : ''}
                {isFiltered ? ` sur ${entries.length}` : ''}
              </p>
              <div className="flex items-center gap-5 text-xs">
                <span className="text-gray-500">Stock total : <strong className="text-gray-800 tabular-nums">{totalStock.toLocaleString('fr-FR')}</strong></span>
                <span className="text-gray-500">Ventes : <strong className="text-emerald-600 tabular-nums">{totalSales.toLocaleString('fr-FR')}</strong></span>
                {lowStockCount > 0 && <span className="text-red-600 font-semibold">{lowStockCount} en rupture</span>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{editingId ? 'Modifier la ligne' : 'Nouvelle ligne de stock'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Produit *</label>
                  <select value={form.productId} onChange={e => {
                    const p = products.find(p => p._id === e.target.value);
                    const prevEntries = entries
                      .filter(en => (en.productId?._id || en.productId) === e.target.value)
                      .sort((a, b) => new Date(b.stockDate || b.createdAt) - new Date(a.stockDate || a.createdAt));
                    const lastEntry = prevEntries[0];
                    const prevStock = lastEntry ? Math.max(0, (lastEntry.quantity || 0) - (lastEntry.sales || 0)).toString() : '';
                    setForm(prev => ({ ...prev, productId: e.target.value, productName: p?.name || '', quantity: prevStock, sales: '0' }));
                  }} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" required>
                    <option value="">— Choisir un produit —</option>
                    {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.stockDate} onChange={e => setForm(p => ({ ...p, stockDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ville</label>
                  <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" placeholder="Ex: Douala" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Agence</label>
                  <input type="text" value={form.agency} onChange={e => setForm(p => ({ ...p, agency: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" placeholder="Ex: Lygos, Anka" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Stock du jour *
                    {form.productId && (() => {
                      const prevEntries = entries
                        .filter(en => (en.productId?._id || en.productId) === form.productId)
                        .sort((a, b) => new Date(b.stockDate || b.createdAt) - new Date(a.stockDate || a.createdAt));
                      const last = prevEntries[0];
                      if (!last) return null;
                      const prevStock = Math.max(0, (last.quantity || 0) - (last.sales || 0));
                      return <span className="ml-1.5 text-[10px] font-normal text-primary-600">← {prevStock} ({formatStockDate(last.stockDate || last.createdAt)})</span>;
                    })()}
                  </label>
                  <input type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" placeholder="100" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Ventes</label>
                  <input type="number" min="0" value={form.sales} onChange={e => setForm(p => ({ ...p, sales: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" placeholder="0" />
                </div>
              </div>
              {form.quantity !== '' && (
                <div className="rounded-xl p-3.5 bg-primary-50 border border-primary-100 flex items-center justify-between">
                  <span className="text-sm text-primary-700 font-medium">Stock actuel calculé</span>
                  <span className={`text-xl font-bold ${calcActuel(form.quantity, form.sales) <= 5 ? 'text-red-600' : calcActuel(form.quantity, form.sales) <= 15 ? 'text-amber-500' : 'text-primary-700'}`}>
                    {calcActuel(form.quantity, form.sales).toLocaleString('fr-FR')} <span className="text-sm font-normal">unités</span>
                  </span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50" placeholder="Notes optionnelles..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm font-medium transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm font-semibold transition">
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
