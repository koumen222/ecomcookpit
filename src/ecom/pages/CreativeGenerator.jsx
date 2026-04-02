import React, { useState, useCallback, useRef } from 'react';
import { Link2, Sparkles, Download, RefreshCw, Image, Globe, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, ExternalLink, Upload, X, FileText } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const FORMATS = [
  { id: 'hero-benefits', label: 'Problème → Solution', ratio: '1:1', icon: '✨', desc: 'Problème + produit + solution' },
  { id: 'target-promise', label: 'Pourquoi l\'adorer', ratio: '1:1', icon: '🎯', desc: 'Bénéfices + lifestyle émotionnel' },
  { id: 'problem-solution', label: 'Situations d\'usage', ratio: '1:1', icon: '💡', desc: 'Grille 2x2 moments de vie' },
  { id: 'how-to-use', label: 'Mode d\'emploi', ratio: '1:1', icon: '📋', desc: '3 étapes simples' },
  { id: 'ingredients-trust', label: 'Confiance & Qualité', ratio: '1:1', icon: '🛡️', desc: 'Ingrédients + badges certifs' },
  { id: 'comparison', label: 'Comparaison', ratio: '1:1', icon: '⚖️', desc: 'Tableau ✓ / ✗ vs concurrents' },
  { id: 'social-proof', label: 'Preuve Sociale', ratio: '1:1', icon: '👥', desc: 'Clients satisfaits avec le produit' },
];

const STEPS = [
  { icon: Globe, label: 'Analyse marketing du produit…', color: 'text-blue-500' },
  { icon: Sparkles, label: 'Préparation des prompts créatifs…', color: 'text-purple-500' },
  { icon: Image, label: 'Génération des listing images…', color: 'text-emerald-500' },
];

const CreativeGenerator = () => {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selectedFormats, setSelectedFormats] = useState(['hero-benefits', 'target-promise', 'problem-solution', 'how-to-use', 'ingredients-trust', 'comparison', 'social-proof']);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
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
      formData.append('formats', JSON.stringify(selectedFormats.length > 0 ? selectedFormats : undefined));

      const res = await ecomApi.post('/ai/creative-generator', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 min for 6 images
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
  }, [url, description, productImage, selectedFormats, canGenerate]);

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

  const copyImageUrl = (imageUrl) => {
    navigator.clipboard.writeText(imageUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Premium Listing Images</h1>
              <p className="text-sm text-gray-500">Visuels produit pro pour marketplace — 100% IA</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-3 max-w-2xl">
            Uploadez l'image de votre produit + collez un lien Alibaba/AliExpress OU écrivez une description.
            L'IA génère <strong>6 Listing Images premium</strong> : bénéfices, cible, problème/solution, mode d'emploi, confiance, comparaison.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          {/* Product Image Upload */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Photo du produit <span className="text-purple-500 font-normal">(recommandé)</span></label>
            <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
            {!imagePreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-all flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                  <Upload size={22} className="text-gray-400 group-hover:text-purple-500" />
                </div>
                <span className="text-sm font-medium text-gray-500 group-hover:text-purple-600">Cliquez pour uploader l'image produit</span>
                <span className="text-xs text-gray-400">PNG, JPG, WebP — max 10 MB</span>
              </button>
            ) : (
              <div className="relative inline-block">
                <img src={imagePreview} alt="Produit" className="h-32 w-32 object-cover rounded-xl border-2 border-purple-200 shadow-sm" />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          {/* URL Input */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Lien Alibaba / AliExpress / produit <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <div className="relative">
              <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://alibaba.com/product/..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50/50 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Description du produit <span className="text-gray-400 font-normal">(optionnel si lien fourni)</span></label>
            <div className="relative">
              <FileText size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Gélules nootropiques au collagène pour améliorer la mémoire et la concentration. 60 capsules, ingrédients naturels..."
                rows={3}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50/50 placeholder:text-gray-400 resize-none"
              />
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2.5 block">Formats à générer</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
              {FORMATS.map(f => {
                const active = selectedFormats.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFormat(f.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-purple-400 bg-purple-50/60 shadow-sm'
                        : 'border-gray-100 bg-gray-50/40 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{f.icon}</span>
                      <span className={`text-xs font-bold ${active ? 'text-purple-700' : 'text-gray-600'}`}>{f.label}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">{f.desc}</div>
                    <div className={`text-[10px] font-mono mt-1 ${active ? 'text-purple-500' : 'text-gray-300'}`}>{f.ratio}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={generate}
            disabled={loading || !canGenerate || selectedFormats.length === 0}
            className="w-full mt-5 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-200/50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {loading ? 'Génération en cours…' : `Générer ${selectedFormats.length} Listing Image${selectedFormats.length > 1 ? 's' : ''}`}
          </button>
          {!canGenerate && (
            <p className="text-xs text-center text-gray-400 mt-2">Ajoutez une image produit, un lien, ou une description pour commencer</p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <Loader2 size={28} className="text-purple-500 animate-spin" />
                </div>
              </div>
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-1">Magie en cours…</h3>
                <p className="text-sm text-gray-500">L'IA analyse votre site et crée vos visuels</p>
              </div>
              <div className="w-full max-w-sm space-y-3">
                {STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  const isDone = i < currentStep;
                  const isCurrent = i === currentStep;
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isCurrent ? 'bg-gray-50 shadow-sm' : ''
                    }`}>
                      {isDone ? (
                        <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={18} className={`${step.color} animate-spin shrink-0`} />
                      ) : (
                        <StepIcon size={18} className="text-gray-300 shrink-0" />
                      )}
                      <span className={`text-sm font-medium ${isDone ? 'text-emerald-600' : isCurrent ? 'text-gray-800' : 'text-gray-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Erreur de génération</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Analysis Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowAnalysis(!showAnalysis)}
                className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Globe size={16} className="text-blue-500" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-gray-800">
                      {result.analysis?.productName || 'Analyse'}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      {result.analysis?.category} — {result.analysis?.targetAudience || 'Marché africain'}
                      {result.productImageFound && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          📸 Image produit détectée
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showAnalysis ? 'rotate-180' : ''}`} />
              </button>
              {showAnalysis && result.analysis && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</span>
                      <p className="text-gray-700 mt-1">{result.analysis.shortDescription}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Accroche</span>
                      <p className="text-gray-700 mt-1">{result.analysis.emotionalHook}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Angle promo</span>
                      <p className="text-gray-700 mt-1">{result.analysis.promoAngle}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Prix</span>
                      <p className="text-gray-700 mt-1">{result.analysis.priceRange || 'Non visible'}</p>
                    </div>
                    {result.analysis.keyBenefits?.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Bénéfices clés</span>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {result.analysis.keyBenefits.map((b, i) => (
                            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">✅ {b}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.analysis.slogans?.length > 0 && (
                      <div className="md:col-span-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Slogans générés</span>
                        <div className="space-y-1.5 mt-1.5">
                          {result.analysis.slogans.map((s, i) => (
                            <div key={i} className="text-sm text-gray-700 bg-purple-50/60 px-3 py-2 rounded-lg font-medium">
                              💡 {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Creatives Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">
                  Vos créas ({result.creatives?.filter(c => c.imageUrl).length || 0})
                </h2>
                <div className="flex items-center gap-3">
                  {result.cost && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      <span>💰</span>
                      <span>{result.cost.images} images</span>
                      <span className="text-gray-300">•</span>
                      <span className="font-bold text-gray-700">~{result.cost.costFcfa} FCFA</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-400">${result.cost.costUsd}</span>
                    </div>
                  )}
                  <button
                    onClick={generate}
                    disabled={loading}
                    className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    <RefreshCw size={12} /> Regénérer
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {result.creatives?.map((creative) => (
                  <div key={creative.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group">
                    {/* Image */}
                    <div className={`relative bg-gray-100 flex items-center justify-center overflow-hidden ${
                      creative.aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[480px]' :
                      creative.aspectRatio === '16:9' ? 'aspect-video' :
                      'aspect-square'
                    }`}>
                      {creative.imageUrl ? (
                        <>
                          <img
                            src={creative.imageUrl}
                            alt={creative.label}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay actions */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button
                              onClick={() => downloadImage(creative.imageUrl, `${creative.id}-${Date.now()}.png`)}
                              className="p-3 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-lg transition-all hover:scale-105"
                              title="Télécharger"
                            >
                              <Download size={18} />
                            </button>
                            <button
                              onClick={() => copyImageUrl(creative.imageUrl)}
                              className="p-3 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-lg transition-all hover:scale-105"
                              title="Copier l'URL"
                            >
                              <Copy size={18} />
                            </button>
                            <a
                              href={creative.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-3 rounded-full bg-white/90 hover:bg-white text-gray-800 shadow-lg transition-all hover:scale-105"
                              title="Ouvrir"
                            >
                              <ExternalLink size={18} />
                            </a>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6">
                          <AlertCircle size={24} className="text-gray-300 mx-auto mb-2" />
                          <p className="text-xs text-gray-400">{creative.error || 'Génération échouée'}</p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-gray-800">{creative.label}</span>
                        <span className="text-xs text-gray-400 ml-2">{creative.aspectRatio}</span>
                      </div>
                      {creative.imageUrl && (
                        <button
                          onClick={() => downloadImage(creative.imageUrl, `${creative.id}-${Date.now()}.png`)}
                          className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors"
                        >
                          <Download size={12} /> Télécharger
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !result && !error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mx-auto mb-5">
              <Image size={32} className="text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Prêt à créer des visuels ?</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Collez le lien de votre site, choisissez vos formats, et laissez l'IA générer
              des créas marketing adaptées au marché africain.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {['WhatsApp Status', 'Story Instagram', 'Post Facebook', 'Bannière pub'].map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreativeGenerator;
