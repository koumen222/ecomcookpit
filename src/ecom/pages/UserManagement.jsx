import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi, { authApi } from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const UserSkeleton = () => (
  <div className="space-y-3 py-4">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-8 w-8 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    ))}
  </div>
);

const roleLabels = {
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Comptable',
  ecom_livreur: 'Livreur'
};

const roleColors = {
  ecom_admin: 'bg-emerald-100 text-emerald-900',
  ecom_closeuse: 'bg-emerald-100 text-emerald-800',
  ecom_compta: 'bg-green-100 text-green-800',
  ecom_livreur: 'bg-orange-100 text-orange-800'
};

const roleAvatarColors = {
  ecom_admin: 'bg-emerald-100 text-emerald-800',
  ecom_closeuse: 'bg-emerald-100 text-emerald-700',
  ecom_compta: 'bg-green-100 text-green-700',
  ecom_livreur: 'bg-orange-100 text-orange-700'
};

const roleFilterOptions = [
  ['', 'Tous'],
  ['ecom_closeuse', 'Closeuses'],
  ['ecom_compta', 'Comptables'],
  ['ecom_livreur', 'Livreurs'],
  ['ecom_admin', 'Admins']
];

const auditActionLabels = {
  CREATE_USER: 'Utilisateur créé',
  UPDATE_USER: 'Utilisateur modifié',
  DELETE_USER: 'Utilisateur supprimé',
  RESET_PASSWORD: 'Mot de passe réinitialisé',
  GENERATE_INVITE: 'Invitation générée',
  ACCEPT_INVITE: 'Invitation acceptée',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  LOGIN_FAILED: 'Connexion échouée',
  SETTINGS_CHANGE: 'Paramètres modifiés',
  CHANGE_ROLE: 'Rôle modifié',
  TOGGLE_USER: 'Accès modifié',
};

const auditActionColors = {
  CREATE_USER: 'bg-green-100 text-green-700',
  UPDATE_USER: 'bg-emerald-100 text-emerald-700',
  DELETE_USER: 'bg-red-100 text-red-700',
  RESET_PASSWORD: 'bg-yellow-100 text-yellow-700',
  GENERATE_INVITE: 'bg-emerald-100 text-emerald-800',
  ACCEPT_INVITE: 'bg-teal-100 text-teal-700',
  LOGIN: 'bg-gray-100 text-gray-600',
  LOGOUT: 'bg-gray-100 text-gray-600',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  SETTINGS_CHANGE: 'bg-orange-100 text-orange-700',
};

const emptyCreateForm = {
  email: '',
  password: '',
  role: 'ecom_closeuse',
  name: '',
  phone: '',
  canAccessRitaAgent: false,
};

const hasRitaAgentAccess = (user) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role !== 'ecom_admin') return false;
  return user.canAccessRitaAgent !== false;
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ù€ l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `Il y a ${d}j`;
}

function daysUntil(date) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

const UserManagement = () => {
  const { user: currentUser } = useEcomAuth();
  const [activeTab, setActiveTab] = useState('team');

  // Team
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [filterRole, setFilterRole] = useState('');

  // Invites
  const [invites, setInvites] = useState([]);
  const [inviteStats, setInviteStats] = useState({});
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPagination, setAuditPagination] = useState({});

  // Shared
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({ role: '', isActive: true, canAccessRitaAgent: false });
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data loaders
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const params = {};
      if (filterRole) params.role = filterRole;
      const res = await ecomApi.get('/users', { params });
      const users = res.data?.data?.users || [];
      const stats = res.data?.data?.stats || {};
      setUsers(users); setStats(stats);
    } catch (err) {
      setError(getContextualError(err, 'load_users'));
    } finally {
      setLoadingUsers(false);
    }
  }, [filterRole]);

  const loadInvites = useCallback(async () => {
    try {
      setLoadingInvites(true);
      const res = await ecomApi.get('/users/invites/list');
      const invites = res.data?.data?.invites || [];
      const stats = res.data?.data?.stats || {};
      setInvites(invites); setInviteStats(stats);
    } catch (err) {
      setError(getContextualError(err, 'load_users'));
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  const loadAudit = useCallback(async (page = 1) => {
    try {
      setLoadingAudit(true);
      const res = await ecomApi.get(`/users/audit/logs?page=${page}&limit=20`);
      setAuditLogs(res.data?.data?.logs || []);
      setAuditPagination(res.data?.data?.pagination || {});
      setAuditPage(page);
    } catch (err) {
      setError(getContextualError(err, 'load_users'));
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => {
    if (activeTab === 'invites') loadInvites();
    if (activeTab === 'audit') loadAudit(1);
  }, [activeTab, loadInvites, loadAudit]);

  // Team actions
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await ecomApi.post('/users', createForm);
      setSuccess('Utilisateur créé avec succès');
      setShowCreateModal(false);
      setCreateForm(emptyCreateForm);
      loadUsers();
    } catch (err) {
      setError(getContextualError(err, 'save_user'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setError('');
    try {
      await ecomApi.put(`/users/${selectedUser._id}`, editForm);
      setSuccess('Utilisateur mis à jour');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      setError(getContextualError(err, 'save_user'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setError('');
    try {
      await ecomApi.put(`/users/${selectedUser._id}/reset-password`, { newPassword });
      setSuccess('Mot de passe réinitialisé');
      setShowResetPwModal(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (err) {
      setError(getContextualError(err, 'reset_password'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u) => {
    if (u._id === currentUser?.id) return;
    try {
      await ecomApi.put(`/users/${u._id}`, { isActive: !u.isActive });
      setSuccess(`${u.email} ${!u.isActive ? 'activé' : 'désactivé'}`);
      loadUsers();
    } catch (err) {
      setError(getContextualError(err, 'save_user'));
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Supprimer cet utilisateur définitivement ?')) return;
    try {
      await ecomApi.delete(`/users/${userId}`);
      setSuccess('Utilisateur supprimé');
      loadUsers();
    } catch (err) {
      setError(getContextualError(err, 'delete_user'));
    }
  };

  const openEdit = (u) => {
    setSelectedUser(u);
    setEditForm({
      role: u.role,
      isActive: u.isActive,
      canAccessRitaAgent: hasRitaAgentAccess(u),
    });
    setShowEditModal(true);
  };
  const openResetPw = (u) => { setSelectedUser(u); setNewPassword(''); setShowResetPwModal(true); };

  // Invite actions
  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    setError('');
    try {
      const response = await authApi.generateInvite();
      const { inviteLink } = response.data.data;
      await navigator.clipboard.writeText(inviteLink);
      setSuccess('Lien généré et copié dans le presse-papier !');
      loadInvites();
    } catch (err) {
      setError(getContextualError(err, 'generate_invite'));
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyLink = async (invite) => {
    try {
      await navigator.clipboard.writeText(invite.inviteLink);
      setCopiedId(invite._id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Impossible de copier le lien. Vérifiez les permissions du navigateur.');
    }
  };

  // Auto-clear messages
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); }
  }, [error]);

  const tabs = [
    { id: 'team', label: 'Équipe', count: stats.total },
    { id: 'invites', label: 'Invitations', count: inviteStats.active },
    { id: 'audit', label: 'Activité' },
  ];

  const totalMembers = stats.total || 0;
  const activeMembers = stats.active || 0;
  const currentRoleFilterLabel = roleFilterOptions.find(([value]) => value === filterRole)?.[1] || 'Tous';

  return (
    <div className="mx-auto max-w-6xl p-3 sm:p-4 lg:p-6">
      {success && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {success}
        </div>
      )}
      {error && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          {error}
        </div>
      )}

      <div className="relative mb-6 overflow-hidden rounded-[30px] border border-emerald-100 bg-white p-4 shadow-sm shadow-emerald-100/60 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-emerald-50 via-white to-white" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Workspace
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-500">
                  {totalMembers} membres · {activeMembers} actifs
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Gestion Équipe</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-[15px]">
                Gérez les accès, les invitations et l’activité de votre équipe dans une vue plus claire.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
              <Link
                to="/ecom/users/team/performance"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                Performances
              </Link>

              {activeTab === 'team' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Ajouter
                </button>
              )}

              {activeTab === 'invites' && (
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {generatingInvite
                    ? <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  }
                  Nouveau lien
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${activeTab === tab.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-100/70' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <div>
                  <p className="text-sm font-semibold">{tab.label}</p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">Section</p>
                </div>
                {tab.count > 0 ? (
                  <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold ${activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                    {tab.count}
                  </span>
                ) : (
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${activeTab === tab.id ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TAB: ÉQUIPE ── */}
      {activeTab === 'team' && (
        <>
          <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-sm shadow-gray-100/80 sm:p-5">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Équipe</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">Membres du workspace</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {users.length} affiché{users.length > 1 ? 's' : ''} · filtre {currentRoleFilterLabel.toLowerCase()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {roleFilterOptions.map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setFilterRole(val)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${filterRole === val ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-200' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadingUsers ? (
              <UserSkeleton />
            ) : users.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-lg font-semibold text-gray-900">Aucun membre pour l'instant</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Ajoutez des membres ou passez par un lien d'invitation pour démarrer l'équipe.</p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button onClick={() => setShowCreateModal(true)} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">Ajouter un membre</button>
                  <button onClick={() => setActiveTab('invites')} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Voir les invitations</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="hidden xl:grid xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.25fr)_minmax(0,0.95fr)_auto] xl:gap-4 xl:px-4 xl:text-[11px] xl:font-semibold xl:uppercase xl:tracking-[0.18em] xl:text-gray-400">
                  <span>Membre</span>
                  <span>Accès</span>
                  <span>Activité</span>
                  <span className="text-right">Actions</span>
                </div>

                {users.map((u) => {
                  const isCurrentUser = u._id === currentUser?.id || u._id === currentUser?._id;
                  return (
                    <div
                      key={u._id}
                      className={`rounded-[26px] border border-gray-100 bg-white px-4 py-4 shadow-sm shadow-gray-100/80 transition hover:border-emerald-200 hover:shadow-md ${!u.isActive ? 'opacity-60' : ''}`}
                    >
                      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.25fr)_minmax(0,0.95fr)_auto] xl:items-center xl:gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${roleAvatarColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                            {(u.name || u.email)?.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-gray-900">{u.name || u.email}</p>
                              {isCurrentUser && (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  Vous
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-500">{u.email}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-start">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${roleColors[u.role]}`}>
                            {roleLabels[u.role]}
                          </span>
                          {u.role === 'ecom_admin' && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${hasRitaAgentAccess(u) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {hasRitaAgentAccess(u) ? 'Rita autorise' : 'Rita bloque'}
                            </span>
                          )}
                          {!u.isActive && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">
                              Inactif
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 xl:hidden">Activité</p>
                          <p className="mt-1 text-sm font-medium text-gray-700 xl:mt-0">
                            {u.lastLogin ? `Connexion ${timeAgo(u.lastLogin)}` : 'Jamais connecté'}
                          </p>
                        </div>

                        {isCurrentUser ? (
                          <div className="flex justify-start xl:justify-end">
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                              Compte actuel
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 xl:justify-end">
                            <button onClick={() => handleToggleActive(u)} title={u.isActive ? 'Désactiver' : 'Activer'}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${u.isActive ? 'bg-green-400' : 'bg-gray-200'}`}>
                              <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${u.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                            <button onClick={() => openEdit(u)} className="rounded-xl p-2 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600" title="Modifier">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => openResetPw(u)} className="rounded-xl p-2 text-gray-400 transition hover:bg-yellow-50 hover:text-yellow-600" title="Mot de passe">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            </button>
                            <button onClick={() => handleDelete(u._id)} className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600" title="Supprimer">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: INVITATIONS ── */}
      {activeTab === 'invites' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[['Actifs', inviteStats.active || 0, 'text-green-600'], ['Utilisés', inviteStats.used || 0, 'text-gray-500'], ['Expirés', inviteStats.expired || 0, 'text-red-500']].map(([label, val, color]) => (
              <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                <p className={`text-2xl font-bold ${color}`}>{val}</p>
                <p className="text-[10px] text-gray-500 uppercase font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {loadingInvites ? (
            <UserSkeleton />
          ) : invites.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </div>
              <p className="font-semibold text-gray-900 mb-1">Aucun lien d'invitation</p>
              <p className="text-sm text-gray-500 mb-4">Générez un lien et partagez-le avec votre équipe. Il sera valide 7 jours.</p>
              <button onClick={handleGenerateInvite} disabled={generatingInvite} className="px-5 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">
                {generatingInvite ? 'Génération...' : 'Générer mon premier lien'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {invites.map((inv) => {
                const isActive = !inv.used && !inv.isExpired;
                return (
                  <div key={inv._id} className={`bg-white rounded-xl border p-4 ${isActive ? 'border-emerald-100' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {inv.used ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">Utilisé</span>
                          ) : inv.isExpired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Expiré</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">Actif · {daysUntil(inv.expiresAt)}j restants</span>
                          )}
                          <span className="text-[10px] text-gray-400">Créé {timeAgo(inv.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate">{inv.inviteLink}</p>
                        {inv.used && inv.usedBy && (
                          <p className="text-[10px] text-gray-400 mt-1">Accepté par {inv.usedBy.email || inv.usedBy.name} · {timeAgo(inv.usedAt)}</p>
                        )}
                      </div>
                      {isActive && (
                        <button onClick={() => handleCopyLink(inv)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${copiedId === inv._id ? 'bg-green-100 text-green-700' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}>
                          {copiedId === inv._id ? (
                            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copié</>
                          ) : (
                            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copier</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB: ACTIVITÉ (AUDIT) ── */}
      {activeTab === 'audit' && (
        <>
          {loadingAudit ? (
            <UserSkeleton />
          ) : auditLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="font-semibold text-gray-900 mb-1">Aucune activité enregistrée</p>
              <p className="text-sm text-gray-500">Les actions de votre équipe apparaîtront ici.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log._id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${roleAvatarColors[log.userRole] || 'bg-gray-100 text-gray-600'}`}>
                      {log.userEmail?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-gray-800 truncate">{log.userEmail}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${auditActionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {auditActionLabels[log.action] || log.action}
                        </span>
                      </div>
                      {log.details && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{log.details}</p>}
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(log.createdAt)}</span>
                  </div>
                ))}
              </div>
              {auditPagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <button onClick={() => loadAudit(auditPage - 1)} disabled={auditPage <= 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Précédent</button>
                  <span className="px-3 py-1.5 text-xs text-gray-500">{auditPage} / {auditPagination.pages}</span>
                  <button onClick={() => loadAudit(auditPage + 1)} disabled={auditPage >= auditPagination.pages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant</button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── MODAL: Créer ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouvel utilisateur</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input type="email" required value={createForm.email} onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm" placeholder="email@exemple.com" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe *</label>
                <input type="password" required minLength={6} value={createForm.password} onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm" placeholder="Min. 6 caractères" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Rôle *</label>
                <select value={createForm.role} onChange={(e) => setCreateForm(p => ({ ...p, role: e.target.value, canAccessRitaAgent: e.target.value === 'ecom_admin' ? p.canAccessRitaAgent : false }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm">
                  <option value="ecom_closeuse">Closeuse</option>
                  <option value="ecom_compta">Comptable</option>
                  <option value="ecom_livreur">Livreur</option>
                  <option value="ecom_admin">Admin</option>
                </select></div>
              {createForm.role === 'ecom_admin' && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Acces Rita IA</p>
                    <p className="text-xs text-gray-500">Autorise la creation et la configuration de l'agent Rita.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateForm(p => ({ ...p, canAccessRitaAgent: !p.canAccessRitaAgent }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${createForm.canAccessRitaAgent ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${createForm.canAccessRitaAgent ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
              {createForm.role === 'ecom_livreur' && (<>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nom du livreur" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">Téléphone WhatsApp *</label>
                  <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: 237676778377" /></div>
              </>)}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">{submitting ? 'Création...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Modifier rôle + accès ── */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Modifier l'accès</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
            <form onSubmit={handleEdit} className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Rôle</label>
                <select value={editForm.role} onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value, canAccessRitaAgent: e.target.value === 'ecom_admin' ? p.canAccessRitaAgent : false }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-600 text-sm">
                  <option value="ecom_closeuse">Closeuse</option>
                  <option value="ecom_compta">Comptable</option>
                  <option value="ecom_livreur">Livreur</option>
                  <option value="ecom_admin">Admin</option>
                </select></div>
              {editForm.role === 'ecom_admin' && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Acces Rita IA</p>
                    <p className="text-xs text-gray-500">Bloque ou autorise l'acces direct a Rita pour ce compte.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditForm(p => ({ ...p, canAccessRitaAgent: !p.canAccessRitaAgent }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.canAccessRitaAgent ? 'bg-emerald-600' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.canAccessRitaAgent ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-800">Accès actif</p>
                  <p className="text-xs text-gray-500">{editForm.isActive ? 'L\'utilisateur peut se connecter' : 'Accès bloqué'}</p>
                </div>
                <button type="button" onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${editForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); }} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Reset Password ── */}
      {showResetPwModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe *</label>
                <input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm" placeholder="Min. 6 caractères" /></div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowResetPwModal(false); setSelectedUser(null); }} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium">{submitting ? 'Réinitialisation...' : 'Réinitialiser'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
