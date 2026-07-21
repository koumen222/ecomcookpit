import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { authApi, warmUpBackend } from '../services/ecommApi';
import { getContextualError } from '../utils/errorMessages';
import { getPendingPlanSelection } from '../utils/pendingPlanFlow.js';
import { loadGsi, renderGsiButton } from '../utils/googleGsi.js';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com';
const FORMATION_PATH = '/ecom/formation';

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const joinMode = new URLSearchParams(location.search).get('mode') === 'join';
  const affiliateCode = new URLSearchParams(location.search).get('aff') || '';
  const inviteToken = new URLSearchParams(location.search).get('invite') || '';
  const { register, googleLogin } = useEcomAuth();
  const pendingPlanSelection = getPendingPlanSelection();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', confirmPassword: '', acceptPrivacy: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formationOffer, setFormationOffer] = useState(null);
  const otpRefs = useRef([]);

  // ── Nettoyage au mount ─────────────────────────────────────────────────
  // Avant : si un vieux token (périmé/invalide) traînait dans localStorage,
  // useEcomAuth tentait getProfile() en arrière-plan, ça plantait avec
  // "Network Error" et l'erreur remontait dans le state global → la page
  // /register affichait "Impossible de contacter le serveur" sans aucune
  // action de l'utilisateur. Maintenant on purge à l'arrivée sur /register.
  useEffect(() => {
    setError('');
    // Réveille le backend dès l'arrivée (évite « Impossible de contacter le
    // serveur » au 1er envoi de code quand le backend est en cold start).
    warmUpBackend();
    try {
      if (localStorage.getItem('ecomToken')) {
        localStorage.removeItem('ecomToken');
        localStorage.removeItem('ecomUser');
        localStorage.removeItem('ecomWorkspace');
      }
    } catch { /* mode privé : localStorage indisponible */ }
  }, []);

  const pwChecks = [
    { label: 'Au moins 8 caractères', short: '8 caractères', ok: formData.password.length >= 8 },
    { label: 'Une majuscule', short: 'majuscule', ok: /[A-Z]/.test(formData.password) },
    { label: 'Une minuscule', short: 'minuscule', ok: /[a-z]/.test(formData.password) },
    { label: 'Un chiffre', short: 'chiffre', ok: /\d/.test(formData.password) },
  ];
  const pwMissing = pwChecks.filter(c => !c.ok);
  const pwStrength = pwMissing.length === 0 ? 4 : 0;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const getPostAuthDestination = useCallback((nextUser) => {
    if (inviteToken) {
      return { path: `/ecom/invite/${inviteToken}`, options: { replace: true } };
    }
    if (pendingPlanSelection) {
      if (nextUser?.workspaceId) {
        return { path: '/ecom/billing', options: { state: { selectedPlan: pendingPlanSelection }, replace: true } };
      }
      return { path: '/ecom/workspace-setup', options: { replace: true } };
    }
    // Boutique obligatoire : après l'inscription, un nouveau compte passe par
    // le WIZARD de création de boutique avant d'accéder au dashboard.
    if (nextUser?.needsStoreSetup && !nextUser?.storeId) {
      return { path: '/ecom/boutique/wizard', options: { replace: true } };
    }

    return { path: nextUser?.workspaceId ? '/ecom/dashboard' : '/ecom/workspace-setup', options: {} };
  }, [pendingPlanSelection, inviteToken]);

  const navigateAfterAuth = useCallback((nextUser) => {
    const destination = getPostAuthDestination(nextUser);
    navigate(destination.path, destination.options);
  }, [navigate, getPostAuthDestination]);

  const offerFormationAfterAuth = useCallback((nextUser) => {
    if (inviteToken || pendingPlanSelection) return false;
    const destination = getPostAuthDestination(nextUser);
    setFormationOffer({
      nextPath: destination.path,
      firstName: String(nextUser?.name || '').trim().split(/\s+/)[0] || '',
    });
    return true;
  }, [getPostAuthDestination, inviteToken, pendingPlanSelection]);

  const handleGoogleCallback = useCallback(async (response) => {
    console.log('🔑 [Google Auth] Callback reçu (Register):', {
      hasCredential: !!response?.credential,
      credentialLength: response?.credential?.length,
    });

    if (!response?.credential) {
      console.error('❌ [Google Auth] Pas de credential dans la réponse Google !');
      setError('Erreur Google : aucun token reçu.');
      return;
    }

    setLoading(true); setError('');
    try {
      const result = await googleLogin(response.credential, affiliateCode || undefined);
      console.log('✅ [Google Auth] Login réussi (Register):', { user: result.data?.user?.email });
      const u = result.data?.user;
      if (result.data?.isNewUser === true && offerFormationAfterAuth(u)) return;
      navigateAfterAuth(u);
    } catch (err) {
      console.error('❌ [Google Auth] Erreur:', err);
      setError(getContextualError(err, 'login'));
    } finally { setLoading(false); }
  }, [affiliateCode, googleLogin, navigateAfterAuth, offerFormationAfterAuth]);

  // Garde le callback à jour sans relancer l'effet de chargement GSI.
  const googleCallbackRef = useRef(handleGoogleCallback);
  useEffect(() => { googleCallbackRef.current = handleGoogleCallback; }, [handleGoogleCallback]);

  // Load Google Identity Services — singleton, safe against double-init
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const stableCallback = (response) => googleCallbackRef.current(response);
    loadGsi(GOOGLE_CLIENT_ID, stableCallback);
    const timer = setTimeout(() => renderGsiButton('google-reg-btn', { text: 'signup_with' }), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setLoading(true); setError('');
    try {
      await authApi.sendOtp({ email });
      setStep(2); setResendCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(getContextualError(err, 'register'));
    } finally { setLoading(false); }
  };

  const handleOtpChange = (idx, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[idx] = digit; setOtp(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) { setOtp(pasted.split('')); otpRefs.current[5]?.focus(); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true); setError('');
    try {
      await authApi.verifyOtp({ email, code });
      setStep(3);
      setTimeout(() => document.getElementById('name-input')?.focus(), 100);
    } catch (err) {
      setError(getContextualError(err, 'register') || 'Code incorrect. Vérifiez le code reçu par email.');
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true); setError('');
    try {
      await authApi.sendOtp({ email });
      setResendCooldown(60); setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(getContextualError(err, 'register'));
    } finally { setLoading(false); }
  };

  const canSubmit = formData.acceptPrivacy && pwStrength === 4 && formData.password === formData.confirmPassword && formData.name.trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      const result = await register({ email, password: formData.password, name: formData.name.trim(), phone: formData.phone.trim(), acceptPrivacy: true, affiliateCode: affiliateCode || undefined });
      const registeredUser = result?.data?.user || { workspaceId: result?.data?.workspace?._id || result?.data?.workspace?.id || null };
      const isFreshSignup = result?.data?.isNewUser === true || /compte créé/i.test(result?.message || '');
      if (isFreshSignup && offerFormationAfterAuth(registeredUser)) return;
      navigateAfterAuth(registeredUser);
    } catch (err) {
      setError(getContextualError(err, 'register'));
    } finally { setLoading(false); }
  };

  const stepLabels = ['Votre email', 'Verification', 'Votre profil'];

  if (formationOffer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[440px] relative">
          <div className="text-center mb-7">
            <button onClick={() => navigate('/ecom')} className="inline-block">
              <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
            <img
              src="/img/formation-offerte.png"
              alt="Formation offerte Scalor"
              className="w-full rounded-xl border border-gray-100 mb-5"
            />
            <div className="text-center mb-5">
              <p className="text-xs font-bold uppercase tracking-wide text-primary-600 mb-2">Compte créé avec succès</p>
              <h1 className="text-2xl font-black text-gray-900">
                {formationOffer.firstName ? `${formationOffer.firstName}, commencez ici` : 'Commencez ici'}
              </h1>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Avant de configurer votre espace, suivez la formation Scalor offerte pour lancer votre boutique plus vite.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(FORMATION_PATH, { state: { fromRegister: true, nextPath: formationOffer.nextPath } })}
                className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M14.752 11.168l-4.586-2.62A1 1 0 009 9.416v5.168a1 1 0 001.166.868l4.586-2.62a1 1 0 000-1.736z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Voir la formation offerte
              </button>
              <button
                type="button"
                onClick={() => navigate(formationOffer.nextPath)}
                className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                Continuer vers mon espace
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/ecom')} className="inline-block">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 transition-all ${s === step ? 'opacity-100' : s < step ? 'opacity-60' : 'opacity-25'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${s < step ? 'bg-primary-500 text-white' : s === step ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {s < step
                    ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : s}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-gray-900' : 'text-gray-500'}`}>{stepLabels[s - 1]}</span>
              </div>
              {s < 3 && <div className={`w-8 h-px transition-all ${s < step ? 'bg-primary-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-7 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2 mb-5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Créer un compte</h1>
                <p className="text-gray-600 text-sm mt-1">Entrez votre email pour commencer</p>
              </div>
              <div id="google-reg-btn" className="flex justify-center mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-500">ou par email</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                  <input type="email" autoComplete="email" required placeholder="vous@exemple.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                </div>
                <button type="submit" disabled={loading || !email.includes('@')}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20">
                  {loading ? <Spinner /> : <><span>Continuer</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>}
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-gray-900">Vérifiez votre email</h1>
                <p className="text-gray-600 text-sm mt-1">
                  Code envoye a <span className="text-primary-500 font-medium">{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Code à 6 chiffres</label>
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, idx) => (
                      <input key={idx} ref={el => { otpRefs.current[idx] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-primary-500 ${digit ? 'bg-primary-50 border-primary-500 text-gray-900' : 'bg-white border-gray-300 text-gray-900'}`} />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20">
                  {loading ? <Spinner /> : 'Verifier le code'}
                </button>
              </form>
              <div className="mt-4 flex items-center justify-between text-xs">
                <button onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError(''); }}
                  className="text-gray-500 hover:text-gray-300 transition flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                  Changer d email
                </button>
                <button onClick={handleResend} disabled={resendCooldown > 0 || loading}
                  className="text-primary-500 hover:text-primary-400 disabled:text-gray-600 disabled:cursor-not-allowed transition">
                  {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold text-gray-900">Finalisez votre compte</h1>
                <p className="text-gray-600 text-sm mt-1">Plus qu'un instant</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Nom complet</label>
                  <input id="name-input" type="text" required placeholder="Votre nom et prenom"
                    value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
                    Téléphone <span className="text-gray-500 normal-case">(optionnel)</span>
                  </label>
                  <input type="tel" placeholder="+237 6XX XXX XXX"
                    value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Mot de passe</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Creez un mot de passe fort"
                      value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      className="block w-full px-4 py-3 pr-11 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[11px] font-medium text-gray-500 mb-1.5">Votre mot de passe doit contenir :</p>
                    <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {pwChecks.map((c) => {
                        const neutral = !formData.password;
                        return (
                          <li key={c.label} className={`flex items-center gap-1.5 text-xs transition ${neutral ? 'text-gray-400' : c.ok ? 'text-primary-600' : 'text-red-500'}`}>
                            {neutral ? (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /></svg>
                            ) : c.ok ? (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                            <span>{c.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {formData.password && pwMissing.length > 0 && (
                      <p className="mt-2 text-xs text-red-500">
                        Il manque : {pwMissing.map(c => c.short).join(', ')}.
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Confirmer</label>
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Retapez le mot de passe"
                    value={formData.confirmPassword} onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                    className={`block w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : 'border-gray-300'}`} />
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-primary-400 text-xs mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Identiques
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.acceptPrivacy} onChange={e => setFormData(p => ({ ...p, acceptPrivacy: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 bg-white text-primary-600 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer" />
                  <p className="text-xs text-gray-600 leading-relaxed">
                    J'accepte la{' '}
                    <button type="button" onClick={() => window.open('/ecom/privacy', '_blank')} className="text-primary-500 hover:text-primary-400 underline underline-offset-2 transition">
                      politique de confidentialite
                    </button>
                  </p>
                </label>
                <button type="submit" disabled={loading || !canSubmit}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-600 hover:to-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20">
                  {loading ? <Spinner /> : <><span>Creer mon compte</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center mt-5 text-sm text-gray-600">
          Deja un compte ?{' '}
          <button onClick={() => navigate('/ecom/login')} className="text-primary-500 hover:text-primary-400 font-medium transition">
            Se connecter
          </button>
        </p>
        <p className="text-center mt-3 text-xs text-gray-500">
          &copy; {new Date().getFullYear()} Scalor
        </p>
      </div>
    </div>
  );
};

export default Register;
