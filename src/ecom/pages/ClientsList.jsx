import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const IconFillLoader = ({ backgroundClassName = 'bg-gray-50' }) => {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf; let start;
    const tick = (t) => {
      if (!start) start = t;
      setP(Math.min(100, Math.round(((t - start) % 1200) / 1200 * 100)));
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

const SL = { prospect: 'Prospect', confirmed: 'Confirmé', delivered: 'Livré', returned: 'Retour', blocked: 'Bloqué' };
const SC = {
  prospect: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-gray-100 text-gray-700 border-gray-200',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  returned: 'bg-orange-50 text-orange-700 border-orange-100',
  blocked: 'bg-red-50 text-red-700 border-red-100',
};
const srcLabel = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', site: 'Site web', referral: 'Parrainage', other: 'Autre' };

const ClientsList = () => {
  const { user } = useEcomAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState(['delivered', 'confirmed', 'pending', 'shipped']);

  const availableSyncStatuses = [
    { key: 'delivered', label: 'Livré', dot: 'bg-green-500', clientStatus: 'Client' },
    { key: 'confirmed', label: 'Confirmé', dot: 'bg-gray-700', clientStatus: 'Confirmé' },
    { key: 'shipped', label: 'Expédié', dot: 'bg-gray-500', clientStatus: 'Expédié' },
    { key: 'pending', label: 'En attente', dot: 'bg-yellow-500', clientStatus: 'En attente' },
    { key: 'returned', label: 'Retour', dot: 'bg-orange-400', clientStatus: 'Retour' },
    { key: 'cancelled', label: 'Annulé', dot: 'bg-red-400', clientStatus: 'Annulé' },
    { key: 'unreachable', label: 'Injoignable', dot: 'bg-gray-400', clientStatus: 'Injoignable' },
    { key: 'called', label: 'Appelé', dot: 'bg-gray-400', clientStatus: 'Appelé' },
    { key: 'postponed', label: 'Reporté', dot: 'bg-gray-400', clientStatus: 'Reporté' },
  ];

  const fetchClients = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterStatus) params.status = filterStatus;
      if (filterSource) params.source = filterSource;
      if (filterCity) params.city = filterCity;
      if (filterProduct) params.product = filterProduct;
      if (filterTag) params.tag = filterTag;
      const res = await ecomApi.get('/clients', { params });
      setClients(res.data.data.clients);
      setStats(res.data.data.stats);
    } catch { setError('Erreur chargement clients'); }
  };

  const handleSyncClients = async () => {
    if (syncStatuses.length === 0) { setError('Veuillez sélectionner au moins un statut'); return; }
    setSyncing(true); setError(''); setSuccess('');
    try {
      const res = await ecomApi.post('/orders/sync-clients', { statuses: syncStatuses });
      const { created, updated, total } = res.data?.data || {};
      setSuccess(`Synchronisation terminée — ${total} clients traités (${created} créés, ${updated} mis à jour)`);
      fetchClients(); setShowSyncModal(false);
    } catch (err) { setError(err.response?.data?.message || 'Erreur synchronisation'); }
    finally { setSyncing(false); }
  };

  const handleStatusChange = async (clientId, newStatus) => {
    try { await ecomApi.put(`/ecom/clients/${clientId}`, { status: newStatus }); setSuccess('Statut mis à jour'); fetchClients(); }
    catch { setError('Erreur modification statut'); }
  };

  const handleDelete = async (clientId, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try { await ecomApi.delete(`/ecom/clients/${clientId}`); setSuccess('Client supprimé'); fetchClients(); }
    catch { setError('Erreur suppression'); }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Supprimer TOUS les clients ? Action irréversible.')) return;
    if (!confirm('Confirmez la suppression définitive de tous les clients.')) return;
    setDeletingAll(true); setError('');
    try { const res = await ecomApi.delete('/ecom/clients/bulk'); setSuccess(res.data.message); fetchClients(); }
    catch (err) { setError(err.response?.data?.message || 'Erreur suppression'); }
    finally { setDeletingAll(false); }
  };

  const resetAllFilters = () => { setSearch(''); setFilterStatus(''); setFilterSource(''); setFilterCity(''); setFilterProduct(''); setFilterTag(''); };

  useEffect(() => { fetchClients().finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!loading) fetchClients(); }, [search, filterStatus, filterSource, filterCity, filterProduct, filterTag]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  const uniqueCities = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))].sort(), [clients]);
  const uniqueProducts = useMemo(() => [...new Set(clients.flatMap(c => c.products || []).filter(Boolean))].sort(), [clients]);
  const uniqueTags = useMemo(() => [...new Set(clients.flatMap(c => c.tags || []).filter(Boolean))].sort(), [clients]);

  const activeFilters = [
    search && { key: 'search', label: `"${search}"`, clear: () => setSearch('') },
    filterStatus && { key: 'status', label: SL[filterStatus] || filterStatus, clear: () => setFilterStatus('') },
    filterSource && { key: 'source', label: srcLabel[filterSource] || filterSource, clear: () => setFilterSource('') },
    filterCity && { key: 'city', label: filterCity, clear: () => setFilterCity('') },
    filterProduct && { key: 'product', label: filterProduct, clear: () => setFilterProduct('') },
    filterTag && { key: 'tag', label: filterTag, clear: () => setFilterTag('') },
  ].filter(Boolean);

  if (loading) return <IconFillLoader />;

  const statsRow = [
    { label: 'Total', value: stats.total || 0 },
    { label: 'Prospects', value: stats.prospects || 0 },
    { label: 'Confirmés', value: stats.confirmed || 0 },
    { label: 'Livrés', value: stats.delivered || 0, green: true },
    { label: 'Retours', value: stats.returned || 0 },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && (
        <div className="mb-4 flex items-center gap-2.5 p-3 bg-green-50 text-green-800 rounded-xl text-sm border border-green-100">
          <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{error}</div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Clients</h1>
            <p className="text-sm text-gray-400 mt-0.5">Base de contacts et segments</p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'ecom_admin' && (
              <button
                onClick={() => setShowSyncModal(true)}
                disabled={syncing}
                className="h-10 px-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                )}
                <span className="hidden sm:inline">{syncing ? 'Sync...' : 'Sync'}</span>
              </button>
            )}
            {user?.role === 'ecom_admin' && (stats.total || 0) > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="h-10 px-3.5 bg-white border border-gray-200 text-red-500 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                <span className="hidden sm:inline">{deletingAll ? 'Suppression...' : 'Tout supprimer'}</span>
              </button>
            )}
            <Link
              to="/ecom/clients/new"
              className="h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4"/></svg>
              <span>Client</span>
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          {statsRow.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.green ? 'text-green-600' : 'text-gray-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px,minmax(0,1fr)] lg:items-start">
        {/* Sidebar filtres */}
        <aside className="space-y-3 lg:sticky lg:top-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtres</p>

            {/* Recherche */}
            <div className="relative mb-3">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"/></svg>
              <input
                type="text"
                placeholder="Nom, téléphone, ville..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            {/* Statut + Source */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
                <option value="">Tous statuts</option>
                <option value="prospect">Prospect</option>
                <option value="confirmed">Confirmé</option>
                <option value="delivered">Livré</option>
                <option value="returned">Retour</option>
                <option value="blocked">Bloqué</option>
              </select>
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
                <option value="">Toutes sources</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="site">Site web</option>
                <option value="referral">Parrainage</option>
                <option value="other">Autre</option>
              </select>
            </div>

            {/* Filtres avancés toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-full h-10 px-3 rounded-xl text-sm font-medium flex items-center justify-between transition-colors ${showFilters || activeFilters.length > 0 ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                Filtres avancés
              </span>
              {activeFilters.length > 0 && (
                <span className="w-5 h-5 bg-white/20 rounded-full text-xs font-bold flex items-center justify-center">{activeFilters.length}</span>
              )}
            </button>

            {showFilters && (
              <div className="mt-3 space-y-2">
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
                  <option value="">Toutes les villes</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
                  <option value="">Tous les produits</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent cursor-pointer">
                  <option value="">Tous les tags</option>
                  {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {/* Filtres actifs */}
            {activeFilters.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 font-medium">Actifs</p>
                  <button onClick={resetAllFilters} className="text-xs font-medium text-red-500 hover:text-red-600">Tout effacer</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFilters.map(f => (
                    <button key={f.key} onClick={f.clear} className="inline-flex items-center gap-1 h-6 px-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors">
                      {f.label} <span className="text-gray-400">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mini stats sidebar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Vue actuelle</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Affichés</p>
                <p className="text-xl font-bold text-gray-900">{clients.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-0.5">Filtres</p>
                <p className="text-xl font-bold text-gray-900">{activeFilters.length}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Liste clients */}
        <section className="min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Table header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{clients.length} profil{clients.length > 1 ? 's' : ''}</p>
              {(filterStatus || filterSource) && (
                <div className="flex items-center gap-1.5">
                  {filterStatus && <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{SL[filterStatus]}</span>}
                  {filterSource && <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{srcLabel[filterSource]}</span>}
                </div>
              )}
            </div>

            {clients.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{activeFilters.length > 0 ? 'Aucun résultat' : 'Aucun client'}</p>
                <p className="text-sm text-gray-400 mb-4">{activeFilters.length > 0 ? 'Modifie les filtres pour élargir la recherche.' : 'Ajoute un premier client pour démarrer.'}</p>
                <div className="flex items-center justify-center gap-2">
                  {activeFilters.length > 0 && (
                    <button onClick={resetAllFilters} className="h-9 px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Effacer les filtres</button>
                  )}
                  <Link to="/ecom/clients/new" className="h-9 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">Ajouter un client</Link>
                </div>
              </div>
            ) : (
              <>
                {/* Colonnes header desktop */}
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-4 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  {['Client', 'Contact', 'Segment', 'Produits & tags', 'Actions'].map((h, i) => (
                    <p key={h} className={`text-[11px] font-semibold text-gray-400 uppercase tracking-wide ${i === 4 ? 'text-right' : ''}`}>{h}</p>
                  ))}
                </div>

                <div className="divide-y divide-gray-100">
                  {clients.map(c => {
                    const productPreview = (c.products || []).slice(0, 2);
                    const tagPreview = (c.tags || []).slice(0, 2);
                    const extraP = Math.max(0, (c.products || []).length - 2);
                    const extraT = Math.max(0, (c.tags || []).length - 2);
                    const initials = `${c.firstName?.charAt(0) || ''}${c.lastName?.charAt(0) || ''}`.toUpperCase();

                    return (
                      <div key={c._id} className="px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:items-center lg:gap-4">

                          {/* Client */}
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">{initials || '?'}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link to={`/ecom/clients/${c._id}/edit`} className="text-sm font-semibold text-gray-900 hover:text-gray-600 truncate transition-colors">
                                  {c.firstName} {c.lastName}
                                </Link>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${SC[c.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                  {SL[c.status] || c.status}
                                </span>
                              </div>
                              {(c.city || c.address) && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                  {[c.city, c.address].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Contact */}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{c.phone || <span className="text-gray-300">—</span>}</p>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{c.email || <span className="text-gray-300">—</span>}</p>
                          </div>

                          {/* Segment */}
                          <div className="flex flex-wrap gap-1.5 lg:flex-col">
                            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              {srcLabel[c.source] || 'Inconnu'}
                            </span>
                            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              {c.totalOrders || 0} cmd{(c.totalOrders || 0) > 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Produits & tags */}
                          <div className="min-w-0">
                            {productPreview.length > 0 || tagPreview.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {productPreview.map(p => (
                                  <span key={p} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-700">{p}</span>
                                ))}
                                {extraP > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">+{extraP}</span>}
                                {tagPreview.map(t => (
                                  <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{t}</span>
                                ))}
                                {extraT > 0 && <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-500">+{extraT}</span>}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 lg:justify-end flex-wrap">
                            <select
                              value={c.status}
                              onChange={e => handleStatusChange(c._id, e.target.value)}
                              className="h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                            >
                              <option value="prospect">Prospect</option>
                              <option value="confirmed">Confirmé</option>
                              <option value="delivered">Livré</option>
                              <option value="returned">Retour</option>
                              <option value="blocked">Bloqué</option>
                            </select>
                            <Link to={`/ecom/clients/${c._id}/edit`} className="h-8 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors flex items-center">
                              Modifier
                            </Link>
                            {user?.role === 'ecom_admin' && (
                              <button onClick={() => handleDelete(c._id, `${c.firstName} ${c.lastName}`)} className="h-8 w-8 flex items-center justify-center bg-gray-50 border border-gray-200 text-red-400 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setShowSyncModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden"/>
            <div className="px-5 pt-4 pb-7 sm:pb-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Synchroniser les clients</h3>
                  <p className="text-xs text-gray-400">Importer les contacts depuis les commandes</p>
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Statuts à synchroniser</p>
              <div className="space-y-1.5 mb-5 max-h-60 overflow-y-auto">
                {availableSyncStatuses.map(s => (
                  <label key={s.key} className={`flex items-center gap-3 h-10 px-3 rounded-xl border cursor-pointer transition-colors ${syncStatuses.includes(s.key) ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      checked={syncStatuses.includes(s.key)}
                      onChange={e => setSyncStatuses(prev => e.target.checked ? [...prev, s.key] : prev.filter(x => x !== s.key))}
                      className="w-4 h-4 accent-gray-900"
                    />
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`}/>
                    <span className="text-sm text-gray-700 flex-1">{s.label}</span>
                    <span className="text-xs text-gray-400">→ {s.clientStatus}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => setShowSyncModal(false)} className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition-colors">Annuler</button>
                <button
                  onClick={handleSyncClients}
                  disabled={syncing || syncStatuses.length === 0}
                  className="flex-1 h-11 bg-gray-900 text-white rounded-2xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  {syncing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : null}
                  {syncing ? 'Sync...' : 'Lancer la sync'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsList;
