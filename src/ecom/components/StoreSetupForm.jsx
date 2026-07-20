import React, { useEffect, useMemo, useRef, useState } from 'react';
import { currencies } from '../utils/currency';

// ─────────────────────────────────────────────────────────────────────────────
// StoreSetupForm — formulaire de création de boutique du parcours
// « boutique d'abord ». Utilisé :
//   1. En étape 1 du funnel d'inscription (public, avant création du compte)
//   2. Sur la page de reprise /ecom/onboarding/boutique (authentifié)
// Le composant ne crée rien lui-même : il collecte les valeurs et délègue la
// vérification de sous-domaine (checkSubdomain) et la soumission (onSubmit).
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_STORE_SETUP = {
  storeName: '',
  subdomain: '',
  storeCurrency: 'XAF',
  storeWhatsApp: '',
  themeColor: '#0F6B4F',
};

export const slugifySubdomain = (name) => String(name || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 30);

const SUBDOMAIN_RE = /^[a-z0-9-]{3,30}$/;
const THEME_PRESETS = ['#0F6B4F', '#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#111827'];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const StoreSetupForm = ({
  value,
  onChange,
  logoFile,
  onLogoChange,
  checkSubdomain,
  onSubmit,
  submitLabel = 'Continuer',
  loading = false,
  error = '',
}) => {
  const form = { ...DEFAULT_STORE_SETUP, ...(value || {}) };
  const [subdomainTouched, setSubdomainTouched] = useState(() => !!form.subdomain && form.subdomain !== slugifySubdomain(form.storeName));
  const [subStatus, setSubStatus] = useState({ state: 'idle', reason: '' }); // idle | checking | available | taken | invalid
  const [logoError, setLogoError] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);
  const debounceRef = useRef(null);
  const lastCheckedRef = useRef('');

  const patch = (partial) => onChange({ ...form, ...partial });

  const handleNameChange = (name) => {
    const partial = { storeName: name };
    if (!subdomainTouched) partial.subdomain = slugifySubdomain(name);
    patch(partial);
  };

  const handleSubdomainChange = (raw) => {
    setSubdomainTouched(true);
    patch({ subdomain: String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) });
  };

  // Vérification de disponibilité (debounce 500 ms)
  useEffect(() => {
    const sub = form.subdomain;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!sub) { setSubStatus({ state: 'idle', reason: '' }); return undefined; }
    if (!SUBDOMAIN_RE.test(sub)) {
      setSubStatus({ state: 'invalid', reason: '3 à 30 caractères : lettres, chiffres, tirets' });
      return undefined;
    }
    setSubStatus({ state: 'checking', reason: '' });
    debounceRef.current = setTimeout(async () => {
      lastCheckedRef.current = sub;
      try {
        const res = await checkSubdomain(sub);
        if (lastCheckedRef.current !== sub) return; // réponse obsolète
        if (res?.available) setSubStatus({ state: 'available', reason: '' });
        else setSubStatus({ state: 'taken', reason: res?.reason || 'Ce sous-domaine est déjà pris' });
      } catch {
        if (lastCheckedRef.current !== sub) return;
        // Réseau indisponible : ne pas bloquer, le backend retranchera à la création.
        setSubStatus({ state: 'idle', reason: '' });
      }
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [form.subdomain]); // eslint-disable-line react-hooks/exhaustive-deps

  // Préview logo
  useEffect(() => {
    if (!logoFile) { setLogoPreview(null); return undefined; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const handleLogoInput = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoError('Choisissez une image (PNG, JPG, WebP…)'); return; }
    if (file.size > MAX_LOGO_SIZE) { setLogoError('Image trop lourde (5 Mo maximum)'); return; }
    setLogoError('');
    onLogoChange?.(file);
  };

  const currencyOptions = useMemo(() => Object.values(currencies), []);

  const canSubmit = form.storeName.trim().length >= 2
    && SUBDOMAIN_RE.test(form.subdomain)
    && subStatus.state !== 'taken'
    && subStatus.state !== 'invalid'
    && subStatus.state !== 'checking'
    && !loading;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-500 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Nom de la boutique</label>
        <input
          id="store-name-input"
          type="text" required placeholder="Ex : Belle Afrique Shop"
          value={form.storeName} onChange={e => handleNameChange(e.target.value)}
          className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Adresse de la boutique</label>
        <div className={`flex items-stretch rounded-xl border overflow-hidden transition focus-within:ring-2 focus-within:ring-primary-500 ${subStatus.state === 'taken' || subStatus.state === 'invalid' ? 'border-red-400' : 'border-gray-300'}`}>
          <input
            type="text" required placeholder="ma-boutique"
            value={form.subdomain} onChange={e => handleSubdomainChange(e.target.value)}
            className="flex-1 min-w-0 px-4 py-3 bg-white text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
          />
          <span className="flex items-center px-3 bg-gray-50 border-l border-gray-200 text-xs text-gray-500 font-medium select-none">.scalor.net</span>
        </div>
        <div className="mt-1.5 min-h-[18px] text-xs">
          {subStatus.state === 'checking' && <span className="text-gray-500 flex items-center gap-1.5"><Spinner /> Vérification…</span>}
          {subStatus.state === 'available' && (
            <span className="text-primary-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              {form.subdomain}.scalor.net est disponible
            </span>
          )}
          {(subStatus.state === 'taken' || subStatus.state === 'invalid') && <span className="text-red-500">{subStatus.reason}</span>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Devise de vente</label>
        <select
          value={form.storeCurrency} onChange={e => patch({ storeCurrency: e.target.value })}
          className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition"
        >
          {currencyOptions.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.symbol})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
          WhatsApp de la boutique <span className="text-gray-500 normal-case">(optionnel)</span>
        </label>
        <input
          type="tel" placeholder="+237 6XX XXX XXX"
          value={form.storeWhatsApp} onChange={e => patch({ storeWhatsApp: e.target.value })}
          className="block w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">
            Logo <span className="text-gray-500 normal-case">(optionnel)</span>
          </label>
          <label className="flex items-center gap-3 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 transition">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
            ) : (
              <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
            )}
            <span className="text-xs text-gray-600 leading-tight">{logoFile ? logoFile.name : 'Choisir une image'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoInput} />
          </label>
          {logoFile && (
            <button type="button" onClick={() => { onLogoChange?.(null); setLogoError(''); }} className="mt-1 text-xs text-gray-500 hover:text-red-500 transition">
              Retirer le logo
            </button>
          )}
          {logoError && <p className="mt-1 text-xs text-red-500">{logoError}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Couleur du thème</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {THEME_PRESETS.map(color => (
              <button
                key={color} type="button" onClick={() => patch({ themeColor: color })}
                className={`w-7 h-7 rounded-full border-2 transition ${form.themeColor?.toLowerCase() === color.toLowerCase() ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
                aria-label={`Couleur ${color}`}
              />
            ))}
            <label className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden relative" title="Couleur personnalisée">
              <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
              <input
                type="color" value={form.themeColor}
                onChange={e => patch({ themeColor: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit" disabled={!canSubmit}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20"
      >
        {loading ? <Spinner /> : (
          <>
            <span>{submitLabel}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </>
        )}
      </button>
    </form>
  );
};

export default StoreSetupForm;
