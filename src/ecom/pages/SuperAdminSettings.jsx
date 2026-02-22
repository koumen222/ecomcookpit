import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const SuperAdminSettings = () => {
  const { user } = useEcomAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalWorkspaces: 0 });
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, wsRes] = await Promise.all([
          ecomApi.get('/super-admin/users', { params: { limit: 1 } }),
          ecomApi.get('/super-admin/workspaces')
        ]);
        setStats({
          totalUsers: usersRes.data.data.stats.totalUsers || 0,
          totalWorkspaces: wsRes.data.data.totalWorkspaces || 0
        });
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setPwLoading(true);
    try {
      await ecomApi.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setSuccess('Mot de passe modifié avec succès');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur changement de mot de passe');
    } finally {
      setPwLoading(false);
    }
  };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Toasts */}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl text-sm text-emerald-800">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">✓</span>
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200/80 rounded-xl text-sm text-rose-800">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs">!</span>
          {error}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-500">Configuration du compte Super Admin</p>
      </div>

      {/* Infos compte */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Mon compte</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Rôle</span>
            <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10">Super Admin</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">ID</span>
            <span className="text-xs font-mono text-gray-400">{user?.id}</span>
          </div>
        </div>
      </div>

      {/* Stats plateforme */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Plateforme</h2>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="bg-gray-50/80 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">Utilisateurs</p>
          </div>
          <div className="bg-gray-50/80 rounded-xl p-4 text-center">
            <p className="text-2xl font-semibold text-gray-900">{stats.totalWorkspaces}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-1">Espaces</p>
          </div>
        </div>
      </div>

      {/* Changer mot de passe */}
      <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Changer le mot de passe</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              required
              placeholder="Min. 6 caractères"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmer</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              required
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 transition"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {pwLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-rose-200/60 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50/30">
          <h2 className="text-sm font-semibold text-rose-800">Zone de danger</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-500 mb-3">Le compte Super Admin ne peut pas être supprimé depuis l'interface. Contactez le développeur pour toute modification critique.</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Protégé par le système</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSettings;
