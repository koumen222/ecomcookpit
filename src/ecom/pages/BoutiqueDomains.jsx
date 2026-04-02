import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';

const BoutiqueDomains = () => {
  const { workspace } = useEcomAuth();
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [sslStatus, setSslStatus] = useState('none');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const subdomainGeneratedRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/store/domains');
        if (res.data?.data) {
          setSubdomain(res.data.data.subdomain || '');
          setCustomDomain(res.data.data.customDomain || '');
          setSslStatus(res.data.data.sslStatus || 'none');
        }
      } catch { /* defaults */ }
    };
    load();
  }, []);

  // Auto-generate subdomain when store name is available and no subdomain exists
  useEffect(() => {
    const autoGenerateSubdomain = async () => {
      // Only generate if: no subdomain loaded, workspace loaded, has store name, not already tried
      if (subdomain || !workspace || subdomainGeneratedRef.current) return;
      
      const storeName = workspace?.storeSettings?.storeName || workspace?.name;
      if (!storeName || storeName.trim().length < 3) return;
      
      // Try to auto-generate
      try {
        subdomainGeneratedRef.current = true;
        const res = await api.post('/store-manage/generate-subdomain', { 
          storeName: storeName.trim() 
        });
        
        if (res.data?.success) {
          setSubdomain(res.data.data.subdomain);
        }
      } catch {
        // Silently fail - user can still click the button
      }
    };
    
    autoGenerateSubdomain();
  }, [workspace, subdomain]);

  const generateSubdomainFromStoreName = async () => {
    const storeName = workspace?.storeSettings?.storeName || workspace?.name;
    
    if (!storeName || storeName.trim().length === 0) {
      alert('Veuillez d\'abord configurer le nom de votre boutique');
      return;
    }

    setGenerating(true);
    try {
      const res = await api.post('/store-manage/generate-subdomain', { 
        storeName: storeName.trim() 
      });
      
      if (res.data?.success) {
        setSubdomain(res.data.data.subdomain);
        setSaved(false);
        
        // Show success feedback
        const domain = res.data.data.fullDomain;
        const message = `✅ Domaine généré: ${domain}\n\nCe domaine est disponible et prêt à être utilisé.`;
        
        if (confirm(message + '\n\nVoulez-vous l\'utiliser maintenant?')) {
          // Auto-save if user confirms
          handleSave();
        }
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la génération du domaine');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/store/domains', { subdomain: subdomain.trim().toLowerCase(), customDomain: customDomain.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const checkDns = async () => {
    if (!customDomain) return;
    setChecking(true);
    setDnsResult(null);
    try {
      const res = await api.post('/store/domains/check-dns', { domain: customDomain });
      setDnsResult(res.data?.data || { ok: false });
    } catch {
      setDnsResult({ ok: false });
    } finally {
      setChecking(false);
    }
  };

  const subdomainUrl = subdomain ? `${subdomain}.scalor.net` : '';

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

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

      {/* ── Sous-domaine automatique ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#E6F2ED] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
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

          <div className="flex items-center gap-2">
            <button
              onClick={generateSubdomainFromStoreName}
              disabled={generating}
              className="flex-1 px-4 py-2 text-xs font-bold text-[#0A5740] bg-[#E6F2ED] rounded-xl hover:bg-[#C0DDD2] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Génération...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Générer depuis le nom
                </>
              )}
            </button>
          </div>

          {workspace?.storeSettings?.storeName && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              Basé sur: <span className="font-medium text-gray-700">"{workspace.storeSettings.storeName}"</span>
            </div>
          )}
        </div>

        {subdomainUrl ? (
          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <a href={`https://${subdomainUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green-700 hover:underline">
              https://{subdomainUrl}
            </a>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-500">
              Votre boutique sera accessible sur : <span className="font-mono text-gray-700">{subdomain || 'votre-boutique'}.scalor.net</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Domaine personnalisé ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <span className="text-xl">🌐</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Domaine personnalisé</h2>
            <p className="text-xs text-gray-500">Utilisez votre propre nom de domaine (ex: maboutique.com)</p>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={customDomain}
            onChange={(e) => { setCustomDomain(e.target.value.trim()); setSaved(false); setDnsResult(null); }}
            placeholder="maboutique.com"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent transition bg-gray-50 focus:bg-white font-mono"
          />

          {customDomain && (
            <button
              onClick={checkDns}
              disabled={checking}
              className="px-4 py-2 text-xs font-bold text-[#0A5740] bg-[#E6F2ED] rounded-xl hover:bg-[#C0DDD2] transition disabled:opacity-60"
            >
              {checking ? 'Vérification...' : 'Vérifier le DNS'}
            </button>
          )}

          {dnsResult !== null && (
            <div className={`px-4 py-3 rounded-xl space-y-2 ${dnsResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {dnsResult.ok ? (
                  <>
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-sm text-green-700 font-semibold">DNS configuré correctement !</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    <span className="text-sm text-red-700 font-semibold">DNS pas encore configuré</span>
                  </>
                )}
              </div>
              {/* Show detected records */}
              {dnsResult.aRecords?.length > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">A records détectés :</span> {dnsResult.aRecords.join(', ')}
                  {dnsResult.aOk ? <span className="text-green-600 ml-1">✓</span> : <span className="text-red-600 ml-1">✗</span>}
                </div>
              )}
              {dnsResult.cnameRecords?.length > 0 && (
                <div className="text-xs text-gray-600">
                  <span className="font-semibold">CNAME détecté :</span> {dnsResult.cnameRecords.join(', ')}
                  {dnsResult.cnameOk ? <span className="text-green-600 ml-1">✓</span> : <span className="text-red-600 ml-1">✗</span>}
                </div>
              )}
              {!dnsResult.ok && !dnsResult.aRecords?.length && !dnsResult.cnameRecords?.length && (
                <p className="text-xs text-red-600">Aucun enregistrement DNS détecté. Vérifiez que les enregistrements sont bien configurés.</p>
              )}
            </div>
          )}
        </div>

        {/* DNS instructions */}
        <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-4">
          <p className="text-xs font-bold text-gray-700">Configuration DNS requise :</p>

          {/* Option 1: A Records */}
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">OPTION 1</span>
              Enregistrement A (recommandé)
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-700 font-bold w-14 text-center">A</span>
                <span className="text-gray-500 w-8">@</span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-900 font-bold">151.101.2.15</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-700 font-bold w-14 text-center">CNAME</span>
                <span className="text-gray-500 w-8">www</span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-900 font-bold">shops.scalor.net</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* Option 2: CNAME only */}
          <div>
            <p className="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">OPTION 2</span>
              CNAME (Cloudflare, Netlify DNS)
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-700 font-bold w-14 text-center">CNAME</span>
                <span className="text-gray-500 w-8">@</span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-900 font-bold">shops.scalor.net</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-2 py-0.5 bg-gray-200 rounded text-gray-700 font-bold w-14 text-center">CNAME</span>
                <span className="text-gray-500 w-8">www</span>
                <span className="text-gray-500">→</span>
                <span className="text-gray-900 font-bold">shops.scalor.net</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">CNAME @ fonctionne uniquement avec les DNS qui supportent le CNAME flattening</p>
          </div>

          <p className="text-[11px] text-gray-500">
            Ajoutez ces enregistrements dans votre gestionnaire DNS (Namecheap, GoDaddy, Cloudflare...). La propagation peut prendre jusqu'à 48h.
          </p>
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
          <span className="ml-auto px-3 py-1 text-[10px] font-bold bg-green-100 text-green-700 rounded-full uppercase">Actif</span>
        </div>
      </div>

    </div>
  );
};

export default BoutiqueDomains;
