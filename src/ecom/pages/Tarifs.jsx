import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Package, Gift } from 'lucide-react';
import { createCheckout, getPublicPlans, checkGlobalPromoCode } from '../services/billingApi.js';
import PaymentModalFrame from '../components/PaymentModalFrame.jsx';
import { PAYMENT_COUNTRY_CODES } from '../constants/paymentCountryCodes.js';
import { buildFullPhone } from '../utils/phoneCodes.js';
import { savePendingPlanSelection } from '../utils/pendingPlanFlow.js';

const fmtFCFA = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/,/g, ' ');

// ─── Inline checkout modal (for public Tarifs page, no auth required) ─────────
function PublicCheckoutModal({ plan, onClose }) {
  const navigate = useNavigate();
  const [country, setCountry] = useState('Cameroun');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amount = Number(plan?.numericPrice || 0);
  const durationLabel = plan?.durationLabel || '1 mois';
  const planName = plan?.name || 'Scalor';
  const selectedCountry = PAYMENT_COUNTRY_CODES.find((item) => item.country === country) || PAYMENT_COUNTRY_CODES[0];
  // buildFullPhone préserve le 0 initial des plans qui l'exigent (Gabon : +241 0X…)
  const fullPhone = phoneLocal ? buildFullPhone(selectedCountry.code, phoneLocal) : '';
  const inputClassName = 'w-full rounded-[18px] border border-[#D7E3DA] bg-white px-4 py-3.5 text-[15px] text-slate-800 shadow-[0_10px_30px_rgba(15,107,79,0.04)] outline-none transition placeholder:text-slate-300 focus:border-[#0F6B4F]/35 focus:ring-4 focus:ring-[#0F6B4F]/10';
  const labelClassName = 'mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[#6A776F]';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!phoneLocal.trim() || phoneLocal.trim().length < 8) {
      setError('Entrez un numéro de téléphone valide (min. 8 chiffres).');
      return;
    }
    if (!clientName.trim() || clientName.trim().length < 2) {
      setError('Entrez votre nom complet.');
      return;
    }

    // Check if user is logged in
    const token = localStorage.getItem('ecomToken');
    const workspace = (() => { try { return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); } catch { return null; } })();
    const workspaceId = workspace?._id || workspace?.id;

    if (!token || !workspaceId) {
      savePendingPlanSelection(plan?.checkoutKey);
      navigate('/ecom/register');
      return;
    }

    setLoading(true);
    try {
      const result = await createCheckout({
        plan: plan?.checkoutKey,
        phone: fullPhone,
        clientName: clientName.trim(),
        workspaceId,
        ...(plan?.promoCode ? { promoCode: plan.promoCode } : {}),
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
    <PaymentModalFrame
      onClose={onClose}
      eyebrow="Abonnement"
      title={`${planName} — ${durationLabel}`}
      subtitle="Activez votre plan depuis la page Tarifs avec un parcours plus propre et plus lisible."
      icon={<Package className="h-full w-full" />}
      summary={{
        label: 'Total a payer',
        value: `${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`,
        meta: 'Paiement Mobile Money avec redirection MoneyFusion',
        badge: amount > 0 ? 'Direct' : 'Gratuit',
      }}
      maxWidthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 rounded-[24px] border border-[#E2EAE4] bg-white/90 p-4 shadow-[0_16px_40px_rgba(15,107,79,0.05)] sm:p-5">
          <div>
            <label className={labelClassName}>Nom complet</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Jean Dupont"
              className={inputClassName}
              required
            />
          </div>

          <div>
            <label className={labelClassName}>Numero Mobile Money</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              className={`${inputClassName} mb-3 appearance-none`}
            >
              {PAYMENT_COUNTRY_CODES.map((item, index) => (
                <option key={index} value={item.country}>{item.flag} {item.country} ({item.code})</option>
              ))}
            </select>
            <div className="flex gap-2">
              <div className="flex flex-shrink-0 items-center gap-1.5 rounded-[18px] border border-[#D7E3DA] bg-[#F5FAF7] px-3 py-3 text-sm font-bold text-[#355646]">
                <span>{selectedCountry.flag}</span>
                <span>{selectedCountry.code}</span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={phoneLocal}
                onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ''))}
                placeholder="6 XX XX XX XX"
                className={`flex-1 ${inputClassName}`}
                required
              />
            </div>
            {fullPhone ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {fullPhone}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[#6A776F]">Orange Money, MTN Mobile Money, Wave et autres operateurs compatibles.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-[18px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[18px] bg-primary-600 py-4 text-sm font-black text-white shadow-[0_20px_45px_rgba(15,107,79,0.18)] transition hover:bg-primary-700 disabled:opacity-60"
        >
          {loading ? 'Redirection…' : `Payer ${new Intl.NumberFormat('fr-FR').format(amount)} FCFA`}
        </button>
      </form>
    </PaymentModalFrame>
  );
}

const Tarifs = () => {
  const navigate = useNavigate();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [isAnnual, setIsAnnual] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoData, setPromoData] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  async function handleApplyPromo(e) {
    if (e) e.preventDefault();
    setPromoError('');
    if (!promoInput.trim()) { setPromoError('Entrez un code'); return; }
    setPromoLoading(true);
    try {
      const res = await checkGlobalPromoCode(promoInput.trim());
      if (res.success && res.promo) {
        setPromoData(res.promo);
      } else {
        setPromoError('Code invalide');
        setPromoData(null);
      }
    } catch (err) {
      setPromoError(err?.response?.data?.message || 'Code invalide');
      setPromoData(null);
    } finally {
      setPromoLoading(false);
    }
  }

  function computePlanPrice(plan) {
    if (plan.isFree) return { displayPerMonth: 0, originalPerMonth: null, displayTotal: 0, promoApplied: false };
    const months = isAnnual ? 12 : 1;
    const billingFactor = isAnnual ? 0.75 : 1;
    const totalPrice = Math.round(plan.numericPrice * months * billingFactor / 500) * 500;
    let displayTotal = totalPrice;
    let originalTotal = null;
    let promoApplied = false;
    if (promoData) {
      const { discountType, discountValue, applicablePlans, applicableDurations, minAmount } = promoData;
      const matchesPlan = !applicablePlans?.length || applicablePlans.includes(plan.key);
      const matchesDuration = !applicableDurations?.length || applicableDurations.includes(months);
      const matchesAmount = totalPrice >= (minAmount || 0);
      if (matchesPlan && matchesDuration && matchesAmount) {
        promoApplied = true;
        originalTotal = totalPrice;
        const discountAmount = discountType === 'percentage'
          ? Math.round((totalPrice * discountValue) / 100)
          : Math.min(totalPrice, discountValue);
        displayTotal = Math.max(0, totalPrice - discountAmount);
      }
    }
    const displayPerMonth = isAnnual ? Math.round(displayTotal / 12) : displayTotal;
    const originalPerMonth = originalTotal ? (isAnnual ? Math.round(originalTotal / 12) : originalTotal) : null;
    return { displayPerMonth, originalPerMonth, displayTotal, promoApplied };
  }

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
                className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-primary-600 transition"
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
                className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition shadow-sm"
              >
                Commencer
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-primary-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 mb-6">
            Tarifs <span className="text-primary-600">simples</span> et transparents
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Commencez gratuitement et évoluez selon vos besoins. 
            Aucune carte bancaire requise pour démarrer.
          </p>

          {/* Toggle mensuel / annuel */}
          <div className="mt-8 flex flex-col items-center gap-5">
            <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${!isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Mensuel
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${isAnnual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Annuel
                <span className="text-[10px] font-black bg-primary-500 text-white px-1.5 py-0.5 rounded-full">-25%</span>
              </button>
            </div>

            {/* Promo code */}
            <form onSubmit={handleApplyPromo} className="relative w-full max-w-xs">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Gift className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value.toUpperCase())}
                disabled={promoData !== null}
                placeholder="Code promo ?"
                className="w-full pl-10 pr-24 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-bold placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition uppercase text-gray-700 disabled:opacity-75 disabled:bg-gray-50"
              />
              {!promoData ? (
                <button type="submit" disabled={promoLoading || !promoInput.trim()}
                  className="absolute inset-y-1 right-1 px-4 bg-gray-900 hover:bg-gray-700 text-white rounded-full text-xs font-bold transition disabled:opacity-40">
                  {promoLoading ? '…' : 'Appliquer'}
                </button>
              ) : (
                <button type="button" onClick={() => { setPromoData(null); setPromoInput(''); setPromoError(''); }}
                  className="absolute inset-y-1 right-1 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-xs font-bold transition">
                  Retirer
                </button>
              )}
            </form>
            {promoError && <p className="text-red-500 text-[11px] font-bold">{promoError}</p>}
            {promoData && <p className="text-primary-600 text-[11px] font-bold">✓ Code {promoData.code} appliqué</p>}
          </div>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-10">
        <div className="max-w-screen-2xl mx-auto">
          {plansLoading && (
            <div className="text-center text-gray-500 py-12">Chargement des offres…</div>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200
                  ${plan.highlighted
                    ? 'bg-[#1a1a2e] shadow-2xl ring-2 ring-primary-500/40'
                    : 'bg-white border border-gray-200 hover:border-primary-300 hover:shadow-lg'
                  }`}
              >
                {/* Promo banner */}
                <div className={`text-center py-2.5 text-[11px] font-black tracking-wide
                  ${plan.highlighted
                    ? 'bg-primary-500 text-white'
                    : plan.isFree ? 'bg-gray-100 text-gray-400' : 'bg-primary-50 text-primary-700'
                  }`}>
                  {plan.isFree ? 'Gratuit pour toujours' : plan.highlighted ? '⭐ Le plus populaire' : '1 mois offert sur 12 mois'}
                </div>

                <div className="p-7 flex-1 flex flex-col">
                  {/* Name + tagline */}
                  <div className="mb-1">
                    <h3 className={`text-xl font-black ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h3>
                  </div>
                  <p className={`text-sm mb-6 ${plan.highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-1">
                    <p className={`text-xs font-semibold mb-1 ${plan.highlighted ? 'text-gray-400' : 'text-gray-400'}`}>
                      À partir de
                    </p>
                    {(() => {
                      const { displayPerMonth, originalPerMonth, displayTotal, promoApplied } = computePlanPrice(plan);
                      return (
                        <>
                          <div className="flex items-end gap-2">
                            {originalPerMonth && (
                              <span className={`text-xl font-bold line-through mb-0.5 ${plan.highlighted ? 'text-primary-300' : 'text-gray-300'}`}>
                                {fmtFCFA(originalPerMonth)}
                              </span>
                            )}
                            <span className={`text-5xl font-black leading-none ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                              {plan.isFree ? '0' : fmtFCFA(displayPerMonth)}
                            </span>
                            <span className={`text-sm font-semibold mb-1 ${plan.highlighted ? 'text-gray-400' : 'text-gray-400'}`}>
                              {plan.isFree ? 'FCFA' : 'FCFA/mois'}
                            </span>
                          </div>
                          {promoApplied && (
                            <p className={`text-xs font-bold mt-1.5 ${plan.highlighted ? 'text-white' : 'text-primary-600'}`}>
                              ✨ Code {promoData.code} appliqué
                            </p>
                          )}
                          {isAnnual && !plan.isFree && !promoApplied && (
                            <p className={`text-xs font-semibold mt-1.5 ${plan.highlighted ? 'text-primary-200' : 'text-primary-600'}`}>
                              {fmtFCFA(displayTotal)} FCFA facturé annuellement
                            </p>
                          )}
                          <p className={`text-xs mt-1.5 ${plan.highlighted ? 'text-gray-500' : 'text-gray-400'}`}>
                            {plan.isFree ? 'Sans carte bancaire' : isAnnual ? 'Facturation annuelle' : 'Facturation mensuelle'}
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Divider */}
                  <div className={`h-px my-5 ${plan.highlighted ? 'bg-white/10' : 'bg-gray-100'}`} />

                  {/* Features */}
                  <div className="mb-1">
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-3 ${plan.highlighted ? 'text-gray-400' : 'text-gray-400'}`}>
                      Fonctionnalités clés
                    </p>
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-primary-400' : 'text-primary-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className={`text-[13px] leading-snug ${plan.highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA */}
                <div className="px-7 pb-7">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('ecomToken');
                      const workspace = (() => { try { return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); } catch { return null; } })();
                      const workspaceId = workspace?._id || workspace?.id;
                      const durationMonths = isAnnual ? 12 : 1;
                      const checkoutKey = plan.isFree ? null : `${plan.key}_${durationMonths}`;
                      const { displayTotal } = computePlanPrice(plan);
                      if (plan.isFree) {
                        navigate('/ecom/register');
                      } else if (!token || !workspaceId) {
                        savePendingPlanSelection(checkoutKey);
                        navigate('/ecom/register');
                      } else {
                        setSelectedPlan({
                          ...plan,
                          checkoutKey,
                          numericPrice: displayTotal,
                          durationLabel: isAnnual ? '12 mois (annuel)' : '1 mois',
                          promoCode: promoData?.code || null,
                        });
                        setShowCheckout(true);
                      }
                    }}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]
                      ${plan.highlighted
                        ? 'bg-primary-500 text-white hover:bg-primary-400'
                        : plan.isFree
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                  >
                    {plan.isFree ? 'Commencer gratuitement' : plan.cta}
                  </button>
                </div>
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
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-br from-primary-600 to-primary-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-6">
            Prêt à commencer ?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Créez votre compte gratuitement en 30 secondes. 
            Aucune carte bancaire requise.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/ecom/register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-primary-700 hover:bg-primary-50 rounded-xl font-bold text-lg transition shadow-xl"
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
