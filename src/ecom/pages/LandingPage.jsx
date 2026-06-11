import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms`,
    }}>{children}</div>
  );
};

/* ─── Support Chat ─── */
const SupportChat = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(1);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sessionId = useRef((() => {
    const k = 'scalor_support_session';
    let sid = localStorage.getItem(k);
    if (!sid) { sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, sid); }
    return sid;
  })());
  const apiBase = (() => {
    const viteApi = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_URL || import.meta.env?.VITE_BACKEND_URL || '') : '';
    if (viteApi) { const norm = viteApi.replace(/\/$/, ''); return norm.endsWith('/api/ecom') ? norm : norm + '/api/ecom'; }
    return 'https://api.scalor.net/api/ecom';
  })();
  const shownAgentIds = useRef(new Set());
  const AUTO_REPLIES = [
    "Merci pour votre message ! Nous allons vous répondre dans les plus brefs délais. 🙏",
    "Bien reçu ! Notre équipe est disponible du lundi au samedi de 8h à 20h.",
    "Message reçu ! Rita revient vers vous très bientôt.",
  ];
  const [messages, setMessages] = useState([{
    id: 1, from: 'agent', text: "Bonjour 👋 Bienvenue sur Scalor ! Je suis Rita, du support. Comment puis-je vous aider aujourd'hui ?", time: 'Maintenant', source: 'auto',
  }]);
  const pollReplies = useRef(null);

  const pollOnce = async () => {
    try {
      const res = await fetch(`${apiBase}/support/session/${sessionId.current}`);
      if (!res.ok) return;
      const data = await res.json();
      const agentMsgs = data?.data?.messages || [];
      let gotNew = false;
      agentMsgs.forEach(msg => {
        const msgId = String(msg.id || msg._id || '');
        if (msgId && !shownAgentIds.current.has(msgId)) {
          shownAgentIds.current.add(msgId);
          const t = new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          setMessages(prev => [...prev, { id: msgId, from: 'agent', text: msg.text, time: t, source: 'ai', agentName: msg.agentName || 'Rita IA' }]);
          gotNew = true;
        }
      });
      if (gotNew) setTyping(false);
    } catch { }
  };

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 300);
      pollOnce();
      pollReplies.current = setInterval(pollOnce, 4000);
    } else {
      if (pollReplies.current) { clearInterval(pollReplies.current); pollReplies.current = null; }
    }
    return () => { if (pollReplies.current) clearInterval(pollReplies.current); };
  }, [open]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text, time: now, source: 'user' }]);
    setInput('');
    setTyping(true);
    try {
      await fetch(`${apiBase}/support/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.current, text }),
      });
      // Poll more aggressively after sending to catch IA reply fast
      setTimeout(pollOnce, 2500);
      setTimeout(pollOnce, 5000);
      setTimeout(pollOnce, 8000);
      // Fallback: stop typing indicator after 12s if no reply
      setTimeout(() => setTyping(false), 12000);
    } catch {
      setTyping(false);
    }
  };
  return (
    <>
      <div className="fixed bottom-24 right-5 sm:right-7 z-50 w-[calc(100vw-40px)] sm:w-[370px] transition-all duration-300 origin-bottom-right"
        style={{ opacity: open ? 1 : 0, transform: open ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(16px)', pointerEvents: open ? 'auto' : 'none' }}>
        <div className="rounded-2xl overflow-hidden flex flex-col" style={{ height: '480px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: 'linear-gradient(135deg, #05976D, #0d9488)' }}>
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}>R</div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-700 rounded-full" style={{ border: '2px solid #05976D' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Support Scalor</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Rita · Répond en quelques heures</p>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl transition flex-shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: '#0a0a0a' }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.from === 'agent' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1" style={{ background: 'linear-gradient(135deg, #05976D, #0d9488)' }}>R</div>
                )}
                <div className={`max-w-[78%] flex flex-col gap-1 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed" style={msg.from === 'user' ? { background: '#05976D', color: '#fff', borderBottomRightRadius: 4 } : { background: '#1a1a1a', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 }}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{msg.time}</span>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1" style={{ background: 'linear-gradient(135deg, #05976D, #0d9488)' }}>R</div>
                <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#6b7280', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#6b7280', animationDelay: '160ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#6b7280', animationDelay: '320ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-3" style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder="Écrivez un message…"
              className="flex-1 text-sm outline-none rounded-xl px-3.5 py-2.5 transition" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb' }} />
            <button type="submit" disabled={!input.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center transition flex-shrink-0" style={{ background: '#05976D', color: '#fff', opacity: !input.trim() ? 0.4 : 1 }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
          </form>
          <div className="text-center py-2" style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>Propulsé par <span style={{ color: '#05976D' }}>Scalor</span></span>
          </div>
        </div>
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ background: open ? '#0a5740' : '#0F6B4F' }}
        aria-label="Support"
      >
        {open
          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
        }
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{unread}</span>
        )}
      </button>
    </>
  );
};

/* ─── Main Landing ─── */
const ROTATING_WORDS = ['2× plus de commandes', 'sans panier abandonné', 'avec l\'IA', 'en Afrique', 'sans effort'];

const RotatingText = () => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % ROTATING_WORDS.length);
        setVisible(true);
      }, 350);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{
      display: 'inline-block',
      color: '#05976D',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-12px)',
      transition: 'opacity 0.35s cubic-bezier(.16,1,.3,1), transform 0.35s cubic-bezier(.16,1,.3,1)',
      minWidth: 'clamp(120px, 40vw, 260px)',
    }}>
      {ROTATING_WORDS[index]}
    </span>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const features = [
    {
      tag: 'Commandes',
      title: 'Gestion des commandes COD',
      desc: 'Confirmez, relancez et expédiez vos commandes en un seul clic. Synchronisation automatique depuis Shopify, WooCommerce et plus.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      tag: 'WhatsApp',
      title: 'Ventes & relances WhatsApp',
      desc: 'Envoyez des confirmations, relancez les abandons de panier et lancez des campagnes marketing avec +90% de taux d\'ouverture.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      tag: 'Agent IA',
      title: 'Agent IA vendeur 24/7',
      desc: 'Votre agent intelligent répond aux clients, prend les commandes et recommande des produits automatiquement. Toujours disponible.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      tag: 'Analytics',
      title: 'Analyses & rapports',
      desc: 'Taux de livraison, bénéfice net, panier moyen — toutes vos métriques en temps réel. Exportez en PDF en un instant.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 16l4-5 4 3 5-6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      tag: 'Multi-boutiques',
      title: 'Gérez tout depuis 1 place',
      desc: 'Connectez Shopify, WooCommerce et plus. Toutes vos boutiques synchronisées dans un seul tableau de bord unifié.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v10a2 2 0 002 2h14a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      tag: 'Équipe',
      title: 'Rôles & collaboration',
      desc: 'Ajoutez admins, vendeurs, comptables avec des accès dédiés. Messagerie d\'équipe et notifications push intégrées.',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
  ];

  const stats = [
    { val: '500+', label: 'Vendeurs actifs' },
    { val: '15 000+', label: 'Commandes traitées' },
    { val: '+90%', label: 'Taux d\'ouverture WhatsApp' },
    { val: '30s', label: 'Pour créer un compte' },
  ];

  const integrations = [
    {
      name: 'Shopify',
      price: '~47 000 FCFA',
      color: '#96bf48',
      icon: (
        <svg viewBox="0 0 109.5 124.5" className="w-8 h-8">
          <path fill="#95BF47" d="M95.2 24.2c-.1-.6-.6-1-1.2-1-.5 0-9.9-.2-9.9-.2s-7.8-7.6-8.7-8.4c-.8-.8-2.5-.6-3.1-.4l-4.3 1.3c-1.3-3.7-3.5-7.1-7.4-7.1h-.4C59 6.3 57.3 5 55.7 5c-14 0-20.7 17.5-22.8 26.4l-9.8 3c-3.1.9-3.2 1-3.6 3.9L13 92.1l57.2 10.7 31-6.7L95.2 24.2zM67.5 17.5l-7 2.2c0-.4.1-.8.1-1.3 0-3.8-.5-6.9-1.4-9.3 3.5.4 5.8 4.4 8.3 8.4zM53.7 9.3c1 2.4 1.6 5.7 1.6 10.3v.6l-12.4 3.8c2.4-9.1 6.9-13.5 10.8-14.7zM47.8 6.9c.7 0 1.3.2 1.9.6-4.8 2.2-9.9 7.8-12 18.9l-9.1 2.8C30.8 20.6 37.1 6.9 47.8 6.9z"/>
          <path fill="#5E8E3E" d="M94 23.2c-.5 0-9.9-.2-9.9-.2s-7.8-7.6-8.7-8.4c-.3-.3-.7-.5-1.1-.5L70.2 103l31-6.7-7.5-72.1c-.1-.6-.6-1-1.2-1h-.5z"/>
          <path fill="#FFF" d="M55.7 40.5l-3.8 11.4s-3.4-1.8-7.5-1.8c-6.1 0-6.4 3.8-6.4 4.8 0 5.2 13.7 7.2 13.7 19.5 0 9.6-6.1 15.8-14.4 15.8-9.9 0-14.9-6.2-14.9-6.2l2.6-8.7s5.2 4.5 9.6 4.5c2.9 0 4-2.2 4-3.9 0-6.8-11.2-7.1-11.2-18.3 0-9.4 6.7-18.5 20.4-18.5 5.2 0 7.9 1.4 7.9 1.4z"/>
        </svg>
      ),
    },
    {
      name: 'WooCommerce',
      price: '~18 000 FCFA',
      color: '#7f54b3',
      icon: (
        <svg viewBox="0 0 100 60" className="w-10 h-6">
          <path fill="#7F54B3" d="M9.6 0h80.8C95.7 0 100 4.3 100 9.6v40.8c0 5.3-4.3 9.6-9.6 9.6H9.6C4.3 60 0 55.7 0 50.4V9.6C0 4.3 4.3 0 9.6 0z"/>
          <path fill="#FFF" d="M5.9 11.1c.7-.9 1.7-1.4 3.1-1.4 2.5 0 3.9 1.6 4 4.8l-1.5 16.3c0 .4-.2.6-.6.6s-.7-.2-.8-.6l-6-14.2-6 14.2c-.2.4-.5.6-.8.6-.4 0-.6-.2-.6-.6L.2 14.5C.3 11.3 1.7 9.7 4.2 9.7c1.4 0 2.4.5 3.1 1.4l4.2 7.8 4.2-7.8zM27.4 9.3c2.8 0 5.2 1 7.2 2.9 2 1.9 3 4.3 3 7.1 0 2.9-1 5.3-2.9 7.3-2 2-4.4 3-7.2 3-2.8 0-5.2-1-7.2-3-2-2-3-4.4-3-7.3 0-2.9 1-5.2 3-7.1 2-1.9 4.3-2.9 7.1-2.9zm0 3c-1.8 0-3.3.6-4.5 1.9-1.2 1.3-1.8 2.8-1.8 4.6 0 1.8.6 3.3 1.9 4.6 1.2 1.3 2.7 1.9 4.4 1.9s3.2-.6 4.4-1.9c1.2-1.3 1.9-2.8 1.9-4.6 0-1.8-.6-3.3-1.9-4.6-1.1-1.3-2.6-1.9-4.4-1.9zM51.7 9.3c2.8 0 5.2 1 7.2 2.9 2 1.9 3 4.3 3 7.1 0 2.9-1 5.3-2.9 7.3-2 2-4.4 3-7.2 3-2.8 0-5.2-1-7.2-3-2-2-3-4.4-3-7.3 0-2.9 1-5.2 3-7.1 2-1.9 4.3-2.9 7.1-2.9zm0 3c-1.8 0-3.3.6-4.5 1.9-1.2 1.3-1.8 2.8-1.8 4.6 0 1.8.6 3.3 1.9 4.6 1.2 1.3 2.7 1.9 4.4 1.9s3.2-.6 4.4-1.9c1.2-1.3 1.9-2.8 1.9-4.6 0-1.8-.6-3.3-1.9-4.6-1.1-1.3-2.6-1.9-4.4-1.9zM76.4 9.7c1.3 0 2.4.4 3.2 1.2.9.8 1.3 1.9 1.3 3.2 0 1.3-.4 2.6-1.3 3.9l-4.8 7.1 5.2.1c.5 0 .8.2.8.6 0 .4-.3.6-.8.6H70c-.5 0-.8-.2-.8-.7 0-.3.1-.5.3-.7l6.4-9.6c.6-.9.9-1.7.9-2.4 0-.6-.2-1-.5-1.4-.3-.4-.8-.6-1.4-.6-.7 0-1.4.2-2 .7-.3.2-.5.3-.7.3-.3 0-.5-.2-.5-.5s.1-.5.4-.8c.8-.7 1.8-1 3.3-1z"/>
        </svg>
      ),
    },
    {
      name: 'WhatsApp',
      price: '~30 000 FCFA',
      color: '#25d366',
      icon: (
        <svg viewBox="0 0 32 32" className="w-8 h-8">
          <path fill="#25D366" d="M16 0C7.163 0 0 7.163 0 16c0 2.824.737 5.474 2.028 7.776L0 32l8.456-2.012A15.93 15.93 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/>
          <path fill="#FFF" d="M23.3 20.7c-.3-.7-1.8-1.4-2.5-1.6-.6-.2-1.1-.1-1.5.2l-.9 1c-.2.2-.5.3-.8.1-1-.5-3.1-2.1-4.3-4.1-.2-.3-.1-.6.1-.8l.7-.9c.3-.4.4-.8.2-1.3L13 11c-.3-.7-.7-1.2-1.3-1.2h-.1c-.7 0-1.5.3-2 .8-.8.9-1 2.1-.6 3.4.6 2.1 2.1 5 5.4 7.3 2.4 1.7 5 2.4 7 1.6.7-.3 1.6-.9 2-1.9.3-.7.2-1.8-.1-2.3z"/>
        </svg>
      ),
    },
    {
      name: 'Google Sheets',
      price: '~7 000 FCFA',
      color: '#34a853',
      icon: (
        <svg viewBox="0 0 48 48" className="w-8 h-8">
          <path fill="#43A047" d="M37 45H11c-1.7 0-3-1.3-3-3V6c0-1.7 1.3-3 3-3h19l10 10v29c0 1.7-1.3 3-3 3z"/>
          <path fill="#C8E6C9" d="M40 13H30V3z"/>
          <path fill="#2E7D32" d="M30 13l10 10V13z"/>
          <path fill="#FFF" d="M15 23h18v2H15zm0 4h18v2H15zm0 4h12v2H15z"/>
        </svg>
      ),
    },
    {
      name: 'EasySell',
      price: '~12 000 FCFA',
      color: '#f59e0b',
      icon: (
        <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
          <rect width="32" height="32" rx="8" fill="#F59E0B"/>
          <path d="M10 16l4 4 8-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 10h16M8 22h10" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
        </svg>
      ),
    },
    {
      name: 'Meta Ads',
      price: '~300 000 FCFA',
      color: '#1877f2',
      icon: (
        <svg viewBox="0 0 32 32" className="w-8 h-8">
          <path fill="#1877F2" d="M32 16C32 7.163 24.837 0 16 0S0 7.163 0 16c0 7.986 5.851 14.604 13.5 15.806V20.625H9.438V16H13.5v-3.547c0-4.01 2.389-6.225 6.044-6.225 1.751 0 3.581.313 3.581.313v3.938h-2.018c-1.987 0-2.607 1.233-2.607 2.498V16h4.438l-.709 4.625H18.5v11.181C26.149 30.604 32 23.986 32 16z"/>
          <path fill="#FFF" d="M22.229 20.625L22.938 16H18.5v-2.983c0-1.265.62-2.498 2.607-2.498h2.018V6.54s-1.83-.312-3.58-.312c-3.655 0-6.045 2.215-6.045 6.225V16H9.438v4.625H13.5v11.181a16.12 16.12 0 005 0V20.625h3.729z"/>
        </svg>
      ),
    },

  ];

  return (
    <div className="overflow-x-hidden" style={{ background: '#f8fafc', color: '#111827', fontFamily: 'inherit', minHeight: '100vh' }}>

      {/* ══ NAVBAR — floating pill ══ */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-3">
        {/* Pill container */}
        <div className="w-full max-w-5xl transition-all duration-300"
          style={{
            background: 'rgba(245,245,244,0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '999px',
            boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
          }}>
          <nav className="flex items-center justify-between px-4 sm:px-5 h-[52px] gap-3">

            {/* Logo */}
            <button onClick={() => navigate('/')} className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo.png" alt="Scalor" className="h-7 object-contain" />
            </button>

            {/* Nav centrale */}
            <div className="hidden md:flex items-center gap-0 flex-1 justify-center">
              {[
                { label: 'Fonctionnalités', href: '#features' },
                { label: 'Agent IA', href: '#agent-ia' },
                { label: 'Comment ça marche', href: '#how-it-works' },
                { label: 'Boutique IA', href: '#boutique-ia' },
                { label: 'Formation', href: '#formation' },
                { label: 'Tarifs', onClick: () => navigate('/ecom/tarifs') },
              ].map((l, i) =>
                l.onClick
                  ? <button key={i} onClick={l.onClick} className="px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors" style={{ color: '#374151' }}
                      onMouseEnter={e => { e.target.style.background='rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.target.style.background='transparent'; }}>
                      {l.label}
                    </button>
                  : <a key={i} href={l.href} className="px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors" style={{ color: '#374151' }}
                      onMouseEnter={e => { e.target.style.background='rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.target.style.background='transparent'; }}>
                      {l.label}
                    </a>
              )}
            </div>

            {/* Droite */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => navigate('/ecom/login')} className="hidden md:block px-3 py-1.5 text-[13px] font-medium rounded-full transition-colors" style={{ color: '#374151' }}
                onMouseEnter={e => e.target.style.background='rgba(0,0,0,0.06)'}
                onMouseLeave={e => e.target.style.background='transparent'}>
                Connexion
              </button>
              <button onClick={() => navigate('/ecom/register')} className="hidden md:flex items-center gap-2 pl-2.5 pr-4 py-1.5 text-[13px] font-bold text-white rounded-full transition-all active:scale-[0.97]"
                style={{ background: '#111', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                onMouseEnter={e => e.currentTarget.style.background='#222'}
                onMouseLeave={e => e.currentTarget.style.background='#111'}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#05976D' }}>
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </span>
                Commencer Scalor
              </button>

              {/* Mobile burger */}
              <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-1.5 rounded-full transition" style={{ color: '#374151' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(0,0,0,0.06)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenu ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
                </svg>
              </button>
            </div>
          </nav>
        </div>

        {/* Mobile menu — drop sous la pill */}
        {mobileMenu && (
          <div className="absolute top-[68px] left-4 right-4 rounded-2xl overflow-hidden shadow-xl" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="px-3 py-3 space-y-0.5">
              <a href="#features" onClick={() => setMobileMenu(false)} className="block px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Fonctionnalités</a>
              <a href="#agent-ia" onClick={() => setMobileMenu(false)} className="block px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Agent IA</a>
              <a href="#how-it-works" onClick={() => setMobileMenu(false)} className="block px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Comment ça marche</a>
              <a href="#boutique-ia" onClick={() => setMobileMenu(false)} className="block px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Boutique IA</a>
              <a href="#formation" onClick={() => setMobileMenu(false)} className="block px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Formation</a>
              <button onClick={() => { navigate('/ecom/tarifs'); setMobileMenu(false); }} className="block w-full text-left px-4 py-2.5 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50">Tarifs</button>
            </div>
            <div className="px-3 pb-3 flex flex-col gap-2" style={{ borderTop: '1px solid #f3f4f6' }}>
              <button onClick={() => navigate('/ecom/login')} className="w-full py-2.5 text-sm font-medium rounded-full text-gray-700 mt-2" style={{ background: '#f3f4f6' }}>Connexion</button>
              <button onClick={() => navigate('/ecom/register')} className="w-full py-2.5 text-sm font-bold text-white rounded-full" style={{ background: '#111' }}>Commencer Scalor</button>
            </div>
          </div>
        )}
      </header>

      {/* ══ HERO ══ */}
      <section className="relative flex flex-col items-center justify-center pt-[80px] overflow-hidden" style={{ background: '#fff' }}>
        {/* Dot grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45 }} />
        {/* Soft green radial glow center */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(5,151,109,0.13) 0%, transparent 65%)' }} />
        {/* Green glow top-left */}
        <div className="absolute pointer-events-none" style={{ top: '-100px', left: '-80px', width: '550px', height: '550px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,151,109,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        {/* Green glow top-right */}
        <div className="absolute pointer-events-none" style={{ top: '-60px', right: '-80px', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,151,109,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        {/* Green glow bottom-left */}
        <div className="absolute pointer-events-none" style={{ bottom: '-40px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,151,109,0.10) 0%, transparent 65%)', filter: 'blur(50px)' }} />
        {/* Green glow bottom-right */}
        <div className="absolute pointer-events-none" style={{ bottom: '-40px', right: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,151,109,0.15) 0%, transparent 65%)', filter: 'blur(55px)' }} />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center z-10 pt-10 sm:pt-14">
          {/* Badge pill */}
          <Reveal>
            <a href="https://chat.whatsapp.com/IH3nEvfeEWrHiAnocwZTwz?mode=gi_t" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-[13px] font-semibold mb-6 sm:mb-8 transition-all hover:scale-[1.03] max-w-full"
              style={{ background: '#f4f4f4', border: '1px solid #e0e0e0', color: '#05976D', textDecoration: 'none' }}>
              <svg viewBox="0 0 32 32" className="w-4 h-4 flex-shrink-0" style={{ fill: '#25d366' }}><path d="M16 0C7.163 0 0 7.163 0 16c0 2.824.737 5.474 2.028 7.776L0 32l8.456-2.012A15.93 15.93 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/><path fill="#fff" d="M23.3 20.7c-.3-.7-1.8-1.4-2.5-1.6-.6-.2-1.1-.1-1.5.2l-.9 1c-.2.2-.5.3-.8.1-1-.5-3.1-2.1-4.3-4.1-.2-.3-.1-.6.1-.8l.7-.9c.3-.4.4-.8.2-1.3L13 11c-.3-.7-.7-1.2-1.3-1.2h-.1c-.7 0-1.5.3-2 .8-.8.9-1 2.1-.6 3.4.6 2.1 2.1 5 5.4 7.3 2.4 1.7 5 2.4 7 1.6.7-.3 1.6-.9 2-1.9.3-.7.2-1.8-.1-2.3z"/></svg>
              Rejoindre +1 000 e-commerçants dans notre groupe
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" style={{ color: '#05976D' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </a>
          </Reveal>

          {/* Main heading */}
          <Reveal delay={80}>
            <h1 className="text-[2rem] sm:text-5xl lg:text-[4.2rem] font-black tracking-tight leading-[1.1] mb-5 sm:mb-6 text-gray-900">
              Le système qui <span style={{ color: '#05976D' }}>multiplie</span><br />
              vos ventes en Afrique
            </h1>
          </Reveal>

          {/* Subtitle */}
          <Reveal delay={140}>
            <p className="text-sm sm:text-lg leading-relaxed mb-8 sm:mb-10 max-w-2xl mx-auto text-gray-500">
              Récupérez vos paniers abandonnés, automatisez vos relances WhatsApp et pilotez toutes vos ventes depuis <span className="font-semibold text-gray-700">un seul tableau de bord</span>.
            </p>
          </Reveal>

          {/* CTA buttons */}
          <Reveal delay={200}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
              <button onClick={() => navigate('/ecom/register')}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 text-white font-bold text-[15px] rounded-xl transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', boxShadow: '0 6px 24px rgba(0,61,50,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}
                onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                Commencer gratuitement
              </button>
              <button onClick={() => document.getElementById('formation')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 font-semibold text-[15px] rounded-xl transition-all text-gray-700"
                style={{ background: '#fff', border: '1px solid #e5e7eb' }}
                onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                Formation
              </button>
            </div>
          </Reveal>

          {/* Social proof */}
          <Reveal delay={240}>
            <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs sm:text-sm flex-wrap text-gray-400">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                <span>5/5 satisfaction</span>
              </div>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>1 000+ vendeurs actifs</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span>15 000+ commandes traitées</span>
            </div>
          </Reveal>
        </div>

        {/* Dashboard preview */}
        <div id="dashboard-preview" className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12">
          <Reveal delay={300}>
            <div className="relative rounded-t-2xl overflow-hidden"
              style={{ border: '1px solid #e5e7eb', boxShadow: '0 20px 80px rgba(0,0,0,0.10)' }}>
              <div className="flex items-center gap-1.5 px-4 py-3" style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                <span className="w-3 h-3 rounded-full" style={{ background: '#ef4444', opacity: 0.7 }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#f59e0b', opacity: 0.7 }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#05976D', opacity: 0.7 }} />
                <div className="ml-4 flex-1 h-6 rounded-md flex items-center px-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                  <span className="text-[11px] text-gray-400">app.scalor.pro/dashboard</span>
                </div>
              </div>
              <video autoPlay loop muted playsInline preload="auto" className="w-full block">
                <source src="https://pub-82e66386f67141d6b9e8d7ce71fc30cc.r2.dev/pp.mov" type="video/mp4" />
              </video>
            </div>
            <div className="h-28 -mt-28 relative z-10" style={{ background: 'linear-gradient(to bottom, transparent, #fff)' }} />
          </Reveal>
        </div>
      </section>

      {/* ══ LOGOS BAND ══ */}
      <section className="py-14 sm:py-20 overflow-hidden" style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
        <style>{`
          @keyframes ticker {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track { animation: ticker 22s linear infinite; }
          .ticker-track:hover { animation-play-state: paused; }
        `}</style>
        <div className="max-w-4xl mx-auto px-4 text-center mb-10">
          <Reveal>
            <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-2">
              Vous dépensez beaucoup d'argent sur ces outils…
            </h3>
          </Reveal>
        </div>

        {/* Ticker défilant */}
        <div className="relative w-full" style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)' }}>
          <div className="flex ticker-track" style={{ width: 'max-content' }}>
            {[...integrations, ...integrations].map((item, i) => (
              <div key={i} className="flex items-center gap-2 mx-2 px-3 py-2.5 rounded-xl flex-shrink-0"
                style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <span className="flex-shrink-0 opacity-40" style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                </span>
                <span className="text-sm font-semibold line-through" style={{ color: '#9ca3af' }}>{item.name}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fef2f2', color: '#dc2626' }}>{item.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Comparaison finale */}
        <div className="max-w-3xl mx-auto px-4 mt-12">
          <Reveal delay={100}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Colonne outils */}
              <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-3 sm:gap-4" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <svg className="w-5 h-5" fill="none" stroke="#dc2626" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 mb-1">Outils séparés</p>
                  <p className="text-xs text-gray-400 leading-relaxed">Shopify · WhatsApp · Meta Ads · Klaviyo · Loox…</p>
                </div>
                <div className="mt-auto">
                  <p className="text-3xl font-black" style={{ color: '#dc2626' }}>~414 000</p>
                  <p className="text-xs text-gray-400">FCFA / mois</p>
                </div>
              </div>

              {/* Colonne Scalor */}
              <div className="rounded-2xl p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #f4f4f4, #ebebeb)', border: '1px solid #e0e0e0' }}>
                <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
                <div>
                  <p className="text-sm font-bold text-gray-800 mb-1">Scalor — tout en un</p>
                  <p className="text-xs text-gray-500 leading-relaxed">Commandes · WhatsApp · IA · Analytics · Boutique</p>
                </div>
                <div className="mt-auto">
                  <p className="text-3xl font-black" style={{ color: '#05976D' }}>0 FCFA</p>
                  <p className="text-xs text-gray-500">pour commencer</p>
                </div>
              </div>
            </div>

          </Reveal>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section className="py-20 sm:py-28" style={{ background: '#fff' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4 text-gray-900">
                Des chiffres qui parlent
              </h2>
              <p className="text-base sm:text-lg max-w-lg mx-auto text-gray-500">
                Des vendeurs africains qui scalent leur business avec Scalor chaque jour.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: '1px solid #e5e7eb' }}>
              <img src="/img/stats-banner.png" alt="Des Africains passent à l'action avec Scalor" className="w-full block" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section id="features" className="py-20 sm:py-28" style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-gray-900">
                Tout ce dont vous avez besoin<br className="hidden sm:block" />
                <span className="text-gray-400"> pour vendre en Afrique</span>
              </h2>
              <p className="text-base sm:text-lg max-w-lg mx-auto text-gray-500">
                Pas de fonctions gadgets. Juste ce qui compte pour vendre en COD.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 55}>
                <div className="group p-6 rounded-2xl h-full transition-all duration-300 cursor-default bg-white"
                  style={{ border: '1px solid #e5e7eb' }}
                  onMouseEnter={e => { e.currentTarget.style.border='1px solid #e0e0e0'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,61,50,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.border='1px solid #e5e7eb'; e.currentTarget.style.boxShadow='none'; }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f4f4f4', border: '1px solid #e0e0e0', color: '#05976D' }}>
                      {f.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#9ca3af' }}>{f.tag}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI AGENT SECTION ══ */}
      <section id="agent-ia" className="py-20 sm:py-28 relative overflow-hidden" style={{ borderTop: '1px solid #e5e7eb', background: '#fff' }}>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(34,197,94,0.05) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Chat mock — reste dark pour le réalisme UI */}
            <Reveal>
              <div className="relative">
                <div className="rounded-2xl overflow-hidden p-5" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
                  <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg, #05976D, #0d9488)' }}>R</div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-700 rounded-full" style={{ border: '2px solid #111' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Rita — Agent IA</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>En ligne</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { from: 'user', text: 'Salut, où en est ma commande ?' },
                      { from: 'agent', text: 'Bonjour ! 👋 Votre commande #2847 a été expédiée hier et arrivera demain entre 14h-16h. Je vous envoie le lien de suivi !' },
                      { from: 'user', text: 'Super merci ! Vous avez d\'autres coloris ?' },
                      { from: 'agent', text: 'Oui ! 🎨 Ce produit existe en 5 coloris. Je vous envoie le catalogue directement sur WhatsApp — voulez-vous profiter de -15% pour votre prochain achat ?' },
                    ].map((msg, i) => (
                      <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm"
                          style={msg.from === 'user'
                            ? { background: '#05976D', color: '#fff', borderBottomRightRadius: 4 }
                            : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderBottomLeftRadius: 4 }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex-1 h-10 rounded-xl px-4 flex items-center text-sm" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.25)' }}>
                        Écrivez un message…
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#05976D' }}>
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
            {/* Text */}
            <Reveal delay={100}>
              <div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-5 text-gray-900">
                  Votre Agent IA WhatsApp,<br />
                  <span className="text-gray-400">disponible 24h/24</span>
                </h2>
                <p className="text-base sm:text-lg mb-8 leading-relaxed text-gray-500">
                  Laissez Rita gérer 80% des questions clients sur WhatsApp pendant que vous vous concentrez sur la croissance. Rapide, intelligent, toujours disponible.
                </p>
                <div className="space-y-4 mb-8">
                  {[
                    'Support client 24/7 automatisé',
                    'Recommandations produits personnalisées',
                    'Récupération de paniers abandonnés',
                    'Compréhension du langage naturel en français',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#f4f4f4', border: '1px solid #e0e0e0' }}>
                        <svg className="w-3 h-3" fill="none" stroke="#05976D" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/ecom/register')}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', boxShadow: '0 4px 20px rgba(0,61,50,0.25)' }}
                  onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}
                  onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}>
                  Commencer gratuitement
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ BOUTIQUE IA ══ */}
      <section id="boutique-ia" className="py-20 sm:py-28 relative overflow-hidden" style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(34,197,94,0.06) 0%, transparent 65%)' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Texte — gauche */}
            <Reveal>
              <div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-5 text-gray-900">
                  Créez votre boutique IA<br />
                  <span style={{ background: 'linear-gradient(135deg, #05976D 0%, #05976D 60%, #05976D 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    sur Scalor
                  </span>
                </h2>
                <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8">
                  Décrivez votre produit, l'IA génère votre boutique complète en quelques secondes — page produit, photos, descriptions et tunnel de vente inclus.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    { num: '01', title: 'Décrivez votre produit', desc: "Dites à l'IA ce que vous vendez en quelques mots." },
                    { num: '02', title: "L'IA construit tout", desc: "Page produit, visuels, textes de vente et formulaire COD générés." },
                    { num: '03', title: 'Lancez & vendez', desc: "Partagez le lien, les commandes arrivent dans Scalor." },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5" style={{ background: '#f4f4f4', border: '1px solid #e0e0e0', color: '#05976D' }}>{s.num}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{s.title}</p>
                        <p className="text-sm text-gray-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => navigate('/ecom/register')}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-white font-bold text-[15px] rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', boxShadow: '0 8px 32px rgba(0,61,50,0.3)' }}
                  onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}
                  onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Créer ma boutique IA gratuitement
                </button>
                <p className="mt-3 text-sm text-gray-400">Aucune carte bancaire · Prêt en moins de 2 minutes</p>
              </div>
            </Reveal>

            {/* Vidéo — droite */}
            <Reveal delay={100}>
              <div className="relative flex items-center justify-center">
                <div className="relative rounded-2xl overflow-hidden w-full"
                  style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb' }}>
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="w-full block"
                    style={{ borderRadius: '16px', minHeight: 'clamp(300px, 60vw, 600px)', maxHeight: '1100px', objectFit: 'cover' }}
                  >
                    <source src="https://pub-82e66386f67141d6b9e8d7ce71fc30cc.r2.dev/motion.mov" type="video/mp4" />
                  </video>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ══ INTÉGRATIONS ══ */}
      <section id="integrations" className="py-20 sm:py-28" style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Connectez vos outils à Scalor
              </h2>
              <p className="text-base text-gray-500 max-w-lg mx-auto">
                Tous vos outils préférés, synchronisés en un seul endroit.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { name: 'Shopify', icon: integrations.find(x => x.name === 'Shopify')?.icon },
              { name: 'WooCommerce', icon: integrations.find(x => x.name === 'WooCommerce')?.icon },
              { name: 'WhatsApp', icon: integrations.find(x => x.name === 'WhatsApp')?.icon },
              { name: 'Meta Ads', icon: integrations.find(x => x.name === 'Meta Ads')?.icon },
              { name: 'Google Sheets', icon: integrations.find(x => x.name === 'Google Sheets')?.icon },
              { name: 'EasySell', icon: integrations.find(x => x.name === 'EasySell')?.icon },
              {
                name: 'Loox',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                    <rect width="32" height="32" rx="8" fill="#FF5733"/>
                    <circle cx="16" cy="14" r="5" fill="#fff"/>
                    <path d="M9 24c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M16 11l.6 1.8h1.9l-1.5 1.1.6 1.8L16 14.6l-1.6 1.1.6-1.8-1.5-1.1h1.9z" fill="#FF5733"/>
                  </svg>
                ),
              },
              {
                name: 'Klaviyo',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                    <rect width="32" height="32" rx="8" fill="#1A1A1A"/>
                    <path d="M9 8h4v10l6-10h4l-6 9.5 6.5 6.5H19l-6-6V24H9V8z" fill="#fff"/>
                  </svg>
                ),
              },
              {
                name: 'Mailchimp',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                    <rect width="32" height="32" rx="8" fill="#FFE01B"/>
                    <path d="M22.5 17.5c.3-.6.5-1.3.5-2 0-3-2.7-5.5-6-5.5s-6 2.5-6 5.5c0 .7.1 1.4.4 2-.3.3-.4.7-.4 1 0 1.1.9 2 2 2 .4 0 .8-.1 1.1-.3.8.4 1.8.6 2.9.6s2.1-.2 2.9-.6c.3.2.7.3 1.1.3 1.1 0 2-.9 2-2 0-.4-.1-.7-.5-1z" fill="#241C15"/>
                    <circle cx="13.5" cy="16" r="1" fill="#FFE01B"/>
                    <circle cx="18.5" cy="16" r="1" fill="#FFE01B"/>
                  </svg>
                ),
              },
              {
                name: 'TikTok',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8">
                    <rect width="32" height="32" rx="8" fill="#010101"/>
                    <path fill="#FFF" d="M21.5 6h-3.3v13.5c0 1.5-1.2 2.8-2.7 2.8s-2.7-1.2-2.7-2.8 1.2-2.8 2.7-2.8c.3 0 .5 0 .8.1v-3.4c-.3 0-.5-.1-.8-.1-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6V12.3c1.1.8 2.5 1.3 4 1.3v-3.3c-2.2 0-4-1.9-4-4.3z"/>
                  </svg>
                ),
              },
              {
                name: 'Google Ads',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                    <rect width="32" height="32" rx="8" fill="#fff" stroke="#e5e7eb"/>
                    <path d="M7 22l5.5-9.5 3.5 6L19 13l6 9H7z" fill="none"/>
                    <circle cx="8.5" cy="22" r="3" fill="#FBBC04"/>
                    <circle cx="23.5" cy="22" r="3" fill="#34A853"/>
                    <path d="M8.5 22L16 9l7.5 13" stroke="#4285F4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                ),
              },
              {
                name: 'Notion',
                icon: (
                  <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
                    <rect width="32" height="32" rx="8" fill="#fff" stroke="#e5e7eb"/>
                    <path d="M10 8h8l6 6v12H10V8z" fill="#1A1A1A" opacity=".08"/>
                    <path d="M10 8h8l6 6v12H10V8z" stroke="#1A1A1A" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M18 8v6h6" stroke="#1A1A1A" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M13 16h8M13 19h6M13 22h4" stroke="#1A1A1A" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                ),
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="flex flex-col items-center justify-center gap-2.5 py-5 px-3 rounded-2xl transition-all cursor-default bg-white"
                  style={{ border: '1px solid #e5e7eb' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#e0e0e0'; e.currentTarget.style.boxShadow='0 4px 20px rgba(0,61,50,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none'; }}>
                  {item.icon}
                  <span className="text-xs font-semibold text-gray-700 text-center">{item.name}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FORMATION ══ */}
      <section id="formation" className="py-20 sm:py-28" style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">

          {/* Header */}
          <Reveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-3 text-gray-900">
                Maîtrisez Scalor <span style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>en 16 leçons</span>
              </h2>
              <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto">
                Un module complet offert — de la prise en main jusqu'à l'agent IA.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 items-start">

            {/* Liste des leçons */}
            <Reveal>
              <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                {/* Header module */}
                <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', borderBottom: '1px solid #e5e7eb' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm text-white flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>7</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Module 7 · 16 leçons</p>
                    <p className="text-sm font-bold text-white">Prise en main de Scalor</p>
                  </div>
                  {/* Progress bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>0 / 16</span>
                    <div className="w-24 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                      <div className="h-full rounded-full w-0" style={{ background: '#fff' }} />
                    </div>
                  </div>
                </div>

                {/* Lessons — 2 colonnes */}
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {[
                    { n: '7.1', t: 'Introduction à Scalor' },
                    { n: '7.2', t: 'Connecter sa boutique à Scalor' },
                    { n: '7.3', t: 'Paramétrer sa boutique Scalor' },
                    { n: '7.4', t: 'Les fonctionnalités sur Scalor' },
                    { n: '7.5', t: 'Créer sa boutique sur Scalor' },
                    { n: '7.6', t: 'Page produit — Méthode 1' },
                    { n: '7.7', t: 'Formulaire & upsell' },
                    { n: '7.8', t: 'Automatiser son WhatsApp' },
                    { n: '7.9', t: 'Gérer les commandes Scalor' },
                    { n: '7.10', t: "Gestion d'équipe" },
                    { n: '7.11', t: 'Gérer les rapports' },
                    { n: '7.12', t: 'Se fixer des objectifs' },
                    { n: '7.13', t: 'Gestion des finances' },
                    { n: '7.14', t: 'Gestion de Stock' },
                    { n: '7.15', t: 'Relancer les clients auto.' },
                    { n: '7.16', t: 'Configurer son agent IA ✦' },
                  ].map((l, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 transition-colors"
                      style={{ borderBottom: i < 14 ? '1px solid #f3f4f6' : 'none' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center" style={{ border: '1.5px solid #e5e7eb' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="#d1d5db" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold mr-1.5" style={{ color: '#05976D' }}>{l.n}</span>
                        <span className="text-sm" style={{ color: l.n === '7.16' ? '#05976D' : '#374151', fontWeight: l.n === '7.16' ? 600 : 400 }}>{l.t}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Panneau droite */}
            <Reveal delay={100}>
              <div className="lg:sticky lg:top-24 space-y-4">
                <img
                  src="/img/formation-offerte.png"
                  alt="Formation offerte — Valeur ~49 000 FCFA — Incluse gratuitement dans votre compte Scalor"
                  className="w-full rounded-2xl"
                  style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10)' }}
                />
                <button onClick={() => navigate('/ecom/formation')}
                  className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 font-bold text-white rounded-xl transition-all active:scale-[0.97] text-sm"
                  style={{ background: 'linear-gradient(135deg, #05976D, #04795a)', boxShadow: '0 8px 24px rgba(0,61,50,0.35)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Accéder gratuitement
                </button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ DISPONIBLE EN AFRIQUE ══ */}
      <section className="py-20 sm:py-28" style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-3">
                Disponible partout <span style={{ color: '#05976D' }}>en Afrique</span>
              </h2>
              <p className="text-base text-gray-500 max-w-xl mx-auto">
                Scalor est conçu pour les marchés africains — paiement à la livraison, WhatsApp, et logistique locale.
              </p>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {[
                { flag: '🇨🇮', name: "Côte d'Ivoire" },
                { flag: '🇸🇳', name: 'Sénégal' },
                { flag: '🇲🇱', name: 'Mali' },
                { flag: '🇧🇫', name: 'Burkina Faso' },
                { flag: '🇧🇯', name: 'Bénin' },
                { flag: '🇹🇬', name: 'Togo' },
                { flag: '🇬🇳', name: 'Guinée' },
                { flag: '🇨🇲', name: 'Cameroun' },
                { flag: '🇬🇦', name: 'Gabon' },
                { flag: '🇨🇬', name: 'Congo' },
                { flag: '🇨🇩', name: 'RD Congo' },
                { flag: '🇲🇦', name: 'Maroc' },
                { flag: '🇩🇿', name: 'Algérie' },
                { flag: '🇹🇳', name: 'Tunisie' },
                { flag: '🇬🇭', name: 'Ghana' },
                { flag: '🇳🇬', name: 'Nigeria' },
                { flag: '🇰🇪', name: 'Kenya' },
                { flag: '🇹🇿', name: 'Tanzanie' },
              ].map((c) => (
                <div
                  key={c.name}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm transition-all"
                >
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>{c.flag}</span>
                  <span className="text-xs font-medium text-gray-600 text-center leading-tight">{c.name}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="mt-10 text-center">
              <p className="text-xs text-gray-400">Et bien d'autres pays en cours d'intégration…</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ VIDEO ══ */}
      <section data-tutorial-section className="py-20 sm:py-28" style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Prenez Scalor en main en{' '}
                <span style={{ color: '#ef4444' }}>15 minutes</span>
              </h2>
              <p className="text-base sm:text-lg max-w-2xl mx-auto text-gray-500">
                Du premier produit à l'envoi de campagnes WhatsApp — cette vidéo couvre tout.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-2xl overflow-hidden mb-8" style={{ border: '1px solid #e5e7eb', boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
              <div className="relative aspect-video bg-gray-100">
                <iframe src="https://www.youtube.com/embed/405eKEysE0Q?rel=0&modestbranding=1&playsinline=1" title="Tutoriel Complet Scalor"
                  className="w-full h-full" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
            </div>
          </Reveal>
          <Reveal delay={140}>
            <div className="text-center">
              <a href="https://youtu.be/405eKEysE0Q" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition"
                style={{ background: '#ef4444', color: '#fff', boxShadow: '0 4px 16px rgba(239,68,68,0.25)' }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Regarder sur YouTube
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ TÉMOIGNAGES ══ */}
      <section className="py-20 sm:py-28 overflow-hidden" style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <style>{`
          @keyframes scroll-left  { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          @keyframes scroll-right { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
          .testi-left  { animation: scroll-left  28s linear infinite; }
          .testi-right { animation: scroll-right 28s linear infinite; }
          .testi-left:hover, .testi-right:hover { animation-play-state: paused; }
        `}</style>

        <Reveal>
          <div className="text-center mb-14 px-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-gray-900 mb-4">Ils ont choisi Scalor</h2>
            <p className="text-base sm:text-lg text-gray-500 max-w-lg mx-auto">Découvrez les avis de ceux qui utilisent Scalor au quotidien.</p>
          </div>
        </Reveal>

        {(() => {
          const allTestis = [
            { text: "Scalor a transformé ma gestion des commandes COD. L'interface est claire et simple. Je me concentre enfin sur la vente.", name: 'Fatima B.', role: "E-commerçante, Côte d'Ivoire", initials: 'FB', color: '#fbbf24' },
            { text: "Mes closers gèrent leurs commandes sans me déranger. Chacun a son accès, c'est parfait. Je recommande à 100%.", name: 'Aicha M.', role: 'Dropshippeuse, Sénégal', initials: 'AM', color: '#f472b6' },
            { text: "Mon taux de livraison a augmenté depuis que je track tout sur Scalor. Les stats ne mentent pas.", name: 'Ibrahima N.', role: 'Vendeur COD, Mali', initials: 'IN', color: '#60a5fa' },
            { text: "Scalor IA m'a fait gagner des heures sur mes fiches produits. Plus besoin de rédiger manuellement.", name: 'Moussa K.', role: 'Dropshipper, Cameroun', initials: 'MK', color: '#34d399' },
            { text: "Le support répond vite et comprend nos besoins. Ça change des autres plateformes.", name: 'Mariam T.', role: 'Boutique en ligne, Burkina', initials: 'MT', color: '#a78bfa' },
            { text: "Je gère mes 3 boutiques depuis un seul dashboard. C'est exactement ce dont j'avais besoin pour scaler.", name: 'Youssef A.', role: 'Multi-boutiques, Maroc', initials: 'YA', color: '#fb923c' },
            { text: "Les relances automatiques WhatsApp m'ont fait récupérer des commandes que j'aurais perdues. Incroyable.", name: 'Kofi D.', role: 'Vendeur COD, Ghana', initials: 'KD', color: '#05976D' },
            { text: "Avant Scalor je perdais 2h par jour sur des tâches manuelles. Maintenant tout est automatique.", name: 'Aminata S.', role: 'Dropshippeuse, Guinée', initials: 'AS', color: '#f87171' },
          ];
          const row1 = allTestis.slice(0, 4);
          const row2 = allTestis.slice(4);

          const Card = ({ t }) => (
            <div className="flex-shrink-0 w-[300px] sm:w-[340px] rounded-2xl p-5 mx-3" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, j) => (
                  <svg key={j} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background: t.color }}>{t.initials}</div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          );

          return (
            <div className="space-y-4">
              {/* Row 1 — scroll left */}
              <div className="flex overflow-hidden">
                <div className="flex testi-left" style={{ width: 'max-content' }}>
                  {[...row1, ...row1].map((t, i) => <Card key={i} t={t} />)}
                </div>
              </div>
              {/* Row 2 — scroll right */}
              <div className="flex overflow-hidden">
                <div className="flex testi-right" style={{ width: 'max-content' }}>
                  {[...row2, ...row2].map((t, i) => <Card key={i} t={t} />)}
                </div>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ══ FAQ ══ */}
      <section className="py-20 sm:py-28" style={{ background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900">Questions fréquentes</h2>
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
                <details className="group rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #e5e7eb' }}>
                  <summary className="flex items-center justify-between cursor-pointer px-5 sm:px-6 py-4 text-sm font-semibold text-gray-900 transition select-none hover:bg-gray-50">
                    {item.q}
                    <svg className="w-4 h-4 group-open:rotate-180 transition-transform flex-shrink-0 ml-3 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </summary>
                  <div className="px-5 sm:px-6 pb-4 text-sm leading-relaxed text-gray-500">{item.a}</div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══ */}
      <section className="py-20 sm:py-28 relative overflow-hidden" style={{ background: '#f4f4f4', borderTop: '1px solid #e0e0e0' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34,197,94,0.08) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-5 text-gray-900">
              Prêt à scaler<br />
              <span style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>votre e-commerce ?</span>
            </h2>
            <p className="text-base sm:text-xl mb-10 text-gray-500">
              Rejoignez 1 000+ vendeurs qui utilisent Scalor pour structurer et scaler leur business.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => navigate('/ecom/register')}
                className="flex items-center justify-center gap-2 px-8 py-4 text-white font-bold text-base rounded-xl transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #05976D, #05976D)', boxShadow: '0 8px 32px rgba(0,61,50,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}
                onMouseLeave={e => e.currentTarget.style.background='linear-gradient(135deg, #05976D, #05976D)'}>
                Commencer gratuitement
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
              </button>
              <button onClick={() => navigate('/ecom/login')}
                className="flex items-center justify-center gap-2 px-8 py-4 font-semibold text-base rounded-xl transition-all text-gray-700"
                style={{ background: '#fff', border: '1px solid #d1d5db' }}
                onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background='#fff'}>
                Se connecter
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="py-14 sm:py-16" style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 sm:gap-8 md:gap-10 mb-10 sm:mb-14">
            <div className="col-span-2 md:col-span-1">
              <button onClick={() => navigate('/')} className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="Scalor" className="h-8 object-contain" />
              </button>
              <p className="text-sm leading-relaxed max-w-[220px] text-gray-400">
                Le système d'exploitation du e-commerce africain.
              </p>
            </div>
            {[
              {
                title: 'PRODUIT',
                links: [
                  { label: 'Fonctionnalités', href: '#features' },
                  { label: 'Comment ça marche', href: '#how-it-works' },
                  { label: 'Tarifs', onClick: () => navigate('/ecom/tarifs') },
                  { label: 'Agent IA', href: '#features' },
                ],
              },
              {
                title: 'BOUTIQUE IA',
                links: [
                  { label: 'Créer ma boutique', href: '#boutique-ia' },
                  { label: 'Page produit IA', href: '#boutique-ia' },
                  { label: 'Commandes COD', href: '#boutique-ia' },
                  { label: 'Relances WhatsApp', href: '#boutique-ia' },
                ],
              },
              {
                title: 'RESSOURCES',
                links: [
                  { label: 'Support', href: 'mailto:contact@safitech.shop' },
                  { label: 'Contact', href: 'mailto:contact@safitech.shop' },
                ],
              },
              {
                title: 'LÉGAL',
                links: [
                  { label: 'Confidentialité', onClick: () => navigate('/ecom/privacy') },
                  { label: 'Conditions', onClick: () => navigate('/ecom/terms') },
                ],
              },
            ].map((col, ci) => (
              <div key={ci}>
                <h4 className="text-[10px] font-bold uppercase tracking-[2.5px] mb-5 text-gray-400">{col.title}</h4>
                <div className="space-y-3">
                  {col.links.map((link, li) => (
                    link.onClick
                      ? <button key={li} onClick={link.onClick} className="block text-sm transition text-left text-gray-500 hover:text-gray-900">{link.label}</button>
                      : <a key={li} href={link.href} className="block text-sm transition text-gray-500 hover:text-gray-900">{link.label}</a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: '1px solid #e5e7eb' }}>
            <span className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} SCALOR by Safitech. Tous droits réservés.
            </span>
          </div>
        </div>
      </footer>

      <SupportChat />
    </div>
  );
};

export default LandingPage;
