import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Image, Plus, X, Loader2, AlertCircle, CheckCircle, Search, PackageSearch, Link, Sparkles, Globe, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';

/**
 * StoreProductForm — Create or edit a store catalog product.
 * Handles image uploads via /store-products/upload,
 * system product picker (link to main catalogue),
 * category, pricing, SEO fields, and publish toggle.
 */
const StoreProductForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);

  // ─── System product picker state ────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerProducts, setPickerProducts] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [linkedProduct, setLinkedProduct] = useState(null);
  const searchTimeout = useRef(null);

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
    setForm(prev => ({
      ...prev,
      name: aiGenerated.name || prev.name,
      description: aiGenerated.description || prev.description,
      category: aiGenerated.category || prev.category,
      tags: (aiGenerated.tags || []).join(', '),
      seoTitle: aiGenerated.seoTitle || prev.seoTitle,
      seoDescription: aiGenerated.seoDescription || prev.seoDescription,
      price: aiGenerated.suggestedPrice > 0 ? String(aiGenerated.suggestedPrice) : prev.price
    }));
    setShowAiModal(false);
    setAiInput('');
    setAiGenerated(null);
    setAiError('');
  };

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    compareAtPrice: '',
    stock: '0',
    category: '',
    tags: '',
    isPublished: false,
    seoTitle: '',
    seoDescription: '',
    images: [],
    linkedProductId: null
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
            stock: String(p.stock ?? '0'),
            category: p.category || '',
            tags: (p.tags || []).join(', '),
            isPublished: p.isPublished || false,
            seoTitle: p.seoTitle || '',
            seoDescription: p.seoDescription || '',
            images: p.images || [],
            linkedProductId: p.linkedProductId || null
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

        setForm(prev => ({
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
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Add image by URL (for users who host elsewhere)
  const [imageUrlInput, setImageUrlInput] = useState('');
  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setForm(prev => ({
      ...prev,
      images: [...prev.images, { url: imageUrlInput.trim(), alt: prev.name, order: prev.images.length }]
    }));
    setImageUrlInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      setError('Nom et prix sont requis');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: parseFloat(form.price),
      compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null,
      stock: parseInt(form.stock) || 0,
      category: form.category.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      isPublished: form.isPublished,
      seoTitle: form.seoTitle.trim(),
      seoDescription: form.seoDescription.trim(),
      images: form.images,
      linkedProductId: form.linkedProductId || null
    };

    try {
      if (isEdit) {
        await storeProductsApi.updateProduct(id, payload);
        setSuccess('Produit mis à jour');
      } else {
        await storeProductsApi.createProduct(payload);
        setSuccess('Produit créé avec succès');
        setTimeout(() => navigate('/ecom/store/products'), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la sauvegarde');
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
          onClick={() => navigate('/ecom/store/products')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Modifier le produit' : 'Nouveau produit boutique'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Générer avec IA
        </button>
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

      <form onSubmit={handleSubmit} className="space-y-6">

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
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Décrivez le produit pour vos clients..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          {/* Current images */}
          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img.url}
                    alt={img.alt || form.name}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover border border-gray-200"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] rounded">
                      Principale
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

          <p className="text-xs text-gray-400">Max 5 MB par image. Formats: JPG, PNG, WebP. La première image sera l'image principale.</p>
        </div>

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
            {saving ? 'Sauvegarde...' : isEdit ? 'Mettre à jour' : 'Créer le produit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoreProductForm;
