import React, { useState, useCallback } from 'react';
import { Link2, Sparkles, Download, RefreshCw, Image, Globe, Loader2, CheckCircle, AlertCircle, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const FORMATS = [
  { id: 'promo-story', label: 'Story Promo', ratio: '9:16', icon: '📱', desc: 'Instagram / WhatsApp Story' },
  { id: 'post-carre', label: 'Post Carré', ratio: '1:1', icon: '📸', desc: 'Facebook / Instagram Post' },
  { id: 'banniere-fb', label: 'Bannière FB', ratio: '16:9', icon: '🖼️', desc: 'Couverture Facebook / Pub' },
  { id: 'whatsapp-status', label: 'WhatsApp Status', ratio: '9:16', icon: '💬', desc: 'Statut WhatsApp percutant' },
];

const STEPS = [
  { icon: Globe, label: 'Analyse du site…', color: 'text-blue-500' },
  { icon: Sparkles, label: 'Copywriting IA…', color: 'text-purple-500' },
  { icon: Image, label: 'Génération des visuels…', color: 'text-emerald-500' },
];

const CreativeGenerator = () => {
  const [url, setUrl] = useState('');
  const [selectedFormats, setSelectedFormats] = useState(['promo-story', 'post-carre']);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);

  const toggleFormat = (id) => {
    setSelectedFormats(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const generate = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setCurrentStep(0);

    // Simulate step progression
    const stepTimer1 = setTimeout(() => setCurrentStep(1), 3000);
    const stepTimer2 = setTimeout(() => setCurrentStep(2), 8000);

    try {
      const res = await ecomApi.post('/ai/creative-generator', {
        url: url.trim(),
        formats: selectedFormats.length > 0 ? selectedFormats : undefined,
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
  }, [url, selectedFormats]);

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
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Générateur de Créas</h1>
              <p className="text-sm text-gray-500">Visuels marketing pour le marché africain — 100% IA</p>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-3 max-w-2xl">
            Collez simplement le lien de votre site ou page produit. L'IA analyse tout (nom, couleurs, offre, audience)
            et génère des visuels prêts à poster sur WhatsApp, Instagram et Facebook. <strong>Aucune image produit requise.</strong>
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          {/* URL Input */}
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-700 mb-2 block">Lien du site ou produit</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://monsite.com ou https://monsite.com/produit"
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50/50 placeholder:text-gray-400"
                  onKeyDown={e => e.key === 'Enter' && !loading && generate()}
                />
              </div>
              <button
                onClick={generate}
                disabled={loading || !url.trim() || selectedFormats.length === 0}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-200/50 flex items-center gap-2 shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Génération…' : 'Générer'}
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2.5 block">Formats à générer</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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
                    <p className="text-xs text-gray-500">
                      {result.analysis?.category} — {result.analysis?.targetAudience || 'Marché africain'}
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
                <button
                  onClick={generate}
                  disabled={loading}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  <RefreshCw size={12} /> Regénérer
                </button>
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
