import React, { useState, useEffect, useRef, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';

const CATEGORY_CFG = {
  general:  { label: 'Général',       cls: 'bg-blue-100 text-blue-700' },
  bug:      { label: 'Bug',           cls: 'bg-red-100 text-red-700' },
  billing:  { label: 'Facturation',   cls: 'bg-violet-100 text-violet-700' },
  feature:  { label: 'Suggestion',    cls: 'bg-teal-100 text-teal-700' },
  account:  { label: 'Compte',        cls: 'bg-orange-100 text-orange-700' },
  other:    { label: 'Autre',         cls: 'bg-gray-100 text-gray-600' },
};

const WORKFLOW_CFG = {
  ai:            { label: 'Répondu par IA',        bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400' },
  pending_admin: { label: 'En attente de l\'admin', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  resolved:      { label: 'Résolu',                 bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const fmtAgo = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `Il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7)  return `Il y a ${days}j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const fmtFull = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const CATEGORIES = Object.entries(CATEGORY_CFG).map(([v, c]) => ({ value: v, ...c }));

const UserSupport = () => {
  const [tickets, setTickets]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply]             = useState('');
  const [sending, setSending]         = useState(false);
  const [toast, setToast]             = useState(null);
  const [showNew, setShowNew]         = useState(false);
  const [newSubject, setNewSubject]   = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newMessage, setNewMessage]   = useState('');
  const [creating, setCreating]       = useState(false);
  const [mobileView, setMobileView]   = useState('list');
  const [filter, setFilter]           = useState('all'); // 'all' | 'open' | 'resolved'
  const messagesEndRef = useRef(null);
  const replyRef       = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTickets = useCallback(async () => {
    try {
      const res = await ecomApi.get('/support/my-tickets');
      setTickets(res.data.data.tickets || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    const t = setInterval(fetchTickets, 15000);
    return () => clearInterval(t);
  }, [fetchTickets]);

  const fetchDetail = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setDetailLoading(true);
    try {
      const res = await ecomApi.get(`/support/my-tickets/${sessionId}`);
      setDetail(res.data.data.conversation);
      setTickets(prev => prev.map(t => t.sessionId === sessionId ? { ...t, unreadUser: 0 } : t));
    } catch { showToast('Impossible de charger le ticket.', 'error'); }
    setDetailLoading(false);
  }, []);

  const selectTicket = (t) => {
    setSelected(t.sessionId);
    fetchDetail(t.sessionId);
    setReply('');
    setMobileView('detail');
  };

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => fetchDetail(selected), 8000);
    return () => clearInterval(t);
  }, [selected, fetchDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    try {
      const res = await ecomApi.post(`/support/my-tickets/${selected}/reply`, { text: reply.trim() });
      setDetail(res.data.data.conversation);
      setReply('');
      fetchTickets();
      replyRef.current?.focus();
    } catch { showToast('Erreur lors de l\'envoi.', 'error'); }
    setSending(false);
  };

  const createTicket = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || creating) return;
    setCreating(true);
    try {
      const res = await ecomApi.post('/support/my-tickets', {
        subject: newSubject.trim(),
        category: newCategory,
        text: newMessage.trim(),
      });
      showToast('Ticket créé avec succès !');
      setShowNew(false);
      setNewSubject(''); setNewCategory('general'); setNewMessage('');
      await fetchTickets();
      const sid = res.data.data.sessionId;
      setSelected(sid);
      fetchDetail(sid);
      setMobileView('detail');
    } catch { showToast('Erreur lors de la création.', 'error'); }
    setCreating(false);
  };

  const filteredTickets = tickets.filter(t => {
    if (filter === 'open')     return t.workflowStatus !== 'resolved';
    if (filter === 'resolved') return t.workflowStatus === 'resolved';
    return true;
  });

  const unreadTotal = tickets.reduce((s, t) => s + (t.unreadUser || 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          {mobileView === 'detail' && (
            <button onClick={() => setMobileView('list')} className="md:hidden p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <div className="w-9 h-9 bg-[#E6F2ED] rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              Support
              {unreadTotal > 0 && (
                <span className="w-5 h-5 bg-[#0F6B4F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unreadTotal}</span>
              )}
            </h1>
            <p className="text-xs text-gray-500">Soumettez vos problèmes et suivez leur avancement</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0F6B4F] hover:bg-[#0a5740] rounded-xl transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Nouveau ticket</span>
        </button>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Nouveau ticket de support</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={createTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sujet</label>
                <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)}
                  placeholder="Résumez votre problème en quelques mots…"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none bg-gray-50 focus:bg-white transition"
                  maxLength={200} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Catégorie</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.value} type="button" onClick={() => setNewCategory(c.value)}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                        newCategory === c.value ? 'bg-[#0F6B4F] text-white border-[#0F6B4F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#0F6B4F]/40'
                      }`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message <span className="text-red-500">*</span></label>
                <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder="Décrivez votre problème en détail. Plus vous êtes précis, plus vite nous pourrons vous aider."
                  rows={5}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none resize-none bg-gray-50 focus:bg-white transition"
                  maxLength={2000} required />
                <p className="text-xs text-gray-400 mt-1 text-right">{newMessage.length}/2000</p>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition">
                  Annuler
                </button>
                <button type="submit" disabled={creating || !newMessage.trim()}
                  className="px-6 py-2 text-sm font-semibold text-white bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 rounded-xl transition-colors">
                  {creating ? 'Envoi…' : 'Envoyer →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Ticket list ── */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col bg-white ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}`}>

          {/* Filter tabs */}
          <div className="flex gap-1 px-4 py-3 border-b border-gray-100">
            {[
              { key: 'all',      label: 'Tous' },
              { key: 'open',     label: 'En cours' },
              { key: 'resolved', label: 'Résolus' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  filter === f.key ? 'bg-[#0F6B4F] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#0F6B4F]/20 border-t-[#0F6B4F] rounded-full animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-6 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <p className="text-sm font-medium text-gray-600">Aucun ticket</p>
              <p className="text-xs mt-1">
                {filter === 'all' ? 'Créez votre premier ticket pour obtenir de l\'aide.' : `Aucun ticket ${filter === 'open' ? 'en cours' : 'résolu'}.`}
              </p>
              {filter === 'all' && (
                <button onClick={() => setShowNew(true)} className="mt-4 px-4 py-2 bg-[#0F6B4F] text-white text-xs font-semibold rounded-xl hover:bg-[#0a5740] transition">
                  Créer un ticket
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredTickets.map(t => {
                const active = t.sessionId === selected;
                const wf = WORKFLOW_CFG[t.workflowStatus] || WORKFLOW_CFG.pending_admin;
                const cat = CATEGORY_CFG[t.category] || CATEGORY_CFG.general;
                return (
                  <button key={t.sessionId} onClick={() => selectTicket(t)}
                    className={`w-full text-left px-4 py-3.5 transition-colors ${active ? 'bg-[#E6F2ED]' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold truncate flex-1 ${active ? 'text-[#0F6B4F]' : 'text-gray-900'}`}>
                        {t.subject || 'Demande support'}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtAgo(t.lastMessageAt)}</span>
                    </div>
                    {t.lastMessage && (
                      <p className="text-xs text-gray-500 truncate mb-1.5">{t.lastMessage}</p>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${wf.bg} ${wf.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${wf.dot}`} />
                        {wf.label}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cat.cls}`}>{cat.label}</span>
                      {(t.unreadUser || 0) > 0 && (
                        <span className="ml-auto bg-[#0F6B4F] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{t.unreadUser}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Detail pane ── */}
        <div className={`flex-1 flex flex-col bg-white ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 px-8 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <p className="text-sm font-medium text-gray-500">Sélectionnez un ticket</p>
              <p className="text-xs text-gray-400 mt-1">ou créez-en un nouveau</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#0F6B4F]/20 border-t-[#0F6B4F] rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Detail header */}
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-bold text-gray-900 mb-1.5">{detail.subject || 'Sans objet'}</h2>
                <div className="flex items-center flex-wrap gap-2">
                  {(() => {
                    const wf = WORKFLOW_CFG[detail.workflowStatus] || WORKFLOW_CFG.pending_admin;
                    return (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${wf.bg} ${wf.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${wf.dot}`} />
                        {wf.label}
                      </span>
                    );
                  })()}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${(CATEGORY_CFG[detail.category] || CATEGORY_CFG.general).cls}`}>
                    {(CATEGORY_CFG[detail.category] || CATEGORY_CFG.general).label}
                  </span>
                  <span className="text-[10px] text-gray-400">Créé le {fmtFull(detail.createdAt)}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
                {detail.messages?.map((m, i) => {
                  const isUser = m.from === 'visitor';
                  return (
                    <div key={m._id || i} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-[#0F6B4F]/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                        </div>
                      )}
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        isUser
                          ? 'bg-[#0F6B4F] text-white rounded-br-sm'
                          : m.senderType === 'ai'
                            ? 'bg-white border border-sky-200 text-gray-800 rounded-bl-sm'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                      }`}>
                        {!isUser && (
                          <p className="text-[10px] font-bold mb-0.5 opacity-50">{m.senderType === 'ai' ? 'Scalor IA' : (m.agentName || 'Support')}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>{fmtFull(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              {detail.workflowStatus !== 'resolved' ? (
                <form onSubmit={sendReply} className="px-5 py-3.5 border-t border-gray-100 bg-white">
                  <div className="flex items-end gap-2">
                    <textarea ref={replyRef} value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                      placeholder="Votre message… (Entrée pour envoyer)"
                      rows={2}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0F6B4F] focus:border-transparent outline-none resize-none bg-gray-50 focus:bg-white transition"
                      maxLength={2000}
                    />
                    <button type="submit" disabled={sending || !reply.trim()}
                      className="p-2.5 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 text-white rounded-xl transition-colors flex-shrink-0">
                      {sending
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                      }
                    </button>
                  </div>
                </form>
              ) : (
                <div className="px-5 py-4 border-t border-gray-100 bg-white text-center">
                  <p className="text-sm text-gray-500 mb-2">Ce ticket est résolu.</p>
                  <button onClick={() => setShowNew(true)}
                    className="px-5 py-2 bg-[#0F6B4F] hover:bg-[#0a5740] text-white text-sm font-semibold rounded-xl transition">
                    Créer un nouveau ticket
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default UserSupport;
