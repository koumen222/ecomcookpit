import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Users, Building2, Shield, MessageSquare, Lock } from 'lucide-react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import SuperAdminShell from '../components/SuperAdminShell.jsx';
import { CenteredSpinner } from '../components/Skeleton.jsx';

const SuperAdminSettings = () => {
  const { user } = useEcomAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalWorkspaces: 0 });
  const [loading, setLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [supportConfig, setSupportConfig] = useState({ supportNotificationPhone: '', supportNotificationInstanceId: '', supportNotificationEnabled: false });
  const [supportInstances, setSupportInstances] = useState([]);
  const [pwLoading, setPwLoading] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, wsRes, supportRes] = await Promise.all([
          ecomApi.get('/super-admin/users', { params: { limit: 1 } }),
          ecomApi.get('/super-admin/workspaces'),
          ecomApi.get('/super-admin/support/config')
        ]);
        setStats({
          totalUsers: usersRes.data?.data?.stats?.totalUsers || 0,
          totalWorkspaces: wsRes.data.data.totalWorkspaces || 0
        });
        setSupportConfig({
          supportNotificationPhone: supportRes.data?.data?.supportNotificationPhone || '',
          supportNotificationInstanceId: supportRes.data?.data?.supportNotificationInstanceId || '',
          supportNotificationEnabled: supportRes.data?.data?.supportNotificationEnabled === true,
        });
        setSupportInstances(supportRes.data?.data?.availableInstances || []);
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

  const handleSupportConfigSave = async (e) => {
    e.preventDefault();
    setSupportSaving(true);
    setError('');
    try {
      const res = await ecomApi.put('/super-admin/support/config', supportConfig);
      setSupportConfig({
        supportNotificationPhone: res.data?.data?.supportNotificationPhone || '',
        supportNotificationInstanceId: res.data?.data?.supportNotificationInstanceId || '',
        supportNotificationEnabled: res.data?.data?.supportNotificationEnabled === true,
      });
      setSupportInstances(res.data?.data?.availableInstances || []);
      setSuccess('Configuration WhatsApp support mise à jour');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur mise a jour WhatsApp support');
    } finally {
      setSupportSaving(false);
    }
  };

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => { if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); } }, [error]);

  if (loading) return <CenteredSpinner message="Chargement…" />;

  return (
    <SuperAdminShell
      title="Paramètres"
      subtitle="Configuration du compte Super Admin"
      icon={Settings}
      success={success}
      error={error}
    >
      <div className="max-w-2xl space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          {[
            { label: 'Utilisateurs', value: stats.totalUsers, icon: Users },
            { label: 'Espaces', value: stats.totalWorkspaces, icon: Building2 }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 text-center hover:shadow-lg transition-all">
              <p className="text-3xl font-extrabold text-slate-900">{s.value}</p>
              <p className="text-xs font-semibold text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mon compte */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
              <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10">Super Admin</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">ID</span>
              <span className="text-xs font-mono text-gray-400">{user?.id}</span>
            </div>
          </div>
        </div>

        {/* Notifications WhatsApp support */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Notifications WhatsApp support</h2>
          </div>
          <form onSubmit={handleSupportConfigSave} className="p-5 space-y-4">
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-700">
              Ce numero recoit uniquement les alertes d'escalade support. Les reponses restent dans l'application, jamais dans WhatsApp.
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Instance WhatsApp dédiée au support</label>
              <select
                value={supportConfig.supportNotificationInstanceId}
                onChange={(e) => setSupportConfig((prev) => ({ ...prev, supportNotificationInstanceId: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              >
                <option value="">Sélectionner une instance</option>
                {supportInstances.map((instance) => (
                  <option key={instance._id} value={instance._id}>
                    {(instance.customName || instance.instanceName)} · {instance.status}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <p className="text-gray-500">Crée ou connecte une instance dédiée pour le support avant d'activer les alertes.</p>
                <Link to="/ecom/whatsapp/service" className="font-semibold text-primary-700 hover:text-primary-800">
                  Créer / connecter une instance
                </Link>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Numero WhatsApp du super admin</label>
              <input
                type="text"
                value={supportConfig.supportNotificationPhone}
                onChange={(e) => setSupportConfig((prev) => ({ ...prev, supportNotificationPhone: e.target.value }))}
                placeholder="Ex: +237612345678"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={supportConfig.supportNotificationEnabled}
                onChange={(e) => setSupportConfig((prev) => ({ ...prev, supportNotificationEnabled: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Activer les alertes WhatsApp</p>
                <p className="text-xs text-gray-500">Nouvelle question non resolue par l'IA → notification WhatsApp via l'instance dédiée, avec lien vers la conversation.</p>
              </div>
            </label>
            <button
              type="submit"
              disabled={supportSaving}
              className="w-full py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {supportSaving ? 'Enregistrement...' : 'Enregistrer la configuration support'}
            </button>
          </form>
        </div>

        {/* Changer mot de passe */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
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
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmer</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
                required
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {pwLoading ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
          </form>
        </div>

        {/* Zone de danger */}
        <div className="bg-white rounded-2xl border border-amber-200/60 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/30">
            <h2 className="text-sm font-semibold text-amber-800">Zone de danger</h2>
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
    </SuperAdminShell>
  );
};

export default SuperAdminSettings;
