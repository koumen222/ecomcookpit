import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Plus, Bot, X } from 'lucide-react';

// ─── Predefined lists ────────────────────────────────────────────────────────

const COUNTRIES = [
  'Cameroun', 'Sénégal', 'Côte d\'Ivoire', 'Mali', 'Burkina Faso',
  'Bénin', 'Togo', 'Niger', 'Guinea', 'Nigeria', 'Ghana', 'Liberia',
  'France', 'Belgique', 'Suisse', 'Canada', 'États-Unis', 'Autres',
];

const NICHES = [
  'Mode & Vêtements', 'Électronique & Informatique', 'Alimentation & Restauration',
  'Beauté & Cosmétiques', 'Santé & Bien-être', 'Maison & Décoration',
  'Automobile & Accessoires', 'Sports & Loisirs', 'Éducation',
  'Services professionnels', 'Immobilier', 'Autres',
];

const PRODUCT_TYPES = [
  'Produits physiques', 'Services', 'Abonnements', 'Formations',
  'Biens numériques', 'Mix (produits + services)', 'Autres',
];

const TONES = [
  'Enthousiaste', 'Patient', 'Assertif', 'Humoristique', 'Neutre',
  'Bienveillant', 'Confiant', 'Analytique', 'Créatif', 'Pragmatique',
];

const TOTAL_STEPS = 3; // Simplifié: Étape 1: Nom, Étape 2: Pays/Business/Catégorie, Étape 3: Ton

// ─── helpers ─────────────────────────────────────────────────────────────────

function generateWelcomeMessage(name, niche, personality) {
  const nicheGreetings = {
    'Mode & Vêtements': 'Bienvenue dans mon univers fashion !',
    'Électronique & Informatique': 'Bienvenue chez ton expert tech !',
    'Alimentation & Restauration': 'Bienvenue à ta table !',
    'Beauté & Cosmétiques': 'Bienvenue dans mon salon beauté !',
    'Santé & Bien-être': 'Bienvenue chez ton conseiller bien-être !',
    'Maison & Décoration': 'Bienvenue chez toi !',
    'Automobile & Accessoires': 'Bienvenue dans mon garage !',
    'Sports & Loisirs': 'Bienvenue chez ton coach sportif !',
    'Éducation': 'Bienvenue dans mon école !',
    'Services professionnels': 'Bienvenue chez moi !',
    'Immobilier': 'Bienvenue chez ton agent immobilier !',
  };
  const personalityMessages = {
    'Experte en son domaine': 'Je suis là pour te conseiller avec expertise.',
    'Conseillère amicale': 'Je suis là comme une amie qui t\'aide.',
    'Spécialiste technique': 'Je suis prête à répondre à toutes tes questions.',
    'Coach motivant': 'Ensemble, on va atteindre tes objectifs !',
    'Assistant discret': 'Je suis là quand tu en as besoin.',
    'Reine du shopping': 'Prépare-toi pour l\'expérience shopping ultime !',
    'Expert en tendances': 'Je suis au courant des dernières tendances !',
    'Mécanicienne passionnée': 'Je suis passionnée par ce que je fais.',
    'Professeure patiente': 'On apprend ensemble à ton rythme.',
    'Entrepreneur visionnaire': 'Ensemble, créons quelque chose d\'extraordinaire.',
  };
  const greeting = nicheGreetings[niche] || `Bonjour 👋 Bienvenue chez ${name} !`;
  const personalityLine = personalityMessages[personality] || 'Comment puis-je t\'aider ?';
  return `${greeting}\n${personalityLine}`;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  country: '',
  niche: '',
  productType: '',
  communicationStyle: 'friendly',
  tone: '',
  bossNotifications: false,
  notifyOnOrder: true,
};

// ─── component ───────────────────────────────────────────────────────────────

export default function AgentOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const existingAgent = location.state?.agent;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    name: existingAgent?.name || '',
    description: existingAgent?.description || '',
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setError(null);
  };

  const validateStep = () => {
    setError(null);
    if (step === 1 && !formData.name.trim()) {
      setError('Le nom de l\'agent est requis');
      return false;
    }
    if (step === 2) {
      if (!formData.country) { setError('Le pays est requis'); return false; }
      if (!formData.description.trim()) { setError('Le nom du business est requis'); return false; }
      if (!formData.niche) { setError('La catégorie est requise'); return false; }
    }
    if (step === 3) {
      if (!formData.tone) { setError('Le ton est requis'); return false; }
    }
    return true;
  };

  const handleNext = () => { if (validateStep()) setStep(s => s + 1); };
  const handlePrev = () => { if (step > 1) setStep(s => s - 1); };

  const handleFinish = async () => {
    if (!validateStep()) return;
    try {
      setLoading(true);
      setError(null);

      const payload = {
        name: formData.name,
        description: formData.description,
        country: formData.country,
        niche: formData.niche,
        productType: formData.productType,
        communicationStyle: formData.communicationStyle,
        tone: formData.tone,
        bossNotifications: formData.bossNotifications,
        notifyOnOrder: formData.notifyOnOrder,
        onboardingCompleted: true,
      };

      if (!existingAgent) {
        const res = await ecomApi.post('/agents', payload);
        // Rediriger vers AgentConfig avec l'agent créé
        const createdAgent = res.data.agent;
        navigate('/ecom/whatsapp/agent-config', { state: { agent: createdAgent } });
      } else {
        await ecomApi.put(`/agents/${existingAgent._id}`, { name: formData.name, description: formData.description });
        await ecomApi.put('/rita/config', {
          country: formData.country,
          niche: formData.niche,
          productType: formData.productType,
          communicationStyle: formData.communicationStyle,
          tone: formData.tone,
          bossNotifications: formData.bossNotifications,
          notifyOnOrder: formData.notifyOnOrder,
          onboardingCompleted: true,
        });
        navigate('/ecom/whatsapp/agent-config', { state: { agent: existingAgent } });
      }
    } catch (err) {
      console.error('Erreur:', err);

      // Gestion explicite des erreurs de plan
      const errData = err.response?.data;
      let errorMsg = 'Une erreur est survenue. Réessayez.';

      if (errData?.error === 'upgrade_required') {
        errorMsg = `❌ ${errData.message || 'Votre plan n\'autorise pas la création d\'agent. Passez à Pro pour créer jusqu\'à 1 agent, ou Ultra pour en créer 5.'}`;
      } else if (errData?.error === 'limit_reached') {
        errorMsg = `❌ ${errData.message || 'Limite atteinte ! Passez à un plan supérieur pour créer plus d\'agents.'}`;
      } else if (errData?.message) {
        errorMsg = `❌ ${errData.message}`;
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Agent IA créé !</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Votre agent a été configuré avec succès. Connectez WhatsApp et ajoutez vos produits pour commencer à vendre.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFormData(EMPTY_FORM);
                setStep(1);
                setSuccess(false);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Créer un autre
            </button>
            <button
              onClick={() => navigate('/ecom/agent-ia')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
            >
              <Bot className="w-5 h-5" />
              Voir mes agents
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stepMeta = [
    { label: 'Identité' },
    { label: 'Business' },
    { label: 'Communication' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/ecom/agent-ia')}
            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            {existingAgent ? 'Modifier l\'agent IA' : 'Créer un agent IA'}
          </h1>
          <p className="text-gray-500 text-sm">
            Étape {step} sur {TOTAL_STEPS} — {stepMeta[step - 1].label}
          </p>
        </div>

        {/* Progress bar — 5 segments for 5 steps */}
        <div className="flex gap-1.5 mb-8">
          {stepMeta.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                i < step ? 'bg-emerald-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* ERROR BANNER - MORE VISIBLE */}
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 mb-6 flex items-start gap-4 text-red-900">
            <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-bold text-red-900 mb-2">Erreur</p>
              <p className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Identité de l'agent</h2>
                <p className="text-sm text-gray-500">Donnez un nom à votre agent IA (ex: Rita, Maya...)</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom de l'agent <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Rita, Maya, Sophie..."
                  autoFocus
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brève description du rôle de cet agent..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Business info ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Infos business</h2>
                <p className="text-sm text-gray-500">Dites-nous plus sur votre activité</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pays <span className="text-red-400">*</span>
                </label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                >
                  <option value="">Sélectionner un pays</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom du business <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Ex: Mon magasin de mode, Ma boutique..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Catégorie <span className="text-red-400">*</span>
                </label>
                <select
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* ── Step 3: Tone ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Ton de voix</h2>
                <p className="text-sm text-gray-500">Sélectionnez le ton avec lequel votre agent communiquera</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ton de voix <span className="text-red-400">*</span>
                </label>
                <select
                  name="tone"
                  value={formData.tone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
                >
                  <option value="">Sélectionner un ton</option>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            disabled={step === 1 || loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Précédent
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {existingAgent ? 'Mettre à jour' : 'Créer l\'agent'}
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
