import React, { useState, useRef, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image, Copy, ExternalLink, Zap, Package, ArrowRight, Star
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';

const STEPS = [
  { id: 1, icon: '🔍', label: 'Analyse de la page produit' },
  { id: 2, icon: '🧠', label: 'Copywriting IA (Scalor AI)' },
  { id: 3, icon: '📸', label: 'Sauvegarde des photos' },
  { id: 4, icon: '✅', label: 'Page prête !' }
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
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('page');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const readerRef = useRef(null);
  const isGeneratingRef = useRef(false);

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
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setPhase('loading');
    setError('');
    setCurrentStep(1);
    setStepLabel('Génération en cours...');

    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const wsId = workspace?._id || workspace?.id;

    const formData = new FormData();
    formData.append('url', url.trim());
    formData.append('withImages', 'false');
    if (wsId) formData.append('workspaceId', wsId);
    photos.forEach(f => formData.append('images', f));
    
    const controller = new AbortController();
    abortRef.current = controller;
    const safetyTimer = setTimeout(() => controller.abort(), 300000);

    try {
      console.log('Starting Product Page Generation:', { url: url.trim(), photosCount: photos.length, wsId, token: !!token });
      
      const resp = await fetch(`${BACKEND_URL}/api/ai/product-generator`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: formData
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${resp.status}: ${resp.statusText}`);
      }

      // SSE streaming
      const reader = resp.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      let productReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          
          let data;
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch (parseErr) {
            console.warn('Failed to parse SSE data:', line, parseErr);
            continue;
          }

          if (data.type === 'progress') {
            setCurrentStep(data.step || 0);
            setStepLabel(data.label || '');
          } else if (data.type === 'done') {
            productReceived = true;
            setProduct(data.product);
            setPhase('preview');
            setActiveTab('page');
            break;
          } else if (data.type === 'error') {
            throw new Error(data.message || 'Erreur inconnue du serveur');
          }
        }
      }

      if (!productReceived) {
        throw new Error('La génération s\'est interrompue sans retourner de produit. Réessayez.');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Product generation aborted');
        return;
      }
      
      console.error('Product generation error:', error);
      let errorMessage = error.message;
      if (error.message.includes('fetch')) {
        errorMessage = 'Erreur de connexion. Vérifiez votre internet et réessayez.';
      }
      
      setError(errorMessage);
      setPhase('input');
    } finally {
      clearTimeout(safetyTimer);
      try { readerRef.current?.cancel(); } catch {}
      readerRef.current = null;
      abortRef.current = null;
      isGeneratingRef.current = false;
    }
  }, [url, photos, isValidUrl]);

  const handleApply = () => {
    if (!product) return;
    const descParts = [];
    if (product.hook) descParts.push(`**${product.hook}**\n\n`);
    if (product.problem) descParts.push(`**Le problème**\n${product.problem}\n\n`);
    if (product.solution) descParts.push(`**La solution**\n${product.solution}\n\n`);
    if (product.sections?.length) {
      product.sections.forEach(s => {
        descParts.push(`**${s.title}**\n${s.description}\n\n`);
      });
    }
    if (product.howToUse) descParts.push(`**Comment utiliser**\n${product.howToUse}\n\n`);
    if (product.whyChooseUs) descParts.push(`**Pourquoi nous choisir**\n${product.whyChooseUs}\n\n`);
    onApply({
      name: product.title || '',
      description: descParts.join('').trim(),
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
                    ['🎯', 'Titre & accroche impactants'],
                    ['😩', 'Section Problème client'],
                    ['✅', 'Section Solution produit'],
                    ['📸', '4–6 sections bénéfices + photos'],
                    ['📖', 'Mode d\'utilisation'],
                    ['🏆', 'Pourquoi nous choisir'],
                    ['📣', 'Appel à l\'action final'],
                    ['🎯', 'Angle marketing Afrique']
                  ].map(([icon, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
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

              <div className="w-full max-w-sm space-y-3">
                {STEPS.map(step => {
                  const isDone = step.id < currentStep;
                  const isActive = step.id === currentStep;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isActive ? 'bg-violet-50 border-violet-200 shadow-sm' :
                        isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                        isDone ? 'bg-emerald-500 text-white' :
                        isActive ? 'bg-violet-100 border-2 border-violet-300' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isDone ? '✓' : isActive ? <Loader2 className="w-4 h-4 animate-spin text-violet-500" /> : step.id}
                      </div>
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${
                          isActive ? 'text-violet-700' : isDone ? 'text-emerald-700' : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                        {isDone && (
                          <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                            ✅ Terminé
                          </div>
                        )}
                        {isActive && (
                          <div className="text-xs text-violet-600 font-medium mt-0.5">
                            En cours...
                          </div>
                        )}
                      </div>
                      {isDone && (
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
                  { id: 'strategie', label: 'Stratégie', icon: Zap },
                  { id: 'marketing', label: 'Marketing', icon: Star },
                  { id: 'images', label: 'Photos', icon: Image }
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
                  {/* Hero photo */}
                  {product.heroImage && (
                    <ImagePreview src={product.heroImage} label="Photo principale" className="w-full h-52" />
                  )}

                  {/* Titre + Accroche */}
                  <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                    {product.hook && (
                      <p className="text-sm text-violet-700 font-medium mt-1 italic">"{product.hook}"</p>
                    )}
                  </div>

                  {/* Problème */}
                  {product.problem && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-red-600 uppercase tracking-wide">😩 Le Problème</p>
                        <CopyButton text={product.problem} />
                      </div>
                      <p className="text-sm text-gray-700">{product.problem}</p>
                    </div>
                  )}

                  {/* Solution */}
                  {product.solution && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">✅ La Solution</p>
                        <CopyButton text={product.solution} />
                      </div>
                      <p className="text-sm text-gray-700">{product.solution}</p>
                    </div>
                  )}

                  {/* Sections bénéfices */}
                  {(product.sections || []).map((section, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      {section.image && (
                        <ImagePreview src={section.image} className="w-full h-40" />
                      )}
                      <div className="p-4">
                        <h4 className="text-sm font-bold text-gray-800 mb-1">{section.title}</h4>
                        <p className="text-sm text-gray-600">{section.description}</p>
                        {section.marketingGoal && (
                          <p className="text-xs text-violet-500 mt-1 italic">🎯 {section.marketingGoal}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Comment utiliser */}
                  {product.howToUse && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide">📖 Comment utiliser</p>
                        <CopyButton text={product.howToUse} />
                      </div>
                      <p className="text-sm text-gray-700">{product.howToUse}</p>
                    </div>
                  )}

                  {/* Pourquoi nous choisir */}
                  {product.whyChooseUs && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">🏆 Pourquoi nous choisir</p>
                        <CopyButton text={product.whyChooseUs} />
                      </div>
                      <p className="text-sm text-gray-700">{product.whyChooseUs}</p>
                    </div>
                  )}

                  {/* CTA */}
                  {product.cta && (
                    <div className="p-4 bg-violet-600 rounded-xl">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">📣 {product.cta}</p>
                        <CopyButton text={product.cta} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Stratégie */}
              {activeTab === 'strategie' && (
                <div className="space-y-3">
                  {product.productUnderstanding && (
                    <>
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                        {[[
                          '👤 Client cible', product.productUnderstanding.targetCustomer
                        ],[
                          '😩 Problème résolu', product.productUnderstanding.mainProblem
                        ],[
                          '🎯 Promesse', product.productUnderstanding.mainPromise
                        ],[
                          '📣 Angle marketing', product.productUnderstanding.marketingAngle
                        ]].map(([label, value]) => value && (
                          <div key={label}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-800">{value}</p>
                              <CopyButton text={value} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab: Marketing */}
              {activeTab === 'marketing' && (
                <div className="space-y-4">
                  {product.hook && (
                    <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">💥 Accroche</p>
                        <CopyButton text={product.hook} />
                      </div>
                      <p className="text-sm text-gray-800 italic">"{product.hook}"</p>
                    </div>
                  )}
                  {product.cta && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">📣 Call to Action</p>
                        <CopyButton text={product.cta} />
                      </div>
                      <p className="text-sm text-gray-800">{product.cta}</p>
                    </div>
                  )}
                  {product.whyChooseUs && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">🏆 Argument principal</p>
                        <CopyButton text={product.whyChooseUs} />
                      </div>
                      <p className="text-sm text-gray-700">{product.whyChooseUs}</p>
                    </div>
                  )}
                  {(product.sections || []).map((s, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 mb-0.5">{s.title}</p>
                      {s.marketingGoal && <p className="text-xs text-violet-600 italic">🎯 {s.marketingGoal}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Photos */}
              {activeTab === 'images' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">{(product.realPhotos || []).length} photos utilisées</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(product.realPhotos || []).map((url, i) => (
                      <ImagePreview
                        key={i}
                        src={url}
                        label={i === 0 ? 'Photo principale' : `Photo ${i + 1}`}
                        className="aspect-square"
                      />
                    ))}
                  </div>
                  {(product.sections || []).some(s => s.image) && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Photos assignées aux sections</p>
                      <div className="space-y-2">
                        {(product.sections || []).filter(s => s.image).map((s, i) => (
                          <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <img src={s.image} alt={s.title} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                            <p className="text-xs font-medium text-gray-700">{s.title}</p>
                          </div>
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
