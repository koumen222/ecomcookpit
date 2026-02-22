import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const SecurityDashboard = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [securityInfo, setSecurityInfo] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState(null);

  useEffect(() => {
    const fetchSecurity = async () => {
      try {
        const res = await ecomApi.get('/super-admin/security-info');
        setSecurityInfo(res.data.data);
      } catch (err) {
        console.error('Erreur chargement sécurité:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSecurity();
  }, []);

  const fetchAuditLogs = async (page = 1) => {
    if (!isSuperAdmin) return;
    setLogsLoading(true);
    try {
      const params = { page, limit: 50 };
      if (filterAction) params.action = filterAction;
      const res = await ecomApi.get('/super-admin/audit-logs', { params });
      setAuditLogs(res.data.data.logs);
      setAuditStats(res.data.data.stats);
      setLogsPagination(res.data.data.pagination);
      setLogsPage(page);
    } catch (err) {
      console.error('Erreur audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) fetchAuditLogs();
  }, [filterAction]);

  const actionColors = {
    LOGIN: 'bg-green-100 text-green-800',
    LOGOUT: 'bg-gray-100 text-gray-800',
    LOGIN_FAILED: 'bg-red-100 text-red-800',
    VIEW_USERS: 'bg-blue-100 text-blue-800',
    VIEW_ORDERS: 'bg-blue-100 text-blue-800',
    CREATE_ORDER: 'bg-emerald-100 text-emerald-800',
    UPDATE_ORDER: 'bg-yellow-100 text-yellow-800',
    DELETE_ORDER: 'bg-red-100 text-red-800',
    DELETE_USER: 'bg-red-100 text-red-800',
    CHANGE_ROLE: 'bg-purple-100 text-purple-800',
    TOGGLE_USER: 'bg-orange-100 text-orange-800',
    TOGGLE_WORKSPACE: 'bg-orange-100 text-orange-800',
    IMPERSONATE_USER: 'bg-red-100 text-red-800',
    VIEW_SENSITIVE_DATA: 'bg-red-100 text-red-800',
    SECURITY_EVENT: 'bg-red-100 text-red-800',
    EXPORT_DATA: 'bg-yellow-100 text-yellow-800',
    SETTINGS_CHANGE: 'bg-purple-100 text-purple-800',
  };

  const actionIcons = {
    LOGIN: '🔑',
    LOGOUT: '🚪',
    LOGIN_FAILED: '🚫',
    VIEW_USERS: '👁️',
    VIEW_ORDERS: '📦',
    DELETE_USER: '🗑️',
    CHANGE_ROLE: '🔄',
    TOGGLE_USER: '⚡',
    TOGGLE_WORKSPACE: '🏢',
    IMPERSONATE_USER: '🎭',
    VIEW_SENSITIVE_DATA: '🔐',
    SECURITY_EVENT: '⚠️',
    EXPORT_DATA: '📤',
    SETTINGS_CHANGE: '⚙️',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sécurité & Protection des Données</h1>
            <p className="text-sm text-gray-500">Mesures de sécurité actives et journal d'audit</p>
          </div>
        </div>
      </div>

      {/* Stats en temps réel */}
      {securityInfo?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{securityInfo.stats.totalAuditLogs}</p>
            <p className="text-xs text-gray-500 mt-1">Actions tracées</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{securityInfo.stats.last24hActions}</p>
            <p className="text-xs text-gray-500 mt-1">Actions (24h)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{securityInfo.stats.failedLoginsLast24h}</p>
            <p className="text-xs text-gray-500 mt-1">Tentatives échouées (24h)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">10</p>
            <p className="text-xs text-gray-500 mt-1">Mesures actives</p>
          </div>
        </div>
      )}

      {/* Mesures de sécurité */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Mesures de sécurité en place
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {securityInfo?.measures?.map((measure) => (
            <div key={measure.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{measure.name}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                    {measure.type}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{measure.desc}</p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Actif
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ce que cela signifie pour vous */}
      <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl border border-emerald-200 p-5 mb-6">
        <h3 className="text-base font-semibold text-emerald-900 mb-3">Ce que cela signifie concrètement pour vous :</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: '🔒', text: 'Personne ne peut lire votre mot de passe — ni l\'admin, ni le propriétaire, ni les développeurs' },
            { icon: '📋', text: 'Chaque action de l\'admin est enregistrée dans un journal immuable — impossible à supprimer ou modifier' },
            { icon: '🏗️', text: 'Vos données sont isolées — aucun autre espace de travail ne peut y accéder' },
            { icon: '🚫', text: 'Aucun cookie publicitaire — vos habitudes ne sont pas tracées ni vendues' },
            { icon: '⚖️', text: 'L\'admin ne peut accéder qu\'aux données nécessaires à son rôle — pas plus' },
            { icon: '🛡️', text: 'Les tentatives de piratage sont bloquées automatiquement par le rate limiting' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white/60 rounded-lg p-3">
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <p className="text-sm text-emerald-800">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/ecom/privacy')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Politique de confidentialité complète
          </button>
        </div>
      </div>

      {/* Journal d'audit — Super Admin uniquement */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Journal d'audit immuable
              <span className="text-xs font-normal text-gray-400">(impossible à modifier/supprimer)</span>
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Toutes les actions</option>
                <option value="LOGIN">Connexions</option>
                <option value="LOGIN_FAILED">Connexions échouées</option>
                <option value="VIEW_USERS">Consultation utilisateurs</option>
                <option value="CHANGE_ROLE">Changements de rôle</option>
                <option value="DELETE_USER">Suppressions</option>
                <option value="TOGGLE_USER">Activations/Désactivations</option>
                <option value="VIEW_SENSITIVE_DATA">Accès données sensibles</option>
                <option value="IMPERSONATE_USER">Incarnations</option>
              </select>
              <button
                onClick={() => fetchAuditLogs(logsPage)}
                className="p-1.5 text-gray-400 hover:text-emerald-600 transition"
                title="Rafraîchir"
              >
                <svg className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats actions */}
          {auditStats && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-2">
              {auditStats.actionStats?.slice(0, 6).map((stat) => (
                <span key={stat._id} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${actionColors[stat._id] || 'bg-gray-100 text-gray-600'}`}>
                  {actionIcons[stat._id] || '📌'} {stat._id}: {stat.count}
                </span>
              ))}
            </div>
          )}

          {/* Logs table */}
          <div className="overflow-x-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Aucun log d'audit trouvé
              </div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Utilisateur</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden sm:table-cell">Rôle</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden md:table-cell">Détails</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase hidden lg:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {actionIcons[log.action] || '📌'} {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 max-w-[150px] truncate">{log.userEmail}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 hidden sm:table-cell">{log.userRole}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 max-w-[250px] truncate hidden md:table-cell" title={log.details}>{log.details}</td>
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono hidden lg:table-cell">{log.userIp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {logsPagination && logsPagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500">{logsPagination.total} logs au total</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchAuditLogs(logsPage - 1)}
                  disabled={logsPage <= 1}
                  className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                  Préc.
                </button>
                <span className="text-xs text-gray-600 px-2">{logsPage}/{logsPagination.pages}</span>
                <button
                  onClick={() => fetchAuditLogs(logsPage + 1)}
                  disabled={logsPage >= logsPagination.pages}
                  className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                  Suiv.
                </button>
              </div>
            </div>
          )}

          {/* Hash d'intégrité */}
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 rounded-b-xl">
            <p className="text-[10px] text-red-600 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Chaque log contient un hash SHA-256 d'intégrité. Les logs ne peuvent être ni modifiés, ni supprimés — même par le super administrateur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
