import React, { useState, useRef, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image, Copy, ExternalLink, Zap, MessageCircle, HelpCircle,
  Package, ArrowRight, Trash2, ChevronDown, ChevronUp, Star
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const STEPS = [
  { id: 1, icon: '🔍', label: 'Analyse Alibaba' },
  { id: 2, icon: '🧠', label: 'Vision IA + Copywriting' },
  { id: 3, icon: '🎨', label: 'Génération des images' },
  { id: 4, icon: '☁️', label: 'Sauvegarde' },
  { id: 5, icon: '✅', label: 'Page prête !' }
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="p-1 text-gray-400 hover:text-emerald-600 transition"
      title="Copier"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function FaqAccordion({ items }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-700"
          >
            <span>{item.question}</span>
            {open === i ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-2" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-2" />}
          </button>
          {open === i && (
            <div className="px-4 py-3 text-sm text-gray-600 bg-white">{item.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ImagePreview({ src, label, className = '' }) {
  if (!src) return (
    <div className={`flex items-center justify-center bg-gray-100 rounded-xl border border-dashed border-gray-300 ${className}`}>
      <div className="text-center text-gray-400 p-4">
        <Image className="w-8 h-8 mx-auto mb-1 opacity-40" />
        <p className="text-xs">Image non disponible</p>
      </div>
    </div>
  );
  return (
    <div className={`relative rounded-xl overflow-hidden bg-gray-100 ${className}`}>
      <img src={src} alt={label || 'Product image'} className="w-full h-full object-cover" />
      {label && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          <p className="text-white text-xs font-medium">{label}</p>
        </div>
      )}
    </div>
  );
}

const ProductPageGeneratorModal = ({ onClose, onApply }) => {
  const [phase, setPhase] = useState('input');
  const [url, setUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [withImages, setWithImages] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('page');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const isValidUrl = url.trim().length > 10 && (url.includes('alibaba.com') || url.includes('aliexpress.com'));

  const addPhotos = useCallback((files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setPhotos(prev => {
      const combined = [...prev, ...imgs];
      return combined.slice(0, 8);
    });
  }, []);

  const removePhoto = (index) => setPhotos(prev => prev.filter((_, i) => i !== index));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addPhotos(e.dataTransfer.files);
  };

  const handleGenerate = useCallback(async () => {
    if (!isValidUrl) return;
    setPhase('loading');
    setError('');
    setCurrentStep(0);
    setStepLabel('');

    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const wsId = workspace?._id || workspace?.id;

    const formData = new FormData();
    formData.append('url', url.trim());
    formData.append('withImages', String(withImages));
    if (wsId) formData.append('workspaceId', wsId);
    photos.forEach(f => formData.append('images', f));

    const controller = new AbortController();
    abortRef.current = controller;
    const safetyTimer = setTimeout(() => controller.abort(), 300000);

    try {
      console.log('Starting Product Page Generation:', { url: url.trim(), withImages, photosCount: photos.length, wsId, token: !!token });
      
      const resp = await fetch(`${BACKEND_URL}/api/ai/product-generator`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: formData
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
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          
          if (line.startsWith('data:')) {
            const dataLine = line.slice(5).trim();
            if (!dataLine) continue;
            
            try {
              const data = JSON.parse(dataLine);
              console.log('SSE received:', data);

              if (data.type === 'progress') {
                setCurrentStep(data.step || 0);
                setStepLabel(data.label || '');
              } else if (data.type === 'done') {
                setProduct(data.product);
                setPhase('preview');
                setActiveTab('page');
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
      console.error('Product Page Generation error:', err);
      
      if (err.name === 'AbortError') {
        console.log('Generation cancelled by user');
        return;
      }
      
      let errorMessage = err.message || 'Erreur lors de la génération';
      
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
  }, [url, withImages, photos, isValidUrl]);

  const handleApply = () => {
    if (!product) return;
    const descParts = [];
    if (product.hook) descParts.push(`**${product.hook}**\n\n`);
    if (product.sections?.length) {
      product.sections.forEach(s => {
        descParts.push(`**${s.title}**\n${s.description}\n\n`);
      });
    }
    onApply({
      name: product.title || '',
      description: descParts.join('').trim(),
      price: product.suggestedPrice > 0 ? String(product.suggestedPrice) : '',
      category: product.category || '',
      tags: (product.tags || []).join(', '),
      seoTitle: product.seoTitle || '',
      seoDescription: product.seoDescription || '',
      images: (product.allImages || []).filter(Boolean).map((url, i) => ({
        url, alt: product.title || 'Product', order: i
      })),
      _pageData: product
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Générateur de Page Produit IA</h2>
              <p className="text-xs text-gray-500">Photos réelles + Alibaba → Page complète en 60s</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ─── INPUT PHASE ─── */}
          {phase === 'input' && (
            <div className="p-6 space-y-5">

              {/* URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  🔗 Lien Alibaba ou AliExpress
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://www.alibaba.com/product-detail/..."
                    className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-600">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  📸 Tes vraies photos du produit <span className="font-normal text-gray-500">(3–8 recommandées)</span>
                </label>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                    dragOver ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'
                  }`}
                >
                  <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Glisse tes photos ici ou <span className="text-violet-600">clique pour sélectionner</span></p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — max 10MB chaque — jusqu'à 8 photos</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => addPhotos(e.target.files)}
                  />
                </div>

                {photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {photos.map((photo, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removePhoto(i); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        {i === 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-violet-600/80 text-white text-xs text-center py-0.5">Hero</div>
                        )}
                      </div>
                    ))}
                    {photos.length < 8 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-violet-300 flex items-center justify-center text-gray-400 hover:text-violet-500 transition"
                      >
                        <Upload className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* What gets generated */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                <p className="text-xs font-bold text-violet-700 mb-3 uppercase tracking-wide">CE QUI SERA GÉNÉRÉ</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  {[
                    ['🖼️', 'Image hero ultra-réaliste'],
                    ['📝', '3 à 5 sections avantages'],
                    ['🎨', 'Image marketing par section'],
                    ['📊', 'Infographie avantages'],
                    ['❓', 'FAQ 5 questions'],
                    ['💬', 'Message WhatsApp'],
                    ['🔍', 'SEO titre + description'],
                    ['🏷️', 'Tags & catégorie']
                  ].map(([icon, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image generation toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Générer les images marketing IA</p>
                    <p className="text-xs text-gray-500">DALL-E 3 — hero + sections + infographie • +45s</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWithImages(p => !p)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${withImages ? 'bg-violet-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${withImages ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ─── LOADING PHASE ─── */}
          {phase === 'loading' && (
            <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[320px]">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-violet-600" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-base font-bold text-gray-800 mb-1">Génération en cours...</p>
                <p className="text-sm text-violet-600 min-h-[20px]">{stepLabel}</p>
              </div>

              <div className="w-full max-w-xs space-y-2">
                {STEPS.map(step => {
                  const isDone = step.id < currentStep;
                  const isActive = step.id === currentStep;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                      isActive ? 'bg-violet-50 border border-violet-200' : isDone ? 'opacity-50' : 'opacity-25'
                    }`}>
                      <span className="text-base">
                        {isDone ? '✅' : isActive ? <Loader2 className="w-4 h-4 text-violet-600 animate-spin inline" /> : step.icon}
                      </span>
                      <span className={`text-sm ${isActive ? 'font-semibold text-violet-700' : 'text-gray-600'}`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => { abortRef.current?.abort(); setPhase('input'); }}
                className="text-sm text-gray-400 hover:text-gray-600 transition mt-2"
              >
                Annuler
              </button>
            </div>
          )}

          {/* ─── PREVIEW PHASE ─── */}
          {phase === 'preview' && product && (
            <div className="p-6 space-y-5">

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                {[
                  { id: 'page', label: 'Page', icon: Package },
                  { id: 'faq', label: 'FAQ', icon: HelpCircle },
                  { id: 'marketing', label: 'Marketing', icon: Zap },
                  { id: 'images', label: 'Images', icon: Image }
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition ${
                      activeTab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab: Page */}
              {activeTab === 'page' && (
                <div className="space-y-4">
                  {/* Hero */}
                  {product.heroImage && (
                    <ImagePreview src={product.heroImage} label="Image Hero" className="w-full h-48" />
                  )}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                    {product.hook && (
                      <p className="text-sm text-violet-700 font-medium mt-1 italic">"{product.hook}"</p>
                    )}
                  </div>

                  {/* Sections */}
                  {(product.sections || []).map((section, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      {section.image && (
                        <ImagePreview src={section.image} className="w-full h-40" />
                      )}
                      <div className="p-4">
                        <h4 className="text-sm font-bold text-gray-800 mb-1">{section.title}</h4>
                        <p className="text-sm text-gray-600">{section.description}</p>
                      </div>
                    </div>
                  ))}

                  {/* Advantages infographic */}
                  {product.advantagesImage && (
                    <ImagePreview src={product.advantagesImage} label="Infographie avantages" className="w-full h-48" />
                  )}

                  {/* Pricing + SEO */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs text-emerald-600 font-medium mb-0.5">Prix suggéré</p>
                      <p className="text-base font-bold text-emerald-700">
                        {product.suggestedPrice > 0 ? `${product.suggestedPrice.toLocaleString()} FCFA` : '—'}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs text-blue-600 font-medium mb-0.5">Catégorie</p>
                      <p className="text-base font-bold text-blue-700">{product.category || '—'}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {product.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {product.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: FAQ */}
              {activeTab === 'faq' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">FAQ générée par l'IA ({(product.faq || []).length} questions)</p>
                  <FaqAccordion items={product.faq || []} />
                </div>
              )}

              {/* Tab: Marketing */}
              {activeTab === 'marketing' && (
                <div className="space-y-4">
                  {/* SEO */}
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">SEO</p>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Titre ({(product.seoTitle || '').length} chars)</p>
                        <p className="text-sm font-semibold text-gray-800">{product.seoTitle || '—'}</p>
                      </div>
                      <CopyButton text={product.seoTitle || ''} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-gray-500">Description ({(product.seoDescription || '').length} chars)</p>
                        <p className="text-sm text-gray-700">{product.seoDescription || '—'}</p>
                      </div>
                      <CopyButton text={product.seoDescription || ''} />
                    </div>
                  </div>

                  {/* WhatsApp */}
                  {product.whatsappMessage && (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" /> Message WhatsApp
                        </p>
                        <CopyButton text={product.whatsappMessage} />
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{product.whatsappMessage}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Images */}
              {activeTab === 'images' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">{(product.allImages || []).filter(Boolean).length} images générées</p>
                  <div className="grid grid-cols-2 gap-3">
                    {product.heroImage && (
                      <ImagePreview src={product.heroImage} label="Hero" className="aspect-square col-span-2" />
                    )}
                    {(product.sections || []).map((s, i) => s.image && (
                      <ImagePreview key={i} src={s.image} label={s.title} className="aspect-square" />
                    ))}
                    {product.advantagesImage && (
                      <ImagePreview src={product.advantagesImage} label="Infographie" className="aspect-square col-span-2" />
                    )}
                  </div>
                  {product.realPhotos?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Tes photos originales ({product.realPhotos.length})</p>
                      <div className="grid grid-cols-4 gap-2">
                        {product.realPhotos.map((url, i) => (
                          <ImagePreview key={i} src={url} className="aspect-square" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          {phase === 'input' && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!isValidUrl}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Générer la page produit avec l'IA
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {phase === 'preview' && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPhase('input'); setProduct(null); }}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
              >
                Recommencer
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-2 flex-grow py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-violet-700 hover:to-purple-700 transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Appliquer au formulaire
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPageGeneratorModal;
