import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Crown,
  FileText,
  Image as ImageIcon,
  Loader2,
  Palette,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import DigitalProductEbookModal from './DigitalProductEbookModal.jsx';

const API_ORIGIN = (() => {
  const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();

  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }

  if (raw) {
    if (/^https?:\/\//i.test(raw)) {
      try {
        return new URL(raw).origin;
      } catch {
        return 'https://api.scalor.net';
      }
    }
    if (raw.startsWith('/') && typeof window !== 'undefined') return window.location.origin;
  }

  return import.meta.env.DEV ? '' : 'https://api.scalor.net';
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
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const baseName = file.name.replace(/\.[^.]+$/, '') || `premium-${Date.now()}`;
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

const getImageUrl = (item) => (typeof item === 'string' ? item : item?.url) || '';

const collectPremiumImageUrls = (product = {}) => {
  const premiumImages = product.premiumImages || {};
  const urls = [
    premiumImages.hero,
    product.heroImage,
    ...(product.realPhotos || []),
    premiumImages.problem,
    premiumImages.mechanism,
    premiumImages.science,
    premiumImages.ritual,
    premiumImages.closing,
    ...((premiumImages.testimonials || []).map((entry) => entry?.url)),
  ].map(getImageUrl).filter(Boolean);

  return [...new Set(urls)];
};

const textValue = (value, fallback = '') => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || fallback;

function PremiumPreview({ product, accent }) {
  const premium = product?.premium_page || {};
  const images = collectPremiumImageUrls(product);
  const heroBenefits = Array.isArray(premium.hero?.benefits) && premium.hero.benefits.length
    ? premium.hero.benefits
    : (product?.benefits_bullets || []).slice(0, 4);
  const testimonials = Array.isArray(premium.testimonialGallery?.items) ? premium.testimonialGallery.items : [];
  const sections = [
    premium.problemSection?.headline,
    premium.mechanismSection?.headline,
    premium.scienceSection?.headline,
    premium.ritualSection?.headline,
    premium.closingSection?.headline,
  ].filter(Boolean);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-7">
        <div className="rounded-2xl bg-slate-50 aspect-square overflow-hidden flex items-center justify-center">
          {images[0] ? (
            <img src={images[0]} alt={product?.title || 'Page premium'} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-12 w-12 text-slate-300" />
          )}
        </div>
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-700">
            <Crown className="h-3.5 w-3.5" />
            Page produit premium
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">{textValue(premium.rating?.score, '4,9/5')} par {textValue(premium.rating?.count, '+1 000')} clients</p>
            <h2 className="mt-3 text-2xl font-black uppercase leading-tight text-slate-950 lg:text-4xl">
              {textValue(premium.hero?.headline, product?.hero_headline || product?.title)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{textValue(premium.hero?.subheadline, product?.hero_slogan)}</p>
          </div>
          <div className="grid gap-2">
            {heroBenefits.slice(0, 4).map((benefit, index) => (
              <div key={index} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                </span>
                <span>{textValue(benefit)}</span>
              </div>
            ))}
          </div>
          <button type="button" className="w-full rounded-2xl px-5 py-4 text-sm font-black text-white shadow-sm" style={{ backgroundColor: accent }}>
            {textValue(premium.hero?.ctaLabel, 'Commander')}
          </button>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 p-5">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Structure générée</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700">
              {section}
            </div>
          ))}
        </div>
        {testimonials.length > 0 && (
          <p className="mt-4 text-sm text-slate-500">{testimonials.length} témoignage{testimonials.length > 1 ? 's' : ''} premium intégré{testimonials.length > 1 ? 's' : ''}.</p>
        )}
      </div>
    </div>
  );
}

const PremiumProductPageGeneratorModal = ({ onClose, onApply, pageMode = false, initialTaskId = null }) => {
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const [phase, setPhase] = useState(initialTaskId ? 'loading' : 'input');
  const [inputMode, setInputMode] = useState('url');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [themeColor, setThemeColor] = useState('#0F766E');
  const [targetGender, setTargetGender] = useState('auto');
  const [targetProfile, setTargetProfile] = useState('premium');
  const [mainProblem, setMainProblem] = useState('');
  const [creditsInfo, setCreditsInfo] = useState(null);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imageJobId, setImageJobId] = useState(null);
  const [currentTaskId, setCurrentTaskId] = useState(initialTaskId);
  const [digitalProductLoading, setDigitalProductLoading] = useState(false);
  const [showDigitalProductModal, setShowDigitalProductModal] = useState(false);
  const [digitalProductError, setDigitalProductError] = useState('');
  const [digitalProductResult, setDigitalProductResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [stepLabel, setStepLabel] = useState(initialTaskId ? 'Chargement de la génération premium...' : '');

  const getWsId = () => {
    try {
      const ws = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      return ws?._id || ws?.id || '';
    } catch {
      return '';
    }
  };

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('ecomToken');
    const wsId = getWsId();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
    };
  }, []);

  const isUrlValid = url.trim().length > 10 && /^https?:\/\//i.test(url.trim());
  const isDescriptionValid = description.trim().length >= 20;
  const canGenerate = photos.length > 0 && (inputMode === 'url' ? isUrlValid : isDescriptionValid);
  const hasNoCredits = creditsInfo !== null && Number(creditsInfo.remaining || 0) <= 0;

  const photoPreviews = useMemo(() => photos.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  })), [photos]);

  useEffect(() => () => {
    photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [photoPreviews]);

  const fetchCredits = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers.Authorization) return;
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && data.generations) setCreditsInfo(data.generations);
    } catch {
      // Silent; backend will still enforce credits.
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  const addPhotos = async (files) => {
    const incoming = Array.from(files || []).filter((file) => file.type.startsWith('image/')).slice(0, 8);
    if (!incoming.length) return;
    const compressed = await Promise.all(incoming.map(compressImageFile));
    setPhotos((current) => [...current, ...compressed].slice(0, 8));
  };

  const handleLoadTask = useCallback(async (taskId) => {
    try {
      setPhase('loading');
      setStepLabel('Chargement de la génération premium...');
      setProgress(20);
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Génération introuvable');
      const data = await response.json();
      const loaded = data.task?.product;
      const isPremium = loaded?.pageStyle === 'premium'
        || loaded?.layout === 'premium_product_page'
        || loaded?.theme === 'premium_product'
        || loaded?.premium_page;
      if (!data.success || !loaded || !isPremium) throw new Error('Cette génération n’est pas une page premium');

      setProduct(loaded);
      setCurrentTaskId(taskId);
      if (data.task.status === 'generating_images' && data.task.imageJobId) {
        setImageJobId(data.task.imageJobId);
        setProgress(data.task.progressPercent || 45);
        setStepLabel(data.task.currentStep || 'Génération des images premium...');
      } else {
        setProgress(100);
        setPhase('preview');
        setStepLabel('');
      }
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger cette page premium');
      setPhase('input');
      setStepLabel('');
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (initialTaskId) handleLoadTask(initialTaskId);
  }, [handleLoadTask, initialTaskId]);

  useEffect(() => {
    if (!imageJobId || phase !== 'loading') return undefined;
    let cancelled = false;
    const pollStartedAt = Date.now();

    const mergeGeneratedImages = (images = {}) => {
      setProduct((current) => {
        if (!current) return current;
        return {
          ...current,
          ...images,
          premiumImages: {
            ...(current.premiumImages || {}),
            ...(images.premiumImages || {}),
          },
          heroImage: images.premiumImages?.hero || images.heroImage || current.heroImage,
        };
      });
    };

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - pollStartedAt > 12 * 60 * 1000) {
        setNotice('Les images premium prennent plus de temps que prévu. Le contenu est sauvegardé dans les générations.');
        setPhase('preview');
        return;
      }

      try {
        const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/images/${imageJobId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          setTimeout(poll, 3500);
          return;
        }
        const data = await response.json();
        if (cancelled) return;
        if (data.images) mergeGeneratedImages(data.images);
        if (data.total > 0) setProgress(Math.min(98, 45 + Math.round((data.progress / data.total) * 50)));
        setStepLabel(data.errorMessage || 'Génération des images premium...');

        if (['done', 'partial_failure', 'error', 'not_found'].includes(data.status)) {
          if (data.status !== 'done' && data.errorMessage) setNotice(data.errorMessage);
          setProgress(100);
          setPhase('preview');
          setImageJobId(null);
          return;
        }

        setTimeout(poll, 3500);
      } catch {
        if (!cancelled) setTimeout(poll, 4500);
      }
    };

    const timer = setTimeout(poll, 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [getAuthHeaders, imageJobId, phase]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    if (hasNoCredits) {
      setError('Tu n’as plus de crédits pour générer une page premium.');
      return;
    }

    setError('');
    setNotice('');
    setProduct(null);
    setPhase('loading');
    setProgress(8);
    setStepLabel('Préparation du système premium...');

    const formData = new FormData();
    if (inputMode === 'url') {
      formData.append('url', url.trim());
    } else {
      formData.append('description', description.trim());
      formData.append('skipScraping', 'true');
    }
    formData.append('withImages', 'true');
    formData.append('themeColor', themeColor);
    formData.append('tone', 'premium');
    formData.append('language', 'français');
    formData.append('targetGender', targetGender);
    formData.append('targetProfile', targetProfile);
    if (mainProblem.trim()) formData.append('mainProblem', mainProblem.trim());
    photos.forEach((photo) => formData.append('images', photo));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setProgress(18);
      setStepLabel('Analyse du produit et génération de la structure premium...');
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/premium`, {
        method: 'POST',
        signal: controller.signal,
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.limitReached) {
          setCreditsInfo({
            remaining: 0,
            totalUsed: data.totalGenerations || 0,
          });
        }
        throw new Error(data?.message || data?.error || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.product) throw new Error('Réponse premium invalide');

      setProduct(data.product);
      if (data.generations) setCreditsInfo(data.generations);
      if (data.taskId) setCurrentTaskId(data.taskId);
      if (data.imageJobId) {
        setImageJobId(data.imageJobId);
        setProgress(45);
        setStepLabel('Génération des visuels premium...');
      } else {
        setProgress(100);
        setPhase('preview');
      }
    } catch (generateError) {
      if (generateError.name === 'AbortError') return;
      setError(generateError.message || 'Erreur lors de la génération premium');
      setPhase('input');
      setProgress(0);
      setStepLabel('');
    } finally {
      abortRef.current = null;
    }
  };

  const openDigitalProductModal = () => {
    if (!currentTaskId) {
      setError('Recharge cette génération depuis le Studio pour créer le produit digital.');
      return;
    }
    setDigitalProductError('');
    setDigitalProductResult(null);
    setShowDigitalProductModal(true);
  };

  const handleGenerateDigitalProduct = async (brief = {}) => {
    if (!currentTaskId) {
      setDigitalProductError('Recharge cette génération depuis le Studio pour créer le produit digital.');
      return;
    }

    setDigitalProductLoading(true);
    setNotice('');
    setDigitalProductError('');
    setDigitalProductResult(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${currentTaskId}/digital-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ brief }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Impossible de générer le produit digital');
      }
      setProduct((current) => data.product || {
        ...(current || {}),
        ebook: data.ebook,
        digitalProduct: data.digitalProduct || current?.digitalProduct,
      });
      setDigitalProductResult({
        ebook: data.ebook,
        digitalProduct: data.digitalProduct,
        pdf: data.ebook?.pdf,
      });
      setNotice('Produit digital généré et ajouté à cette page premium.');
    } catch (digitalError) {
      setDigitalProductError(digitalError.message || 'Erreur lors de la génération du produit digital');
    } finally {
      setDigitalProductLoading(false);
    }
  };

  const handleApply = () => {
    if (!product) return;
    const premium = product.premium_page || {};
    const images = collectPremiumImageUrls(product).map((imageUrl, index) => ({
      url: imageUrl,
      alt: `${product.title || 'Produit premium'} ${index + 1}`,
      order: index,
      type: index === 0 ? 'hero' : 'premium-section',
    }));

    onApply({
      name: product.title || premium.brandName || '',
      description: product.hero_slogan || premium.hero?.subheadline || '',
      images,
      currency: product.currency || '',
      targetMarket: product.targetMarket || product.country || '',
      country: product.country || '',
      city: product.city || '',
      locale: product.locale || '',
      productPageConfig: {
        theme: 'premium_product',
        pageStyle: 'premium',
        premiumPage: premium,
        premiumImages: product.premiumImages || {},
        ...(product.productPageConfig?.conversion ? { conversion: product.productPageConfig.conversion } : {}),
        design: {
          buttonColor: themeColor,
          ctaButtonColor: themeColor,
          badgeColor: themeColor,
          backgroundColor: '#EFF8F7',
          textColor: '#111827',
          fieldTextColor: '#111827',
          fieldBgColor: '#FFFFFF',
        },
        button: {
          text: premium.hero?.ctaLabel || product.hero_cta || 'Commander',
        },
      },
      _pageData: {
        ...product,
        pageStyle: 'premium',
        layout: 'premium_product_page',
        theme: 'premium_product',
      },
    });
  };

  const content = (
    <>
    <div className={pageMode ? 'min-h-screen bg-slate-50' : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4'}>
      <div className={pageMode ? 'min-h-screen bg-slate-50' : 'max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-slate-50 shadow-2xl'}>
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Fermer">
                {pageMode ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-950">Générateur page produit premium</h1>
                <p className="text-xs font-medium text-slate-500">Système séparé : hero split, preuves, problème, science, rituel, comparaison.</p>
              </div>
            </div>
            {creditsInfo && (
              <div className="hidden rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-right sm:block">
                <p className="text-xs font-black text-amber-700">{creditsInfo.remaining || 0} crédit{(creditsInfo.remaining || 0) > 1 ? 's' : ''}</p>
                <p className="text-[11px] text-amber-600">disponible{(creditsInfo.remaining || 0) > 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </div>

        <div className={pageMode ? 'mx-auto max-w-6xl px-4 py-6' : 'max-h-[calc(92vh-76px)] overflow-y-auto p-5'}>
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {phase === 'input' && (
            <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-black text-slate-950">Source produit</h2>
                  </div>
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                    {[
                      ['url', 'URL produit'],
                      ['description', 'Description'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setInputMode(mode)}
                        className={`rounded-xl px-3 py-2 text-sm font-bold transition ${inputMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {inputMode === 'url' ? (
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Lien de la page produit</span>
                      <input
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://..."
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      />
                    </label>
                  ) : (
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Description du produit</span>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={6}
                        placeholder="Nom, promesse, utilisation, prix, bénéfices..."
                        className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                      />
                    </label>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Palette className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-black text-slate-950">Direction premium</h2>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Couleur accent</span>
                    <div className="mt-2 flex items-center gap-3">
                      <input type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} className="h-11 w-14 rounded-xl border border-slate-200 bg-white p-1" />
                      <input value={themeColor} onChange={(event) => setThemeColor(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold uppercase outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
                    </div>
                  </label>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Cible</span>
                      <select value={targetGender} onChange={(event) => setTargetGender(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-400">
                        <option value="auto">Auto</option>
                        <option value="female">Femme</option>
                        <option value="male">Homme</option>
                        <option value="mixed">Mixte</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Profil</span>
                      <select value={targetProfile} onChange={(event) => setTargetProfile(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-slate-400">
                        <option value="premium">Client premium</option>
                        <option value="general">Grand public</option>
                        <option value="urban_active">Actif urbain</option>
                        <option value="professional">Professionnel</option>
                        <option value="parent">Parent</option>
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Problème principal à traiter</span>
                    <input
                      value={mainProblem}
                      onChange={(event) => setMainProblem(event.target.value)}
                      placeholder="Ex: mauvaise haleine persistante, peau sèche, douleurs, manque de temps..."
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                      <h2 className="text-sm font-black text-slate-950">Photos produit</h2>
                    </div>
                    <span className="text-xs font-bold text-slate-400">{photos.length}/8</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => addPhotos(event.target.files)} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => { event.preventDefault(); setDragOver(false); addPhotos(event.dataTransfer.files); }}
                    className={`flex min-h-[180px] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-8 text-center transition ${dragOver ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="mt-3 text-sm font-black text-slate-900">Ajouter les photos qui serviront de référence</span>
                    <span className="mt-1 text-xs font-medium text-slate-500">Le premium utilise ces images pour le hero, les sections et les témoignages.</span>
                  </button>

                  {photoPreviews.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {photoPreviews.map((preview, index) => (
                        <div key={`${preview.file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                          <img src={preview.url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 opacity-0 shadow-sm transition group-hover:opacity-100"
                            aria-label="Retirer la photo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black text-slate-950">Ce système va générer</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {['Hero split premium', 'Bande de preuves', 'Galerie témoignages', 'Section problème', 'Cause / mécanisme', 'Science / formule', 'Résultats + rituel', 'Comparaison + closing'].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700">
                        <CheckCircle className="h-4 w-4" style={{ color: themeColor }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Wand2 className="h-4 w-4" />
                  Générer la page produit premium
                </button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex min-h-[520px] items-center justify-center">
              <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
                <h2 className="mt-5 text-xl font-black text-slate-950">Construction de la page premium</h2>
                <p className="mt-2 text-sm font-medium text-slate-500">{stepLabel || 'Génération en cours...'}</p>
                <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: themeColor }} />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-400">{Math.round(progress)}%</p>
              </div>
            </div>
          )}

          {phase === 'preview' && product && (
            <div className="space-y-5">
              <PremiumPreview product={product} accent={themeColor} />
              <div className="flex flex-col gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-950">Produit digital lié</p>
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    {product?.ebook ? 'Un ebook est déjà attaché à cette page premium.' : 'Génère l’ebook uniquement après la page premium.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openDigitalProductModal}
                  disabled={digitalProductLoading || !currentTaskId}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {digitalProductLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Produit digital de ce produit
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setPhase('input')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Modifier la source
                </button>
                {currentTaskId && (
                  <button type="button" onClick={() => handleLoadTask(currentTaskId)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    Recharger
                  </button>
                )}
                <button type="button" onClick={handleApply} className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-sm" style={{ backgroundColor: themeColor }}>
                  Utiliser cette page premium
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
      <DigitalProductEbookModal
        open={showDigitalProductModal}
        productName={product?.title || product?.name || ''}
        existingEbook={product?.ebook || null}
        loading={digitalProductLoading}
        error={digitalProductError}
        generatedResult={digitalProductResult}
        onClose={() => {
          if (!digitalProductLoading) {
            setShowDigitalProductModal(false);
            setDigitalProductResult(null);
          }
        }}
        onGenerate={handleGenerateDigitalProduct}
        onRegenerate={() => setDigitalProductResult(null)}
      />
    </>
  );

  return content;
};

export default PremiumProductPageGeneratorModal;
