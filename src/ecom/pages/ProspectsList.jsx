import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const statusLabels = { prospect: 'Prospect', confirmed: 'Confirmé', delivered: 'Livré', returned: 'Retour', blocked: 'Bloqué' };
const statusColors = {
  prospect: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-orange-100 text-orange-800',
  blocked: 'bg-red-100 text-red-800'
};
const sourceLabels = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', site: 'Site web', referral: 'Parrainage', other: 'Autre' };

const ProspectsList = () => {
  const { user } = useEcomAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchProspects = async () => {
    try {
      const params = { status: 'prospect' };
      if (search) params.search = search;
      if (filterSource) params.source = filterSource;
      if (filterCity) params.city = filterCity;
      if (filterProduct) params.product = filterProduct;
      if (filterTag) params.tag = filterTag;
      const res = await ecomApi.get('/clients', { params });
      setClients(res.data.data.clients);
      setStats(res.data.data.stats);
    } catch { setError('Erreur chargement prospects'); }
  };

  useEffect(() => {
    // Auto-sync au premier chargement pour s'assurer que les prospects existent
    const init = async () => {
      try {
        await ecomApi.post('/orders/backfill-clients', {}, { timeout: 120000 });
      } catch {}
      await fetchProspects();
      setLoading(false);
    };
    init();
  }, []);
  useEffect(() => { if (!loading) fetchProspects(); }, [search, filterSource, filterCity, filterProduct, filterTag]);

  const uniqueCities = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))].sort(), [clients]);
  const uniqueProducts = useMemo(() => [...new Set(clients.flatMap(c => c.products || []).filter(Boolean))].sort(), [clients]);
  const uniqueTags = useMemo(() => [...new Set(clients.flatMap(c => c.tags || []).filter(Boolean))].sort(), [clients]);
  const activeFiltersCount = [filterCity, filterProduct, filterTag].filter(Boolean).length;
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  const handleSync = async () => {
    setSyncing(true); setError('');
    try {
      const res = await ecomApi.post('/orders/backfill-clients', {}, { timeout: 120000 });
      setSuccess(res.data.message);
      fetchProspects();
    } catch (err) { setError(err.response?.data?.message || 'Erreur synchronisation'); }
    finally { setSyncing(false); }
  };

  const handleStatusChange = async (clientId, newStatus) => {
    try {
      await ecomApi.put(`/clients/${clientId}`, { status: newStatus });
      setSuccess('Statut mis à jour');
      fetchProspects();
    } catch { setError('Erreur modification statut'); }
  };

  const handleDelete = async (clientId, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await ecomApi.delete(`/clients/${clientId}`);
      setSuccess('Prospect supprimé');
      fetchProspects();
    } catch { setError('Erreur suppression'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} prospect{clients.length > 1 ? 's' : ''} · Commandes en attente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-xs font-medium disabled:opacity-50 flex items-center gap-1.5">
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            {syncing ? 'Sync...' : 'Sync Prospects'}
          </button>
          <Link to="/ecom/campaigns/new" className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
            Relancer
          </Link>
          <Link to="/ecom/clients/new" className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition text-xs font-medium">
            + Prospect
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Prospects', value: stats.prospects || 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Confirmés', value: stats.confirmed || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Livrés', value: stats.delivered || 0, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total', value: stats.total || 0, color: 'text-gray-600', bg: 'bg-gray-50' }
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-lg p-2.5 sm:p-3 text-center`}>
            <p className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Rechercher nom, tél, ville, produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Toutes les sources</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="site">Site web</option>
            <option value="referral">Parrainage</option>
            <option value="other">Autre</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${showFilters || activeFiltersCount > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            + Filtres{activeFiltersCount > 0 && <span className="bg-yellow-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Ville</label>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500">
                  <option value="">Toutes les villes</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Produit commandé</label>
                <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500">
                  <option value="">Tous les produits</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Tag</label>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yellow-500">
                  <option value="">Tous les tags</option>
                  {uniqueTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex items-center justify-between mt-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {filterCity && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-medium">{filterCity} <button onClick={() => setFilterCity('')} className="hover:text-purple-900">&times;</button></span>}
                  {filterProduct && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-medium">{filterProduct} <button onClick={() => setFilterProduct('')} className="hover:text-green-900">&times;</button></span>}
                  {filterTag && <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-medium">{filterTag} <button onClick={() => setFilterTag('')} className="hover:text-orange-900">&times;</button></span>}
                </div>
                <button onClick={() => { setFilterCity(''); setFilterProduct(''); setFilterTag(''); }} className="text-[10px] text-red-600 hover:text-red-800 font-medium">Tout effacer</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prospects list */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">Aucun prospect</p>
          <p className="text-gray-400 text-xs mb-3">Les commandes en attente apparaîtront ici automatiquement</p>
          <Link to="/ecom/orders" className="inline-block text-sm text-yellow-600 hover:text-yellow-700 font-medium">
            Voir les commandes
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c._id} className="bg-white rounded-lg shadow p-3 sm:p-4 flex items-center gap-3 border-l-4 border-yellow-400">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-sm font-bold text-yellow-700 flex-shrink-0">
                {c.firstName?.charAt(0).toUpperCase()}{c.lastName?.charAt(0).toUpperCase() || ''}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/clients/${c._id}/edit`} className="text-sm font-medium text-gray-900 hover:text-yellow-600 truncate">
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[c.status]}`}>
                    {statusLabels[c.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-gray-400">
                  {c.phone && <span className="font-mono text-gray-500">{c.phone}</span>}
                  {c.phone && c.city && <span>·</span>}
                  {c.city && <span>{c.city}</span>}
                  {(c.phone || c.city) && c.source && <span>·</span>}
                  {c.source && <span>{sourceLabels[c.source]}</span>}
                  {c.totalOrders > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-600">{c.totalOrders} cmd{c.totalOrders > 1 ? 's' : ''}</span>
                    </>
                  )}
                  {c.totalSpent > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-yellow-600">{c.totalSpent.toLocaleString('fr-FR')} FCFA</span>
                    </>
                  )}
                </div>
                {((c.products || []).length > 0 || (c.tags || []).length > 0) && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {(c.products || []).map(p => (
                      <span key={p} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{p}</span>
                    ))}
                    {(c.tags || []).map(t => (
                      <span key={t} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        t === 'En attente' ? 'bg-amber-100 text-amber-700' :
                        t === 'Annulé' ? 'bg-red-100 text-red-700' :
                        t === 'Relancé' ? 'bg-purple-100 text-purple-700' :
                        'bg-emerald-50 text-emerald-700'
                      }`}>{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <select
                  value={c.status}
                  onChange={(e) => handleStatusChange(c._id, e.target.value)}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 hidden sm:block"
                >
                  <option value="prospect">Prospect</option>
                  <option value="confirmed">Confirmé</option>
                  <option value="delivered">Livré</option>
                  <option value="returned">Retour</option>
                  <option value="blocked">Bloqué</option>
                </select>
                {c.phone && (
                  <a href={`https://wa.me/${(c.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="WhatsApp">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                )}
                <Link
                  to={`/clients/${c._id}/edit`}
                  className="px-2.5 py-1.5 text-xs rounded-lg font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                >
                  Modifier
                </Link>
                {user?.role === 'ecom_admin' && (
                  <button
                    onClick={() => handleDelete(c._id, `${c.firstName} ${c.lastName}`)}
                    className="px-2.5 py-1.5 text-xs rounded-lg font-medium text-red-700 bg-red-50 hover:bg-red-100 transition"
                  >
                    Suppr.
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProspectsList;
