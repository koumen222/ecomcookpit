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

  const [shopDomain, setShopDomain] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('webhook');
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

  // Vérifier les paramètres de retour OAuth
  useEffect(() => {
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const shopParam = searchParams.get('shop');

    if (successParam === 'true' && shopParam) {
      setSuccess(`Boutique ${shopParam} connectee avec succes !`);
      setActiveTab('oauth');
    } else if (errorParam) {
      const errorMessages = {
        missing_params: 'Parametres manquants dans la reponse Shopify.',
        invalid_shop: 'Domaine Shopify invalide.',
        invalid_state: 'Session expiree. Veuillez reessayer.',
        invalid_hmac: 'Verification de securite echouee.',
        session_expired: 'Session expiree. Veuillez vous reconnecter.',
        no_token: 'Impossible d\'obtenir le token d\'acces Shopify.',
        oauth_failed: 'Erreur lors de l\'authentification Shopify.'
      };
      setError(errorMessages[errorParam] || 'Erreur inconnue lors de la connexion.');
      setActiveTab('oauth');
    }
  }, [searchParams]);

  // Charger les boutiques connectées
  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/shopify/stores');
      setStores(res.data.data || []);
    } catch (err) {
      console.error('Erreur chargement boutiques:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    setError('');
    setSuccess('');

    let domain = shopDomain.trim().toLowerCase();

    // Normaliser le domaine
    domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain.endsWith('.myshopify.com')) {
      domain = domain.replace(/\.myshopify\.com$/, '') + '.myshopify.com';
    }

    // Validation
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
      setError('Domaine invalide. Exemple : ma-boutique.myshopify.com');
      return;
    }

    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const wsId = workspace?._id || workspace?.id;
    const userId = user?._id || user?.id;

    // Rediriger vers l'endpoint OAuth backend
    const connectUrl = `${BACKEND_BASE}/api/ecom/shopify/connect?shop=${encodeURIComponent(domain)}&userId=${encodeURIComponent(userId)}&workspaceId=${encodeURIComponent(wsId)}`;
    window.location.href = connectUrl;
  };

  const handleDisconnect = async (storeId, shopName) => {
    if (!confirm(`Deconnecter la boutique "${shopName}" ?`)) return;
    try {
      await ecomApi.delete(`/shopify/stores/${storeId}`);
      setSuccess(`Boutique ${shopName} deconnectee.`);
      loadStores();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la deconnexion');
    }
  };

  const handleSync = async (storeId) => {
    setSyncing(storeId);
    setError('');
    try {
      const res = await ecomApi.post(`/shopify/stores/${storeId}/sync`);
      setSuccess(res.data.message || 'Synchronisation terminee');
      loadStores();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la synchronisation');
    } finally {
      setSyncing(null);
    }
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Connexion Shopify</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recevez automatiquement vos commandes Shopify via webhook ou connectez-vous par OAuth.
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('webhook')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'webhook'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Webhook (recommande)
        </button>
        <button
          onClick={() => setActiveTab('oauth')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            activeTab === 'oauth'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          OAuth
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: WEBHOOK                                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'webhook' && (
        <>
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: OAUTH                                                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'oauth' && (
        <>
          {/* Formulaire de connexion */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#96bf48] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.34 3.4c-.24-.07-.48.04-.55.24l-.83 2.81c-.47-.36-1.05-.56-1.66-.56-1.37 0-2.49 1.16-2.78 2.81-.19-.09-.42-.06-.56.1L7.13 11.1c-.3.35-.25.87.1 1.17l1.52 1.29-.52 1.75c-.1.35.1.72.45.82l2.77.83c.35.1.72-.1.82-.45l2.55-8.62a.56.56 0 00-.04-.45c-.5-1.04-.58-1.7-.24-2.47.18-.4.62-.56 1-.38.07.03.14.07.2.12l.63-2.14c.07-.24-.04-.48-.24-.55l-.59-.17z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Connecter une boutique</h2>
                <p className="text-xs text-gray-500">Entrez le domaine de votre boutique Shopify</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                  placeholder="ma-boutique.myshopify.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={!shopDomain.trim()}
                className="px-5 py-2.5 bg-[#96bf48] text-white font-medium rounded-xl hover:bg-[#7ea73d] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connecter
              </button>
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Vous serez redirige vers Shopify pour autoriser l'acces. 
                Permissions demandees : lecture des commandes, produits et clients.
              </span>
            </div>
          </div>

          {/* Boutiques connectées */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Boutiques connectees
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-sm text-gray-500">Chargement...</span>
              </div>
            ) : stores.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <p className="text-sm text-gray-500">Aucune boutique connectee</p>
                <p className="text-xs text-gray-400 mt-1">Connectez votre boutique Shopify ci-dessus pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stores.map((store) => (
                  <div key={store._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-[#96bf48] rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M15.34 3.4c-.24-.07-.48.04-.55.24l-.83 2.81c-.47-.36-1.05-.56-1.66-.56-1.37 0-2.49 1.16-2.78 2.81-.19-.09-.42-.06-.56.1L7.13 11.1c-.3.35-.25.87.1 1.17l1.52 1.29-.52 1.75c-.1.35.1.72.45.82l2.77.83c.35.1.72-.1.82-.45l2.55-8.62a.56.56 0 00-.04-.45c-.5-1.04-.58-1.7-.24-2.47.18-.4.62-.56 1-.38.07.03.14.07.2.12l.63-2.14c.07-.24-.04-.48-.24-.55l-.59-.17z"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {store.metadata?.shopName || store.shop}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{store.shop}</p>
                        {store.lastSyncAt && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Derniere sync : {new Date(store.lastSyncAt).toLocaleString('fr-FR')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Statut */}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        store.syncStatus === 'syncing' ? 'bg-blue-100 text-blue-700' :
                        store.syncStatus === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {store.syncStatus === 'syncing' ? 'Synchronisation...' :
                         store.syncStatus === 'error' ? 'Erreur' :
                         'Connecte'}
                      </span>

                      {/* Sync */}
                      <button
                        onClick={() => handleSync(store._id)}
                        disabled={syncing === store._id}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                        title="Synchroniser les commandes"
                      >
                        <svg className={`w-4 h-4 ${syncing === store._id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>

                      {/* Déconnecter */}
                      <button
                        onClick={() => handleDisconnect(store._id, store.metadata?.shopName || store.shop)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Deconnecter"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guide rapide OAuth */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Comment ca marche ?
            </h3>
            <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside">
              <li>Entrez le domaine de votre boutique (ex: <code className="bg-amber-100 px-1 rounded">ma-boutique.myshopify.com</code>)</li>
              <li>Cliquez sur <strong>Connecter</strong> — vous serez redirige vers Shopify</li>
              <li>Autorisez l'acces dans Shopify</li>
              <li>Vos commandes seront automatiquement importees</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
