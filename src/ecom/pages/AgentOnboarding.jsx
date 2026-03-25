import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Plus } from 'lucide-react';

// Listes prédéfinies
const COUNTRIES = [
  'Cameroun', 'Sénégal', 'Côte d\'Ivoire', 'Mali', 'Burkina Faso',
  'Bénin', 'Togo', 'Niger', 'Guinea', 'Nigeria', 'Ghana', 'Liberia',
  'France', 'Belgique', 'Suisse', 'Canada', 'États-Unis', 'Autres'
];

const NICHES = [
  'Mode & Vêtements', 'Électronique & Informatique', 'Alimentation & Restauration',
  'Beauté & Cosmétiques', 'Santé & Bien-être', 'Maison & Décoration',
  'Automobile & Accessoires', 'Sports & Loisirs', 'Éducation',
  'Services professionnels', 'Immobilier', 'Autres'
];

const PRODUCT_TYPES = [
  'Produits physiques', 'Services', 'Abonnements', 'Formations',
  'Biens numériques', 'Mix (produits + services)', 'Autres'
];

const COMMUNICATION_STYLES = [
  { value: 'professional', label: 'Professionnel', desc: 'Sérieux et efficace' },
  { value: 'friendly', label: 'Amical', desc: 'Chaleureux et accessible' },
  { value: 'casual', label: 'Décontracté', desc: 'Amusant et moderne' },
  { value: 'formal', label: 'Formel', desc: 'Respectueux et académique' },
];

const TONES = [
  'Enthousiaste', 'Patient', 'Assertif', 'Humoristique', 'Neutre',
  'Bienveillant', 'Confiant', 'Analytique', 'Créatif', 'Pragmatique'
];

const PERSONALITIES = [
  'Experte en son domaine', 'Conseillère amicale', 'Spécialiste technique',
  'Coach motivant', 'Assistant discret', 'Reine du shopping', 'Expert en tendances',
  'Mécanicienne passionnée', 'Professeure patiente', 'Entrepreneur visionnaire'
];

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const agent = location.state?.agent;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
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
      if (!formData.country) {
        setError('Le pays est requis');
        return false;
      }
      if (!formData.niche) {
        setError('La niche est requise');
        return false;
      }
      if (!formData.productType) {
        setError('Le type de produit est requis');
        return false;
      }
    }

    if (step === 3) {
      if (!formData.tone) {
        setError('Le ton est requis');
        return false;
      }
      if (!formData.personality) {
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
        await ecomApi.post('/agents', {
          ...updateData,
          ...configData,
        });

        setSuccess(true);
        setFormData({
          name: '',
          description: '',
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
        setStep(1);

        // Après 2 secondes, retourner à la liste
        setTimeout(() => {
          navigate('/ecom/agent-ia', {
            state: { success: 'Agent créé avec succès !' },
          });
        }, 2000);
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
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnother = () => {
    setFormData({
      name: '',
      description: '',
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
    setStep(1);
    setSuccess(false);
    setError(null);
  };

  // Écran de succès
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Agent créé !</h2>
          <p className="text-gray-600 mb-8">
            Ton agent a été configuré avec succès. Tu vas être redirigé vers la liste des agents...
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCreateAnother}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Créer un autre
            </button>
            <button
              onClick={() => navigate('/ecom/agent-ia')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Voir mes agents
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sélectionne un pays</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Niche / Secteur d'activité *
                </label>
                <select
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sélectionne une niche</option>
                  {NICHES.map((niche) => (
                    <option key={niche} value={niche}>
                      {niche}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Type de produits *
                </label>
                <select
                  name="productType"
                  value={formData.productType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sélectionne un type</option>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
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
                  {COMMUNICATION_STYLES.map((style) => (
                    <label
                      key={style.value}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.communicationStyle === style.value
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="communicationStyle"
                        value={style.value}
                        checked={formData.communicationStyle === style.value}
                        onChange={handleInputChange}
                        className="hidden"
                      />
                      <span className="font-semibold text-gray-900">{style.label}</span>
                      <p className="text-xs text-gray-600 mt-1">{style.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ton de voix *
                </label>
                <select
                  name="tone"
                  value={formData.tone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sélectionne un ton</option>
                  {TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Personnalité *
                </label>
                <select
                  name="personality"
                  value={formData.personality}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sélectionne une personnalité</option>
                  {PERSONALITIES.map((personality) => (
                    <option key={personality} value={personality}>
                      {personality}
                    </option>
                  ))}
                </select>
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
