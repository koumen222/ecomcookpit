import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { authApi } from '../services/ecommApi.js';
import { useMoney } from '../hooks/useMoney.js';

const Profile = () => {
  const { user, workspace, logout, loadUser } = useEcomAuth();
  const { fmt } = useMoney();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);
  const [showPwdForm, setShowPwdForm] = useState(false);

  // 🆕 État de chargement pour éviter les erreurs
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setAvatar(user.avatar || '');
      setLoading(false);
    }
  }, [user]);

  const roleLabels = {
    'super_admin': 'Super Administrateur',
    'ecom_admin': 'Administrateur',
    'ecom_closeuse': 'Closeuse',
    'ecom_compta': 'Comptabilité',
    'ecom_livreur': 'Livreur'
  };

  const roleColors = {
    'super_admin': 'bg-purple-100 text-purple-800',
    'ecom_admin': 'bg-blue-100 text-blue-800',
    'ecom_closeuse': 'bg-pink-100 text-pink-800',
    'ecom_compta': 'bg-green-100 text-green-800',
    'ecom_livreur': 'bg-orange-100 text-orange-800'
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileMsg(null);
    try {
      await authApi.updateProfile({ name, phone, avatar });
      if (loadUser) await loadUser();
      setProfileMsg({ type: 'success', text: 'Profil mis à jour avec succès' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
      setTimeout(() => setProfileMsg(null), 4000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 6 caractères' });
      return;
    }
    setChangingPwd(true);
    setPwdMsg(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPwdMsg({ type: 'success', text: 'Mot de passe changé avec succès' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPwdForm(false);
    } catch (err) {
      setPwdMsg({ type: 'error', text: err.response?.data?.message || 'Erreur lors du changement' });
    } finally {
      setChangingPwd(false);
      setTimeout(() => setPwdMsg(null), 4000);
    }
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';

  // 🆕 Affichage de chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du profil...</p>
        </div>
      </div>
    );
  }

  // 🆕 Affichage si pas d'utilisateur
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Utilisateur non trouvé</p>
          <button 
            onClick={() => window.location.href = '/ecom/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ecom-mobile-container max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 safe-area-top safe-area-bottom">
      {/* Header avec avatar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="h-24 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600"></div>
        <div className="px-6 pb-6 -mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-3xl font-bold">{initial}</span>
              </div>
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold text-gray-900">{user?.name || user?.email?.split('@')[0]}</h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
            <span className={`self-start sm:self-end px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user?.role] || 'bg-gray-100 text-gray-800'}`}>
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Informations du profil */}
      <div className="ecom-mobile-card bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="ecom-mobile-text text-base font-semibold text-gray-900">Informations personnelles</h2>
            <p className="text-xs text-gray-500 mt-0.5">Modifiez votre nom et numéro de téléphone</p>
          </div>
          {profileMsg && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${profileMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {profileMsg.text}
            </span>
          )}
        </div>
        <form onSubmit={handleSaveProfile} className="p-6">
          <div className="ecom-mobile-grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                className="ecom-mobile-input w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                className="ecom-mobile-input w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="ecom-mobile-input w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-400 mt-1">L'email ne peut pas être modifié</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rôle</label>
              <input
                type="text"
                value={roleLabels[user?.role] || user?.role || ''}
                disabled
                className="ecom-mobile-input w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="ecom-mobile-button px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </div>

      {/* Espace de travail */}
      {workspace && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Espace de travail</h2>
            <p className="text-xs text-gray-500 mt-0.5">Votre espace de travail actuel</p>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-lg font-bold">{workspace.name?.charAt(0)?.toUpperCase() || 'W'}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{workspace.name}</p>
                <p className="text-xs text-gray-500 font-mono">{workspace.slug}</p>
              </div>
            </div>
            {workspace.inviteCode && user?.role === 'ecom_admin' && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Code d'invitation</p>
                    <p className="text-lg font-mono font-bold text-gray-900 tracking-widest mt-1">{workspace.inviteCode}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(workspace.inviteCode); }}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copier
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Partagez ce code pour inviter des membres dans votre espace.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sécurité */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Sécurité</h2>
            <p className="text-xs text-gray-500 mt-0.5">Gérez votre mot de passe</p>
          </div>
          {pwdMsg && (
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${pwdMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {pwdMsg.text}
            </span>
          )}
        </div>
        <div className="p-6">
          {!showPwdForm ? (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Mot de passe</p>
                  <p className="text-xs text-gray-500">Changez votre mot de passe pour sécuriser votre compte</p>
                </div>
              </div>
              <button
                onClick={() => setShowPwdForm(true)}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
              >
                Modifier
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPwdForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  {changingPwd && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  )}
                  Changer le mot de passe
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Infos compte */}
      <div className="ecom-mobile-card bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="ecom-mobile-text text-base font-semibold text-gray-900">Informations du compte</h2>
        </div>
        <div className="p-6">
          <div className="ecom-mobile-grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Membre depuis</p>
              <p className="ecom-mobile-text text-sm font-semibold text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Dernière connexion</p>
              <p className="ecom-mobile-text text-sm font-semibold text-gray-900">
                {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Statut</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Actif
              </span>
            </div>
          </div>
          
          {/* 🆕 Espace de travail info si disponible */}
          {workspace && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-lg font-bold">{workspace.name?.charAt(0)?.toUpperCase() || 'W'}</span>
                </div>
                <div>
                  <p className="ecom-mobile-text text-sm font-semibold text-gray-900">{workspace.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{workspace.slug}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Déconnexion */}
      <div className="flex justify-center">
        <button
          onClick={logout}
          className="ecom-mobile-button px-6 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition border border-red-200 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Se déconnecter
        </button>
      </div>
    </div>
  );
};

export default Profile;
