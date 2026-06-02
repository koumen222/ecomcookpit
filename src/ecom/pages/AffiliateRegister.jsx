import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { affiliatePortalApi, setAffiliateToken, getAffiliateToken } from '../services/affiliatePortalApi.js';

export default function AffiliateRegister() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('scalor'); // 'scalor' | 'new'
  const [scalorForm, setScalorForm] = useState({ email: '', password: '' });
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAffiliateToken()) navigate('/affiliate/dashboard', { replace: true });
  }, []);

  const submitScalor = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await affiliatePortalApi.loginWithScalor(scalorForm);
      const affToken = res.data?.data?.token;
      if (affToken) setAffiliateToken(affToken);
      navigate('/affiliate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de rejoindre le programme');
    } finally {
      setLoading(false);
    }
  };

  const submitNew = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await affiliatePortalApi.register(form);
      const affToken = res.data?.data?.token;
      if (affToken) setAffiliateToken(affToken);
      navigate('/affiliate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Inscription impossible');
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
            Devenez partenaire<br />
            <span className="text-[#0F6B4F]">de l'E-commerce Africain.</span>
          </h2>
          <p className="text-gray-600 text-base leading-relaxed max-w-sm mb-8">
            Créez votre compte, recevez votre lien personnalisé et commencez à gagner des commissions sur chaque vente.
          </p>
          <div className="flex items-center gap-6">
            {[
              { number: '1', label: 'Créez votre compte' },
              { number: '2', label: 'Partagez votre lien' },
              { number: '3', label: 'Recevez vos gains' },
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
            Inscription gratuite
          </div>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-500">Sans engagement</span>
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
            <h1 className="text-2xl font-bold text-gray-900">Rejoindre le programme affilié</h1>
            <p className="mt-1 text-gray-600 text-sm">Recevez votre lien, suivez vos ventes et vos gains.</p>
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
                Avec Scalor
              </button>
              <button
                type="button"
                onClick={() => { setMode('new'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Nouveau compte
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            {/* Scalor login form */}
            {mode === 'scalor' && (
              <>
                <p className="text-xs text-gray-500 mb-4 bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
                  Connectez-vous avec votre compte Scalor existant. Votre compte affilié sera créé automatiquement avec un lien de parrainage unique.
                </p>
                <form className="space-y-4" onSubmit={submitScalor}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Scalor</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      </span>
                      <input value={scalorForm.email} onChange={(e) => setScalorForm(f => ({ ...f, email: e.target.value }))} type="email" required placeholder="votre@email.com" autoComplete="email"
                        className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe Scalor</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input value={scalorForm.password} onChange={(e) => setScalorForm(f => ({ ...f, password: e.target.value }))} type={showPassword ? 'text' : 'password'} required placeholder="••••••••" autoComplete="current-password"
                        className="block w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                      </button>
                    </div>
                  </div>
                  <button disabled={loading} className="w-full py-3 rounded-xl bg-[#0F6B4F] hover:bg-[#0a5040] text-white font-semibold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20">
                    {loading ? (
                      <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Connexion...</>
                    ) : (
                      <><img src="/logo.png" alt="" className="w-4 h-4 object-contain brightness-0 invert" /> Rejoindre avec mon compte Scalor</>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* New account form */}
            {mode === 'new' && (
              <form className="space-y-4" onSubmit={submitNew}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </span>
                    <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Votre nom"
                      className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </span>
                    <input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} type="email" required placeholder="votre@email.com" autoComplete="email"
                      className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro Mobile Money</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </span>
                    <input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} type="tel" required placeholder="6XXXXXXXX"
                      className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </span>
                    <input value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} type={showPassword ? 'text' : 'password'} required placeholder="••••••••" autoComplete="new-password"
                      className="block w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                    </button>
                  </div>
                </div>
                <button disabled={loading} className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {loading ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Création...</>
                  ) : 'Créer mon compte affilié'}
                </button>
              </form>
            )}

            {/* Security */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-500">
              <svg className="w-3 h-3 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Inscription gratuite • Sans engagement • Paiements Mobile Money
            </div>
          </div>

          {/* Login link */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">Déjà affilié ?</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <Link
            to="/affiliate/login"
            className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-xl text-sm font-medium text-gray-700 transition text-center flex items-center justify-center gap-2"
          >
            Se connecter
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
