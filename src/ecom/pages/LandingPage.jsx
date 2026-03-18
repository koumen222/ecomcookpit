import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══ Scroll reveal hook ═══ */
const useReveal = (threshold = 0.12) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
};

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
    }}>{children}</div>
  );
};

/* ═══════════════════════════════════════════════════════
   LANDING PAGE — Light unique design
═══════════════════════════════════════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const features = [
    { icon: '📊', title: 'Dashboard centralisé', desc: 'Toutes vos métriques en temps réel — revenus, commandes, panier moyen, conversion.' },
    { icon: '📦', title: 'Multi-boutiques', desc: 'Connectez Shopify, WooCommerce et plus. Sync automatique des commandes et stocks.' },
    { icon: '💬', title: 'Ventes en direct', desc: 'Intégrez vos lives WhatsApp. Commandes en direct, validation en un clic.' },
    { icon: '🤖', title: 'Agent IA vendeur', desc: 'L\'IA analyse vos perfs et suggère des actions pour booster vos ventes.' },
    { icon: '📈', title: 'Analyses & rapports', desc: 'Rapports détaillés, produits stars, comportement client. Export PDF instantané.' },
    { icon: '🔔', title: 'Notifications push', desc: 'Alertes pour chaque commande et événement. Ne ratez jamais une vente.' },
    { icon: '👥', title: 'Équipe & rôles', desc: 'Invitez admin, vendeur, comptable. Chat interne inclus.' },
    { icon: '🔐', title: 'Sécurité avancée', desc: 'OAuth, chiffrement, conformité RGPD. Protection maximale.' },
  ];

  const steps = [
    { num: '01', title: 'Créez votre compte', desc: 'Inscription gratuite en 30 secondes. Aucune carte requise.' },
    { num: '02', title: 'Connectez vos boutiques', desc: 'Liez Shopify, WooCommerce ou d\'autres plateformes en quelques clics.' },
    { num: '03', title: 'Pilotez & vendez', desc: 'Gérez tout depuis un seul dashboard. L\'IA vous guide.' },
  ];

  return (
    <div className="min-h-screen text-gray-900 overflow-x-hidden" style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #ffffff 30%, #ecfdf5 60%, #ffffff 100%)' }}>

      {/* Subtle dot pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* ══════ NAVBAR ══════ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]' : 'bg-white/70 backdrop-blur-xl'}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <img src="/logo.png" alt="Scalor" className="h-9 object-contain" />
          </button>
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Fonctionnalités', href: '#features' },
              { label: 'Comment ça marche', href: '#how-it-works' },
            ].map((l, i) => (
              <a key={i} href={l.href} className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all">{l.label}</a>
            ))}
            <button onClick={() => navigate('/ecom/why-scalor')} className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all">Pourquoi Scalor ?</button>
            <button onClick={() => navigate('/ecom/tarifs')} className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all">Tarifs</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ecom/login')} className="hidden md:block px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Connexion</button>
            <button onClick={() => navigate('/ecom/register')} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm hover:shadow-md hover:shadow-emerald-600/15 active:scale-[0.98]">
              Commencer
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-gray-500 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenu
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </nav>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1 shadow-lg animate-[slideDown_0.2s_ease]">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">Fonctionnalités</a>
            <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="block px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">Comment ça marche</a>
            <button onClick={() => { navigate('/ecom/why-scalor'); setMobileMenu(false); }} className="block w-full text-left px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">Pourquoi Scalor ?</button>
            <button onClick={() => { navigate('/ecom/tarifs'); setMobileMenu(false); }} className="block w-full text-left px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">Tarifs</button>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <button onClick={() => navigate('/ecom/login')} className="block w-full text-center py-3 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition">Connexion</button>
              <button onClick={() => navigate('/ecom/register')} className="block w-full text-center py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl">Commencer</button>
            </div>
          </div>
        )}
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative pt-[68px]">
        {/* Soft glow behind hero */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-300/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-28 pb-20 sm:pb-28 text-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur border border-emerald-200 rounded-full text-[13px] font-semibold text-emerald-700 mb-7 shadow-sm">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Plateforme #1 pour le e-commerce COD en Afrique
                </div>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.08] tracking-tight mb-6 text-gray-900">
                  Gérez tout votre e-commerce<br className="hidden sm:block" /> depuis <span className="text-emerald-600">un seul endroit.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="text-lg text-gray-500 leading-relaxed mb-9 max-w-xl mx-auto">
                  Centralisez vos boutiques, automatisez vos flux, et prenez des décisions data-driven. Scalor est l'OS qui fait passer votre business au niveau supérieur.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="flex flex-col sm:flex-row gap-3 mb-10 justify-center">
                  <button onClick={() => navigate('/ecom/register')}
                    className="px-7 py-3.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2">
                    Créer mon espace gratuitement
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  </button>
                  <button onClick={() => { const el = document.querySelector('[data-tutorial-section]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                    className="px-7 py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-semibold text-[15px] text-gray-700 transition-all flex items-center justify-center gap-2">
                    Voir le tuto
                  </button>
                </div>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex items-center gap-6 text-sm text-gray-400 justify-center">
                  {['Gratuit pour commencer', 'Aucune carte requise', 'Prêt en 30 sec'].map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
        </div>
      </section>

      {/* ══════ INTEGRATIONS BAND ══════ */}
      <div className="relative z-10 py-14">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-[3px] mb-8">Ils nous font confiance</p>
          <div className="flex justify-center items-center gap-6 sm:gap-10 flex-wrap">
            {[
              { icon: '🛍️', name: 'Shopify' },
              { icon: '🌐', name: 'WooCommerce' },
              { icon: '💬', name: 'WhatsApp' },
              { icon: '📧', name: 'SMTP' },
              { icon: '📊', name: 'Google Sheets' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-2.5 px-5 py-2.5 bg-white/70 backdrop-blur border border-gray-200/60 rounded-full text-gray-500 text-sm font-semibold shadow-sm">
                <span className="text-base">{l.icon}</span> {l.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="py-24 sm:py-32 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-600 uppercase tracking-[2px] mb-4">Fonctionnalités</span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.7rem] font-extrabold tracking-tight text-gray-900 mb-4">
                Tout ce dont vous avez besoin.
              </h2>
              <p className="text-gray-500 text-lg max-w-xl mx-auto">Une suite d'outils pensée pour les vendeurs e-commerce africains.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="group bg-white/80 backdrop-blur border border-gray-200/50 rounded-2xl p-6 h-full transition-all duration-300 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40 hover:-translate-y-1">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                  <h3 className="text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-24 sm:py-32 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-600 uppercase tracking-[2px] mb-4">Comment ça marche</span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.7rem] font-extrabold tracking-tight text-gray-900 mb-4">Opérationnel en 3 minutes.</h2>
              <p className="text-gray-500 text-lg max-w-md mx-auto">Pas de configuration complexe. Connectez, centralisez, vendez.</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="relative bg-white/80 backdrop-blur rounded-2xl p-8 border border-gray-200/50 text-center group hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40 transition-all duration-300">
                  {/* Step number accent */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-md">{s.num}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 mt-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TUTORIEL YOUTUBE ══════ */}
      <section data-tutorial-section className="py-24 sm:py-32 relative z-10">
        {/* Soft accent glow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red-200/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-block px-3.5 py-1 bg-red-50 border border-red-100 rounded-full text-[11px] font-bold text-red-500 uppercase tracking-[2px] mb-4">Tutoriel</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
                Maîtrisez Scalor en{' '}
                <span className="text-red-500">15 minutes</span>
              </h2>
              <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                Suivez notre tutoriel complet pour découvrir comment exploiter toute la puissance de Scalor.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-2xl overflow-hidden border border-gray-200/60 shadow-2xl shadow-gray-300/30 mb-10 bg-white">
              <div className="relative aspect-video bg-gray-50">
                <iframe
                  src="https://www.youtube.com/embed/405eKEysE0Q?rel=0&modestbranding=1&playsinline=1"
                  title="Tutoriel Complet Scalor"
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="text-center">
              <p className="text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
                De la création de votre premier produit à l'envoi de campagnes WhatsApp, ce tutoriel vous guide pas à pas.
              </p>
              <a href="https://youtu.be/405eKEysE0Q" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition shadow-md shadow-red-600/15">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                Ouvrir sur YouTube
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-20 sm:py-28 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl px-8 sm:px-16 py-16 sm:py-20 text-center relative overflow-hidden">
              {/* Subtle pattern */}
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <h2 className="relative text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-5">
                Prêt à scaler votre business ?
              </h2>
              <p className="relative text-lg text-white/80 max-w-lg mx-auto mb-10 leading-relaxed">
                Rejoignez des centaines de vendeurs qui utilisent Scalor pour structurer et développer leur e-commerce.
              </p>
              <button onClick={() => navigate('/ecom/register')} className="relative inline-flex items-center gap-2.5 px-8 py-4 bg-white text-emerald-700 rounded-xl font-bold text-base hover:bg-gray-50 transition-colors shadow-lg">
                Créer un compte gratuit
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-gray-200/50 bg-white/60 backdrop-blur pt-16 pb-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
              </button>
              <p className="text-sm text-gray-400 leading-relaxed max-w-[260px]">L'Operating System pour le e-commerce africain. Growth. Structure. Intelligence.</p>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-400 mb-5">Produit</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-sm text-gray-500 hover:text-gray-900 transition">Fonctionnalités</a>
                <a href="#how-it-works" className="block text-sm text-gray-500 hover:text-gray-900 transition">Comment ça marche</a>
                <button onClick={() => navigate('/ecom/tarifs')} className="block text-sm text-gray-500 hover:text-gray-900 transition">Tarifs</button>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-400 mb-5">Ressources</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/ecom/why-scalor')} className="block text-sm text-gray-500 hover:text-gray-900 transition">Pourquoi Scalor</button>
                <a href="mailto:contact@safitech.shop" className="block text-sm text-gray-500 hover:text-gray-900 transition">Support</a>
                <a href="mailto:contact@safitech.shop" className="block text-sm text-gray-500 hover:text-gray-900 transition">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-400 mb-5">Légal</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/ecom/privacy')} className="block text-sm text-gray-500 hover:text-gray-900 transition">Confidentialité</button>
                <button onClick={() => navigate('/ecom/terms')} className="block text-sm text-gray-500 hover:text-gray-900 transition">Conditions</button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-gray-400">&copy; {new Date().getFullYear()} SCALOR by Safitech. Tous droits réservés.</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
