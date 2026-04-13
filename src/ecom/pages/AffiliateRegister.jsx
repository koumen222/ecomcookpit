import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { affiliatePortalApi, setAffiliateToken, getAffiliateToken } from '../services/affiliatePortalApi.js';

export default function AffiliateRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getAffiliateToken()) navigate('/affiliate/dashboard', { replace: true });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await affiliatePortalApi.register(form);
      const token = res.data?.data?.token;
      if (token) setAffiliateToken(token);
      navigate('/affiliate/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-10 w-72 h-72 bg-emerald-500/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-emerald-600/8 rounded-full blur-[100px]" />
        </div>
        <div className="relative">
          <Link to="/affiliate/login" className="group flex items-center gap-3">
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
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Inscription sécurisée
          </div>
          <span className="text-gray-300">•</span>
          <span className="text-xs text-gray-500">Gratuit, sans engagement</span>
        </div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex flex-col justify-center py-8 px-6 sm:px-10 lg:px-20">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link to="/affiliate/login" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="Scalor" className="h-9 object-contain" />
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Créer un compte affilié</h1>
            <p className="mt-1 text-gray-600 text-sm">Recevez votre lien, suivez vos ventes et vos gains.</p>
          </div>

          {/* Form card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-xl">
            <form className="space-y-5" onSubmit={submit}>
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Votre nom"
                    className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </span>
                  <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} type="email" required placeholder="votre@email.com" autoComplete="email"
                    className="block w-full pl-10 pr-3.5 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} type={showPassword ? 'text' : 'password'} required placeholder="••••••••" autoComplete="new-password"
                    className="block w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm transition" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <button disabled={loading} className="w-full py-3 rounded-xl bg-[#0F6B4F] hover:bg-[#0a5040] text-white font-semibold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {loading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Création...</>
                ) : 'Créer mon compte'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm text-gray-600">
                Déjà inscrit ?{' '}
                <Link to="/affiliate/login" className="text-[#0F6B4F] font-semibold hover:underline">Se connecter</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
