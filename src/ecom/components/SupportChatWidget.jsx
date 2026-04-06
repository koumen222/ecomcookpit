import React, { useState, useEffect, useRef, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';

const fmtTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// Notification sound using Web Audio API
const playNotifSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* silent fallback */ }
};

const SupportChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null); // sessionId of current ticket
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [step, setStep] = useState('form'); // 'form' | 'chat'
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const prevUnreadRef = useRef(0);

  // Check for existing open tickets on mount
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await ecomApi.get('/support/my-tickets');
        const tickets = res.data.data.tickets || [];
        const openTicket = tickets.find(t => t.status !== 'closed');
        if (openTicket) {
          setActiveTicket(openTicket.sessionId);
          setStep('chat');
          const totalUnread = tickets.reduce((sum, t) => sum + (t.unreadUser || 0), 0);
          setUnread(totalUnread);
        }
      } catch { /* silent */ }
    };
    checkExisting();
  }, []);

  // Load messages when ticket is active and chat is open
  const loadMessages = useCallback(async () => {
    if (!activeTicket) return;
    setLoading(true);
    try {
      const res = await ecomApi.get(`/support/my-tickets/${activeTicket}`);
      const conv = res.data.data.conversation;
      const newMsgs = conv.messages || [];
      // Play sound if new agent message arrived
      setMessages(prev => {
        const prevAgentCount = prev.filter(m => m.from === 'agent').length;
        const newAgentCount = newMsgs.filter(m => m.from === 'agent').length;
        if (newAgentCount > prevAgentCount && prevAgentCount > 0) {
          playNotifSound();
        }
        return newMsgs;
      });
      setUnread(0);
    } catch { /* silent */ }
    setLoading(false);
  }, [activeTicket]);

  useEffect(() => {
    if (open && activeTicket && step === 'chat') {
      loadMessages();
    }
  }, [open, activeTicket, step, loadMessages]);

  // Poll for new messages every 8s when open
  useEffect(() => {
    if (!open || !activeTicket || step !== 'chat') return;
    const t = setInterval(loadMessages, 8000);
    return () => clearInterval(t);
  }, [open, activeTicket, step, loadMessages]);

  // Poll unread count when closed + play sound on new unread
  useEffect(() => {
    if (open) return;
    const checkUnread = async () => {
      try {
        const res = await ecomApi.get('/support/my-tickets');
        const tickets = res.data.data.tickets || [];
        const totalUnread = tickets.reduce((sum, t) => sum + (t.unreadUser || 0), 0);
        if (totalUnread > prevUnreadRef.current) {
          playNotifSound();
        }
        prevUnreadRef.current = totalUnread;
        setUnread(totalUnread);
        const openTicket = tickets.find(t => t.status !== 'closed');
        if (openTicket && !activeTicket) {
          setActiveTicket(openTicket.sessionId);
          setStep('chat');
        }
      } catch { /* silent */ }
    };
    const t = setInterval(checkUnread, 15000);
    return () => clearInterval(t);
  }, [open, activeTicket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create ticket
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await ecomApi.post('/support/my-tickets', {
        subject: subject.trim() || 'Demande de support',
        category,
        text: text.trim(),
      });
      setActiveTicket(res.data.data.sessionId);
      setText('');
      setSubject('');
      setStep('chat');
    } catch { /* silent */ }
    setSending(false);
  };

  // Send reply
  const handleReply = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeTicket || sending) return;
    setSending(true);
    try {
      const res = await ecomApi.post(`/support/my-tickets/${activeTicket}/reply`, { text: text.trim() });
      setMessages(res.data.data.conversation.messages || []);
      setText('');
      inputRef.current?.focus();
    } catch { /* silent */ }
    setSending(false);
  };

  // Start new ticket (from chat view)
  const startNew = () => {
    setActiveTicket(null);
    setMessages([]);
    setSubject('');
    setCategory('general');
    setText('');
    setStep('form');
  };

  const toggleOpen = () => {
    setOpen(o => !o);
  };

  const categories = [
    { value: 'general', label: 'Général' },
    { value: 'bug', label: 'Bug / Problème' },
    { value: 'billing', label: 'Facturation' },
    { value: 'feature', label: 'Suggestion' },
    { value: 'account', label: 'Mon compte' },
    { value: 'other', label: 'Autre' },
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={toggleOpen}
        className="fixed bottom-20 lg:bottom-6 right-4 z-[60] w-14 h-14 bg-[#0F6B4F] hover:bg-[#0a5740] text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        aria-label="Support"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        )}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-22 right-4 z-[60] w-[340px] sm:w-[380px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">

          {/* Header */}
          <div className="bg-[#0F6B4F] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Support Scalor</h3>
              <p className="text-white/70 text-[11px]">Nous répondons rapidement</p>
            </div>
            {step === 'chat' && (
              <button onClick={startNew} className="text-white/70 hover:text-white text-[11px] font-medium px-2 py-1 rounded-lg hover:bg-white/10 transition-colors" title="Nouveau ticket">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            )}
          </div>

          {step === 'form' ? (
            /* ── New ticket form ── */
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="bg-emerald-50 rounded-xl p-3 mb-1">
                <p className="text-xs text-emerald-800 font-medium">Comment pouvons-nous vous aider ?</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Décrivez votre problème et nous vous répondrons au plus vite.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sujet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex: Problème de paiement..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {categories.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                        category === c.value 
                          ? 'bg-[#0F6B4F] text-white border-[#0F6B4F]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Détaillez votre problème ici..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-[10px] text-gray-400 text-right mt-0.5">{text.length}/2000</p>
              </div>

              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {sending ? 'Envoi...' : 'Envoyer ma demande'}
              </button>
            </form>
          ) : (
            /* ── Chat view ── */
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ minHeight: '200px', maxHeight: '45vh' }}>
                {loading && messages.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-emerald-200 border-t-[#0F6B4F] rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">Aucun message</div>
                ) : (
                  messages.map((m, i) => {
                    const isUser = m.from === 'visitor';
                    return (
                      <div key={m._id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          isUser
                            ? 'bg-[#0F6B4F] text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}>
                          {!isUser && (
                            <p className="text-[10px] font-semibold text-[#0F6B4F] mb-0.5">{m.agentName || 'Support'}</p>
                          )}
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
                          <p className={`text-[10px] mt-1 ${isUser ? 'text-emerald-200 text-right' : 'text-gray-400'}`}>
                            {fmtTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <form onSubmit={handleReply} className="px-3 py-2 border-t border-gray-100 flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e); } }}
                    placeholder="Votre message..."
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="w-9 h-9 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    {sending ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default SupportChatWidget;
