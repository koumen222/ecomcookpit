import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const agent = location.state?.agent;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    country: '',
    niche: '',
    productType: '',
    communicationStyle: 'friendly',
    tone: '',
    personality: '',
    bossPhone: '',
    bossNotifications: false,
    notifyOnOrder: true,
  });

  const totalSteps = 4;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    setError(null);
  };

  const validateStep = () => {
    setError(null);

    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Le nom de l\'agent est requis');
        return false;
      }
    }

    if (step === 2) {
      if (!formData.country.trim()) {
        setError('Le pays est requis');
        return false;
      }
      if (!formData.niche.trim()) {
        setError('La niche est requise');
        return false;
      }
      if (!formData.productType.trim()) {
        setError('Le type de produit est requis');
        return false;
      }
    }

    if (step === 3) {
      if (!formData.tone.trim()) {
        setError('Le ton est requis');
        return false;
      }
      if (!formData.personality.trim()) {
        setError('La personnalité est requise');
        return false;
      }
    }

    if (step === 4) {
      if (!formData.bossPhone.trim()) {
        setError('Le numéro du boss est requis');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (!validateStep()) return;

    try {
      setLoading(true);
      setError(null);

      const updateData = {
        name: formData.name,
        description: formData.description,
      };

      const configData = {
        country: formData.country,
        niche: formData.niche,
        productType: formData.productType,
        communicationStyle: formData.communicationStyle,
        tone: formData.tone,
        personality: formData.personality,
        bossPhone: formData.bossPhone,
        bossNotifications: formData.bossNotifications,
        notifyOnOrder: formData.notifyOnOrder,
        onboardingCompleted: true,
      };

      // Si c'est un nouvel agent, créer avec les données
      if (!agent) {
        const res = await ecomApi.post('/agents', {
          ...updateData,
          ...configData,
        });

        if (res.data.success) {
          navigate('/ecom/agent-ia', {
            state: { success: 'Agent créé avec succès !' },
          });
        }
      } else {
        // Si c'est un agent existant, mettre à jour
        await ecomApi.put(`/agents/${agent._id}`, updateData);
        await ecomApi.put(`/rita/config`, configData);

        navigate('/ecom/agent-ia', {
          state: { success: 'Agent configuré avec succès !' },
        });
      }
    } catch (err) {
      console.error('Erreur:', err);
      setError(err.response?.data?.error || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/ecom/agent-ia')}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuration d'agent IA</h1>
          <p className="text-gray-600">
            Étape {step} sur {totalSteps}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  s <= step ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3 text-red-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Informations basiques</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom de l'agent *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Rita, Maya, Assistant..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brève description du rôle de cet agent..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Business Profile */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Profil business</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pays *
                </label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  placeholder="Ex: Cameroun, Sénégal, France..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Niche / Secteur d'activité *
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  placeholder="Ex: Mode, Électronique, Alimentation..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type de produits *
                </label>
                <input
                  type="text"
                  name="productType"
                  value={formData.productType}
                  onChange={handleInputChange}
                  placeholder="Ex: Vêtements, Téléphones, Produits cosmétiques..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Communication Style */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Style de communication</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Style de communication *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['professional', 'friendly', 'casual', 'formal'].map((style) => (
                    <label
                      key={style}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.communicationStyle === style
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="communicationStyle"
                        value={style}
                        checked={formData.communicationStyle === style}
                        onChange={handleInputChange}
                        className="hidden"
                      />
                      <span className="font-semibold text-gray-900 capitalize">{style}</span>
                      <p className="text-xs text-gray-600 mt-1">
                        {style === 'professional' && 'Sérieux et efficace'}
                        {style === 'friendly' && 'Chaleureux et accessible'}
                        {style === 'casual' && 'Décontracté et amusant'}
                        {style === 'formal' && 'Respectueux et académique'}
                      </p>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ton de voix *
                </label>
                <textarea
                  name="tone"
                  value={formData.tone}
                  onChange={handleInputChange}
                  placeholder="Ex: Enthousiaste, patient, assertif..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Personnalité *
                </label>
                <textarea
                  name="personality"
                  value={formData.personality}
                  onChange={handleInputChange}
                  placeholder="Ex: Experte en mode, conseillère amicale, spécialiste tech..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Step 4: Contact & Notifications */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact et notifications</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Numéro de téléphone du boss *
                </label>
                <input
                  type="tel"
                  name="bossPhone"
                  value={formData.bossPhone}
                  onChange={handleInputChange}
                  placeholder="Ex: +237 6 XX XX XX XX"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    name="bossNotifications"
                    checked={formData.bossNotifications}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-emerald-600 rounded"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Notifications au boss</span>
                    <p className="text-sm text-gray-600">Envoyer des alertes WhatsApp au numéro du boss</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    name="notifyOnOrder"
                    checked={formData.notifyOnOrder}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-emerald-600 rounded"
                  />
                  <div>
                    <span className="font-semibold text-gray-900">Notifications de commandes</span>
                    <p className="text-sm text-gray-600">Être notifié des nouvelles commandes</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-4">
          <button
            onClick={handlePrev}
            disabled={step === 1 || loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Précédent
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '⏳ Création...' : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Terminer
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
