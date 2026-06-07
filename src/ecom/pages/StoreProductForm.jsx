import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Save, Image, Plus, X, Loader2, AlertCircle, CheckCircle,
  Search, PackageSearch, Link, Sparkles, Globe, FileText, ChevronDown,
  ChevronUp, ShoppingBag, Layers, ChevronRight, Target, Lightbulb,
  BarChart3, Star, Shield, Zap, BookOpen, Type, Trash2, Download,
  Upload, ExternalLink, HelpCircle
} from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';
import AlibabaImportModal from '../components/AlibabaImportModal.jsx';
import RichTextEditor from '../components/RichTextEditor.jsx';
import QuantityOffersManager from '../components/QuantityOffersManager.jsx';
import ReviewGenerator from '../components/ReviewGenerator.jsx';
import { getErrorMessage } from '../utils/errorMessages.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function markdownImagesToHtml(md) {
  if (!md) return md;
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
    `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;" loading="lazy" />`
  );
}

function buildProductCarouselImages(productData = {}, fallbackName = '') {
  const seen = new Set();
  const output = [];
  const push = (entry, fallbackAlt, type = '') => {
    const url = typeof entry === 'string' ? entry : entry?.url;
    if (!url || seen.has(url)) return;
    seen.add(url);
    output.push({ url, alt: typeof entry === 'string' ? fallbackAlt : (entry?.alt || fallbackAlt), order: output.length, ...(type ? { type } : {}) });
  };
  const productName = productData.name || productData.title || fallbackName || 'Produit';
  const incomingImages = Array.isArray(productData.images) ? productData.images : [];
  const beforeAfterImages = Array.isArray(productData.beforeAfterImages) && productData.beforeAfterImages.length > 0
    ? productData.beforeAfterImages
    : (productData.beforeAfterImage ? [productData.beforeAfterImage] : []);
  const anglePosters = Array.isArray(productData.angles)
    ? productData.angles.map(a => a?.poster_url).filter(Boolean) : [];
  incomingImages.forEach((img, i) => push(img, `${productName} — image ${i + 1}`, img?.type || 'product'));
  push(productData.heroImage, productName, 'hero');
  beforeAfterImages.forEach((img, i) => push(img, `${productName} — avant/après ${i + 1}`, 'social-proof-before-after'));
  push(productData.heroPosterImage, `${productName} — visuel principal`, 'hero-poster');
  anglePosters.forEach((url, i) => push(url, `${productName} — argument ${i + 1}`, 'angle-poster'));
  if (!output.length) incomingImages.slice(0, 2).forEach((img, i) => push(img, `${productName} — image ${i + 1}`, img?.type || 'product'));
  return output;
}

const isPremiumPageData = (pageData = {}, productPageConfig = {}) => (
  pageData?.pageStyle === 'premium'
  || pageData?.layout === 'premium_product_page'
  || pageData?.theme === 'premium_product'
  || Boolean(pageData?.premium_page)
  || productPageConfig?.pageStyle === 'premium'
  || productPageConfig?.theme === 'premium_product'
  || Boolean(productPageConfig?.premiumPage)
);

const syncPageDataHeroImage = (pageData, primaryImage, productPageConfig) => {
  if (!pageData) return pageData;
  if (isPremiumPageData(pageData, productPageConfig)) {
    return {
      ...pageData,
      heroImage: pageData.heroImage || pageData.premiumImages?.hero || primaryImage || null,
    };
  }
  return { ...pageData, heroImage: primaryImage };
};

function clearPublicStoreSessionCaches() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const keys = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    if (k && (k.startsWith('sf_') || k.startsWith('sfp_'))) keys.push(k);
  }
  keys.forEach(k => window.sessionStorage.removeItem(k));
}

const MARKET_COUNTRY_SUGGESTIONS = [
  'Cameroun', "Cote d'Ivoire", 'Sénégal', 'Bénin', 'Togo', 'Gabon',
  'RDC', 'Congo', 'Nigeria', 'Ghana', 'Guinée', 'Mali', 'Burkina Faso',
  'Maroc', 'Tunisie', 'France',
];
const MARKET_CURRENCY_SUGGESTIONS = ['XAF', 'XOF', 'EUR', 'USD', 'NGN', 'GHS', 'KES', 'MAD', 'DZD', 'TND', 'GNF', 'CDF'];

// ── Toast ─────────────────────────────────────────────────────────────────────

const Toast = ({ toast, onDismiss }) => {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm animate-slide-in ${
      isErr ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
    }`}>
      {isErr ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-70 hover:opacity-100 flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ── Section wrapper ───────────────────────────────────────────────────────────

const SectionRow = ({ icon, label, open, onToggle, children }) => (
  <div className="border-b border-gray-100 last:border-b-0">
    <button type="button" onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition text-left">
      <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">{icon}{label}</span>
      {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
    </button>
    {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

const inputCls = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition placeholder-gray-300";
const textareaCls = `${inputCls} resize-none`;

// ── Main Component ────────────────────────────────────────────────────────────

const StoreProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const isEdit = !!id;
  const navState = location.state?.prefill || null;
  // Quand on arrive depuis le générateur de page produit : page publiée,
  // stock pré-rempli et prix par défaut, pour que la page soit live tout de suite.
  const fromGenerator = location.state?.fromGenerator || false;

  // ── Core state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Image upload state ──────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // ── Picker state ─────────────────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [pickerProducts, setPickerProducts] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linkedProduct, setLinkedProduct] = useState(null);
  const searchTimeout = useRef(null);

  // ── Collapsible sections ──────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showAlibabaModal, setShowAlibabaModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInputType, setAiInputType] = useState('description');
  const [aiInput, setAiInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiGenerated, setAiGenerated] = useState(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: navState?.name || '',
    description: navState?.description || '',
    price: navState?.price || (fromGenerator ? '10000' : ''),
    compareAtPrice: '',
    currency: navState?.currency || '',
    targetMarket: navState?.targetMarket || '',
    country: navState?.country || '',
    city: navState?.city || '',
    locale: navState?.locale || '',
    stock: fromGenerator ? '1000' : '0',
    category: navState?.category || '',
    tags: navState?.tags || '',
    isPublished: fromGenerator,
    seoTitle: navState?.seoTitle || '',
    seoDescription: navState?.seoDescription || '',
    images: navState?.images || [],
    linkedProductId: null,
    testimonials: navState?._pageData?.testimonials || [],
    faq: navState?._pageData?.faq || [],
    _pageData: navState?._pageData || null,
    productPageConfig: navState?.productPageConfig || null,
  });

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Load product (edit mode) ──────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const res = await storeProductsApi.getProduct(id);
        const p = res.data?.data;
        if (p) {
          setForm({
            name: p.name || '',
            description: p.description || '',
            price: String(p.price ?? ''),
            compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
            currency: p.currency || '',
            targetMarket: p.targetMarket || '',
            country: p.country || '',
            city: p.city || '',
            locale: p.locale || '',
            stock: String(p.stock ?? '0'),
            category: p.category || '',
            tags: (p.tags || []).join(', '),
            isPublished: p.isPublished || false,
            seoTitle: p.seoTitle || '',
            seoDescription: p.seoDescription || '',
            images: p.images || [],
            linkedProductId: p.linkedProductId || null,
            testimonials: p.testimonials || [],
            faq: p.faq || [],
            _pageData: p._pageData || null,
            productPageConfig: p.productPageConfig || null,
          });
          if (p.linkedProductId) setLinkedProduct({ _id: p.linkedProductId, name: p.name });
        }
      } catch {
        showToast('error', 'Impossible de charger le produit');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, showToast]);

  // ── Picker debounced search ───────────────────────────────────────────────
  useEffect(() => {
    if (!showPicker) return;
    clearTimeout(searchTimeout.current);
    setPickerLoading(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await storeProductsApi.getSystemProducts(pickerSearch);
        setPickerProducts(res.data?.data || []);
      } catch {
        setPickerProducts([]);
      } finally {
        setPickerLoading(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [pickerSearch, showPicker]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const syncHeroWithImages = (updater) => {
    setForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const images = Array.isArray(next.images) ? next.images : [];
      const primaryImage = images[0]?.url || null;
      const nextPageData = next._pageData || prev._pageData || null;
      const nextProductPageConfig = next.productPageConfig || prev.productPageConfig || null;
      return { ...next, _pageData: syncPageDataHeroImage(nextPageData, primaryImage, nextProductPageConfig) };
    });
  };

  const getPageData = (key, fallback) => form._pageData?.[key] ?? fallback;
  const setPageData = (key, value) =>
    setForm(prev => ({ ...prev, _pageData: { ...(prev._pageData || {}), [key]: value } }));

  // ── Image handlers ────────────────────────────────────────────────────────
  const addPhotos = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    const errors = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name} dépasse 5 MB`);
        continue;
      }
      try {
        const res = await storeProductsApi.uploadImages([file]);
        const uploaded = res.data?.data?.[0];
        if (!uploaded?.url) throw new Error('URL manquante dans la réponse');
        syncHeroWithImages(prev => ({
          ...prev,
          images: [...prev.images, { url: uploaded.url, alt: prev.name || file.name, order: prev.images.length }],
        }));
      } catch (err) {
        errors.push(`${file.name} : ${err?.response?.data?.message || err.message || 'Erreur upload'}`);
      }
    }
    setUploading(false);
    if (errors.length) showToast('error', errors.join(' — '));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addPhotos(e.dataTransfer.files);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleRemoveImage = (index) =>
    syncHeroWithImages(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));

  const handleMoveImage = (index, direction) =>
    syncHeroWithImages(prev => {
      const imgs = [...prev.images];
      const target = index + direction;
      if (target < 0 || target >= imgs.length) return prev;
      [imgs[index], imgs[target]] = [imgs[target], imgs[index]];
      return { ...prev, images: imgs.map((img, i) => ({ ...img, order: i })) };
    });

  const handleSetHero = (index) => {
    if (index === 0) return;
    syncHeroWithImages(prev => {
      const imgs = [...prev.images];
      const [moved] = imgs.splice(index, 1);
      imgs.unshift(moved);
      return { ...prev, images: imgs.map((img, i) => ({ ...img, order: i })) };
    });
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    syncHeroWithImages(prev => ({
      ...prev,
      images: [...prev.images, { url: imageUrlInput.trim(), alt: prev.name, order: prev.images.length }],
    }));
    setImageUrlInput('');
  };

  // ── Picker ────────────────────────────────────────────────────────────────
  const handlePickProduct = (product) => {
    setForm(prev => ({ ...prev, name: product.name, price: String(product.sellingPrice ?? ''), linkedProductId: product._id }));
    setLinkedProduct(product);
    setShowPicker(false);
    setPickerSearch('');
  };

  const handleUnlinkProduct = () => {
    setLinkedProduct(null);
    setForm(prev => ({ ...prev, linkedProductId: null }));
  };

  // ── AI ────────────────────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiGenerated(null);
    try {
      const res = await storeProductsApi.generateProduct(aiInput.trim(), aiInputType);
      setAiGenerated(res.data?.data || null);
    } catch (err) {
      setAiError(err?.response?.data?.message || 'Erreur lors de la génération');
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAiGenerated = () => {
    if (!aiGenerated) return;
    let desc = aiGenerated.description || '';
    if (aiGenerated.benefits) {
      aiGenerated.benefits.forEach((b, i) => {
        if (b.generated_image_url) {
          desc = desc.replace(`{{IMAGE_${i + 1}}}`, `![${b.benefit_title || 'Image'}](${b.generated_image_url})`);
          desc = desc.replace(`![Marketing Image ${i + 1}](image_${i + 1})`, `![${b.benefit_title || 'Image'}](${b.generated_image_url})`);
        }
      });
    }
    const nextImages = buildProductCarouselImages(aiGenerated, aiGenerated.name || form.name);
    syncHeroWithImages(prev => ({
      ...prev,
      name: aiGenerated.name || prev.name,
      description: markdownImagesToHtml(desc) || prev.description,
      category: aiGenerated.category || prev.category,
      tags: (aiGenerated.tags || []).join(', '),
      seoTitle: aiGenerated.seoTitle || prev.seoTitle,
      seoDescription: aiGenerated.seoDescription || prev.seoDescription,
      price: aiGenerated.suggestedPrice > 0 ? String(aiGenerated.suggestedPrice) : prev.price,
      images: nextImages.length > 0 ? nextImages : prev.images,
    }));
    setShowAiModal(false);
    setAiInput('');
    setAiGenerated(null);
    setAiError('');
    showToast('success', 'Fiche produit générée par IA — vérifiez et enregistrez.');
  };

  const handleAlibabaApply = (productData) => {
    let desc = productData.description || '';
    if (productData.benefits) {
      productData.benefits.forEach((b, i) => {
        if (b.generated_image_url) {
          desc = desc.replace(`{{IMAGE_${i + 1}}}`, `![${b.benefit_title || 'Image'}](${b.generated_image_url})`);
          desc = desc.replace(`![Marketing Image ${i + 1}](image_${i + 1})`, `![${b.benefit_title || 'Image'}](${b.generated_image_url})`);
        }
      });
    }
    const imgs = buildProductCarouselImages(productData, productData.name || form.name);
    syncHeroWithImages(prev => ({
      ...prev,
      name: productData.name || prev.name,
      description: markdownImagesToHtml(desc) || prev.description,
      price: productData.price || prev.price,
      category: productData.category || prev.category,
      tags: productData.tags || prev.tags,
      seoTitle: productData.seoTitle || prev.seoTitle,
      seoDescription: productData.seoDescription || prev.seoDescription,
      images: imgs.length > 0 ? imgs : prev.images,
      testimonials: productData._pageData?.testimonials?.length > 0 ? productData._pageData.testimonials : prev.testimonials,
      faq: productData._pageData?.faq?.length > 0 ? productData._pageData.faq : prev.faq,
      _pageData: productData._pageData || prev._pageData,
      productPageConfig: productData.productPageConfig || prev.productPageConfig,
    }));
    showToast('success', 'Données Alibaba importées — vérifiez et enregistrez.');
  };

  // ── CSV ───────────────────────────────────────────────────────────────────
  const handleExportProductCsv = async () => {
    if (!id) return;
    setCsvBusy(true);
    try {
      const res = await storeProductsApi.exportProductCsv(id);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `page-produit-${form.slug || id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast('error', 'Impossible d\'exporter ce produit en CSV');
    } finally {
      setCsvBusy(false);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('error', 'Le nom du produit est obligatoire.'); return; }
    if (!form.price) { showToast('error', 'Le prix du produit est obligatoire.'); return; }

    setSaving(true);
    const primaryImage = form.images?.[0]?.url || null;
    const syncedPageData = syncPageDataHeroImage(form._pageData, primaryImage, form.productPageConfig);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
      currency: String(form.currency || '').trim().toUpperCase(),
      targetMarket: form.targetMarket.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      locale: form.locale.trim(),
      stock: parseInt(form.stock) || 0,
      category: form.category.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      isPublished: form.isPublished,
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      images: form.images,
      linkedProductId: form.linkedProductId || null,
      ...(form.productPageConfig && { productPageConfig: form.productPageConfig }),
      ...(form.testimonials?.length > 0 && { testimonials: form.testimonials }),
      ...(form.faq?.length > 0 && { faq: form.faq }),
      ...(syncedPageData && { _pageData: syncedPageData }),
    };

    try {
      if (isEdit) {
        await storeProductsApi.updateProduct(id, payload);
        clearPublicStoreSessionCaches();
        showToast('success', 'Produit mis à jour avec succès');
      } else {
        await storeProductsApi.createProduct(payload);
        clearPublicStoreSessionCaches();
        showToast('success', 'Produit créé avec succès');
        setTimeout(() => navigate(`${basePath}/products`), 1200);
      }
    } catch (err) {
      showToast('error', getErrorMessage(err, 'Impossible de sauvegarder le produit.'));
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 rounded-full border-[3px] border-gray-200 border-t-primary-600 animate-spin" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f1f2f4]">
      <style>{`
        @keyframes slide-in { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        .animate-slide-in { animation: slide-in 0.2s ease; }
      `}</style>

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`${basePath}/products`)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 hidden sm:block">Produits boutique</p>
            <h1 className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {isEdit ? (form.name || 'Modifier le produit') : 'Nouveau produit'}
            </h1>
          </div>

          {/* Status badge */}
          <button
            type="button"
            onClick={() => handleChange('isPublished', !form.isPublished)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              form.isPublished
                ? 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${form.isPublished ? 'bg-primary-500' : 'bg-gray-400'}`} />
            {form.isPublished ? 'Actif' : 'Brouillon'}
          </button>

          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => {
                  const isPremium = isPremiumPageData(form._pageData, form.productPageConfig);
                  navigate(`${basePath}/products/${id}/${isPremium ? 'premium-builder' : 'builder'}`);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" /> Page Builder
              </button>
            )}
            <button
              type="submit"
              form="store-product-form"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 disabled:opacity-60 transition shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <form id="store-product-form" onSubmit={handleSubmit}>
          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Titre & Description */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Nom du produit"
                  className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 border-0 outline-none focus:ring-0 p-0 bg-transparent"
                  required
                />
                <div className="border-t border-gray-100 pt-4">
                  <RichTextEditor
                    value={form.description}
                    onChange={(html) => handleChange('description', html)}
                    placeholder="Décrivez votre produit : avantages, matière, utilisation…"
                    minHeight={160}
                    maxHeight={500}
                  />
                </div>
              </div>

              {/* ── Images ─────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Image className="w-4 h-4 text-gray-400" />
                    Images
                    {form.images.length > 0 && (
                      <span className="text-xs text-gray-400 font-normal">
                        {form.images.length} photo{form.images.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h2>
                  {uploading && (
                    <span className="flex items-center gap-1.5 text-xs text-primary-600 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Upload en cours...
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {form.images.length === 0 ? (
                    /* Empty — big drop zone */
                    <label
                      className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                        dragOver
                          ? 'border-primary-400 bg-primary-50 scale-[1.01]'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => addPhotos(e.target.files)} disabled={uploading}
                      />
                      <div className={`flex flex-col items-center gap-3 pointer-events-none ${dragOver ? 'text-primary-600' : 'text-gray-400'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition ${dragOver ? 'bg-primary-100' : 'bg-gray-100'}`}>
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-700">
                            {dragOver ? 'Déposez vos images ici' : 'Glissez-déposez vos images'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">ou cliquez pour parcourir · JPG, PNG, WebP · max 5 MB</p>
                        </div>
                        {!dragOver && (
                          <span className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 shadow-sm">
                            Sélectionner des fichiers
                          </span>
                        )}
                      </div>
                    </label>
                  ) : (
                    /* Grid of images */
                    <div
                      className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 p-1 rounded-xl transition ${dragOver ? 'ring-2 ring-primary-400 ring-inset bg-primary-50/50' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {form.images.map((img, i) => (
                        <div key={img.url || i} className="relative group aspect-square">
                          <img
                            src={img.url}
                            alt={img.alt || form.name}
                            className={`w-full h-full rounded-xl object-cover transition ${
                              i === 0
                                ? 'ring-2 ring-primary-500 ring-offset-1'
                                : 'ring-1 ring-gray-200'
                            }`}
                            loading="lazy"
                          />
                          {/* Main badge */}
                          {i === 0 && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-primary-600 text-white text-[9px] font-bold rounded-md leading-none">
                              PRINCIPALE
                            </span>
                          )}
                          {/* Hover overlay */}
                          <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                            {i !== 0 && (
                              <button type="button" onClick={() => handleSetHero(i)} title="Définir comme principale"
                                className="p-1.5 bg-white/95 rounded-lg text-amber-600 hover:bg-white transition text-sm font-bold leading-none shadow-sm">
                                ★
                              </button>
                            )}
                            {i > 0 && (
                              <button type="button" onClick={() => handleMoveImage(i, -1)} title="Déplacer à gauche"
                                className="p-1.5 bg-white/95 rounded-lg text-gray-700 hover:bg-white transition shadow-sm">
                                <ChevronUp className="w-3.5 h-3.5 -rotate-90" />
                              </button>
                            )}
                            {i < form.images.length - 1 && (
                              <button type="button" onClick={() => handleMoveImage(i, 1)} title="Déplacer à droite"
                                className="p-1.5 bg-white/95 rounded-lg text-gray-700 hover:bg-white transition shadow-sm">
                                <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                              </button>
                            )}
                            <button type="button" onClick={() => handleRemoveImage(i)} title="Supprimer"
                              className="p-1.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition shadow-sm">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {/* Add more cell */}
                      <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50 flex flex-col items-center justify-center cursor-pointer transition group">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} disabled={uploading} />
                        {uploading ? (
                          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-5 h-5 text-gray-300 group-hover:text-primary-500 transition" />
                            <span className="text-[10px] text-gray-300 group-hover:text-primary-500 mt-1 transition font-medium">Ajouter</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}

                  {/* URL input */}
                  <div className="flex gap-2 mt-4">
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageUrl(); } }}
                      placeholder="Ou collez une URL d'image..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-300"
                    />
                    <button type="button" onClick={handleAddImageUrl} disabled={!imageUrlInput.trim()}
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition font-medium whitespace-nowrap">
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Prix & Stock ─────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Prix & Stock</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Prix *</label>
                    <div className="relative">
                      <input type="number" value={form.price} onChange={(e) => handleChange('price', e.target.value)}
                        placeholder="15000" min="0" step="any" required
                        className="w-full px-3 py-2.5 pr-14 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                        {form.currency || 'FCFA'}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Ancien prix</label>
                    <input type="number" value={form.compareAtPrice} onChange={(e) => handleChange('compareAtPrice', e.target.value)}
                      placeholder="20000" min="0" step="any" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Devise</label>
                    <select value={form.currency} onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                      className={`${inputCls} bg-white`}>
                      <option value="">Boutique</option>
                      {[...new Set([...(form.currency && !MARKET_CURRENCY_SUGGESTIONS.includes(form.currency) ? [form.currency] : []), ...MARKET_CURRENCY_SUGGESTIONS])].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Stock</label>
                    <input type="number" value={form.stock} onChange={(e) => handleChange('stock', e.target.value)}
                      min="0" className={inputCls} />
                  </div>
                </div>

                {/* Marché */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Marché cible</label>
                    <input type="text" value={form.targetMarket} onChange={(e) => handleChange('targetMarket', e.target.value)}
                      placeholder="Ex: Afrique francophone" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Pays cible</label>
                    <select value={form.country} onChange={(e) => handleChange('country', e.target.value)} className={`${inputCls} bg-white`}>
                      <option value="">Choisir un pays</option>
                      {[...new Set([...(form.country && !MARKET_COUNTRY_SUGGESTIONS.includes(form.country) ? [form.country] : []), ...MARKET_COUNTRY_SUGGESTIONS])].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Organisation ─────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Organisation</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Catégorie</label>
                    <input type="text" value={form.category} onChange={(e) => handleChange('category', e.target.value)}
                      placeholder="Ex: Vêtements, Beauté…" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">Tags</label>
                    <input type="text" value={form.tags} onChange={(e) => handleChange('tags', e.target.value)}
                      placeholder="promo, nouveau, bestseller" className={inputCls} />
                    <p className="text-[11px] text-gray-400 mt-1">Séparez par des virgules</p>
                  </div>
                </div>
              </div>

              {/* ── Sections page produit ────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-gray-900">Sections de la page produit</h2>
                  <span className="ml-auto text-[11px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">Contenu marketing avancé</span>
                </div>

                <SectionRow icon={<Type className="w-4 h-4 text-violet-500" />} label="Hero (Accroche)" open={openSections.hero} onToggle={() => toggleSection('hero')}>
                  <Field label="Slogan">
                    <input type="text" value={getPageData('hero_slogan', '')} onChange={(e) => setPageData('hero_slogan', e.target.value)} placeholder="La solution naturelle pour votre peau" className={inputCls} />
                  </Field>
                  <Field label="Baseline (message de confiance)">
                    <input type="text" value={getPageData('hero_baseline', '')} onChange={(e) => setPageData('hero_baseline', e.target.value)} placeholder="✅ Livraison gratuite · Satisfait ou remboursé" className={inputCls} />
                  </Field>
                </SectionRow>

                <SectionRow icon={<Target className="w-4 h-4 text-red-500" />} label="Problème" open={openSections.problem} onToggle={() => toggleSection('problem')}>
                  <Field label="Titre">
                    <input type="text" value={getPageData('problem_section', {})?.title || ''} onChange={(e) => setPageData('problem_section', { ...getPageData('problem_section', {}), title: e.target.value })} placeholder="Le problème" className={inputCls} />
                  </Field>
                  <Field label="Points de douleur (un par ligne)">
                    <textarea value={(getPageData('problem_section', {})?.pain_points || []).join('\n')} onChange={(e) => setPageData('problem_section', { ...getPageData('problem_section', {}), pain_points: e.target.value.split('\n').filter(l => l.trim()) })} placeholder={"Peau sèche et irritée\nProduits chimiques inefficaces"} rows={4} className={textareaCls} />
                  </Field>
                </SectionRow>

                <SectionRow icon={<Lightbulb className="w-4 h-4 text-primary-500" />} label="Solution" open={openSections.solution} onToggle={() => toggleSection('solution')}>
                  <Field label="Titre">
                    <input type="text" value={getPageData('solution_section', {})?.title || ''} onChange={(e) => setPageData('solution_section', { ...getPageData('solution_section', {}), title: e.target.value })} placeholder="La solution" className={inputCls} />
                  </Field>
                  <Field label="Description">
                    <textarea value={getPageData('solution_section', {})?.description || ''} onChange={(e) => setPageData('solution_section', { ...getPageData('solution_section', {}), description: e.target.value })} rows={3} className={textareaCls} />
                  </Field>
                </SectionRow>

                <SectionRow icon={<BarChart3 className="w-4 h-4 text-blue-500" />} label="Statistiques" open={openSections.stats} onToggle={() => toggleSection('stats')}>
                  {(getPageData('stats_bar', []) || []).map((stat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={stat.value || ''} onChange={(e) => { const arr = [...(getPageData('stats_bar', []))]; arr[i] = { ...arr[i], value: e.target.value }; setPageData('stats_bar', arr); }} placeholder="1000+" className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <input type="text" value={stat.label || ''} onChange={(e) => { const arr = [...(getPageData('stats_bar', []))]; arr[i] = { ...arr[i], label: e.target.value }; setPageData('stats_bar', arr); }} placeholder="Clients satisfaits" className={`flex-1 ${inputCls}`} />
                      <button type="button" onClick={() => setPageData('stats_bar', getPageData('stats_bar', []).filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setPageData('stats_bar', [...(getPageData('stats_bar', []) || []), { value: '', label: '' }])} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter une stat</button>
                </SectionRow>

                <SectionRow icon={<Star className="w-4 h-4 text-yellow-500" />} label="Avantages clés" open={openSections.benefits} onToggle={() => toggleSection('benefits')}>
                  <Field label="Avantages (un par ligne)">
                    <textarea value={(getPageData('benefits_bullets', []) || []).join('\n')} onChange={(e) => setPageData('benefits_bullets', e.target.value.split('\n').filter(l => l.trim()))} placeholder={"✅ 100% naturel\n✅ Résultats visibles en 7 jours\n✅ Sans effets secondaires"} rows={4} className={textareaCls} />
                  </Field>
                </SectionRow>

                <SectionRow icon={<Zap className="w-4 h-4 text-orange-500" />} label="Blocs de conversion" open={openSections.conversion} onToggle={() => toggleSection('conversion')}>
                  {(getPageData('conversion_blocks', []) || []).map((block, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={block.icon || ''} onChange={(e) => { const arr = [...(getPageData('conversion_blocks', []))]; arr[i] = { ...arr[i], icon: e.target.value }; setPageData('conversion_blocks', arr); }} placeholder="🚚" className="w-14 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      <input type="text" value={block.text || ''} onChange={(e) => { const arr = [...(getPageData('conversion_blocks', []))]; arr[i] = { ...arr[i], text: e.target.value }; setPageData('conversion_blocks', arr); }} placeholder="Livraison gratuite" className={`flex-1 ${inputCls}`} />
                      <button type="button" onClick={() => setPageData('conversion_blocks', getPageData('conversion_blocks', []).filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setPageData('conversion_blocks', [...(getPageData('conversion_blocks', []) || []), { icon: '', text: '' }])} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter un bloc</button>
                </SectionRow>

                <SectionRow icon={<Shield className="w-4 h-4 text-primary-500" />} label="Offre & Garantie" open={openSections.offer} onToggle={() => toggleSection('offer')}>
                  <Field label="Label de l'offre">
                    <input type="text" value={getPageData('offer_block', {})?.offer_label || ''} onChange={(e) => setPageData('offer_block', { ...getPageData('offer_block', {}), offer_label: e.target.value })} placeholder="Offre spéciale" className={inputCls} />
                  </Field>
                  <Field label="Texte de garantie">
                    <input type="text" value={getPageData('offer_block', {})?.guarantee_text || ''} onChange={(e) => setPageData('offer_block', { ...getPageData('offer_block', {}), guarantee_text: e.target.value })} placeholder="Satisfait ou remboursé sous 30 jours" className={inputCls} />
                  </Field>
                </SectionRow>

                <SectionRow icon={<AlertCircle className="w-4 h-4 text-red-500" />} label="Urgence" open={openSections.urgency} onToggle={() => toggleSection('urgency')}>
                  <Field label="Badge d'urgence">
                    <input type="text" value={getPageData('urgency_badge', '')} onChange={(e) => setPageData('urgency_badge', e.target.value)} placeholder="🔥 Plus que 3 en stock !" className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={getPageData('urgency_elements', {})?.stock_limited || false} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), stock_limited: e.target.checked })} className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                      Stock limité
                    </label>
                    <Field label="Preuve sociale">
                      <input type="number" min="0" value={getPageData('urgency_elements', {})?.social_proof_count || ''} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), social_proof_count: parseInt(e.target.value) || 0 })} placeholder="42" className={inputCls} />
                    </Field>
                    <Field label="Résultat rapide">
                      <input type="text" value={getPageData('urgency_elements', {})?.quick_result || ''} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), quick_result: e.target.value })} placeholder="7 jours" className={inputCls} />
                    </Field>
                  </div>
                </SectionRow>

                <SectionRow icon={<BookOpen className="w-4 h-4 text-indigo-500" />} label="Guide d'utilisation" open={openSections.guide} onToggle={() => toggleSection('guide')}>
                  <textarea value={getPageData('guide_utilisation', '')} onChange={(e) => setPageData('guide_utilisation', e.target.value)} placeholder="Expliquez comment utiliser le produit étape par étape..." rows={4} className={textareaCls} />
                </SectionRow>

                {/* ── Premium: Accordéons Hero + FAQ ──────────────────── */}
                {isPremiumPageData(form._pageData, form.productPageConfig) && (
                  <>
                    <SectionRow icon={<ChevronDown className="w-4 h-4 text-teal-500" />} label="Barres dépliables (sous CTA)" open={openSections.heroAccordions} onToggle={() => toggleSection('heroAccordions')}>
                      {(form.productPageConfig?.premiumPage?.hero?.accordions || []).map((acc, i) => (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                            <button type="button" onClick={() => {
                              const next = { ...form.productPageConfig };
                              const accordions = [...(next.premiumPage?.hero?.accordions || [])];
                              accordions.splice(i, 1);
                              next.premiumPage = { ...next.premiumPage, hero: { ...next.premiumPage?.hero, accordions } };
                              setForm(f => ({ ...f, productPageConfig: next }));
                            }} className="p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <input type="text" value={acc.title || ''} placeholder="Titre" className={inputCls} onChange={(e) => {
                            const next = { ...form.productPageConfig };
                            const accordions = [...(next.premiumPage?.hero?.accordions || [])];
                            accordions[i] = { ...accordions[i], title: e.target.value };
                            next.premiumPage = { ...next.premiumPage, hero: { ...next.premiumPage?.hero, accordions } };
                            setForm(f => ({ ...f, productPageConfig: next }));
                          }} />
                          <textarea value={acc.content || ''} placeholder="Contenu" rows={3} className={textareaCls} onChange={(e) => {
                            const next = { ...form.productPageConfig };
                            const accordions = [...(next.premiumPage?.hero?.accordions || [])];
                            accordions[i] = { ...accordions[i], content: e.target.value };
                            next.premiumPage = { ...next.premiumPage, hero: { ...next.premiumPage?.hero, accordions } };
                            setForm(f => ({ ...f, productPageConfig: next }));
                          }} />
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const next = { ...form.productPageConfig };
                        const accordions = [...(next.premiumPage?.hero?.accordions || []), { title: '', content: '' }];
                        next.premiumPage = { ...next.premiumPage, hero: { ...next.premiumPage?.hero, accordions } };
                        setForm(f => ({ ...f, productPageConfig: next }));
                      }} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter une barre</button>
                    </SectionRow>

                    <SectionRow icon={<HelpCircle className="w-4 h-4 text-orange-500" />} label="FAQ Premium" open={openSections.premiumFaq} onToggle={() => toggleSection('premiumFaq')}>
                      <Field label="Titre de la section">
                        <input type="text" value={form.productPageConfig?.premiumPage?.faq?.headline || ''} className={inputCls} placeholder="Questions fréquentes" onChange={(e) => {
                          const next = { ...form.productPageConfig };
                          next.premiumPage = { ...next.premiumPage, faq: { ...next.premiumPage?.faq, headline: e.target.value } };
                          setForm(f => ({ ...f, productPageConfig: next }));
                        }} />
                      </Field>
                      {(form.productPageConfig?.premiumPage?.faq?.items || []).map((item, i) => (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">Question {i + 1}</span>
                            <button type="button" onClick={() => {
                              const next = { ...form.productPageConfig };
                              const items = [...(next.premiumPage?.faq?.items || [])];
                              items.splice(i, 1);
                              next.premiumPage = { ...next.premiumPage, faq: { ...next.premiumPage?.faq, items } };
                              setForm(f => ({ ...f, productPageConfig: next }));
                            }} className="p-1 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <input type="text" value={item.question || ''} placeholder="Question" className={inputCls} onChange={(e) => {
                            const next = { ...form.productPageConfig };
                            const items = [...(next.premiumPage?.faq?.items || [])];
                            items[i] = { ...items[i], question: e.target.value };
                            next.premiumPage = { ...next.premiumPage, faq: { ...next.premiumPage?.faq, items } };
                            setForm(f => ({ ...f, productPageConfig: next }));
                          }} />
                          <textarea value={item.answer || ''} placeholder="Réponse" rows={2} className={textareaCls} onChange={(e) => {
                            const next = { ...form.productPageConfig };
                            const items = [...(next.premiumPage?.faq?.items || [])];
                            items[i] = { ...items[i], answer: e.target.value };
                            next.premiumPage = { ...next.premiumPage, faq: { ...next.premiumPage?.faq, items } };
                            setForm(f => ({ ...f, productPageConfig: next }));
                          }} />
                        </div>
                      ))}
                      <button type="button" onClick={() => {
                        const next = { ...form.productPageConfig };
                        const items = [...(next.premiumPage?.faq?.items || []), { question: '', answer: '' }];
                        next.premiumPage = { ...next.premiumPage, faq: { ...next.premiumPage?.faq, items } };
                        setForm(f => ({ ...f, productPageConfig: next }));
                      }} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Ajouter une question</button>
                    </SectionRow>
                  </>
                )}
              </div>

              {/* ── Offres quantité ──────────────────────────────────────── */}
              {isEdit && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <QuantityOffersManager productId={id} />
                </div>
              )}

              {/* ── Avis clients ─────────────────────────────────────────── */}
              <ReviewGenerator
                productDescription={form.description || form.name}
                existingTestimonials={form.testimonials || []}
                onSave={(testimonials) => setForm(f => ({ ...f, testimonials }))}
              />

              {/* ── SEO ─────────────────────────────────────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Référencement (SEO)</h2>
                <Field label="Titre SEO" hint={`${(form.seoTitle || form.name).length}/70 caractères`}>
                  <input type="text" value={form.seoTitle} onChange={(e) => handleChange('seoTitle', e.target.value)}
                    placeholder={form.name || 'Titre pour les moteurs de recherche'} maxLength={70} className={inputCls} />
                </Field>
                <Field label="Description SEO" hint={`${form.seoDescription.length}/160 caractères`}>
                  <textarea value={form.seoDescription} onChange={(e) => handleChange('seoDescription', e.target.value)}
                    placeholder="Description courte pour Google..." rows={2} maxLength={160} className={textareaCls} />
                </Field>
              </div>

              {/* Bottom save (mobile) */}
              <div className="lg:hidden pb-6">
                <button type="submit" disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 disabled:opacity-60 transition shadow-md">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Enregistrement...' : 'Enregistrer le produit'}
                </button>
              </div>
            </div>

            {/* ── RIGHT SIDEBAR ─────────────────────────────────────────── */}
            <div className="lg:w-72 xl:w-80 flex-shrink-0 space-y-4 lg:sticky lg:top-20">

              {/* Status + Save */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Statut</h3>
                <button
                  type="button"
                  onClick={() => handleChange('isPublished', !form.isPublished)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition ${
                    form.isPublished
                      ? 'border-primary-300 bg-primary-50 hover:bg-primary-100'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${form.isPublished ? 'bg-primary-500' : 'bg-gray-300'}`} />
                    <span className="text-sm font-semibold text-gray-800">{form.isPublished ? 'Actif' : 'Brouillon'}</span>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                    form.isPublished ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {form.isPublished ? 'Visible' : 'Masqué'}
                  </span>
                </button>
                <p className="text-[11px] text-gray-400 text-center">
                  {form.isPublished ? 'Visible sur votre boutique' : 'Cliquez pour rendre visible'}
                </p>
                <button
                  type="submit"
                  form="store-product-form"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 disabled:opacity-60 transition shadow-md"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              {/* Actions rapides */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</h3>
                <button type="button" onClick={() => setShowAiModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 text-sm font-semibold text-violet-700 hover:from-violet-100 hover:to-indigo-100 transition">
                  <Sparkles className="w-4 h-4 flex-shrink-0" /> Générer avec l'IA
                </button>
                <button type="button" onClick={() => setShowAlibabaModal(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-orange-50 border border-orange-100 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition">
                  <ShoppingBag className="w-4 h-4 flex-shrink-0" /> Importer d'Alibaba
                </button>
                {isEdit && (
                  <button type="button" onClick={() => {
                    const isPremium = isPremiumPageData(form._pageData, form.productPageConfig);
                    navigate(`${basePath}/products/${id}/${isPremium ? 'premium-builder' : 'builder'}`);
                  }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition">
                    <Layers className="w-4 h-4 flex-shrink-0" /> Page Builder
                  </button>
                )}
              </div>

              {/* Lier au catalogue */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Catalogue</h3>
                {linkedProduct ? (
                  <div className="flex items-center gap-2 p-3 bg-primary-50 border border-primary-200 rounded-xl">
                    <Link className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary-800 truncate">{linkedProduct.name}</p>
                      {linkedProduct.sellingPrice && (
                        <p className="text-[11px] text-primary-600">{linkedProduct.sellingPrice?.toLocaleString()} XAF</p>
                      )}
                    </div>
                    <button type="button" onClick={handleUnlinkProduct} className="p-1 text-primary-400 hover:text-red-500 transition flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowPicker(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition font-medium">
                    <Search className="w-4 h-4" /> Lier au catalogue
                  </button>
                )}
                <p className="text-[11px] text-gray-400 mt-2 text-center leading-tight">
                  Synchronise les commandes avec votre catalogue
                </p>
              </div>

              {/* Export */}
              {isEdit && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Export</h3>
                  <button type="button" onClick={handleExportProductCsv} disabled={csvBusy}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 font-medium">
                    {csvBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Exporter en CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {showAlibabaModal && (
        <AlibabaImportModal onClose={() => setShowAlibabaModal(false)} onApply={handleAlibabaApply} />
      )}

      {/* AI Generation Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Générer avec l'IA</h3>
                  <p className="text-[11px] text-gray-400">Fiche produit complète en quelques secondes</p>
                </div>
              </div>
              <button type="button" onClick={() => { setShowAiModal(false); setAiGenerated(null); setAiError(''); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex gap-2">
                {[{ id: 'description', label: 'Description', icon: <FileText className="w-3.5 h-3.5" /> }, { id: 'url', label: 'URL source', icon: <Globe className="w-3.5 h-3.5" /> }].map(tab => (
                  <button key={tab.id} type="button" onClick={() => setAiInputType(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                      aiInputType === tab.id
                        ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {aiInputType === 'description' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Décrivez votre produit</label>
                  <textarea autoFocus value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ex: Robe en wax africain 100% coton, taille 38-42, disponible en rouge/bleu/vert, produite artisanalement au Cameroun…"
                    rows={5} className={textareaCls} />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">URL de la source produit</label>
                  <input autoFocus type="url" value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                    placeholder="https://www.alibaba.com/product/..." className={inputCls} />
                  <p className="text-[11px] text-gray-400 mt-1">Alibaba, Amazon, AliExpress, site fournisseur…</p>
                </div>
              )}

              {aiError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {aiError}
                </div>
              )}

              {aiGenerated && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] font-bold text-violet-600 uppercase tracking-wide">Prévisualisation</p>
                  <div><p className="text-[11px] text-gray-400 mb-0.5">Nom</p><p className="text-sm font-bold text-gray-900">{aiGenerated.name}</p></div>
                  {aiGenerated.category && <div><p className="text-[11px] text-gray-400 mb-0.5">Catégorie</p><p className="text-sm text-gray-700">{aiGenerated.category}</p></div>}
                  {aiGenerated.suggestedPrice > 0 && <div><p className="text-[11px] text-gray-400 mb-0.5">Prix suggéré</p><p className="text-sm font-bold text-primary-700">{aiGenerated.suggestedPrice.toLocaleString()} XAF</p></div>}
                  <div><p className="text-[11px] text-gray-400 mb-0.5">Description</p><p className="text-sm text-gray-600 line-clamp-3">{aiGenerated.description}</p></div>
                  {aiGenerated.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiGenerated.tags.map((t, i) => <span key={i} className="px-2 py-0.5 bg-white border border-violet-200 text-violet-700 text-[11px] rounded-full font-medium">{t}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
              {!aiGenerated ? (
                <button type="button" onClick={handleAiGenerate} disabled={!aiInput.trim() || aiGenerating}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-sm">
                  {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération…</> : <><Sparkles className="w-4 h-4" /> Générer</>}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => { setAiGenerated(null); setAiError(''); }}
                    className="px-4 py-2.5 border border-gray-200 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-50 transition">
                    Regénérer
                  </button>
                  <button type="button" onClick={applyAiGenerated}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-bold rounded-xl hover:bg-primary-700 transition shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Appliquer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Choisir un produit du catalogue</h3>
              <button type="button" onClick={() => setShowPicker(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Rechercher un produit…"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 rounded-full border-2 border-gray-200 border-t-primary-600 animate-spin" />
                </div>
              ) : pickerProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {pickerSearch ? 'Aucun produit trouvé' : 'Aucun produit dans le catalogue'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {pickerProducts.map(p => (
                    <li key={p._id}>
                      <button type="button" onClick={() => handlePickProduct(p)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-primary-50 text-left transition group">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-800">{p.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{p.status} · stock {p.stock}</p>
                        </div>
                        <span className="text-sm font-bold text-primary-700 ml-3 flex-shrink-0">
                          {p.sellingPrice?.toLocaleString()} XAF
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductForm;
