import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Filter, Shield, Crown, Briefcase, Package,
  Calculator, Truck, CheckCircle2, XCircle, Trash2, Edit3,
  Clock, Building2, AlertCircle, Loader2, TrendingUp, UserX, ChevronRight
} from 'lucide-react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const roleLabels = {
  super_admin: 'Super Admin',
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Comptable',
  ecom_livreur: 'Livreur'
};

const roleConfig = {
  super_admin: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-600/20',
    icon: Crown,
    gradient: 'from-rose-500 to-pink-500'
  },
  ecom_admin: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    ring: 'ring-violet-600/20',
    icon: Briefcase,
    gradient: 'from-violet-500 to-purple-500'
  },
  ecom_closeuse: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    ring: 'ring-sky-600/20',
    icon: Package,
    gradient: 'from-sky-500 to-blue-500'
  },
  ecom_compta: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'ring-emerald-600/20',
    icon: Calculator,
    gradient: 'from-emerald-500 to-teal-500'
  },
  ecom_livreur: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'ring-amber-600/20',
    icon: Truck,
    gradient: 'from-amber-500 to-orange-500'
  },
};

const SuperAdminUsers = () => {
  const navigate = useNavigate();
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
    } catch { }
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

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
        <p className="text-sm text-slate-600 font-semibold">Chargement des utilisateurs...</p>
      </div>
    </div>
  );

  const blocked = users.filter(u => !u.isActive).length;
  const activeUsers = users.filter(u => u.isActive).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        {/* Toasts */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm text-emerald-800 shadow-lg">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="font-semibold">{success}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl text-sm text-rose-800 shadow-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">Gestion des utilisateurs</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <Users className="w-3.5 h-3.5" />
                  {users.length} total
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {activeUsers} actifs
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600">
                  <XCircle className="w-3.5 h-3.5" />
                  {blocked} bloqués
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">Filtres</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              />
            </div>
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all cursor-pointer">
              <option value="">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="ecom_admin">Admin</option>
              <option value="ecom_closeuse">Closeuse</option>
              <option value="ecom_compta">Comptable</option>
              <option value="ecom_livreur">Livreur</option>
            </select>
            <select value={filterWorkspace} onChange={(e) => setFilterWorkspace(e.target.value)} className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all cursor-pointer">
              <option value="">Tous les espaces</option>
              {workspaces.map(ws => <option key={ws._id} value={ws._id}>{ws.name}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all cursor-pointer">
              <option value="">Tous les statuts</option>
              <option value="true">Actifs</option>
              <option value="false">Bloqués</option>
            </select>
          </div>
        </div>

        {/* Users list */}
        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-20 text-center shadow-lg">
              <UserX className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg font-black text-slate-400">Aucun utilisateur trouvé</p>
              <p className="text-sm text-slate-400 mt-2">Essayez de modifier vos filtres</p>
            </div>
          ) : users.map(u => {
            const config = roleConfig[u.role] || roleConfig.ecom_admin;
            const RoleIcon = config.icon;
            return (
              <div key={u._id} className={`group bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-900/5 hover:-translate-y-1 ${!u.isActive ? 'opacity-70 border-rose-200' : 'border-slate-200'}`}>
                {/* Accent bar */}
                <div className={`h-1 bg-gradient-to-r ${u.isActive ? config.gradient : 'from-rose-500 to-red-500'}`} />

                <div className="p-5 sm:p-6 flex items-center gap-4">
                  {/* Avatar */}
                  <div
                    onClick={() => navigate(`/ecom/super-admin/users/${u._id}`)}
                    className="cursor-pointer"
                  >
                    <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black flex-shrink-0 ring-2 ring-inset ${u.isActive ? `${config.bg} ${config.text} ${config.ring}` : 'bg-rose-50 text-rose-600 ring-rose-200'} transition-all duration-300 group-hover:scale-110`}>
                      {u.email?.charAt(0).toUpperCase()}
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'} ring-2 ring-white flex items-center justify-center`}>
                        {u.isActive ? <CheckCircle2 className="w-3 h-3 text-white" /> : <XCircle className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div
                    onClick={() => navigate(`/ecom/super-admin/users/${u._id}`)}
                    className="flex-1 min-w-0 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="text-base font-black text-slate-900 truncate">{u.email}</p>
                      {!u.isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-700 px-2 py-1 rounded-full font-black ring-2 ring-inset ring-rose-600/20">
                          <XCircle className="w-3 h-3" />
                          BLOQUÉ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ring-2 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleLabels[u.role] || u.role}
                      </span>
                      {u.workspaceId?.name && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Building2 className="w-3 h-3" />
                          {u.workspaceId.name}
                        </span>
                      )}
                      <span className="text-slate-300 hidden sm:inline">·</span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium hidden sm:flex">
                        <Clock className="w-3 h-3" />
                        {u.lastLogin ? `${new Date(u.lastLogin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : 'Jamais connecté'}
                      </span>
                    </div>
                  </div>

                  {/* View detail indicator */}
                  <div
                    onClick={() => navigate(`/ecom/super-admin/users/${u._id}`)}
                    className="flex-shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u._id, e.target.value)}
                      disabled={u._id === currentUser?.id}
                      className="text-xs font-bold px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hidden sm:block cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                    >
                      <option value="ecom_admin">Admin</option>
                      <option value="ecom_closeuse">Closeuse</option>
                      <option value="ecom_compta">Comptable</option>
                      <option value="ecom_livreur">Livreur</option>
                    </select>
                    <button
                      onClick={() => handleToggleUser(u._id)}
                      disabled={u._id === currentUser?.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-xl font-bold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ring-2 ring-inset ${u.isActive ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 hover:shadow-md ring-amber-600/20' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:shadow-md ring-emerald-600/20'}`}
                    >
                      {u.isActive ? <><XCircle className="w-3.5 h-3.5" /> Bloquer</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Activer</>}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u._id, u.email)}
                      disabled={u._id === currentUser?.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-xl font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:shadow-md ring-2 ring-inset ring-rose-600/20 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Suppr.</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminUsers;
