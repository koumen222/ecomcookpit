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
      } catch {}
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div></div>;

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      {success && <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>}

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration du compte Super Admin</p>
      </div>

      {/* Infos compte */}
      <div className="bg-white rounded-xl shadow-sm border mb-4">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Mon compte</h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Rôle</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800">Super Admin</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">ID</span>
            <span className="text-xs font-mono text-gray-400">{user?.id}</span>
          </div>
        </div>
      </div>

      {/* Stats plateforme */}
      <div className="bg-white rounded-xl shadow-sm border mb-4">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Plateforme</h2>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Utilisateurs</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalWorkspaces}</p>
            <p className="text-xs text-gray-500 mt-0.5">Espaces</p>
          </div>
        </div>
      </div>

      {/* Changer mot de passe */}
      <div className="bg-white rounded-xl shadow-sm border mb-4">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Changer le mot de passe</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              required
              placeholder="Min. 6 caractères"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirmer</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="w-full py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
          >
            {pwLoading ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200">
        <div className="px-4 py-3 border-b border-red-200 bg-red-50 rounded-t-xl">
          <h2 className="text-sm font-semibold text-red-800">Zone de danger</h2>
        </div>
        <div className="p-4">
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
