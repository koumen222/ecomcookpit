import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, GripVertical, ImagePlus, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';

const API_ORIGIN = (() => {
  const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
    return 'https://api.scalor.net';
  }
  if (raw && /^https?:\/\//i.test(raw)) {
    try { return new URL(raw).origin; } catch { /* fallthrough */ }
  }
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://api.scalor.net';
})();

const SLIDE_CATALOG = [
  { id: 'hook', label: 'Hook / Problème', desc: 'Accroche qui stoppe le scroll en nommant la douleur' },
  { id: 'benefits', label: 'Bénéfices', desc: 'Ce que le produit apporte, en un coup d\'œil' },
  { id: 'avant_apres', label: 'Avant / Après', desc: 'Transformation split-screen' },
  { id: 'testimonials', label: 'Avis clients', desc: 'Cartes d\'avis carrées et témoignages visibles' },
  { id: 'reassurance', label: 'Réassurance / Confiance', desc: 'Preuves, garanties et éléments qui rassurent' },
  { id: 'how_to_use', label: 'Comment utiliser', desc: 'Démonstration simple d\'usage' },
  { id: 'cta_final', label: 'CTA final', desc: 'Slide de clôture qui pousse à commander' },
];

const DEFAULT_FORM = {
  headline: 'Remplissez le formulaire, on vous appelle pour valider votre commande',
  ctaLabel: 'CLIQUE POUR CONFIRMER TA COMMANDE',
  stickyLabel: 'COMMANDEZ',
  reassurance: 'Livraison gratuite et paiement après réception',
  placeholders: {
    fullname: 'Saisir votre nom complet',
    phone: 'Saisir un numero joignable',
    address: 'Saisir votre adresse',
    city: 'Saisir votre ville',
  },
};

const COLOR_PRESETS = [
  { id: 'bleu_royal',    hex: '#1E3A8A', label: 'Bleu Royal',    textColor: '#fff' },
  { id: 'vert_emeraude', hex: '#064E3B', label: 'Vert Émeraude', textColor: '#fff' },
  { id: 'or_premium',    hex: '#1C1917', label: 'Or Premium',    textColor: '#FBBF24' },
  { id: 'rose_feminin',  hex: '#831843', label: 'Rose Féminin',  textColor: '#fff' },
  { id: 'violet_luxe',   hex: '#3B0764', label: 'Violet Luxe',   textColor: '#fff' },
];

const LOADING_STEPS = ['Preparation', 'Direction visuelle', 'Generation', 'Finalisation'];

const getWorkspaceId = () => {
  const direct = String(localStorage.getItem('ecomWorkspaceId') || '').trim();
  if (direct) return direct;
  try {
    const ws = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    return ws?._id || ws?.id || '';
  } catch {
    return '';
  }
};

const getAuthHeaders = () => ({
  ...(localStorage.getItem('ecomToken') ? { Authorization: `Bearer ${localStorage.getItem('ecomToken')}` } : {}),
  ...(getWorkspaceId() ? { 'X-Workspace-Id': getWorkspaceId() } : {}),
});

const getLoadingStepIndex = (progressPercent) => {
  if (progressPercent >= 90) return 3;
  if (progressPercent >= 55) return 2;
  if (progressPercent >= 20) return 1;
  return 0;
};

const normalizeInfographicsResult = (payload, fallbackForm = DEFAULT_FORM) => {
  if (!payload) return null;
  return {
    layout: payload.layout || 'infographics',
    theme: payload.theme || 'infographics',
    pageStyle: payload.pageStyle || 'infographics',
    infographics: Array.isArray(payload.infographics) ? payload.infographics : [],
    form: payload.form || fallbackForm,
    failed: Array.isArray(payload.failed) ? payload.failed : [],
    country: payload.country || '',
    productName: payload.productName || payload.name || '',
    productDescription: payload.productDescription || '',
  };
};

const InfographicsGeneratorPanel = ({ onGenerated, onCancel, onContinueInBackground, initialResult = null, onResetPreview }) => {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [country, setCountry] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [painPoint, setPainPoint] = useState('');
  const [mainBenefit, setMainBenefit] = useState('');
  const [bodyZone, setBodyZone] = useState('');
  const [selectedSlides, setSelectedSlides] = useState(['hook', 'benefits', 'avant_apres', 'testimonials', 'reassurance', 'how_to_use', 'cta_final']);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [colorStyle, setColorStyle] = useState('bleu_royal');
  const [brandColor, setBrandColor] = useState('#1E3A8A');
  const [mode, setMode] = useState('ai'); // 'ai' | 'manual'
  const [manualSlides, setManualSlides] = useState([]); // [{ file, preview }]
  const [manualUploading, setManualUploading] = useState(false);
  const [phase, setPhase] = useState(initialResult?.infographics?.length ? 'preview' : 'form');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState('');
  const [progressPercent, setProgressPercent] = useState(initialResult?.infographics?.length ? 100 : 0);
  const [currentStepLabel, setCurrentStepLabel] = useState(initialResult?.infographics?.length ? 'Infographies pretes' : '');
  const [result, setResult] = useState(() => normalizeInfographicsResult(initialResult, DEFAULT_FORM));
  const fileInputRef = useRef(null);
  const manualFileInputRef = useRef(null);
  const pollTimeoutRef = useRef(null);

  useEffect(() => {
    const normalized = normalizeInfographicsResult(initialResult, form);
    if (!normalized?.infographics?.length) return;

    setResult(normalized);
    setPhase('preview');
    setCurrentTaskId('');
    setProgressPercent(100);
    setCurrentStepLabel('Infographies pretes');
    setError('');
    setNotice('');
  }, [initialResult]);

  useEffect(() => () => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (phase !== 'loading' || !currentTaskId) return undefined;

    let cancelled = false;

    const pollTask = async () => {
      try {
        const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${currentTaskId}`, {
          headers: getAuthHeaders(),
        });
        if (!resp.ok || cancelled) throw new Error('Impossible de recuperer la tache');

        const data = await resp.json();
        if (!data?.success || !data?.task || cancelled) throw new Error(data?.message || 'Tache introuvable');

        const task = data.task;
        setProgressPercent(task.progressPercent || 0);
        setCurrentStepLabel(task.currentStep || 'Generation en cours...');

        if (task.status === 'done') {
          const loadedResult = normalizeInfographicsResult(task.product?.infographicsResult || task.product, form);
          if (!loadedResult?.infographics?.length) {
            throw new Error('La tache est terminee mais le resultat est vide');
          }
          setResult(loadedResult);
          setPhase('preview');
          setCurrentTaskId('');
          setProgressPercent(100);
          setCurrentStepLabel('Infographies pretes');
          setNotice('');
          return;
        }

        if (task.status === 'error') {
          throw new Error(task.errorMessage || 'La generation des infographies a echoue');
        }

        if (!cancelled) {
          pollTimeoutRef.current = setTimeout(pollTask, 2500);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Erreur pendant le suivi de generation');
        setNotice('La generation continue peut-etre en arriere-plan. Tu peux la rouvrir depuis la liste des taches.');
        setPhase('form');
        setCurrentTaskId('');
        setProgressPercent(0);
        setCurrentStepLabel('');
      }
    };

    pollTimeoutRef.current = setTimeout(pollTask, 1200);
    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [currentTaskId, form, phase]);

  const onPickPhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.');
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const toggleSlide = (id) => {
    setSelectedSlides((prev) => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));
  };

  const moveSlide = (index, dir) => {
    setSelectedSlides((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handlePresetClick = (preset) => {
    setColorStyle(preset.id);
    setBrandColor(preset.hex);
  };

  const handleCustomColor = (hex) => {
    setBrandColor(hex);
    setColorStyle('personnalise');
  };

  const handleManualFilePick = (files) => {
    if (!files?.length) return;
    const newSlides = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 20)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    setManualSlides(prev => [...prev, ...newSlides].slice(0, 20));
    setError('');
  };

  const removeManualSlide = (index) => {
    setManualSlides(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const handleManualApply = async () => {
    if (!manualSlides.length) { setError('Ajoute au moins une image.'); return; }
    setError('');
    setManualUploading(true);
    try {
      const files = manualSlides.map(s => s.file);
      const res = await storeProductsApi.uploadImages(files);
      const uploaded = res?.data?.data || res?.data || [];
      if (!uploaded.length) throw new Error('Aucune image uploadée');
      const infographics = uploaded.map((img, idx) => ({
        url: img.url,
        type: 'manual',
        order: idx,
        alt: `Slide ${idx + 1}`,
      }));
      const builtResult = {
        layout: 'infographics',
        theme: 'infographics',
        pageStyle: 'infographics',
        infographics,
        form: {
          ...form,
          brandColor,
          colorStyle,
        },
        failed: [],
        country: '',
        productName: '',
        productDescription: '',
      };
      onGenerated?.(builtResult);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'upload des images');
    } finally {
      setManualUploading(false);
    }
  };

  const canGenerate = useMemo(() => photo && productName.trim().length >= 2 && selectedSlides.length > 0 && phase !== 'loading', [photo, productName, selectedSlides, phase]);

  const loadingStepIndex = useMemo(() => getLoadingStepIndex(progressPercent), [progressPercent]);

  const resetToForm = () => {
    setPhase('form');
    setCurrentTaskId('');
    setProgressPercent(0);
    setCurrentStepLabel('');
    setResult(null);
    setError('');
    onResetPreview?.();
  };

  const handleContinueBackgroundClick = () => {
    setNotice('La generation continue en arriere-plan. Tu pourras rouvrir le resultat depuis la liste des taches.');
    setPhase('form');
    setCurrentTaskId('');
    setProgressPercent(0);
    setCurrentStepLabel('');
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    onContinueInBackground?.();
  };

  const handleApplyResult = () => {
    if (!result?.infographics?.length) {
      setError('Aucune infographie prete a appliquer.');
      return;
    }
    onGenerated?.(result);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError('');
    setNotice('');
    setResult(null);
    onResetPreview?.();
    setPhase('loading');
    setProgressPercent(5);
    setCurrentStepLabel('Preparation de la generation...');

    const token = localStorage.getItem('ecomToken');
    const wsId = getWorkspaceId();

    const fd = new FormData();
    fd.append('image', photo);
    fd.append('slideTypes', JSON.stringify(selectedSlides));
    fd.append('productName', productName.trim());
    fd.append('productDescription', productDescription.trim());
    fd.append('country', country.trim());
    fd.append('targetAudience', targetAudience.trim());
    fd.append('painPoint', painPoint.trim());
    fd.append('mainBenefit', mainBenefit.trim());
    fd.append('bodyZone', bodyZone.trim());
    fd.append('formHeadline', form.headline);
    fd.append('formCtaLabel', form.ctaLabel);
    fd.append('formStickyLabel', form.stickyLabel);
    fd.append('formReassurance', form.reassurance);
    fd.append('phFullname', form.placeholders.fullname);
    fd.append('phPhone', form.placeholders.phone);
    fd.append('phAddress', form.placeholders.address);
    fd.append('phCity', form.placeholders.city);
    fd.append('brandColor', brandColor);
    fd.append('colorStyle', colorStyle);

    try {
      const resp = await fetch(`${API_ORIGIN}/api/ai/product-generator/infographics`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(wsId ? { 'X-Workspace-Id': wsId } : {}),
        },
        body: fd,
      });
      if (!resp.ok) {
        let msg = `Erreur HTTP ${resp.status}`;
        try { const j = await resp.json(); msg = j.message || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Génération échouée');

      if (Array.isArray(data.infographics) && data.infographics.length > 0) {
        const directResult = normalizeInfographicsResult({
          layout: 'infographics',
          theme: 'infographics',
          pageStyle: 'infographics',
          infographics: data.infographics || [],
          form: data.form || form,
          failed: data.failed || [],
          country: country.trim(),
          productName: productName.trim(),
          productDescription: productDescription.trim(),
        }, form);
        setResult(directResult);
        setPhase('preview');
        setProgressPercent(100);
        setCurrentStepLabel('Infographies pretes');
        return;
      }

      if (!data.taskId) {
        throw new Error('Le serveur n\'a pas renvoye de tache a suivre');
      }

      setCurrentTaskId(String(data.taskId));
      setProgressPercent(data.progressPercent || 8);
      setCurrentStepLabel(data.currentStep || `Generation de ${selectedSlides.length} infographies 9:16 en cours...`);
    } catch (err) {
      setPhase('form');
      setError(err.message || 'Erreur pendant la génération');
    }
  };

  if (phase === 'loading') {
    return (
      <div className="p-6 sm:p-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0F6B4F]">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Generation en cours</p>
              <h3 className="mt-1 text-xl font-black text-black">Creation des infographies 9:16</h3>
            </div>
          </div>

          <p className="mt-5 min-h-[20px] text-sm text-gray-600">
            {currentStepLabel || 'Preparation des infographies...'}
          </p>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500">
              <span>Progression</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0A5740] via-[#0F6B4F] to-[#14855F] transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {LOADING_STEPS.map((label, index) => (
              <div
                key={label}
                className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${
                  index < loadingStepIndex
                    ? 'bg-[#E6F2ED] text-[#0A5740]'
                    : index === loadingStepIndex
                    ? 'bg-[#0F6B4F] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {index + 1}. {label}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleContinueBackgroundClick}
              className="rounded-lg bg-[#0F6B4F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0A5740]"
            >
              Continuer en arriere-plan
            </button>
            <button
              type="button"
              onClick={resetToForm}
              className="text-sm text-gray-500 underline transition hover:text-gray-800"
            >
              Revenir au formulaire
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'preview' && result?.infographics?.length) {
    return (
      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-2xl border border-[#96C7B5] bg-[#E6F2ED] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F6B4F]">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A5740]">Infographies pretes</p>
              <p className="mt-1 text-xs text-[#0A5740]">
                {result.productName || productName || 'Produit'} · {result.infographics.length} slide(s) generee(s)
              </p>
            </div>
          </div>
        </div>

        {Array.isArray(result.failed) && result.failed.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.failed.length} slide(s) ont echoue mais le reste est disponible.</span>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="mb-4">
            <p className="text-sm font-bold text-gray-900">Apercu des slides</p>
            <p className="text-xs text-gray-500">Tu peux revoir le resultat avant application.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {result.infographics.map((slide, index) => {
              const slideMeta = SLIDE_CATALOG.find((entry) => entry.id === slide.type);
              return (
                <div key={`${slide.type}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                  <div className="aspect-[9/16] bg-gray-100">
                    {slide.url ? (
                      <img src={slide.url} alt={slideMeta?.label || `Slide ${index + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">Image indisponible</div>
                    )}
                  </div>
                  <div className="border-t border-gray-200 px-3 py-2">
                    <p className="text-xs font-bold text-gray-900">{index + 1}. {slideMeta?.label || slide.type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={resetToForm}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Nouvelle generation
          </button>
          <button
            type="button"
            onClick={handleApplyResult}
            className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            <Sparkles className="h-4 w-4" /> Appliquer ces infographies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">Mode Infographies 9:16</p>
            <p className="text-xs text-blue-800 mt-1">Génère une suite d'infographies verticales mobile-first. La page produit publique affichera uniquement ces visuels empilés + un formulaire de commande minimal.</p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-[#96C7B5] bg-[#E6F2ED] px-4 py-3 text-sm text-[#0A5740]">
          {notice}
        </div>
      )}

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('ai')}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${mode === 'ai' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
        >
          <Sparkles className="h-4 w-4" /> Générer avec l&apos;IA
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold transition ${mode === 'manual' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
        >
          <Upload className="h-4 w-4" /> Importer mes images
        </button>
      </div>

      {/* Photo du produit — IA seulement */}
      {mode === 'ai' && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <label className="text-sm font-bold text-gray-900 mb-1 block">Photo du produit <span className="text-red-500">*</span></label>
        <p className="text-xs text-gray-500 mb-3">Le même packaging apparaîtra dans chaque infographie (image-to-image).</p>
        {photoPreview ? (
          <div className="relative inline-block">
            <img src={photoPreview} alt="Produit" className="h-40 w-40 object-cover rounded-xl border border-gray-200" />
            <button
              type="button"
              onClick={() => { setPhoto(null); setPhotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 shadow"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition text-gray-600"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-sm font-semibold">Uploader la photo produit</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickPhoto(e.target.files?.[0])}
        />
      </div>
      )}

      {/* Infos produit — IA seulement */}
      {mode === 'ai' && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <label className="text-sm font-bold text-gray-900 block">Informations produit</label>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Nom du produit <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="ex: GlucoControl"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Description courte</label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            rows={2}
            placeholder="ex: Solution naturelle pour réguler la glycémie."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Pays cible</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="ex: Cameroun, Sénégal, Côte d'Ivoire"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Cible</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="ex: femmes africaines 35-55 ans"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Zone corporelle</label>
            <input
              type="text"
              value={bodyZone}
              onChange={(e) => setBodyZone(e.target.value)}
              placeholder="ex: visage, cheveux, ventre"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Problème principal</label>
            <input
              type="text"
              value={painPoint}
              onChange={(e) => setPainPoint(e.target.value)}
              placeholder="ex: pics de sucre, fatigue, fringales"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bénéfice principal</label>
            <input
              type="text"
              value={mainBenefit}
              onChange={(e) => setMainBenefit(e.target.value)}
              placeholder="ex: Équilibrez votre glycémie, retrouvez votre vitalité"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
      )}

      {/* Upload manuel — mode manuel seulement */}
      {mode === 'manual' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-bold text-gray-900 mb-1">Tes infographies ({manualSlides.length}/20)</p>
          <p className="text-xs text-gray-500 mb-3">Ajoute tes slides 9:16 dans l&apos;ordre souhaité. Elles s&apos;afficheront empilées sur la page publique.</p>
          {manualSlides.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {manualSlides.map((slide, idx) => (
                <div key={idx} className="relative aspect-[9/16] overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  <img src={slide.preview} alt={`Slide ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeManualSlide(idx)}
                    className="absolute top-1 right-1 rounded-full bg-red-500 p-0.5 text-white shadow"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white">{idx + 1}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => manualFileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition text-gray-600"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-sm font-semibold">Ajouter des images</span>
          </button>
          <input
            ref={manualFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleManualFilePick(e.target.files)}
          />
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <label className="text-sm font-bold text-gray-900 mb-1 block">Couleurs & style</label>
        <p className="text-xs text-gray-500 mb-3">La palette choisie sera appliquée à toutes les slides générées.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold border-2 transition-all ${
                colorStyle === preset.id
                  ? 'border-white ring-2 ring-blue-500 scale-105 shadow-md'
                  : 'border-transparent opacity-75 hover:opacity-100'
              }`}
              style={{ backgroundColor: preset.hex, color: preset.textColor }}
            >
              {colorStyle === preset.id && <span>✓</span>}
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Couleur sur-mesure&nbsp;:</label>
          <input
            type="color"
            value={brandColor}
            onChange={(e) => handleCustomColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-gray-300"
          />
          <span className="text-xs font-mono text-gray-400">{brandColor}</span>
        </div>
      </div>

      {/* Types de slides — IA seulement */}
      {mode === 'ai' && (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <label className="text-sm font-bold text-gray-900 mb-1 block">Types d'infographies ({selectedSlides.length})</label>
        <p className="text-xs text-gray-500 mb-3">Coche/décoche et réordonne. Chaque slide génère une image 9:16 dédiée.</p>

        <div className="space-y-2 mb-3">
          {selectedSlides.map((id, idx) => {
            const slide = SLIDE_CATALOG.find(s => s.id === id);
            if (!slide) return null;
            return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <GripVertical className="h-4 w-4 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-900">{idx + 1}. {slide.label}</p>
                  <p className="text-xs text-blue-700 truncate">{slide.desc}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSlide(idx, -1)} disabled={idx === 0} className="rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveSlide(idx, 1)} disabled={idx === selectedSlides.length - 1} className="rounded px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => toggleSlide(id)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>

        {SLIDE_CATALOG.filter(s => !selectedSlides.includes(s.id)).length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Ajouter une slide</p>
            <div className="flex flex-wrap gap-2">
              {SLIDE_CATALOG.filter(s => !selectedSlides.includes(s.id)).map(slide => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => toggleSlide(slide.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                >
                  + {slide.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <label className="text-sm font-bold text-gray-900 block">Textes du formulaire de commande</label>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Accroche</label>
          <textarea
            value={form.headline}
            onChange={(e) => setForm(f => ({ ...f, headline: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bouton principal</label>
            <input
              type="text"
              value={form.ctaLabel}
              onChange={(e) => setForm(f => ({ ...f, ctaLabel: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Bouton sticky</label>
            <input
              type="text"
              value={form.stickyLabel}
              onChange={(e) => setForm(f => ({ ...f, stickyLabel: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mb-1 block">Ligne de réassurance</label>
          <input
            type="text"
            value={form.reassurance}
            onChange={(e) => setForm(f => ({ ...f, reassurance: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {['fullname', 'phone', 'address', 'city'].map((key) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-700 mb-1 block capitalize">Placeholder {key}</label>
              <input
                type="text"
                value={form.placeholders[key]}
                onChange={(e) => setForm(f => ({ ...f, placeholders: { ...f.placeholders, [key]: e.target.value } }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            disabled={phase === 'loading' || manualUploading}
          >
            Annuler
          </button>
        )}
        {mode === 'manual' ? (
          <button
            type="button"
            onClick={handleManualApply}
            disabled={!manualSlides.length || manualUploading}
            className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {manualUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Upload en cours...</> : <><Upload className="h-4 w-4" /> Appliquer {manualSlides.length > 0 ? `${manualSlides.length} image${manualSlides.length > 1 ? 's' : ''}` : ''}</>}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4" /> Generer {selectedSlides.length} infographies 9:16
          </button>
        )}
      </div>
    </div>
  );
};

export default InfographicsGeneratorPanel;
