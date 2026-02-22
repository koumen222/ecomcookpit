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
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-600 animate-spin" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Chargement…</p>
      </div>
    </div>
  );

  const recentLogins = [...users]
    .filter(u => u.lastLogin)
    .sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin));

  const neverConnected = users.filter(u => !u.lastLogin);
  const recentlyCreated = [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

  const roleBadge = {
    super_admin: 'bg-rose-50 text-rose-700 ring-rose-600/10',
    ecom_admin: 'bg-violet-50 text-violet-700 ring-violet-600/10',
    ecom_closeuse: 'bg-sky-50 text-sky-700 ring-sky-600/10',
    ecom_compta: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Activité</h1>
        <p className="mt-1 text-sm text-gray-500">Connexions récentes et inscriptions</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Dernières connexions */}
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Dernières connexions</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{recentLogins.length} utilisateur{recentLogins.length > 1 ? 's' : ''} connecté{recentLogins.length > 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {recentLogins.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucune connexion enregistrée</div>
            ) : recentLogins.slice(0, 20).map(u => (
              <div key={u._id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/80 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0 ring-1 ring-inset ring-emerald-600/10">
                  {u.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${roleBadge[u.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{roleLabels[u.role] || u.role}</span>
                    <span className="text-[10px] text-gray-400">{u.workspaceId?.name || ''}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 font-medium">{timeAgo(u.lastLogin)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières inscriptions */}
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Dernières inscriptions</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">10 derniers comptes créés</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {recentlyCreated.map(u => (
              <div key={u._id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/80 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center text-xs font-bold text-sky-700 flex-shrink-0 ring-1 ring-inset ring-sky-600/10">
                  {u.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${roleBadge[u.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{roleLabels[u.role] || u.role}</span>
                    <span className="text-[10px] text-gray-400">{u.workspaceId?.name || 'Sans espace'}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{formatDate(u.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Jamais connectés */}
        {neverConnected.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200/60 overflow-hidden shadow-sm lg:col-span-2">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/30">
              <h2 className="text-sm font-semibold text-amber-800">Jamais connectés</h2>
              <p className="text-[11px] text-amber-600 mt-0.5">{neverConnected.length} compte{neverConnected.length > 1 ? 's' : ''} sans aucune connexion</p>
            </div>
            <div className="p-5 flex flex-wrap gap-2">
              {neverConnected.map(u => (
                <div key={u._id} className="flex items-center gap-2 bg-amber-50/60 border border-amber-200/60 rounded-xl px-3 py-2 transition-colors hover:bg-amber-50">
                  <span className="text-xs text-amber-800 font-medium">{u.email}</span>
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${roleBadge[u.role] || 'bg-gray-50 text-gray-600 ring-gray-200'}`}>{roleLabels[u.role] || u.role}</span>
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
