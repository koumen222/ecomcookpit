import React, { useState, useEffect, useRef } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import api from '../../lib/api';

const FONTS = [
  { id: 'inter', name: 'Inter' },
  { id: 'poppins', name: 'Poppins' },
  { id: 'dm-sans', name: 'DM Sans' },
  { id: 'montserrat', name: 'Montserrat' },
  { id: 'playfair', name: 'Playfair Display' },
  { id: 'space-grotesk', name: 'Space Grotesk' },
];

const CURRENCIES = ['XAF', 'XOF', 'USD', 'EUR', 'GHS', 'NGN', 'KES', 'MAD', 'TND'];

const DEBUG_TAG = '[BoutiqueSettings]';

const summarizeSettings = (settings = {}) => {
  const logoValue = settings.logo || '';
  const faviconValue = settings.favicon || '';

  return {
    ...settings,
    logo: logoValue ? `[len:${logoValue.length}] ${logoValue.slice(0, 80)}` : '',
    favicon: faviconValue ? `[len:${faviconValue.length}] ${faviconValue.slice(0, 80)}` : '',
    logoIsDataUrl: logoValue.startsWith('data:'),
    faviconIsDataUrl: faviconValue.startsWith('data:'),
  };
};

const ImageUploader = ({ label, value, onChange, hint }) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log(`${DEBUG_TAG}[${label}] file selected`, {
      name: file.name,
      sizeBytes: file.size,
      sizeMB: Number((file.size / (1024 * 1024)).toFixed(2)),
      type: file.type,
      lastModified: file.lastModified,
    });

    setUploading(true);
    const uploadStartedAt = Date.now();

    try {
      const formData = new FormData();
      formData.append('image', file);

      console.log(`${DEBUG_TAG}[${label}] upload start`, {
        endpoint: '/upload/image',
        formFields: Array.from(formData.keys()),
      });

      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const url = res.data?.data?.url || res.data?.url;
      console.log(`${DEBUG_TAG}[${label}] upload success`, {
        status: res.status,
        durationMs: Date.now() - uploadStartedAt,
        responseKeys: Object.keys(res.data || {}),
        hasUrl: Boolean(url),
        urlPreview: url ? String(url).slice(0, 120) : null,
      });

      if (url) onChange(url);
    } catch (error) {
      console.error(`${DEBUG_TAG}[${label}] upload failed, using FileReader fallback`, {
        durationMs: Date.now() - uploadStartedAt,
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        responseData: error?.response?.data,
        requestUrl: error?.config?.url,
        method: error?.config?.method,
        timeout: error?.config?.timeout,
      });

      // fallback: use local preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        console.warn(`${DEBUG_TAG}[${label}] fallback data URL generated`, {
          dataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : 0,
          note: 'If this is very large, saving settings may timeout or fail in production.',
        });
        onChange(dataUrl);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-2 block">{label}</label>
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-[#4D9F82] hover:bg-[#E6F2ED] transition overflow-hidden"
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-[#0F6B4F] border-t-transparent rounded-full animate-spin" />
          ) : value ? (
            <img src={value} alt="" className="w-full h-full object-contain" />
          ) : (
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold text-[#0A5740] bg-[#E6F2ED] rounded-lg hover:bg-[#C0DDD2] transition"
          >
            {value ? 'Changer' : 'Uploader'}
          </button>
          {value && (
            <button onClick={() => onChange('')} className="ml-2 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
              Supprimer
            </button>
          )}
          {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

const BoutiqueSettings = () => {
  const { workspace } = useEcomAuth();
  const [settings, setSettings] = useState({
    name: '',
    description: '',
    logo: '',
    favicon: '',
    primaryColor: '#0F6B4F',
    ctaColor: '#0F6B4F',
    font: 'inter',
    currency: 'XAF',
    whatsapp: '',
    email: '',
    address: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    seoTitle: '',
    seoDescription: '',
    announcement: '',
    announcementEnabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const startedAt = Date.now();
      console.log(`${DEBUG_TAG} loading settings`, {
        workspaceId: workspace?._id || workspace?.id || null,
      });

      try {
        const res = await api.get('/store/settings');
        console.log(`${DEBUG_TAG} settings loaded`, {
          status: res.status,
          durationMs: Date.now() - startedAt,
          hasData: Boolean(res.data?.data),
          keys: Object.keys(res.data?.data || {}),
        });

        if (res.data?.data) {
          setSettings(prev => ({ ...prev, ...res.data.data }));
        }
      } catch (error) {
        console.error(`${DEBUG_TAG} failed to load settings`, {
          durationMs: Date.now() - startedAt,
          message: error?.message,
          code: error?.code,
          status: error?.response?.status,
          responseData: error?.response?.data,
          requestUrl: error?.config?.url,
          method: error?.config?.method,
        });
        /* defaults */
      }
    };

    load();
  }, [workspace?._id, workspace?.id]);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    const startedAt = Date.now();
    console.log(`${DEBUG_TAG} save start`, {
      workspaceId: workspace?._id || workspace?.id || null,
      settingsSummary: summarizeSettings(settings),
      online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
    });

    setSaving(true);

    try {
      const payload = { ...settings, isStoreEnabled: true };
      const payloadString = JSON.stringify(payload);
      console.log(`${DEBUG_TAG} save request payload`, {
        payloadBytes: new Blob([payloadString]).size,
        payloadChars: payloadString.length,
        logoLength: (payload.logo || '').length,
        faviconLength: (payload.favicon || '').length,
        logoIsDataUrl: String(payload.logo || '').startsWith('data:'),
        faviconIsDataUrl: String(payload.favicon || '').startsWith('data:'),
      });

      const response = await api.put('/store/settings', payload);
      console.log(`${DEBUG_TAG} save success`, {
        durationMs: Date.now() - startedAt,
        status: response.status,
        data: response.data,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error(`${DEBUG_TAG} save failed`, {
        durationMs: Date.now() - startedAt,
        message: error?.message,
        code: error?.code,
        isNetworkError: error?.message === 'Network Error',
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        responseHeaders: error?.response?.headers,
        responseData: error?.response?.data,
        requestUrl: error?.config?.url,
        method: error?.config?.method,
        timeout: error?.config?.timeout,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
      });

      alert(`Erreur lors de la sauvegarde: ${error.response?.data?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paramètres & Branding</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configurez l'identité de votre boutique</p>
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

      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
        <h2 className="text-sm font-bold text-gray-900">Branding</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ImageUploader label="Logo" value={settings.logo} onChange={(v) => update('logo', v)} hint="PNG ou SVG, fond transparent recommandé" />
          <ImageUploader label="Favicon" value={settings.favicon} onChange={(v) => update('favicon', v)} hint="32x32 ou 64x64 px" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Couleur principale</label>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
              <input type="text" value={settings.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl font-mono bg-gray-50" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Couleur CTA</label>
            <div className="flex items-center gap-2">
              <input type="color" value={settings.ctaColor} onChange={(e) => update('ctaColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
              <input type="text" value={settings.ctaColor} onChange={(e) => update('ctaColor', e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl font-mono bg-gray-50" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Police</label>
          <select value={settings.font} onChange={(e) => update('font', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F]">
            {FONTS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </section>

      {/* ── Informations générales ─────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Informations générales</h2>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom de la boutique</label>
          <input type="text" value={settings.name} onChange={(e) => update('name', e.target.value)} placeholder="Ma Super Boutique" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
          <textarea value={settings.description} onChange={(e) => update('description', e.target.value)} placeholder="Décrivez votre boutique en quelques mots..." rows={3} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Devise</label>
            <select value={settings.currency} onChange={(e) => update('currency', e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F]">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">WhatsApp</label>
            <input type="tel" value={settings.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} placeholder="+237612345678" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Email de contact</label>
          <input type="email" value={settings.email} onChange={(e) => update('email', e.target.value)} placeholder="contact@maboutique.com" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Adresse</label>
          <input type="text" value={settings.address} onChange={(e) => update('address', e.target.value)} placeholder="Douala, Cameroun" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
        </div>
      </section>

      {/* ── Réseaux sociaux ────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">Réseaux sociaux</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Facebook</label>
            <input type="url" value={settings.facebook} onChange={(e) => update('facebook', e.target.value)} placeholder="https://facebook.com/..." className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Instagram</label>
            <input type="url" value={settings.instagram} onChange={(e) => update('instagram', e.target.value)} placeholder="https://instagram.com/..." className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">TikTok</label>
            <input type="url" value={settings.tiktok} onChange={(e) => update('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
          </div>
        </div>
      </section>

      {/* ── SEO ────────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">SEO</h2>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Titre SEO</label>
          <input type="text" value={settings.seoTitle} onChange={(e) => update('seoTitle', e.target.value)} placeholder="Ma Boutique — Les meilleurs produits en Afrique" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
          <p className="text-[11px] text-gray-400 mt-1">{(settings.seoTitle || '').length}/65 caractères</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Description SEO</label>
          <textarea value={settings.seoDescription} onChange={(e) => update('seoDescription', e.target.value)} placeholder="Découvrez nos produits de qualité livrés partout en Afrique..." rows={2} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white resize-none" />
          <p className="text-[11px] text-gray-400 mt-1">{(settings.seoDescription || '').length}/155 caractères</p>
        </div>
      </section>

      {/* ── Bandeau d'annonce ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Bandeau d'annonce</h2>
          <button
            onClick={() => update('announcementEnabled', !settings.announcementEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.announcementEnabled ? 'bg-[#0F6B4F]' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.announcementEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <input type="text" value={settings.announcement} onChange={(e) => update('announcement', e.target.value)} placeholder="🔥 Livraison gratuite sur toutes les commandes !" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0F6B4F] focus:bg-white" />
        {settings.announcementEnabled && settings.announcement && (
          <div className="bg-[#0F6B4F] text-white text-center py-2 px-4 rounded-xl text-xs font-semibold">
            {settings.announcement}
          </div>
        )}
      </section>

    </div>
  );
};

export default BoutiqueSettings;
