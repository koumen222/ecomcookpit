import React, { useState, useEffect, useRef, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';

const CATEGORY_CFG = {
  general:  { label: 'Général',       color: 'bg-blue-100 text-blue-700' },
  bug:      { label: 'Bug',           color: 'bg-red-100 text-red-700' },
  billing:  { label: 'Facturation',   color: 'bg-purple-100 text-purple-700' },
  feature:  { label: 'Fonctionnalité', color: 'bg-teal-100 text-teal-700' },
  account:  { label: 'Compte',        color: 'bg-orange-100 text-orange-700' },
  other:    { label: 'Autre',         color: 'bg-gray-100 text-gray-600' },
};

const STATUS_CFG = {
  open:    { label: 'Ouvert',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  replied: { label: 'Répondu', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed:  { label: 'Fermé',  bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400' },
};

const fmtTime = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'À l\'instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7)  return `Il y a ${days}j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const fmtFull = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

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
  const [mobileView, setMobileView]   = useState('list'); // 'list' | 'detail'
  const messagesEndRef = useRef(null);
  const replyRef       = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTickets = useCallback(async () => {
    try {
      const res = await ecomApi.get('/support/my-tickets');
      setTickets(res.data.data.tickets || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // Poll every 15s
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

  // Poll detail every 8s
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
      setNewSubject('');
      setNewCategory('general');
      setNewMessage('');
      await fetchTickets();
      // select the new ticket
      const newSessionId = res.data.data.sessionId;
      setSelected(newSessionId);
      fetchDetail(newSessionId);
      setMobileView('detail');
    } catch { showToast('Erreur lors de la création.', 'error'); }
    setCreating(false);
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          {mobileView === 'detail' && (
            <button onClick={() => setMobileView('list')} className="md:hidden p-1 text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Support</h1>
            <p className="text-xs text-gray-500">Soumettez vos problèmes et suivez vos tickets</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span className="hidden sm:inline">Nouveau ticket</span>
        </button>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Nouveau ticket</h2>
              <button onClick={() => setShowNew(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={createTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={e => setNewSubject(e.target.value)}
                  placeholder="Décrivez brièvement votre problème..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {Object.entries(CATEGORY_CFG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Détaillez votre problème ici..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{newMessage.length}/2000</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating || !newMessage.trim()}
                  className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {creating ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Ticket list */}
        <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col bg-gray-50 ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 px-6">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              <p className="text-sm font-medium">Aucun ticket</p>
              <p className="text-xs mt-1">Créez votre premier ticket de support</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {tickets.map(t => {
                const active = t.sessionId === selected;
                const st = STATUS_CFG[t.status] || STATUS_CFG.open;
                const cat = CATEGORY_CFG[t.category] || CATEGORY_CFG.general;
                return (
                  <button
                    key={t.sessionId}
                    onClick={() => selectTicket(t)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${active ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-100'}`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-semibold text-gray-900 truncate flex-1 pr-2">{t.subject || 'Sans objet'}</span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{fmtTime(t.lastMessageAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />
                        {st.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
                      {(t.unreadUser || 0) > 0 && (
                        <span className="ml-auto bg-indigo-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">{t.unreadUser}</span>
                      )}
                    </div>
                    {t.lastMessage && <p className="text-xs text-gray-500 truncate">{t.lastMessage}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail pane */}
        <div className={`flex-1 flex flex-col bg-white ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              <p className="text-sm">Sélectionnez un ticket ou créez-en un nouveau</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Detail header */}
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-base font-bold text-gray-900 mb-1">{detail.subject || 'Sans objet'}</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUS_CFG[detail.status] || STATUS_CFG.open).bg} ${(STATUS_CFG[detail.status] || STATUS_CFG.open).text}`}>
                    {(STATUS_CFG[detail.status] || STATUS_CFG.open).label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(CATEGORY_CFG[detail.category] || CATEGORY_CFG.general).color}`}>
                    {(CATEGORY_CFG[detail.category] || CATEGORY_CFG.general).label}
                  </span>
                  <span>Créé le {fmtFull(detail.createdAt)}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
                {detail.messages?.map((m, i) => {
                  const isUser = m.from === 'visitor';
                  return (
                    <div key={m._id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isUser ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          {!isUser && <span className="text-xs font-medium opacity-70">{m.agentName || 'Support'}</span>}
                          <span className={`text-xs ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}>{fmtFull(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply box */}
              {detail.status !== 'closed' ? (
                <form onSubmit={sendReply} className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={replyRef}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                      placeholder="Votre message..."
                      rows={2}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                      maxLength={2000}
                    />
                    <button
                      type="submit"
                      disabled={sending || !reply.trim()}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                  Ce ticket est fermé. Créez un nouveau ticket si nécessaire.
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
