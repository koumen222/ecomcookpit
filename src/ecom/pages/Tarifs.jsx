import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckout, getPublicPlans } from '../services/billingApi.js';

const fmtFCFA = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/,/g, ' ');

// ─── Inline checkout modal (for public Tarifs page, no auth required) ─────────
function PublicCheckoutModal({ plan, onClose }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amount = Number(plan?.numericPrice || 0);
  const durationLabel = plan?.durationLabel || '1 mois';
  const planName = plan?.name || 'Scalor';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!phone.trim() || phone.trim().length < 8) {
      setError('Entrez un numéro de téléphone valide (min. 8 chiffres).');
      return;
    }
    if (!clientName.trim() || clientName.trim().length < 2) {
      setError('Entrez votre nom complet.');
      return;
    }

    // Check if user is logged in
    const token = localStorage.getItem('ecomToken');
    const workspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
    const workspaceId = workspace?._id || workspace?.id;

    if (!token || !workspaceId) {
      // Redirect to register then billing
      sessionStorage.setItem('mf_post_register_redirect', '/ecom/billing');
      navigate('/ecom/register');
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckout({
        plan: plan?.checkoutKey,
        phone: phone.trim(),
        clientName: clientName.trim(),
        workspaceId
      });
      if (!result.success) {
        setError(result.message || 'Erreur lors de l\'initialisation du paiement.');
        return;
      }
      if (result.paymentUrl) {
        sessionStorage.setItem('mf_pending_token', result.mfToken);
        window.location.href = result.paymentUrl;
      } else {
        setError('URL de paiement manquante. Veuillez réessayer.');
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || 'Une erreur est survenue. Veuillez réessayer.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Passer au plan {planName}</h2>
              <p className="text-emerald-100 text-sm mt-0.5">
                {durationLabel} — {new Intl.NumberFormat('fr-FR').format(amount)} FCFA
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Jean Dupont"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro Mobile Money</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Orange Money, MTN, Wave…</p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition shadow-lg text-sm"
          >
            {loading ? 'Redirection…' : `Payer ${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`}
          </button>
          <p className="text-center text-xs text-gray-400">
            Paiement sécurisé via MoneyFusion — activé instantanément après confirmation.
          </p>
        </form>
      </div>
    </div>
  );
}

const Tarifs = () => {
  const navigate = useNavigate();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    getPublicPlans()
      .then(res => {
        const mapped = (res.plans || []).map(p => ({
          key: p.key,
          name: p.displayName,
          description: p.tagline,
          price: fmtFCFA(p.priceRegular),
          numericPrice: Number(p.priceRegular || 0),
          period: p.priceRegular === 0 ? 'FCFA' : 'FCFA/mois',
          durationLabel: '1 mois',
          features: p.featuresList || [],
          cta: p.ctaLabel || 'Commencer',
          highlighted: !!p.highlighted,
          isFree: Number(p.priceRegular || 0) === 0,
          checkoutKey: `${p.key}_1`
        }));
        setPlans(mapped);
      })
      .catch(err => console.error('Failed to load public plans', err))
      .finally(() => setPlansLoading(false));
  }, []);

  return (
    <>
    <div className="min-h-screen bg-white">
      {/* NAVBAR */}
      <nav className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => navigate('/ecom')} className="flex items-center gap-2">
              <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            </button>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => navigate('/ecom/why-scalor')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Pourquoi choisir Scalor ?
              </button>
              <button 
                onClick={() => navigate('/ecom')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Fonctionnalités
              </button>
              <button 
                onClick={() => navigate('/ecom/tarifs')}
                className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-emerald-600 transition"
              >
                Tarifs
              </button>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/ecom/login')}
                className="hidden sm:block px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Connexion
              </button>
              <button 
                onClick={() => navigate('/ecom/register')}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-sm"
              >
                Commencer
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-emerald-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-6">
            Tarifs <span className="text-emerald-600">simples</span> et transparents
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Commencez gratuitement et évoluez selon vos besoins. 
            Aucune carte bancaire requise pour démarrer.
          </p>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="py-16 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          {plansLoading && (
            <div className="text-center text-gray-500 py-12">Chargement des offres…</div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlighted 
                    ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-2xl scale-105 border-2 border-emerald-500' 
                    : 'bg-white border-2 border-gray-200 hover:border-emerald-200 hover:shadow-xl'
                } transition-all duration-300 relative`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-gray-900 rounded-full text-xs font-bold">
                    RECOMMANDÉ
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm ${plan.highlighted ? 'text-emerald-100' : 'text-gray-600'}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-5xl font-black ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={`text-lg ${plan.highlighted ? 'text-emerald-100' : 'text-gray-600'}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <svg 
                        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-emerald-200' : 'text-emerald-600'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={`text-sm ${plan.highlighted ? 'text-white' : 'text-gray-700'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                  
                </ul>

                <button
                  onClick={() => {
                    if (plan.isFree) {
                      navigate('/ecom/register');
                    } else {
                      setSelectedPlan(plan);
                      setShowCheckout(true);
                    }
                  }}
                  className={`w-full py-4 rounded-xl font-bold text-base transition shadow-lg ${
                    plan.highlighted 
                      ? 'bg-white text-emerald-700 hover:bg-emerald-50' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-16 sm:py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-12 text-center">
            Questions fréquentes
          </h2>
          
          <div className="space-y-6">
            {[
              {
                q: 'Puis-je changer de plan à tout moment ?',
                a: 'Oui, vous pouvez passer au plan Pro ou revenir au plan gratuit à tout moment. Les changements sont effectifs immédiatement.'
              },
              {
                q: 'Y a-t-il des frais cachés ?',
                a: 'Non, nos tarifs sont transparents. Le prix affiché est le prix que vous payez, sans frais supplémentaires.'
              },
              {
                q: 'Que se passe-t-il si je dépasse les limites du plan gratuit ?',
                a: 'Nous vous préviendrons avant d\'atteindre les limites. Vous pourrez alors passer au plan Pro pour continuer sans interruption.'
              },
              {
                q: 'Proposez-vous des réductions pour les paiements annuels ?',
                a: 'Oui, contactez-nous pour obtenir une réduction sur un engagement annuel.'
              },
              {
                q: 'Comment puis-je annuler mon abonnement ?',
                a: 'Vous pouvez annuler à tout moment depuis les paramètres de votre compte. Aucune pénalité, aucune question posée.'
              }
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-br from-emerald-600 to-emerald-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Créez votre compte gratuitement en 30 secondes. 
            Aucune carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold text-lg transition shadow-xl"
            >
              Créer mon espace gratuit
            </button>
            <button 
              onClick={() => navigate('/ecom/login')}
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white border-2 border-white/30 rounded-xl font-semibold text-lg transition backdrop-blur-sm"
            >
              Se connecter
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 py-12 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/ecom/privacy')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Confidentialité
              </button>
              <button onClick={() => navigate('/ecom/terms')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Conditions
              </button>
              <button onClick={() => navigate('/ecom')} className="text-sm text-gray-600 hover:text-gray-900 transition">
                Accueil
              </button>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 text-center">
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} Scalor. Plateforme e-commerce pour l'Afrique.
            </p>
          </div>
        </div>
      </footer>
    </div>

    {/* Checkout Modal */}
    {showCheckout && (
      <PublicCheckoutModal
        plan={selectedPlan}
        onClose={() => setShowCheckout(false)}
      />
    )}
    </>
  );
};

export default Tarifs;
