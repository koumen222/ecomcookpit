import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Image, Plus, X, Loader2, AlertCircle, CheckCircle, Search, PackageSearch, Link, Sparkles, Globe, FileText, ChevronDown, ChevronUp, ShoppingBag, Layers, ChevronRight, Target, Lightbulb, BarChart3, Star, Shield, Zap, BookOpen, Type, Trash2, Download } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';
import AlibabaImportModal from '../components/AlibabaImportModal.jsx';
import RichTextEditor from '../components/RichTextEditor.jsx';
import QuantityOffersManager from '../components/QuantityOffersManager.jsx';
import ReviewGenerator from '../components/ReviewGenerator.jsx';
import { getErrorMessage } from '../utils/errorMessages.js';

/**
 * Convert markdown image syntax to HTML <img> tags
 * e.g. ![alt](url) → <img src="url" alt="alt" style="max-width:100%;height:auto;" />
 */
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
    output.push({
      url,
      alt: typeof entry === 'string' ? fallbackAlt : (entry?.alt || fallbackAlt),
      order: output.length,
      ...(type ? { type } : {}),
    });
  };

  const productName = productData.name || productData.title || fallbackName || 'Produit';
  const incomingImages = Array.isArray(productData.images) ? productData.images : [];
  const beforeAfterImages = Array.isArray(productData.beforeAfterImages) && productData.beforeAfterImages.length > 0
    ? productData.beforeAfterImages
    : (productData.beforeAfterImage ? [productData.beforeAfterImage] : []);
  const anglePosters = Array.isArray(productData.angles)
    ? productData.angles.map((angle) => angle?.poster_url).filter(Boolean)
    : [];

  incomingImages.forEach((image, index) => {
    push(image, `${productName} — image ${index + 1}`, image?.type || 'product');
  });

  push(productData.heroImage, productName, 'hero');
  beforeAfterImages.forEach((image, index) => {
    push(image, `${productName} — avant / après ${index + 1}`, 'social-proof-before-after');
  });
  push(productData.heroPosterImage, `${productName} — visuel principal`, 'hero-poster');

  anglePosters.forEach((imageUrl, index) => {
    push(imageUrl, `${productName} — argument ${index + 1}`, 'angle-poster');
  });

  if (!output.length) {
    incomingImages.slice(0, 2).forEach((image, index) => {
      push(image, `${productName} — image ${index + 1}`, image?.type || 'product');
    });
  }

  return output;
}

function clearPublicStoreSessionCaches() {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const keysToRemove = [];
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key) continue;
    if (key.startsWith('sf_') || key.startsWith('sfp_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
}

const MARKET_COUNTRY_SUGGESTIONS = [
  'Cameroun',
  'Cote d\'Ivoire',
  'Sénégal',
  'Bénin',
  'Togo',
  'Gabon',
  'RDC',
  'Congo',
  'Nigeria',
  'Ghana',
  'Guinée',
  'Mali',
  'Burkina Faso',
  'Maroc',
  'Tunisie',
  'France'
];

const MARKET_CURRENCY_SUGGESTIONS = ['XAF', 'XOF', 'EUR', 'USD', 'NGN', 'GHS', 'KES', 'MAD', 'DZD', 'TND', 'GNF', 'CDF'];

/**
 * StoreProductForm — Create or edit a store catalog product.
 * Handles image uploads via /store-products/upload,
 * system product picker (link to main catalogue),
 * category, pricing, SEO fields, and publish toggle.
 */
const StoreProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/ecom/boutique') ? '/ecom/boutique' : '/ecom/store';
  const isEdit = !!id;

  // Pre-fill from navigation state (e.g. from StoreProductsList Alibaba import)
  const navState = location.state?.prefill || null;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  // ─── System product picker state ────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [pickerProducts, setPickerProducts] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linkedProduct, setLinkedProduct] = useState(null);
  const searchTimeout = useRef(null);

  // ─── Rich sections (collapsible) ──────────────────────────────────────────
  const [openSections, setOpenSections] = useState({});
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ─── Alibaba Import state ─────────────────────────────────────────────────
  const [showAlibabaModal, setShowAlibabaModal] = useState(false);

  // ─── AI Generation state ──────────────────────────────────────────────────
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInputType, setAiInputType] = useState('description');
  const [aiInput, setAiInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiGenerated, setAiGenerated] = useState(null);

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
    
    // Process description to replace image placeholders with actual markdown
    let processedDescription = aiGenerated.description || '';
    if (aiGenerated.benefits && Array.isArray(aiGenerated.benefits)) {
      aiGenerated.benefits.forEach((benefit, index) => {
        if (benefit.generated_image_url) {
          // Handle {{IMAGE_X}} format
          const placeholder1 = `{{IMAGE_${index + 1}}}`;
          const replacement = `![${benefit.benefit_title || 'Marketing Image'}](${benefit.generated_image_url})`;
          processedDescription = processedDescription.replace(placeholder1, replacement);
          
          // Also handle old format for backwards compatibility
          const placeholder2 = `![Marketing Image ${index + 1}](image_${index + 1})`;
          processedDescription = processedDescription.replace(placeholder2, replacement);
        }
      });
    }
    
    const nextImages = buildProductCarouselImages(aiGenerated, aiGenerated.name || form.name);

    syncHeroWithImages(prev => ({
      ...prev,
      name: aiGenerated.name || prev.name,
      description: markdownImagesToHtml(processedDescription) || prev.description,
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
  };

  const handleAlibabaApply = (productData) => {
    // Process description to replace image placeholders with actual URLs
    let processedDescription = productData.description || '';
    if (productData.benefits && Array.isArray(productData.benefits)) {
      productData.benefits.forEach((benefit, index) => {
        if (benefit.generated_image_url) {
          // Handle {{IMAGE_X}} format
          const placeholder1 = `{{IMAGE_${index + 1}}}`;
          const replacement = `![${benefit.benefit_title || 'Marketing Image'}](${benefit.generated_image_url})`;
          processedDescription = processedDescription.replace(placeholder1, replacement);
          
          // Also handle old format for backwards compatibility
          const placeholder2 = `![Marketing Image ${index + 1}](image_${index + 1})`;
          processedDescription = processedDescription.replace(placeholder2, replacement);
        }
      });
    }
    
    const simpleHeroImages = buildProductCarouselImages(productData, productData.name || form.name);

    syncHeroWithImages(prev => ({
      ...prev,
      name: productData.name || prev.name,
      description: markdownImagesToHtml(processedDescription) || prev.description,
      price: productData.price || prev.price,
      category: productData.category || prev.category,
      tags: productData.tags || prev.tags,
      seoTitle: productData.seoTitle || prev.seoTitle,
      seoDescription: productData.seoDescription || prev.seoDescription,
      images: simpleHeroImages.length > 0 ? simpleHeroImages : prev.images,
      testimonials: productData._pageData?.testimonials?.length > 0 ? productData._pageData.testimonials : prev.testimonials,
      faq: productData._pageData?.faq?.length > 0 ? productData._pageData.faq : prev.faq,
      _pageData: productData._pageData || prev._pageData,
      productPageConfig: productData.productPageConfig || prev.productPageConfig,
    }));
  };

  const [form, setForm] = useState({
    name: navState?.name || '',
    description: navState?.description || '',
    price: navState?.price || '',
    compareAtPrice: '',
    currency: navState?.currency || '',
    targetMarket: navState?.targetMarket || '',
    country: navState?.country || '',
    city: navState?.city || '',
    locale: navState?.locale || '',
    stock: '0',
    category: navState?.category || '',
    tags: navState?.tags || '',
    isPublished: false,
    seoTitle: navState?.seoTitle || '',
    seoDescription: navState?.seoDescription || '',
    images: navState?.images || [],
    linkedProductId: null,
    testimonials: navState?._pageData?.testimonials || [],
    faq: navState?._pageData?.faq || [],
    _pageData: navState?._pageData || null,
    productPageConfig: navState?.productPageConfig || null,
  });

  // Load product for edit mode
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
          if (p.linkedProductId) {
            setLinkedProduct({ _id: p.linkedProductId, name: p.name });
          }
        }
      } catch {
        setError('Impossible de charger le produit');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  // ─── Picker: debounced search ─────────────────────────────────────────────
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

  const handlePickProduct = (product) => {
    setForm(prev => ({
      ...prev,
      name: product.name,
      price: String(product.sellingPrice ?? ''),
      linkedProductId: product._id
    }));
    setLinkedProduct(product);
    setShowPicker(false);
    setPickerSearch('');
  };

  const handleUnlinkProduct = () => {
    setLinkedProduct(null);
    setForm(prev => ({ ...prev, linkedProductId: null }));
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const syncHeroWithImages = (updater) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const images = Array.isArray(next.images) ? next.images : [];
      const primaryImage = images[0]?.url || null;
      const nextPageData = next._pageData || prev._pageData || null;

      return {
        ...next,
        _pageData: nextPageData
          ? {
              ...nextPageData,
              heroImage: primaryImage,
            }
          : nextPageData,
      };
    });
  };

  // ─── _pageData helpers ──────────────────────────────────────────────────
  const getPageData = (key, fallback) => form._pageData?.[key] ?? fallback;
  const setPageData = (key, value) => {
    setForm(prev => ({
      ...prev,
      _pageData: { ...(prev._pageData || {}), [key]: value }
    }));
  };

  // Image upload via existing media API
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setUploading(true);
    setError('');

    try {
      for (const file of files) {
        // Validate file size (max 5MB for mobile-first)
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name} dépasse 5 MB`);
          continue;
        }

        const res = await storeProductsApi.uploadImages([file]);
        const uploaded = res.data?.data?.[0] || {};
        const url = uploaded.url;

        if (!url) {
          console.error('Upload response missing URL', {
            fileName: file.name,
            response: res.data
          });
          throw new Error('Réponse upload invalide (URL manquante)');
        }

        syncHeroWithImages(prev => ({
          ...prev,
          images: [...prev.images, { url, alt: prev.name || file.name, order: prev.images.length }]
        }));
      }
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      const fallbackMessage = err?.message || 'Erreur lors de l\'upload de l\'image';
      console.error('Image upload failed', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data
      });
      setError(apiMessage || fallbackMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (index) => {
    syncHeroWithImages(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleMoveImage = (index, direction) => {
    syncHeroWithImages(prev => {
      const imgs = [...prev.images];
      const target = index + direction;
      if (target < 0 || target >= imgs.length) return prev;
      [imgs[index], imgs[target]] = [imgs[target], imgs[index]];
      return { ...prev, images: imgs.map((img, i) => ({ ...img, order: i })) };
    });
  };

  const handleSetHero = (index) => {
    if (index === 0) return;
    syncHeroWithImages(prev => {
      const imgs = [...prev.images];
      const [moved] = imgs.splice(index, 1);
      imgs.unshift(moved);
      return { ...prev, images: imgs.map((img, i) => ({ ...img, order: i })) };
    });
  };

  // Add image by URL (for users who host elsewhere)
  const [imageUrlInput, setImageUrlInput] = useState('');
  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    syncHeroWithImages(prev => ({
      ...prev,
      images: [...prev.images, { url: imageUrlInput.trim(), alt: prev.name, order: prev.images.length }]
    }));
    setImageUrlInput('');
  };

  const handleExportProductCsv = async () => {
    if (!id) return;
    setCsvBusy(true);
    setError('');
    try {
      const response = await storeProductsApi.exportProductCsv(id);
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `page-produit-${form.slug || id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Impossible d’exporter ce produit en CSV');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addPhotos(e.dataTransfer.files);
  };

  const handleImageUploadNew = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('workspaceId', localStorage.getItem('workspaceId') || 'default');
        
        const API_ORIGIN = (() => {
          const raw = String(import.meta.env.VITE_BACKEND_URL || '').trim();
          if (typeof window !== 'undefined' && window.location.hostname.endsWith('scalor.net')) {
            return 'https://api.scalor.net';
          }
          if (/^https?:\/\//i.test(raw)) {
            try { return new URL(raw).origin; } catch { /* noop */ }
          }
          if (raw.startsWith('/')) {
            return typeof window !== 'undefined' ? window.location.origin : 'https://api.scalor.net';
          }
          return 'https://api.scalor.net';
        })();
        
        try {
          const response = await fetch(`${API_ORIGIN}/api/ecom/store-products/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('ecomToken')}`,
              'X-Workspace-Id': localStorage.getItem('workspaceId') || ''
            },
            body: formData
          });
          
          console.log('Upload response status:', response.status);
          const result = await response.json();
          console.log('Upload result:', result);
          
          if (result.success && result.data && result.data.length > 0) {
            // Use the first uploaded image
            const imageUrl = result.data[0].url;
            console.log('Inserting image:', imageUrl);
            
            // Get the contentEditable div
            const editor = document.querySelector('[contenteditable="true"]');
            if (editor) {
              editor.focus();
              // Insert image at cursor position
              const img = document.createElement('img');
              img.src = imageUrl;
              img.style.maxWidth = '100%';
              img.style.height = 'auto';
              img.style.display = 'block';
              img.style.margin = '10px 0';
              
              // Insert at cursor or at end
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(img);
                // Move cursor after image
                range.setStartAfter(img);
                range.setEndAfter(img);
                selection.removeAllRanges();
                selection.addRange(range);
              } else {
                editor.appendChild(img);
              }
              
              // Trigger input event to update form state
              editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } else {
            console.error('Upload failed:', result);
            alert('Erreur lors de l\'upload: ' + (result.message || JSON.stringify(result)));
          }
        } catch (error) {
          console.error('Upload error:', error);
          alert('Erreur de connexion: ' + error.message);
        }
      }
      setShowImageDropdown(false);
    };
    input.click();
  };

  const handleImageUrlNew = () => {
    const url = prompt('URL de l\'image:');
    if (url && url.trim()) {
      // Get the contentEditable div
      const editor = document.querySelector('[contenteditable="true"]');
      if (editor) {
        editor.focus();
        // Insert image at cursor position
        const img = document.createElement('img');
        img.src = url.trim();
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.margin = '10px 0';
        
        // Insert at cursor or at end
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          // Move cursor after image
          range.setStartAfter(img);
          range.setEndAfter(img);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          editor.appendChild(img);
        }
        
        // Trigger input event to update form state
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    setShowImageDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }
    if (!form.price) {
      setError('Le prix du produit est obligatoire.');
      return;
    }

    setSaving(true);
    setError('');

    const primaryImage = form.images?.[0]?.url || null;
    const syncedPageData = form._pageData
      ? {
          ...form._pageData,
          heroImage: primaryImage,
        }
      : form._pageData;

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
      ...(syncedPageData && { _pageData: syncedPageData })
    };

    try {
      if (isEdit) {
        await storeProductsApi.updateProduct(id, payload);
        clearPublicStoreSessionCaches();
        setSuccess('Produit mis à jour');
      } else {
        await storeProductsApi.createProduct(payload);
        clearPublicStoreSessionCaches();
        setSuccess('Produit créé avec succès');
        setTimeout(() => navigate(`${basePath}/products`), 1000);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Impossible de sauvegarder le produit.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`${basePath}/products`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier le produit' : 'Nouveau produit boutique'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <>
              <button
                type="button"
                onClick={handleExportProductCsv}
                disabled={csvBusy}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exporter CSV</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(`${basePath}/products/${id}/builder`)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition shadow-sm"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">Page Builder</span>
              </button>
            </>
          )}
          <button
            type="submit"
            form="store-product-form"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Enregistrer</span>
          </button>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
        </div>
      )}

      <form id="store-product-form" onSubmit={handleSubmit} className="space-y-6">

        {/* ── System Product Picker ─────────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <PackageSearch className="w-5 h-5 text-emerald-600" />
              Produit du catalogue
            </h2>
            <span className="text-xs text-gray-400">Optionnel</span>
          </div>

          {linkedProduct ? (
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Link className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-800">{linkedProduct.name}</span>
                {linkedProduct.sellingPrice && (
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                    {linkedProduct.sellingPrice?.toLocaleString()} XAF
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleUnlinkProduct}
                className="p-1 text-gray-400 hover:text-red-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
            >
              <Search className="w-4 h-4" />
              Choisir depuis le catalogue système
            </button>
          )}
          <p className="text-xs text-gray-400 mt-2">Lier ce produit boutique à un produit de votre catalogue pour synchroniser les commandes.</p>
        </div>

        {/* ── Alibaba Import Modal ──────────────────────────────────────── */}
        {showAlibabaModal && (
          <AlibabaImportModal
            onClose={() => setShowAlibabaModal(false)}
            onApply={handleAlibabaApply}
          />
        )}

        {/* ── AI Generation Modal ──────────────────────────────────────── */}
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-600" />
                  <h3 className="font-semibold text-gray-900">Générer la fiche produit avec l'IA</h3>
                </div>
                <button type="button" onClick={() => { setShowAiModal(false); setAiGenerated(null); setAiError(''); }} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Input type toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiInputType('description')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      aiInputType === 'description'
                        ? 'bg-violet-50 border-violet-400 text-violet-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Description détaillée
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiInputType('url')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition ${
                      aiInputType === 'url'
                        ? 'bg-violet-50 border-violet-400 text-violet-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Lien source (URL)
                  </button>
                </div>

                {/* Input */}
                {aiInputType === 'description' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Décrivez votre produit en détail
                    </label>
                    <textarea
                      autoFocus
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ex: Robe en wax africain 100% coton, taille 38-42, disponible en rouge/bleu/vert, produite artisanalement au Cameroun, lavage à 30°C..."
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL de la source produit
                    </label>
                    <input
                      autoFocus
                      type="url"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="https://www.alibaba.com/product/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Alibaba, Amazon, AliExpress, site fournisseur...</p>
                  </div>
                )}

                {/* Error */}
                {aiError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {aiError}
                  </div>
                )}

                {/* Generated preview */}
                {aiGenerated && (
                  <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
                    <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Prévisualisation générée</p>
                    <div>
                      <p className="text-xs text-gray-500">Nom</p>
                      <p className="text-sm font-semibold text-gray-900">{aiGenerated.name}</p>
                    </div>
                    {aiGenerated.category && (
                      <div>
                        <p className="text-xs text-gray-500">Catégorie</p>
                        <p className="text-sm text-gray-800">{aiGenerated.category}</p>
                      </div>
                    )}
                    {aiGenerated.suggestedPrice > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Prix suggéré</p>
                        <p className="text-sm font-bold text-emerald-700">{aiGenerated.suggestedPrice.toLocaleString()} XAF</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Description</p>
                      <p className="text-sm text-gray-700 line-clamp-3">{aiGenerated.description}</p>
                    </div>
                    {aiGenerated.features?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Avantages clés</p>
                        <ul className="text-sm text-gray-700 space-y-0.5">
                          {aiGenerated.features.map((f, i) => <li key={i}>• {f}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiGenerated.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {aiGenerated.tags.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-violet-200 text-violet-700 text-xs rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex gap-3">
                {!aiGenerated ? (
                  <button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={!aiInput.trim() || aiGenerating}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition"
                  >
                    {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</> : <><Sparkles className="w-4 h-4" /> Générer</> }
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setAiGenerated(null); setAiError(''); }}
                      className="px-4 py-2.5 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Regénérer
                    </button>
                    <button
                      type="button"
                      onClick={applyAiGenerated}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                    >
                      <CheckCircle className="w-4 h-4" /> Appliquer au formulaire
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Picker Modal ─────────────────────────────────────────────── */}
        {showPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Choisir un produit du catalogue</h3>
                <button type="button" onClick={() => setShowPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {pickerLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  </div>
                ) : pickerProducts.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    {pickerSearch ? 'Aucun produit trouvé' : 'Aucun produit dans le catalogue'}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pickerProducts.map(p => (
                      <li key={p._id}>
                        <button
                          type="button"
                          onClick={() => handlePickProduct(p)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-50 text-left transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900">{p.name}</p>
                            <p className="text-xs text-gray-500">{p.status} &middot; stock&nbsp;{p.stock}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">
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

        {/* Basic Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Informations</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Robe africaine wax"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => handleChange('description', html)}
              placeholder="Décrivez votre produit : avantages, matière, utilisation…"
              minHeight={140}
              maxHeight={400}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix *</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="15000"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ancien prix</label>
              <input
                type="number"
                value={form.compareAtPrice}
                onChange={(e) => handleChange('compareAtPrice', e.target.value)}
                placeholder="20000"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
              <select
                value={form.currency}
                onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Config globale de la boutique</option>
                {[...new Set([
                  ...(form.currency && !MARKET_CURRENCY_SUGGESTIONS.includes(form.currency) ? [form.currency] : []),
                  ...MARKET_CURRENCY_SUGGESTIONS
                ])].map((currencyCode) => (
                  <option key={currencyCode} value={currencyCode}>{currencyCode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => handleChange('stock', e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Paramètres du marché</h3>
                <p className="text-xs text-gray-500 mt-1">Définissez le marché cible du produit. Ces infos servent à la devise, au contexte local et aux éléments marketing.</p>
              </div>
              <Globe className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Marché cible</label>
                <input
                  type="text"
                  value={form.targetMarket}
                  onChange={(e) => handleChange('targetMarket', e.target.value)}
                  placeholder="Ex: Afrique francophone, Cameroun urbain"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pays cible</label>
                <select
                  value={form.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Choisir un pays</option>
                  {[...new Set([
                    ...(form.country && !MARKET_COUNTRY_SUGGESTIONS.includes(form.country) ? [form.country] : []),
                    ...MARKET_COUNTRY_SUGGESTIONS
                  ])].map((country) => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                placeholder="Ex: Vêtements, Accessoires..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (séparés par virgule)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                placeholder="Ex: promo, nouveau, bestseller"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Image className="w-5 h-5 text-emerald-600" />
            Images
          </h2>

          {/* Current images — reorderable */}
          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {form.images.map((img, i) => (
                <div key={img.url || i} className="relative group">
                  <img
                    src={img.url}
                    alt={img.alt || form.name}
                    className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border-2 ${i === 0 ? 'border-emerald-500 ring-2 ring-emerald-200' : img.isMarketing ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-gray-200'}`}
                    loading="lazy"
                  />
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {/* Reorder arrows */}
                  {form.images.length > 1 && (
                    <div className="absolute -bottom-1 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition z-10">
                      {i > 0 && (
                        <button type="button" onClick={() => handleMoveImage(i, -1)} className="p-0.5 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100" title="Déplacer à gauche">
                          <ChevronUp className="w-3 h-3 -rotate-90" />
                        </button>
                      )}
                      {i < form.images.length - 1 && (
                        <button type="button" onClick={() => handleMoveImage(i, 1)} className="p-0.5 bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-100" title="Déplacer à droite">
                          <ChevronDown className="w-3 h-3 -rotate-90" />
                        </button>
                      )}
                    </div>
                  )}
                  {/* Set as hero */}
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetHero(i)}
                      className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-white/90 border border-gray-300 text-gray-600 text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                      title="Définir comme image principale"
                    >
                      ★ Hero
                    </button>
                  )}
                  {/* Badges */}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-semibold rounded">
                      Principale
                    </span>
                  )}
                  {img.isMarketing && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] rounded">
                      IA
                    </span>
                  )}
                  {img.isHero && i !== 0 && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded">
                      Hero
                    </span>
                  )}
                  {img.isReal && (
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-orange-600 text-white text-[10px] rounded">
                      Original
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploading ? 'Upload...' : 'Ajouter une image'}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          {/* Add by URL */}
          <div className="flex gap-2">
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Ou collez une URL d'image..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddImageUrl}
              disabled={!imageUrlInput.trim()}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-40 transition"
            >
              Ajouter
            </button>
          </div>

          <p className="text-xs text-gray-400">Max 5 MB par image. Formats: JPG, PNG, WebP. Survolez une image pour la réorganiser ou la définir comme image principale (hero).</p>
        </div>

        {/* ── Sections page produit (rich _pageData) ──────────────────── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-600" />
              Sections de la page produit
            </h2>
            <p className="text-xs text-gray-400 mt-1">Ajoutez du contenu marketing à votre fiche produit (même format que la génération IA)</p>
          </div>

          {/* Hero */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('hero')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Type className="w-4 h-4 text-violet-500" /> Hero (Accroche)</span>
              {openSections.hero ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.hero && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Slogan</label>
                  <input type="text" value={getPageData('hero_slogan', '')} onChange={(e) => setPageData('hero_slogan', e.target.value)} placeholder="Ex: La solution naturelle pour votre peau" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Baseline (message de confiance)</label>
                  <input type="text" value={getPageData('hero_baseline', '')} onChange={(e) => setPageData('hero_baseline', e.target.value)} placeholder="Ex: ✅ Livraison gratuite • Satisfait ou remboursé" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            )}
          </div>

          {/* Problem Section */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('problem')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Target className="w-4 h-4 text-red-500" /> Problème</span>
              {openSections.problem ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.problem && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Titre</label>
                  <input type="text" value={getPageData('problem_section', {})?.title || ''} onChange={(e) => setPageData('problem_section', { ...getPageData('problem_section', {}), title: e.target.value })} placeholder="Ex: Le problème" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Points de douleur (un par ligne)</label>
                  <textarea value={(getPageData('problem_section', {})?.pain_points || []).join('\n')} onChange={(e) => setPageData('problem_section', { ...getPageData('problem_section', {}), pain_points: e.target.value.split('\n').filter(l => l.trim()) })} placeholder={"Peau sèche et irritée\nProduits chimiques inefficaces\nRésultats qui ne durent pas"} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Solution Section */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('solution')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Lightbulb className="w-4 h-4 text-emerald-500" /> Solution</span>
              {openSections.solution ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.solution && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Titre</label>
                  <input type="text" value={getPageData('solution_section', {})?.title || ''} onChange={(e) => setPageData('solution_section', { ...getPageData('solution_section', {}), title: e.target.value })} placeholder="Ex: La solution" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={getPageData('solution_section', {})?.description || ''} onChange={(e) => setPageData('solution_section', { ...getPageData('solution_section', {}), description: e.target.value })} placeholder="Décrivez comment votre produit résout le problème..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('stats')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><BarChart3 className="w-4 h-4 text-blue-500" /> Statistiques</span>
              {openSections.stats ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.stats && (
              <div className="px-5 pb-4 space-y-3">
                {(getPageData('stats_bar', []) || []).map((stat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={stat.value || ''} onChange={(e) => { const arr = [...(getPageData('stats_bar', []))]; arr[i] = { ...arr[i], value: e.target.value }; setPageData('stats_bar', arr); }} placeholder="1000+" className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <input type="text" value={stat.label || ''} onChange={(e) => { const arr = [...(getPageData('stats_bar', []))]; arr[i] = { ...arr[i], label: e.target.value }; setPageData('stats_bar', arr); }} placeholder="Clients satisfaits" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <button type="button" onClick={() => { const arr = getPageData('stats_bar', []).filter((_, j) => j !== i); setPageData('stats_bar', arr); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setPageData('stats_bar', [...(getPageData('stats_bar', []) || []), { value: '', label: '' }])} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter une stat</button>
              </div>
            )}
          </div>

          {/* Benefits Bullets */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('benefits')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Star className="w-4 h-4 text-yellow-500" /> Avantages clés</span>
              {openSections.benefits ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.benefits && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Avantages (un par ligne)</label>
                  <textarea value={(getPageData('benefits_bullets', []) || []).join('\n')} onChange={(e) => setPageData('benefits_bullets', e.target.value.split('\n').filter(l => l.trim()))} placeholder={"✅ 100% naturel\n✅ Résultats visibles en 7 jours\n✅ Sans effets secondaires"} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                </div>
              </div>
            )}
          </div>

          {/* Conversion Blocks */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('conversion')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Zap className="w-4 h-4 text-orange-500" /> Blocs de conversion</span>
              {openSections.conversion ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.conversion && (
              <div className="px-5 pb-4 space-y-3">
                {(getPageData('conversion_blocks', []) || []).map((block, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={block.icon || ''} onChange={(e) => { const arr = [...(getPageData('conversion_blocks', []))]; arr[i] = { ...arr[i], icon: e.target.value }; setPageData('conversion_blocks', arr); }} placeholder="🚚" className="w-14 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <input type="text" value={block.text || ''} onChange={(e) => { const arr = [...(getPageData('conversion_blocks', []))]; arr[i] = { ...arr[i], text: e.target.value }; setPageData('conversion_blocks', arr); }} placeholder="Livraison gratuite partout" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <button type="button" onClick={() => { const arr = getPageData('conversion_blocks', []).filter((_, j) => j !== i); setPageData('conversion_blocks', arr); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setPageData('conversion_blocks', [...(getPageData('conversion_blocks', []) || []), { icon: '', text: '' }])} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter un bloc</button>
              </div>
            )}
          </div>

          {/* Offer Block */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('offer')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><Shield className="w-4 h-4 text-emerald-500" /> Offre & Garantie</span>
              {openSections.offer ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.offer && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Label de l'offre</label>
                  <input type="text" value={getPageData('offer_block', {})?.offer_label || ''} onChange={(e) => setPageData('offer_block', { ...getPageData('offer_block', {}), offer_label: e.target.value })} placeholder="Ex: Offre spéciale" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Texte de garantie</label>
                  <input type="text" value={getPageData('offer_block', {})?.guarantee_text || ''} onChange={(e) => setPageData('offer_block', { ...getPageData('offer_block', {}), guarantee_text: e.target.value })} placeholder="Ex: Satisfait ou remboursé sous 30 jours" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
            )}
          </div>

          {/* Urgency */}
          <div className="border-b border-gray-100">
            <button type="button" onClick={() => toggleSection('urgency')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><AlertCircle className="w-4 h-4 text-red-500" /> Urgence</span>
              {openSections.urgency ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.urgency && (
              <div className="px-5 pb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Badge d'urgence</label>
                  <input type="text" value={getPageData('urgency_badge', '')} onChange={(e) => setPageData('urgency_badge', e.target.value)} placeholder="Ex: 🔥 Plus que 3 en stock !" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={getPageData('urgency_elements', {})?.stock_limited || false} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), stock_limited: e.target.checked })} className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                    Stock limité
                  </label>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Preuve sociale</label>
                    <input type="number" min="0" value={getPageData('urgency_elements', {})?.social_proof_count || ''} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), social_proof_count: parseInt(e.target.value) || 0 })} placeholder="42" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Résultat rapide</label>
                    <input type="text" value={getPageData('urgency_elements', {})?.quick_result || ''} onChange={(e) => setPageData('urgency_elements', { ...getPageData('urgency_elements', {}), quick_result: e.target.value })} placeholder="7 jours" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Guide d'utilisation */}
          <div>
            <button type="button" onClick={() => toggleSection('guide')} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700"><BookOpen className="w-4 h-4 text-indigo-500" /> Guide d'utilisation</span>
              {openSections.guide ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>
            {openSections.guide && (
              <div className="px-5 pb-4">
                <textarea value={getPageData('guide_utilisation', '')} onChange={(e) => setPageData('guide_utilisation', e.target.value)} placeholder="Expliquez comment utiliser le produit étape par étape..." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
            )}
          </div>
        </div>

        {/* Offres de quantité */}
        {isEdit && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <QuantityOffersManager productId={id} />
          </div>
        )}

        {/* Avis clients / Review Generator */}
        <ReviewGenerator
          productDescription={form.description || form.name}
          existingTestimonials={form.testimonials || []}
          onSave={(testimonials) => setForm(f => ({ ...f, testimonials }))}
        />

        {/* SEO */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">SEO (optionnel)</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre SEO</label>
            <input
              type="text"
              value={form.seoTitle}
              onChange={(e) => handleChange('seoTitle', e.target.value)}
              placeholder={form.name || 'Titre pour les moteurs de recherche'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              maxLength={70}
            />
            <p className="text-xs text-gray-400 mt-1">{(form.seoTitle || form.name).length}/70</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description SEO</label>
            <textarea
              value={form.seoDescription}
              onChange={(e) => handleChange('seoDescription', e.target.value)}
              placeholder="Description courte pour Google..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              maxLength={160}
            />
            <p className="text-xs text-gray-400 mt-1">{form.seoDescription.length}/160</p>
          </div>
        </div>

        {/* Publish + Save */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => handleChange('isPublished', e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700">Publier immédiatement</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreProductForm;
