import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const roleLabels = { super_admin: 'Super Admin', ecom_admin: 'Admin', ecom_closeuse: 'Closeuse', ecom_compta: 'Comptable' };
const roleColors = { super_admin: 'bg-red-100 text-red-800', ecom_admin: 'bg-purple-100 text-purple-800', ecom_closeuse: 'bg-blue-100 text-blue-800', ecom_compta: 'bg-green-100 text-green-800' };

const SuperAdminUsers = () => {
  const { user: currentUser } = useEcomAuth();
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchUsers = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterWorkspace) params.workspaceId = filterWorkspace;
      if (filterStatus) params.isActive = filterStatus;
      const res = await ecomApi.get('/super-admin/users', { params });
      setUsers(res.data.data.users);
    } catch { setError('Erreur chargement utilisateurs'); }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await ecomApi.get('/super-admin/workspaces');
      setWorkspaces(res.data.data.workspaces);
    } catch {}
  };

  useEffect(() => {
    const load = async () => { setLoading(true); await Promise.all([fetchUsers(), fetchWorkspaces()]); setLoading(false); };
    load();
  }, []);

  useEffect(() => { if (!loading) fetchUsers(); }, [search, filterRole, filterWorkspace, filterStatus]);

  const handleToggleUser = async (userId) => {
    try { const res = await ecomApi.put(`/super-admin/users/${userId}/toggle`); setSuccess(res.data.message); fetchUsers(); }
    catch { setError('Erreur modification'); }
  };

  const handleChangeRole = async (userId, newRole) => {
    try { const res = await ecomApi.put(`/super-admin/users/${userId}/role`, { role: newRole }); setSuccess(res.data.message); fetchUsers(); }
    catch { setError('Erreur changement de rôle'); }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!confirm(`Supprimer définitivement ${email} ?`)) return;
    try { await ecomApi.delete(`/super-admin/users/${userId}`); setSuccess('Utilisateur supprimé'); fetchUsers(); }
    catch (err) { setError(err.response?.data?.message || 'Erreur suppression'); }
  };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

  const blocked = users.filter(u => !u.isActive).length;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} utilisateur{users.length > 1 ? 's' : ''} · {blocked} bloqué{blocked > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Rechercher par email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Tous les rôles</option>
            <option value="super_admin">Super Admin</option>
            <option value="ecom_admin">Admin</option>
            <option value="ecom_closeuse">Closeuse</option>
            <option value="ecom_compta">Comptable</option>
          </select>
          <select value={filterWorkspace} onChange={(e) => setFilterWorkspace(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Tous les espaces</option>
            {workspaces.map(ws => <option key={ws._id} value={ws._id}>{ws.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Tous les statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Bloqués</option>
          </select>
        </div>
      </div>

      {/* Users list */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">Aucun utilisateur trouvé</div>
        ) : users.map(u => (
          <div key={u._id} className={`bg-white rounded-lg shadow p-3 sm:p-4 flex items-center gap-3 ${!u.isActive ? 'opacity-60 border-l-4 border-red-400' : 'border-l-4 border-green-400'}`}>
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${u.isActive ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}>
              {u.email?.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                {!u.isActive && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">BLOQUÉ</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${roleColors[u.role]}`}>{roleLabels[u.role]}</span>
                <span className="text-[10px] text-gray-400">{u.workspaceId?.name || 'Sans espace'}</span>
                <span className="text-[10px] text-gray-300 hidden sm:inline">·</span>
                <span className="text-[10px] text-gray-400 hidden sm:inline">
                  {u.lastLogin ? `Vu ${new Date(u.lastLogin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : 'Jamais connecté'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <select
                value={u.role}
                onChange={(e) => handleChangeRole(u._id, e.target.value)}
                disabled={u._id === currentUser?.id}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 disabled:opacity-30 hidden sm:block"
              >
                <option value="ecom_admin">Admin</option>
                <option value="ecom_closeuse">Closeuse</option>
                <option value="ecom_compta">Comptable</option>
              </select>
              <button
                onClick={() => handleToggleUser(u._id)}
                disabled={u._id === currentUser?.id}
                className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition disabled:opacity-30 ${
                  u.isActive ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' : 'text-green-700 bg-green-50 hover:bg-green-100'
                }`}
              >
                {u.isActive ? 'Bloquer' : 'Débloquer'}
              </button>
              <button
                onClick={() => handleDeleteUser(u._id, u.email)}
                disabled={u._id === currentUser?.id}
                className="px-2.5 py-1.5 text-xs rounded-lg font-medium text-red-700 bg-red-50 hover:bg-red-100 transition disabled:opacity-30"
              >
                Suppr.
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminUsers;
