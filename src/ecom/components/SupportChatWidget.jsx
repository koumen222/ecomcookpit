import React, { useState, useEffect, useRef, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';
import { useSocket } from '../hooks/useSocket.js';
import { playNewOrderSound } from '../services/soundService.js';

const fmt = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const WORKFLOW_BADGE = {
  ai:            { label: 'Répondu par IA',        cls: 'bg-sky-100 text-sky-700' },
  pending_admin: { label: 'En attente de l\'admin', cls: 'bg-amber-100 text-amber-700' },
  resolved:      { label: 'Résolu',                 cls: 'bg-emerald-100 text-emerald-700' },
};

const CATEGORIES = [
  { value: 'general',  label: 'Général' },
  { value: 'bug',      label: 'Bug' },
  { value: 'billing',  label: 'Facturation' },
  { value: 'feature',  label: 'Suggestion' },
  { value: 'account',  label: 'Compte' },
  { value: 'other',    label: 'Autre' },
];

const SupportChatWidget = () => {
  const [open, setOpen]               = useState(false);
  const [view, setView]               = useState('list'); // 'list' | 'new' | 'chat'
  const [tickets, setTickets]         = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [text, setText]               = useState('');
  const [subject, setSubject]         = useState('');
  const [category, setCategory]       = useState('general');
  const [sending, setSending]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [unread, setUnread]           = useState(0);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const prevUnreadRef  = useRef(0);
  const { isConnected, on, off, emit } = useSocket();

  const fetchTickets = useCallback(async () => {
    try {
      const res = await ecomApi.get('/support/my-tickets');
      const list = res.data.data.tickets || [];
      setTickets(list);
      const total = list.reduce((s, t) => s + (t.unreadUser || 0), 0);
      setUnread(total);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const loadConversation = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await ecomApi.get(`/support/my-tickets/${sessionId}`);
      setConversation(res.data.data.conversation);
      setActiveTicket(sessionId);
      setView('chat');
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // Auto-open last open ticket when widget opens
  useEffect(() => {
    if (!open) return;
    if (view === 'list' && tickets.length > 0 && !activeTicket) {
      const open = tickets.find(t => t.workflowStatus !== 'resolved') || tickets[0];
      if (open) { loadConversation(open.sessionId); }
    }
  }, [open]); // eslint-disable-line

  // Poll conversation
  useEffect(() => {
    if (!open || !activeTicket || view !== 'chat') return;
    const t = setInterval(() => loadConversation(activeTicket), 8000);
    return () => clearInterval(t);
  }, [open, activeTicket, view, loadConversation]);

  // Poll unread when closed
  useEffect(() => {
    if (open) return;
    const t = setInterval(async () => {
      try {
        const res = await ecomApi.get('/support/my-tickets');
        const list = res.data.data.tickets || [];
        const total = list.reduce((s, t) => s + (t.unreadUser || 0), 0);
        if (total > prevUnreadRef.current) playNewOrderSound();
        prevUnreadRef.current = total;
        setUnread(total);
        setTickets(list);
      } catch { /* silent */ }
    }, 15000);
    return () => clearInterval(t);
  }, [open]);

  // Socket
  useEffect(() => {
    if (!isConnected) return;
    const handler = (payload) => {
      if (!payload?.sessionId) return;
      fetchTickets();
      if (['ai_reply', 'admin_reply', 'admin_outbound'].includes(payload.eventType) && payload.lastMessage?.from === 'agent') {
        playNewOrderSound();
      }
      if (activeTicket === payload.sessionId) loadConversation(payload.sessionId);
    };
    on('support:updated', handler);
    return () => off('support:updated', handler);
  }, [isConnected, on, off, fetchTickets, loadConversation, activeTicket]);

  useEffect(() => {
    if (!activeTicket || !isConnected) return;
    emit('support:subscribe', { sessionId: activeTicket });
    return () => emit('support:unsubscribe', { sessionId: activeTicket });
  }, [activeTicket, isConnected, emit]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

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
      setConversation(res.data.data.conversation || null);
      setActiveTicket(res.data.data.sessionId);
      setText(''); setSubject(''); setCategory('general');
      setView('chat');
      fetchTickets();
    } catch { /* silent */ }
    setSending(false);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeTicket || sending) return;
    setSending(true);
    try {
      const res = await ecomApi.post(`/support/my-tickets/${activeTicket}/reply`, { text: text.trim() });
      setConversation(res.data.data.conversation || null);
      setText('');
      inputRef.current?.focus();
      fetchTickets();
    } catch { /* silent */ }
    setSending(false);
  };

  const openNew = () => { setActiveTicket(null); setConversation(null); setSubject(''); setCategory('general'); setText(''); setView('new'); };
  const goBack  = () => { setView(tickets.length > 0 ? 'list' : 'new'); };

  const wf = WORKFLOW_BADGE[conversation?.workflowStatus] || null;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 lg:bottom-6 right-4 z-[60] w-14 h-14 bg-[#0F6B4F] hover:bg-[#0a5740] text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      >
        {open
          ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        }
        {unread > 0 && !open && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-36 lg:bottom-[88px] right-4 z-[60] w-[340px] sm:w-[380px] max-h-[72vh] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-[#0F6B4F] px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Support Scalor</p>
              <p className="text-white/60 text-[11px]">{isConnected ? '● Temps réel actif' : 'Connexion...'}</p>
            </div>
            <div className="flex items-center gap-1">
              {view !== 'new' && (
                <button onClick={openNew} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition" title="Nouveau ticket">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              )}
              {(view === 'chat' || view === 'new') && tickets.length > 0 && (
                <button onClick={goBack} className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition" title="Mes tickets">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                </button>
              )}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Bienvenue dans le support</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Décrivez votre problème et nous vous répondrons rapidement.</p>
                  <button onClick={openNew} className="px-5 py-2 bg-[#0F6B4F] hover:bg-[#0a5740] text-white text-sm font-medium rounded-xl transition">
                    Créer un ticket
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tickets.map(t => {
                    const isOpen = t.workflowStatus !== 'resolved';
                    return (
                      <button key={t.sessionId} onClick={() => loadConversation(t.sessionId)}
                        className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${isOpen ? 'bg-amber-400' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-gray-900 truncate">{t.subject || 'Demande support'}</span>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{fmt(t.lastMessageAt)}</span>
                          </div>
                          {t.lastMessage && <p className="text-xs text-gray-500 truncate">{t.lastMessage}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isOpen ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                              {WORKFLOW_BADGE[t.workflowStatus]?.label || 'Ouvert'}
                            </span>
                            {(t.unreadUser || 0) > 0 && (
                              <span className="ml-auto bg-[#0F6B4F] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{t.unreadUser}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── NEW TICKET FORM ── */}
          {view === 'new' && (
            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <div className="bg-[#E6F2ED] rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-[#0F6B4F]">Comment pouvons-nous vous aider ?</p>
                <p className="text-[11px] text-[#2d7a5f] mt-0.5">Nous répondons en général dans la journée.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sujet</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex: Problème avec mon paiement…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none bg-gray-50 focus:bg-white transition"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catégorie</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map(c => (
                    <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                      className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                        category === c.value ? 'bg-[#0F6B4F] text-white border-[#0F6B4F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0F6B4F]/40'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Message <span className="text-red-500">*</span></label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Détaillez votre problème…"
                  rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none resize-none bg-gray-50 focus:bg-white transition"
                  maxLength={2000}
                  required
                />
                <p className="text-[10px] text-gray-400 text-right mt-0.5">{text.length}/2000</p>
              </div>

              <button type="submit" disabled={sending || !text.trim()}
                className="w-full py-2.5 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {sending ? 'Envoi en cours…' : 'Envoyer ma demande →'}
              </button>
            </form>
          )}

          {/* ── CHAT VIEW ── */}
          {view === 'chat' && (
            <>
              {/* Workflow badge */}
              {wf && (
                <div className={`mx-4 mt-3 px-3 py-1.5 rounded-xl text-[11px] font-semibold ${wf.cls}`}>
                  {wf.label}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ minHeight: 180 }}>
                {loading && !conversation?.messages?.length ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-6 h-6 border-2 border-[#0F6B4F]/20 border-t-[#0F6B4F] rounded-full animate-spin" />
                  </div>
                ) : !conversation?.messages?.length ? (
                  <p className="text-center text-xs text-gray-400 py-8">Aucun message</p>
                ) : (
                  conversation.messages.map((m, i) => {
                    const isUser = m.from === 'visitor';
                    return (
                      <div key={m._id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full bg-[#0F6B4F]/10 flex items-center justify-center mr-2 flex-shrink-0 self-end mb-1">
                            <svg className="w-3.5 h-3.5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                          </div>
                        )}
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
                          isUser
                            ? 'bg-[#0F6B4F] text-white rounded-br-sm'
                            : m.senderType === 'ai'
                              ? 'bg-sky-50 text-sky-900 border border-sky-100 rounded-bl-sm'
                              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}>
                          {!isUser && (
                            <p className="text-[10px] font-bold mb-0.5 opacity-60">{m.senderType === 'ai' ? 'Scalor IA' : (m.agentName || 'Support')}</p>
                          )}
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
                          <p className={`text-[10px] mt-1 text-right ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>{fmt(m.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              <form onSubmit={handleReply} className="px-3 py-2.5 border-t border-gray-100 flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e); } }}
                    placeholder={conversation?.workflowStatus === 'resolved' ? 'Réécrire pour rouvrir…' : 'Votre message…'}
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none resize-none bg-gray-50 focus:bg-white transition"
                    maxLength={2000}
                  />
                  <button type="submit" disabled={sending || !text.trim()}
                    className="w-9 h-9 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-40 text-white rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    {sending
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                    }
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
