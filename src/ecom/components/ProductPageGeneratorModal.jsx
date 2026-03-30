import React, { useState, useRef, useCallback } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image as ImageIcon, Copy, ExternalLink, Zap, Package, ArrowRight, Star
} from 'lucide-react';

// Product-generator is mounted at /api/ai/product-generator (outside /api/ecom).
// We must always use API origin only, never a base path like /api/ecom.
const API_ORIGIN = (() => {
  const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();

  // On scalor.net frontend, always target public API domain.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }

  if (raw) {
    // Absolute URL -> keep origin only.
    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).origin;
      } catch {
        // fallthrough
      }
    }

    // Relative path env like /api/ecom should NOT be reused as base here.
    if (raw.startsWith('/')) {
      if (typeof window !== 'undefined') return window.location.origin;
      return 'https://api.scalor.net';
    }
  }

  return 'https://api.scalor.net';
})();

async function compressImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, '') || `image-${Date.now()}`;
          resolve(new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() }));
        }, 'image/webp', 0.82);
      };

      img.onerror = () => resolve(file);
      img.src = reader.result;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

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
        <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-40" />
        <p className="text-xs">Image non disponible</p>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className={`relative rounded-xl overflow-hidden bg-gray-100 border border-gray-200 ${className}`}>
        <img src={src} alt={label || 'Product image'} className="w-full h-full object-cover" />
      </div>
      {label && <p className="text-xs font-medium text-gray-500 px-1">{label}</p>}
    </div>
  );
}

const ProductPageGeneratorModal = ({ onClose, onApply }) => {
  const [phase, setPhase] = useState('input');
  const [inputMode, setInputMode] = useState('url'); // 'url' ou 'description'
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [marketingApproach, setMarketingApproach] = useState('AIDA'); // AIDA, PAS, BAB, FAB
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

  const addPhotos = useCallback(async (files) => {
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 8);
    const optimized = await Promise.all(imgs.map((file) => compressImageFile(file)));
    setPhotos(prev => {
      const combined = [...prev, ...optimized];
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
    formData.append('marketingApproach', marketingApproach);
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
      
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator`, {
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
    
    // Build rich HTML description: 4 angles (H3 + desc + image) → testimonials → FAQ
    let descHtml = '';

    // ── Intro description (courte, sans images markdown) ─────────────────────

    // ── 4 Arguments marketing : H3 gras + description 3-4 lignes + image ─────
    if (product.angles?.length) {
      descHtml += `<div style="margin:32px 0;">`;
      product.angles.slice(0, 4).forEach((angle, idx) => {
        descHtml += `<div style="margin-bottom:40px;padding-bottom:40px;${idx < product.angles.length - 1 ? 'border-bottom:1px solid #f0f0f0;' : ''}">`;
        // H3 bold title
        descHtml += `<h3 style="font-size:20px;font-weight:800;color:#111;margin:0 0 12px;line-height:1.3;"><strong>${angle.titre_angle}</strong></h3>`;
        // 3-4 line description
        const explication = angle.explication || angle.message_principal || '';
        if (explication) {
          descHtml += `<p style="font-size:15px;line-height:1.75;color:#555;margin:0 0 16px;">${explication}</p>`;
        }
        // Image
        if (angle.poster_url) {
          descHtml += `<img src="${angle.poster_url}" alt="${angle.titre_angle}" style="width:100%;aspect-ratio:1 / 1;object-fit:cover;display:block;margin:0;"/>`;
        }
        descHtml += `</div>`;
      });
      descHtml += `</div>`;
    }

    // ── Témoignages clients avec étoiles ──────────────────────────────────────
    if (product.testimonials?.length) {
      const stars = (n) => '★'.repeat(Math.min(5, Math.max(0, n))) + '☆'.repeat(5 - Math.min(5, Math.max(0, n)));
      descHtml += `<div style="margin:48px 0;padding:32px;background:#fafafa;border-radius:20px;border:1px solid #f0f0f0;">`;
      descHtml += `<h3 style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;text-align:center;"><strong>⭐ Ce que disent nos clients</strong></h3>`;
      descHtml += `<p style="text-align:center;color:#888;font-size:13px;margin:0 0 28px;">Avis vérifiés de clients satisfaits</p>`;
      descHtml += `<div class="ai-desc-testimonials" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">`;
      product.testimonials.forEach(t => {
        descHtml += `<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #f0f0f0;">`;
        descHtml += `<div style="color:#FFB800;font-size:18px;letter-spacing:2px;margin-bottom:10px;">${stars(t.rating || 5)}</div>`;
        descHtml += `<p style="font-style:italic;color:#333;font-size:14px;line-height:1.65;margin:0 0 14px;">"${t.text}"</p>`;
        descHtml += `<div style="display:flex;align-items:center;gap:8px;">`;
        descHtml += `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">${(t.name || 'A')[0]}</div>`;
        descHtml += `<div><p style="margin:0;font-weight:700;font-size:13px;color:#111;">${t.name}</p>`;
        descHtml += `<p style="margin:0;font-size:11px;color:#888;">${t.location} ${t.verified ? '· ✅ Achat vérifié' : ''} · ${t.date || ''}</p></div>`;
        descHtml += `</div></div>`;
      });
      descHtml += `</div></div>`;
    }

    // ── Raisons d'acheter ──────────────────────────────────────────────────────
    if (product.raisons_acheter?.length) {
      descHtml += `<div style="margin:32px 0;padding:24px;background:#f0fdf4;border-radius:16px;border:1px solid #bbf7d0;">`;
      descHtml += `<h3 style="font-size:18px;font-weight:800;color:#166534;margin:0 0 16px;"><strong>✅ Pourquoi choisir ce produit ?</strong></h3>`;
      descHtml += `<ul style="margin:0;padding:0;list-style:none;">`;
      product.raisons_acheter.forEach(r => {
        descHtml += `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:#166534;"><span style="margin-top:2px;flex-shrink:0;">✓</span><span>${r}</span></li>`;
      });
      descHtml += `</ul></div>`;
    }

    // ── Guide d'utilisation (si applicable) ───────────────────────────────────
    if (product.guide_utilisation?.applicable !== false && product.guide_utilisation?.etapes?.length) {
      const g = product.guide_utilisation;
      descHtml += `<div style="margin:40px 0;padding:28px;background:linear-gradient(135deg,#eff6ff,#e0f2fe);border-radius:20px;border:1px solid #bae6fd;">`;
      descHtml += `<h3 style="font-size:20px;font-weight:800;color:#0369a1;margin:0 0 20px;"><strong>📋 ${g.titre || 'Comment utiliser ce produit'}</strong></h3>`;
      descHtml += `<div style="display:flex;flex-direction:column;gap:14px;">`;
      g.etapes.forEach((e) => {
        descHtml += `<div style="display:flex;align-items:flex-start;gap:14px;">`;
        descHtml += `<div style="min-width:32px;height:32px;border-radius:50%;background:#0369a1;color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${e.numero}</div>`;
        descHtml += `<div><p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#0c4a6e;">${e.action}</p>`;
        if (e.detail) descHtml += `<p style="margin:0;font-size:13px;color:#0369a1;line-height:1.5;">${e.detail}</p>`;
        descHtml += `</div></div>`;
      });
      descHtml += `</div></div>`;
    }

    // ── Garantie / Réassurance ─────────────────────────────────────────────────
    if (product.reassurance?.titre) {
      const r = product.reassurance;
      descHtml += `<div style="margin:40px 0;padding:28px;background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:20px;border:1px solid #fde68a;">`;
      descHtml += `<h3 style="font-size:20px;font-weight:800;color:#92400e;margin:0 0 12px;"><strong>🛡️ ${r.titre}</strong></h3>`;
      if (r.texte) descHtml += `<p style="font-size:15px;color:#78350f;line-height:1.7;margin:0 0 16px;">${r.texte}</p>`;
      if (r.points?.length) {
        descHtml += `<ul style="margin:0;padding:0;list-style:none;">`;
        r.points.forEach(p => {
          descHtml += `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:14px;color:#78350f;font-weight:600;"><span style="flex-shrink:0;">✅</span><span>${p}</span></li>`;
        });
        descHtml += `</ul>`;
      }
      descHtml += `</div>`;
    }
    
    // Collect all images - CORRECTED: Include ALL generated images in gallery
    const allImages = [];
    
    // 1. Hero image - always first if available
    if (product.heroImage) {
      allImages.push({ url: product.heroImage, alt: product.title || 'Image Hero principale', order: 0 });
    }

    // 2. Before/After image - second if available  
    if (product.beforeAfterImage) {
      allImages.push({ url: product.beforeAfterImage, alt: 'Avant / Après - Résultats visibles', order: 1, type: 'before-after' });
    }
    
    // 3. Real photos uploaded by user
    if (product.realPhotos?.length) {
      product.realPhotos.forEach((imgUrl, i) => {
        if (imgUrl && !allImages.find(img => img.url === imgUrl)) {
          allImages.push({ 
            url: imgUrl, 
            alt: product.title || `Photo réelle ${i + 1}`, 
            order: allImages.length,
            type: 'real-photo'
          });
        }
      });
    }
    
    // 4. IMPORTANT: All 4 marketing posters from angles - THESE ARE THE MISSING IMAGES
    if (product.angles?.length) {
      product.angles.forEach((angle, i) => {
        if (angle.poster_url && !allImages.find(img => img.url === angle.poster_url)) {
          allImages.push({ 
            url: angle.poster_url, 
            alt: angle.titre_angle || `Affiche marketing ${i + 1}`, 
            order: allImages.length,
            type: 'marketing-poster'
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

              {/* Marketing Approach Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎯 Approche marketing
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'AIDA', label: 'AIDA', desc: 'Attention → Intérêt → Désir → Action' },
                    { value: 'PAS', label: 'PAS', desc: 'Problème → Agitation → Solution' },
                    { value: 'BAB', label: 'BAB', desc: 'Avant → Après → Pont' },
                    { value: 'FAB', label: 'FAB', desc: 'Caractéristiques → Avantages → Bénéfices' }
                  ].map(approach => (
                    <button
                      key={approach.value}
                      type="button"
                      onClick={() => setMarketingApproach(approach.value)}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        marketingApproach === approach.value
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 hover:border-violet-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${
                          marketingApproach === approach.value ? 'text-violet-700' : 'text-gray-900'
                        }`}>
                          {approach.label}
                        </span>
                        {marketingApproach === approach.value && (
                          <CheckCircle className="w-4 h-4 text-violet-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-tight">{approach.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* What gets generated */}
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                <p className="text-xs font-bold text-violet-700 mb-3 uppercase tracking-wide">CE QUI SERA GÉNÉRÉ</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  {[
                    ['🎯', 'Titre percutant en français'],
                    ['🎨', '4 arguments marketing + 4 affiches IA'],
                    ['✅', '3 raisons d\'acheter persuasives'],
                    ['❓', 'FAQ professionnelle (5 questions)'],
                    ['📝', 'Description e-commerce optimisée'],
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
                  { id: 'faq', label: 'FAQ + Avis', icon: Star },
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
                      <ImagePreview src={product.heroImage} label="Image HERO principale" className="w-full aspect-square" />
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

                  {/* Benefits Bullets */}
                  {product.benefits_bullets?.length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">💥 BÉNÉFICES ({product.benefits_bullets.length})</p>
                      <div className="space-y-2">
                        {product.benefits_bullets.map((benefit, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-base flex-shrink-0">{benefit.match(/^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u)?.[0] || '✅'}</span>
                            <span>{benefit.replace(/^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]\s*/u, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Urgency Elements */}
                  {product.urgency_elements && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">⚡ URGENCE PSYCHOLOGIQUE</p>
                      <div className="space-y-2 text-sm">
                        {product.urgency_elements.stock_limited && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span>📦</span>
                            <span>Stock limité activé</span>
                          </div>
                        )}
                        {product.urgency_elements.social_proof_count && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span>⭐</span>
                            <span>{product.urgency_elements.social_proof_count}</span>
                          </div>
                        )}
                        {product.urgency_elements.quick_result && (
                          <div className="flex items-center gap-2 text-amber-800">
                            <span>⏱️</span>
                            <span>{product.urgency_elements.quick_result}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Conversion Blocks */}
                  {product.conversion_blocks?.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">🔥 BLOCS CONVERSION ({product.conversion_blocks.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {product.conversion_blocks.map((block, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-100">
                            <span className="text-lg">{block.icon}</span>
                            <span className="text-xs font-medium text-gray-700">{block.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4 Angles marketing */}
                  <div>
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-3">🎯 4 ARGUMENTS MARKETING</p>
                    {(product.angles || []).map((angle, i) => (
                      <div key={i} className="mb-3 border border-gray-100 rounded-xl overflow-hidden">
                        {angle.poster_url && (
                          <ImagePreview src={angle.poster_url} label={`Visuel angle ${i + 1}`} className="w-full aspect-square" />
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
                  <p className="text-xs text-gray-500 font-medium">4 visuels d'angles marketing, simples et sans surcharge de texte</p>
                  {(product.angles || []).map((angle, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                      {angle.poster_url ? (
                        <div className="bg-gray-50">
                          <img src={angle.poster_url} alt={angle.titre_angle} className="w-full aspect-square object-cover" />
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 text-center">
                          <Image className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-xs text-gray-400">Affiche non générée</p>
                        </div>
                      )}
                      <div className="p-3 bg-violet-50">
                        <p className="text-sm font-semibold text-gray-800 mb-1">{angle.titre_angle}</p>
                        <p className="text-xs text-violet-600 italic">{angle.message_principal}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: FAQ + Avis */}
              {activeTab === 'faq' && (
                <div className="space-y-4">
                  {/* Témoignages */}
                  {product.testimonials?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">⭐ {product.testimonials.length} TÉMOIGNAGES CLIENTS</p>
                      <div className="space-y-2">
                        {product.testimonials.map((t, i) => (
                          <div key={i} className="border border-amber-100 rounded-xl p-3 bg-amber-50">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-amber-400 text-sm">{'★'.repeat(t.rating || 5)}</span>
                              <span className="text-xs font-bold text-gray-700">{t.name}</span>
                              <span className="text-xs text-gray-400">{t.location}</span>
                              {t.verified && <span className="text-xs text-emerald-600">✅</span>}
                            </div>
                            <p className="text-sm text-gray-600 italic">&ldquo;{t.text}&rdquo;</p>
                            <p className="text-xs text-gray-400 mt-1">{t.date}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">✅ {product.raisons_acheter.length} RAISONS D'ACHETER</p>
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
                  {/* Visuels IA galerie principale */}
                  {(product.heroImage || product.beforeAfterImage) && (
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">🖼️ VISUELS GALERIE PRINCIPALE</p>
                      <div className="grid grid-cols-2 gap-3">
                        {product.heroImage && (
                          <div>
                            <ImagePreview src={product.heroImage} label="Hero — Showcase produit" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">1ère image galerie</p>
                          </div>
                        )}
                        {product.beforeAfterImage && (
                          <div>
                            <ImagePreview src={product.beforeAfterImage} label="Avant / Après" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">2ème image galerie</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
