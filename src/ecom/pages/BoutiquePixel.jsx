import React, { useState, useEffect } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const PixelCard = ({ title, icon, color, description, fields, values, onChange, validatePixel }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15', color }}>
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
    <div className="space-y-3">
      {fields.map(f => {
        const err = validatePixel ? validatePixel(f.key, values[f.key]) : null;
        return (
          <div key={f.key}>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">{f.label}</label>
            <input
              type="text"
              value={values[f.key] || ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent transition bg-gray-50 focus:bg-white ${
                err ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            />
            {err && <p className="text-[11px] text-red-500 mt-1 font-medium">{err} — {f.hint}</p>}
            {!err && f.hint && <p className="text-[11px] text-gray-400 mt-1">{f.hint}</p>}
          </div>
        );
      })}
    </div>
  </div>
);

const CodePreview = ({ pixels }) => {
  const hasAny = pixels.metaPixelId || pixels.tiktokPixelId || pixels.googleTagId;
  if (!hasAny) return null;

  return (
    <div className="bg-gray-900 rounded-2xl p-5 overflow-x-auto">
      <p className="text-xs font-bold text-gray-400 mb-3">Code injecté automatiquement dans votre boutique :</p>
      <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
{pixels.metaPixelId && `<!-- Meta Pixel -->
<script>
  !function(f,b,e,v,n,t,s){...}(window,document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${pixels.metaPixelId}');
  fbq('track', 'PageView');
</script>
`}
{pixels.tiktokPixelId && `<!-- TikTok Pixel -->
<script>
  !function(w,d,t){...}(window,document,'script',
  'https://analytics.tiktok.com/i18n/pixel/events.js');
  ttq.load('${pixels.tiktokPixelId}');
  ttq.page();
</script>
`}
{pixels.googleTagId && `<!-- Google Tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${pixels.googleTagId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${pixels.googleTagId}');
</script>
`}
      </pre>
    </div>
  );
};

const BoutiquePixel = () => {
  const { workspace } = useEcomAuth();
  const [pixels, setPixels] = useState({
    metaPixelId: '',
    metaAccessToken: '',
    tiktokPixelId: '',
    googleTagId: '',
    googleAdsId: '',
    snapchatPixelId: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await ecomApi.get('/store/pixels');
        if (res.data?.data) {
          setPixels(prev => ({ ...prev, ...res.data.data }));
        }
      } catch {
        // defaults
      }
    };
    load();
  }, []);

  const update = (key, value) => {
    // Strip whitespace and non-printable chars
    const clean = value.replace(/\s/g, '').trim();
    setPixels(prev => ({ ...prev, [key]: clean }));
    setSaved(false);
  };

  // Validation patterns
  const PIXEL_PATTERNS = {
    metaPixelId: /^\d{10,20}$/,
    metaAccessToken: /^[A-Za-z0-9_-]{10,}$/,
    tiktokPixelId: /^[A-Z0-9]{10,30}$/,
    googleTagId: /^(G|GT|AW)-[A-Z0-9]+$/,
    googleAdsId: /^AW-\d+$/,
    snapchatPixelId: /^[a-f0-9-]{20,}$/i,
  };

  const validatePixel = (key, value) => {
    if (!value) return null; // empty is OK
    const pattern = PIXEL_PATTERNS[key];
    if (pattern && !pattern.test(value)) return 'Format invalide';
    return null;
  };

  const hasErrors = Object.entries(pixels).some(([k, v]) => v && validatePixel(k, v));

  const handleSave = async () => {
    if (hasErrors) return;
    setSaving(true);
    try {
      await ecomApi.put('/store/pixels', pixels);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pixel & Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connectez vos pixels pour tracker les conversions</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || hasErrors}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white transition shadow-md ${
            saved ? 'bg-green-500' : hasErrors ? 'bg-red-400' : 'bg-[#0F6B4F] hover:bg-[#0A5740]'
          } disabled:opacity-60`}
        >
          {saving ? 'Enregistrement...' : saved ? '✓ Sauvegardé' : hasErrors ? 'Format invalide' : 'Sauvegarder'}
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-[#E6F2ED] border border-[#96C7B5] rounded-2xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-[#0F6B4F] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <div>
          <p className="text-sm font-semibold text-[#053326]">Comment ça marche ?</p>
          <p className="text-xs text-[#0A5740] mt-0.5">
            Entrez simplement vos IDs de pixel. Le code sera automatiquement injecté dans votre boutique.
            Les événements de conversion (PageView, AddToCart, Purchase) sont trackés automatiquement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PixelCard
          title="Meta (Facebook & Instagram)"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>}
          color="#1877F2"
          description="Trackez les conversions de vos pubs Facebook & Instagram"
          fields={[
            { key: 'metaPixelId', label: 'Meta Pixel ID', placeholder: '1234567890123456', hint: 'Uniquement des chiffres (15-16 chiffres) — Meta Business Suite → Events Manager' },
            { key: 'metaAccessToken', label: 'Conversions API Token (optionnel)', placeholder: 'EAABs...', hint: 'Pour le server-side tracking avancé' },
          ]}
          values={pixels}
          onChange={update}
          validatePixel={validatePixel}
        />

        <PixelCard
          title="TikTok"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>}
          color="#000000"
          description="Trackez les conversions de vos TikTok Ads"
          fields={[
            { key: 'tiktokPixelId', label: 'TikTok Pixel ID', placeholder: 'ABCDEF1234567890', hint: 'Trouvable dans TikTok Ads Manager → Assets → Events' },
          ]}
          values={pixels}
          onChange={update}
          validatePixel={validatePixel}
        />

        <PixelCard
          title="Google Analytics & Ads"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          color="#4285F4"
          description="Google Analytics 4 et Google Ads conversion tracking"
          fields={[
            { key: 'googleTagId', label: 'Google Tag ID (GA4)', placeholder: 'G-XXXXXXXXXX', hint: 'Trouvable dans Google Analytics → Admin → Data Streams' },
            { key: 'googleAdsId', label: 'Google Ads ID (optionnel)', placeholder: 'AW-1234567890', hint: 'Pour le suivi des conversions Google Ads' },
          ]}
          values={pixels}
          onChange={update}
          validatePixel={validatePixel}
        />

        <PixelCard
          title="Snapchat"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          color="#FFFC00"
          description="Trackez les conversions Snapchat Ads"
          fields={[
            { key: 'snapchatPixelId', label: 'Snapchat Pixel ID', placeholder: 'abcd1234-efgh-5678...', hint: 'Trouvable dans Snapchat Ads Manager → Events Manager' },
          ]}
          values={pixels}
          onChange={update}
          validatePixel={validatePixel}
        />
      </div>

      {/* Code preview */}
      <CodePreview pixels={pixels} />

      {/* Events tracked */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Événements trackés automatiquement</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'PageView', desc: 'Chaque visite de page', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
            { name: 'ViewContent', desc: 'Vue d\'un produit', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
            { name: 'AddToCart', desc: 'Ajout au panier / Commande', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
            { name: 'Purchase', desc: 'Achat confirmé', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            { name: 'InitiateCheckout', desc: 'Début du checkout', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
            { name: 'Lead', desc: 'Formulaire WhatsApp envoyé', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
            { name: 'Search', desc: 'Recherche produit', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
            { name: 'CompleteRegistration', desc: 'Création de compte', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
          ].map(e => (
            <div key={e.name} className="p-3 bg-gray-50 rounded-xl">
              <span className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 mb-2">{e.icon}</span>
              <p className="text-xs font-bold text-gray-900">{e.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{e.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default BoutiquePixel;
