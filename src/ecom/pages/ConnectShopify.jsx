import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import ecomApi from '../services/ecommApi.js';

const BACKEND_BASE = (() => {
  const env = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (env) {
    try { return new URL(env).origin; } catch { return env.replace(/\/+$/, ''); }
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  return 'https://api.scalor.net';
})();

export default function ConnectShopify() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookLoading, setWebhookLoading] = useState(true);

  // Charger le webhook URL unique du workspace
  useEffect(() => {
    const loadWebhookUrl = async () => {
      try {
        setWebhookLoading(true);
        const res = await ecomApi.post('/webhooks/shopify/generate-token', {});
        if (res.data?.data?.webhookUrl) {
          setWebhookUrl(res.data.data.webhookUrl);
        }
      } catch (err) {
        console.error('Erreur chargement webhook URL:', err);
        setWebhookUrl('');
      } finally {
        setWebhookLoading(false);
      }
    };
    loadWebhookUrl();
  }, []);

  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const testWebhook = async () => {
    setWebhookTesting(true);
    setWebhookStatus(null);
    try {
      const res = await fetch(`${BACKEND_BASE}/api/webhooks/shopify/test`);
      const data = await res.json();
      if (data.success) {
        setWebhookStatus({ ok: true, message: 'Endpoint webhook actif et fonctionnel', hmac: data.hmacConfigured });
      } else {
        setWebhookStatus({ ok: false, message: 'Endpoint inaccessible' });
      }
    } catch {
      setWebhookStatus({ ok: false, message: 'Impossible de joindre le serveur' });
    } finally {
      setWebhookTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webhook Shopify</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recevez automatiquement vos commandes Shopify en temps reel via webhook.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Webhook URL */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Webhook URL</h2>
            <p className="text-xs text-gray-500">Copiez cette URL et collez-la dans Shopify</p>
          </div>
        </div>

        {/* URL copy field */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              readOnly
              value={webhookLoading ? 'Chargement...' : webhookUrl}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono text-gray-700 select-all outline-none"
              onClick={(e) => e.target.select()}
            />
          </div>
          <button
            onClick={copyWebhookUrl}
            className={`px-4 py-3 rounded-xl text-sm font-medium transition flex items-center gap-2 flex-shrink-0 ${
              webhookCopied
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {webhookCopied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Copie !
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copier
              </>
            )}
          </button>
        </div>

        {/* Test button */}
        <div className="flex items-center gap-3">
          <button
            onClick={testWebhook}
            disabled={webhookTesting}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50"
          >
            {webhookTesting ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            Tester l'endpoint
          </button>
          {webhookStatus && (
            <span className={`text-xs font-medium flex items-center gap-1.5 ${webhookStatus.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full ${webhookStatus.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
              {webhookStatus.message}
              {webhookStatus.ok && webhookStatus.hmac && (
                <span className="text-gray-400 font-normal ml-1">(HMAC actif)</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Video Tutorial */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tutoriel video</h2>
            <p className="text-xs text-gray-500">Regardez comment configurer votre webhook Shopify</p>
          </div>
        </div>
        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src="https://www.youtube.com/embed/LykzSotpGaM"
            title="Tutoriel configuration webhook Shopify"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      {/* Configuration Shopify */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-[#96bf48] rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.34 3.4c-.24-.07-.48.04-.55.24l-.83 2.81c-.47-.36-1.05-.56-1.66-.56-1.37 0-2.49 1.16-2.78 2.81-.19-.09-.42-.06-.56.1L7.13 11.1c-.3.35-.25.87.1 1.17l1.52 1.29-.52 1.75c-.1.35.1.72.45.82l2.77.83c.35.1.72-.1.82-.45l2.55-8.62a.56.56 0 00-.04-.45c-.5-1.04-.58-1.7-.24-2.47.18-.4.62-.56 1-.38.07.03.14.07.2.12l.63-2.14c.07-.24-.04-.48-.24-.55l-.59-.17z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Configuration dans Shopify</h2>
            <p className="text-xs text-gray-500">Suivez ces etapes pour activer le webhook</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Ouvrez les parametres Shopify</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Allez dans <strong>Shopify Admin</strong> &rarr; <strong>Settings</strong> &rarr; <strong>Notifications</strong>
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Creez un webhook</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Faites defiler jusqu'a <strong>Webhooks</strong> en bas de page, puis cliquez sur <strong>Create webhook</strong>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Configurez le webhook</p>
              <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-600 w-16">Event</span>
                  <code className="bg-white px-2 py-1 rounded-lg border border-gray-200 text-gray-800">Order creation</code>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-gray-600 w-16">Format</span>
                  <code className="bg-white px-2 py-1 rounded-lg border border-gray-200 text-gray-800">JSON</code>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <span className="font-medium text-gray-600 w-16 mt-1">URL</span>
                  <div className="flex-1">
                    <code className="bg-white px-2 py-1 rounded-lg border border-gray-200 text-emerald-700 block break-all">{webhookUrl || '...'}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-3">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Sauvegardez</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Cliquez sur <strong>Save</strong>. Les nouvelles commandes Shopify seront automatiquement envoyees a Scalor.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-1">Comment ca marche ?</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>Chaque nouvelle commande Shopify declenche un webhook vers Scalor</li>
              <li>La commande est automatiquement importee dans votre tableau de bord</li>
              <li>Vous recevez une notification en temps reel</li>
              <li>Les doublons sont automatiquement detectes et ignores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
