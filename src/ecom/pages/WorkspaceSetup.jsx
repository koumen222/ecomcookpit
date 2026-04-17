import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { getPendingPlanSelection } from '../utils/pendingPlanFlow.js';

const WorkspaceSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, createWorkspace, joinWorkspace, saveOnboarding, logout } = useEcomAuth();
  const pendingPlanSelection = getPendingPlanSelection();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedRole, setSelectedRole] = useState('ecom_admin');
  
  // Onboarding states
  const [phone, setPhone] = useState(user?.phone || '');
  const [businessType, setBusinessType] = useState('');
  const [ordersPerMonth, setOrdersPerMonth] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/ecom/login', { replace: true });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    // Si l'utilisateur a déjà un espace, n'est pas en train d'en créer un manuellement, et a fini son onboarding
    if (!authLoading && isAuthenticated && user?.workspaceId && step === 1 && !workspaceName && user?.onboardingData?.completed) {
      if (pendingPlanSelection) {
        navigate('/ecom/billing', { state: { selectedPlan: pendingPlanSelection }, replace: true });
        return;
      }
      const map = { super_admin: '/ecom/super-admin', ecom_admin: '/ecom/dashboard/admin', ecom_closeuse: '/ecom/dashboard/closeuse', ecom_compta: '/ecom/dashboard/compta', ecom_livreur: '/ecom/livreur' };
      navigate(map[user.role] || '/ecom/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate, step, workspaceName, pendingPlanSelection]);

  const goToNextStep = () => {
    if (pendingPlanSelection) {
      navigate('/ecom/billing', { state: { selectedPlan: pendingPlanSelection } });
      return;
    }

    const roleMap = {
      ecom_admin: '/ecom/dashboard/admin',
      ecom_closeuse: '/ecom/dashboard/closeuse',
      ecom_compta: '/ecom/dashboard/compta',
      ecom_livreur: '/ecom/livreur'
    };
    navigate(roleMap[selectedRole] || '/ecom/dashboard');
  };

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="p-8">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-6" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );

  const roles = [
    { value: 'ecom_admin', label: 'E-commerçant', desc: 'Accès complet à toutes les fonctionnalités' },
    { value: 'ecom_closeuse', label: 'Closeuse', desc: 'Commandes & ventes' },
    { value: 'ecom_compta', label: 'Comptable', desc: 'Finances & rapports' },
    { value: 'ecom_livreur', label: 'Livreur', desc: 'Livraisons' },
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (workspaceName.trim().length < 2) return;
    setLoading(true); setError('');
    try {
      await createWorkspace(workspaceName.trim(), selectedRole);
      // Au lieu de rediriger, on passe à l'étape 2 (Onboarding)
      setStep(2);
    } catch (err) { setError(err.message || 'Erreur création'); }
    finally { setLoading(false); }
  };

  const handleOnboarding = async (e) => {
    if (e) e.preventDefault();
    setLoading(true); setError('');
    try {
      if (phone || businessType || ordersPerMonth) {
        await saveOnboarding({ phone, businessType, ordersPerMonth });
      }
      goToNextStep();
    } catch (err) {
      setError(err.message || 'Erreur d\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const skipOnboarding = () => {
    goToNextStep();
  };

  
  const Spinner = () => (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/ecom')} className="inline-block">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4 shadow-sm">
            {step === 1 ? (
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {step === 1 ? 'Créez votre espace' : 'Parlez-nous de vous'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 1 ? 'Optionnel — vous pouvez le faire plus tard' : 'Pour personnaliser votre expérience'}
          </p>
        </div>

        <div className="bg-white/80 border border-gray-200 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-2 mb-4">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Nom de votre espace</label>
                <input type="text" required placeholder="Ex: Ma Boutique, Mon Business..." value={workspaceName} onChange={e => setWorkspaceName(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm transition shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Votre rôle dans cet espace</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs transition ${selectedRole === r.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                      <span className="font-bold block">{r.label}</span>
                      <span className="opacity-70 text-[10px]">{r.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {selectedRole === 'ecom_admin' 
                    ? 'En tant qu\'e-commerçant, vous aurez accès à toutes les fonctionnalités et pourrez gérer votre équipe.'
                    : 'Vous pourrez rejoindre une équipe existante pour accéder aux données partagées.'}
                </p>
              </div>
              <button type="submit" disabled={loading || workspaceName.trim().length < 2}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                {loading ? <Spinner /> : <><span>Créer mon espace</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOnboarding} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Numéro WhatsApp / Téléphone</label>
                <input type="tel" placeholder="+237 6XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm transition shadow-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Que vendez-vous ?</label>
                <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm transition shadow-sm">
                  <option value="">Sélectionnez une catégorie...</option>
                  <option value="vetements">Vêtements mode et Beauté</option>
                  <option value="electronique">Électronique et Gadgets</option>
                  <option value="sante_beaute">Santé et Beauté</option>
                  <option value="maison">Maison et Décoration</option>
                  <option value="digital">Produits digitaux ou Services</option>
                  <option value="autre">Autre chose</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Commandes générées par mois</label>
                <select value={ordersPerMonth} onChange={e => setOrdersPerMonth(e.target.value)}
                  className="block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm transition shadow-sm">
                  <option value="">Sélectionnez un volume...</option>
                  <option value="0-50">0 à 50 commandes</option>
                  <option value="50-500">50 à 500 commandes</option>
                  <option value="500+">Plus de 500 commandes</option>
                </select>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-600 hover:to-emerald-600 disabled:opacity-40 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                {loading ? <Spinner /> : <><span>Terminer l'inscription</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
              </button>
            </form>
          )}
        </div>

        <button onClick={step === 1 ? () => navigate('/ecom/landing') : skipOnboarding}
          className="mt-4 w-full py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          Passer cette étape
        </button>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs font-medium text-gray-400">
          <button onClick={logout} className="hover:text-gray-700 transition">Se déconnecter</button>
          <span>·</span>
          <button onClick={() => navigate('/ecom/privacy')} className="hover:text-gray-700 transition">Confidentialité</button>
          <span>·</span>
          <span>&copy; {new Date().getFullYear()} Scalor</span>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSetup;
