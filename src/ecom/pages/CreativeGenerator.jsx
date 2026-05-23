import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Sparkles, Download, RefreshCw, Image, Globe, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, ExternalLink, Upload, X, FileText, Zap, Shield, Star, LayoutGrid, Package, Wallet, Plus, CreditCard } from 'lucide-react';
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

  // Credit system
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

  const canGenerate = productImage || url.trim() || description.trim();

  // Fetch credits on mount
  useEffect(() => {
    ecomApi.get('/billing/creative-credits')
      .then(r => setCredits(r.data.credits ?? 0))
      .catch(() => setCredits(0));
  }, []);

  // Poll payment status
  const startPoll = useCallback((token) => {
    pendingTokenRef.current = token;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await ecomApi.get(`/billing/status/${token}`);
        const s = r.data?.payment?.status;
        if (s === 'paid') {
          clearInterval(pollIntervalRef.current);
          setBuySuccess('Paiement confirmé ! Vos crédits ont été ajoutés.');
          setBuyLoading(false);
          // Refresh credits
          const cr = await ecomApi.get('/billing/creative-credits');
          setCredits(cr.data.credits ?? 0);
        } else if (s === 'failure' || s === 'no paid') {
          clearInterval(pollIntervalRef.current);
          setBuyError('Paiement échoué ou annulé.');
          setBuyLoading(false);
        }
      } catch { /* ignore poll errors */ }
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

      {/* ── Buy Credits Modal ─────────────────────────────────── */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-scalor-black px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-scalor-green rounded-lg flex items-center justify-center">
                  <CreditCard size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">Recharger les crédits</p>
                  <p className="text-white/40 text-[11px]">80 FCFA / image générée</p>
                </div>
              </div>
              <button onClick={() => { setShowBuyModal(false); clearInterval(pollIntervalRef.current); setBuyLoading(false); }} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {buySuccess ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-scalor-green" />
                  </div>
                  <p className="font-black text-gray-900 text-base">{buySuccess}</p>
                  <p className="text-sm text-gray-500 mt-1">Solde actuel : <strong>{credits}</strong> crédit{credits !== 1 ? 's' : ''}</p>
                  <button onClick={() => setShowBuyModal(false)} className="mt-4 w-full py-2.5 bg-scalor-green text-white font-bold rounded-xl text-sm">Fermer</button>
                </div>
              ) : (
                <>
                  {/* Pack selector */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Choisir un pack</p>
                    <div className="space-y-2">
                      {CREDIT_PACKS.map(pack => (
                        <button
                          key={pack.quantity}
                          onClick={() => setBuyPack(pack)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${buyPack.quantity === pack.quantity ? 'border-scalor-green bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-800">{pack.label}</span>
                            {pack.badge && <span className="text-[10px] font-bold bg-scalor-green text-white px-2 py-0.5 rounded-full">{pack.badge}</span>}
                          </div>
                          <span className="font-black text-scalor-green">{pack.price.toLocaleString('fr-FR')} <span className="text-xs font-bold">FCFA</span></span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Contact info */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Numéro de téléphone</label>
                      <input
                        type="tel"
                        value={buyPhone}
                        onChange={e => setBuyPhone(e.target.value)}
                        placeholder="Ex: 6XXXXXXXX"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-scalor-green focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Nom complet</label>
                      <input
                        type="text"
                        value={buyName}
                        onChange={e => setBuyName(e.target.value)}
                        placeholder="Votre nom"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-scalor-green focus:ring-2 focus:ring-green-100"
                      />
                    </div>
                  </div>
                  {buyError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-red-700 font-medium">
                      <AlertCircle size={13} /> {buyError}
                    </div>
                  )}
                  {buyLoading && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-blue-700 font-medium">
                      <Loader2 size={13} className="animate-spin" /> Attente de confirmation du paiement…
                    </div>
                  )}
                  <button
                    onClick={handleBuyCredits}
                    disabled={buyLoading}
                    className="w-full py-3 bg-scalor-green hover:bg-scalor-green-dark disabled:opacity-50 text-white font-black rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
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
          {/* Right: gallery link + credit balance + recharge */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/ecom/creatives/gallery"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white/60 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <LayoutGrid size={11} />
              <span className="hidden sm:inline">Mes visuels</span>
            </Link>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <Wallet size={12} className="text-scalor-green" />
              <span className="text-white font-black text-sm">{credits === null ? '…' : credits}</span>
              <span className="text-white/40 text-xs hidden sm:inline">crédit{credits !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => { setShowBuyModal(true); setBuyError(''); setBuySuccess(null); }}
              className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-scalor-green hover:bg-scalor-green-dark px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} /> Recharger
            </button>
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

            {/* Logo (optionnel) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Logo de marque</p>
                <span className="text-[10px] font-semibold text-scalor-green bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">Optionnel</span>
              </div>
              <input type="file" ref={logoInputRef} onChange={handleLogoSelect} accept="image/*" className="hidden" />
              {!logoPreview ? (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-gray-100 rounded-xl hover:border-scalor-green/40 hover:bg-green-50/30 transition-all flex items-center gap-3 px-4 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-green-100 flex items-center justify-center transition-colors shrink-0">
                    <Package size={16} className="text-gray-400 group-hover:text-scalor-green" />
                  </div>
                  <div className="text-left">
                    <span className="block text-xs font-semibold text-gray-500 group-hover:text-scalor-green">Ajouter votre logo</span>
                    <span className="text-[10px] text-gray-400">PNG transparent recommandé</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded-lg bg-white border border-gray-200 p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{logoImage?.name}</p>
                    <p className="text-[10px] text-gray-400">{logoImage ? `${(logoImage.size / 1024).toFixed(0)} KB` : ''}</p>
                    <p className="text-[10px] text-scalor-green font-medium mt-0.5">✓ Sera intégré dans les visuels</p>
                  </div>
                  <button onClick={removeLogo} className="w-6 h-6 rounded-full bg-red-50 border border-red-100 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0">
                    <X size={11} />
                  </button>
                </div>
              )}
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

            {/* Credit Balance + Pricing Preview */}
            <div className={`rounded-2xl border p-4 ${insufficientCredits ? 'bg-red-50/60 border-red-200' : 'bg-scalor-green/5 border-scalor-green/15'}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-bold uppercase tracking-widest ${insufficientCredits ? 'text-red-600' : 'text-scalor-green'}`}>
                  {insufficientCredits ? 'Crédits insuffisants' : 'Crédits disponibles'}
                </p>
                <div className="flex items-center gap-1.5">
                  <Wallet size={12} className={insufficientCredits ? 'text-red-400' : 'text-scalor-green'} />
                  <span className={`text-sm font-black ${insufficientCredits ? 'text-red-600' : 'text-scalor-green'}`}>
                    {credits === null ? '…' : credits}
                  </span>
                </div>
              </div>
              {selectedFormats.length > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">
                    {selectedFormats.length} crédit{selectedFormats.length > 1 ? 's' : ''} requis
                  </span>
                  {insufficientCredits ? (
                    <span className="text-xs font-bold text-red-600">
                      Manque {selectedFormats.length - (credits ?? 0)}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-gray-500">
                      → {(credits ?? 0) - selectedFormats.length} restants
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">Sélectionnez des slides</p>
              )}
              {insufficientCredits && (
                <button
                  onClick={() => { setShowBuyModal(true); setBuyError(''); setBuySuccess(null); }}
                  className="mt-3 w-full py-2 bg-scalor-green text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-scalor-green-dark transition-colors"
                >
                  <Plus size={11} /> Recharger les crédits
                </button>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={generate}
              disabled={loading || !canGenerate || selectedFormats.length === 0 || insufficientCredits}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-scalor-green to-scalor-copper text-white font-black text-sm tracking-wide hover:from-scalor-green-dark hover:to-scalor-copper-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-scalor-green/30 flex items-center justify-center gap-2.5"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading
                ? 'Génération en cours…'
                : insufficientCredits
                ? 'Crédits insuffisants'
                : `Générer ${selectedFormats.length} image${selectedFormats.length > 1 ? 's' : ''}`}
            </button>
            {!canGenerate && !insufficientCredits && (
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
