import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Mail, Shield, Calendar, Clock, Building2,
  CheckCircle2, XCircle, Edit3, Trash2, Activity, MapPin,
  Smartphone, Globe, Key, AlertCircle, Loader2, Crown,
  Briefcase, Package, Calculator, Truck, TrendingUp, BarChart3
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

const SuperAdminUserDetail = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useEcomAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUser = async () => {
    try {
      const res = await ecomApi.get(`/super-admin/users/${userId}`);
      setUser(res.data.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur chargement utilisateur');
    }
  };

  useEffect(() => {
    fetchUser().finally(() => setLoading(false));
  }, [userId]);

  const handleToggleUser = async () => {
    try {
      const res = await ecomApi.put(`/super-admin/users/${userId}/toggle`);
      setSuccess(res.data.message);
      fetchUser();
    } catch { setError('Erreur modification'); }
  };

  const handleChangeRole = async (newRole) => {
    try {
      const res = await ecomApi.put(`/super-admin/users/${userId}/role`, { role: newRole });
      setSuccess(res.data.message);
      fetchUser();
    } catch { setError('Erreur changement de rôle'); }
  };

  const handleDeleteUser = async () => {
    if (!confirm(`Supprimer définitivement ${user.email} ?`)) return;
    try {
      await ecomApi.delete(`/super-admin/users/${userId}`);
      setSuccess('Utilisateur supprimé');
      setTimeout(() => navigate('/ecom/super-admin/users'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    }
  };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
        <p className="text-sm text-slate-600 font-semibold">Chargement des détails...</p>
      </div>
    </div>
  );

  if (!user) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-900">Utilisateur introuvable</p>
        <button
          onClick={() => navigate('/ecom/super-admin/users')}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>
      </div>
    </div>
  );

  const config = roleConfig[user.role] || roleConfig.ecom_admin;
  const RoleIcon = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
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

        {/* Back button */}
        <button
          onClick={() => navigate('/ecom/super-admin/users')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>

        {/* User Header */}
        <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
          <div className={`h-2 bg-gradient-to-r ${user.isActive ? config.gradient : 'from-rose-500 to-red-500'}`} />

          <div className="p-8">
            <div className="flex flex-wrap items-start gap-6">
              {/* Avatar */}
              <div className={`relative w-16 h-16 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-2xl sm:text-4xl font-black ring-4 ring-inset ${user.isActive ? `${config.bg} ${config.text} ${config.ring}` : 'bg-rose-50 text-rose-600 ring-rose-200'}`}>
                {user.email?.charAt(0).toUpperCase()}
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'} ring-4 ring-white flex items-center justify-center shadow-lg`}>
                  {user.isActive ? <CheckCircle2 className="w-5 h-5 text-white" /> : <XCircle className="w-5 h-5 text-white" />}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  <h1 className="text-xl sm:text-3xl font-black text-slate-900 truncate">{user.email}</h1>
                  {!user.isActive && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-rose-100 text-rose-700 px-3 py-1.5 rounded-full font-black ring-2 ring-inset ring-rose-600/20">
                      <XCircle className="w-4 h-4" />
                      BLOQUÉ
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full ring-2 ring-inset ${config.bg} ${config.text} ${config.ring}`}>
                    <RoleIcon className="w-4 h-4" />
                    {roleLabels[user.role] || user.role}
                  </span>
                  {user.workspaceId?.name && (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <Building2 className="w-4 h-4" />
                      {user.workspaceId.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleToggleUser}
                  disabled={user._id === currentUser?.id}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ring-2 ring-inset ${user.isActive
                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 hover:shadow-md ring-amber-600/20'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:shadow-md ring-emerald-600/20'
                    }`}
                >
                  {user.isActive ? <><XCircle className="w-4 h-4" /> Bloquer</> : <><CheckCircle2 className="w-4 h-4" /> Activer</>}
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={user._id === currentUser?.id}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 hover:shadow-md ring-2 ring-inset ring-rose-600/20 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Account Info */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Informations du compte</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-sm font-bold text-slate-900 break-all">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <Smartphone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Téléphone</p>
                    <p className="text-sm font-bold text-slate-900">{user.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Shield className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rôle</p>
                  <select
                    value={user.role}
                    onChange={(e) => handleChangeRole(e.target.value)}
                    disabled={user._id === currentUser?.id}
                    className="w-full text-sm font-bold px-3 py-2 bg-white border-2 border-slate-200 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="ecom_admin">Admin</option>
                    <option value="ecom_closeuse">Closeuse</option>
                    <option value="ecom_compta">Comptable</option>
                    <option value="ecom_livreur">Livreur</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Workspace</p>
                  <p className="text-sm font-bold text-slate-900">{user.workspaceId?.name || 'Aucun workspace'}</p>
                  {user.workspaceId?.slug && (
                    <p className="text-xs text-slate-400 font-mono mt-1">{user.workspaceId.slug}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Activity className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Statut</p>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${user.isActive
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                    }`}>
                    {user.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {user.isActive ? 'Actif' : 'Bloqué'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Info */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-blue-600 flex items-center justify-center shadow-md">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Activité</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Créé le</p>
                  <p className="text-sm font-bold text-slate-900">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Clock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dernière connexion</p>
                  <p className="text-sm font-bold text-slate-900">
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      : 'Jamais connecté'
                    }
                  </p>
                </div>
              </div>

              {user.deviceInfo && (
                <>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                    <Smartphone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Appareil</p>
                      <p className="text-sm font-bold text-slate-900">{user.deviceInfo.platform || 'Inconnu'}</p>
                      {user.deviceInfo.deviceId && (
                        <p className="text-xs text-slate-400 font-mono mt-1 truncate">{user.deviceInfo.deviceId}</p>
                      )}
                    </div>
                  </div>

                  {user.deviceInfo.lastSeen && (
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <Activity className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dernière activité</p>
                        <p className="text-sm font-bold text-slate-900">
                          {new Date(user.deviceInfo.lastSeen).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Additional workspaces if any */}
        {user.workspaces && user.workspaces.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-md">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Workspaces ({user.workspaces.length})</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {user.workspaces.map((ws, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-bold text-slate-900">Workspace {i + 1}</p>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">Rôle: <span className="font-bold text-slate-700">{roleLabels[ws.role] || ws.role}</span></p>
                  <p className="text-xs text-slate-500">Rejoint: <span className="font-bold text-slate-700">{new Date(ws.joinedAt).toLocaleDateString('fr-FR')}</span></p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 ${ws.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {ws.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminUserDetail;
