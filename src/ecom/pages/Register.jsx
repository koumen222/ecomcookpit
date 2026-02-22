import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { authApi } from '../services/ecommApi';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '559924689181-rpkv8ji3029kvrtsvt3qceusmsh1i4p2.apps.googleusercontent.com';

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
  const { register, googleLogin } = useEcomAuth();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', confirmPassword: '', acceptPrivacy: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);

  const pwChecks = [
    { label: '8+ caracteres', ok: formData.password.length >= 8 },
    { label: 'Majuscule', ok: /[A-Z]/.test(formData.password) },
    { label: 'Minuscule', ok: /[a-z]/.test(formData.password) },
    { label: 'Chiffre', ok: /[0-9]/.test(formData.password) },
    { label: 'Symbole', ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password) },
  ];
  const pwStrength = pwChecks.filter(c => c.ok).length;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleGoogleCallback = useCallback(async (response) => {
    console.log('\ud83d\udd11 [Google Auth] Callback reçu (Register):', {
      hasCredential: !!response?.credential,
      credentialLength: response?.credential?.length,
    });

    if (!response?.credential) {
      console.error('\u274c [Google Auth] Pas de credential dans la réponse Google !');
      setError('Erreur Google : aucun token reçu.');
      return;
    }

    setLoading(true); setError('');
    try {
      const result = await googleLogin(response.credential);
      console.log('\u2705 [Google Auth] Login réussi (Register):', { user: result.data?.user?.email });
      const u = result.data?.user;
      navigate(u?.workspaceId ? '/ecom/dashboard' : '/ecom/workspace-setup');
    } catch (err) {
      console.error('\u274c [Google Auth] Erreur:', err);
      setError(err.message || 'Erreur Google');
    } finally { setLoading(false); }
  }, [googleLogin, navigate]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCallback });
        window.google.accounts.id.renderButton(
          document.getElementById('google-reg-btn'),
          { theme: 'filled_black', size: 'large', width: 360, text: 'signup_with', shape: 'pill', locale: 'fr' }
        );
      }
    };
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch (e) { } };
  }, [handleGoogleCallback]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    setLoading(true); setError('');
    try {
      await authApi.sendOtp({ email });
      setStep(2); setResendCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur envoi du code');
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
      setError(err.response?.data?.message || err.message || 'Code incorrect');
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
      setError(err.response?.data?.message || 'Erreur renvoi du code');
    } finally { setLoading(false); }
  };

  const canSubmit = formData.acceptPrivacy && pwStrength === 5 && formData.password === formData.confirmPassword && formData.name.trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      await register({ email, password: formData.password, name: formData.name.trim(), phone: formData.phone.trim(), acceptPrivacy: true });
      navigate('/ecom/dashboard');
    } catch (err) {
      setError(err.message || 'Erreur lors de la creation du compte');
    } finally { setLoading(false); }
  };

  const stepLabels = ['Votre email', 'Verification', 'Votre profil'];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/ecom')} className="inline-block">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-10 object-contain mx-auto" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 transition-all ${s === step ? 'opacity-100' : s < step ? 'opacity-60' : 'opacity-25'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${s < step ? 'bg-emerald-500 text-white' : s === step ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {s < step
                    ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : s}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${s === step ? 'text-white' : 'text-gray-500'}`}>{stepLabels[s - 1]}</span>
              </div>
              {s < 3 && <div className={`w-8 h-px transition-all ${s < step ? 'bg-emerald-500' : 'bg-gray-800'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-gray-900/70 border border-white/[0.08] rounded-2xl p-7 backdrop-blur-xl shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2 mb-5">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white">Creer un compte</h1>
                <p className="text-gray-400 text-sm mt-1">Entrez votre email pour commencer</p>
              </div>
              <div id="google-reg-btn" className="flex justify-center mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500">ou par email</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Adresse email</label>
                  <input type="email" autoComplete="email" required placeholder="vous@exemple.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="block w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                </div>
                <button type="submit" disabled={loading || !email.includes('@')}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                  {loading ? <Spinner /> : <><span>Continuer</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>}
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-white">Verifiez votre email</h1>
                <p className="text-gray-400 text-sm mt-1">
                  Code envoye a <span className="text-blue-400 font-medium">{email}</span>
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3 text-center">Code a 6 chiffres</label>
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, idx) => (
                      <input key={idx} ref={el => { otpRefs.current[idx] = el; }}
                        type="text" inputMode="numeric" maxLength={1} value={digit}
                        onChange={e => handleOtpChange(idx, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(idx, e)}
                        className={`w-11 h-14 text-center text-xl font-bold rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${digit ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-white'}`} />
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={loading || otp.join('').length !== 6}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
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
                  className="text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed transition">
                  {resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-5">
                <h1 className="text-xl font-bold text-white">Finalisez votre compte</h1>
                <p className="text-gray-400 text-sm mt-1">Plus qu un instant</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Nom complet</label>
                  <input id="name-input" type="text" required placeholder="Votre nom et prenom"
                    value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    Telephone <span className="text-gray-600 normal-case">(optionnel)</span>
                  </label>
                  <input type="tel" placeholder="+237 6XX XXX XXX"
                    value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    className="block w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Mot de passe</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} required placeholder="Creez un mot de passe fort"
                      value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      className="block w-full px-4 py-3 pr-11 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {showPassword
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
                      </svg>
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition ${i <= pwStrength ? (pwStrength <= 2 ? 'bg-red-500' : pwStrength <= 3 ? 'bg-yellow-500' : 'bg-emerald-500') : 'bg-gray-800'}`} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Confirmer</label>
                  <input type="password" required placeholder="Retapez le mot de passe"
                    value={formData.confirmPassword} onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                    className={`block w-full px-4 py-3 bg-gray-800/80 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500/60' : 'border-gray-700'}`} />
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Identiques
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={formData.acceptPrivacy} onChange={e => setFormData(p => ({ ...p, acceptPrivacy: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer" />
                  <p className="text-xs text-gray-400 leading-relaxed">
                    J accepte la{' '}
                    <button type="button" onClick={() => window.open('/ecom/privacy', '_blank')} className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition">
                      politique de confidentialite
                    </button>
                  </p>
                </label>
                <button type="submit" disabled={loading || !canSubmit}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                  {loading ? <Spinner /> : <><span>Creer mon compte</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></>}
                </button>
              </form>
            </div>
          )}
        </div>

        <p className="text-center mt-5 text-sm text-gray-500">
          Deja un compte ?{' '}
          <button onClick={() => navigate('/ecom/login')} className="text-blue-400 hover:text-blue-300 font-medium transition">
            Se connecter
          </button>
        </p>
        <p className="text-center mt-3 text-xs text-gray-700">
          &copy; {new Date().getFullYear()} Ecom Cockpit
        </p>
      </div>
    </div>
  );
};

export default Register;