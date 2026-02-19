import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';

const SuperAdminActivity = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ecomApi.get('/super-admin/users', { params: { limit: 100 } });
        setUsers(res.data.data.users || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

  // Trier par dernière connexion (les plus récents en premier)
  const recentLogins = [...users]
    .filter(u => u.lastLogin)
    .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin));

  const neverConnected = users.filter(u => !u.lastLogin);
  const recentlyCreated = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

  const roleColors = {
    super_admin: 'bg-red-100 text-red-700',
    ecom_admin: 'bg-purple-100 text-purple-700',
    ecom_closeuse: 'bg-blue-100 text-blue-700',
    ecom_compta: 'bg-green-100 text-green-700'
  };
  const roleLabels = { super_admin: 'Super Admin', ecom_admin: 'Admin', ecom_closeuse: 'Closeuse', ecom_compta: 'Comptable' };

  const formatDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days}j`;
    return formatDate(d);
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Activité</h1>
        <p className="text-sm text-gray-500 mt-1">Connexions récentes et inscriptions</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Dernières connexions */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Dernières connexions</h2>
            <p className="text-[10px] text-gray-400">{recentLogins.length} utilisateur{recentLogins.length > 1 ? 's' : ''} connecté{recentLogins.length > 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {recentLogins.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">Aucune connexion enregistrée</div>
            ) : recentLogins.slice(0, 20).map(u => (
              <div key={u._id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 flex-shrink-0">
                  {u.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                    <span className="text-[10px] text-gray-400">{u.workspaceId?.name || ''}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-600 font-medium">{timeAgo(u.lastLogin)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières inscriptions */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Dernières inscriptions</h2>
            <p className="text-[10px] text-gray-400">10 derniers comptes créés</p>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {recentlyCreated.map(u => (
              <div key={u._id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                  {u.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                    <span className="text-[10px] text-gray-400">{u.workspaceId?.name || 'Sans espace'}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-600">{formatDate(u.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jamais connectés */}
        {neverConnected.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border lg:col-span-2">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold text-orange-700">Jamais connectés</h2>
              <p className="text-[10px] text-gray-400">{neverConnected.length} compte{neverConnected.length > 1 ? 's' : ''} sans aucune connexion</p>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {neverConnected.map(u => (
                <div key={u._id} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-orange-800">{u.email}</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminActivity;
