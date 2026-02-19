import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const roleLabels = {
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Comptable',
  ecom_livreur: 'Livreur'
};

const roleColors = {
  ecom_admin: 'bg-purple-100 text-purple-800',
  ecom_closeuse: 'bg-blue-100 text-blue-800',
  ecom_compta: 'bg-green-100 text-green-800',
  ecom_livreur: 'bg-orange-100 text-orange-800'
};

const UserManagement = () => {
  const { user: currentUser, workspace } = useEcomAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwModal, setShowResetPwModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form state
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'ecom_closeuse', name: '', phone: '' });
  const [editForm, setEditForm] = useState({ role: '', isActive: true });
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [filterRole]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterRole) params.role = filterRole;
      const res = await ecomApi.get('/users', { params });
      setUsers(res.data?.data?.users || []);
      setStats(res.data?.data?.stats || {});
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await ecomApi.post('/users', createForm);
      setSuccess('Utilisateur créé avec succès');
      setShowCreateModal(false);
      setCreateForm({ email: '', password: '', role: 'ecom_closeuse', name: '', phone: '' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création');
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
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
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
      setError(err.response?.data?.message || 'Erreur lors de la réinitialisation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (user._id === currentUser?.id) return;
    try {
      await ecomApi.put(`/users/${user._id}`, { isActive: !user.isActive });
      setSuccess(`Utilisateur ${!user.isActive ? 'activé' : 'désactivé'}`);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur');
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('Supprimer cet utilisateur définitivement ?')) return;
    try {
      await ecomApi.delete(`/users/${userId}`);
      setSuccess('Utilisateur supprimé');
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({ role: user.role, isActive: user.isActive });
    setShowEditModal(true);
  };

  const openResetPw = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowResetPwModal(true);
  };

  // Auto-clear messages
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 5000); return () => clearTimeout(t); }
  }, [error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-6xl mx-auto">
      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestion Équipe</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Ajouter
        </button>
      </div>

      {/* Invite Code Banner */}
      {workspace?.inviteCode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-blue-900">Code d'invitation de votre espace</p>
              <p className="text-xs text-blue-600 mt-0.5">Partagez ce code pour que vos membres rejoignent l'équipe</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-mono font-bold text-blue-800 tracking-wider">
                {workspace.inviteCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(workspace.inviteCode);
                  setSuccess('Code copié !');
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition"
              >
                Copier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.total || 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium mt-1">Total</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{stats.closeuses || 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium mt-1">Closeuses</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.comptas || 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium mt-1">Comptables</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">{stats.livreurs || 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium mt-1">Livreurs</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 text-center">
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">{stats.admins || 0}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium mt-1">Admins</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterRole('')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${!filterRole ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Tous
          </button>
          <button onClick={() => setFilterRole('ecom_closeuse')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${filterRole === 'ecom_closeuse' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Closeuses
          </button>
          <button onClick={() => setFilterRole('ecom_compta')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${filterRole === 'ecom_compta' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Comptables
          </button>
          <button onClick={() => setFilterRole('ecom_livreur')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${filterRole === 'ecom_livreur' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Livreurs
          </button>
          <button onClick={() => setFilterRole('ecom_admin')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${filterRole === 'ecom_admin' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Admins
          </button>
        </div>
      </div>

      {/* Liste utilisateurs */}
      <div className="space-y-3">
        {users.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Aucun utilisateur trouvé
          </div>
        ) : (
          users.map((u) => (
            <div key={u._id} className={`bg-white rounded-lg shadow p-3 sm:p-4 ${!u.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    u.role === 'ecom_admin' ? 'bg-purple-100' : u.role === 'ecom_compta' ? 'bg-green-100' : u.role === 'ecom_livreur' ? 'bg-orange-100' : 'bg-blue-100'
                  }`}>
                    <span className={`text-sm font-bold ${
                      u.role === 'ecom_admin' ? 'text-purple-700' : u.role === 'ecom_compta' ? 'text-green-700' : u.role === 'ecom_livreur' ? 'text-orange-700' : 'text-blue-700'
                    }`}>
                      {u.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${roleColors[u.role]}`}>
                        {roleLabels[u.role]}
                      </span>
                      {!u.isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-red-100 text-red-800">
                          Inactif
                        </span>
                      )}
                      {u.lastLogin && (
                        <span className="text-[10px] text-gray-400 hidden sm:inline">
                          Dernière connexion: {new Date(u.lastLogin).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {u._id !== currentUser?.id && (
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
                    <button onClick={() => openEdit(u)}
                      className="p-1.5 sm:px-3 sm:py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium transition">
                      <span className="hidden sm:inline">Modifier</span>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => openResetPw(u)}
                      className="p-1.5 sm:px-3 sm:py-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg text-xs font-medium transition">
                      <span className="hidden sm:inline">Mot de passe</span>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                    <button onClick={() => handleToggleActive(u)}
                      className={`p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition ${
                        u.isActive ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                      }`}>
                      <span className="hidden sm:inline">{u.isActive ? 'Désactiver' : 'Activer'}</span>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {u.isActive ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(u._id)}
                      className="p-1.5 sm:px-3 sm:py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition">
                      <span className="hidden sm:inline">Supprimer</span>
                      <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
                {u._id === currentUser?.id && (
                  <span className="text-xs text-gray-400 italic">Vous</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Créer */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nouvel utilisateur</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" required value={createForm.email}
                  onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input type="password" required minLength={6} value={createForm.password}
                  onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min. 6 caractères" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select value={createForm.role}
                  onChange={(e) => setCreateForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="ecom_closeuse">Closeuse</option>
                  <option value="ecom_compta">Comptable</option>
                  <option value="ecom_livreur">Livreur</option>
                  <option value="ecom_admin">Admin</option>
                </select>
              </div>
              {createForm.role === 'ecom_livreur' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input type="text" value={createForm.name}
                      onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Nom du livreur" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (WhatsApp) *</label>
                    <input type="tel" value={createForm.phone}
                      onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 237676778377" />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {submitting ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Modifier l'utilisateur</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select value={editForm.role}
                  onChange={(e) => setEditForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="ecom_closeuse">Closeuse</option>
                  <option value="ecom_compta">Comptable</option>
                  <option value="ecom_livreur">Livreur</option>
                  <option value="ecom_admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Actif</label>
                <button type="button"
                  onClick={() => setEditForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showResetPwModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.email}</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe *</label>
                <input type="password" required minLength={6} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Min. 6 caractères" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowResetPwModal(false); setSelectedUser(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm font-medium">
                  {submitting ? 'Réinitialisation...' : 'Réinitialiser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
