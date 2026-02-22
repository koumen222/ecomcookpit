import React, { useState, useEffect, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';

const statusConfig = {
  sent:        { label: 'Envoyé',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  delivered:   { label: 'Livré',     color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  read:        { label: 'Lu',        color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  failed:      { label: 'Échoué',    color: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
  pending:     { label: 'En attente',color: 'bg-yellow-100 text-yellow-700',dot: 'bg-yellow-500' },
  undelivered: { label: 'Non livré', color: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
};

const fmt = (date) => date ? new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const SuperAdminWhatsAppLogs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, failed: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 100;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      const res = await ecomApi.get('/super-admin/whatsapp-logs', { params });
      setLogs(res.data.data.logs || []);
      setStats(res.data.data.stats || {});
      setTotal(res.data.data.total || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des logs');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.phone?.toLowerCase().includes(q) ||
      log.firstName?.toLowerCase().includes(q) ||
      log.campaignId?.name?.toLowerCase().includes(q) ||
      log.workspaceId?.name?.toLowerCase().includes(q) ||
      log.error?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Logs WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">Historique de tous les envois WhatsApp — diagnostiquez les échecs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
          { label: 'Envoyés', value: stats.sent, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Livrés', value: stats.delivered, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Échoués', value: stats.failed, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'En attente', value: stats.pending, color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher par téléphone, nom, campagne, workspace, erreur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '', label: 'Tous' },
            { value: 'sent', label: 'Envoyés' },
            { value: 'delivered', label: 'Livrés' },
            { value: 'failed', label: 'Échoués' },
            { value: 'pending', label: 'En attente' },
            { value: 'undelivered', label: 'Non livrés' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => { setFilterStatus(f.value); setPage(1); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                filterStatus === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchLogs}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <p className="text-gray-500 font-medium">Aucun log trouvé</p>
          <p className="text-gray-400 text-sm mt-1">Les logs d'envoi WhatsApp apparaîtront ici</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Téléphone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nom</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Workspace</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Campagne</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Envoyé le</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Erreur</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(log => {
                  const sc = statusConfig[log.status] || { label: log.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
                  const isExpanded = expandedId === log._id;
                  return (
                    <React.Fragment key={log._id}>
                      <tr className={`hover:bg-gray-50 transition ${log.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`}></span>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{log.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{log.firstName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{log.workspaceId?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{log.campaignId?.name || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmt(log.sentAt)}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {log.error ? (
                            <span className="text-red-600 text-xs truncate block" title={log.error}>{log.error}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log._id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {isExpanded ? 'Masquer' : 'Détails'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="grid sm:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-gray-700 mb-2">Message envoyé</p>
                                <div className="bg-white border border-gray-200 rounded-lg p-3 whitespace-pre-wrap text-gray-700 max-h-40 overflow-y-auto">
                                  {log.messageSent || <span className="text-gray-400 italic">Aucun message enregistré</span>}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <p className="font-semibold text-gray-700 mb-2">Détails techniques</p>
                                <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">ID Log</span>
                                    <span className="font-mono text-gray-700 text-[10px]">{log._id}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Message ID</span>
                                    <span className="font-mono text-gray-700 text-[10px]">{log.messageId || '—'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Livré le</span>
                                    <span className="text-gray-700">{fmt(log.deliveredAt)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Lu le</span>
                                    <span className="text-gray-700">{fmt(log.readAt)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Envoyé par</span>
                                    <span className="text-gray-700">{log.userId?.email || '—'}</span>
                                  </div>
                                  {log.error && (
                                    <div className="mt-2 pt-2 border-t border-red-100">
                                      <p className="text-red-600 font-medium mb-1">Erreur :</p>
                                      <p className="text-red-500 break-all">{log.error}</p>
                                    </div>
                                  )}
                                  {log.providerResponse && Object.keys(log.providerResponse).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <p className="text-gray-500 font-medium mb-1">Réponse provider :</p>
                                      <pre className="text-[10px] text-gray-600 overflow-auto max-h-24 bg-gray-50 p-2 rounded">
                                        {JSON.stringify(Object.fromEntries(log.providerResponse), null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} sur {total} logs
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  ← Précédent
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * LIMIT >= total}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
                >
                  Suivant →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminWhatsAppLogs;
