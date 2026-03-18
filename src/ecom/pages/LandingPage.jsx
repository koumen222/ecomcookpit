import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════
   Intersection Observer hook for scroll reveal
═══════════════════════════════════════════════════════ */
const useReveal = (threshold = 0.15) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
};

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Animated counter
═══════════════════════════════════════════════════════ */
const Counter = ({ end, suffix = '', duration = 2000 }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          setVal(Math.floor(p * end));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [end, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
};

/* ═══════════════════════════════════════════════════════
   MAIN LANDING PAGE
═══════════════════════════════════════════════════════ */
const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const bentoFeatures = [
    { icon: '📊', title: 'Dashboard centralisé', desc: 'Visualisez toutes vos métriques en temps réel — revenus, commandes, panier moyen, conversion.', wide: true,
      stats: [{ val: '2.4M', label: 'Revenu' }, { val: '847', label: 'Commandes' }, { val: '4.2%', label: 'Conversion' }, { val: '28K', label: 'Panier moy.' }] },
    { icon: '📦', title: 'Multi-boutiques', desc: 'Connectez Shopify, WooCommerce et plus. Synchronisation automatique des commandes et stocks.' },
    { icon: '💬', title: 'Ventes en direct', desc: 'Intégrez vos lives WhatsApp. Vos clients commandent en direct, vous validez en un clic.' },
    { icon: '🤖', title: 'Agent IA vendeur', desc: 'Notre IA analyse vos performances et suggère des actions pour optimiser vos ventes.' },
    { icon: '📈', title: 'Analyses & rapports', desc: 'Rapports détaillés, produits populaires, comportement client. Export PDF en un clic.', wide: true,
      stats: [{ val: '+23%', label: 'Croissance' }, { val: 'Top 5', label: 'Produits' }, { val: 'PDF', label: 'Export' }] },
    { icon: '🔔', title: 'Notifications push', desc: 'Alertes instantanées pour chaque commande, message ou événement. Ne ratez jamais une vente.' },
    { icon: '👥', title: 'Équipe & rôles', desc: 'Invitez votre équipe avec des rôles dédiés — admin, vendeur, comptable. Chat interne inclus.' },
    { icon: '🔐', title: 'Sécurité avancée', desc: 'OAuth, chiffrement, RGPD. Vos données sont protégées aux meilleurs standards.' },
  ];

  const steps = [
    { num: '01', title: 'Créez votre compte', desc: 'Inscription gratuite en 30 secondes. Aucune carte requise.' },
    { num: '02', title: 'Connectez vos boutiques', desc: 'Liez Shopify, WooCommerce ou d\'autres plateformes en quelques clics.' },
    { num: '03', title: 'Pilotez & vendez', desc: 'Gérez tout depuis un seul dashboard. L\'IA vous guide.' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1115] text-white overflow-x-hidden">

      {/* ══════ ANIMATED MESH BACKGROUND ══════ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[600px] h-[600px] rounded-full bg-emerald-700/[0.12] blur-[120px] animate-[orbFloat_20s_ease-in-out_infinite]" />
        <div className="absolute top-[40%] -right-[15%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.08] blur-[120px] animate-[orbFloat_25s_ease-in-out_infinite_-7s]" />
        <div className="absolute -bottom-[5%] left-[30%] w-[400px] h-[400px] rounded-full bg-emerald-600/[0.1] blur-[120px] animate-[orbFloat_22s_ease-in-out_infinite_-14s]" />
      </div>

      {/* ══════ NAVBAR ══════ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0F1115]/90 backdrop-blur-2xl shadow-lg shadow-black/20' : 'bg-[#0F1115]/60 backdrop-blur-xl'} border-b border-white/[0.05]`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20 group-hover:shadow-emerald-600/40 transition">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" opacity="0.9"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10c2.39 0 4.59-.84 6.31-2.24l-1.41-1.41A7.96 7.96 0 0112 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8c0 1.18-.26 2.3-.72 3.31l1.55 1.55A9.96 9.96 0 0022 12c0-5.523-4.477-10-10-10z" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-[2px] text-white">SCALOR</span>
          </button>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition relative group">
              Fonctionnalités
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 group-hover:w-full transition-all" />
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition relative group">
              Comment ça marche
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 group-hover:w-full transition-all" />
            </a>
            <button onClick={() => navigate('/ecom/why-scalor')} className="text-sm font-medium text-gray-400 hover:text-white transition relative group">
              Pourquoi Scalor ?
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 group-hover:w-full transition-all" />
            </button>
            <button onClick={() => navigate('/ecom/tarifs')} className="text-sm font-medium text-gray-400 hover:text-white transition relative group">
              Tarifs
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-emerald-500 group-hover:w-full transition-all" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ecom/login')} className="hidden md:block text-sm font-medium text-gray-400 hover:text-white transition px-4 py-2">
              Connexion
            </button>
            <button onClick={() => navigate('/ecom/register')} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5">
              Commencer
            </button>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2 text-white/70">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenu 
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
                }
              </svg>
            </button>
          </div>
        </nav>
        {mobileMenu && (
          <div className="md:hidden bg-[#1A1C22]/95 backdrop-blur-2xl border-t border-white/[0.05] px-4 py-5 space-y-1 animate-[slideDown_0.2s_ease]">
            <a href="#features" onClick={() => setMobileMenu(false)} className="block px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition">Fonctionnalités</a>
            <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="block px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition">Comment ça marche</a>
            <button onClick={() => { navigate('/ecom/why-scalor'); setMobileMenu(false); }} className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition">Pourquoi Scalor ?</button>
            <button onClick={() => { navigate('/ecom/tarifs'); setMobileMenu(false); }} className="block w-full text-left px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition">Tarifs</button>
            <div className="pt-3 border-t border-white/[0.05] flex flex-col gap-2">
              <button onClick={() => navigate('/ecom/login')} className="w-full text-center py-3 text-sm font-medium text-gray-300 hover:text-white rounded-xl transition">Connexion</button>
              <button onClick={() => navigate('/ecom/register')} className="w-full text-center py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl">Commencer</button>
            </div>
          </div>
        )}
      </header>

      {/* ══════ HERO — Split layout ══════ */}
      <section className="relative min-h-screen flex items-center pt-[72px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div className="max-w-xl lg:max-w-none">
              <Reveal>
                <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm font-semibold text-emerald-400 mb-8">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  La plateforme #1 pour le e-commerce COD en Afrique
                </div>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-black leading-[1.05] tracking-tight mb-6">
                  Pilotez votre<br />
                  e-commerce{' '}
                  <span className="bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 bg-clip-text text-transparent">
                    comme un pro.
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-lg text-gray-400 leading-relaxed mb-10 max-w-lg">
                  Centralisez vos boutiques, automatisez vos flux, et prenez des décisions data-driven. Scalor est l'OS qui fait passer votre business au niveau supérieur.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                  <button onClick={() => navigate('/ecom/register')} className="group px-8 py-4 text-white bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-base transition-all shadow-2xl shadow-emerald-600/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2.5 relative overflow-hidden">
                    <span className="relative z-10">Créer mon espace gratuitement</span>
                    <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
                  </button>
                  <button onClick={() => { const el = document.querySelector('[data-tutorial-section]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                    className="px-8 py-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-emerald-500/30 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2.5 text-gray-300">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Voir le tuto
                  </button>
                </div>
              </Reveal>
              <Reveal delay={320}>
                <div className="flex gap-10 flex-wrap">
                  {[
                    { end: 500, suffix: '+', label: 'Vendeurs actifs' },
                    { end: 12, suffix: 'K+', label: 'Commandes / mois' },
                    { end: 99, suffix: '.9%', label: 'Uptime' },
                  ].map((m, i) => (
                    <div key={i} className="relative pr-10 last:pr-0">
                      <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        <Counter end={m.end} suffix={m.suffix} />
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">{m.label}</div>
                      {i < 2 && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-px h-8 bg-white/10 hidden sm:block" />}
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Right — Dashboard mockup */}
            <div className="hidden lg:block relative" style={{ perspective: '1200px' }}>
              <Reveal delay={200}>
                {/* Floating notification cards */}
                <div className="absolute -top-2 -left-10 z-20 bg-[#1A1C22] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/40 animate-[floatUp_3s_ease-in-out_infinite_alternate]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center text-lg">📦</div>
                  <div>
                    <div className="text-sm font-semibold">Nouvelle commande !</div>
                    <div className="text-[11px] text-gray-500">Shopify · il y a 2 min</div>
                  </div>
                </div>
                <div className="absolute -bottom-2 -right-6 z-20 bg-[#1A1C22] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/40 animate-[floatUp_3s_ease-in-out_infinite_alternate_-1.5s]">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg">📈</div>
                  <div>
                    <div className="text-sm font-semibold">+23% de ventes</div>
                    <div className="text-[11px] text-gray-500">Cette semaine</div>
                  </div>
                </div>
                {/* Dashboard card */}
                <div
                  className="bg-[#1A1C22] border border-white/[0.08] rounded-3xl p-6 shadow-[0_40px_80px_rgba(0,0,0,0.5)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.7)] transition-all duration-500"
                  style={{ transform: 'rotateY(-4deg) rotateX(2deg)', transition: 'transform 0.5s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'rotateY(0deg) rotateX(0deg)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'rotateY(-4deg) rotateX(2deg)'}
                >
                  {/* Title bar dots */}
                  <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.06]">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                    <span className="ml-auto text-[11px] text-gray-600 font-medium">Dashboard — Scalor</span>
                  </div>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: 'Revenu', value: '2.4M', change: '+18.2%', up: true },
                      { label: 'Commandes', value: '847', change: '+12.5%', up: true },
                      { label: 'Panier moyen', value: '28.3K', change: '+5.1%', up: true },
                      { label: 'Conversion', value: '4.2%', change: '-0.3%', up: false },
                    ].map((s, i) => (
                      <div key={i} className="bg-[#22252B] rounded-xl p-4 border border-white/[0.04]">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</div>
                        <div className="text-xl font-extrabold tracking-tight">{s.value}</div>
                        <div className={`text-xs font-semibold mt-1 ${s.up ? 'text-emerald-400' : 'text-red-400'}`}>{s.change}</div>
                      </div>
                    ))}
                  </div>
                  {/* Mini chart */}
                  <div className="bg-[#22252B] rounded-xl p-4 border border-white/[0.04]">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Ventes · 7 derniers jours</div>
                    <div className="flex items-end gap-1.5 h-16">
                      {[45, 60, 35, 80, 65, 90, 75].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t bg-emerald-600/60 hover:bg-emerald-500/80 transition-colors" style={{ height: `${h}%`, animation: `barGrow 1.2s ease-out ${i * 0.1}s both` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ LOGO BAND ══════ */}
      <div className="relative z-10 border-y border-white/[0.06] py-14">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-[11px] font-semibold text-gray-600 uppercase tracking-[3px] mb-8">Intégrations compatibles</p>
          <div className="flex justify-center items-center gap-10 sm:gap-14 flex-wrap">
            {[
              { icon: '🛍️', name: 'Shopify' },
              { icon: '🌐', name: 'WooCommerce' },
              { icon: '💬', name: 'WhatsApp' },
              { icon: '📧', name: 'SMTP' },
              { icon: '📊', name: 'Google Sheets' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-2.5 text-gray-500 hover:text-gray-300 transition text-sm font-bold opacity-60 hover:opacity-100">
                <span className="text-lg">{l.icon}</span> {l.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ BENTO FEATURES GRID ══════ */}
      <section id="features" className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-400 uppercase tracking-[2px] mb-4">Fonctionnalités</span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-extrabold tracking-tight mb-4">
                Tout ce dont vous avez besoin,<br className="hidden sm:block" /> rien de superflu.
              </h2>
              <p className="text-gray-400 text-lg max-w-xl mx-auto">Une suite d'outils pensée pour les vendeurs e-commerce africains. Simple, puissant, efficace.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bentoFeatures.map((f, i) => (
              <Reveal key={i} delay={i * 60} className={f.wide ? 'md:col-span-2' : ''}>
                <div className="group bg-[#1A1C22] border border-white/[0.06] rounded-2xl p-7 transition-all duration-300 hover:border-emerald-500/30 hover:-translate-y-1 relative overflow-hidden h-full">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-2xl mb-5">{f.icon}</div>
                  <h3 className="text-lg font-bold mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                  {f.stats && (
                    <div className="flex gap-3 mt-6">
                      {f.stats.map((s, j) => (
                        <div key={j} className="flex-1 bg-[#22252B] border border-white/[0.04] rounded-xl p-3 text-center">
                          <div className="text-lg font-extrabold bg-gradient-to-b from-white to-emerald-400 bg-clip-text text-transparent">{s.val}</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS — Horizontal Timeline ══════ */}
      <section id="how-it-works" className="relative z-10 py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[11px] font-bold text-emerald-400 uppercase tracking-[2px] mb-4">Comment ça marche</span>
              <h2 className="text-3xl sm:text-4xl lg:text-[2.8rem] font-extrabold tracking-tight mb-4">Opérationnel en 3 minutes.</h2>
              <p className="text-gray-400 text-lg max-w-md mx-auto">Pas de configuration complexe. Connectez, centralisez, vendez.</p>
            </div>
          </Reveal>
          <div className="relative grid md:grid-cols-3 gap-8 md:gap-6">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-[56px] left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-white/5 via-emerald-600/40 to-white/5" />
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="text-center relative">
                  <div className="w-[72px] h-[72px] rounded-full bg-[#1A1C22] border-2 border-emerald-600 mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)] relative z-10">
                    <span className="text-2xl font-black text-emerald-400">{s.num}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-400 max-w-[260px] mx-auto leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TUTORIEL YOUTUBE ══════ */}
      <section data-tutorial-section className="relative z-10 py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-[11px] font-bold text-red-400 uppercase tracking-[2px] mb-4">Tutoriel</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Maîtrisez Scalor en{' '}
                <span className="bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">15 minutes</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Suivez notre tutoriel complet pour découvrir comment exploiter toute la puissance de Scalor.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40 mb-10">
              <div className="relative aspect-video bg-[#1A1C22]">
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
          <Reveal delay={200}>
            <div className="text-center">
              <p className="text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                De la création de votre premier produit à l'envoi de campagnes WhatsApp par pays, ce tutoriel vous guide à travers chaque étape.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://youtu.be/405eKEysE0Q" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition shadow-lg shadow-red-600/25">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                  Ouvrir sur YouTube
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ CTA — Gradient Panel ══════ */}
      <section className="relative z-10 py-20 sm:py-28 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="relative bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 rounded-[28px] px-8 sm:px-16 py-16 sm:py-20 text-center overflow-hidden">
              {/* Pattern overlay */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-5 relative">
                Prêt à scaler votre business ?
              </h2>
              <p className="text-lg text-white/80 max-w-lg mx-auto mb-10 relative leading-relaxed">
                Rejoignez des centaines de vendeurs qui utilisent Scalor pour structurer et développer leur e-commerce.
              </p>
              <button onClick={() => navigate('/ecom/register')} className="group inline-flex items-center gap-2.5 px-8 py-4 bg-white text-emerald-700 rounded-2xl font-bold text-base hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/30 transition-all relative">
                Créer un compte gratuit
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="relative z-10 border-t border-white/[0.06] pt-16 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => navigate('/')} className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <span className="text-white font-extrabold text-sm">S</span>
                </div>
                <span className="text-lg font-extrabold tracking-[2px]">SCALOR</span>
              </button>
              <p className="text-sm text-gray-500 leading-relaxed max-w-[260px]">L'Operating System pour le e-commerce africain. Growth. Structure. Intelligence.</p>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-500 mb-5">Produit</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-sm text-gray-400 hover:text-white transition">Fonctionnalités</a>
                <a href="#how-it-works" className="block text-sm text-gray-400 hover:text-white transition">Comment ça marche</a>
                <button onClick={() => navigate('/ecom/tarifs')} className="block text-sm text-gray-400 hover:text-white transition">Tarifs</button>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-500 mb-5">Ressources</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/ecom/why-scalor')} className="block text-sm text-gray-400 hover:text-white transition">Pourquoi Scalor</button>
                <a href="mailto:contact@safitech.shop" className="block text-sm text-gray-400 hover:text-white transition">Support</a>
                <a href="mailto:contact@safitech.shop" className="block text-sm text-gray-400 hover:text-white transition">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[2px] text-gray-500 mb-5">Légal</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/ecom/privacy')} className="block text-sm text-gray-400 hover:text-white transition">Confidentialité</button>
                <button onClick={() => navigate('/ecom/terms')} className="block text-sm text-gray-400 hover:text-white transition">Conditions</button>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-gray-600">&copy; {new Date().getFullYear()} SCALOR by Safitech. Tous droits réservés.</span>
          </div>
        </div>
      </footer>

      {/* ══════ GLOBAL KEYFRAMES (injected once) ══════ */}
      <style>{`
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -40px) scale(1.1); }
          50% { transform: translate(-30px, 60px) scale(0.95); }
          75% { transform: translate(40px, 30px) scale(1.05); }
        }
        @keyframes floatUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-12px); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
