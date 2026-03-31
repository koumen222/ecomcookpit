import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle, Upload,
  Image as ImageIcon, Copy, ExternalLink, Zap, Package, ArrowRight, Star
} from 'lucide-react';
import TestimonialsCarousel from './TestimonialsCarousel';

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

// Typing effect component
function TypingText({ text }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(currentIndex + 1);
      }, 30); // 30ms par caractère pour effet fluide
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text]);

  useEffect(() => {
    // Reset when text changes
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  return (
    <span className="inline-block">
      {displayedText}
      <span className="inline-block w-0.5 h-4 bg-violet-600 ml-0.5 animate-pulse" />
    </span>
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
  const [generationsInfo, setGenerationsInfo] = useState(null); // { freeRemaining, paidRemaining, totalUsed }
  const [limitReached, setLimitReached] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentName, setPaymentName] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // AI Store Builder states
  const [buildStep, setBuildStep] = useState(0); // 0-4
  const [buildProgress, setBuildProgress] = useState(0); // 0-100
  const [buildMessage, setBuildMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
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

  // AI Store Builder progression
  useEffect(() => {
    if (phase !== 'loading') return;

    const steps = [
      {
        step: 0,
        title: '🔍 Analyse de votre produit en cours…',
        messages: [
          'Détection des bénéfices clés…',
          'Analyse du marché africain…',
          'Identification des angles marketing…'
        ],
        progressRange: [0, 30],
        duration: 15000 // 15s
      },
      {
        step: 1,
        title: '✍️ Génération du contenu marketing',
        messages: [
          'Création du titre accrocheur…',
          'Rédaction des bénéfices…',
          'Optimisation pour la conversion…',
          'Génération des témoignages clients…'
        ],
        progressRange: [30, 60],
        duration: 25000 // 25s
      },
      {
        step: 2,
        title: '🎨 Design de la page',
        messages: [
          'Création du design…',
          'Ajout des sections de conversion…',
          'Génération des visuels marketing…',
          'Optimisation mobile…'
        ],
        progressRange: [60, 85],
        duration: 30000 // 30s
      },
      {
        step: 3,
        title: '🚀 Finalisation',
        messages: [
          'Assemblage final…',
          'Vérification qualité…',
          'Préparation de votre page…'
        ],
        progressRange: [85, 95],
        duration: 20000 // 20s - ne va jamais à 100% pour laisser l'API finir
      }
    ];

    const currentStepData = steps[buildStep];
    if (!currentStepData) return;

    let messageIndex = 0;
    let startProgress = currentStepData.progressRange[0];
    const endProgress = currentStepData.progressRange[1];
    const progressIncrement = (endProgress - startProgress) / currentStepData.messages.length;

    // Set initial message
    setBuildMessage(currentStepData.messages[0]);
    
    const messageInterval = setInterval(() => {
      messageIndex++;
      if (messageIndex < currentStepData.messages.length) {
        setBuildMessage(currentStepData.messages[messageIndex]);
        setBuildProgress(startProgress + (progressIncrement * messageIndex));
      } else {
        clearInterval(messageInterval);
      }
    }, currentStepData.duration / currentStepData.messages.length);

    const stepTimeout = setTimeout(() => {
      if (buildStep < 3) {
        setBuildStep(buildStep + 1);
        setBuildProgress(endProgress);
      } else {
        // Dernière étape - on reste à 95% en attendant que l'API finisse
        setBuildProgress(95);
        setBuildMessage('Presque terminé...');
        // Pas de confetti ici - il apparaîtra quand l'API répondra
      }
    }, currentStepData.duration);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(stepTimeout);
    };
  }, [phase, buildStep]);

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
    setBuildStep(0);
    setBuildProgress(0);
    setBuildMessage('');
    setShowConfetti(false);
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
          
          // Gérer le cas de limite atteinte
          if (errorData.limitReached) {
            setLimitReached(true);
            setGenerationsInfo({
              freeRemaining: 0,
              paidRemaining: 0,
              totalUsed: errorData.totalGenerations || 0
            });
            setError(errorData.message || 'Limite de générations atteinte');
            setPhase('input');
            clearTimeout(safetyTimer);
            abortRef.current = null;
            isGeneratingRef.current = false;
            return;
          }
          
          errorMessage = errorData.message || errorData.error || `Erreur HTTP ${resp.status}`;
        } catch {
          errorMessage = `Erreur HTTP ${resp.status}: ${resp.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await resp.json();
      
      if (result.success && result.product) {
        console.log('✅ Product generated successfully');
        
        // Animation finale : 100% + confetti avant de montrer le résultat
        setBuildProgress(100);
        setBuildMessage('Votre page est prête ! 🎉');
        setShowConfetti(true);
        
        // Attendre 2 secondes pour que l'utilisateur voie les confettis
        setTimeout(() => {
          setShowConfetti(false);
          setProduct(result.product);
          setPhase('preview');
          setActiveTab('page');
          
          // Mettre à jour les infos de génération
          if (result.generations) {
            setGenerationsInfo(result.generations);
          }
        }, 2000);
      } else {
        throw new Error(result.message || result.error || 'Erreur: Aucun produit généré');
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⚠️ Product generation aborted by user or timeout');
        if (!error.message.includes('Timeout')) {
          setError('Génération annulée');
          setPhase('input');
          // Réinitialiser les states d'animation
          setBuildStep(0);
          setBuildProgress(0);
          setBuildMessage('');
          setShowConfetti(false);
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
      // Réinitialiser les states d'animation
      setBuildStep(0);
      setBuildProgress(0);
      setBuildMessage('');
      setShowConfetti(false);
    } finally {
      clearTimeout(safetyTimer);
      abortRef.current = null;
      isGeneratingRef.current = false;
    }
  };

  const handleBuyGeneration = async () => {
    if (!paymentPhone || paymentPhone.trim().length < 8) {
      alert('Veuillez saisir un numéro de téléphone valide');
      return;
    }
    if (!paymentName || paymentName.trim().length < 2) {
      alert('Veuillez saisir votre nom');
      return;
    }

    setPaymentLoading(true);
    
    try {
      const token = localStorage.getItem('ecomToken');
      const wsId = localStorage.getItem('workspaceId');

      const response = await fetch(`${API_ORIGIN}/api/ecom/billing/buy-generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {})
        },
        body: JSON.stringify({
          quantity: 1,
          phone: paymentPhone.trim(),
          clientName: paymentName.trim(),
          workspaceId: wsId
        })
      });

      const result = await response.json();

      if (result.success && result.paymentUrl) {
        // Ouvrir la page de paiement MoneyFusion
        window.open(result.paymentUrl, '_blank');
        
        // Fermer le modal et rafraîchir ou afficher un message
        alert('✅ Paiement initié ! Une fois le paiement confirmé, tes générations seront créditées automatiquement.');
        
        // Reset le formulaire
        setShowPaymentForm(false);
        setPaymentPhone('');
        setPaymentName('');
        setLimitReached(false);
        setError('');
      } else {
        throw new Error(result.message || 'Erreur lors de l\'initialisation du paiement');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('❌ Erreur: ' + error.message);
    } finally {
      setPaymentLoading(false);
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

    // ── Témoignages clients ───────────────────────────────────────────────────
    // NOTE: Les témoignages ne sont PAS inclus dans le HTML de description.
    // Ils sont sauvegardés dans product.testimonials et seront automatiquement
    // affichés en carrousel par StoreProductPage.jsx via VerifiedTestimonialsCarousel.
    // Cela évite d'avoir du HTML statique et permet un affichage dynamique et interactif.

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

    // 1b. Hero poster (affiche graphique) - second
    if (product.heroPosterImage) {
      allImages.push({ url: product.heroPosterImage, alt: `Affiche — ${product.title || 'Produit'}`, order: 1 });
    }

    // 2. Before/After image - third if available
    if (product.beforeAfterImage) {
      allImages.push({ url: product.beforeAfterImage, alt: 'Avant / Après - Résultats visibles', order: 2, type: 'before-after' });
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
          <div className="flex items-center gap-3">
            {/* Compteur de générations - Affichage détaillé */}
            {generationsInfo && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 shadow-sm">
                <Zap className="w-5 h-5 text-violet-600" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-violet-900">
                    {generationsInfo.freeRemaining + generationsInfo.paidRemaining} génération{(generationsInfo.freeRemaining + generationsInfo.paidRemaining) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-violet-600">
                    {generationsInfo.freeRemaining > 0 && `${generationsInfo.freeRemaining} gratuite${generationsInfo.freeRemaining > 1 ? 's' : ''}`}
                    {generationsInfo.freeRemaining > 0 && generationsInfo.paidRemaining > 0 && ' + '}
                    {generationsInfo.paidRemaining > 0 && `${generationsInfo.paidRemaining} payée${generationsInfo.paidRemaining > 1 ? 's' : ''}`}
                    {generationsInfo.freeRemaining === 0 && generationsInfo.paidRemaining === 0 && 'Épuisées'}
                  </span>
                </div>
              </div>
            )}
            <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
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
                <div className={`p-4 rounded-xl border ${
                  limitReached 
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  {limitReached ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-gray-900 mb-1">🎯 Tu as utilisé tes 3 générations gratuites !</h3>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            Pour continuer à générer des pages produit optimisées avec IA, débloque une nouvelle génération pour seulement <strong className="text-amber-700">1500 FCFA</strong>.
                          </p>
                        </div>
                      </div>
                      
                      {!showPaymentForm ? (
                        <button
                          type="button"
                          onClick={() => setShowPaymentForm(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
                        >
                          <Zap className="w-4 h-4" />
                          Débloquer une génération (1500 FCFA)
                        </button>
                      ) : (
                        <div className="space-y-3 p-4 bg-white rounded-xl border border-gray-200">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              📱 Numéro de téléphone
                            </label>
                            <input
                              type="tel"
                              value={paymentPhone}
                              onChange={(e) => setPaymentPhone(e.target.value)}
                              placeholder="Ex: 0707070707"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                              👤 Votre nom
                            </label>
                            <input
                              type="text"
                              value={paymentName}
                              onChange={(e) => setPaymentName(e.target.value)}
                              placeholder="Ex: Jean Dupont"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setShowPaymentForm(false)}
                              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition text-sm"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={handleBuyGeneration}
                              disabled={paymentLoading}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition text-sm disabled:opacity-50"
                            >
                              {paymentLoading ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Chargement...
                                </>
                              ) : (
                                <>
                                  <Zap className="w-4 h-4" />
                                  Payer 1500 FCFA
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs text-center text-gray-500">
                        Tu as déjà généré {generationsInfo?.totalUsed || 0} page{(generationsInfo?.totalUsed || 0) > 1 ? 's' : ''} produit avec succès 🎉
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── AI STORE BUILDER PHASE ─── */}
          {phase === 'loading' && (
            <div className="p-8 flex flex-col items-center justify-center gap-8 min-h-[500px] relative overflow-hidden">
              {/* Confetti effect */}
              {showConfetti && (
                <div className="absolute inset-0 pointer-events-none z-50">
                  {[...Array(50)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `-20px`,
                        animation: `fall ${1 + Math.random() * 2}s linear forwards`,
                        animationDelay: `${Math.random() * 0.5}s`
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: ['#ec4899', '#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][Math.floor(Math.random() * 6)],
                          transform: `rotate(${Math.random() * 360}deg)`
                        }}
                      />
                    </div>
                  ))}
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes fall {
                        to {
                          transform: translateY(600px) rotate(720deg);
                          opacity: 0;
                        }
                      }
                    `
                  }} />
                </div>
              )}

              {/* Main icon animation */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center relative">
                  <div className="absolute inset-0 rounded-full border-4 border-violet-300 animate-ping opacity-20" />
                  <Sparkles className="w-12 h-12 text-violet-600 animate-pulse" />
                </div>
              </div>

              {/* Step title */}
              <div className="text-center space-y-2 relative z-10">
                <h3 className="text-2xl font-black text-gray-900">
                  {[
                    '🔍 Analyse de votre produit en cours…',
                    '✍️ Génération du contenu marketing',
                    '🎨 Design de la page',
                    '🚀 Finalisation'
                  ][Math.min(buildStep, 3)] || '🚀 Finalisation'}
                </h3>
                
                {/* Typing effect message */}
                <p className="text-base text-gray-600 font-medium h-6">
                  <TypingText text={buildMessage} />
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-violet-600">Progression</span>
                  <span className="text-violet-600">{Math.round(buildProgress)}%</span>
                </div>
                <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                    style={{ width: `${buildProgress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Steps indicators */}
              <div className="flex items-center justify-center gap-3">
                {[0, 1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`flex items-center gap-2 transition-all duration-300 ${
                      step === buildStep
                        ? 'scale-110'
                        : step < buildStep
                        ? 'opacity-50'
                        : 'opacity-30'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                        step < buildStep
                          ? 'bg-emerald-500 text-white'
                          : step === buildStep
                          ? 'bg-violet-600 text-white shadow-lg'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {step < buildStep ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step + 1
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tech badges */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                <span className="font-medium">Vision GPT-4o • NanoBanana IA • Groq</span>
                <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>

              {/* Cancel button */}
              <button
                type="button"
                onClick={() => { 
                  abortRef.current?.abort(); 
                  setPhase('input');
                  setBuildStep(0);
                  setBuildProgress(0);
                  setBuildMessage('');
                  setShowConfetti(false);
                }}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition mt-4"
              >
                Annuler
              </button>
            </div>
          )}

          {/* ─── PREVIEW PHASE ─── */}
          {phase === 'preview' && product && (
            <div className="p-6 space-y-5">

              {/* Success Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-emerald-900 mb-1">
                      🎉 Génération terminée avec succès !
                    </h3>
                    <p className="text-sm text-emerald-700">
                      Voici l'aperçu de votre page produit générée par IA. Explorez les onglets ci-dessous puis cliquez sur <strong>"Appliquer"</strong> pour l'utiliser.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                {[
                  { id: 'page', label: 'Page', icon: Package },
                  { id: 'affiches', label: 'Affiches', icon: ImageIcon },
                  { id: 'faq', label: 'FAQ + Avis', icon: Star },
                  { id: 'images', label: 'Photos', icon: ImageIcon }
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

                  {/* Hero Poster (affiche graphique) */}
                  {product.heroPosterImage && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <ImagePreview src={product.heroPosterImage} label="Affiche publicitaire hero" className="w-full aspect-square" />
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-500">🎨 Visuel affiche — idéal pour publicités Facebook/Instagram</p>
                      </div>
                    </div>
                  )}

                  {/* Titre */}
                  <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{product.title}</h3>
                      <CopyButton text={product.title} />
                    </div>
                    {/* CTA + Badge urgence */}
                    {(product.hero_cta || product.urgency_badge) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.urgency_badge && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">
                            {product.urgency_badge}
                          </span>
                        )}
                        {product.hero_cta && (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full">
                            🛒 {product.hero_cta}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats Bar */}
                  {product.stats_bar?.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {product.stats_bar.map((stat, i) => (
                        <div key={i} className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                          <p className="text-xs font-bold text-indigo-700 leading-tight">{stat}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Problem / Solution */}
                  {product.problem_section && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">😤 PROBLÈME</p>
                      {product.problem_section.title && (
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-sm font-bold text-gray-900">{product.problem_section.title}</p>
                          <CopyButton text={product.problem_section.title} />
                        </div>
                      )}
                      <div className="space-y-2">
                        {(product.problem_section.pain_points || []).map((point, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-800">
                            <span className="flex-shrink-0 mt-0.5">❌</span>
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {product.solution_section && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">✅ SOLUTION</p>
                      {product.solution_section.title && (
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-bold text-gray-900">{product.solution_section.title}</p>
                          <CopyButton text={product.solution_section.title} />
                        </div>
                      )}
                      {product.solution_section.description && (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-700 leading-relaxed flex-1">{product.solution_section.description}</p>
                          <CopyButton text={product.solution_section.description} />
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Offer Block */}
                  {product.offer_block && (
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-3">🎁 OFFRE</p>
                      <div className="space-y-2">
                        {product.offer_block.offer_label && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-orange-800">{product.offer_block.offer_label}</p>
                            <CopyButton text={product.offer_block.offer_label} />
                          </div>
                        )}
                        {product.offer_block.guarantee_text && (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-gray-700 flex-1">🔒 {product.offer_block.guarantee_text}</p>
                            <CopyButton text={product.offer_block.guarantee_text} />
                          </div>
                        )}
                        {product.offer_block.countdown && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-lg text-xs text-orange-700 font-medium">
                            ⏳ Compte à rebours activé
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEO */}
                  {product.seo && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">🔍 SEO</p>
                      <div className="space-y-3">
                        {product.seo.meta_title && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Meta title ({product.seo.meta_title.length}/60)</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-800 flex-1">{product.seo.meta_title}</p>
                              <CopyButton text={product.seo.meta_title} />
                            </div>
                          </div>
                        )}
                        {product.seo.meta_description && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Meta description ({product.seo.meta_description.length}/155)</p>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm text-gray-700 flex-1">{product.seo.meta_description}</p>
                              <CopyButton text={product.seo.meta_description} />
                            </div>
                          </div>
                        )}
                        {product.seo.slug && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">URL slug</p>
                            <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
                              <code className="text-xs text-violet-700 font-mono">/products/{product.seo.slug}</code>
                              <CopyButton text={product.seo.slug} />
                            </div>
                          </div>
                        )}
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
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
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
                  {/* Témoignages en Carrousel */}
                  {product.testimonials?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-3">⭐ {product.testimonials.length} TÉMOIGNAGES CLIENTS (Carrousel)</p>
                      <div className="-mx-2">
                        <TestimonialsCarousel 
                          testimonials={product.testimonials.map(t => ({
                            name: t.name,
                            location: t.location,
                            text: t.text,
                            rating: t.rating || 5,
                            verified: t.verified !== false,
                            date: t.date
                          }))}
                          autoPlay={false}
                        />
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
                  {(product.heroImage || product.heroPosterImage || product.beforeAfterImage) && (
                    <div>
                      <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">🖼️ VISUELS GALERIE PRINCIPALE</p>
                      <div className="grid grid-cols-2 gap-3">
                        {product.heroImage && (
                          <div>
                            <ImagePreview src={product.heroImage} label="Hero — Showcase produit" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">1ère image galerie</p>
                          </div>
                        )}
                        {product.heroPosterImage && (
                          <div>
                            <ImagePreview src={product.heroPosterImage} label="Affiche Hero" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">Affiche publicitaire</p>
                          </div>
                        )}
                        {product.beforeAfterImage && (
                          <div>
                            <ImagePreview src={product.beforeAfterImage} label="Avant / Après" className="aspect-square" />
                            <p className="text-xs text-center text-gray-400 mt-1">Transformation</p>
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
            <>
              {/* Info générations restantes */}
              {generationsInfo && (
                <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-600" />
                      <span className="font-medium text-gray-700">
                        Générations restantes :
                      </span>
                    </div>
                    <div className="font-bold text-violet-700">
                      {generationsInfo.freeRemaining + generationsInfo.paidRemaining > 0 ? (
                        <>
                          {generationsInfo.freeRemaining > 0 && (
                            <span className="text-emerald-600">{generationsInfo.freeRemaining} gratuite{generationsInfo.freeRemaining > 1 ? 's' : ''}</span>
                          )}
                          {generationsInfo.freeRemaining > 0 && generationsInfo.paidRemaining > 0 && <span className="text-gray-500"> + </span>}
                          {generationsInfo.paidRemaining > 0 && (
                            <span className="text-violet-600">{generationsInfo.paidRemaining} payée{generationsInfo.paidRemaining > 1 ? 's' : ''}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-red-600">0 restante</span>
                      )}
                    </div>
                  </div>
                  {generationsInfo.totalUsed > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      🎉 Tu as déjà généré {generationsInfo.totalUsed} page{generationsInfo.totalUsed > 1 ? 's' : ''} avec succès
                    </p>
                  )}
                </div>
              )}
              
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
            </>
          )}

          {phase === 'preview' && (
            <div className="space-y-3">
              {/* Info message */}
              <div className="px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-xs text-violet-700 text-center">
                  👉 Explorez l'aperçu ci-dessus, puis cliquez sur <strong>"Utiliser cette page"</strong> pour l'ajouter à votre boutique
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPhase('input'); setProduct(null); }}
                  className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition"
                >
                  🔄 Recommencer
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-sm hover:from-emerald-600 hover:to-teal-600 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle className="w-5 h-5" />
                  ✨ Utiliser cette page
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPageGeneratorModal;
