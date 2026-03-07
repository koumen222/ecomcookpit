import React, { useState, useRef, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, ChevronDown,
  ChevronUp, Image, Copy, ExternalLink, Zap, MessageCircle,
  TrendingUp, HelpCircle, Package, ArrowRight, Send, Settings
} from 'lucide-react';
import WhatsAppSendModal from './WhatsAppSendModal.jsx';
// WhatsAppConfigModal supprimé

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const STEPS = [
  { id: 1, icon: '🔍', label: 'Analyse de la page Alibaba' },
  { id: 2, icon: '🧠', label: 'Génération copywriting IA' },
  { id: 3, icon: '🎨', label: 'Création visuels marketing' },
  { id: 4, icon: '✅', label: 'Produit prêt !' }
];

const TABS = [
  { id: 'content', label: 'Contenu', icon: Package },
  { id: 'marketing', label: 'Marketing', icon: TrendingUp },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'images', label: 'Images', icon: Image }
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1 text-gray-400 hover:text-emerald-600 transition"
      title="Copier"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          {Icon && <Icon className="w-4 h-4 text-emerald-600" />}
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 bg-white space-y-2">{children}</div>}
    </div>
  );
}

/**
 * AlibabaImportModal
 *
 * Props:
 *   onClose()          — close the modal
 *   onApply(product)   — called when user clicks "Appliquer au formulaire"
 *                        product has: name, description, category, tags, suggestedPrice,
 *                        seoTitle, seoDescription, images[], + extra AI fields
 */
const AlibabaImportModal = ({ onClose, onApply }) => {
  const [phase, setPhase] = useState('input'); // 'input' | 'loading' | 'preview'
  const [url, setUrl] = useState('');
  const [withImages, setWithImages] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [showWhatsAppSend, setShowWhatsAppSend] = useState(false);
  // showWhatsAppConfig supprimé
  const abortRef = useRef(null);

  const isValidUrl = url.trim().length > 10 && (url.includes('alibaba.com') || url.includes('aliexpress.com'));

  const handleImport = useCallback(async () => {
    if (!isValidUrl) return;
    setPhase('loading');
    setError('');
    setCurrentStep(0);
    setStepLabel('');

    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const wsId = workspace?._id || workspace?.id;

    const controller = new AbortController();
    abortRef.current = controller;
    // Safety timeout: abort after 3 minutes
    const safetyTimer = setTimeout(() => controller.abort(), 180000);

    try {
      console.log('Starting Alibaba import:', { url: url.trim(), withImages, wsId, token: !!token });
      
      const resp = await fetch(`${BACKEND_URL}/api/ecom/alibaba-import`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: JSON.stringify({ url: url.trim(), withImages, workspaceId: wsId })
      });
      
      console.log('Response status:', resp.status, resp.statusText);

      if (!resp.ok) {
        let errorMessage = `Erreur serveur ${resp.status}`;
        try {
          const json = await resp.json();
          errorMessage = json.message || json.error || errorMessage;
          console.error('Server error details:', json);
        } catch (jsonErr) {
          console.error('Failed to parse error response:', jsonErr);
          // Try to get text response instead
          try {
            const text = await resp.text();
            console.error('Error response text:', text);
            if (text.includes('OpenAI')) errorMessage = 'Clé API OpenAI manquante ou invalide';
            else if (text.includes('auth')) errorMessage = 'Problème d\'authentification';
          } catch {}
        }
        throw new Error(errorMessage);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (line.startsWith('data:')) {
            const dataLine = line.slice(5).trim();
            if (!dataLine) continue;
            
            try {
              const data = JSON.parse(dataLine);
              console.log('SSE received:', data);

              if (data.type === 'ping') continue; // heartbeat, ignore
              if (data.type === 'progress') {
                setCurrentStep(data.step || 0);
                setStepLabel(data.label || '');
              } else if (data.type === 'done') {
                setProduct(data.product);
                setPhase('preview');
                setActiveTab('content');
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Erreur inattendue');
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE data:', dataLine, parseErr);
              // Continue processing other lines instead of failing
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(safetyTimer);
      console.error('Import error:', err);
      
      if (err.name === 'AbortError') {
        console.log('Import cancelled by user');
        return;
      }
      
      let errorMessage = err.message || 'Erreur lors de l\'import';
      
      if (err?.name === 'TypeError' && String(err?.message || '').toLowerCase().includes('failed to fetch')) {
        errorMessage = `Connexion impossible au backend (${BACKEND_URL}). Vérifiez que le serveur fonctionne.`;
      } else if (errorMessage.includes('OpenAI')) {
        errorMessage = 'Configuration OpenAI manquante. Vérifiez la clé API dans les variables d\'environnement.';
      } else if (errorMessage.includes('auth')) {
        errorMessage = 'Problème d\'authentification. Reconnectez-vous et réessayez.';
      }
      
      setError(errorMessage);
      setPhase('input');
    } finally {
      clearTimeout(safetyTimer);
    }
  }, [url, withImages, isValidUrl]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setPhase('input');
  };

  const handleApply = () => {
    if (!product) return;

    // Build rich description combining all AI content
    const descParts = [];
    if (product.description) descParts.push(product.description);
    if (product.benefits?.length) {
      descParts.push('\n\n✅ **Points forts:**\n' + product.benefits.map(b => `• ${b}`).join('\n'));
    }
    if (product.useCases?.length) {
      descParts.push('\n\n🎯 **Cas d\'usage:**\n' + product.useCases.map(u => `• ${u}`).join('\n'));
    }

    onApply({
      name: product.name || '',
      description: descParts.join(''),
      price: product.suggestedPrice > 0 ? String(product.suggestedPrice) : '',
      category: product.category || '',
      tags: (product.tags || []).join(', '),
      seoTitle: product.seoTitle || '',
      seoDescription: product.seoDescription || '',
      images: (product.images || []),
      // Pass extra AI data for display
      _aiData: {
        hook: product.hook,
        headline: product.headline,
        problemSolved: product.problemSolved,
        benefits: product.benefits,
        useCases: product.useCases,
        specs: product.specs,
        faq: product.faq,
        marketingAngles: product.marketingAngles,
        tiktokHooks: product.tiktokHooks,
        whatsappMessage: product.whatsappMessage,
        sourceUrl: product.sourceUrl
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[96vh]">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-sm">
              <span className="text-lg">🛒</span>
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Importer depuis Alibaba</h2>
              <p className="text-xs text-gray-400">IA analyse + génère la fiche produit complète</p>
            </div>
          </div>
          <button
            type="button"
            onClick={phase === 'loading' ? handleCancel : onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* INPUT PHASE */}
          {phase === 'input' && (
            <div className="p-5 space-y-5">
              {/* URL field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Lien Alibaba
                </label>
                <div className="relative">
                  <input
                    type="url"
                    autoFocus
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && isValidUrl && handleImport()}
                    placeholder="https://www.alibaba.com/product-detail/..."
                    className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  />
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Fonctionne aussi avec AliExpress · La page sera analysée par notre IA
                </p>
              </div>

              {/* What will be generated */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-700 mb-2.5 uppercase tracking-wide">Ce qui sera généré automatiquement</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    '📝 Titre optimisé conversion', '✨ Description storytelling',
                    '✅ 5 bénéfices clés', '🎯 Cas d\'usage réels',
                    '❓ FAQ 5 questions', '📣 Angles marketing',
                    '📱 5 hooks TikTok', '💬 Message WhatsApp',
                    '🔍 SEO title + description', '🏷️ Tags & catégorie'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-orange-800">
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image generation toggle */}
              <label className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Générer des images marketing IA</p>
                    <p className="text-xs text-gray-400">Photo produit + lifestyle (DALL-E 3) · +30s</p>
                  </div>
                </div>
                <div
                  onClick={() => setWithImages(p => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${withImages ? 'bg-violet-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${withImages ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </label>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* LOADING PHASE */}
          {phase === 'loading' && (
            <div className="p-8 flex flex-col items-center justify-center min-h-[300px] space-y-8">
              {/* Animated icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg animate-pulse">
                  <span className="text-3xl">🤖</span>
                </div>
                <div className="absolute -inset-2 rounded-2xl border-2 border-orange-300 animate-ping opacity-40" />
              </div>

              {/* Current label */}
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-gray-800">
                  {stepLabel || 'Initialisation...'}
                </p>
                <p className="text-xs text-gray-400">
                  L'IA analyse et génère votre fiche produit complète
                </p>
              </div>

              {/* Steps */}
              <div className="w-full max-w-sm space-y-3">
                {STEPS.map(step => {
                  const done = currentStep > step.id;
                  const active = currentStep === step.id;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        active ? 'bg-orange-50 border-orange-200 shadow-sm' :
                        done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                        done ? 'bg-emerald-500 text-white' :
                        active ? 'bg-orange-100 border-2 border-orange-300' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {done ? '✓' : active ? <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> : step.id}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          active ? 'text-orange-700' : done ? 'text-emerald-700' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                        {done && (
                          <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                            ✅ Terminé
                          </div>
                        )}
                        {active && (
                          <div className="text-xs text-orange-600 font-medium mt-0.5">
                            En cours...
                          </div>
                        )}
                      </div>
                      {done && (
                        <div className="text-emerald-500">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-gray-400 text-center">
                {withImages ? 'Environ 45-90 secondes avec génération d\'images' : 'Environ 15-30 secondes'}
              </p>
            </div>
          )}

          {/* PREVIEW PHASE */}
          {phase === 'preview' && product && (
            <div className="flex flex-col">
              {/* Product header */}
              <div className="px-5 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                <div className="flex items-start gap-3">
                  {product.images?.[0]?.url && (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base leading-tight">{product.name}</p>
                    {product.hook && (
                      <p className="text-sm text-emerald-700 mt-0.5 italic">"{product.hook}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {product.suggestedPrice > 0 && (
                        <span className="text-sm font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                          {product.suggestedPrice.toLocaleString()} {product.currency || 'XAF'}
                        </span>
                      )}
                      {product.category && (
                        <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                          {product.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 px-2 flex-shrink-0">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition ${
                        activeTab === tab.id
                          ? 'border-emerald-500 text-emerald-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="p-4 space-y-3">

                {/* CONTENT TAB */}
                {activeTab === 'content' && (
                  <div className="space-y-3">
                    {product.headline && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <p className="text-xs text-blue-500 font-semibold uppercase mb-1">Titre émotionnel</p>
                        <p className="text-sm font-bold text-blue-900">{product.headline}</p>
                      </div>
                    )}

                    {product.problemSolved && (
                      <CollapsibleSection title="Problème résolu" defaultOpen>
                        <p className="text-sm text-gray-700">{product.problemSolved}</p>
                      </CollapsibleSection>
                    )}

                    {product.benefits?.length > 0 && (
                      <CollapsibleSection title="5 Bénéfices clés" defaultOpen>
                        <ul className="space-y-1.5">
                          {product.benefits.map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                              {b}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleSection>
                    )}

                    {product.description && (
                      <CollapsibleSection title="Description complète">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
                      </CollapsibleSection>
                    )}

                    {product.specs?.length > 0 && (
                      <CollapsibleSection title="Spécifications techniques">
                        <div className="divide-y divide-gray-100">
                          {product.specs.map((s, i) => (
                            <div key={i} className="flex justify-between py-1.5 text-xs">
                              <span className="text-gray-500 font-medium">{s.label}</span>
                              <span className="text-gray-800">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleSection>
                    )}

                    {product.tags?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 font-semibold mb-1.5">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {product.tags.map((t, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MARKETING TAB */}
                {activeTab === 'marketing' && (
                  <div className="space-y-3">
                    {product.marketingAngles?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">📣 Angles marketing</p>
                        <div className="space-y-1.5">
                          {product.marketingAngles.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                              <span className="font-bold text-amber-500 flex-shrink-0">{i + 1}.</span>
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.tiktokHooks?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🎵 Hooks TikTok / Reels</p>
                        <div className="space-y-1.5">
                          {product.tiktokHooks.map((h, i) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-pink-50 border border-pink-100 rounded-lg">
                              <span className="text-sm text-pink-800 flex-1">{h}</span>
                              <CopyButton text={h} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {product.whatsappMessage && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-green-500" />
                            Message WhatsApp
                          </p>
                          <button
                            onClick={() => setShowWhatsAppSend(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition"
                          >
                            <Send className="w-3 h-3" />
                            Envoyer
                          </button>
                        </div>
                        <div className="relative p-3 bg-green-50 border border-green-100 rounded-xl">
                          <p className="text-sm text-gray-700 whitespace-pre-line pr-6">{product.whatsappMessage}</p>
                          <div className="absolute top-2 right-2">
                            <CopyButton text={product.whatsappMessage} />
                          </div>
                        </div>
                      </div>
                    )}

                    {product.useCases?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🎯 Cas d'usage</p>
                        <div className="space-y-1.5">
                          {product.useCases.map((u, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-blue-400 flex-shrink-0">→</span>
                              {u}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(product.seoTitle || product.seoDescription) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🔍 SEO</p>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                          {product.seoTitle && (
                            <div>
                              <p className="text-[10px] text-blue-400 font-semibold">Titre ({product.seoTitle.length}/65)</p>
                              <p className="text-sm text-blue-900 font-medium">{product.seoTitle}</p>
                            </div>
                          )}
                          {product.seoDescription && (
                            <div>
                              <p className="text-[10px] text-blue-400 font-semibold">Description ({product.seoDescription.length}/155)</p>
                              <p className="text-sm text-blue-700">{product.seoDescription}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* FAQ TAB */}
                {activeTab === 'faq' && (
                  <div className="space-y-2">
                    {product.faq?.length > 0 ? product.faq.map((item, i) => (
                      <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-gray-50">
                          <p className="text-sm font-semibold text-gray-800">Q: {item.question}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-sm text-gray-600">{item.answer}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-400 text-center py-8">Aucune FAQ générée</p>
                    )}
                  </div>
                )}

                {/* IMAGES TAB */}
                {activeTab === 'images' && (
                  <div>
                    {product.images?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {product.images.map((img, i) => (
                          <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                            <img
                              src={img.url}
                              alt={img.alt || product.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {i === 0 && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-md">
                                Principale
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-gray-400">
                        <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Aucune image générée</p>
                        <p className="text-xs mt-1">Activez la génération d'images pour obtenir des visuels</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          {phase === 'input' && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!isValidUrl}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm text-sm"
            >
              <Zap className="w-4 h-4" />
              Générer la fiche produit avec l'IA
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {phase === 'loading' && (
            <button
              type="button"
              onClick={handleCancel}
              className="w-full py-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
            >
              Annuler
            </button>
          )}

          {phase === 'preview' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPhase('input'); setProduct(null); setUrl(''); }}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
              >
                Nouveau produit
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition text-sm shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Appliquer au formulaire
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modales WhatsApp */}
      {showWhatsAppSend && product && (
        <WhatsAppSendModal
          onClose={() => setShowWhatsAppSend(false)}
          initialMessage={product.whatsappMessage || ''}
          productData={{
            name: product.name,
            price: product.suggestedPrice,
            link: product.sourceUrl
          }}
          onConfigNeeded={() => {
            setShowWhatsAppSend(false);
            setShowWhatsAppConfig(true);
          }}
        />
      )}

      {showWhatsAppConfig && (
        <WhatsAppConfigModal
          onClose={() => setShowWhatsAppConfig(false)}
          onConfigSaved={() => {
            setShowWhatsAppConfig(false);
            // Optionellement rouvrir le modal d'envoi après configuration
            if (product?.whatsappMessage) {
              setTimeout(() => setShowWhatsAppSend(true), 500);
            }
          }}
        />
      )}
    </div>
  );
};

export default AlibabaImportModal;
