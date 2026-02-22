import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useMediaUpload } from '../hooks/useMediaUpload.js';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'https://plateforme-backend-production-2ec6.up.railway.app';

const ROLE_COLORS = { 
  ecom_admin: 'bg-blue-600', 
  ecom_closeuse: 'bg-pink-500', 
  ecom_compta: 'bg-emerald-500', 
  ecom_livreur: 'bg-orange-500', 
  super_admin: 'bg-purple-600' 
};

const CHANNEL_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];

const formatTime = (d) => {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Hier';
  if (diff < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const getInitial = (n) => (n || 'U').charAt(0).toUpperCase();

// Génère une couleur unique par nom (pour les groupes)
const stringToColor = (str = '') => {
  const colors = ['#E53935','#8E24AA','#1E88E5','#00897B','#F4511E','#6D4C41','#039BE5','#7CB342','#FB8C00','#D81B60'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const renderMessageContent = (content, own) => {
  if (!content) return null;
  const linkMatch = content.match(/🔗\s*(\/ecom\/\S+)/);
  if (linkMatch) {
    const link = linkMatch[1];
    const lines = content.split('\n').filter(l => !l.startsWith('🔗'));
    const emoji = lines[0]?.match(/^(📦|🏷️|📊|👤|💰|📎)\s*/)?.[1] || '📎';
    const title = lines[0]?.replace(/^(📦|🏷️|📊|👤|💰|📎)\s*/, '') || '';
    const subtitle = lines.slice(1).join(' ').trim();
    return (
      <Link to={link} className={`block rounded-xl p-3 min-w-[200px] transition-colors border ${own ? 'bg-white/15 border-white/20 hover:bg-white/25' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
        <div className="flex items-start gap-2">
          <span className="text-xl flex-shrink-0">{emoji}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-bold leading-tight ${own ? 'text-white' : 'text-slate-800'}`}>{title}</p>
            {subtitle && <p className={`text-[11px] mt-0.5 ${own ? 'text-white/70' : 'text-slate-500'}`}>{subtitle}</p>}
            <p className={`text-[11px] font-semibold mt-1.5 ${own ? 'text-white/80' : 'text-blue-600'}`}>Ouvrir →</p>
          </div>
        </div>
      </Link>
    );
  }
  const parts = content.split(/(@\S+)/g);
  return (
    <p className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${own ? 'text-white' : 'text-slate-900'}`}>
      {parts.map((part, i) =>
        part.startsWith('@')
          ? <span key={i} className={`font-bold px-1 rounded ${own ? 'bg-white/20' : 'text-blue-600 bg-blue-50'}`}>{part}</span>
          : part
      )}
    </p>
  );
};

const normalizeId = (value) => {
  if (!value) return null;
  // populated object { _id: ... }
  if (typeof value === 'object' && value._id) return String(value._id);
  // bson ObjectId has toString() that returns hex
  return String(value);
};

export default function TeamChat() {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('dm'); // 'dm' or 'groups'
  const [view, setView] = useState('list'); // 'list' or 'chat'
  const [conversations, setConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('💬');
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState(false);
  const [typingName, setTypingName] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareType, setShareType] = useState(null); // 'order','product','report','client','transaction'
  const [shareSearch, setShareSearch] = useState('');
  const [shareResults, setShareResults] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const token = localStorage.getItem('ecomToken');

  const { isRecording, formattedDuration, audioBlob, startRecording, stopRecording, cancelRecording, clearRecording } = useAudioRecorder();
  const { isUploading, progress: uploadProgress, uploadFile, uploadAudio, getMediaKind } = useMediaUpload();

  // API calls
  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api/ecom/dm${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers }
    });
    return res.json();
  }, [token]);

  const msgFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api/ecom/messages${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers }
    });
    return res.json();
  }, [token]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch('/conversations');
      if (data.success) setConversations(data.conversations || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [apiFetch]);

  // Load channels/groups
  const loadChannels = useCallback(async () => {
    try {
      const data = await msgFetch('/channels');
      if (data.success) setChannels(data.channels || []);
    } catch (e) { console.error(e); }
  }, [msgFetch]);

  // Load members for new chat
  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/ecom/messages/team/members', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setMembers(data.members || []);
    } catch (e) { console.error(e); }
  }, [token]);

  // Load messages for a DM conversation
  const loadMessages = useCallback(async (userId) => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/${userId}?limit=50`);
      if (data.success) {
        setMessages(data.messages || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        apiFetch(`/${userId}/read`, { method: 'POST' }).catch(() => {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [apiFetch]);

  // Load messages for a channel/group
  const loadChannelMessages = useCallback(async (channelSlug) => {
    if (!channelSlug) return;
    setLoading(true);
    try {
      const data = await msgFetch(`/${channelSlug}?page=1&limit=50`);
      if (data.success) {
        setMessages(data.messages || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [msgFetch]);

  // Send message (DM or Channel)
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      if (activeChannel) {
        // Channel message
        const data = await msgFetch(`/${activeChannel.slug}`, {
          method: 'POST',
          body: JSON.stringify({
            content: newMessage.trim(),
            replyTo: replyTo?._id || null,
            replyToContent: replyTo?.content || null,
            replyToSenderName: replyTo?.senderName || null
          })
        });
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      } else if (activeConv) {
        // DM message
        const data = await apiFetch(`/${activeConv._id}`, {
          method: 'POST',
          body: JSON.stringify({
            content: newMessage.trim(),
            clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            replyTo: replyTo?._id || null
          })
        });
        if (data.success && !messages.some(m => m._id === data.message._id)) {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        loadConversations();
      }
      setNewMessage('');
      setReplyTo(null);
    } catch (e) { console.error(e); }
    setSending(false);
    inputRef.current?.focus();
  };

  // Create new channel/group
  const createChannel = async () => {
    if (!newGroupName.trim()) return;
    try {
      const data = await msgFetch('/channels', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName.trim(), emoji: newGroupEmoji, description: '' })
      });
      if (data.success) {
        setChannels(prev => [...prev, data.channel]);
        setShowNewGroup(false);
        setNewGroupName('');
        setNewGroupEmoji('💬');
        openChannel(data.channel);
      }
    } catch (e) { console.error(e); }
  };

  // Send audio
  const sendAudio = async () => {
    if (!audioBlob || !activeConv) return;
    setSending(true);
    try {
      const result = await uploadAudio(audioBlob, 0);
      if (result?.success) {
        const data = await apiFetch(`/${activeConv._id}`, {
          method: 'POST',
          body: JSON.stringify({
            content: '',
            messageType: 'audio',
            mediaId: result.mediaId,
            mediaUrl: result.mediaUrl,
            clientMessageId: `audio-${Date.now()}`
          })
        });
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }
    } catch (e) { console.error(e); }
    setSending(false);
    clearRecording();
  };

  // Send file
  const sendFile = async (file) => {
    if (!file || !activeConv) return;
    setSending(true);
    try {
      const result = await uploadFile(file);
      if (result?.success) {
        const data = await apiFetch(`/${activeConv._id}`, {
          method: 'POST',
          body: JSON.stringify({
            content: '',
            messageType: getMediaKind(file),
            mediaId: result.mediaId,
            mediaUrl: result.mediaUrl,
            metadata: { mimeType: file.type, fileName: file.name, fileSize: file.size },
            clientMessageId: `file-${Date.now()}`
          })
        });
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      }
    } catch (e) { console.error(e); }
    setSending(false);
  };

  // Auto-send audio when recording stops
  useEffect(() => {
    if (audioBlob && !isRecording) sendAudio();
  }, [audioBlob, isRecording]);

  // Share platform elements
  const SHARE_TYPES = [
    { key: 'order', label: 'Commande', emoji: '📦', endpoint: '/api/ecom/orders', searchField: 'search' },
    { key: 'product', label: 'Produit', emoji: '🏷️', endpoint: '/api/ecom/products', searchField: 'search' },
    { key: 'report', label: 'Rapport', emoji: '📊', endpoint: '/api/ecom/reports', searchField: 'search' },
    { key: 'client', label: 'Client', emoji: '👤', endpoint: '/api/ecom/clients', searchField: 'search' },
    { key: 'transaction', label: 'Transaction', emoji: '💰', endpoint: '/api/ecom/transactions', searchField: 'search' },
  ];

  const searchShareItems = useCallback(async (type, query) => {
    setShareLoading(true);
    try {
      const cfg = SHARE_TYPES.find(t => t.key === type);
      if (!cfg) return;
      const params = query ? `search=${encodeURIComponent(query)}&limit=10` : 'limit=10';
      const url = `${cfg.endpoint}?${params}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      // Chaque API a une structure différente
      let items = [];
      if (type === 'order') items = json.data?.orders || [];
      else if (type === 'product') items = Array.isArray(json.data) ? json.data : [];
      else if (type === 'client') items = json.data?.clients || [];
      else if (type === 'transaction') items = json.data?.transactions || [];
      else if (type === 'report') items = Array.isArray(json.data) ? json.data : json.data?.reports || [];
      setShareResults(items.slice(0, 10));
    } catch (e) { setShareResults([]); }
    setShareLoading(false);
  }, [token]);

  useEffect(() => {
    if (!shareType) return;
    // Charger immédiatement à l'ouverture, puis debounce sur la recherche
    if (shareSearch === '') {
      searchShareItems(shareType, '');
    } else {
      const timer = setTimeout(() => searchShareItems(shareType, shareSearch), 300);
      return () => clearTimeout(timer);
    }
  }, [shareType, shareSearch, searchShareItems]);

  const formatShareCard = (type, item) => {
    switch (type) {
      case 'order': {
        const statusLabels = { pending: '⏳ En attente', confirmed: '✅ Confirmée', shipped: '🚚 Expédiée', delivered: '📦 Livrée', returned: '↩️ Retournée', cancelled: '❌ Annulée', unreachable: '📵 Injoignable', called: '📞 Appelée', postponed: '⏰ Reportée' };
        return { title: `Commande ${item.orderId || '#' + (item._id?.slice(-6) || '')}`, subtitle: `${item.clientName || 'Client'} • ${item.product || ''} • ${statusLabels[item.status] || item.status || ''}`, price: item.price, link: `/ecom/orders/${item._id}` };
      }
      case 'product':
        return { title: item.name || 'Produit', subtitle: `${item.status || ''} • Stock: ${item.stock ?? '?'}`, price: item.sellingPrice || item.price, link: `/ecom/products/${item._id}` };
      case 'report': {
        const productName = item.productId?.name || item.product || '';
        const delivered = item.ordersDelivered ?? 0;
        const received = item.ordersReceived ?? 0;
        const profit = item.profit ?? null;
        const revenue = item.revenue ?? null;
        const displayPrice = profit ?? revenue ?? null;
        return {
          title: `Rapport ${item.date ? new Date(item.date).toLocaleDateString('fr-FR') : ''}`,
          subtitle: `${productName}${productName ? ' • ' : ''}${delivered}/${received} livraisons`,
          price: displayPrice,
          link: `/ecom/reports`
        };
      }
      case 'client': {
        const name = [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Client';
        return { title: name, subtitle: `${item.phone || ''} ${item.city ? '• ' + item.city : ''}`, price: null, link: `/ecom/clients` };
      }
      case 'transaction': {
        const typeLabel = item.type === 'income' ? '📈 Revenu' : item.type === 'expense' ? '📉 Dépense' : item.type || '';
        return { title: item.description || item.label || 'Transaction', subtitle: `${typeLabel} • ${item.category || ''}`, price: item.amount, link: `/ecom/transactions` };
      }
      default:
        return { title: 'Élément', subtitle: '', price: null, link: '#' };
    }
  };

  const sendShareItem = async (type, item) => {
    const card = formatShareCard(type, item);
    const cfg = SHARE_TYPES.find(t => t.key === type);
    const fmtPrice = card.price != null ? ` — ${Number(card.price).toLocaleString('fr-FR')} MAD` : '';
    const content = `${cfg?.emoji || '📎'} ${card.title}\n${card.subtitle}${fmtPrice}\n🔗 ${card.link}`;
    setShowShareMenu(false);
    setShareType(null);
    setShareSearch('');
    setShareResults([]);
    // Send as a regular message with metadata
    if (activeChannel) {
      const data = await msgFetch(`/${activeChannel.slug}`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } else if (activeConv) {
      const data = await apiFetch(`/${activeConv._id}`, {
        method: 'POST',
        body: JSON.stringify({ content, clientMessageId: `share-${Date.now()}` })
      });
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }
  };

  // Open DM conversation
  const openConversation = (conv) => {
    const other = conv.other;
    setActiveConv(other);
    setActiveChannel(null);
    setView('chat');
    loadMessages(other._id);
  };

  // Open channel/group
  const openChannel = (channel) => {
    setActiveChannel(channel);
    setActiveConv(null);
    setView('chat');
    loadChannelMessages(channel.slug);
  };

  // Start new conversation
  const startNewChat = (member) => {
    setActiveConv(member);
    setActiveChannel(null);
    setView('chat');
    setShowNewChat(false);
    loadMessages(member._id);
  };

  // Go back to list
  const goBack = () => {
    setView('list');
    setActiveConv(null);
    setActiveChannel(null);
    setMessages([]);
    if (tab === 'dm') loadConversations();
    else loadChannels();
  };

  const goBackFromList = () => {
    navigate(-1);
  };

  // Initial load
  useEffect(() => {
    loadConversations();
    loadChannels();
    loadMembers();
  }, []);

  // Polling for new messages (fallback if WebSocket not connected)
  useEffect(() => {
    if (!activeConv && !activeChannel) return;
    const interval = setInterval(() => {
      if (activeConv) {
        apiFetch(`/${activeConv._id}?limit=50`).then(data => {
          if (data.success && data.messages) {
            setMessages(prev => {
              const prevIds = new Set(prev.map(m => m._id));
              const newMsgs = data.messages.filter(m => !prevIds.has(m._id));
              if (newMsgs.length > 0) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        }).catch(() => {});
      } else if (activeChannel) {
        msgFetch(`/${activeChannel.slug}?page=1&limit=50`).then(data => {
          if (data.success && data.messages) {
            setMessages(prev => {
              const prevIds = new Set(prev.map(m => m._id));
              const newMsgs = data.messages.filter(m => !prevIds.has(m._id));
              if (newMsgs.length > 0) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        }).catch(() => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeConv?._id, activeChannel?.slug]);

  // WebSocket
  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true });
    socketRef.current = socket;

    socket.on('message:new', (msg) => {
      if (activeConv && (msg.senderId === activeConv._id || msg.participants?.includes(activeConv._id))) {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      loadConversations();
    });

    socket.on('typing:start', ({ userId, userName }) => {
      if (activeConv?._id === userId) { setTyping(true); setTypingName(userName); }
    });
    socket.on('typing:stop', ({ userId }) => {
      if (activeConv?._id === userId) setTyping(false);
    });

    return () => socket.disconnect();
  }, [token, activeConv?._id]);

  // Typing indicator
  const handleTyping = (value) => {
    setNewMessage(value);
    if (activeConv && socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { recipientId: activeConv._id });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { recipientId: activeConv._id });
      }, 2000);
    }
  };

  // Filter conversations
  const filteredConvs = conversations.filter(c =>
    !search || (c.other?.name || c.other?.email || '').toLowerCase().includes(search.toLowerCase())
  );

  // Filter members for new chat
  const filteredMembers = members.filter(m =>
    m._id !== user?._id && (m.name || m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const isOwn = (msg) => {
    // user peut être { _id } ou { id } selon la source
    const uid = normalizeId(user?._id || user?.id || user?.userId);
    const sid = normalizeId(msg?.senderId?._id || msg?.senderId);
    if (!uid || !sid) return false;
    return sid === uid;
  };

  const ROLE_LABELS = { ecom_admin: 'Admin', ecom_closeuse: 'Closeuse', ecom_compta: 'Compta', ecom_livreur: 'Livreur', super_admin: 'Super Admin' };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 lg:static lg:h-[calc(100vh-56px)] bg-slate-50 flex flex-col z-10">

      {/* ═══════ LIST VIEW ═══════ */}
      {view === 'list' && (
        <div className="flex-1 flex flex-col bg-white">
          {/* Header plateforme */}
          <div className="bg-white border-b border-slate-200 px-4 pt-4 pb-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button onClick={goBackFromList} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Messages</h1>
                  <p className="text-xs text-slate-400">{conversations.length} conversation{conversations.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => tab === 'dm' ? setShowNewChat(true) : setShowNewGroup(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </div>
            {/* Search */}
            <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2 mb-3">
              <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une conversation..." className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400" />
            </div>
            {/* Tabs */}
            <div className="flex gap-1">
              <button onClick={() => setTab('dm')} className={`flex-1 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${tab === 'dm' ? 'text-blue-600 border-blue-600 bg-blue-50' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                💬 Discussions
              </button>
              <button onClick={() => setTab('groups')} className={`flex-1 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${tab === 'groups' ? 'text-blue-600 border-blue-600 bg-blue-50' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                👥 Groupes
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Chargement...</p>
              </div>
            ) : tab === 'dm' ? (
              filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">Aucune conversation</p>
                  <p className="text-sm text-slate-400 mb-4">Démarrez une discussion avec un membre de l'équipe</p>
                  <button onClick={() => setShowNewChat(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">Nouvelle conversation</button>
                </div>
              ) : filteredConvs.map(conv => {
                const other = conv.other;
                if (!other) return null;
                const hasUnread = conv.unread > 0;
                return (
                  <button
                    key={conv._id || other._id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 text-left transition-colors ${hasUnread ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 ${ROLE_COLORS[other.role] || 'bg-slate-400'} rounded-2xl flex items-center justify-center shadow-sm`}>
                        <span className="text-white text-lg font-bold">{getInitial(other.name)}</span>
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[15px] truncate ${hasUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>{other.name || other.email?.split('@')[0]}</span>
                        <span className={`text-[11px] flex-shrink-0 ml-2 ${hasUnread ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>{conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${hasUnread ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{conv.preview || 'Démarrer la conversation'}</p>
                        {hasUnread && <span className="ml-2 min-w-[20px] h-5 bg-blue-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 flex-shrink-0">{conv.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <p className="font-semibold text-slate-700 mb-1">Aucun groupe</p>
                  <p className="text-sm text-slate-400 mb-4">Créez un canal pour collaborer en équipe</p>
                  <button onClick={() => setShowNewGroup(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">Créer un groupe</button>
                </div>
              ) : channels.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase())).map((channel, idx) => (
                <button
                  key={channel._id || channel.slug}
                  onClick={() => openChannel(channel)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 text-left transition-colors"
                >
                  <div className={`w-12 h-12 ${CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-2xl">{channel.emoji || '💬'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{channel.name}</p>
                    <p className="text-sm text-slate-400 truncate mt-0.5">{channel.description || 'Canal de discussion'}</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════ CHAT VIEW ═══════ */}
      {view === 'chat' && (activeConv || activeChannel) && (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-slate-200 px-3 py-3 flex items-center gap-3 shadow-sm">
            <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 flex-shrink-0 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            {activeChannel ? (
              <>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-xl">{activeChannel.emoji || '💬'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{activeChannel.name}</p>
                  <p className="text-xs text-slate-400">Canal de groupe</p>
                </div>
              </>
            ) : activeConv ? (
              <>
                <div className={`w-10 h-10 ${ROLE_COLORS[activeConv.role] || 'bg-slate-400'} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-lg">{getInitial(activeConv.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{activeConv.name || activeConv.email?.split('@')[0]}</p>
                  {typing
                    ? <p className="text-xs text-emerald-500 font-medium">✍️ écrit...</p>
                    : <p className="text-xs text-slate-400">{ROLE_LABELS[activeConv.role] || 'Membre'}</p>
                  }
                </div>
              </>
            ) : null}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Chargement...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <p className="text-slate-400 text-sm">Démarrez la conversation</p>
              </div>
            ) : messages.map((msg, idx) => {
              const own = isOwn(msg);
              const prev = messages[idx - 1];
              const next = messages[idx + 1];
              const prevOwn = prev ? isOwn(prev) : null;
              const nextOwn = next ? isOwn(next) : null;
              // Grouper les messages consécutifs du même expéditeur
              const isFirst = prevOwn !== own;
              const isLast = nextOwn !== own;
              const showDate = !prev || new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
              const showTimeSep = !prev || new Date(msg.createdAt) - new Date(prev.createdAt) > 600000;
              // Dans un groupe, afficher le nom seulement sur le premier message du destinataire
              const showSenderName = !own && isFirst && !!activeChannel;

              return (
                <div key={msg._id}>
                  {/* Séparateur de date */}
                  {(showDate || showTimeSep) && (
                    <div className="flex items-center justify-center my-4">
                      <span className="bg-white text-slate-400 text-[11px] font-medium px-3 py-1 rounded-full shadow-sm border border-slate-200">
                        {showDate
                          ? new Date(msg.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                          : new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  <div className={`flex items-end gap-1 ${own ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-2' : 'mb-0.5'}`}>

                    {/* Avatar destinataire */}
                    {!own && (
                      <div className="w-7 flex-shrink-0 self-end mb-0.5">
                        {isLast ? (
                          <div className={`w-7 h-7 ${ROLE_COLORS[(msg.senderId?.role || activeConv?.role)] || 'bg-slate-400'} rounded-lg flex items-center justify-center`}>
                            <span className="text-white text-[10px] font-bold">{getInitial(msg.senderName)}</span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Bulle */}
                    <div className={`relative max-w-[75%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>

                      {/* Nom expéditeur dans les groupes */}
                      {showSenderName && (
                        <span className="text-[11px] font-semibold ml-3 mb-0.5" style={{ color: stringToColor(msg.senderName) }}>
                          {msg.senderName}
                        </span>
                      )}

                      <div className={`relative px-3 py-2.5 shadow-sm
                        ${own
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-900 border border-slate-200'}
                        ${isFirst && own ? 'rounded-tl-2xl rounded-tr-sm rounded-bl-2xl rounded-br-2xl'
                          : isFirst && !own ? 'rounded-tl-sm rounded-tr-2xl rounded-bl-2xl rounded-br-2xl'
                          : 'rounded-2xl'}
                      `}>

                        {/* Queue de bulle */}
                        {isFirst && own && (
                          <svg className="absolute -right-[6px] bottom-0 w-3 h-3 text-blue-600" viewBox="0 0 8 13" fill="currentColor">
                            <path d="M5.188 1H1v11.193l6.467-8.625C8.334 2.116 7.607 1 5.188 1z" />
                          </svg>
                        )}
                        {isFirst && !own && (
                          <svg className="absolute -left-[6px] bottom-0 w-3 h-3 text-white" viewBox="0 0 8 13" fill="currentColor">
                            <path d="M2.812 1H7v11.193L.533 3.568C-.334 2.116.393 1 2.812 1z" />
                          </svg>
                        )}

                        {/* Reply preview */}
                        {(msg.replyToPreview || msg.replyToContent) && (
                          <div className={`border-l-[3px] pl-2 mb-2 rounded-r py-1 pr-2 ${own ? 'border-white/50 bg-white/10' : 'border-blue-400 bg-slate-50'}`}>
                            <p className={`text-[11px] font-semibold ${own ? 'text-white/80' : 'text-blue-600'}`}>
                              {msg.replyToPreview?.senderName || msg.replyToSenderName || ''}
                            </p>
                            <p className={`text-[12px] truncate ${own ? 'text-white/70' : 'text-slate-500'}`}>
                              {msg.replyToPreview?.content || msg.replyToContent || '📎 Média'}
                            </p>
                          </div>
                        )}

                        {/* Contenu */}
                        {msg.deleted ? (
                          <p className={`text-[14px] italic ${own ? 'text-white/50' : 'text-slate-400'}`}>🚫 Message supprimé</p>
                        ) : msg.messageType === 'audio' ? (
                          msg.mediaUrl ? (
                            <audio controls preload="metadata" src={msg.mediaUrl} className="w-[240px] max-w-full" />
                          ) : (
                            <span className={`text-[12px] ${own ? 'text-white/60' : 'text-slate-400'}`}>🎤 Audio indisponible</span>
                          )
                        ) : msg.messageType === 'image' ? (
                          <img src={msg.mediaUrl} alt="" className="max-w-full rounded-xl max-h-64 object-cover" />
                        ) : msg.messageType === 'video' ? (
                          <video src={msg.mediaUrl} controls className="max-w-full rounded-xl max-h-64" />
                        ) : msg.messageType === 'document' ? (
                          <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-2 rounded-xl px-2 py-2 min-w-[160px] ${own ? 'bg-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${own ? 'bg-white/20' : 'bg-blue-600'}`}>
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="min-w-0">
                              <p className={`text-[13px] font-medium truncate ${own ? 'text-white' : 'text-slate-800'}`}>{msg.metadata?.fileName || 'Document'}</p>
                              <p className={`text-[10px] ${own ? 'text-white/60' : 'text-slate-400'}`}>{msg.metadata?.fileSize ? `${Math.round(msg.metadata.fileSize / 1024)} Ko` : ''}</p>
                            </div>
                          </a>
                        ) : (
                          renderMessageContent(msg.content, own)
                        )}

                        {/* Heure + statut */}
                        <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
                          <span className={`text-[10px] leading-none ${own ? 'text-white/60' : 'text-slate-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {own && (
                            <svg className={`w-[14px] h-[14px] flex-shrink-0 ${msg.status === 'read' ? 'text-white' : 'text-white/50'}`} viewBox="0 0 16 11" fill="currentColor">
                              <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085 0l-3-3.5a.75.75 0 1 1 1.138-.976l2.458 2.869 5.904-6.428a.75.75 0 0 1 1.06-.025z"/>
                              <path d="M14.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085 0 .75.75 0 0 1 0-1.06l6.5-7a.75.75 0 0 1 1.06.025z" opacity=".5"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply preview */}
          {replyTo && (
            <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center gap-3">
              <div className="flex-1 border-l-2 border-blue-500 pl-3">
                <p className="text-xs font-bold text-blue-600">{replyTo.senderName}</p>
                <p className="text-xs text-slate-500 truncate">{replyTo.content || '📎 Média'}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          {/* Input */}
          <div className="bg-white border-t border-slate-200 px-3 py-3 flex items-end gap-2">
            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 bg-slate-100 rounded-2xl px-4 py-2.5">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-500 font-semibold text-sm">{formattedDuration}</span>
                <div className="flex-1" />
                <button onClick={cancelRecording} className="text-slate-400 hover:text-red-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <button onClick={stopRecording} className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" className="hidden" onChange={e => e.target.files?.[0] && sendFile(e.target.files[0])} />
                <div className="relative">
                  <button onClick={() => setShowShareMenu(!showShareMenu)} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                  {showShareMenu && (
                    <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-slate-200 w-52 overflow-hidden z-50">
                      <button onClick={() => { fileInputRef.current?.click(); setShowShareMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm">
                        <span className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center text-lg">📎</span>
                        <span className="font-semibold text-slate-700">Fichier</span>
                      </button>
                      {SHARE_TYPES.map(st => (
                        <button key={st.key} onClick={() => { setShareType(st.key); setShowShareMenu(false); setShareSearch(''); setShareResults([]); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left text-sm border-t border-slate-100">
                          <span className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-lg">{st.emoji}</span>
                          <span className="font-semibold text-slate-700">{st.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <form onSubmit={sendMessage} className="flex-1 flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => handleTyping(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                    placeholder="Écrire un message..."
                    className="flex-1 bg-slate-100 rounded-2xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none resize-none max-h-24 focus:bg-slate-50 focus:ring-2 focus:ring-blue-200 transition-all"
                    rows={1}
                    style={{ minHeight: '40px' }}
                  />
                  {newMessage.trim() ? (
                    <button type="submit" disabled={sending} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-2xl flex items-center justify-center text-white flex-shrink-0 transition-colors disabled:opacity-60">
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      )}
                    </button>
                  ) : (
                    <button type="button" onMouseDown={startRecording} className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-2xl flex items-center justify-center text-white flex-shrink-0 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════ NEW CHAT MODAL ═══════ */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setShowNewChat(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100 sm:rounded-t-2xl">
              <button onClick={() => setShowNewChat(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="font-bold text-slate-900">Nouvelle conversation</h2>
            </div>
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre..." className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">Aucun membre trouvé</p>
              ) : filteredMembers.map(m => (
                <button key={m._id} onClick={() => startNewChat(m)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors">
                  <div className={`w-11 h-11 ${ROLE_COLORS[m.role] || 'bg-slate-400'} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white text-base font-bold">{getInitial(m.name)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{m.name || m.email?.split('@')[0]}</p>
                    <p className="text-xs text-slate-400">{ROLE_LABELS[m.role] || m.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ NEW GROUP MODAL ═══════ */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => setShowNewGroup(false)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100">
              <button onClick={() => setShowNewGroup(false)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <h2 className="font-bold text-slate-900">Nouveau groupe</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Emoji</label>
                <div className="flex flex-wrap gap-2">
                  {['💬', '📦', '💰', '🚚', '📣', '📊', '🎯', '👥', '🔧', '🌟'].map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewGroupEmoji(em)}
                      className={`w-10 h-10 text-xl rounded-xl flex items-center justify-center transition-colors ${newGroupEmoji === em ? 'bg-blue-600 shadow-sm' : 'bg-slate-100 hover:bg-slate-200'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nom du groupe</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Ex: Équipe ventes, Livraisons..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                  autoFocus
                />
              </div>
              <button
                onClick={createChannel}
                disabled={!newGroupName.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Créer le groupe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ SHARE PLATFORM ELEMENT MODAL ═══════ */}
      {shareType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={() => { setShareType(null); setShareResults([]); }}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-100">
              <button onClick={() => { setShareType(null); setShareResults([]); }} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="font-bold text-slate-900">Partager {SHARE_TYPES.find(t => t.key === shareType)?.label}</h2>
                <p className="text-xs text-slate-400">Sélectionnez un élément à envoyer</p>
              </div>
            </div>
            <div className="p-3 border-b border-slate-100">
              <div className="flex items-center bg-slate-100 rounded-xl px-3 py-2">
                <svg className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={shareSearch}
                  onChange={e => setShareSearch(e.target.value)}
                  placeholder={`Rechercher ${SHARE_TYPES.find(t => t.key === shareType)?.label?.toLowerCase()}...`}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {shareLoading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Chargement...</p>
                </div>
              ) : shareResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <p className="text-slate-400 text-sm">{shareSearch ? 'Aucun résultat' : 'Tapez pour rechercher...'}</p>
                </div>
              ) : shareResults.map(item => {
                const card = formatShareCard(shareType, item);
                const cfg = SHARE_TYPES.find(t => t.key === shareType);
                return (
                  <button
                    key={item._id}
                    onClick={() => sendShareItem(shareType, item)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 text-left border-b border-slate-100 transition-colors"
                  >
                    <span className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{cfg?.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{card.title}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{card.subtitle}</p>
                    </div>
                    {card.price != null && card.price !== 0 && (
                      <span className="text-sm font-bold text-blue-600 flex-shrink-0">{Number(card.price).toLocaleString('fr-FR')} MAD</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
