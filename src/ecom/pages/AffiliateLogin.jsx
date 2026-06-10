import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { affiliatePortalApi, setAffiliateToken, getAffiliateToken } from '../services/affiliatePortalApi.js';
import { loadGsi, renderGsiButton } from '../utils/googleGsi.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com';

export default function AffiliateLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('scalor'); // 'scalor' | 'affiliate'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAffiliateToken()) navigate('/affiliate/dashboard', { replace: true });
  }, []);

  // Google Sign-In
  const handleGoogleCallback = useCallback(async (response) => {
    if (!response?.credential) {
      setError('Erreur Google : aucun token reçu');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await affiliatePortalApi.googleLogin(response.credential);
      const affToken = res.data?.data?.token;
      if (affToken) setAffiliateToken(affToken);
      navigate('/affiliate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur Google');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const googleCallbackRef = useRef(handleGoogleCallback);
  useEffect(() => { googleCallbackRef.current = handleGoogleCallback; }, [handleGoogleCallback]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const stableCallback = (response) => googleCallbackRef.current(response);
    loadGsi(GOOGLE_CLIENT_ID, stableCallback);
    const timer = setTimeout(() => renderGsiButton('affiliate-google-btn', { theme: 'outline', text: 'signin_with' }), 400);
    return () => clearTimeout(timer);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let res;
      if (mode === 'scalor') {
        res = await affiliatePortalApi.loginWithScalor({ email, password });
      } else {
        res = await affiliatePortalApi.login({ email, password });
      }
      const affToken = res.data?.data?.token;
      if (affToken) setAffiliateToken(affToken);
      navigate('/affiliate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-10 w-72 h-72 bg-primary-500/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-primary-600/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative">
          <Link to="/ecom" className="group flex items-center gap-3">
            <img src="/logo.png" alt="Scalor" className="h-10 object-contain" />
            <div>
              <span className="text-[9px] font-medium text-gray-500 uppercase tracking-[0.2em]">Programme d'affiliation</span>
            </div>
          </Link>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-black text-gray-900 leading-tight mb-4">
            Gagnez des commissions<br />
            <span className="text-[#0F6B4F]">sur chaque vente.</span>
          </h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm mb-8">
            Partagez votre lien unique, suivez vos conversions en temps réel et recevez vos commissions via Mobile Money.
          </p>
          <div className="flex items-center gap-6">
            {[
              { number: '300F', label: 'Par inscription' },
              { number: '30%', label: 'Commission récurrente' },
              { number: '∞', label: 'Pas de limite' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-xl font-bold text-[#0F6B4F]">{stat.number}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-primary-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Connexion sécurisée
          </div>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-500">Paiements Mobile Money</span>
        </div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex flex-col justify-center py-8 px-6 sm:px-10 lg:px-20">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/ecom" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="Scalor" className="h-9 object-contain" />
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Portail Affilié</h1>
            <p className="mt-1 text-gray-600 text-sm">Connectez-vous pour gérer vos liens et commissions.</p>
          </div>

          {/* Form card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xl">
            {/* Mode toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
              <button
                type="button"
                onClick={() => { setMode('scalor'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'scalor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <img src="/logo.png" alt="" className="w-4 h-4 object-contain" />
                Compte Scalor
              </button>
              <button
                type="button"
                onClick={() => { setMode('affiliate'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'affiliate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Compte affilié
              </button>
            </div>

            {mode === 'scalor' && (
              <p className="text-xs text-gray-500 mb-4 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
                Utilisez vos identifiants Scalor pour accéder au programme d'affiliation. Si c'est votre première fois, un compte affilié sera créé automatiquement.
              </p>
            )}

            <form className="space-y-5" onSubmit={submit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="votre@email.com" autoComplete="email"
                    className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required placeholder="••••••••" autoComplete="current-password"
                    className="block w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <button disabled={loading} className={`w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
                mode === 'scalor'
                  ? 'bg-[#0F6B4F] hover:bg-[#0a5040] text-white shadow-primary-600/20'
                  : 'bg-gray-900 hover:bg-gray-800 text-white shadow-gray-900/20'
              }`}>
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Connexion...</>
                ) : mode === 'scalor' ? (
                  <><img src="/logo.png" alt="" className="w-4 h-4 object-contain brightness-0 invert" /> Se connecter avec Scalor</>
                ) : (
                  <><span>Se connecter</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
                )}
              </button>
            </form>

            {/* Google Sign-In */}
            {GOOGLE_CLIENT_ID && (
              <div className="mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-xs text-gray-500">ou</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>
                <div id="affiliate-google-btn" className="w-full"></div>
              </div>
            )}

            {/* Security badge */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-500">
              <svg className="w-3 h-3 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Connexion sécurisée • Chiffrement de bout en bout
            </div>
          </div>

          {/* Register link */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">Pas encore affilié ?</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <Link
            to="/affiliate/register"
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium text-gray-700 transition text-center flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Créer un compte affilié
          </Link>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-500">
            <span>&copy; {new Date().getFullYear()} Scalor</span>
            <span>•</span>
            <Link to="/ecom/privacy" className="text-gray-500 hover:text-gray-700 transition">Confidentialité</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
