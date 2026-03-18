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

/* ═══ Cycling text hook ═══ */
const useCyclingText = (items, interval = 3200) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % items.length);
        setVisible(true);
      }, 400);
    }, interval);
    return () => clearInterval(timer);
  }, [items.length, interval]);
  return [items[index], visible];
};


const LandingPage = () => {
  const headlines = [
    { line1: "De la première vente", line2: "à l'empire e-commerce." },
    { line1: "Vendez plus.", line2: "Travaillez deux fois moins." },
    { line1: "Vos boutiques, vos commandes,", line2: "un seul endroit." },
    { line1: "L'IA qui booste", line2: "vos ventes chaque jour." },
  ];
  const [headline, headlineVisible] = useCyclingText(headlines, 3400);



  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* SVG icon components */
  const icons = {
    dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
    store: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 21V13h6v8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    spark: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    chart: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 16l4-5 4 3 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    bell: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    users: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    shield: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };

  const features = [
    { icon: icons.dashboard, title: 'Dashboard centralisé', desc: "Visualisez revenus, commandes et conversion en un coup d'œil. Toutes vos données réunies en temps réel." },
    { icon: icons.store, title: 'Multi-boutiques', desc: 'Connectez Shopify, WooCommerce et bien plus. Synchronisation automatique des commandes et des stocks.' },
    { icon: icons.chat, title: 'Ventes en direct', desc: 'Recevez les commandes live via WhatsApp. Confirmez et expédiez en un seul clic depuis votre dashboard.' },
    { icon: icons.spark, title: 'Agent IA vendeur', desc: 'Votre assistant intelligent analyse vos performances et vous recommande les meilleures actions à prendre.' },
    { icon: icons.chart, title: 'Analyses avancées', desc: 'Identifiez vos produits stars, comprenez vos clients et exportez des rapports PDF en un instant.' },
    { icon: icons.bell, title: 'Notifications push', desc: 'Soyez alerté à chaque commande, chaque message, chaque événement important. Zéro vente manquée.' },
    { icon: icons.users, title: 'Équipe & rôles', desc: "Ajoutez admins, vendeurs, comptables avec des accès dédiés. Messagerie d'équipe intégrée." },
    { icon: icons.shield, title: 'Sécurité renforcée', desc: 'Authentification OAuth, chiffrement de bout en bout et conformité RGPD. Vos données sont protégées.' },
  ];

  const steps = [
    { num: '01', title: 'Créez votre espace', desc: "Inscription gratuite en 30 secondes. Pas de carte bancaire, pas d'engagement.", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { num: '02', title: 'Connectez vos boutiques', desc: 'Liez Shopify, WooCommerce ou vos autres plateformes. La synchronisation est instantanée.', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { num: '03', title: "Pilotez tout d'ici", desc: "Un seul tableau de bord pour votre business. L'IA s'occupe du reste.", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
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
                <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-white/80 backdrop-blur border border-emerald-200 rounded-full text-xs sm:text-[13px] font-semibold text-emerald-700 mb-6 sm:mb-7 shadow-sm">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                  Plateforme e-commerce COD #1 en Afrique
                </div>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="text-3xl sm:text-5xl lg:text-[3.4rem] font-black leading-[1.1] tracking-tight mb-5 sm:mb-6 text-gray-900" style={{ minHeight: '3.8em' }}>
                  <span style={{
                    display: 'inline-block',
                    opacity: headlineVisible ? 1 : 0,
                    transform: headlineVisible ? 'translateY(0)' : 'translateY(12px)',
                    transition: 'opacity 0.4s ease, transform 0.4s ease',
                  }}>
                    {headline.line1}<br />
                    <span className="text-emerald-600">{headline.line2}</span>
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 sm:mb-9 max-w-xl mx-auto px-2 sm:px-0">
                  Commandes, stocks, WhatsApp, livraisons — centralisez tout et vendez plus. Scalor automatise votre e-commerce pour que vous puissiez vous concentrer sur la croissance.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="flex flex-col sm:flex-row gap-3 mb-8 sm:mb-10 justify-center px-4 sm:px-0">
                  <button onClick={() => navigate('/ecom/register')}
                    className="w-full sm:w-auto px-7 py-3.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2">
                    Démarrer gratuitement
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  </button>
                  <button onClick={() => { const el = document.querySelector('[data-tutorial-section]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                    className="w-full sm:w-auto px-7 py-3.5 bg-white/80 hover:bg-white border border-gray-200 rounded-xl font-semibold text-[15px] text-gray-700 transition-all flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Voir la démo
                  </button>
                </div>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-sm text-gray-400 justify-center">
                  {['Gratuit pour commencer', 'Sans carte bancaire', 'Opérationnel en 30s'].map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
        </div>
      </section>

      {/* ══════ INTEGRATIONS BAND ══════ */}
      <div className="relative z-10 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-[3px] mb-6 sm:mb-8">Intégrations compatibles</p>
          <div className="flex justify-center items-center gap-3 sm:gap-5 flex-wrap">
            {[
              { name: 'Shopify', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { name: 'WooCommerce', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg> },
              { name: 'WhatsApp', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { name: 'Email SMTP', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { name: 'Google Sheets', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18" strokeLinecap="round"/></svg> },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white/70 backdrop-blur border border-gray-200/60 rounded-full text-gray-500 text-xs sm:text-sm font-semibold shadow-sm">
                {l.icon} {l.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="py-16 sm:py-24 lg:py-32 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-10 sm:mb-16">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-600 uppercase tracking-[2px] mb-4">Fonctionnalités</span>
              <h2 className="text-2xl sm:text-4xl lg:text-[2.7rem] font-extrabold tracking-tight text-gray-900 mb-3 sm:mb-4">
                Tout pour vendre plus, gérer moins.
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">Chaque outil est pensé pour simplifier le quotidien des vendeurs e-commerce en Afrique.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="group bg-white/80 backdrop-blur border border-gray-200/50 rounded-2xl p-5 sm:p-6 h-full transition-all duration-300 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40 hover:-translate-y-1">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                  <h3 className="text-[15px] sm:text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-16 sm:py-24 lg:py-32 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-10 sm:mb-16">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-bold text-emerald-600 uppercase tracking-[2px] mb-4">3 étapes</span>
              <h2 className="text-2xl sm:text-4xl lg:text-[2.7rem] font-extrabold tracking-tight text-gray-900 mb-3 sm:mb-4">Lancez-vous en 3 minutes.</h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto">Aucune compétence technique requise. C'est simple, rapide et gratuit.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="relative bg-white/80 backdrop-blur rounded-2xl p-6 sm:p-8 border border-gray-200/50 text-center group hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/40 transition-all duration-300">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-md">{s.num}</div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 mt-2">{s.icon}</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TUTORIEL YOUTUBE ══════ */}
      <section data-tutorial-section className="py-16 sm:py-24 lg:py-32 relative z-10">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red-200/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-10 sm:mb-14">
              <span className="inline-block px-3.5 py-1 bg-red-50 border border-red-100 rounded-full text-[11px] font-bold text-red-500 uppercase tracking-[2px] mb-4">Tutoriel vidéo</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
                Prenez Scalor en main en{' '}
                <span className="text-red-500">15 minutes</span>
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
                Du premier produit à l'envoi de campagnes WhatsApp — cette vidéo couvre tout ce qu'il faut savoir.
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
              <a href="https://youtu.be/405eKEysE0Q" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition shadow-md shadow-red-600/15">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Regarder sur YouTube
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-14 sm:py-20 lg:py-28 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl sm:rounded-3xl px-6 sm:px-16 py-12 sm:py-20 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <h2 className="relative text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 sm:mb-5">
                Passez à la vitesse supérieure.
              </h2>
              <p className="relative text-base sm:text-lg text-white/80 max-w-lg mx-auto mb-8 sm:mb-10 leading-relaxed">
                Des centaines de vendeurs structurent déjà leur e-commerce avec Scalor. C'est gratuit pour démarrer.
              </p>
              <button onClick={() => navigate('/ecom/register')} className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-emerald-700 rounded-xl font-bold text-base hover:bg-gray-50 transition-colors shadow-lg">
                Créer mon compte
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-gray-200/50 bg-white/60 backdrop-blur pt-12 sm:pt-16 pb-8 sm:pb-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-14">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
              </button>
              <p className="text-sm text-gray-400 leading-relaxed max-w-[260px]">Le système d'exploitation du e-commerce africain. Structurez, vendez, grandissez.</p>
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
