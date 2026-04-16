import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useStore } from '../contexts/StoreContext.jsx';
import api from '../../lib/api';

// DNS target constants (mirrors backend env)
// VPS_IP = Caddy reverse proxy VPS that auto-provisions SSL
const VPS_IP = import.meta.env.VITE_CUSTOM_DOMAIN_IP || '45.76.27.120';
const CNAME_TARGET = 'shops.scalor.net';
const A_RECORDS = [VPS_IP];

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      className="ml-1 px-2 py-0.5 text-[10px] font-bold bg-gray-200 hover:bg-gray-300 text-gray-600 rounded transition"
    >
      {copied ? '✓' : 'Copier'}
    </button>
  );
}

function DnsRow({ type, name, value }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono bg-white border border-gray-200 rounded-lg px-3 py-2">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold w-14 text-center ${
        type === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
      }`}>{type}</span>
      <span className="text-gray-500 w-8 text-center">{name}</span>
      <span className="text-gray-400">→</span>
      <span className="text-gray-900 font-bold flex-1">{value}</span>
      <CopyButton value={value} />
    </div>
  );
}

const STEPS = ['Entrer votre domaine', 'Configurer le DNS', 'Vérifier et connecter'];

const BoutiqueDomains = () => {
  const { workspace } = useEcomAuth();
  const { refreshStores, activeStore } = useStore();
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [sslStatus, setSslStatus] = useState('none');
  const [dnsVerified, setDnsVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const subdomainGeneratedRef = useRef(false);
  const preferredStoreName = activeStore?.storeSettings?.storeName || activeStore?.name || workspace?.storeSettings?.storeName || workspace?.name || '';

  useEffect(() => {
    if (!activeStore?.subdomain) return;
    setSubdomain((current) => current || activeStore.subdomain);
    subdomainGeneratedRef.current = true;
  }, [activeStore?.subdomain]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/store/domains');
        if (res.data?.data) {
          setSubdomain(res.data.data.subdomain || activeStore?.subdomain || '');
          const cd = res.data.data.customDomain || '';
          setCustomDomain(cd);
          setDomainInput(cd);
          setSslStatus(res.data.data.sslStatus || 'none');
          setDnsVerified(res.data.data.dnsVerified || false);
          // Si domaine déjà connecté, sauter à l'étape 2
          if (cd) setActiveStep(cd && res.data.data.dnsVerified ? 2 : 1);
        }
      } catch { /* defaults */ }
    };
    load();
  }, [activeStore?.subdomain]);

  useEffect(() => {
    const autoGenerateSubdomain = async () => {
      if (subdomain || !workspace || subdomainGeneratedRef.current) return;
      const storeName = preferredStoreName;
      if (!storeName || storeName.trim().length < 3) return;
      try {
        subdomainGeneratedRef.current = true;
        const res = await api.post('/store-manage/generate-subdomain', { storeName: storeName.trim() });
        if (res.data?.success) setSubdomain(res.data.data.subdomain);
      } catch { /* silent */ }
    };
    autoGenerateSubdomain();
  }, [preferredStoreName, subdomain, workspace]);

  const generateSubdomainFromStoreName = async () => {
    const storeName = preferredStoreName;
    if (!storeName || storeName.trim().length === 0) {
      alert('Veuillez d\'abord configurer le nom de votre boutique');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/store-manage/generate-subdomain', { storeName: storeName.trim() });
      if (res.data?.success) {
        const generatedSubdomain = res.data.data.subdomain;
        setSubdomain(generatedSubdomain);
        setSaved(false);
        if (confirm(`✅ Domaine généré: ${res.data.data.fullDomain}\n\nVoulez-vous l'utiliser maintenant?`)) {
          handleSave(generatedSubdomain);
        }
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la génération du domaine');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (nextSubdomain = subdomain) => {
    setSaving(true);
    try {
      const normalizedSubdomain = String(nextSubdomain || '').trim().toLowerCase();
      const res = await api.put('/store/domains', { subdomain: normalizedSubdomain, customDomain: customDomain.trim() });
      const savedSubdomain = res.data?.data?.subdomain;
      if (typeof savedSubdomain === 'string') setSubdomain(savedSubdomain);
      await refreshStores();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const checkDns = async () => {
    const domain = customDomain || domainInput;
    if (!domain) return;
    setChecking(true);
    setDnsResult(null);
    try {
      const res = await api.post('/store/domains/check-dns', { domain });
      const data = res.data?.data || { ok: false };
      setDnsResult(data);
      if (data.ok) {
        setDnsVerified(true);
        setSslStatus('active');
        setActiveStep(2);
      }
    } catch {
              handleSave(res.data.data.subdomain);
    } finally {
      setChecking(false);
    }
  };

  const validateAndNextStep = () => {
    const val = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!val || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/.test(val)) {
      setDomainError('Entrez un nom de domaine valide (ex: maboutique.com)');
      return;
    }
    setDomainError('');
    setCustomDomain(val);
    setDomainInput(val);
    setDnsResult(null);
    setActiveStep(1);
  };

  const disconnectDomain = async () => {
    if (!confirm('Déconnecter ce domaine personnalisé ?')) return;
    setSaving(true);
    try {
      const res = await api.put('/store/domains', { subdomain: subdomain.trim().toLowerCase(), customDomain: '' });
      const savedSubdomain = res.data?.data?.subdomain;
      if (typeof savedSubdomain === 'string') setSubdomain(savedSubdomain);
      await refreshStores();
      setCustomDomain('');
      setDomainInput('');
      setDnsVerified(false);
      setSslStatus('none');
      setDnsResult(null);
      setActiveStep(0);
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const saveDomainAndNext = async () => {
    setSaving(true);
    try {
      const res = await api.put('/store/domains', { subdomain: subdomain.trim().toLowerCase(), customDomain: customDomain.trim() });
      const savedSubdomain = res.data?.data?.subdomain;
      if (typeof savedSubdomain === 'string') setSubdomain(savedSubdomain);
      await refreshStores();
    } catch { /* handled */ } finally {
      setSaving(false);
    }
  };

  const subdomainUrl = subdomain ? `${subdomain}.scalor.net` : '';
  const isConnected = dnsVerified && customDomain;

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Domaines</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configurez l'adresse de votre boutique</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-md ${
            saved ? 'bg-green-500' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
          } disabled:opacity-60`}
        >
          {saving ? 'Enregistrement...' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* ── Sous-domaine gratuit ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#E6F2ED] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Sous-domaine gratuit</h2>
            <p className="text-xs text-gray-500">Votre boutique est accessible immédiatement</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={subdomain}
              onChange={(e) => { setSubdomain(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase()); setSaved(false); }}
              placeholder="boutique"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent transition bg-gray-50 focus:bg-white font-mono"
            />
            <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">.scalor.net</span>
          </div>

          <button
            onClick={generateSubdomainFromStoreName}
            disabled={generating}
            className="w-full px-4 py-2 text-xs font-bold text-[#0A5740] bg-[#E6F2ED] rounded-xl hover:bg-[#C0DDD2] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {generating ? (
              <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>Génération...</>
            ) : (
              <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Générer depuis le nom de la boutique</>
            )}
          </button>

          {preferredStoreName && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Basé sur : <span className="font-medium text-gray-700">"{preferredStoreName}"</span>
            </div>
          )}
        </div>

        {subdomainUrl ? (
          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <a href={`https://${subdomainUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green-700 hover:underline">
              https://{subdomainUrl}
            </a>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-sm text-gray-500">Votre boutique : <span className="font-mono text-gray-700">{subdomain || 'votre-boutique'}.scalor.net</span></span>
          </div>
        )}
      </div>

      {/* ── Domaine personnalisé : flow en étapes ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header section */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-xl">🌐</div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Domaine personnalisé</h2>
              <p className="text-xs text-gray-500">Connectez votre propre nom de domaine à Scalor</p>
            </div>
          </div>
          {isConnected && (
            <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Connecté
            </span>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center px-5 py-3 bg-gray-50 border-b border-gray-100 gap-0">
          {STEPS.map((label, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => i < activeStep ? setActiveStep(i) : undefined}
                className={`flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap ${
                  i === activeStep ? 'text-[#0F6B4F]' : i < activeStep ? 'text-gray-500 hover:text-gray-700 cursor-pointer' : 'text-gray-300 cursor-default'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  i < activeStep ? 'bg-[#0F6B4F] text-white' : i === activeStep ? 'bg-[#0F6B4F] text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < activeStep ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < activeStep ? 'bg-[#0F6B4F]' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="p-5 space-y-4">

          {/* STEP 0 — Entrer le domaine */}
          {activeStep === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Entrez le nom de domaine que vous souhaitez connecter à votre boutique Scalor.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => { setDomainInput(e.target.value); setDomainError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && validateAndNextStep()}
                  placeholder="maboutique.com"
                  className={`flex-1 px-3 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent transition bg-gray-50 focus:bg-white font-mono ${
                    domainError ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
                <button
                  onClick={validateAndNextStep}
                  className="px-4 py-2.5 bg-[#0F6B4F] hover:bg-[#0A5740] text-white text-sm font-bold rounded-xl transition"
                >
                  Suivant →
                </button>
              </div>
              {domainError && <p className="text-xs text-red-600">{domainError}</p>}
              <p className="text-[11px] text-gray-400">
                Sans www. — exemple : <span className="font-mono">maboutique.com</span> ou <span className="font-mono">shop.monsite.fr</span>
              </p>
            </div>
          )}

          {/* STEP 1 — Configurer le DNS */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Ajoutez ces enregistrements DNS chez votre registrar pour{' '}
                  <span className="font-mono font-semibold text-gray-900">{customDomain}</span> :
                </p>
                <button onClick={() => setActiveStep(0)} className="text-xs text-gray-400 hover:text-gray-600 underline">Changer</button>
              </div>

              {/* Option 1 : A record */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">RECOMMANDÉ</span>
                  Enregistrement A — fonctionne partout, SSL automatique
                </p>
                <div className="space-y-1.5">
                  <DnsRow type="A" name="@" value={VPS_IP} />
                  <DnsRow type="CNAME" name="www" value={customDomain || 'votredomaine.com'} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] font-semibold text-gray-400">OU</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Option 2 : CNAME */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">ALTERNATIVE</span>
                  CNAME — Cloudflare ou registrar avec CNAME flattening
                </p>
                <div className="space-y-1.5">
                  <DnsRow type="CNAME" name="@" value={CNAME_TARGET} />
                  <DnsRow type="CNAME" name="www" value={CNAME_TARGET} />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-700 space-y-1">
                <p className="font-semibold">Comment configurer chez mon registrar ?</p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                  <li><span className="font-semibold">Namecheap :</span> Domain List → Manage → Advanced DNS</li>
                  <li><span className="font-semibold">GoDaddy :</span> My Products → DNS → Add record</li>
                  <li><span className="font-semibold">OVH :</span> Domaines → Zone DNS → Ajouter une entrée</li>
                  <li><span className="font-semibold">Cloudflare :</span> DNS → Records → Add record (proxy OFF)</li>
                </ul>
                <p className="text-amber-500 mt-1">La propagation DNS peut prendre jusqu'à 48h.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={async () => { await saveDomainAndNext(); setActiveStep(2); }}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#0F6B4F] hover:bg-[#0A5740] text-white text-sm font-bold rounded-xl transition disabled:opacity-60"
                >
                  {saving ? 'Enregistrement...' : 'J\'ai configuré le DNS →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Vérifier et connecter */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 font-mono">{customDomain}</span>
                  {isConnected && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">DNS OK</span>
                  )}
                </div>
                <button onClick={() => setActiveStep(1)} className="text-xs text-gray-400 hover:text-gray-600 underline">Modifier les DNS</button>
              </div>

              {/* DNS check result */}
              {dnsResult !== null && (
                <div className={`px-4 py-3 rounded-xl space-y-2 ${dnsResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {dnsResult.ok ? (
                      <><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className="text-sm text-green-700 font-semibold">DNS configuré correctement — <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer" className="hover:underline">https://{customDomain}</a></span></>
                    ) : (
                      <><svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      <span className="text-sm text-red-700 font-semibold">DNS pas encore propagés</span></>
                    )}
                  </div>
                  {dnsResult.aRecords?.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">A records :</span> {dnsResult.aRecords.join(', ')}
                      {dnsResult.aOk ? <span className="text-green-600 ml-1">✓</span> : <span className="text-red-600 ml-1">✗</span>}
                    </div>
                  )}
                  {dnsResult.cnameRecords?.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">CNAME :</span> {dnsResult.cnameRecords.join(', ')}
                      {dnsResult.cnameOk ? <span className="text-green-600 ml-1">✓</span> : <span className="text-red-600 ml-1">✗</span>}
                    </div>
                  )}
                  {!dnsResult.ok && !dnsResult.aRecords?.length && !dnsResult.cnameRecords?.length && (
                    <p className="text-xs text-red-600">Aucun enregistrement détecté. Vérifiez votre configuration DNS et réessayez dans quelques minutes.</p>
                  )}
                  {!dnsResult.ok && (
                    <p className="text-xs text-gray-500">Cible attendue : <span className="font-mono">{dnsResult.expected?.cnameTarget || CNAME_TARGET}</span></p>
                  )}
                </div>
              )}

              {isConnected && !dnsResult && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <a href={`https://${customDomain}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green-700 hover:underline">
                    https://{customDomain}
                  </a>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={checkDns}
                  disabled={checking}
                  className="flex-1 px-4 py-2.5 bg-[#0F6B4F] hover:bg-[#0A5740] text-white text-sm font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {checking ? (
                    <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Vérification DNS...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Vérifier le DNS</>
                  )}
                </button>
                <button
                  onClick={disconnectDomain}
                  disabled={saving}
                  className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-xl transition disabled:opacity-60"
                >
                  Déconnecter
                </button>
              </div>

              <p className="text-[11px] text-gray-400 text-center">
                La propagation DNS peut prendre jusqu'à 48h. Relancez la vérification si nécessaire.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* SSL status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Certificat SSL</h2>
            <p className="text-xs text-gray-500">HTTPS automatique et gratuit sur tous les domaines</p>
          </div>
          <span className={`ml-auto px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
            sslStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {sslStatus === 'active' ? 'Actif' : 'En attente'}
          </span>
        </div>
      </div>

    </div>
  );
};

export default BoutiqueDomains;
