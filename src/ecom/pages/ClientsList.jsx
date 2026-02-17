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
    { key: 'confirmed', label: 'Confirmé', color: 'bg-blue-500', clientStatus: 'Confirmé' },
    { key: 'shipped', label: 'Expédié', color: 'bg-purple-500', clientStatus: 'Expédié' },
    { key: 'pending', label: 'En attente', color: 'bg-yellow-500', clientStatus: 'En attente' },
    { key: 'returned', label: 'Retour', color: 'bg-orange-500', clientStatus: 'Retour' },
    { key: 'cancelled', label: 'Annulé', color: 'bg-red-500', clientStatus: 'Annulé' },
    { key: 'unreachable', label: 'Injoignable', color: 'bg-gray-500', clientStatus: 'Injoignable' },
    { key: 'called', label: 'Appelé', color: 'bg-cyan-500', clientStatus: 'Appelé' },
    { key: 'postponed', label: 'Reporté', color: 'bg-amber-500', clientStatus: 'Reporté' }
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

  const uniqueCities = useMemo(() => [...new Set(clients.map(c => c.city).filter(Boolean))].sort(), [clients]);
  const uniqueProducts = useMemo(() => [...new Set(clients.flatMap(c => c.products || []).filter(Boolean))].sort(), [clients]);
  const uniqueTags = useMemo(() => [...new Set(clients.flatMap(c => c.tags || []).filter(Boolean))].sort(), [clients]);
  const activeFiltersCount = [filterCity, filterProduct, filterTag].filter(Boolean).length;
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  const handleStatusChange = async (clientId, newStatus) => {
    try {
      await ecomApi.put(`/clients/${clientId}`, { status: newStatus });
      setSuccess('Statut mis à jour');
      fetchClients();
    } catch { setError('Erreur modification statut'); }
  };

  const handleDelete = async (clientId, name) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    try {
      await ecomApi.delete(`/clients/${clientId}`);
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
      const res = await ecomApi.delete('/clients/bulk');
      setSuccess(res.data.message);
      fetchClients();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    } finally {
      setDeletingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total || 0} client{(stats.total || 0) > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'ecom_admin' && (
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={syncing}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
              title="Synchroniser les clients depuis les commandes"
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
                  Sync clients
                </>
              )}
            </button>
          )}
          {user?.role === 'ecom_admin' && stats.total > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingAll ? 'Suppression...' : '🗑️ Tout supprimer'}
            </button>
          )}
          <Link
            to="/clients/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            + Client
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-4">
        {[
          { label: 'Prospects', value: stats.prospects || 0, color: 'text-yellow-600' },
          { label: 'Confirmés', value: stats.confirmed || 0, color: 'text-blue-600' },
          { label: 'Livrés', value: stats.delivered || 0, color: 'text-green-600' },
          { label: 'Retours', value: stats.returned || 0, color: 'text-orange-600' },
          { label: 'Bloqués', value: stats.blocked || 0, color: 'text-red-600' }
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-2.5 sm:p-3 text-center">
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
            placeholder="Rechercher nom, tél, email, ville, produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Tous les statuts</option>
            <option value="prospect">Prospect</option>
            <option value="confirmed">Confirmé</option>
            <option value="delivered">Livré</option>
            <option value="returned">Retour</option>
            <option value="blocked">Bloqué</option>
          </select>
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
          <button onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${showFilters || activeFiltersCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            + Filtres{activeFiltersCount > 0 && <span className="bg-blue-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">{activeFiltersCount}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Ville</label>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Toutes les villes</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Produit commandé</label>
                <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Tous les produits</option>
                  {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Tag</label>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
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

      {/* Clients list */}
      {clients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">Aucun client trouvé</p>
          <Link to="/clients/new" className="inline-block mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ajouter votre premier client
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c._id} className="bg-white rounded-lg shadow p-3 sm:p-4 flex items-center gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">
                {c.firstName?.charAt(0).toUpperCase()}{c.lastName?.charAt(0).toUpperCase() || ''}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/clients/${c._id}/edit`} className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate">
                    {c.firstName} {c.lastName}
                  </Link>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[c.status]}`}>
                    {statusLabels[c.status]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-gray-400">
                  {c.phone && <span>{c.phone}</span>}
                  {c.phone && (c.address || c.city) && <span>·</span>}
                  {c.address && <span className="truncate max-w-[200px]" title={c.address}>{c.address}</span>}
                  {c.address && c.city && <span>,</span>}
                  {c.city && <span>{c.city}</span>}
                  {(c.phone || c.address || c.city) && c.source && <span>·</span>}
                  {c.source && <span>{sourceLabels[c.source]}</span>}
                  {c.totalOrders > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-600">{c.totalOrders} cmd{c.totalOrders > 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
                {((c.products || []).length > 0 || (c.tags || []).length > 0) && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {(c.products || []).map(p => (
                      <span key={p} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{p}</span>
                    ))}
                    {(c.tags || []).map(t => (
                      <span key={t} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{t}</span>
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
