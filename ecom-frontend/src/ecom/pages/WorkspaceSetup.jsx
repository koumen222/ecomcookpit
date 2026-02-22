import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const WorkspaceSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, createWorkspace, joinWorkspace, logout } = useEcomAuth();
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedRole, setSelectedRole] = useState('ecom_admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/ecom/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.workspaceId) {
      const map = { super_admin: '/ecom/super-admin', ecom_admin: '/ecom/dashboard/admin', ecom_closeuse: '/ecom/dashboard/closeuse', ecom_compta: '/ecom/dashboard/compta', ecom_livreur: '/ecom/livreur' };
      navigate(map[user.role] || '/ecom/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  if (authLoading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  const roles = [
    { value: 'ecom_admin', label: 'Administrateur', desc: 'Accès complet à toutes les fonctionnalités' },
    { value: 'ecom_closeuse', label: 'Closeuse', desc: 'Commandes & ventes' },
    { value: 'ecom_compta', label: 'Comptable', desc: 'Finances & rapports' },
    { value: 'livreur', label: 'Livreur', desc: 'Livraisons' },
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (workspaceName.trim().length < 2) return;
    setLoading(true); setError('');
    try {
      await createWorkspace(workspaceName.trim(), selectedRole);
      // Rediriger selon le rôle choisi
      const roleMap = {
        ecom_admin: '/ecom/dashboard/admin',
        ecom_closeuse: '/ecom/dashboard/closeuse',
        ecom_compta: '/ecom/dashboard/compta',
        livreur: '/ecom/livreur'
      };
      navigate(roleMap[selectedRole] || '/ecom/dashboard');
    } catch (err) { setError(err.message || 'Erreur création'); }
    finally { setLoading(false); }
  };

  
  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/ecom')} className="inline-block">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-10 object-contain mx-auto" />
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Créez votre espace</h1>
          <p className="text-gray-400 text-sm mt-1">Optionnel — vous pouvez le faire plus tard</p>
        </div>

        <div className="bg-gray-900/70 border border-white/8 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2 mb-4">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Nom de votre espace</label>
              <input type="text" required placeholder="Ex: Ma Boutique, Mon Business..." value={workspaceName} onChange={e => setWorkspaceName(e.target.value)}
                className="block w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Votre rôle dans cet espace</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map(r => (
                  <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                    className={`text-left px-3 py-2.5 rounded-xl border text-xs transition ${selectedRole === r.value ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
                    <span className="font-semibold block">{r.label}</span>
                    <span className="opacity-60 text-[10px]">{r.desc}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-600">
                {selectedRole === 'ecom_admin' 
                  ? 'En tant qu\'administrateur, vous aurez accès à toutes les fonctionnalités et pourrez gérer votre équipe.'
                  : 'Vous pourrez rejoindre une équipe existante pour accéder aux données partagées.'}
              </p>
            </div>
            <button type="submit" disabled={loading || workspaceName.trim().length < 2}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
              {loading ? <Spinner /> : <><span>Créer mon espace</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
            </button>
          </form>
        </div>

        <button onClick={() => navigate('/ecom/landing')}
          className="mt-4 w-full py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 bg-transparent hover:bg-white/5 transition flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          Passer cette étape
        </button>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-700">
          <button onClick={logout} className="hover:text-gray-500 transition">Se déconnecter</button>
          <span>·</span>
          <button onClick={() => navigate('/ecom/privacy')} className="hover:text-gray-500 transition">Confidentialité</button>
          <span>·</span>
          <span>&copy; {new Date().getFullYear()} Ecom Cockpit</span>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
