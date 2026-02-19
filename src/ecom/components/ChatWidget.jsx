import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';

const API_BASE = '';

const CHANNEL_LABELS = {
  general: { label: 'Général', emoji: '💬', desc: "Toute l'équipe" },
  commandes: { label: 'Commandes', emoji: '�', desc: 'Suivi des commandes' },
  compta: { label: 'Comptabilité', emoji: '�', desc: 'Finance & compta' },
  livraisons: { label: 'Livraisons', emoji: '🚚', desc: 'Suivi livraisons' },
  stock: { label: 'Stock', emoji: '🏭', desc: 'Gestion du stock' },
  marketing: { label: 'Marketing', emoji: '�', desc: 'Campagnes & promo' }
};

const ROLE_COLORS = {
  ecom_admin: 'bg-blue-600',
  ecom_closeuse: 'bg-pink-500',
  ecom_compta: 'bg-emerald-500',
  ecom_livreur: 'bg-orange-500',
  super_admin: 'bg-purple-600'
};

const ROLE_LABELS = {
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Compta',
  ecom_livreur: 'Livreur',
  super_admin: 'Super Admin'
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const dayDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (dayDiff === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (dayDiff === 1) return `Hier ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const getInitial = (name) => (name || 'U').charAt(0).toUpperCase();

const renderContent = (content, own) => {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className={`font-semibold ${own ? 'text-blue-100 bg-blue-500' : 'text-blue-700 bg-blue-50'} px-1 rounded`}>{part}</span>
      : part
  );
};

export default function ChatWidget() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [channels, setChannels] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [showChannels, setShowChannels] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const token = localStorage.getItem('ecomToken');

  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}/api/ecom/messages${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
    });
    return res.json();
  }, [token]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await apiFetch('/team/members');
      if (data.success) setMembers(data.members);
    } catch (_) {}
  }, [apiFetch]);

  const loadChannels = useCallback(async () => {
    try {
      const data = await apiFetch('/channels');
      if (data.success) {
        const chs = data.channels || [];
        setChannels(chs);
        if (!activeChannel && chs.length > 0) setActiveChannel(chs[0].slug);
        const counts = data.unreadCounts || {};
        setUnreadCounts(counts);
        setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
      }
    } catch (_) {}
  }, [apiFetch]);

  const loadMessages = useCallback(async (channel, pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true); else setLoadingMore(true);
      const data = await apiFetch(`/${channel}?page=${pageNum}&limit=40`);
      if (data.success) {
        if (append) setMessages(prev => [...data.messages, ...prev]);
        else {
          setMessages(data.messages);
          lastMessageIdRef.current = data.messages[data.messages.length - 1]?._id;
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
        setHasMore(data.pagination.page < data.pagination.pages);
        setPage(pageNum);
        setUnreadCounts(prev => {
          const next = { ...prev, [channel]: 0 };
          setTotalUnread(Object.values(next).reduce((a, b) => a + b, 0));
          return next;
        });
      }
    } catch (_) {}
    finally { setLoading(false); setLoadingMore(false); }
  }, [apiFetch]);

  const pollMessages = useCallback(async () => {
    if (!open) {
      // Juste mettre à jour les non-lus quand fermé
      try {
        const cd = await apiFetch('/channels');
        if (cd.success) {
          const counts = cd.unreadCounts || {};
          setUnreadCounts(counts);
          setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
        }
      } catch (_) {}
      return;
    }
    try {
      const data = await apiFetch(`/${activeChannel}?page=1&limit=40`);
      if (data.success && data.messages.length > 0) {
        const latestId = data.messages[data.messages.length - 1]?._id;
        if (latestId !== lastMessageIdRef.current) {
          setMessages(data.messages);
          lastMessageIdRef.current = latestId;
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
      }
      const cd = await apiFetch('/channels');
      if (cd.success) {
        const counts = { ...cd.unreadCounts, [activeChannel]: 0 };
        setUnreadCounts(counts);
        setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
      }
    } catch (_) {}
  }, [apiFetch, activeChannel, open]);

  // Charger les canaux au montage
  useEffect(() => {
    if (user) { loadChannels(); loadMembers(); }
  }, [user, loadChannels, loadMembers]);

  // Charger messages quand on ouvre ou change de canal
  useEffect(() => {
    if (open && user && activeChannel) loadMessages(activeChannel, 1, false);
  }, [open, activeChannel, user, loadMessages]);

  // Polling
  useEffect(() => {
    if (!user) return;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(pollMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [user, pollMessages]);

  // Focus input quand ouvert
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const data = await apiFetch(`/${activeChannel}`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage.trim(), replyTo: replyTo?._id || null })
      });
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setNewMessage(''); setReplyTo(null);
        lastMessageIdRef.current = data.message._id;
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch (_) {}
    finally { setSending(false); inputRef.current?.focus(); }
  };

  const saveEdit = async (messageId) => {
    if (!editContent.trim()) return;
    try {
      const data = await apiFetch(`/${activeChannel}/${messageId}`, {
        method: 'PUT', body: JSON.stringify({ content: editContent.trim() })
      });
      if (data.success) {
        setMessages(prev => prev.map(m => m._id === messageId ? data.message : m));
        setEditingId(null); setEditContent('');
      }
    } catch (_) {}
  };

  const deleteMessage = async (messageId) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      const data = await apiFetch(`/${activeChannel}/${messageId}`, { method: 'DELETE' });
      if (data.success) setMessages(prev => prev.filter(m => m._id !== messageId));
    } catch (_) {}
  };

  const handleMentionInput = (value) => {
    setNewMessage(value);
    const atIdx = value.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === value.length - 1) {
      setMentionQuery('');
      setShowMentions(true);
      setMentionIndex(0);
    } else if (atIdx !== -1 && value.slice(atIdx + 1).match(/^[\w\s]{0,20}$/)) {
      const q = value.slice(atIdx + 1);
      setMentionQuery(q);
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const filteredMentions = members.filter(m =>
    (m.name || m.email || '').toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 5);

  const insertMention = (member) => {
    const atIdx = newMessage.lastIndexOf('@');
    const name = member.name || member.email?.split('@')[0] || 'membre';
    setNewMessage(newMessage.slice(0, atIdx) + `@${name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
      if (e.key === 'Escape') { setShowMentions(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); }
    if (e.key === 'Escape') { setReplyTo(null); setEditingId(null); }
  };

  const isOwnMessage = (msg) => {
    const sid = msg.senderId?._id || msg.senderId;
    return sid?.toString() === user?._id?.toString();
  };

  const isAdmin = ['ecom_admin', 'super_admin'].includes(user?.role);

  if (!user || user.role === 'super_admin') return null;

  const widgetWidth = expanded ? 'w-[520px]' : 'w-80';
  const widgetHeight = expanded ? 'h-[600px]' : 'h-[460px]';

  const handleToggle = () => {
    if (window.innerWidth < 1024) {
      navigate('/ecom/chat?newDm=1');
    } else {
      setOpen(!open);
    }
  };

  return (

<div className="fixed bottom-20 lg:bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Panneau chat */}
      {open && (
        <div className={`${widgetWidth} ${widgetHeight} bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden mb-3 transition-all duration-200`}>
          {/* Header */}
          <div className="bg-gray-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Sélecteur de canal */}
              <div className="relative">
                <button
                  onClick={() => setShowChannels(!showChannels)}
                  className="flex items-center gap-1.5 text-white hover:text-gray-200 transition-colors"
                >
                  <span className="text-base">{channels.find(c => c.slug === activeChannel)?.emoji || '💬'}</span>
                  <span className="text-sm font-semibold">{channels.find(c => c.slug === activeChannel)?.name || activeChannel}</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showChannels ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showChannels && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowChannels(false)} />
                    <div className="absolute top-full left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20">
                      {channels.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-gray-400 text-center">Aucun canal</p>
                      ) : channels.map(ch => {
                        const unread = unreadCounts[ch.slug] || 0;
                        return (
                          <button
                            key={ch.slug}
                            onClick={() => { setActiveChannel(ch.slug); setShowChannels(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${activeChannel === ch.slug ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <span>{ch.emoji}</span>
                            <div className="flex-1 text-left">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{ch.name}</span>
                                {unread > 0 && <span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">{unread > 99 ? '99+' : unread}</span>}
                              </div>
                              {ch.description && <p className="text-[10px] text-gray-400">{ch.description}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Plein écran */}
              <a href="/ecom/chat" title="Ouvrir en plein écran"
                className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </a>
              {/* Fermer */}
              <button onClick={() => setOpen(false)} className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-gray-50">
            {hasMore && (
              <div className="flex justify-center mb-2">
                <button onClick={() => loadMessages(activeChannel, page + 1, true)} disabled={loadingMore}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-50 disabled:opacity-50">
                  {loadingMore ? '...' : 'Charger plus'}
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <span className="text-3xl mb-2">{channels.find(c => c.slug === activeChannel)?.emoji || '💬'}</span>
                <p className="text-sm text-gray-500 font-medium">Aucun message</p>
                <p className="text-xs text-gray-400 mt-0.5">Soyez le premier à écrire !</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const own = isOwnMessage(msg);
                const prevMsg = messages[idx - 1];
                const sameAuthor = prevMsg && (prevMsg.senderId?._id || prevMsg.senderId)?.toString() === (msg.senderId?._id || msg.senderId)?.toString();
                const timeDiff = prevMsg ? new Date(msg.createdAt) - new Date(prevMsg.createdAt) : Infinity;
                const showHeader = !sameAuthor || timeDiff > 5 * 60 * 1000;

                return (
                  <div key={msg._id} className={`flex gap-2 ${own ? 'flex-row-reverse' : 'flex-row'} ${showHeader ? 'mt-3' : 'mt-0.5'} group`}>
                    {showHeader ? (
                      <div className={`w-7 h-7 ${ROLE_COLORS[msg.senderRole] || 'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <span className="text-white text-[10px] font-bold">{getInitial(msg.senderName)}</span>
                      </div>
                    ) : <div className="w-7 flex-shrink-0" />}

                    <div className={`max-w-[75%] flex flex-col ${own ? 'items-end' : 'items-start'}`}>
                      {showHeader && (
                        <div className={`flex items-center gap-1.5 mb-0.5 ${own ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-[11px] font-semibold text-gray-700">{own ? 'Vous' : msg.senderName}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full text-white ${ROLE_COLORS[msg.senderRole] || 'bg-gray-400'}`}>{ROLE_LABELS[msg.senderRole] || msg.senderRole}</span>
                          <span className="text-[9px] text-gray-400">{formatTime(msg.createdAt)}</span>
                        </div>
                      )}

                      {msg.replyToContent && (
                        <div className="mb-0.5 px-2.5 py-1 rounded-lg border-l-2 border-blue-400 bg-blue-50 text-[11px] text-gray-600 max-w-full">
                          <p className="font-medium text-blue-600">{msg.replyToSenderName}</p>
                          <p className="truncate">{msg.replyToContent}</p>
                        </div>
                      )}

                      {editingId === msg._id ? (
                        <div className="w-full min-w-[160px]">
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg._id); } if (e.key === 'Escape') { setEditingId(null); setEditContent(''); } }}
                            className="w-full px-2.5 py-1.5 border border-blue-400 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" rows={2} autoFocus />
                          <div className="flex gap-2 mt-0.5 justify-end">
                            <button onClick={() => { setEditingId(null); setEditContent(''); }} className="text-[10px] text-gray-500 hover:text-gray-700">Annuler</button>
                            <button onClick={() => saveEdit(msg._id)} className="text-[10px] text-blue-600 font-medium hover:text-blue-700">Sauvegarder</button>
                          </div>
                        </div>
                      ) : (
                        <div className={`px-3 py-1.5 rounded-2xl text-xs leading-relaxed break-words ${own ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'}`}>
                          {renderContent(msg.content, own)}
                          {msg.edited && <span className={`text-[9px] ml-1 ${own ? 'text-blue-200' : 'text-gray-400'}`}>(modifié)</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions rapides au hover */}
                    <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center ${own ? 'flex-row' : 'flex-row-reverse'}`}>
                      <button onClick={() => setReplyTo(msg)} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200" title="Répondre">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      </button>
                      {isOwnMessage(msg) && (
                        <button onClick={() => { setEditingId(msg._id); setEditContent(msg.content); }} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200" title="Modifier">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                      )}
                      {(isOwnMessage(msg) || isAdmin) && (
                        <button onClick={() => deleteMessage(msg._id)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50" title="Supprimer">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Zone de saisie */}
          <div className="bg-white border-t border-gray-100 px-3 py-2.5 flex-shrink-0">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-blue-50 rounded-lg border-l-2 border-blue-400">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-blue-600">↩ {replyTo.senderName}</p>
                  <p className="text-[10px] text-gray-600 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <form onSubmit={sendMessage} className="flex items-end gap-2 relative">
              {showMentions && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-10">
                  {filteredMentions.map((m, i) => (
                    <button key={m._id} type="button" onClick={() => insertMention(m)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${i === mentionIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                      <div className={`w-5 h-5 ${ROLE_COLORS[m.role] || 'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-[9px] font-bold">{(m.name || m.email || 'U').charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="truncate font-medium">{m.name || m.email?.split('@')[0]}</span>
                      <span className="text-[9px] text-gray-400 ml-auto">{ROLE_LABELS[m.role] || ''}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={e => handleMentionInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrire un message... (@mention)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed bg-gray-50"
                rows={1}
                style={{ minHeight: '36px', maxHeight: '80px' }}
                onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
              />
              <button type="submit" disabled={!newMessage.trim() || sending}
                className="flex-shrink-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors">
                {sending ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={handleToggle}
        className="w-12 h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 relative"
        title="Chat Équipe"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
