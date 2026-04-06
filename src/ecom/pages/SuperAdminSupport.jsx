import React, { useState, useEffect, useRef, useCallback } from 'react';
import ecomApi from '../services/ecommApi.js';

const STATUS_CFG = {
  open:    { label: 'Ouvert',    bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  replied: { label: 'Répondu',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed:  { label: 'Fermé',     bg: 'bg-gray-100',   text: 'text-gray-500',    dot: 'bg-gray-400' },
};

const CATEGORY_CFG = {
  general:  { label: 'Général',       color: 'bg-blue-100 text-blue-700' },
  bug:      { label: 'Bug',           color: 'bg-red-100 text-red-700' },
  billing:  { label: 'Facturation',   color: 'bg-purple-100 text-purple-700' },
  feature:  { label: 'Fonctionnalité', color: 'bg-teal-100 text-teal-700' },
  account:  { label: 'Compte',        color: 'bg-orange-100 text-orange-700' },
  other:    { label: 'Autre',         color: 'bg-gray-100 text-gray-600' },
};

const fmtTime = (d) => {
  if (!d) return '';
  const now = Date.now();
  const diff = now - new Date(d).getTime();
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

const SuperAdminSupport = () => {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [detail, setDetail]               = useState(null);
  const [loading, setLoading]             = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus]   = useState('all');
  const [search, setSearch]               = useState('');
  const [reply, setReply]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [toast, setToast]                 = useState(null);
  const [unreadTotal, setUnreadTotal]     = useState(0);
  const replyRef                          = useRef(null);
  const messagesEndRef                    = useRef(null);

  // New message / broadcast state
  const [showNewMsg, setShowNewMsg]       = useState(false);
  const [newMsgMode, setNewMsgMode]       = useState('user'); // 'user' | 'broadcast'
  const [newMsgUserId, setNewMsgUserId]   = useState('');
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgText, setNewMsgText]       = useState('');
  const [newMsgSending, setNewMsgSending] = useState(false);
  const [userSearch, setUserSearch]       = useState('');
  const [userResults, setUserResults]     = useState([]);
  const [userSearching, setUserSearching] = useState(false);
  const userSearchTimer                   = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchList = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await ecomApi.get('/super-admin/support', { params });
      setConversations(res.data.data.conversations || []);
      setUnreadTotal(res.data.data.unreadTotal || 0);
    } catch { /* silent */ }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Poll list every 15s for new incoming messages
  useEffect(() => {
    const t = setInterval(fetchList, 15000);
    return () => clearInterval(t);
  }, [fetchList]);

  const fetchDetail = useCallback(async (sessionId) => {
    if (!sessionId) return;
    setDetailLoading(true);
    try {
      const res = await ecomApi.get(`/super-admin/support/${sessionId}`);
      setDetail(res.data.data.conversation);
      // Update the conv in list to mark unread = 0
      setConversations(prev => prev.map(c => c.sessionId === sessionId ? { ...c, unreadAdmin: 0 } : c));
    } catch { showToast('Impossible de charger la conversation.', 'error'); }
    setDetailLoading(false);
  }, []);

  const selectConv = (conv) => {
    setSelected(conv.sessionId);
    fetchDetail(conv.sessionId);
    setReply('');
  };

  // Poll detail every 8s when a conversation is selected
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
      const res = await ecomApi.post(`/super-admin/support/${selected}/reply`, {
        text: reply.trim(),
        agentName: 'Rita',
      });
      setDetail(res.data.data.conversation);
      setConversations(prev => prev.map(c => c.sessionId === selected ? { ...c, status: 'replied', lastMessageAt: new Date() } : c));
      setReply('');
      showToast('Réponse envoyée !');
    } catch { showToast('Erreur lors de l\'envoi.', 'error'); }
    setSending(false);
  };

  const changeStatus = async (sessionId, status) => {
    try {
      await ecomApi.put(`/super-admin/support/${sessionId}/status`, { status });
      setConversations(prev => prev.map(c => c.sessionId === sessionId ? { ...c, status } : c));
      if (detail?.sessionId === sessionId) setDetail(d => ({ ...d, status }));
      showToast('Statut mis à jour !');
    } catch { showToast('Erreur statut.', 'error'); }
  };

  // Search users for DM
  const searchUsers = useCallback(async (q) => {
    if (!q || q.length < 2) { setUserResults([]); return; }
    setUserSearching(true);
    try {
      const res = await ecomApi.get('/super-admin/users', { params: { search: q, limit: 10 } });
      setUserResults(res.data.data?.users || res.data.users || []);
    } catch { setUserResults([]); }
    setUserSearching(false);
  }, []);

  const onUserSearchChange = (val) => {
    setUserSearch(val);
    clearTimeout(userSearchTimer.current);
    userSearchTimer.current = setTimeout(() => searchUsers(val), 300);
  };

  const sendNewMessage = async (e) => {
    e.preventDefault();
    if (!newMsgText.trim() || newMsgSending) return;
    if (newMsgMode === 'user' && !newMsgUserId) {
      showToast('Sélectionnez un utilisateur.', 'error');
      return;
    }
    setNewMsgSending(true);
    try {
      if (newMsgMode === 'broadcast') {
        const res = await ecomApi.post('/super-admin/support/broadcast', {
          text: newMsgText.trim(),
          subject: newMsgSubject.trim() || undefined,
          agentName: 'Scalor',
        });
        showToast(`Message envoyé à ${res.data.data.sent} utilisateurs !`);
      } else {
        await ecomApi.post('/super-admin/support/send-to-user', {
          userId: newMsgUserId,
          text: newMsgText.trim(),
          subject: newMsgSubject.trim() || undefined,
          agentName: 'Scalor',
        });
        showToast('Message envoyé !');
      }
      setShowNewMsg(false);
      setNewMsgUserId('');
      setNewMsgSubject('');
      setNewMsgText('');
      setUserSearch('');
      setUserResults([]);
      fetchList();
    } catch { showToast('Erreur lors de l\'envoi.', 'error'); }
    setNewMsgSending(false);
  };

  // Sound notification for admin on new unread
  const prevUnreadRef = useRef(0);
  useEffect(() => {
    if (unreadTotal > prevUnreadRef.current && prevUnreadRef.current > 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch { /* silent */ }
    }
    prevUnreadRef.current = unreadTotal;
  }, [unreadTotal]);

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.sessionId?.toLowerCase().includes(q) ||
      c.visitorName?.toLowerCase().includes(q) ||
      c.visitorEmail?.toLowerCase().includes(q) ||
      c.userName?.toLowerCase().includes(q) ||
      c.userEmail?.toLowerCase().includes(q) ||
      c.subject?.toLowerCase().includes(q) ||
      c.messages?.at(-1)?.text?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gray-50 overflow-hidden">

      {/* ── Toast ───────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {toast.type === 'error'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* ── LEFT PANEL — Conversation list ──────────────────── */}

      {/* ── New Message Modal ──────────────────────────────── */}
      {showNewMsg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Envoyer un message</h2>
              <button onClick={() => setShowNewMsg(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={sendNewMessage} className="p-6 space-y-4">
              {/* Mode toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button type="button" onClick={() => setNewMsgMode('user')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${newMsgMode === 'user' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Un utilisateur
                </button>
                <button type="button" onClick={() => setNewMsgMode('broadcast')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${newMsgMode === 'broadcast' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                  Tous les utilisateurs
                </button>
              </div>

              {/* User search (only in user mode) */}
              {newMsgMode === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={e => onUserSearchChange(e.target.value)}
                      placeholder="Rechercher par nom ou email..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    {userSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                    )}
                  </div>
                  {userResults.length > 0 && !newMsgUserId && (
                    <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                      {userResults.map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => { setNewMsgUserId(u._id); setUserSearch(u.name || u.email); setUserResults([]); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                        >
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.name || 'Sans nom'}</p>
                            <p className="text-xs text-gray-500">{u.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {newMsgUserId && (
                    <div className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg text-sm">
                      <span className="text-emerald-700 font-medium flex-1">{userSearch}</span>
                      <button type="button" onClick={() => { setNewMsgUserId(''); setUserSearch(''); }} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {newMsgMode === 'broadcast' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  <p className="text-xs text-amber-700">Ce message sera envoyé à <strong>tous les utilisateurs actifs</strong> de la plateforme.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input
                  type="text"
                  value={newMsgSubject}
                  onChange={e => setNewMsgSubject(e.target.value)}
                  placeholder="Ex: Mise à jour importante..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={newMsgText}
                  onChange={e => setNewMsgText(e.target.value)}
                  placeholder="Votre message..."
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{newMsgText.length}/2000</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewMsg(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={newMsgSending || !newMsgText.trim() || (newMsgMode === 'user' && !newMsgUserId)}
                  className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {newMsgSending ? 'Envoi...' : newMsgMode === 'broadcast' ? 'Envoyer à tous' : 'Envoyer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="w-full sm:w-80 lg:w-96 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-sm">
                <svg className="w-4.5 h-4.5 w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-gray-900">Support</h1>
                <p className="text-[11px] text-gray-400">{conversations.length} conversations</p>
              </div>
            </div>
            {unreadTotal > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded-full">{unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* New message button */}
          <button
            onClick={() => setShowNewMsg(true)}
            className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nouveau message
          </button>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-emerald-400 focus:bg-white transition"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 mt-2">
            {['all', 'open', 'replied', 'closed'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${filterStatus === s ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {s === 'all' ? 'Tout' : STATUS_CFG[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-emerald-600 animate-spin" />
              <p className="text-xs text-gray-400">Chargement…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 px-6 text-center">
              <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              <p className="text-sm text-gray-400">Aucune conversation</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(conv => {
                const isActive = selected === conv.sessionId;
                const lastMsg = conv.messages?.at(-1);
                const sc = STATUS_CFG[conv.status] || STATUS_CFG.open;
                const isAuthUser = !!conv.userId;
                const displayName = conv.userName || conv.visitorName || conv.visitorEmail || conv.userEmail || conv.sessionId?.slice(0, 12) + '…';
                const cat = conv.category ? CATEGORY_CFG[conv.category] : null;
                return (
                  <button
                    key={conv.sessionId}
                    onClick={() => selectConv(conv)}
                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-gray-50 ${isActive ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 ${isAuthUser ? 'bg-indigo-600 text-white' : isActive ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-[13px] font-semibold text-gray-900 truncate flex items-center gap-1.5">
                            {displayName}
                            {isAuthUser && (
                              <span className="px-1 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-bold rounded">USER</span>
                            )}
                          </span>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{fmtTime(conv.lastMessageAt)}</span>
                        </div>
                        {conv.subject && (
                          <p className="text-[12px] font-medium text-gray-700 truncate leading-tight mb-0.5">{conv.subject}</p>
                        )}
                        <p className="text-[12px] text-gray-500 truncate leading-tight">
                          {lastMsg?.text || 'Aucun message'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                          {cat && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cat.color}`}>{cat.label}</span>
                          )}
                          {conv.unreadAdmin > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">{conv.unreadAdmin}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — Conversation detail ───────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-700 mb-1">Sélectionnez une conversation</h2>
              <p className="text-sm text-gray-400 max-w-xs">Cliquez sur une conversation à gauche pour voir les messages et répondre.</p>
            </div>
          </div>
        ) : detailLoading && !detail ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-emerald-600 animate-spin" />
          </div>
        ) : detail ? (
          <>
            {/* Conversation header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm ${detail.userId ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                  {(detail.userName || detail.visitorName || detail.userEmail || detail.visitorEmail || detail.sessionId || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">
                      {detail.userName || detail.visitorName || 'Visiteur anonyme'}
                    </p>
                    {detail.userId && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded">Utilisateur</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {(detail.userEmail || detail.visitorEmail) && <>{detail.userEmail || detail.visitorEmail} · </>}
                    {detail.subject && <><span className="font-medium text-gray-600">{detail.subject}</span> · </>}
                    {detail.category && CATEGORY_CFG[detail.category] && (
                      <span className={`inline-block px-1.5 py-0 rounded text-[10px] font-semibold ${CATEGORY_CFG[detail.category].color} mr-1`}>
                        {CATEGORY_CFG[detail.category].label}
                      </span>
                    )}
                    Débuté {fmtFull(detail.createdAt)}
                  </p>
                </div>
              </div>
              {/* Status selector */}
              <div className="flex items-center gap-2">
                <select
                  value={detail.status}
                  onChange={e => changeStatus(detail.sessionId, e.target.value)}
                  className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="open">Ouvert</option>
                  <option value="replied">Répondu</option>
                  <option value="closed">Fermé</option>
                </select>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ background: '#f8fafc' }}>
              {detail.messages.map(msg => (
                <div key={msg._id} className={`flex items-end gap-2.5 ${msg.from === 'agent' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1 ${msg.from === 'agent' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gray-300'}`}>
                    {msg.from === 'agent' ? 'R' : (detail.visitorName || 'V').charAt(0).toUpperCase()}
                  </div>
                  <div className={`max-w-[72%] flex flex-col gap-1 ${msg.from === 'agent' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.from === 'agent'
                        ? 'bg-emerald-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md border border-gray-100 shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1">
                      {msg.from === 'agent' ? `${msg.agentName || 'Rita'} · ` : ''}{fmtFull(msg.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
              {detail.messages.length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">Aucun message dans cette conversation.</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            {detail.status !== 'closed' ? (
              <form onSubmit={sendReply} className="px-4 py-3 bg-white border-t border-gray-100">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={replyRef}
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                      placeholder="Répondre en tant que Rita… (Entrée pour envoyer)"
                      rows={2}
                      className="w-full resize-none text-sm text-gray-800 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-emerald-400 focus:bg-white transition leading-relaxed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!reply.trim() || sending}
                    className="w-10 h-10 mb-0.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition flex-shrink-0"
                  >
                    {sending ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 px-1">La réponse apparaîtra instantanément dans le chat du visiteur.</p>
              </form>
            ) : (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 font-medium">Cette conversation est fermée.</p>
                <button onClick={() => changeStatus(detail.sessionId, 'open')} className="mt-1 text-xs text-emerald-600 font-semibold hover:underline">Rouvrir</button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SuperAdminSupport;
