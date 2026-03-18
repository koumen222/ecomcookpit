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


/* ═══ Support Chat Widget ═══ */
const SupportChat = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(1);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const AUTO_REPLIES = [
    "Merci pour votre message ! Un membre de notre équipe vous répondra très prochainement. En attendant, consultez notre documentation.",
    "Bonne question ! Notre équipe est disponible du lundi au samedi de 8h à 20h. Vous recevrez une réponse sous peu.",
    "Nous avons bien reçu votre message et allons vous répondre dans les plus brefs délais. Merci de votre confiance !",
  ];

  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'agent',
      text: "Bonjour 👋 Bienvenue sur Scalor ! Je suis Sarah, du support. Comment puis-je vous aider aujourd'hui ?",
      time: 'Maintenant',
    },
  ]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text, time: now }]);
    setInput('');
    setTyping(true);

    const delay = 1400 + Math.random() * 800;
    setTimeout(() => {
      setTyping(false);
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      setMessages(prev => [...prev, { id: Date.now() + 1, from: 'agent', text: reply, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }]);
    }, delay);
  };

  return (
    <>
      {/* Chat panel */}
      <div
        className="fixed bottom-24 right-5 sm:right-7 z-50 w-[calc(100vw-40px)] sm:w-[370px] transition-all duration-300 origin-bottom-right"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(16px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-gray-300/40 border border-gray-100 flex flex-col" style={{ height: '480px', background: '#fff' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm border-2 border-white/30">S</div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Support Scalor</p>
              <p className="text-[11px] text-white/75 mt-0.5">En ligne · Répond en quelques heures</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#f8fafc' }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.from === 'agent' && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">S</div>
                )}
                <div className={`max-w-[78%] ${msg.from === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md border border-gray-100 shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1">S</div>
                <div className="px-4 py-3 bg-white rounded-2xl rounded-bl-md border border-gray-100 shadow-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '160ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '320ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-3 bg-white border-t border-gray-100">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Écrivez un message…"
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-emerald-400 focus:bg-white transition"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </form>

          {/* Powered by */}
          <div className="text-center py-2 bg-white border-t border-gray-50">
            <span className="text-[10px] text-gray-300 font-medium tracking-wide">Propulsé par <span className="text-emerald-500 font-bold">Scalor</span></span>
          </div>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 sm:right-7 z-50 group flex items-center gap-3 transition-all duration-300"
        aria-label="Ouvrir le support"
      >
        {/* Label pill — visible when chat is closed */}
        <div className={`transition-all duration-300 ${open ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>
          <div className="hidden sm:flex items-center gap-2 bg-white border border-gray-100 shadow-lg shadow-gray-200/60 rounded-full px-4 py-2.5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">Support en ligne</span>
          </div>
        </div>
        {/* Circle icon */}
        <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${open ? 'bg-gray-700 rotate-0' : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-105 hover:shadow-emerald-400/40'}`}>
          {/* Unread badge */}
          {!open && unread > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">{unread}</span>
          )}
          {open ? (
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
          )}
        </div>
      </button>
    </>
  );
};

const LandingPage = () => {
  const headlines = [
    { line1: "De la première vente", line2: "à l'empire e-commerce." },
    { line1: "Vendez plus.", line2: "Travaillez deux fois moins." },
    { line1: "Vos boutiques, vos commandes,", line2: "un seul endroit." },
    { line1: "L'IA qui booste", line2: "vos ventes chaque jour." },
  ];
  const [headline, headlineVisible] = useCyclingText(headlines, 3400);

  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
    <div className="min-h-screen text-gray-900 overflow-x-hidden" style={{ background: 'linear-gradient(155deg, #f0fdf4 0%, #ffffff 40%, #f8fafc 70%, #ecfdf5 100%)' }}>
      {/* Dot pattern */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle, #d1fae5 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: 0.45 }} />

      {/* ══════ NAVBAR ══════ */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-2xl border-b border-gray-100 shadow-sm' : 'bg-white/60 backdrop-blur-xl'}`}>
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
            <button onClick={() => navigate('/ecom/tarifs')} className="px-4 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-all">Tarifs</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ecom/login')} className="hidden md:block px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition">Connexion</button>
            <button onClick={() => navigate('/ecom/register')} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]">
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
            <button onClick={() => { navigate('/ecom/tarifs'); setMobileMenu(false); }} className="block w-full text-left px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition">Tarifs</button>
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <button onClick={() => navigate('/ecom/login')} className="block w-full text-center py-3 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition">Connexion</button>
              <button onClick={() => navigate('/ecom/register')} className="block w-full text-center py-3 text-sm font-bold text-white bg-emerald-500 rounded-xl">Commencer</button>
            </div>
          </div>
        )}
      </header>

      {/* ══════ HERO ══════ */}
      <section className="relative pt-[68px]">
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-emerald-400/20 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-[300px] h-[300px] bg-teal-300/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 lg:pt-28 pb-16 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs sm:text-[13px] font-semibold text-emerald-700 mb-6 sm:mb-8">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Totalement gratuit pour le lancement
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="text-3xl sm:text-5xl lg:text-[3.6rem] font-black leading-[1.08] tracking-tight mb-5 sm:mb-6 text-gray-900" style={{ minHeight: '3.6em' }}>
              <span style={{
                display: 'inline-block',
                opacity: headlineVisible ? 1 : 0,
                transform: headlineVisible ? 'translateY(0)' : 'translateY(14px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}>
                {headline.line1}<br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-emerald-600">{headline.line2}</span>
                </span>
              </span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 sm:mb-10 max-w-xl mx-auto">
              Conçu pour le cash on delivery. Par un e-commerçant comme toi.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="flex flex-col sm:flex-row gap-3 mb-8 justify-center px-4 sm:px-0">
              <button onClick={() => navigate('/ecom/register')}
                className="w-full sm:w-auto px-7 py-3.5 text-white bg-emerald-500 hover:bg-emerald-400 rounded-xl font-bold text-[15px] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                Essayez gratuitement
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
              <button onClick={() => { const el = document.querySelector('[data-tutorial-section]'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl font-semibold text-[15px] text-gray-700 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Voir la démo
              </button>
            </div>
          </Reveal>
        </div>

        {/* ─── Dashboard screenshot ─── */}
        <Reveal delay={200}>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-0">
            <div className="relative rounded-t-2xl overflow-hidden border border-gray-200 shadow-[0_20px_80px_rgba(0,0,0,0.10)]">
              {/* Browser bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 border-b border-gray-200">
                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <div className="ml-4 flex-1 h-6 bg-white rounded-md flex items-center px-3 border border-gray-200">
                  <span className="text-[11px] text-gray-400">app.scalor.pro/dashboard</span>
                </div>
              </div>
              <img src="/img/image.png" alt="Scalor Dashboard" className="w-full block" />
            </div>
            {/* Bottom fade */}
            <div className="h-24 -mt-24 relative z-10" style={{ background: 'linear-gradient(to bottom, transparent, #f9fafb)' }} />
          </div>
        </Reveal>
      </section>

      {/* ══════ "FINI LES DÉPENDANCES" BAND ══════ */}
      <div className="py-14 sm:py-20 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <Reveal>
            <p className="text-center text-[11px] font-bold text-emerald-600 uppercase tracking-[4px] mb-3">TOUT-EN-UN</p>
            <h3 className="text-center text-xl sm:text-2xl font-extrabold text-gray-900 mb-8">Fini les dépendances à ces outils</h3>
          </Reveal>
          <Reveal delay={80}>
            <div className="flex justify-center items-center gap-3 sm:gap-4 flex-wrap">
              {[
                { name: 'Shopify', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { name: 'WooCommerce', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg> },
                { name: 'WhatsApp', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { name: 'Google Sheets', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18" strokeLinecap="round"/></svg> },
                { name: 'EasySell COD', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm font-semibold shadow-sm">
                  <span className="text-emerald-600">{l.icon}</span> {l.name}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="py-20 sm:py-28 lg:py-36 relative">
        <div className="absolute left-1/4 top-1/2 w-[400px] h-[400px] bg-emerald-300/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <Reveal>
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-4xl lg:text-[2.8rem] font-extrabold tracking-tight text-gray-900 mb-4">
                Chaque feature pensée pour ta réalité<br className="hidden sm:block" />
                <span className="text-emerald-600"> d'e-commerçant en Afrique</span>
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-lg mx-auto">Pas de fonctions gadgets. Juste ce qui compte pour vendre en COD.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 50}>
                <div className="group bg-white hover:bg-white border border-gray-100 hover:border-emerald-200 rounded-2xl p-5 sm:p-6 h-full transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-emerald-100/50 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">{f.icon}</div>
                  <h3 className="text-[15px] sm:text-base font-bold text-gray-900 mb-1.5">{f.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ WHY I BUILT SCALOR ══════ */}
      <section className="py-20 sm:py-28 border-t border-gray-100 relative">
        <div className="absolute right-1/4 top-1/3 w-[350px] h-[350px] bg-emerald-300/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 relative">
          <Reveal>
            <div className="text-center mb-10">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700 uppercase tracking-[2px] mb-5">L'HISTOIRE</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-6">
                {"Pourquoi j'ai créé Scalor"}
              </h2>
            </div>
          </Reveal>
          <div className="space-y-6">
            <Reveal delay={60}>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                <p className="text-gray-600 leading-relaxed text-base sm:text-lg">
                  <span className="text-gray-900 font-semibold">{"Comme toi, j'ai commencé le e-commerce COD en Afrique."}</span>{" "}
                  {"Tableurs Google Sheets pour les commandes, WhatsApp pour confirmer, un autre outil pour le suivi de livraison, encore un autre pour les stats… Chaque jour, c'était le chaos."}
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                <p className="text-gray-600 leading-relaxed text-base sm:text-lg">
                  <span className="text-gray-900 font-semibold">{"Je perdais des ventes"}</span>{" à cause d'un système désorganisé. Des commandes oubliées, des relances jamais faites, aucune visibilité sur mes vrais chiffres. J'ai cherché un outil pensé pour le COD africain — "}
                  <span className="text-emerald-600 font-semibold">{"il n'existait pas."}</span>
                </p>
              </div>
            </Reveal>
            <Reveal delay={180}>
              <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-sm">
                <p className="text-gray-600 leading-relaxed text-base sm:text-lg">
                  <span className="text-gray-900 font-semibold">{"Alors je l'ai construit."}</span>{" "}
                  {"Scalor regroupe tout ce dont un e-commerçant COD a besoin : commandes, stocks, WhatsApp, livraisons, rapports, équipe — dans un seul dashboard. Pour que tu puisses te concentrer sur ce qui compte : "}
                  <span className="text-emerald-600 font-semibold">vendre et scaler.</span>
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════ NUMBERS / SOCIAL PROOF ══════ */}
      <section className="py-16 sm:py-20 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
              {[
                { val: '500+', label: 'Vendeurs actifs' },
                { val: '15 000+', label: 'Commandes traitées' },
                { val: '98%', label: 'Satisfaction clients' },
                { val: '30s', label: 'Pour créer un compte' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{s.val}</p>
                  <p className="text-sm text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ PAIN POINTS ══════ */}
      <section className="py-20 sm:py-28 border-t border-gray-100 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
                {"Tu te reconnais ? 👀"}
              </h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-lg mx-auto">{"Ces problèmes, c'est ce qui tue la croissance de 90% des e-commerçants COD."}</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { problem: 'Tu gères tes commandes sur Google Sheets', solution: 'Dashboard centralisé avec tout en temps réel' },
              { problem: 'Tu ne sais pas tes vrais chiffres de livraison', solution: 'Taux de livraison, bénéfice net, panier moyen — automatique' },
              { problem: 'Tes relances clients sont aléatoires', solution: "Relances WhatsApp automatisées et programmées" },
              { problem: "Tu n'as aucune visibilité sur ta rentabilité", solution: 'Rapports détaillés avec coûts, marges et ROI' },
              { problem: 'Tu perds des ventes par manque de suivi', solution: 'Notifications push à chaque commande et événement' },
              { problem: 'Tu ne peux pas déléguer sans tout expliquer', solution: "Rôles d'équipe avec accès personnalisés" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 h-full shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-6 h-6 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </div>
                    <p className="text-sm text-gray-500">{item.problem}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{item.solution}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="py-20 sm:py-28 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12 sm:mb-16">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700 uppercase tracking-[2px] mb-4">3 étapes</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">Lancez-vous en 3 minutes.</h2>
              <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto">Aucune compétence technique requise.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="relative bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 text-center group hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300 shadow-sm">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shadow-md shadow-emerald-600/20">{s.num}</div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-4 mt-2">{s.icon}</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ TUTORIEL YOUTUBE ══════ */}
      <section data-tutorial-section className="py-20 sm:py-28 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-10 sm:mb-14">
              <span className="inline-block px-3.5 py-1 bg-red-50 border border-red-200 rounded-full text-[11px] font-bold text-red-600 uppercase tracking-[2px] mb-4">Tutoriel vidéo</span>
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
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-2xl shadow-gray-300/30 mb-10">
              <div className="relative aspect-video bg-gray-100">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition shadow-lg shadow-red-900/30">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Regarder sur YouTube
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ WHO IS IT FOR ══════ */}
      <section className="py-20 sm:py-28 border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 mb-4">
                {"Scalor, c'est pour toi si…"}
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: 'E-commerçant COD', desc: "Tu vends en cash on delivery en Afrique (Côte d'Ivoire, Sénégal, Cameroun, RDC…) et tu veux structurer ton business.", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { title: 'Dropshipper', desc: "Tu sources tes produits et tu veux un outil pour automatiser les commandes, relances et suivi sans prise de tête.", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { title: 'Agence / Équipe', desc: "Tu gères plusieurs boutiques ou une équipe de vendeurs. Tu as besoin de rôles, de tableaux de bord séparés et de rapports.", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 text-center h-full hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-5">{item.icon}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ FAQ ══════ */}
      <section className="py-20 sm:py-28 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <span className="inline-block px-3.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-bold text-emerald-700 uppercase tracking-[2px] mb-4">FAQ</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">Questions fréquentes</h2>
            </div>
          </Reveal>
          <div className="space-y-3">
            {[
              { q: "C'est vraiment gratuit ?", a: "Oui. Tu peux créer ton compte, ajouter tes produits et commencer à gérer tes commandes sans payer. On a un plan gratuit permanent." },
              { q: "J'ai besoin de compétences techniques ?", a: "Aucune. Si tu sais utiliser WhatsApp, tu sais utiliser Scalor. Tout est pensé pour être simple." },
              { q: "Ça marche avec Shopify ?", a: "Oui. Scalor se connecte à Shopify, WooCommerce et d'autres plateformes. La synchronisation des commandes est automatique." },
              { q: "Je peux gérer plusieurs boutiques ?", a: "Absolument. Tu peux connecter et gérer autant de boutiques que tu veux depuis un seul tableau de bord." },
              { q: "Mes données sont en sécurité ?", a: "Oui. Chiffrement de bout en bout, authentification sécurisée, et conformité RGPD. Tes données restent les tiennes." },
              { q: "Comment fonctionne le WhatsApp intégré ?", a: "Tu peux envoyer des confirmations de commande, des relances et des campagnes marketing directement depuis Scalor via WhatsApp." },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 40}>
                  <details className="group bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <summary className="flex items-center justify-between cursor-pointer px-5 sm:px-6 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition">
                    {item.q}
                    <svg className="w-4 h-4 text-gray-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <div className="px-5 sm:px-6 pb-4 text-sm text-gray-400 leading-relaxed">{item.a}</div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-16 sm:py-24 px-4 border-t border-gray-100">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <div className="relative rounded-2xl sm:rounded-3xl px-6 sm:px-16 py-14 sm:py-20 overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600">
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-white/10 rounded-full blur-[80px]" />
              <h2 className="relative text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 sm:mb-5">
                Passez à la vitesse supérieure.
              </h2>
              <p className="relative text-base sm:text-lg text-white/80 max-w-lg mx-auto mb-8 sm:mb-10 leading-relaxed">
                Des centaines de vendeurs structurent déjà leur e-commerce avec Scalor. C'est gratuit pour démarrer.
              </p>
              <button onClick={() => navigate('/ecom/register')} className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-emerald-700 hover:bg-gray-50 rounded-xl font-bold text-base transition-colors shadow-lg">
                Créer mon compte gratuitement
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-gray-100 bg-white pt-12 sm:pt-16 pb-8 sm:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-14">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
              </button>
              <p className="text-sm text-gray-400 leading-relaxed max-w-[240px]">Le système d'exploitation du e-commerce africain. Structurez, vendez, grandissez.</p>
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
          <div className="border-t border-gray-100 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
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

      {/* Support Chat Widget */}
      <SupportChat />
    </div>
  );
};

export default LandingPage;
