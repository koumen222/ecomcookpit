import React, { useState } from 'react';
import { X, Upload, Wand2, AlertCircle } from 'lucide-react';

const TARGET_GENDER_OPTIONS = [
  { value: 'auto', label: 'Auto', hint: 'L’IA choisit selon le produit' },
  { value: 'female', label: 'Femme', hint: 'Audience surtout féminine' },
  { value: 'male', label: 'Homme', hint: 'Audience surtout masculine' },
  { value: 'mixed', label: 'Les deux', hint: 'Audience mixte / unisexe' },
];

const TARGET_AGE_OPTIONS = [
  { value: 'auto', label: 'Âge auto' },
  { value: '18-24', label: '18-24 ans' },
  { value: '25-34', label: '25-34 ans' },
  { value: '35-44', label: '35-44 ans' },
  { value: '45-54', label: '45-54 ans' },
  { value: '55+', label: '55 ans et plus' },
];

const TARGET_PROFILE_OPTIONS = [
  { value: 'auto', label: 'Profil auto' },
  { value: 'general', label: 'Grand public' },
  { value: 'urban_active', label: 'Actif urbain' },
  { value: 'parent', label: 'Parent actif' },
  { value: 'student', label: 'Étudiant / jeune actif' },
  { value: 'professional', label: 'Professionnel' },
  { value: 'sporty', label: 'Sportif / lifestyle actif' },
  { value: 'premium', label: 'Client premium' },
  { value: 'senior', label: 'Senior' },
];

const TARGET_GENDER_LABELS = {
  auto: '',
  female: 'femme',
  male: 'homme',
  mixed: 'hommes et femmes',
};

const TARGET_PROFILE_LABELS = {
  auto: '',
  general: 'grand public',
  urban_active: 'actif urbain',
  parent: 'parent actif',
  student: 'etudiant ou jeune actif',
  professional: 'professionnel',
  sporty: 'profil sportif et actif',
  premium: 'client premium',
  senior: 'senior',
};

function buildTargetAvatarSummary({ gender = 'auto', ageRange = 'auto', profile = 'auto' } = {}) {
  return [
    TARGET_GENDER_LABELS[gender],
    ageRange !== 'auto' ? `${ageRange} ans` : '',
    TARGET_PROFILE_LABELS[profile],
  ].filter(Boolean).join(', ');
}

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
    
    // Étape 2: Paramètres copywriting simplifiés
    marketingApproach: 'PAS',
    language: 'français',
    tone: 'urgence',
    targetGender: 'auto',
    targetAgeRange: 'auto',
    targetProfile: 'auto',
    mainProblem: ''
  });
  const targetAvatarSummary = buildTargetAvatarSummary({
    gender: formData.targetGender,
    ageRange: formData.targetAgeRange,
    profile: formData.targetProfile,
  });

  const marketingApproaches = [
    { value: 'PAS', label: 'PAS', description: 'Problème → Agitation → Solution' },
    { value: 'AIDA', label: 'AIDA', description: 'Attention → Intérêt → Désir → Action' },
    { value: 'BAB', label: 'BAB', description: 'Before → After → Bridge' }
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

      // Approche marketing simplifiée
      formDataToSend.append('marketingApproach', formData.marketingApproach);
      formDataToSend.append('language', formData.language);
      formDataToSend.append('tone', formData.tone);

      if (targetAvatarSummary) formDataToSend.append('targetAvatar', targetAvatarSummary);
      formDataToSend.append('targetGender', formData.targetGender);
      formDataToSend.append('targetAgeRange', formData.targetAgeRange);
      formDataToSend.append('targetProfile', formData.targetProfile);
      if (formData.mainProblem) {
        formDataToSend.append('mainProblem', formData.mainProblem);
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

              {/* Tone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Ton de communication
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

              {/* Avatar cible */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Avatar client cible (optionnel)
                </label>
                <p className="text-xs text-gray-500 mb-3">Choisis directement le genre, l’âge et le profil de l’audience.</p>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  {TARGET_GENDER_OPTIONS.map((option) => {
                    const isActive = formData.targetGender === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, targetGender: option.value }))}
                        className={`p-3 rounded-lg border-2 text-left transition ${
                          isActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-sm">{option.label}</div>
                            <div className="text-xs text-gray-500 mt-1">{option.hint}</div>
                          </div>
                          <div className={`mt-0.5 h-4 w-4 rounded-full border ${isActive ? 'border-purple-600 bg-purple-600' : 'border-gray-300 bg-white'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tranche d’âge</label>
                    <select
                      value={formData.targetAgeRange}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetAgeRange: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                    >
                      {TARGET_AGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Profil</label>
                    <select
                      value={formData.targetProfile}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetProfile: e.target.value }))}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white"
                    >
                      {TARGET_PROFILE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-dashed border-purple-200 bg-purple-50 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Résumé avatar</div>
                  <div className="text-sm font-medium text-gray-800 mt-1">{targetAvatarSummary || 'Auto selon le produit'}</div>
                </div>
              </div>

              {/* Probleme principal */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Probleme principal (optionnel)
                </label>
                <textarea
                  value={formData.mainProblem}
                  onChange={(e) => setFormData(prev => ({ ...prev, mainProblem: e.target.value }))}
                  placeholder="Ex: Peau terne avec des taches, perte de confiance en soi..."
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
