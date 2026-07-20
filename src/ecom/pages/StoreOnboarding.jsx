import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { authApi } from '../services/ecommApi';
import StoreSetupForm, { DEFAULT_STORE_SETUP } from '../components/StoreSetupForm.jsx';
import { createStoreFromSetup, readPendingStoreSetup, savePendingStoreSetup, needsStoreOnboarding } from '../utils/storeOnboarding.js';

// ─────────────────────────────────────────────────────────────────────────────
// /ecom/onboarding/boutique — étape boutique obligatoire pour les NOUVEAUX
// comptes qui ont une session mais pas encore de boutique :
//   • inscription Google faite depuis la page de connexion (hors funnel)
//   • funnel d'inscription abandonné entre le compte et la boutique
// Tant que la boutique n'existe pas, les guards (front) et le middleware
// backend (403 STORE_ONBOARDING_REQUIRED) bloquent l'accès au reste.
// ─────────────────────────────────────────────────────────────────────────────

const StoreOnboarding = () => {
  const navigate = useNavigate();
  const { user, logout } = useEcomAuth();

  const localUser = user || (() => { try { return JSON.parse(localStorage.getItem('ecomUser') || 'null'); } catch { return null; } })();

  const [storeSetup, setStoreSetup] = useState(() => {
    const saved = readPendingStoreSetup();
    return saved ? { ...DEFAULT_STORE_SETUP, ...saved } : { ...DEFAULT_STORE_SETUP };
  });
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    savePendingStoreSetup(storeSetup);
  }, [storeSetup]);

  // Confirmer l'état réel côté serveur : si la boutique existe déjà (créée via
  // un autre onglet, une invitation acceptée, etc.), sortir de l'onboarding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getProfile();
        const freshUser = res.data?.data?.user;
        if (cancelled) return;
        if (freshUser) {
          try { localStorage.setItem('ecomUser', JSON.stringify(freshUser)); } catch { /* noop */ }
          if (!needsStoreOnboarding(freshUser)) {
            navigate('/ecom/dashboard', { replace: true });
            return;
          }
        }
      } catch { /* profil injoignable : on laisse l'utilisateur créer sa boutique */ }
      if (!cancelled) setCheckingProfile(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await createStoreFromSetup(storeSetup, logoFile);
      navigate('/ecom/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'La boutique n\'a pas pu être créée. Vérifiez le sous-domaine puis réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/ecom/login', { replace: true });
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-200 rounded-full animate-spin" style={{ borderTopColor: '#0F6B4F' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Scalor" className="h-8 object-contain inline-block" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xl">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Créez votre boutique</h1>
            <p className="text-gray-600 text-sm mt-1">
              {localUser?.name ? `${String(localUser.name).trim().split(/\s+/)[0]}, il` : 'Il'} ne manque que votre boutique pour accéder à votre espace.
            </p>
          </div>

          <StoreSetupForm
            value={storeSetup}
            onChange={setStoreSetup}
            logoFile={logoFile}
            onLogoChange={setLogoFile}
            checkSubdomain={(sub) => authApi.checkSubdomainPublic(sub).then(r => r.data)}
            onSubmit={handleSubmit}
            submitLabel="Créer ma boutique"
            loading={loading}
            error={error}
          />
        </div>

        <p className="text-center mt-5 text-xs text-gray-500">
          Connecté en tant que <span className="font-medium text-gray-700">{localUser?.email || '—'}</span>
          {' · '}
          <button onClick={handleLogout} className="text-primary-500 hover:text-primary-400 font-medium transition">
            Se déconnecter
          </button>
        </p>
      </div>
    </div>
  );
};

export default StoreOnboarding;
