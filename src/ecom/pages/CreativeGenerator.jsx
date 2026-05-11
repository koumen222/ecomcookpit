import React, { useState, useCallback, useRef } from 'react';
import { Link2, Sparkles, Download, RefreshCw, Image, Globe, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, ExternalLink, Upload, X, FileText, Zap, Shield, Star, LayoutGrid, Package } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const FORMATS = [
  { id: 'hero-benefits', label: 'Bénéfices', icon: '✨', desc: 'Produit + bénéfices clés' },
  { id: 'target-promise', label: 'Cible & Promesse', icon: '🎯', desc: 'Lifestyle + transformation' },
  { id: 'problem-solution', label: 'Prob. / Solution', icon: '💡', desc: 'Avant / Après split' },
  { id: 'how-to-use', label: 'Mode d\'emploi', icon: '📋', desc: '3 étapes simples' },
  { id: 'ingredients-trust', label: 'Confiance', icon: '🛡️', desc: 'Badges & certifications' },
  { id: 'comparison', label: 'Comparaison', icon: '⚖️', desc: 'Tableau ✓ / ✗' },
  { id: 'social-proof', label: 'Preuve Sociale', icon: '👥', desc: 'Avis clients' },
];

const TEMPLATES = [
  { id: 'listing-green', title: 'Listing Vert', icon: '🍃', color: 'from-emerald-500 to-green-600', light: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { id: 'general', title: 'Premium', icon: '🌟', color: 'from-slate-700 to-slate-900', light: 'bg-slate-50 border-slate-200 text-slate-800' },
  { id: 'beauty', title: 'Beauté', icon: '🌸', color: 'from-pink-400 to-rose-500', light: 'bg-pink-50 border-pink-200 text-pink-800' },
  { id: 'health', title: 'Santé', icon: '🌿', color: 'from-teal-500 to-emerald-600', light: 'bg-teal-50 border-teal-200 text-teal-800' },
  { id: 'tech', title: 'Tech', icon: '⚡', color: 'from-blue-600 to-indigo-700', light: 'bg-blue-50 border-blue-200 text-blue-800' },
  { id: 'fashion', title: 'Mode', icon: '👗', color: 'from-amber-500 to-yellow-600', light: 'bg-amber-50 border-amber-200 text-amber-800' },
  { id: 'home', title: 'Maison', icon: '🏠', color: 'from-orange-400 to-amber-500', light: 'bg-orange-50 border-orange-200 text-orange-800' },
];

const STEPS = [
  { icon: Globe, label: 'Analyse marketing…' },
  { icon: Sparkles, label: 'Création des prompts…' },
  { icon: Image, label: 'Génération des images…' },
];

const CreativeGenerator = () => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [visualTemplate, setVisualTemplate] = useState('listing-green');
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState(FORMATS.map(f => f.id));
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const toggleFormat = (id) => {
    setSelectedFormats(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Sélectionnez une image'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Image trop lourde (max 10 MB)'); return; }
    setProductImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError('');
  };

  const removeImage = () => {
    setProductImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canGenerate = productImage || url.trim() || description.trim();

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError('');
    setResult(null);
    setCurrentStep(0);
    const stepTimer1 = setTimeout(() => setCurrentStep(1), 3000);
    const stepTimer2 = setTimeout(() => setCurrentStep(2), 8000);
    try {
      const formData = new FormData();
      if (productImage) formData.append('productImage', productImage);
      if (url.trim()) formData.append('url', url.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('visualTemplate', visualTemplate);
      formData.append('formats', JSON.stringify(selectedFormats.length > 0 ? selectedFormats : undefined));
      const res = await ecomApi.post('/ai/creative-generator', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur lors de la génération');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
      setCurrentStep(0);
    }
  }, [url, description, productImage, selectedFormats, visualTemplate, canGenerate]);

  const downloadImage = async (imageUrl, filename) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'creative.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const copyImageUrl = (imageUrl, id) => {
    navigator.clipboard.writeText(imageUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeTpl = TEMPLATES.find(t => t.id === visualTemplate) || TEMPLATES[0];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 lg:left-[220px] right-0 z-20 bg-scalor-black px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Left: icon + title + chips */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-scalor-green flex items-center justify-center shrink-0">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-black text-base tracking-tight leading-none">Creatives Image</h1>
              <p className="text-white/40 text-[11px] mt-0.5">Visuels produit premium • 100% IA</p>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 ml-2">
              {[
                { icon: Zap, label: '7 formats' },
                { icon: Image, label: 'Image-to-image' },
                { icon: Star, label: 'HD' },
                { icon: Shield, label: '1:1' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                  <Icon size={10} className="text-white/30" />
                  <span className="text-white/50 text-[10px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Right: price badge */}
          <div className="flex items-center gap-2 bg-scalor-green/10 border border-scalor-green/30 rounded-lg px-3 py-1.5 shrink-0">
            <span className="text-scalor-green font-black text-sm">80 FCFA</span>
            <span className="text-white/40 text-xs hidden sm:inline">/ image</span>
          </div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-scalor-green/40 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 py-6 pt-[72px]">
        <div className="flex gap-6 items-start flex-col lg:flex-row">

          {/* ── LEFT: Config Panel ─────────────────────────────────── */}
          <div className="w-full lg:w-[380px] shrink-0 space-y-4 lg:sticky lg:top-[68px]">

            {/* Upload produit */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Image produit</p>
              </div>
              <div className="px-5 pb-5">
                <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                {!imagePreview ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-7 border-2 border-dashed border-gray-200 rounded-xl hover:border-scalor-green-light hover:bg-green-50/40 transition-all flex flex-col items-center gap-2.5 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-colors">
                      <Upload size={20} className="text-gray-400 group-hover:text-scalor-green" />
                    </div>
                    <div className="text-center">
                      <span className="block text-sm font-semibold text-gray-600 group-hover:text-scalor-green">Glissez ou cliquez</span>
                      <span className="text-xs text-gray-400">PNG, JPG, WebP — max 10 MB</span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <img src={imagePreview} alt="Produit" className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{productImage?.name}</p>
                      <p className="text-xs text-gray-400">{productImage ? `${(productImage.size / 1024).toFixed(0)} KB` : ''}</p>
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-scalor-green mt-1 hover:text-scalor-green-dark">Changer l'image</button>
                    </div>
                    <button onClick={removeImage} className="w-7 h-7 rounded-full bg-red-50 border border-red-100 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* URL + Description */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Informations produit</p>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Lien produit <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://alibaba.com/product/..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-scalor-green-light focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Description <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Gélules nootropiques au collagène, 60 capsules, ingrédients naturels…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-scalor-green-light focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 placeholder:text-gray-400 resize-none"
                />
              </div>
            </div>

            {/* Template */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Univers visuel</p>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setVisualTemplate(tpl.id)}
                    className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all ${
                      visualTemplate === tpl.id
                        ? 'border-scalor-green bg-green-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tpl.color} flex items-center justify-center text-base shadow-sm`}>
                      {tpl.icon}
                    </div>
                    <span className={`text-[10px] font-bold leading-none text-center ${visualTemplate === tpl.id ? 'text-scalor-green-dark' : 'text-gray-500'}`}>
                      {tpl.title}
                    </span>
                    {visualTemplate === tpl.id && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-scalor-green rounded-full flex items-center justify-center">
                        <CheckCircle size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Formats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Slides à générer</p>
                <button
                  onClick={() => setSelectedFormats(selectedFormats.length === FORMATS.length ? [] : FORMATS.map(f => f.id))}
                  className="text-[11px] font-bold text-scalor-green hover:text-scalor-green-dark"
                >
                  {selectedFormats.length === FORMATS.length ? 'Tout effacer' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="space-y-1.5">
                {FORMATS.map(f => {
                  const active = selectedFormats.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFormat(f.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-green-200 bg-green-50/70 shadow-sm'
                          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100/60'
                      }`}
                    >
                      <span className="text-base leading-none shrink-0">{f.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold block ${active ? 'text-green-800' : 'text-gray-600'}`}>{f.label}</span>
                        <span className="text-[10px] text-gray-400">{f.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        active ? 'border-scalor-green bg-scalor-green' : 'border-gray-300'
                      }`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Preview */}
            <div className="bg-scalor-green/5 rounded-2xl border border-scalor-green/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-scalor-green uppercase tracking-widest">Coût de génération</p>
                <span className="text-[11px] text-gray-500 font-semibold bg-white border border-gray-100 px-2 py-0.5 rounded-full">80 FCFA / image</span>
              </div>
              {selectedFormats.length > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">{selectedFormats.length} image{selectedFormats.length > 1 ? 's' : ''} sélectionnée{selectedFormats.length > 1 ? 's' : ''}</span>
                  <span className="text-xl font-black text-scalor-green">{selectedFormats.length * 80} <span className="text-sm font-bold">FCFA</span></span>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sélectionnez des slides</p>
              )}
              <div className="mt-3 pt-3 border-t border-scalor-green/10 flex gap-1.5 flex-wrap">
                {[{ count: 10, label: 'Pack 10' }, { count: 20, label: 'Pack 20' }, { count: 50, label: 'Pack 50' }].map(pack => (
                  <div key={pack.count} className="text-[10px] bg-white border border-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                    {pack.label} → {(pack.count * 80).toLocaleString('fr-FR')} FCFA
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={loading || !canGenerate || selectedFormats.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-scalor-green to-scalor-copper text-white font-black text-sm tracking-wide hover:from-scalor-green-dark hover:to-scalor-copper-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-scalor-green/30 flex items-center justify-center gap-2.5"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading
                ? 'Génération en cours…'
                : `Générer ${selectedFormats.length} image${selectedFormats.length > 1 ? 's' : ''} — ${selectedFormats.length * 80} FCFA`}
            </button>
            {!canGenerate && (
              <p className="text-[11px] text-center text-gray-400 -mt-2">Ajoutez une image, un lien ou une description</p>
            )}
          </div>

          {/* ── RIGHT: Results Area ────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Loading */}
            {loading && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
                <div className="flex flex-col items-center">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-orange-50 flex items-center justify-center">
                      <Loader2 size={32} className="text-scalor-green animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-green-200 border-t-scalor-green animate-spin opacity-30" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-1">L'IA crée vos visuels…</h3>
                  <p className="text-sm text-gray-500 mb-8">Ça prend ~2 minutes pour {selectedFormats.length} image{selectedFormats.length > 1 ? 's' : ''}</p>
                  <div className="w-full max-w-xs space-y-3">
                    {STEPS.map((step, i) => {
                      const StepIcon = step.icon;
                      const isDone = i < currentStep;
                      const isCurrent = i === currentStep;
                      return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isCurrent ? 'bg-green-50 border-green-200 shadow-sm' :
                          isDone ? 'bg-emerald-50 border-emerald-100' :
                          'bg-gray-50 border-gray-100'
                        }`}>
                          {isDone ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                              <CheckCircle size={14} className="text-white" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-7 h-7 rounded-full bg-scalor-green flex items-center justify-center shrink-0">
                              <Loader2 size={14} className="text-white animate-spin" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                              <StepIcon size={14} className="text-gray-400" />
                            </div>
                          )}
                          <span className={`text-sm font-semibold ${
                            isDone ? 'text-emerald-700' : isCurrent ? 'text-green-800' : 'text-gray-400'
                          }`}>{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-800">Erreur de génération</p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <div className="space-y-5">
                {/* Topbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${activeTpl.light}`}>
                      {activeTpl.icon} {activeTpl.title}
                    </div>
                    <span className="text-sm font-bold text-gray-700">
                      {result.creatives?.filter(c => c.imageUrl).length} visuels générés
                    </span>
                    {result.cost && (
                      <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2.5 py-1 rounded-full">
                        💰 ~{result.cost.costFcfa} FCFA
                      </span>
                    )}
                  </div>
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs font-bold text-scalor-green hover:text-scalor-green-dark bg-green-50 hover:bg-green-100 px-3 py-2 rounded-xl transition-colors border border-green-100"
                  >
                    <RefreshCw size={12} /> Regénérer
                  </button>
                </div>

                {/* Analysis accordion */}
                {result.analysis && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setShowAnalysis(!showAnalysis)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Globe size={15} className="text-blue-500" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-gray-800">{result.analysis.productName}</span>
                          <span className="text-xs text-gray-400 block">{result.analysis.category} · {result.analysis.targetAudience}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.productImageFound && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-1 rounded-full">
                            📸 Image détectée
                          </span>
                        )}
                        <ChevronDown size={15} className={`text-gray-400 transition-transform ${showAnalysis ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showAnalysis && (
                      <div className="px-5 pb-5 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Accroche</p>
                          <p className="text-sm text-gray-700">{result.analysis.emotionalHook}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Angle promo</p>
                          <p className="text-sm text-gray-700">{result.analysis.promoAngle}</p>
                        </div>
                        {result.analysis.keyBenefits?.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bénéfices</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.analysis.keyBenefits.map((b, i) => (
                                <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">✅ {b}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.analysis.slogans?.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Slogans</p>
                            <div className="space-y-1">
                              {result.analysis.slogans.map((s, i) => (
                                <p key={i} className="text-sm text-gray-700 bg-green-50/60 border border-green-100 px-3 py-2 rounded-lg font-medium">💡 {s}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Grid */}
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                  {result.creatives?.map((creative) => (
                    <div key={creative.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all">
                      <div className="relative aspect-square bg-gray-100">
                        {creative.imageUrl ? (
                          <>
                            <img
                              src={creative.imageUrl}
                              alt={creative.label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                              <div className="absolute bottom-0 inset-x-0 p-3 flex gap-2 justify-center">
                                <button
                                  onClick={() => downloadImage(creative.imageUrl, `${creative.id}-${Date.now()}.png`)}
                                  className="flex items-center gap-1.5 bg-white text-gray-900 text-xs font-bold px-3 py-2 rounded-xl shadow-lg hover:bg-gray-100 transition-colors"
                                >
                                  <Download size={13} /> Télécharger
                                </button>
                                <button
                                  onClick={() => copyImageUrl(creative.imageUrl, creative.id)}
                                  className="w-8 h-8 bg-white/90 text-gray-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                                >
                                  {copiedId === creative.id ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                </button>
                                <a
                                  href={creative.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 bg-white/90 text-gray-900 rounded-xl flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                              <AlertCircle size={18} className="text-red-400" />
                            </div>
                            <p className="text-xs text-gray-400 text-center leading-tight">{creative.error || 'Génération échouée'}</p>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between border-t border-gray-50">
                        <div>
                          <p className="text-xs font-bold text-gray-800 leading-tight">{creative.label}</p>
                          <p className="text-[10px] text-gray-400">{creative.aspectRatio}</p>
                        </div>
                        {creative.imageUrl && (
                          <button
                            onClick={() => downloadImage(creative.imageUrl, `${creative.id}-${Date.now()}.png`)}
                            className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 text-scalor-green flex items-center justify-center hover:bg-green-100 transition-colors"
                          >
                            <Download size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !result && !error && (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-orange-50 flex items-center justify-center mb-5">
                  <LayoutGrid size={28} className="text-scalor-green-light" />
                </div>
                <h3 className="text-lg font-black text-gray-800 mb-2">Vos créas apparaîtront ici</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Configurez votre produit à gauche, choisissez les slides et lancez la génération.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {FORMATS.map(f => (
                    <span key={f.id} className="text-[11px] font-semibold bg-gray-50 border border-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
                      {f.icon} {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default CreativeGenerator;
