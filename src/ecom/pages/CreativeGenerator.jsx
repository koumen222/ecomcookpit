import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Sparkles, Download, RefreshCw, Image, Globe, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, ExternalLink, Upload, X, FileText, Zap, Shield, Star, LayoutGrid, Package, Wallet, Plus, CreditCard, Target, List, Scale, Users } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const FORMATS = [
  { id: 'hero-benefits', label: 'Bénéfices', icon: Sparkles, desc: 'Produit + bénéfices clés' },
  { id: 'target-promise', label: 'Cible & Promesse', icon: Target, desc: 'Lifestyle + transformation' },
  { id: 'problem-solution', label: 'Prob. / Solution', icon: Zap, desc: 'Avant / Après split' },
  { id: 'how-to-use', label: "Mode d'emploi", icon: List, desc: '3 étapes simples' },
  { id: 'ingredients-trust', label: 'Confiance', icon: Shield, desc: 'Badges & certifications' },
  { id: 'comparison', label: 'Comparaison', icon: Scale, desc: 'Tableau ✓ / ✗' },
  { id: 'social-proof', label: 'Preuve Sociale', icon: Users, desc: 'Avis clients' },
];

const TEMPLATES = [
  { id: 'listing-green', title: 'Listing', color: 'from-green-500 to-green-700' },
  { id: 'general', title: 'Premium', color: 'from-gray-600 to-gray-900' },
  { id: 'beauty', title: 'Beauté', color: 'from-pink-400 to-rose-500' },
  { id: 'health', title: 'Santé', color: 'from-teal-500 to-green-600' },
  { id: 'tech', title: 'Tech', color: 'from-blue-600 to-indigo-700' },
  { id: 'fashion', title: 'Mode', color: 'from-amber-500 to-yellow-600' },
  { id: 'home', title: 'Maison', color: 'from-orange-400 to-amber-500' },
];

const STEPS = [
  { icon: Globe, label: 'Analyse marketing…' },
  { icon: Sparkles, label: 'Création des prompts…' },
  { icon: Image, label: 'Génération des images…' },
];

const CREDIT_PACKS = [
  { quantity: 10, label: '10 images', price: 800 },
  { quantity: 20, label: '20 images', price: 1600, badge: 'Populaire' },
  { quantity: 50, label: '50 images', price: 4000, badge: 'Meilleure offre' },
];

const CreativeGenerator = () => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [visualTemplate, setVisualTemplate] = useState('listing-green');
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [logoImage, setLogoImage] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState(FORMATS.map(f => f.id));
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const [credits, setCredits] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyPack, setBuyPack] = useState(CREDIT_PACKS[1]);
  const [buyPhone, setBuyPhone] = useState('');
  const [buyName, setBuyName] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [buySuccess, setBuySuccess] = useState(null);
  const pendingTokenRef = useRef(null);
  const pollIntervalRef = useRef(null);

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

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Sélectionnez une image pour le logo'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Logo trop lourd (max 5 MB)'); return; }
    setLogoImage(file);
    setLogoPreview(URL.createObjectURL(file));
    setError('');
  };

  const removeLogo = () => {
    setLogoImage(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const canGenerate = productImage || url.trim();

  useEffect(() => {
    ecomApi.get('/billing/creative-credits')
      .then(r => setCredits(r.data.credits ?? 0))
      .catch(() => setCredits(0));
  }, []);

  const startPoll = useCallback((token) => {
    pendingTokenRef.current = token;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await ecomApi.get(`/billing/generation-status/${token}`);
        const s = r.data?.status || r.data?.payment?.status;
        if (s === 'paid') {
          clearInterval(pollIntervalRef.current);
          setBuySuccess('Paiement confirmé ! Vos crédits ont été ajoutés.');
          setBuyLoading(false);
          const cr = await ecomApi.get('/billing/creative-credits');
          setCredits(cr.data.credits ?? 0);
        } else if (s === 'failure' || s === 'no paid') {
          clearInterval(pollIntervalRef.current);
          setBuyError('Paiement échoué ou annulé.');
          setBuyLoading(false);
        }
      } catch { /* ignore */ }
    }, 4000);
  }, []);

  useEffect(() => () => clearInterval(pollIntervalRef.current), []);

  const handleBuyCredits = async () => {
    if (!buyPhone.trim() || buyPhone.trim().length < 8) { setBuyError('Numéro de téléphone invalide'); return; }
    if (!buyName.trim() || buyName.trim().length < 2) { setBuyError('Nom requis'); return; }
    setBuyLoading(true);
    setBuyError('');
    setBuySuccess(null);
    try {
      const r = await ecomApi.post('/billing/buy-creative', {
        quantity: buyPack.quantity,
        phone: buyPhone.trim(),
        clientName: buyName.trim(),
      });
      if (r.data.success && r.data.paymentUrl) {
        window.open(r.data.paymentUrl, '_blank', 'noopener,noreferrer');
        startPoll(r.data.mfToken);
      } else {
        throw new Error(r.data.message || 'Erreur');
      }
    } catch (err) {
      setBuyLoading(false);
      setBuyError(err.response?.data?.message || err.message || 'Erreur paiement');
    }
  };

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
      if (logoImage) formData.append('logoImage', logoImage);
      if (url.trim()) formData.append('url', url.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('visualTemplate', visualTemplate);
      formData.append('formats', JSON.stringify(selectedFormats.length > 0 ? selectedFormats : undefined));
      const res = await ecomApi.post('/ai/creative-generator', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
      });
      setResult(res.data);
      if (res.data.creditsRemaining !== undefined) setCredits(res.data.creditsRemaining);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 402) {
        setError(errData?.error || 'Crédits insuffisants');
        setShowBuyModal(true);
      } else {
        setError(errData?.error || err.message || 'Erreur lors de la génération');
      }
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
  const insufficientCredits = credits !== null && credits < selectedFormats.length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Buy Credits Modal — bottom-sheet */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden">
            {/* Handle */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            {/* Header */}
            <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
                  <CreditCard size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Recharger les crédits</p>
                  <p className="text-white/40 text-[11px]">80 FCFA / image générée</p>
                </div>
              </div>
              <button
                onClick={() => { setShowBuyModal(false); clearInterval(pollIntervalRef.current); setBuyLoading(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {buySuccess ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-gray-900 text-base">{buySuccess}</p>
                  <p className="text-sm text-gray-500 mt-1">Solde actuel : <strong>{credits}</strong> crédit{credits !== 1 ? 's' : ''}</p>
                  <button
                    onClick={() => setShowBuyModal(false)}
                    className="mt-4 w-full h-11 bg-green-600 text-white font-medium rounded-2xl text-sm hover:bg-green-700 transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Choisir un pack</p>
                    <div className="space-y-2">
                      {CREDIT_PACKS.map(pack => (
                        <button
                          key={pack.quantity}
                          onClick={() => setBuyPack(pack)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                            buyPack.quantity === pack.quantity
                              ? 'border-green-600 bg-green-50'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-800">{pack.label}</span>
                            {pack.badge && (
                              <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-md">
                                {pack.badge}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-green-600 text-sm">
                            {pack.price.toLocaleString('fr-FR')} <span className="text-xs">FCFA</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Numéro de téléphone</label>
                      <input
                        type="tel"
                        value={buyPhone}
                        onChange={e => setBuyPhone(e.target.value)}
                        placeholder="Ex: 6XXXXXXXX"
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Nom complet</label>
                      <input
                        type="text"
                        value={buyName}
                        onChange={e => setBuyName(e.target.value)}
                        placeholder="Votre nom"
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all"
                      />
                    </div>
                  </div>

                  {buyError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-red-700 font-medium">
                      <AlertCircle size={13} /> {buyError}
                    </div>
                  )}
                  {buyLoading && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-gray-600 font-medium">
                      <Loader2 size={13} className="animate-spin" /> Attente de confirmation du paiement…
                    </div>
                  )}

                  <button
                    onClick={handleBuyCredits}
                    disabled={buyLoading}
                    className="w-full h-11 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {buyLoading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                    {buyLoading ? 'Paiement en cours…' : `Payer ${buyPack.price.toLocaleString('fr-FR')} FCFA`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Creatives Image</h1>
            <p className="text-sm text-gray-400 mt-0.5">Visuels produit premium · IA</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/ecom/creatives/gallery"
              className="h-10 px-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors"
            >
              <LayoutGrid size={14} className="text-gray-400" />
              <span className="hidden sm:inline">Mes visuels</span>
            </Link>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl h-10 px-3.5">
              <Wallet size={14} className="text-green-600" />
              <span className="text-gray-900 font-semibold text-sm">{credits === null ? '…' : credits}</span>
              <span className="text-gray-400 text-xs hidden sm:inline">crédit{credits !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => { setShowBuyModal(true); setBuyError(''); setBuySuccess(null); }}
              className="h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <Plus size={14} /> Recharger
            </button>
          </div>
        </div>

        <div className="flex gap-6 items-start flex-col lg:flex-row">

          {/* LEFT: Config Panel */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-4 lg:sticky lg:top-[68px]">

            {/* Upload produit */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Image produit</p>
              </div>
              <div className="p-4">
                <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
                {!imagePreview ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-7 border-2 border-dashed border-gray-200 rounded-xl hover:border-green-600 hover:bg-green-50/40 transition-all flex flex-col items-center gap-2.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-green-100 flex items-center justify-center transition-colors">
                      <Upload size={18} className="text-gray-400 group-hover:text-green-600" />
                    </div>
                    <div className="text-center">
                      <span className="block text-sm font-medium text-gray-600 group-hover:text-green-700">Glissez ou cliquez</span>
                      <span className="text-xs text-gray-400">PNG, JPG, WebP — max 10 MB</span>
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <img src={imagePreview} alt="Produit" className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{productImage?.name}</p>
                      <p className="text-xs text-gray-400">{productImage ? `${(productImage.size / 1024).toFixed(0)} KB` : ''}</p>
                      <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-green-600 mt-1 hover:text-green-700">Changer l'image</button>
                    </div>
                    <button onClick={removeImage} className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Logo */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Logo de marque</p>
                <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">Optionnel</span>
              </div>
              <input type="file" ref={logoInputRef} onChange={handleLogoSelect} accept="image/*" className="hidden" />
              {!logoPreview ? (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-gray-100 rounded-xl hover:border-green-600/40 hover:bg-green-50/30 transition-all flex items-center gap-3 px-4 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-green-100 flex items-center justify-center transition-colors shrink-0">
                    <Package size={15} className="text-gray-400 group-hover:text-green-600" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-medium text-gray-500 group-hover:text-green-700">Ajouter votre logo</span>
                    <span className="text-[10px] text-gray-400">PNG transparent recommandé</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded-lg bg-white border border-gray-200 p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{logoImage?.name}</p>
                    <p className="text-[10px] text-gray-400">{logoImage ? `${(logoImage.size / 1024).toFixed(0)} KB` : ''}</p>
                    <p className="text-[10px] text-green-600 font-medium mt-0.5">Sera intégré dans les visuels</p>
                  </div>
                  <button onClick={removeLogo} className="w-6 h-6 rounded-lg bg-red-50 border border-red-100 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0">
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* URL + Description */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informations produit</p>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Lien produit <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://alibaba.com/product/..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Description <span className="text-gray-400 font-normal">(optionnel)</span></label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Gélules nootropiques au collagène, 60 capsules, ingrédients naturels…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all bg-gray-50 placeholder:text-gray-400 resize-none"
                />
              </div>
            </div>

            {/* Template */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Univers visuel</p>
              <div className="grid grid-cols-4 gap-2">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setVisualTemplate(tpl.id)}
                    className={`relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border-2 transition-all ${
                      visualTemplate === tpl.id
                        ? 'border-green-600 bg-green-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tpl.color} shadow-sm`} />
                    <span className={`text-[10px] font-semibold leading-none text-center ${visualTemplate === tpl.id ? 'text-green-700' : 'text-gray-500'}`}>
                      {tpl.title}
                    </span>
                    {visualTemplate === tpl.id && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Formats */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slides à générer</p>
                <button
                  onClick={() => setSelectedFormats(selectedFormats.length === FORMATS.length ? [] : FORMATS.map(f => f.id))}
                  className="text-[11px] font-medium text-green-600 hover:text-green-700"
                >
                  {selectedFormats.length === FORMATS.length ? 'Tout effacer' : 'Tout sélectionner'}
                </button>
              </div>
              <div className="space-y-1.5">
                {FORMATS.map(f => {
                  const active = selectedFormats.includes(f.id);
                  const FIcon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => toggleFormat(f.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100/60'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <FIcon size={14} className={active ? 'text-green-700' : 'text-gray-400'} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold block ${active ? 'text-green-800' : 'text-gray-600'}`}>{f.label}</span>
                        <span className="text-[10px] text-gray-400">{f.desc}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                        active ? 'border-green-600 bg-green-600' : 'border-gray-300'
                      }`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Credit Balance */}
            <div className={`rounded-xl border p-4 ${insufficientCredits ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold uppercase tracking-wide ${insufficientCredits ? 'text-red-600' : 'text-green-700'}`}>
                  {insufficientCredits ? 'Crédits insuffisants' : 'Crédits disponibles'}
                </p>
                <div className="flex items-center gap-1.5">
                  <Wallet size={12} className={insufficientCredits ? 'text-red-400' : 'text-green-600'} />
                  <span className={`text-sm font-semibold ${insufficientCredits ? 'text-red-600' : 'text-green-700'}`}>
                    {credits === null ? '…' : credits}
                  </span>
                </div>
              </div>
              {selectedFormats.length > 0 ? (
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${insufficientCredits ? 'text-red-700' : 'text-green-800'}`}>
                    {selectedFormats.length} crédit{selectedFormats.length > 1 ? 's' : ''} requis
                  </span>
                  {insufficientCredits ? (
                    <span className="text-xs font-semibold text-red-600">Manque {selectedFormats.length - (credits ?? 0)}</span>
                  ) : (
                    <span className="text-xs font-medium text-green-700">→ {(credits ?? 0) - selectedFormats.length} restants</span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sélectionnez des slides</p>
              )}
              {insufficientCredits && (
                <button
                  onClick={() => { setShowBuyModal(true); setBuyError(''); setBuySuccess(null); }}
                  className="mt-3 w-full h-9 bg-green-600 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors"
                >
                  <Plus size={11} /> Recharger les crédits
                </button>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={loading || !canGenerate || selectedFormats.length === 0 || insufficientCredits}
              className="w-full h-12 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading
                ? 'Génération en cours…'
                : insufficientCredits
                ? 'Crédits insuffisants'
                : `Générer ${selectedFormats.length} image${selectedFormats.length > 1 ? 's' : ''}`}
            </button>
            {!canGenerate && !insufficientCredits && (
              <p className="text-[11px] text-center text-gray-400 -mt-2">Ajoutez une image produit ou un lien produit</p>
            )}
          </div>

          {/* RIGHT: Results Area */}
          <div className="flex-1 min-w-0">

            {/* Loading */}
            {loading && (
              <div className="bg-white rounded-xl border border-gray-200 p-10">
                <div className="flex flex-col items-center">
                  <div className="relative mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-green-50 flex items-center justify-center">
                      <Loader2 size={32} className="text-green-600 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">L'IA crée vos visuels…</h3>
                  <p className="text-sm text-gray-500 mb-8">Ça prend ~2 minutes pour {selectedFormats.length} image{selectedFormats.length > 1 ? 's' : ''}</p>
                  <div className="w-full max-w-xs space-y-2">
                    {STEPS.map((step, i) => {
                      const StepIcon = step.icon;
                      const isDone = i < currentStep;
                      const isCurrent = i === currentStep;
                      return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isCurrent ? 'bg-green-50 border-green-200' :
                          isDone ? 'bg-gray-50 border-gray-200' :
                          'bg-gray-50 border-gray-100'
                        }`}>
                          {isDone ? (
                            <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                              <CheckCircle size={14} className="text-white" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                              <Loader2 size={14} className="text-white animate-spin" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                              <StepIcon size={14} className="text-gray-400" />
                            </div>
                          )}
                          <span className={`text-sm font-medium ${
                            isDone ? 'text-gray-700' : isCurrent ? 'text-green-800' : 'text-gray-400'
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
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Erreur de génération</p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {result && !loading && (
              <div className="space-y-4">
                {/* Topbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border bg-gray-100 text-gray-700 border-gray-200">
                      {activeTpl.title}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      {result.creatives?.filter(c => c.imageUrl).length} visuels générés
                    </span>
                    {result.cost && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                        ~{result.cost.costFcfa} FCFA
                      </span>
                    )}
                  </div>
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 bg-green-50 hover:bg-green-100 h-8 px-3 rounded-lg transition-colors border border-green-100"
                  >
                    <RefreshCw size={12} /> Regénérer
                  </button>
                </div>

                {/* Analysis accordion */}
                {result.analysis && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setShowAnalysis(!showAnalysis)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                          <Globe size={14} className="text-gray-500" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-semibold text-gray-800">{result.analysis.productName}</span>
                          <span className="text-xs text-gray-400 block">{result.analysis.category} · {result.analysis.targetAudience}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.productImageFound && (
                          <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-md">
                            Image détectée
                          </span>
                        )}
                        <ChevronDown size={15} className={`text-gray-400 transition-transform ${showAnalysis ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showAnalysis && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Accroche</p>
                          <p className="text-sm text-gray-700">{result.analysis.emotionalHook}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Angle promo</p>
                          <p className="text-sm text-gray-700">{result.analysis.promoAngle}</p>
                        </div>
                        {result.analysis.keyBenefits?.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bénéfices</p>
                            <div className="flex flex-wrap gap-1.5">
                              {result.analysis.keyBenefits.map((b, i) => (
                                <span key={i} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-md font-medium">{b}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.analysis.slogans?.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Slogans</p>
                            <div className="space-y-1">
                              {result.analysis.slogans.map((s, i) => (
                                <p key={i} className="text-sm text-gray-700 bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">{s}</p>
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
                    <div key={creative.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden group hover:shadow-sm hover:-translate-y-0.5 transition-all">
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
                                  onClick={() => downloadImage(creative.imageUrl, `${creative.id}.png`)}
                                  className="flex items-center gap-1.5 bg-white text-gray-900 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg hover:bg-gray-100 transition-colors"
                                >
                                  <Download size={13} /> Télécharger
                                </button>
                                <button
                                  onClick={() => copyImageUrl(creative.imageUrl, creative.id)}
                                  className="w-8 h-8 bg-white/90 text-gray-900 rounded-lg flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                                >
                                  {copiedId === creative.id ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
                                </button>
                                <a
                                  href={creative.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 bg-white/90 text-gray-900 rounded-lg flex items-center justify-center shadow-lg hover:bg-white transition-colors"
                                >
                                  <ExternalLink size={14} />
                                </a>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                              <AlertCircle size={18} className="text-red-400" />
                            </div>
                            <p className="text-xs text-gray-400 text-center leading-tight">{creative.error || 'Génération échouée'}</p>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5 flex items-center justify-between border-t border-gray-100">
                        <div>
                          <p className="text-xs font-semibold text-gray-800 leading-tight">{creative.label}</p>
                          <p className="text-[10px] text-gray-400">{creative.aspectRatio}</p>
                        </div>
                        {creative.imageUrl && (
                          <button
                            onClick={() => downloadImage(creative.imageUrl, `${creative.id}.png`)}
                            className="w-7 h-7 rounded-lg bg-green-50 border border-green-100 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
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
              <div className="bg-white rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-5">
                  <LayoutGrid size={24} className="text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Vos créas apparaîtront ici</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Configurez votre produit à gauche, choisissez les slides et lancez la génération.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {FORMATS.map(f => {
                    const FIcon = f.icon;
                    return (
                      <span key={f.id} className="flex items-center gap-1 text-[11px] font-medium bg-gray-50 border border-gray-100 text-gray-500 px-3 py-1.5 rounded-lg">
                        <FIcon size={11} className="text-gray-400" strokeWidth={1.75} />
                        {f.label}
                      </span>
                    );
                  })}
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
