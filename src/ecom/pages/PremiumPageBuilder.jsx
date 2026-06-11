import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Save, Loader2, Check, Plus, Trash2, ChevronDown, ChevronUp,
  Star, Type, Zap, Shield, HelpCircle, Eye, Palette, Image as ImageIcon,
  MessageSquare, BarChart3, Layers, Award, Clock, ShoppingBag, Monitor,
  Smartphone, ExternalLink, Pencil, Undo2, Redo2,
} from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';
import { useStore } from '../contexts/StoreContext.jsx';
import StoreProductPagePremium from '../components/StoreProductPagePremium.jsx';
import BuilderAIChatWidget from '../components/BuilderAIChatWidget.jsx';

// Build a premiumPage config pre-filled from _pageData when productPageConfig.premiumPage is absent/empty
function hydrateFromPageData(product) {
  const pd = product?._pageData || {};
  const pp = product?.productPageConfig?.premiumPage;
  // If premiumPage already has data, return productPageConfig as-is
  if (pp && (pp.hero?.headline || pp.testimonialGallery?.items?.length || pp.faq?.items?.length)) {
    return product.productPageConfig || {};
  }
  const asArr = (v) => (Array.isArray(v) ? v : []);
  const name = product?.name || product?.title || '';

  const testimonials = asArr(pd.testimonials).slice(0, 6).map((t) => ({
    name: t.name || 'Client vérifié',
    text: t.text || '',
    rating: t.rating || 5,
    tags: t.tags || [],
    image: t.image || '',
  }));

  const faqItems = (() => {
    const src = pd.faq;
    if (Array.isArray(src)) return src.slice(0, 6).map(f => ({ question: f.question || '', answer: f.answer || '' }));
    if (src?.items) return asArr(src.items).slice(0, 6).map(f => ({ question: f.question || '', answer: f.answer || '' }));
    return [];
  })();

  const raisons = asArr(pd.raisons_acheter || pd.hero_benefits);
  const painPoints = asArr(pd.problem_section?.pain_points);

  const ritualSteps = asArr(pd.guide_utilisation?.etapes).slice(0, 4).map((s, i) => ({
    label: `Étape ${s.numero || i + 1}`,
    title: s.action || '',
    description: s.detail || '',
  }));

  const scienceItems = asArr(pd.ingredients || pd.science_items).slice(0, 4).map((s) => ({
    name: typeof s === 'string' ? s : (s.name || s.label || ''),
    description: typeof s === 'string' ? '' : (s.description || s.role || ''),
  }));

  const reassurance = asArr(pd.reassurance?.points).slice(0, 3);

  const existing = product?.productPageConfig || {};

  // Merge product.premiumImages into config.premiumImages (product-level images win if config empty)
  const srcImgs = product?.premiumImages || {};
  const cfgImgs = existing.premiumImages || {};
  const mergedImages = {};
  for (const key of ['hero', 'problem', 'mechanism', 'science', 'ritual', 'closing']) {
    const cfgVal = cfgImgs[key];
    const srcVal = srcImgs[key];
    const cfgUrl = typeof cfgVal === 'string' ? cfgVal : cfgVal?.url || '';
    const srcUrl = typeof srcVal === 'string' ? srcVal : srcVal?.url || '';
    mergedImages[key] = cfgUrl || srcUrl || '';
  }
  // heroGallery: array of urls
  const cfgGallery = Array.isArray(cfgImgs.heroGallery) ? cfgImgs.heroGallery.map(e => typeof e === 'string' ? e : e?.url || '') : [];
  const srcGallery = Array.isArray(srcImgs.heroGallery) ? srcImgs.heroGallery.map(e => typeof e === 'string' ? e : e?.url || '') : [];
  mergedImages.heroGallery = cfgGallery.length ? cfgGallery : srcGallery;
  // testimonials images
  const cfgTesti = Array.isArray(cfgImgs.testimonials) ? cfgImgs.testimonials.map(e => typeof e === 'string' ? e : e?.url || '') : [];
  const srcTesti = Array.isArray(srcImgs.testimonials) ? srcImgs.testimonials.map(e => typeof e === 'string' ? e : e?.url || '') : [];
  mergedImages.testimonials = cfgTesti.length ? cfgTesti : srcTesti;

  // Also pull product gallery images as fallback for heroGallery
  if (!mergedImages.heroGallery.length) {
    const productImgs = Array.isArray(product?.images) ? product.images.map(e => typeof e === 'string' ? e : e?.url || '').filter(Boolean) : [];
    mergedImages.heroGallery = productImgs;
  }

  return {
    ...existing,
    premiumImages: { ...cfgImgs, ...mergedImages },
    premiumPage: {
      ...(existing.premiumPage || {}),
      hero: {
        eyebrow: pd.hero_baseline || pd.urgency_badge || '',
        headline: pd.hero_headline || name,
        subheadline: pd.hero_slogan || '',
        ctaLabel: pd.hero_cta || 'Commander',
        benefits: raisons.slice(0, 5),
        reassurance: reassurance.length ? reassurance : ['Paiement à la livraison', 'Livraison rapide', 'Support WhatsApp'],
        accordions: asArr(pd.hero_accordions),
        ...(existing.premiumPage?.hero || {}),
      },
      testimonialGallery: {
        headline: pd.hero_slogan || `Ils ont choisi ${name} avec confiance`,
        subheadline: '',
        items: testimonials,
        ...(existing.premiumPage?.testimonialGallery || {}),
      },
      problemSection: {
        headline: pd.problem_section?.title || '',
        bullets: painPoints.slice(0, 5),
        ...(existing.premiumPage?.problemSection || {}),
      },
      mechanismSection: {
        headline: pd.solution_section?.title || '',
        body: pd.solution_section?.description || '',
        ...(existing.premiumPage?.mechanismSection || {}),
      },
      scienceSection: {
        headline: 'Ce qui rend la formule efficace',
        subheadline: '',
        items: scienceItems,
        ...(existing.premiumPage?.scienceSection || {}),
      },
      ritualSection: {
        headline: pd.guide_utilisation?.titre || 'Votre rituel simple au quotidien',
        subheadline: '',
        steps: ritualSteps,
        resultsTimeline: [],
        ...(existing.premiumPage?.ritualSection || {}),
      },
      faq: {
        headline: 'Questions fréquentes',
        subheadline: 'Tout ce que vous devez savoir avant de commander.',
        items: faqItems,
        ...(existing.premiumPage?.faq || {}),
      },
      closingSection: {
        headline: pd.hero_headline || `Pourquoi choisir ${name}`,
        subheadline: pd.hero_slogan || '',
        bullets: raisons.slice(0, 4),
        ...(existing.premiumPage?.closingSection || {}),
      },
      comparisonSection: {
        columns: [name, 'Solution classique', 'Alternative basique'],
        rows: raisons.slice(0, 5).map((r) => ({ label: r, values: [true, false, false] })),
        ...(existing.premiumPage?.comparisonSection || {}),
      },
      rating: existing.premiumPage?.rating || { score: '4,9/5', count: '+1 000', label: 'clients satisfaits' },
    },
  };
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition placeholder-gray-400';
const textareaCls = `${inputCls} resize-none`;

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function RepeatableItems({ items, onChange, fields, addLabel }) {
  const update = (i, key, val) => { const copy = [...items]; copy[i] = { ...copy[i], [key]: val }; onChange(copy); };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, fields.reduce((a, f) => ({ ...a, [f.key]: f.default || '' }), {})]);
  const moveUp = (i) => { if (i === 0) return; const copy = [...items]; [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]]; onChange(copy); };
  const moveDown = (i) => { if (i >= items.length - 1) return; const copy = [...items]; [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]]; onChange(copy); };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => moveDown(i)} disabled={i >= items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              {f.type === 'textarea' ? (
                <textarea value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} rows={f.rows || 2} placeholder={f.placeholder || f.label} className={textareaCls} />
              ) : f.type === 'number' ? (
                <input type="number" value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder || f.label} className={inputCls} min={f.min} max={f.max} step={f.step} />
              ) : (
                <input type="text" value={item[f.key] || ''} onChange={(e) => update(i, f.key, e.target.value)} placeholder={f.placeholder || f.label} className={inputCls} />
              )}
            </div>
          ))}
        </div>
      ))}
      <button type="button" onClick={add} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />{addLabel}
      </button>
    </div>
  );
}

function ImageField({ label, value, onChange, onUpload }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUpload(file);
      if (url) onChange(url);
      else alert("Echec de l'import de l'image");
    } catch {
      alert("Echec de l'import de l'image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-semibold text-gray-600">{label}</label>}
      <div className="flex items-start gap-2">
        <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center flex-shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-gray-300" />}
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Coller une URL d'image" className={inputCls} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="px-2.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition flex items-center gap-1.5 disabled:opacity-50">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}{uploading ? 'Envoi...' : 'Importer'}
            </button>
            {value && <button type="button" onClick={() => onChange('')} className="px-2 py-1.5 text-xs text-red-500 hover:text-red-700">Retirer</button>}
          </div>
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>
    </div>
  );
}

function StringListField({ label, items, onChange, placeholder, addLabel }) {
  const list = Array.isArray(items) ? items : [];
  const update = (i, val) => { const c = [...list]; c[i] = val; onChange(c); };
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, '']);
  const moveUp = (i) => { if (i === 0) return; const c = [...list]; [c[i-1],c[i]]=[c[i],c[i-1]]; onChange(c); };
  const moveDown = (i) => { if (i >= list.length-1) return; const c = [...list]; [c[i],c[i+1]]=[c[i+1],c[i]]; onChange(c); };
  return (
    <div className="space-y-2">
      {label && <label className="block text-xs font-semibold text-gray-600">{label}</label>}
      {list.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
            <button type="button" onClick={() => moveDown(i)} disabled={i >= list.length-1} className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
          </div>
          <input
            type="text"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder || 'Entrez un élément'}
            className={inputCls + ' flex-1'}
          />
          <button type="button" onClick={() => remove(i)} className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-xs font-semibold text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />{addLabel || 'Ajouter'}
      </button>
    </div>
  );
}

function ImageListField({ label, urls, onChangeAt, onUpload }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">{label}</p>}
      {urls.map((url, i) => (
        <ImageField key={i} label={`Image ${i + 1}`} value={url} onUpload={onUpload} onChange={(v) => onChangeAt(i, v)} />
      ))}
    </div>
  );
}

const SECTIONS = [
  { id: 'design', label: 'Design & Couleurs', icon: <Palette className="w-3.5 h-3.5" />, color: '#6366f1' },
  { id: 'hero', label: 'Hero', icon: <Zap className="w-3.5 h-3.5" />, color: '#0F766E' },
  { id: 'accordions', label: 'Barres depliables', icon: <ChevronDown className="w-3.5 h-3.5" />, color: '#0891b2' },
  { id: 'testimonials', label: 'Temoignages', icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#ec4899' },
  { id: 'problem', label: 'Probleme', icon: <Type className="w-3.5 h-3.5" />, color: '#ef4444' },
  { id: 'mechanism', label: 'Mecanisme', icon: <Layers className="w-3.5 h-3.5" />, color: '#8b5cf6' },
  { id: 'science', label: 'Science / Ingredients', icon: <Award className="w-3.5 h-3.5" />, color: '#10b981' },
  { id: 'ritual', label: 'Rituel', icon: <Clock className="w-3.5 h-3.5" />, color: '#f59e0b' },
  { id: 'comparison', label: 'Comparaison', icon: <BarChart3 className="w-3.5 h-3.5" />, color: '#3b82f6' },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="w-3.5 h-3.5" />, color: '#f97316' },
  { id: 'closing', label: 'Closing', icon: <ShoppingBag className="w-3.5 h-3.5" />, color: '#1f2937' },
  { id: 'upsells', label: 'Upsells & Order Bump', icon: <Zap className="w-3.5 h-3.5" />, color: '#7c3aed' },
];

const ORDERABLE_SECTION_IDS = ['testimonials', 'problem', 'mechanism', 'science', 'ritual', 'comparison', 'faq', 'closing'];
const FIXED_TOP_IDS = ['design', 'hero', 'accordions'];
const FIXED_BOTTOM_IDS = ['upsells'];

const MAX_HISTORY = 50;

const PremiumPageBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { activeStore } = useStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [product, setProduct] = useState(null);
  const [config, setConfig] = useState(null);
  const [activeSection, setActiveSection] = useState('hero');
  const [device, setDevice] = useState('desktop');

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storeProductsApi.getProduct(id);
        const p = res.data?.data;
        if (p) {
          setProduct(p);
          const initialConfig = hydrateFromPageData(p);
          setConfig(initialConfig);
          setHistory([initialConfig]);
          setHistoryIndex(0);
          historyIndexRef.current = 0;
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateConfig = useCallback((updater) => {
    setConfig((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        setHistory((h) => {
          const base = h.slice(0, historyIndexRef.current + 1);
          const newH = [...base, next].slice(-MAX_HISTORY);
          setHistoryIndex(newH.length - 1);
          historyIndexRef.current = newH.length - 1;
          return newH;
        });
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    const newIndex = historyIndexRef.current - 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    skipHistoryRef.current = true;
    setConfig(h => history[newIndex] ?? h);
    skipHistoryRef.current = false;
  }, [history]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= history.length - 1) return;
    const newIndex = historyIndexRef.current + 1;
    historyIndexRef.current = newIndex;
    setHistoryIndex(newIndex);
    skipHistoryRef.current = true;
    setConfig(h => history[newIndex] ?? h);
    skipHistoryRef.current = false;
  }, [history]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const safeConfig = config || {};
  const premium = safeConfig.premiumPage || product?._pageData?.premium_page || product?._pageData?.premiumPage || {};
  const design = safeConfig.design || {};
  const accent = design.ctaButtonColor || design.buttonColor || '#0F766E';
  const sectionOrder = safeConfig.sectionOrder || ORDERABLE_SECTION_IDS;

  const genImages = product?.premiumImages || product?._pageData?.premiumImages || {};
  const cfgImages = safeConfig.premiumImages || {};
  const imgArrayOf = (key, count) => {
    const src = cfgImages[key] != null ? cfgImages[key] : genImages[key];
    const arr = (Array.isArray(src) ? src : []).map((e) => (typeof e === 'string' ? e : e?.url || ''));
    return Array.from({ length: count }, (_, i) => arr[i] || '');
  };
  const imgSingleOf = (key) => {
    const v = cfgImages[key] != null ? cfgImages[key] : genImages[key];
    return typeof v === 'string' ? v : (v?.url || '');
  };

  const setPremiumNested = useCallback((section, key, value) => {
    updateConfig((prev) => {
      const p = prev || {};
      return {
        ...p,
        premiumPage: {
          ...(p.premiumPage || {}),
          [section]: { ...(p.premiumPage?.[section] || {}), [key]: value },
        },
      };
    });
  }, [updateConfig]);

  const setDesign = useCallback((key, value) => {
    updateConfig((prev) => {
      const p = prev || {};
      return { ...p, design: { ...(p.design || {}), [key]: value } };
    });
  }, [updateConfig]);

  const setPremiumDirect = useCallback((key, value) => {
    updateConfig((prev) => {
      const p = prev || {};
      return { ...p, premiumPage: { ...(p.premiumPage || {}), [key]: value } };
    });
  }, [updateConfig]);

  const setUpsells = useCallback((key, value) => {
    updateConfig((prev) => {
      const p = prev || {};
      return { ...p, upsells: { ...(p.upsells || {}), [key]: value } };
    });
  }, [updateConfig]);

  const setPremiumImage = useCallback((key, value) => {
    updateConfig((prev) => {
      const p = prev || {};
      return { ...p, premiumImages: { ...(p.premiumImages || {}), [key]: value } };
    });
  }, [updateConfig]);

  const setPremiumImageAt = useCallback((key, index, value, count, current) => {
    const arr = Array.from({ length: count }, (_, i) => current[i] || '');
    arr[index] = value;
    updateConfig((prev) => {
      const p = prev || {};
      return { ...p, premiumImages: { ...(p.premiumImages || {}), [key]: arr } };
    });
  }, [updateConfig]);

  const dragIdRef = useRef(null);

  const moveSectionUp = useCallback((id) => {
    updateConfig((prev) => {
      const order = prev?.sectionOrder || ORDERABLE_SECTION_IDS;
      const idx = order.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...order];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return { ...(prev || {}), sectionOrder: next };
    });
  }, [updateConfig]);

  const moveSectionDown = useCallback((id) => {
    updateConfig((prev) => {
      const order = prev?.sectionOrder || ORDERABLE_SECTION_IDS;
      const idx = order.indexOf(id);
      if (idx < 0 || idx >= order.length - 1) return prev;
      const next = [...order];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { ...(prev || {}), sectionOrder: next };
    });
  }, [updateConfig]);

  const handleDragStart = useCallback((id) => { dragIdRef.current = id; }, []);
  const handleDragOver = useCallback((e, id) => {
    e.preventDefault();
    if (!dragIdRef.current || dragIdRef.current === id) return;
    updateConfig((prev) => {
      const order = prev?.sectionOrder || ORDERABLE_SECTION_IDS;
      const from = order.indexOf(dragIdRef.current);
      const to = order.indexOf(id);
      if (from < 0 || to < 0) return prev;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, dragIdRef.current);
      return { ...(prev || {}), sectionOrder: next };
    });
  }, [updateConfig]);
  const handleDragEnd = useCallback(() => { dragIdRef.current = null; }, []);

  const uploadOne = useCallback(async (file) => {
    const res = await storeProductsApi.uploadImages([file]);
    return res?.data?.data?.[0]?.url || res?.data?.[0]?.url || '';
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await storeProductsApi.updateProduct(id, { productPageConfig: config });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Build productPageConfig for live preview
  const liveProductPageConfig = useMemo(() => ({
    ...safeConfig,
  }), [safeConfig]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Produit introuvable</p>
      </div>
    );
  }

  const subdomain = activeStore?.subdomain || '';
  const previewUrl = subdomain ? `/store/${subdomain}/product/${product.slug || id}` : null;

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const renderEditor = () => {
    switch (activeSection) {
      case 'design':
        return (
          <div className="space-y-4">
            <Field label="Nom de marque (header)">
              <input type="text" value={premium.brandName || ''} onChange={(e) => setPremiumDirect('brandName', e.target.value)} className={inputCls} placeholder="Ma Marque" />
            </Field>
            <Field label="Couleur accent (boutons, checks)">
              <div className="flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => { setDesign('ctaButtonColor', e.target.value); setDesign('buttonColor', e.target.value); }} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={accent} onChange={(e) => { setDesign('ctaButtonColor', e.target.value); setDesign('buttonColor', e.target.value); }} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur de fond">
              <div className="flex items-center gap-2">
                <input type="color" value={design.backgroundColor || '#F6FBFA'} onChange={(e) => setDesign('backgroundColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={design.backgroundColor || '#F6FBFA'} onChange={(e) => setDesign('backgroundColor', e.target.value)} className={inputCls} />
              </div>
            </Field>
            <Field label="Couleur du texte">
              <div className="flex items-center gap-2">
                <input type="color" value={design.textColor || '#171717'} onChange={(e) => setDesign('textColor', e.target.value)} className="w-10 h-10 rounded-lg border border-gray-200 p-0.5 cursor-pointer" />
                <input type="text" value={design.textColor || '#171717'} onChange={(e) => setDesign('textColor', e.target.value)} className={inputCls} />
              </div>
            </Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Note / Avis</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Score"><input type="text" value={premium.rating?.score || ''} onChange={(e) => setPremiumNested('rating', 'score', e.target.value)} className={inputCls} placeholder="4,9/5" /></Field>
              <Field label="Nombre"><input type="text" value={premium.rating?.count || ''} onChange={(e) => setPremiumNested('rating', 'count', e.target.value)} className={inputCls} placeholder="+1 000" /></Field>
            </div>
            <Field label="Label avis"><input type="text" value={premium.rating?.label || ''} onChange={(e) => setPremiumNested('rating', 'label', e.target.value)} className={inputCls} placeholder="clients satisfaits" /></Field>
          </div>
        );
      case 'hero':
        return (
          <div className="space-y-4">
            <Field label="Badge (seal)"><input type="text" value={premium.hero?.eyebrow || ''} onChange={(e) => setPremiumNested('hero', 'eyebrow', e.target.value)} className={inputCls} placeholder="Offre limitee" /></Field>
            <Field label="Titre principal"><input type="text" value={premium.hero?.headline || ''} onChange={(e) => setPremiumNested('hero', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><textarea value={premium.hero?.subheadline || ''} onChange={(e) => setPremiumNested('hero', 'subheadline', e.target.value)} rows={2} className={textareaCls} /></Field>
            <Field label="Prix affiche"><input type="text" value={premium.hero?.priceLabel || ''} onChange={(e) => setPremiumNested('hero', 'priceLabel', e.target.value)} className={inputCls} placeholder="15 000 FCFA" /></Field>
            <Field label="Texte bouton CTA"><input type="text" value={premium.hero?.ctaLabel || ''} onChange={(e) => setPremiumNested('hero', 'ctaLabel', e.target.value)} className={inputCls} placeholder="Commander" /></Field>
            <StringListField
              label="Bénéfices"
              items={premium.hero?.benefits || []}
              onChange={(v) => setPremiumNested('hero', 'benefits', v)}
              placeholder="Ex: Résultats visibles dès 2 semaines"
              addLabel="Ajouter un bénéfice"
            />
            <StringListField
              label="Réassurance"
              items={premium.hero?.reassurance || []}
              onChange={(v) => setPremiumNested('hero', 'reassurance', v)}
              placeholder="Ex: Paiement à la livraison"
              addLabel="Ajouter un élément"
            />
            <ImageListField
              label="Images du hero (carrousel)"
              urls={imgArrayOf('heroGallery', 5)}
              onUpload={uploadOne}
              onChangeAt={(i, v) => setPremiumImageAt('heroGallery', i, v, 5, imgArrayOf('heroGallery', 5))}
            />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Offre speciale</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!premium.hero?.showOffer} onChange={(e) => setPremiumNested('hero', 'showOffer', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
              <span className="text-sm text-gray-700 font-medium">Afficher la section offre</span>
            </label>
            {premium.hero?.showOffer && (
              <div className="space-y-3 pl-3 border-l-2 border-indigo-200">
                <Field label="Titre offre"><input type="text" value={premium.hero?.offerTitle || ''} onChange={(e) => setPremiumNested('hero', 'offerTitle', e.target.value)} className={inputCls} placeholder="OFFRE SPECIALE" /></Field>
                <Field label="Label countdown"><input type="text" value={premium.hero?.countdownLabel || ''} onChange={(e) => setPremiumNested('hero', 'countdownLabel', e.target.value)} className={inputCls} placeholder="L'offre expire bientot" /></Field>
                <Field label="Titre carte offre"><input type="text" value={premium.hero?.offerCards?.[0]?.title || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), title: e.target.value }])} className={inputCls} placeholder="1 + 1 OFFERT" /></Field>
                <Field label="Badge carte"><input type="text" value={premium.hero?.offerCards?.[0]?.badge || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), badge: e.target.value }])} className={inputCls} placeholder="Economisez" /></Field>
                <Field label="Ancien prix"><input type="text" value={premium.hero?.offerCards?.[0]?.oldPrice || ''} onChange={(e) => setPremiumNested('hero', 'offerCards', [{ ...(premium.hero?.offerCards?.[0] || {}), oldPrice: e.target.value }])} className={inputCls} placeholder="220 000 FCFA" /></Field>
              </div>
            )}
          </div>
        );
      case 'accordions':
        return (
          <RepeatableItems
            items={premium.hero?.accordions || []}
            onChange={(items) => setPremiumNested('hero', 'accordions', items)}
            addLabel="Ajouter une barre"
            fields={[
              { key: 'title', label: 'Titre', placeholder: 'Comment ca marche ?' },
              { key: 'content', label: 'Contenu', type: 'textarea', rows: 3, placeholder: 'Explication...' },
            ]}
          />
        );
      case 'testimonials':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.testimonialGallery?.headline || ''} onChange={(e) => setPremiumNested('testimonialGallery', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.testimonialGallery?.subheadline || ''} onChange={(e) => setPremiumNested('testimonialGallery', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.testimonialGallery?.items || []}
              onChange={(items) => setPremiumNested('testimonialGallery', 'items', items)}
              addLabel="Ajouter un temoignage"
              fields={[
                { key: 'name', label: 'Nom', placeholder: 'Marie K.' },
                { key: 'text', label: 'Avis', type: 'textarea', rows: 2 },
                { key: 'rating', label: 'Note (1-5)', type: 'number', placeholder: '5', min: 1, max: 5, step: 1 },
                { key: 'tags', label: 'Tags (virgule)', placeholder: 'Resultat rapide, Verifie' },
                { key: 'image', label: 'URL photo (optionnel)', placeholder: 'https://...' },
              ]}
            />
            <ImageListField
              label="Photos des avis (UGC)"
              urls={imgArrayOf('testimonials', 6)}
              onUpload={uploadOne}
              onChangeAt={(i, v) => setPremiumImageAt('testimonials', i, v, 6, imgArrayOf('testimonials', 6))}
            />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Bande de preuves (authority strip)</p>
            <RepeatableItems
              items={premium.authorityStrip || []}
              onChange={(items) => setPremiumDirect('authorityStrip', items)}
              addLabel="Ajouter"
              fields={[
                { key: 'label', label: 'Chiffre/Label', placeholder: 'Clients verifies' },
                { key: 'quote', label: 'Citation', placeholder: 'Une solution efficace...' },
              ]}
            />
          </div>
        );
      case 'problem':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.problemSection?.headline || ''} onChange={(e) => setPremiumNested('problemSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Texte introductif"><textarea value={premium.problemSection?.body || ''} onChange={(e) => setPremiumNested('problemSection', 'body', e.target.value)} rows={3} className={textareaCls} /></Field>
            <StringListField
              label="Points de douleur"
              items={premium.problemSection?.bullets || []}
              onChange={(v) => setPremiumNested('problemSection', 'bullets', v)}
              placeholder="Ex: Fatigue chronique dès le matin"
              addLabel="Ajouter un point"
            />
            <ImageField label="Image de la section probleme" value={imgSingleOf('problem')} onUpload={uploadOne} onChange={(v) => setPremiumImage('problem', v)} />
          </div>
        );
      case 'mechanism':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.mechanismSection?.headline || ''} onChange={(e) => setPremiumNested('mechanismSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Texte explicatif"><textarea value={premium.mechanismSection?.body || ''} onChange={(e) => setPremiumNested('mechanismSection', 'body', e.target.value)} rows={6} className={textareaCls} /></Field>
            <ImageField label="Image de la section mecanisme" value={imgSingleOf('mechanism')} onUpload={uploadOne} onChange={(v) => setPremiumImage('mechanism', v)} />
          </div>
        );
      case 'science':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.scienceSection?.headline || ''} onChange={(e) => setPremiumNested('scienceSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.scienceSection?.subheadline || ''} onChange={(e) => setPremiumNested('scienceSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.scienceSection?.items || []}
              onChange={(items) => setPremiumNested('scienceSection', 'items', items)}
              addLabel="Ajouter un ingredient / point cle"
              fields={[
                { key: 'name', label: 'Nom', placeholder: 'Chlorophylle' },
                { key: 'description', label: 'Role / Description', type: 'textarea', rows: 2 },
              ]}
            />
            <ImageField label="Image de la section science" value={imgSingleOf('science')} onUpload={uploadOne} onChange={(v) => setPremiumImage('science', v)} />
          </div>
        );
      case 'ritual':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.ritualSection?.headline || ''} onChange={(e) => setPremiumNested('ritualSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.ritualSection?.subheadline || ''} onChange={(e) => setPremiumNested('ritualSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Etapes du rituel</p>
            <RepeatableItems
              items={premium.ritualSection?.steps || []}
              onChange={(items) => setPremiumNested('ritualSection', 'steps', items)}
              addLabel="Ajouter une etape"
              fields={[
                { key: 'label', label: 'Label', placeholder: 'Etape 1' },
                { key: 'title', label: 'Titre', placeholder: 'Prenez un comprime' },
                { key: 'description', label: 'Detail', type: 'textarea', rows: 2 },
              ]}
            />
            <ImageField label="Image de la section rituel" value={imgSingleOf('ritual')} onUpload={uploadOne} onChange={(v) => setPremiumImage('ritual', v)} />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2">Timeline des resultats</p>
            <RepeatableItems
              items={premium.ritualSection?.resultsTimeline || []}
              onChange={(items) => setPremiumNested('ritualSection', 'resultsTimeline', items)}
              addLabel="Ajouter un point"
              fields={[
                { key: 'label', label: 'Periode', placeholder: 'Jour 7' },
                { key: 'description', label: 'Resultat observe', type: 'textarea', rows: 2 },
              ]}
            />
          </div>
        );
      case 'comparison':
        return (
          <div className="space-y-4">
            <Field label="Titre section"><input type="text" value={premium.comparisonSection?.headline || ''} onChange={(e) => setPremiumNested('comparisonSection', 'headline', e.target.value)} className={inputCls} placeholder="Comparaison" /></Field>
            <Field label="Colonnes (separees par virgule)"><input type="text" value={(premium.comparisonSection?.columns || []).join(', ')} onChange={(e) => setPremiumNested('comparisonSection', 'columns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className={inputCls} placeholder="Mon produit, Alternative 1, Alternative 2" /></Field>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Criteres</p>
            {(premium.comparisonSection?.rows || []).map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={row.label || ''} onChange={(e) => {
                  const rows = [...(premium.comparisonSection?.rows || [])];
                  rows[i] = { ...rows[i], label: e.target.value };
                  setPremiumNested('comparisonSection', 'rows', rows);
                }} className={`flex-1 ${inputCls}`} />
                <button type="button" onClick={() => setPremiumNested('comparisonSection', 'rows', (premium.comparisonSection?.rows || []).filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setPremiumNested('comparisonSection', 'rows', [...(premium.comparisonSection?.rows || []), { label: '', values: [true, false, false] }])} className="text-sm text-indigo-600 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter un critere</button>
          </div>
        );
      case 'faq':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.faq?.headline || ''} onChange={(e) => setPremiumNested('faq', 'headline', e.target.value)} className={inputCls} placeholder="Questions frequentes" /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.faq?.subheadline || ''} onChange={(e) => setPremiumNested('faq', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <RepeatableItems
              items={premium.faq?.items || []}
              onChange={(items) => setPremiumNested('faq', 'items', items)}
              addLabel="Ajouter une question"
              fields={[
                { key: 'question', label: 'Question', placeholder: 'Comment utiliser le produit ?' },
                { key: 'answer', label: 'Reponse', type: 'textarea', rows: 3 },
              ]}
            />
          </div>
        );
      case 'closing':
        return (
          <div className="space-y-4">
            <Field label="Titre"><input type="text" value={premium.closingSection?.headline || ''} onChange={(e) => setPremiumNested('closingSection', 'headline', e.target.value)} className={inputCls} /></Field>
            <Field label="Sous-titre"><input type="text" value={premium.closingSection?.subheadline || ''} onChange={(e) => setPremiumNested('closingSection', 'subheadline', e.target.value)} className={inputCls} /></Field>
            <StringListField
              label="Points clés"
              items={premium.closingSection?.bullets || []}
              onChange={(v) => setPremiumNested('closingSection', 'bullets', v)}
              placeholder="Ex: Formule naturelle et efficace"
              addLabel="Ajouter un point"
            />
            <ImageField label="Image de la section closing" value={imgSingleOf('closing')} onUpload={uploadOne} onChange={(v) => setPremiumImage('closing', v)} />
          </div>
        );
      case 'upsells': {
        const upsells = safeConfig.upsells || {};
        const offers = upsells.offers || [];
        const bump = upsells.bump || {};
        return (
          <div className="space-y-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">1-Click Upsells (apres achat)</p>
            {offers.map((offer, i) => (
              <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">Upsell #{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer text-xs">
                      <input type="checkbox" checked={offer.isActive !== false} onChange={(e) => {
                        const next = [...offers]; next[i] = { ...next[i], isActive: e.target.checked }; setUpsells('offers', next);
                      }} className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600" />
                      Actif
                    </label>
                    <button type="button" onClick={() => setUpsells('offers', offers.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <input type="text" value={offer.title || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], title: e.target.value }; setUpsells('offers', next); }} placeholder="Titre de l'offre" className={inputCls} />
                <textarea value={offer.description || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], description: e.target.value }; setUpsells('offers', next); }} placeholder="Description" rows={2} className={textareaCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={offer.price || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], price: e.target.value }; setUpsells('offers', next); }} placeholder="Prix" className={inputCls} />
                  <input type="text" value={offer.oldPrice || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], oldPrice: e.target.value }; setUpsells('offers', next); }} placeholder="Ancien prix" className={inputCls} />
                </div>
                <input type="text" value={offer.ctaText || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], ctaText: e.target.value }; setUpsells('offers', next); }} placeholder="Texte bouton (ex: Oui, j'en profite !)" className={inputCls} />
                <input type="text" value={offer.image || ''} onChange={(e) => { const next = [...offers]; next[i] = { ...next[i], image: e.target.value }; setUpsells('offers', next); }} placeholder="URL image (optionnel)" className={inputCls} />
              </div>
            ))}
            <button type="button" onClick={() => setUpsells('offers', [...offers, { id: Date.now(), title: '', description: '', price: '', oldPrice: '', ctaText: 'Oui, j\'en profite !', isActive: true }])} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />Ajouter un upsell
            </button>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Order Bump (case a cocher au checkout)</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!bump.isActive} onChange={(e) => setUpsells('bump', { ...bump, isActive: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-indigo-600" />
                  <span className="text-sm text-gray-700 font-medium">Activer l'order bump</span>
                </label>
                {bump.isActive && (
                  <div className="space-y-2 pl-3 border-l-2 border-indigo-200">
                    <input type="text" value={bump.title || ''} onChange={(e) => setUpsells('bump', { ...bump, title: e.target.value })} placeholder="Titre (ex: Ajoutez un 2e a -50%)" className={inputCls} />
                    <textarea value={bump.description || ''} onChange={(e) => setUpsells('bump', { ...bump, description: e.target.value })} placeholder="Description" rows={2} className={textareaCls} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={bump.price || ''} onChange={(e) => setUpsells('bump', { ...bump, price: e.target.value })} placeholder="Prix bump" className={inputCls} />
                      <input type="text" value={bump.label || ''} onChange={(e) => setUpsells('bump', { ...bump, label: e.target.value })} placeholder="Label checkbox" className={inputCls} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* Top bar */}
      <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition font-semibold">
            <ArrowLeft className="w-4 h-4" />Retour
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900">Premium Builder</h1>
          </div>
          <span className="text-xs text-gray-500 truncate max-w-[180px] hidden sm:inline">{product.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)" className={`p-2 rounded-md transition ${canUndo ? 'text-gray-700 hover:bg-white hover:shadow' : 'text-gray-300 cursor-not-allowed'}`}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={!canRedo} title="Retablir (Ctrl+Shift+Z)" className={`p-2 rounded-md transition ${canRedo ? 'text-gray-700 hover:bg-white hover:shadow' : 'text-gray-300 cursor-not-allowed'}`}>
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          {/* Device toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'desktop', icon: <Monitor className="w-3.5 h-3.5" /> },
              { id: 'mobile', icon: <Smartphone className="w-3.5 h-3.5" /> },
            ].map(({ id: did, icon }) => (
              <button key={did} onClick={() => setDevice(did)} className={`p-2 rounded-md transition ${device === did ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{icon}</button>
            ))}
          </div>
          <div className="w-px h-5 bg-gray-200" />
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition" title="Ouvrir dans un nouvel onglet">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition shadow-sm ${saved ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Publie !' : 'Publier'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: vertical section list with inline editors */}
        <div className="w-80 xl:w-[420px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Sections</p>
            <span className="text-[11px] text-gray-400">{SECTIONS.length} sections</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {(() => {
              // Build display order: fixed-top + orderable in user order + fixed-bottom
              const orderableMap = Object.fromEntries(SECTIONS.filter(s => ORDERABLE_SECTION_IDS.includes(s.id)).map(s => [s.id, s]));
              const orderedSections = [
                ...SECTIONS.filter(s => FIXED_TOP_IDS.includes(s.id)),
                ...sectionOrder.map(id => orderableMap[id]).filter(Boolean),
                ...SECTIONS.filter(s => FIXED_BOTTOM_IDS.includes(s.id)),
              ];
              return orderedSections.map((s) => {
                const isOrderable = ORDERABLE_SECTION_IDS.includes(s.id);
                const orderIdx = sectionOrder.indexOf(s.id);
                return (
                  <div
                    key={s.id}
                    draggable={isOrderable}
                    onDragStart={isOrderable ? () => handleDragStart(s.id) : undefined}
                    onDragOver={isOrderable ? (e) => handleDragOver(e, s.id) : undefined}
                    onDragEnd={isOrderable ? handleDragEnd : undefined}
                    className={isOrderable ? 'cursor-default' : ''}
                  >
                    <div className="flex items-center gap-1">
                      {isOrderable && (
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-0.5 cursor-grab active:cursor-grabbing select-none" title="Glisser pour réordonner">
                          <div className="w-3.5 h-0.5 rounded-full bg-gray-300" />
                          <div className="w-3.5 h-0.5 rounded-full bg-gray-300" />
                          <div className="w-3.5 h-0.5 rounded-full bg-gray-300" />
                        </div>
                      )}
                      <button
                        onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${activeSection === s.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: s.color }}>
                          {s.icon}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 flex-1">{s.label}</span>
                        {activeSection === s.id ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                      </button>
                      {isOrderable && (
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            title="Monter"
                            onClick={() => moveSectionUp(s.id)}
                            disabled={orderIdx <= 0}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition"
                          ><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button
                            type="button"
                            title="Descendre"
                            onClick={() => moveSectionDown(s.id)}
                            disabled={orderIdx >= sectionOrder.length - 1}
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition"
                          ><ChevronDown className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                    {activeSection === s.id && (
                      <div className="mt-2 mb-3 ml-3 pl-4 border-l-2 border-indigo-200 space-y-3">
                        {renderEditor()}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Right: live preview (inline component, no iframe) */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <div className={`${device === 'mobile' ? 'w-[390px] mx-auto' : 'w-full'} h-full flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300`}>
            {/* Browser chrome */}
            <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white border border-gray-100 rounded px-2 py-0.5 text-[11px] text-gray-400 font-mono truncate">
                {previewUrl || 'Apercu'}
              </div>
              <span className="text-[10px] text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">Live</span>
            </div>

            {/* Live rendered premium page */}
            <div className="flex-1 overflow-y-auto">
              <StoreProductPagePremium
                product={product}
                store={activeStore}
                productPageConfig={liveProductPageConfig}
                subdomain={subdomain}
                pixels={null}
                prefix=""
              />
            </div>
          </div>
        </div>
      </div>
      <BuilderAIChatWidget
        productPageConfig={config}
        theme={config?.design || {}}
        productName={product?.name || ''}
        onApplyChanges={(patch) => {
          updateConfig((prev) => {
            const updated = { ...(prev || {}) };
            if (patch.design) updated.design = { ...(updated.design || {}), ...patch.design };
            if (patch.premiumPage) {
              const existing = updated.premiumPage || {};
              const next = patch.premiumPage;
              updated.premiumPage = {
                ...existing,
                ...next,
                ...(next.hero ? { hero: { ...(existing.hero || {}), ...next.hero } } : {}),
                ...(next.faq ? { faq: { ...(existing.faq || {}), ...next.faq } } : {}),
                ...(next.problemSection ? { problemSection: { ...(existing.problemSection || {}), ...next.problemSection } } : {}),
                ...(next.mechanismSection ? { mechanismSection: { ...(existing.mechanismSection || {}), ...next.mechanismSection } } : {}),
                ...(next.closingSection ? { closingSection: { ...(existing.closingSection || {}), ...next.closingSection } } : {}),
              };
            }
            if (patch.premiumImages) updated.premiumImages = { ...(updated.premiumImages || {}), ...patch.premiumImages };
            if (patch.button) updated.button = { ...(updated.button || {}), ...patch.button };
            if (patch.whatsapp) updated.whatsapp = { ...(updated.whatsapp || {}), ...patch.whatsapp };
            if (patch.floatingElements) updated.floatingElements = { ...(updated.floatingElements || {}), ...patch.floatingElements };
            if (patch.customHtml !== undefined) updated.customHtml = patch.customHtml;
            if (patch.customCss !== undefined) updated.customCss = (updated.customCss ? updated.customCss + '\n' : '') + patch.customCss;
            if (patch.customJs !== undefined) updated.customJs = (updated.customJs ? updated.customJs + '\n' : '') + patch.customJs;
            if (patch.customSections !== undefined) updated.customSections = Array.isArray(patch.customSections) && patch.customSections.length === 0 ? [] : [...(updated.customSections || []), ...patch.customSections];
            if (Array.isArray(patch.sectionOrder)) updated.sectionOrder = patch.sectionOrder;
            if (Array.isArray(patch.hiddenSections)) updated.hiddenSections = patch.hiddenSections;
            return updated;
          });
        }}
        onApplyTheme={(themePatch) => {
          updateConfig((prev) => ({
            ...(prev || {}),
            design: { ...((prev || {}).design || {}), ...themePatch },
          }));
        }}
      />
    </div>
  );
};

export default PremiumPageBuilder;
