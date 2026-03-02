import React, { useState, useRef, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image, Copy, ExternalLink, Zap, Package, ArrowRight, Star
} from 'lucide-react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://ecomcookpit-production-7a08.up.railway.app';


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
  const [inputMode, setInputMode] = useState('url'); // 'url' ou 'description'
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
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
  const isValidDescription = description.trim().length > 20 && photos.length > 0;

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

  const handleGenerate = async () => {
    // Validation selon le mode
    if (inputMode === 'url' && (!isValidUrl || photos.length === 0)) return;
    if (inputMode === 'description' && !isValidDescription) return;
    
    setPhase('loading');
    setStepLabel('Génération en cours...');
    setError('');
    setProduct(null);
    isGeneratingRef.current = true;

    const token = localStorage.getItem('ecomToken');
    const wsId = localStorage.getItem('workspaceId');

    const formData = new FormData();
    
    // Mode URL Alibaba
    if (inputMode === 'url') {
      formData.append('url', url.trim());
    }
    // Mode description directe
    else {
      formData.append('description', description.trim());
      formData.append('skipScraping', 'true');
    }
    
    formData.append('withImages', 'true');
    photos.forEach(f => formData.append('images', f));
    
    const controller = new AbortController();
    abortRef.current = controller;
    const safetyTimer = setTimeout(() => {
      controller.abort();
      setError('Timeout: La génération a pris trop de temps (5 minutes max)');
      setPhase('input');
    }, 300000);

    try {
      console.log('🚀 Starting Product Page Generation:', { url: url.trim(), photosCount: photos.length });
      
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
        let errorMessage;
        try {
          const errorData = await resp.json();
          errorMessage = errorData.message || errorData.error || `Erreur HTTP ${resp.status}`;
        } catch {
          errorMessage = `Erreur HTTP ${resp.status}: ${resp.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await resp.json();
      
      if (result.success && result.product) {
        console.log('✅ Product generated successfully');
        setProduct(result.product);
        setPhase('preview');
        setActiveTab('page');
      } else {
        throw new Error(result.message || result.error || 'Erreur: Aucun produit généré');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⚠️ Product generation aborted by user or timeout');
        if (!error.message.includes('Timeout')) {
          setError('Génération annulée');
          setPhase('input');
        }
        return;
      }
      
      console.error('❌ Product generation error:', error);
      
      // Clear, explicit error messages
      let errorMessage = error.message;
      
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = '❌ Erreur de connexion: Impossible de contacter le serveur. Vérifiez votre connexion internet.';
      } else if (error.message.includes('OpenAI')) {
        errorMessage = `❌ Erreur OpenAI: ${error.message}`;
      } else if (error.message.includes('NanoBanana')) {
        errorMessage = `❌ Erreur NanoBanana: ${error.message}`;
      } else if (error.message.includes('Scraping')) {
        errorMessage = `❌ Erreur Scraping: ${error.message}`;
      } else if (!error.message.startsWith('❌')) {
        errorMessage = `❌ ${error.message}`;
      }
      
      setError(errorMessage);
      setPhase('input');
    } finally {
      clearTimeout(safetyTimer);
      abortRef.current = null;
      isGeneratingRef.current = false;
    }
  };

  const handleApply = () => {
    if (!product) return;
    
    // Build rich HTML description with angles, images, raisons, FAQ
    let descHtml = '';
    
    // Description optimisée avec images (déjà traitée par le backend)
    if (product.description) {
      let desc = product.description
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><br/><p>')
        .replace(/\n/g, '<br/>');
      
      // Convert markdown images to HTML img tags
      desc = desc.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:8px;"/>');
      
      descHtml += `<p>${desc}</p>`;
    }
    
    // 3 Angles marketing avec affiches
    if (product.angles?.length) {
      descHtml += '<br/><p><strong>🎯 Nos promesses</strong></p>';
      product.angles.forEach(angle => {
        descHtml += `<p><strong>${angle.titre_angle}</strong><br/>${angle.message_principal}</p>`;
        if (angle.poster_url) {
          descHtml += `<img src="${angle.poster_url}" alt="${angle.titre_angle}" style="max-width:100%;height:auto;display:block;margin:10px 0;border-radius:8px;"/>`;
        }
      });
    }
    
    // Raisons d'acheter
    if (product.raisons_acheter?.length) {
      descHtml += '<br/><p><strong>✅ Pourquoi acheter ce produit ?</strong></p><ul>';
      product.raisons_acheter.forEach(r => {
        descHtml += `<li>${r}</li>`;
      });
      descHtml += '</ul>';
    }
    
    // FAQ
    if (product.faq?.length) {
      descHtml += '<br/><p><strong>❓ Questions fréquentes</strong></p>';
      product.faq.forEach(f => {
        descHtml += `<p><strong>${f.question}</strong><br/>${f.reponse}</p>`;
      });
    }
    
    // Collect all images
    const allImages = [];
    
    if (product.heroImage) {
      allImages.push({ url: product.heroImage, alt: product.title || 'Produit', order: 0 });
    }
    
    if (product.realPhotos?.length) {
      product.realPhotos.forEach((imgUrl) => {
        if (imgUrl && !allImages.find(img => img.url === imgUrl)) {
          allImages.push({ url: imgUrl, alt: product.title || 'Produit', order: allImages.length });
        }
      });
    }
    
    // Poster images from angles
    if (product.angles?.length) {
      product.angles.forEach((angle, i) => {
        if (angle.poster_url && !allImages.find(img => img.url === angle.poster_url)) {
          allImages.push({ 
            url: angle.poster_url, 
            alt: angle.titre_angle || `Affiche ${i + 1}`, 
            order: allImages.length,
            type: 'poster'
          });
        }
      });
    }
    
    onApply({
      name: product.title || '',
      description: descHtml,
      images: allImages,
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

              {/* Mode Selection Tabs */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Mode de génération
                </label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                      inputMode === 'url'
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🔗 URL Alibaba
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('description')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                      inputMode === 'description'
                        ? 'bg-white text-violet-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ✍️ Description directe
                  </button>
                </div>
              </div>

              {/* URL Input (mode URL) */}
              {inputMode === 'url' && (
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
              )}

              {/* Description Input (mode description) */}
              {inputMode === 'description' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    ✍️ Description du produit
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Décris ton produit ici... (ex: Gélules de Graviola bio, 60 capsules de 600mg, extrait naturel de feuilles de corossol, riche en antioxydants, aide à renforcer le système immunitaire...)"
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum 20 caractères • Décris les bénéfices, caractéristiques et usages du produit
                  </p>
                </div>
              )}

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
                    ['🎯', 'Titre percutant en français'],
                    ['🎨', '3 angles marketing + 3 affiches IA'],
                    ['✅', '3 raisons d\'acheter persuasives'],
                    ['❓', 'FAQ professionnelle (5 questions)'],
                    ['�', 'Description e-commerce optimisée'],
                    ['🖼️', 'Affiches publicitaires complètes']
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
            <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[400px]">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-violet-600 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-xl font-bold text-gray-900">Génération en cours...</p>
                <p className="text-sm text-gray-600">
                  L'IA analyse votre produit et génère les images marketing.<br/>
                  Cela peut prendre jusqu'à 2 minutes.
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                  <span>Scraping • Vision GPT-4o • NanoBanana IA</span>
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => { abortRef.current?.abort(); setPhase('input'); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline transition"
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
                  { id: 'affiches', label: 'Affiches', icon: Image },
                  { id: 'faq', label: 'FAQ', icon: Star },
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

              {/* Tab: Page (overview) */}
              {activeTab === 'page' && (
                <div className="space-y-4">
                  {/* Hero photo avec textes */}
                  {product.heroImage && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <ImagePreview src={product.heroImage} label="Image HERO principale" className="w-full h-52" />
                      {(product.hero_headline || product.hero_slogan || product.hero_baseline) && (
                        <div className="p-4 bg-gradient-to-br from-violet-50 to-indigo-50 border-t border-gray-200">
                          {product.hero_headline && (
                            <p className="text-sm font-bold text-gray-900 mb-1">📢 {product.hero_headline}</p>
                          )}
                          {product.hero_slogan && (
                            <p className="text-sm text-violet-700 italic mb-1">✨ {product.hero_slogan}</p>
                          )}
                          {product.hero_baseline && (
                            <p className="text-xs text-gray-600">{product.hero_baseline}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Titre */}
                  <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                  </div>

                  {/* Description */}
                  {product.description && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">� Description</p>
                        <CopyButton text={product.description} />
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{product.description?.replace(/\*\*(.+?)\*\*/g, '$1').slice(0, 500)}...</p>
                    </div>
                  )}

                  {/* 3 Angles marketing */}
                  <div>
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-3">🎯 3 ANGLES MARKETING</p>
                    {(product.angles || []).map((angle, i) => (
                      <div key={i} className="mb-3 border border-gray-100 rounded-xl overflow-hidden">
                        {angle.poster_url && (
                          <ImagePreview src={angle.poster_url} label={`Affiche ${i + 1}`} className="w-full h-40" />
                        )}
                        <div className="p-4">
                          <h4 className="text-sm font-bold text-gray-800 mb-2">{angle.titre_angle}</h4>
                          {angle.explication && (
                            <p className="text-sm text-gray-600 mb-2 leading-relaxed">{angle.explication}</p>
                          )}
                          <p className="text-sm text-violet-700 font-medium italic mb-1">📌 {angle.message_principal}</p>
                          {angle.promesse && (
                            <p className="text-xs text-gray-500 italic">💡 {angle.promesse}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Raisons d'acheter */}
                  {product.raisons_acheter?.length > 0 && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">✅ RAISONS D'ACHETER</p>
                      <div className="space-y-2">
                        {product.raisons_acheter.map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold text-sm mt-0.5">✓</span>
                            <p className="text-sm text-gray-700">{r}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Affiches publicitaires */}
              {activeTab === 'affiches' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 font-medium">3 affiches publicitaires générées par IA</p>
                  {(product.angles || []).map((angle, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      {angle.poster_url ? (
                        <div className="relative">
                          <img src={angle.poster_url} alt={angle.titre_angle} className="w-full aspect-square object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                            <p className="text-white font-bold text-sm">{angle.titre_angle}</p>
                            <p className="text-white/80 text-xs">{angle.promesse}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 text-center">
                          <Image className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-400">Affiche non générée</p>
                        </div>
                      )}
                      <div className="p-3 bg-violet-50">
                        <p className="text-xs text-violet-600 italic">{angle.message_principal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: FAQ */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  {/* FAQ */}
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">❓ FAQ — 5 QUESTIONS</p>
                    <div className="space-y-2">
                      {(product.faq || []).map((item, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-gray-50 flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-800">{item.question}</p>
                            <CopyButton text={`${item.question}\n${item.reponse}`} />
                          </div>
                          <div className="px-4 py-3">
                            <p className="text-sm text-gray-600">{item.reponse}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Raisons d'acheter */}
                  {product.raisons_acheter?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">✅ 3 RAISONS D'ACHETER</p>
                      {product.raisons_acheter.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 mb-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <span className="text-emerald-500 font-bold">{i + 1}.</span>
                          <div className="flex-1 flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700">{r}</p>
                            <CopyButton text={r} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Photos */}
              {activeTab === 'images' && (
                <div className="space-y-4">
                  {/* Photos réelles */}
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">{(product.realPhotos || []).length} photos réelles uploadées</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(product.realPhotos || []).map((imgUrl, i) => (
                        <ImagePreview
                          key={i}
                          src={imgUrl}
                          label={i === 0 ? 'Photo principale' : `Photo ${i + 1}`}
                          className="aspect-square"
                        />
                      ))}
                    </div>
                  </div>
                  {/* Affiches générées */}
                  {(product.angles || []).some(a => a.poster_url) && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Affiches publicitaires IA</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(product.angles || []).filter(a => a.poster_url).map((angle, i) => (
                          <ImagePreview
                            key={i}
                            src={angle.poster_url}
                            label={angle.titre_angle}
                            className="aspect-square"
                          />
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
              disabled={inputMode === 'url' ? !isValidUrl || photos.length === 0 : !isValidDescription}
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
