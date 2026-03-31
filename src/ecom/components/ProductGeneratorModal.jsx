import React, { useState } from 'react';
import { X, Upload, Wand2, AlertCircle } from 'lucide-react';

/**
 * Composant Modal de Génération de Page Produit Avancée
 * Intègre tous les paramètres copywriting pour une génération optimale
 */
const ProductGeneratorModal = ({ isOpen, onClose, workspaceId, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Base, 2: Copywriting, 3: Génération
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // État du formulaire
  const [formData, setFormData] = useState({
    // Étape 1: Informations de base
    sourceType: 'url', // url | description
    url: '',
    description: '',
    images: [],
    
    // Étape 2: Paramètres copywriting avancés
    marketingApproach: 'AIDA',
    copywritingAngle: 'PROBLEME_SOLUTION',
    language: 'français',
    tone: 'urgence',
    targetAudience: '',
    customerReviews: '',
    socialProofLinks: '',
    mainOffer: '',
    objections: '',
    keyBenefits: ''
  });

  const marketingApproaches = [
    { value: 'AIDA', label: 'AIDA', description: 'Attention → Intérêt → Désir → Action' },
    { value: 'PAS', label: 'PAS', description: 'Problème → Agitation → Solution' },
    { value: 'BAB', label: 'BAB', description: 'Before → After → Bridge' },
    { value: 'FAB', label: 'FAB', description: 'Features → Advantages → Benefits' }
  ];

  const copywritingAngles = [
    { 
      value: 'PROBLEME_SOLUTION', 
      label: 'Problème → Solution',
      description: 'Empathie + résolution',
      icon: '🎯'
    },
    { 
      value: 'PREUVE_SOCIALE', 
      label: 'Preuve sociale',
      description: 'Résultats, avis, viral',
      icon: '⭐'
    },
    { 
      value: 'URGENCE', 
      label: 'Urgence / Rareté',
      description: 'Stock limité, offre temporaire',
      icon: '⚡'
    },
    { 
      value: 'TRANSFORMATION', 
      label: 'Transformation',
      description: 'Avant/après, lifestyle',
      icon: '✨'
    },
    { 
      value: 'AUTORITE', 
      label: 'Autorité',
      description: 'Expertise, certifications',
      icon: '🏆'
    }
  ];

  const tones = [
    { value: 'urgence', label: 'Urgence', emoji: '🔥', description: 'Stock limité, action immédiate' },
    { value: 'premium', label: 'Premium', emoji: '💎', description: 'Qualité exceptionnelle, exclusivité' },
    { value: 'fun', label: 'Fun', emoji: '🎉', description: 'Enjoué, dynamique, émojis' },
    { value: 'serieux', label: 'Sérieux', emoji: '🎓', description: 'Professionnel, crédible, fiable' }
  ];

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files).slice(0, 8);
    setFormData(prev => ({ ...prev, images: files }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    try {
      const formDataToSend = new FormData();

      // Paramètres de base
      if (formData.sourceType === 'url') {
        formDataToSend.append('url', formData.url);
        formDataToSend.append('skipScraping', 'false');
      } else {
        formDataToSend.append('description', formData.description);
        formDataToSend.append('skipScraping', 'true');
      }

      // Images
      formData.images.forEach(image => {
        formDataToSend.append('images', image);
      });

      // Approche marketing
      formDataToSend.append('marketingApproach', formData.marketingApproach);
      formDataToSend.append('copywritingAngle', formData.copywritingAngle);

      // Copywriting avancé
      formDataToSend.append('language', formData.language);
      formDataToSend.append('tone', formData.tone);
      
      if (formData.targetAudience) {
        formDataToSend.append('targetAudience', formData.targetAudience);
      }
      if (formData.customerReviews) {
        formDataToSend.append('customerReviews', formData.customerReviews);
      }
      if (formData.socialProofLinks) {
        formDataToSend.append('socialProofLinks', formData.socialProofLinks);
      }
      if (formData.mainOffer) {
        formDataToSend.append('mainOffer', formData.mainOffer);
      }
      if (formData.objections) {
        formDataToSend.append('objections', formData.objections);
      }
      if (formData.keyBenefits) {
        formDataToSend.append('keyBenefits', formData.keyBenefits);
      }

      const response = await fetch('/api/ai/product-generator', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Erreur lors de la génération');
      }

      onSuccess(result.product);
      onClose();

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const isStep1Valid = () => {
    if (formData.sourceType === 'url') {
      return formData.url.trim().length > 10;
    } else {
      return formData.description.trim().length >= 20 && formData.images.length > 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Génération de Page Produit IA
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Étape {step} sur 2 — {step === 1 ? 'Informations produit' : 'Copywriting avancé'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de progression */}
        <div className="h-2 bg-gray-100">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ÉTAPE 1: Informations de base */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Type de source */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Source du contenu produit
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, sourceType: 'url' }))}
                    className={`p-4 rounded-lg border-2 transition ${
                      formData.sourceType === 'url' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">URL Alibaba/AliExpress</div>
                    <div className="text-xs text-gray-500 mt-1">Scraping automatique</div>
                  </button>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, sourceType: 'description' }))}
                    className={`p-4 rounded-lg border-2 transition ${
                      formData.sourceType === 'description' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold">Description directe</div>
                    <div className="text-xs text-gray-500 mt-1">Rédiger manuellement</div>
                  </button>
                </div>
              </div>

              {/* URL ou Description */}
              {formData.sourceType === 'url' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL du produit
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://www.alibaba.com/product/..."
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description du produit (min 20 caractères)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez votre produit en détail : nom, caractéristiques, utilisation, bénéfices..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {formData.description.length} / 20 caractères minimum
                  </div>
                </div>
              )}

              {/* Upload images */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Photos du produit (min 1, max 8)
                  {formData.sourceType === 'description' && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <div className="text-sm font-medium text-gray-700">
                      Cliquez pour uploader des images
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      PNG, JPG, WEBP jusqu'à 10MB chacune
                    </div>
                  </label>
                </div>
                {formData.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                        {img.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ÉTAPE 2: Copywriting avancé */}
          {step === 2 && (
            <div className="space-y-6">
              
              {/* Marketing Approach */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Approche marketing 🎯
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {marketingApproaches.map(approach => (
                    <button
                      key={approach.value}
                      onClick={() => setFormData(prev => ({ ...prev, marketingApproach: approach.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        formData.marketingApproach === approach.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{approach.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{approach.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Copywriting Angle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Angle copywriting principal ✨
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {copywritingAngles.map(angle => (
                    <button
                      key={angle.value}
                      onClick={() => setFormData(prev => ({ ...prev, copywritingAngle: angle.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition flex items-center gap-3 ${
                        formData.copywritingAngle === angle.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{angle.icon}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{angle.label}</div>
                        <div className="text-xs text-gray-500">{angle.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Ton de communication 🎨
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {tones.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setFormData(prev => ({ ...prev, tone: t.value }))}
                      className={`p-3 rounded-lg border-2 text-left transition ${
                        formData.tone === t.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{t.emoji}</span>
                        <span className="font-semibold text-sm">{t.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎯 Cible client (optionnel mais recommandé)
                </label>
                <textarea
                  value={formData.targetAudience}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="Ex: Femmes 28-45 ans, mamans actives qui manquent de temps, sensibles au naturel, zone urbaine..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Main Offer */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🎁 Offre principale (optionnel)
                </label>
                <input
                  type="text"
                  value={formData.mainOffer}
                  onChange={(e) => setFormData(prev => ({ ...prev, mainOffer: e.target.value }))}
                  placeholder="Ex: -40% aujourd'hui seulement + Livraison gratuite sous 48h"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Key Benefits */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ✨ Points forts à mettre en avant (optionnel)
                </label>
                <textarea
                  value={formData.keyBenefits}
                  onChange={(e) => setFormData(prev => ({ ...prev, keyBenefits: e.target.value }))}
                  placeholder="Ex: Sans BPA, Certifié CE, Garantie 2 ans, Support 7j/7, Adapté peaux noires"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Objections */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🚫 Objections courantes (optionnel)
                </label>
                <textarea
                  value={formData.objections}
                  onChange={(e) => setFormData(prev => ({ ...prev, objections: e.target.value }))}
                  placeholder="Ex: Ça va tenir dans le temps ? Est-ce que ça fonctionne vraiment ? Et si ça ne me convient pas ?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Customer Reviews */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ⭐ Avis clients à intégrer (optionnel)
                </label>
                <textarea
                  value={formData.customerReviews}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerReviews: e.target.value }))}
                  placeholder="Collez ici les avis bruts, l'IA les reformatera et optimisera..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
              </div>

              {/* Social Proof Links */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🔗 Preuves sociales / Liens (optionnel)
                </label>
                <textarea
                  value={formData.socialProofLinks}
                  onChange={(e) => setFormData(prev => ({ ...prev, socialProofLinks: e.target.value }))}
                  placeholder="Ex: TikTok viral: https://tiktok.com/..., Article de presse, Page Instagram"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                />
              </div>

            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition"
                >
                  ← Retour
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Annuler
              </button>
              {step === 1 ? (
                <button
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid()}
                  className={`px-6 py-2.5 rounded-lg font-medium transition ${
                    isStep1Valid()
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Suivant →
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="px-8 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Générer la page
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductGeneratorModal;
