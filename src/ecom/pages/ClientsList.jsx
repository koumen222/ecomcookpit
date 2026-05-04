import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
// ❌ CACHE DÉSACTIVÉ
// import { getCache, setCache } from '../utils/cacheUtils.js';

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

const statusLabels = { prospect: 'Prospect', confirmed: 'Confirmé', delivered: 'Livré', returned: 'Retour', blocked: 'Bloqué' };
const statusColors = {
  prospect: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  blocked: 'bg-red-100 text-red-800'
};
const sourceLabels = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', site: 'Site web', referral: 'Parrainage', other: 'Autre' };

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
    { key: 'delivered', label: 'Livré', color: 'bg-green-500', clientStatus: 'Client' },
    { key: 'confirmed', label: 'Confirmé', color: 'bg-emerald-600', clientStatus: 'Confirmé' },
    { key: 'shipped', label: 'Expédié', color: 'bg-emerald-600', clientStatus: 'Expédié' },
    { key: 'pending', label: 'En attente', color: 'bg-yellow-500', clientStatus: 'En attente' },
    { key: 'returned', label: 'Retour', color: 'bg-orange-500', clientStatus: 'Retour' },
    { key: 'cancelled', label: 'Annulé', color: 'bg-red-500', clientStatus: 'Annulé' },
    { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-500', clientStatus: 'Injoignable' },
    { key: 'called', label: 'Appelé', color: 'bg-cyan-500', clientStatus: 'Appelé' },
    { key: 'postponed', label: 'Reporté', color: 'bg-amber-500', clientStatus: 'Reporté' }
  ];

  const fetchClients = async (useCache = true) => {
    try {
      // ❌ CACHE DÉSACTIVÉ - Toujours charger depuis l'API

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
      
      // ❌ CACHE DÉSACTIVÉ
    } catch { setError('Erreur chargement clients'); }
  };

  const handleSyncClients = async () => {
    if (syncStatuses.length === 0) {
      setError('Veuillez sélectionner au moins un statut');
      return;
    }
    setSyncing(true);
    setError('');
    setSuccess('');
    try {
      const res = await ecomApi.post('/orders/sync-clients', { statuses: syncStatuses });
      const { created, updated, total, statusGroups } = res.data?.data || {};
      let message = `Synchronisation terminée !\n\n`;
      message += `${total} clients traités (${created} créés, ${updated} mis à jour)\n\n`;
      message += `Répartition par statut :\n`;
      Object.entries(statusGroups || {}).forEach(([status, count]) => {
        const labels = { prospect: 'Prospects', confirmed: 'Confirmés', delivered: 'Clients', returned: 'Retours' };
        message += `• ${labels[status] || status}: ${count}\n`;
      });
      setSuccess(message);
      fetchClients();
      setShowSyncModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { fetchClients().finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!loading) fetchClients(); }, [search, filterStatus, filterSource, filterCity, filterProduct, filterTag]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  const uniqueCities = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))].sort(), [clients]);
  const uniqueProducts = useMemo(() => [...new Set(clients.flatMap(c => c.products || []).filter(Boolean))].sort(), [clients]);
  const uniqueTags = useMemo(() => [...new Set(clients.flatMap(c => c.tags || []).filter(Boolean))].sort(), [clients]);
  const activeFilterChips = [
    search ? { key: 'search', label: `Recherche: ${search}`, clear: () => setSearch(''), tone: 'bg-slate-100 text-slate-700' } : null,
    filterStatus ? { key: 'status', label: `Statut: ${statusLabels[filterStatus] || filterStatus}`, clear: () => setFilterStatus(''), tone: 'bg-emerald-50 text-emerald-700' } : null,
    filterSource ? { key: 'source', label: `Source: ${sourceLabels[filterSource] || filterSource}`, clear: () => setFilterSource(''), tone: 'bg-cyan-50 text-cyan-700' } : null,
    filterCity ? { key: 'city', label: `Ville: ${filterCity}`, clear: () => setFilterCity(''), tone: 'bg-orange-50 text-orange-700' } : null,
    filterProduct ? { key: 'product', label: `Produit: ${filterProduct}`, clear: () => setFilterProduct(''), tone: 'bg-green-50 text-green-700' } : null,
    filterTag ? { key: 'tag', label: `Tag: ${filterTag}`, clear: () => setFilterTag(''), tone: 'bg-violet-50 text-violet-700' } : null
  ].filter(Boolean);
  const activeFiltersCount = activeFilterChips.length;

  if (loading) {
    return <IconFillLoader />;
  }

  const handleStatusChange = async (clientId, newStatus) => {
    try {
      await ecomApi.put(`/ecom/clients/${clientId}`, { status: newStatus });
      setSuccess('Statut mis à jour');
      fetchClients();
    } catch { setError('Erreur modification statut'); }
  };

  const handleDelete = async (clientId, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await ecomApi.delete(`/ecom/clients/${clientId}`);
      setSuccess('Client supprimé');
      fetchClients();
    } catch { setError('Erreur suppression'); }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ ATTENTION ! Supprimer TOUS les clients ? Cette action est irréversible.')) return;
    if (!confirm('Êtes-vous vraiment sûr ? Tous les clients seront définitivement supprimés.')) return;
    setDeletingAll(true);
    setError('');
    try {
      const res = await ecomApi.delete('/ecom/clients/bulk');
      setSuccess(res.data.message);
      fetchClients();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    } finally {
      setDeletingAll(false);
    }
  };

  const resetAllFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterSource('');
    setFilterCity('');
    setFilterProduct('');
    setFilterTag('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const summaryCards = [
    {
      label: 'Prospects',
      value: stats.prospects || 0,
      tone: 'amber',
      accentClassName: 'from-amber-400 to-amber-500',
      valueClassName: 'text-amber-700',
      chipClassName: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Contacts a relancer'
    },
    {
      label: 'Confirmés',
      value: stats.confirmed || 0,
      tone: 'emerald',
      accentClassName: 'from-emerald-400 to-emerald-500',
      valueClassName: 'text-emerald-700',
      chipClassName: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description: 'Commandes validées'
    },
    {
      label: 'Livrés',
      value: stats.delivered || 0,
      tone: 'green',
      accentClassName: 'from-green-400 to-green-500',
      valueClassName: 'text-green-700',
      chipClassName: 'bg-green-50 text-green-700 border-green-200',
      description: 'Clients servis'
    },
    {
      label: 'Retours',
      value: stats.returned || 0,
      tone: 'orange',
      accentClassName: 'from-orange-400 to-orange-500',
      valueClassName: 'text-orange-700',
      chipClassName: 'bg-orange-50 text-orange-700 border-orange-200',
      description: 'Cas à traiter'
    },
    {
      label: 'Bloqués',
      value: stats.blocked || 0,
      tone: 'red',
      accentClassName: 'from-red-400 to-red-500',
      valueClassName: 'text-red-700',
      chipClassName: 'bg-red-50 text-red-700 border-red-200',
      description: 'Profils en anomalie'
    }
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      {/* Header */}
      <div className="relative mb-5 overflow-hidden rounded-[30px] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-100/60 sm:mb-6 sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-emerald-50 via-white to-white" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Base clients
              </span>
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                {stats.total || 0} client{(stats.total || 0) > 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Clients</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-[15px]">
              Centralise les prospects, les commandes confirmées et les clients déjà livrés dans un espace plus lisible.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
            {user?.role === 'ecom_admin' && (
              <button
                onClick={() => setShowSyncModal(true)}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
                title="Synchroniser les clients depuis les commandes"
              >
                {syncing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Sync...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync clients
                  </>
                )}
              </button>
            )}
            {user?.role === 'ecom_admin' && stats.total > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-base leading-none">🗑️</span>
                {deletingAll ? 'Suppression...' : 'Tout supprimer'}
              </button>
            )}
            <Link
              to="/ecom/clients/new"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-emerald-700"
            >
              <span className="text-base leading-none">+</span>
              Client
            </Link>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3 lg:mt-6 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/80 p-4 shadow-sm"
            >
              <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${card.accentClassName}`} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{card.label}</p>
                  <p className={`mt-2 text-2xl font-bold sm:text-[30px] ${card.valueClassName}`}>{card.value}</p>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${card.chipClassName}`}>
                  {card.label}
                </span>
              </div>
              <p className="mt-3 text-xs text-gray-500">{card.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Recherche</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">Segmenter les clients</h2>
              </div>
              <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                {clients.length} résultat{clients.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-500">Recherche globale</span>
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Nom, téléphone, email, ville, produit..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </label>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">Statut</span>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100">
                    <option value="">Tous les statuts</option>
                    <option value="prospect">Prospect</option>
                    <option value="confirmed">Confirmé</option>
                    <option value="delivered">Livré</option>
                    <option value="returned">Retour</option>
                    <option value="blocked">Bloqué</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">Source</span>
                  <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100">
                    <option value="">Toutes les sources</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="site">Site web</option>
                    <option value="referral">Parrainage</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
              </div>

              <button onClick={() => setShowFilters(!showFilters)} className={`inline-flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-sm font-semibold transition ${showFilters || activeFiltersCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                  Filtres avancés
                </span>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-[11px] font-bold text-emerald-700">
                  {activeFiltersCount}
                </span>
              </button>

              {showFilters && (
                <div className="rounded-3xl border border-gray-100 bg-gray-50/80 p-3.5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <label className="block xl:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium text-gray-500">Ville</span>
                      <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                        <option value="">Toutes les villes</option>
                        {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium text-gray-500">Produit commandé</span>
                      <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                        <option value="">Tous les produits</option>
                        {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </label>
                    <label className="block xl:col-span-2">
                      <span className="mb-1.5 block text-xs font-medium text-gray-500">Tag</span>
                      <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100">
                        <option value="">Tous les tags</option>
                        {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-gray-500">Filtres actifs</p>
                  <button onClick={resetAllFilters} className="text-xs font-semibold text-red-600 transition hover:text-red-700">Tout réinitialiser</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeFilterChips.map((chip) => (
                    <button key={chip.key} onClick={chip.clear} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${chip.tone}`}>
                      <span className="truncate max-w-[180px]">{chip.label}</span>
                      <span className="text-sm leading-none">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Vue actuelle</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-medium text-emerald-700">Profils affichés</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{clients.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">Filtres actifs</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{activeFiltersCount}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              Utilise les filtres pour isoler une ville, une source d’acquisition ou un segment précis sans alourdir la liste principale.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Résultats</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">{clients.length} profil{clients.length > 1 ? 's' : ''} affiché{clients.length > 1 ? 's' : ''}</h2>
                  <p className="mt-1 text-sm text-gray-500">Une vue plus structurée pour suivre les contacts, commandes et relances.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterStatus && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {statusLabels[filterStatus] || filterStatus}
                    </span>
                  )}
                  {filterSource && (
                    <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                      {sourceLabels[filterSource] || filterSource}
                    </span>
                  )}
                  {!filterStatus && !filterSource && (
                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                      Tous les segments
                    </span>
                  )}
                </div>
              </div>
            </div>

            {clients.length === 0 ? (
              <div className="px-6 py-12 text-center sm:px-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-400">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-800">{activeFiltersCount > 0 ? 'Aucun client pour cette combinaison de filtres' : 'Aucun client trouvé'}</p>
                <p className="mt-2 text-sm text-gray-500">
                  {activeFiltersCount > 0 ? 'Réinitialise un ou plusieurs filtres pour élargir les résultats.' : 'Ajoute un premier client pour démarrer la base.'}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  {activeFiltersCount > 0 && (
                    <button onClick={resetAllFilters} className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
                      Réinitialiser les filtres
                    </button>
                  )}
                  <Link to="/ecom/clients/new" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    Ajouter un client
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,1.45fr)_auto] lg:items-center lg:gap-4 border-b border-gray-100 bg-gray-50/70 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  <div>Client</div>
                  <div>Contact</div>
                  <div>Segment</div>
                  <div>Produits & tags</div>
                  <div className="text-right">Actions</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {clients.map(c => {
                    const productPreview = (c.products || []).slice(0, 2);
                    const tagPreview = (c.tags || []).slice(0, 2);
                    const extraProducts = Math.max(0, (c.products || []).length - productPreview.length);
                    const extraTags = Math.max(0, (c.tags || []).length - tagPreview.length);

                    return (
                      <div key={c._id} className="px-4 py-4 transition hover:bg-gray-50/70 sm:px-5 lg:py-3.5">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,1.45fr)_auto] lg:items-center lg:gap-4">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
                                {c.firstName?.charAt(0).toUpperCase()}{c.lastName?.charAt(0).toUpperCase() || ''}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link to={`/ecom/clients/${c._id}/edit`} className="truncate text-sm font-semibold text-gray-900 transition hover:text-emerald-600">
                                    {c.firstName} {c.lastName}
                                  </Link>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusColors[c.status]}`}>
                                    {statusLabels[c.status]}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                  {c.city && <span>{c.city}</span>}
                                  {c.city && c.address && <span>•</span>}
                                  {c.address && <span className="truncate max-w-[280px]" title={c.address}>{c.address}</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="grid gap-1 text-xs text-gray-600">
                              <div className="truncate font-medium text-gray-800">{c.phone || 'Téléphone non renseigné'}</div>
                              <div className="truncate text-gray-400">{c.email || 'Email non renseigné'}</div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-2">
                              <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                                {sourceLabels[c.source] || 'Source inconnue'}
                              </span>
                              <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
                                {c.totalOrders || 0} commande{(c.totalOrders || 0) > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          <div className="min-w-0">
                            {productPreview.length > 0 || tagPreview.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {productPreview.map(p => (
                                  <span key={p} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{p}</span>
                                ))}
                                {extraProducts > 0 && (
                                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">+{extraProducts} produit{extraProducts > 1 ? 's' : ''}</span>
                                )}
                                {tagPreview.map(t => (
                                  <span key={t} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">{t}</span>
                                ))}
                                {extraTags > 0 && (
                                  <span className="rounded-full bg-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-600">+{extraTags} tag{extraTags > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Aucun produit ni tag</span>
                            )}
                          </div>

                          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:justify-end">
                            <select
                              value={c.status}
                              onChange={(e) => handleStatusChange(c._id, e.target.value)}
                              className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                            >
                              <option value="prospect">Prospect</option>
                              <option value="confirmed">Confirmé</option>
                              <option value="delivered">Livré</option>
                              <option value="returned">Retour</option>
                              <option value="blocked">Bloqué</option>
                            </select>
                            <Link
                              to={`/ecom/clients/${c._id}/edit`}
                              className="inline-flex items-center justify-center rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            >
                              Modifier
                            </Link>
                            {user?.role === 'ecom_admin' && (
                              <button
                                onClick={() => handleDelete(c._id, `${c.firstName} ${c.lastName}`)}
                                className="inline-flex items-center justify-center rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                Supprimer
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSyncModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Synchroniser les clients</h3>
              <button onClick={() => setShowSyncModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Sélectionnez les statuts de commandes à synchroniser vers les clients :
            </p>
            
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {availableSyncStatuses.map(status => (
                <label key={status.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncStatuses.includes(status.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSyncStatuses([...syncStatuses, status.key]);
                      } else {
                        setSyncStatuses(syncStatuses.filter(s => s !== status.key));
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className={`w-2 h-2 rounded-full ${status.color}`}></span>
                  <span className="text-sm text-gray-700">{status.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">→ {status.clientStatus}</span>
                </label>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSyncClients}
                disabled={syncing || syncStatuses.length === 0}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {syncing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Sync...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Lancer la sync
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsList;
