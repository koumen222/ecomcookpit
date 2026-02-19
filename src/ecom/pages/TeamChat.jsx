import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useMediaUpload } from '../hooks/useMediaUpload.js';
import {
  AudioPlayer, ImageMessage, VideoMessage, DocumentMessage,
  ReplyPreview, MessageStatus, MessageReactions, TypingIndicator,
  RecordingIndicator, UploadProgress, EmojiPicker
} from '../components/MessageComponents.jsx';
import { io } from 'socket.io-client';

const EMOJIS = ['💬','📦','💰','🚚','🏭','📣','📊','🎯','🔔','⚡','🛒','👥','📝','🔧','🌟'];
const ROLE_COLORS = { ecom_admin:'bg-blue-600', ecom_closeuse:'bg-pink-500', ecom_compta:'bg-emerald-500', ecom_livreur:'bg-orange-500', super_admin:'bg-purple-600' };
const ROLE_LABELS = { ecom_admin:'Admin', ecom_closeuse:'Closeuse', ecom_compta:'Compta', ecom_livreur:'Livreur', super_admin:'Super Admin' };

const renderContent = (content, own) => {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className={`font-semibold ${own ? 'text-blue-100 bg-blue-500' : 'text-blue-700 bg-blue-50'} px-1 rounded`}>{part}</span>
      : part
  );
};

const formatTime = (d) => {
  const date = new Date(d), now = new Date();
  const diff = Math.floor((now - date) / 86400000);
  if (diff === 0) return date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  if (diff === 1) return 'Hier ' + date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  return date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
};
const getInitial = (n) => (n || 'U').charAt(0).toUpperCase();

export default function TeamChat() {
  const { user } = useEcomAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('channels');
  const [channels, setChannels] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelEmoji, setNewChannelEmoji] = useState('💬');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [members, setMembers] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmNewMessage, setDmNewMessage] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const [showStartDm, setShowStartDm] = useState(false);
  const [dmSearch, setDmSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState('list');

  // New state for WhatsApp-like features
  const [dmTyping, setDmTyping] = useState(false);
  const [dmTypingName, setDmTypingName] = useState('');
  const [dmReplyTo, setDmReplyTo] = useState(null);
  const [showDmEmojiPicker, setShowDmEmojiPicker] = useState(null); // messageId
  const [dmUploadPreview, setDmUploadPreview] = useState(null); // { file, kind, url }
  const [dmUploadProgress, setDmUploadProgress] = useState(0);
  const [dmCursor, setDmCursor] = useState(null);
  const [dmHasMore, setDmHasMore] = useState(false);
  const [dmLoadingMore, setDmLoadingMore] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const socketRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const dmEndRef = useRef(null);
  const inputRef = useRef(null);
  const dmInputRef = useRef(null);
  const pollRef = useRef(null);
  const dmPollRef = useRef(null);
  const lastMsgIdRef = useRef(null);
  const lastDmIdRef = useRef(null);
  const token = localStorage.getItem('ecomToken');

  // Audio recorder hook
  const {
    isRecording, duration: recDuration, formattedDuration,
    audioBlob, error: recError,
    startRecording, stopRecording, cancelRecording, clearRecording
  } = useAudioRecorder();

  // Media upload hook
  const { isUploading, progress: uploadProgress, uploadFile, uploadAudio, getMediaKind } = useMediaUpload();

  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api/ecom/messages${path}`, { ...opts, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...opts.headers } });
    return res.json();
  }, [token]);

  const dmFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(`/api/ecom/dm${path}`, { ...opts, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...opts.headers } });
    return res.json();
  }, [token]);

  const loadChannels = useCallback(async () => {
    try {
      const data = await apiFetch('/channels');
      if (data.success) { setChannels(data.channels); setUnreadCounts(data.unreadCounts||{}); if (!activeChannel && data.channels.length>0) setActiveChannel(data.channels[0].slug); }
    } catch (_) {}
  }, [apiFetch, activeChannel]);

  const loadMessages = useCallback(async (channel, pageNum=1, append=false) => {
    if (!channel) return;
    try {
      if (pageNum===1) setLoading(true); else setLoadingMore(true);
      const data = await apiFetch(`/${channel}?page=${pageNum}&limit=50`);
      if (data.success) {
        if (append) setMessages(prev => [...data.messages, ...prev]);
        else { setMessages(data.messages); lastMsgIdRef.current=data.messages[data.messages.length-1]?._id; setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:'smooth'}),100); }
        setHasMore(data.pagination.page<data.pagination.pages); setPage(pageNum); setUnreadCounts(prev=>({...prev,[channel]:0}));
      }
    } catch (_) {} finally { setLoading(false); setLoadingMore(false); }
  }, [apiFetch]);

  const pollMessages = useCallback(async () => {
    if (!activeChannel) return;
    try {
      const data = await apiFetch(`/${activeChannel}?page=1&limit=50`);
      if (data.success && data.messages.length>0) { const lid=data.messages[data.messages.length-1]?._id; if (lid!==lastMsgIdRef.current) { setMessages(data.messages); lastMsgIdRef.current=lid; setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:'smooth'}),100); } }
      const cd = await apiFetch('/channels'); if (cd.success) setUnreadCounts(cd.unreadCounts||{});
    } catch (err) {
      if (err?.status >= 400 && err?.status < 500) { clearInterval(pollRef.current); }
    }
  }, [apiFetch, activeChannel]);

  const loadMembers = useCallback(async () => {
    try { const data=await apiFetch('/team/members'); if (data.success) setMembers(data.members); } catch (_) {}
  }, [apiFetch]);

  const loadDmConversations = useCallback(async () => {
    try { const data=await dmFetch('/conversations'); if (data.success) setDmConversations(data.conversations); } catch (_) {}
  }, [dmFetch]);

  const loadDmMessages = useCallback(async (userId, cursor = null, append = false) => {
    if (!userId) return;
    if (!append) setDmLoading(true); else setDmLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (cursor) { params.set('cursor', cursor); params.set('direction', 'older'); }
      const data = await dmFetch(`/${userId}?${params}`);
      if (data.success) {
        if (append) {
          setDmMessages(prev => [...data.messages, ...prev]);
        } else {
          setDmMessages(data.messages);
          setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        setDmCursor(data.pagination?.oldestCursor || null);
        setDmHasMore(data.pagination?.hasMore || false);
        lastDmIdRef.current = data.messages[data.messages.length - 1]?._id;
        // Mark as read
        if (!append) {
          dmFetch(`/${userId}/read`, { method: 'POST' }).catch(() => {});
        }
      }
    } catch (_) {} finally { setDmLoading(false); setDmLoadingMore(false); }
  }, [dmFetch]);

  const pollDm = useCallback(async () => {
    if (!activeDmUser || socketRef.current?.connected) return; // Skip polling if WebSocket active
    try {
      const data = await dmFetch(`/${activeDmUser._id}?limit=50`);
      if (data.success && data.messages.length > 0) {
        const lid = data.messages[data.messages.length - 1]?._id;
        if (lid !== lastDmIdRef.current) {
          setDmMessages(data.messages);
          lastDmIdRef.current = lid;
          setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
      }
      loadDmConversations();
    } catch (err) {
      if (err?.status >= 400 && err?.status < 500) { clearInterval(dmPollRef.current); }
    }
  }, [dmFetch, activeDmUser, loadDmConversations]);

  // WebSocket initialization
  useEffect(() => {
    const t = localStorage.getItem('ecomToken');
    if (!t) return;
    const socket = io('', {
      auth: { token: t },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('message:new', (msg) => {
      // DM: add to list if conversation is open
      setDmMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      loadDmConversations();
    });

    socket.on('message:status', ({ messageIds, status }) => {
      setDmMessages(prev => prev.map(m =>
        messageIds.includes(m._id) ? { ...m, status } : m
      ));
    });

    socket.on('message:deleted', ({ messageId }) => {
      setDmMessages(prev => prev.filter(m => m._id !== messageId));
    });

    socket.on('message:reaction', ({ messageId, reactions }) => {
      setDmMessages(prev => prev.map(m =>
        m._id === messageId ? { ...m, metadata: { ...m.metadata, reactions } } : m
      ));
    });

    socket.on('typing:start', ({ userId, userName }) => {
      if (activeDmUser?._id === userId) {
        setDmTyping(true);
        setDmTypingName(userName);
      }
    });

    socket.on('typing:stop', ({ userId }) => {
      if (activeDmUser?._id === userId) {
        setDmTyping(false);
      }
    });

    socket.on('conversation:update', () => {
      loadDmConversations();
    });

    return () => { socket.disconnect(); };
  }, []);

  // Join conversation room when DM user changes
  useEffect(() => {
    if (activeDmUser && socketRef.current?.connected) {
      socketRef.current.emit('conversation:join', { recipientId: activeDmUser._id });
    }
    return () => {
      if (activeDmUser && socketRef.current?.connected) {
        socketRef.current.emit('conversation:leave', { recipientId: activeDmUser._id });
      }
    };
  }, [activeDmUser?._id]);

  // Auto-stop audio recording after 2 minutes
  useEffect(() => {
    if (isRecording && recDuration >= 120) stopRecording();
  }, [isRecording, recDuration, stopRecording]);

  // When audio recording stops and we have a blob, auto-send
  useEffect(() => {
    if (audioBlob && !isRecording && activeDmUser) {
      sendDmAudio();
    }
  }, [audioBlob, isRecording]);

  useEffect(() => { loadChannels(); loadMembers(); loadDmConversations(); }, []);
  useEffect(() => { if (searchParams.get('newDm') === '1') { setTab('dm'); setShowStartDm(true); } }, []);

  const openChannel = (slug) => { setActiveChannel(slug); setSidebarOpen(false); setMobileView('chat'); };
  const openDm = (otherUser) => { setActiveDmUser(otherUser); setTab('dm'); setSidebarOpen(false); setMobileView('chat'); };
  const goBackToList = () => { setMobileView('list'); };
  useEffect(() => { if (!activeChannel) return; loadMessages(activeChannel,1,false); clearInterval(pollRef.current); pollRef.current=setInterval(pollMessages,5000); return ()=>clearInterval(pollRef.current); }, [activeChannel]);
  useEffect(() => { if (!activeDmUser) return; loadDmMessages(activeDmUser._id); clearInterval(dmPollRef.current); dmPollRef.current=setInterval(pollDm,5000); return ()=>clearInterval(dmPollRef.current); }, [activeDmUser?._id]);

  const sendMessage = async (e) => {
    e.preventDefault(); if (!newMessage.trim()||sending) return; setSending(true);
    try { const data=await apiFetch(`/${activeChannel}`,{method:'POST',body:JSON.stringify({content:newMessage.trim(),replyTo:replyTo?._id||null})}); if (data.success) { setMessages(prev=>[...prev,data.message]); setNewMessage(''); setReplyTo(null); lastMsgIdRef.current=data.message._id; setTimeout(()=>messagesEndRef.current?.scrollIntoView({behavior:'smooth'}),50); } }
    catch (_) {} finally { setSending(false); inputRef.current?.focus(); }
  };

  const saveEdit = async (mid) => {
    if (!editContent.trim()) return;
    try { const data=await apiFetch(`/${activeChannel}/${mid}`,{method:'PUT',body:JSON.stringify({content:editContent.trim()})}); if (data.success) { setMessages(prev=>prev.map(m=>m._id===mid?data.message:m)); setEditingId(null); setEditContent(''); } } catch (_) {}
  };

  const deleteMessage = async (mid) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try { const data=await apiFetch(`/${activeChannel}/${mid}`,{method:'DELETE'}); if (data.success) setMessages(prev=>prev.filter(m=>m._id!==mid)); } catch (_) {}
  };

  const sendDm = async (e) => {
    e.preventDefault();
    if ((!dmNewMessage.trim() && !dmUploadPreview) || dmSending || !activeDmUser) return;
    setDmSending(true);
    try {
      const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const body = {
        content: dmNewMessage.trim(),
        clientMessageId,
        replyTo: dmReplyTo?._id || null
      };
      const data = await dmFetch(`/${activeDmUser._id}`, { method: 'POST', body: JSON.stringify(body) });
      if (data.success) {
        if (!dmMessages.some(m => m._id === data.message._id)) {
          setDmMessages(prev => [...prev, data.message]);
        }
        setDmNewMessage('');
        setDmReplyTo(null);
        lastDmIdRef.current = data.message._id;
        setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        loadDmConversations();
      }
    } catch (_) {} finally { setDmSending(false); dmInputRef.current?.focus(); }
  };

  const sendDmAudio = async () => {
    if (!audioBlob || !activeDmUser) return;
    setDmSending(true);
    try {
      const result = await uploadAudio(audioBlob, recDuration * 1000, (p) => setDmUploadProgress(p));
      if (result?.success) {
        const clientMessageId = `audio-${Date.now()}`;
        const data = await dmFetch(`/${activeDmUser._id}`, {
          method: 'POST',
          body: JSON.stringify({
            content: '',
            messageType: 'audio',
            mediaId: result.mediaId,
            mediaUrl: result.mediaUrl,
            metadata: { durationMs: recDuration * 1000, mimeType: audioBlob.type, fileSize: audioBlob.size },
            clientMessageId
          })
        });
        if (data.success) {
          if (!dmMessages.some(m => m._id === data.message._id)) {
            setDmMessages(prev => [...prev, data.message]);
          }
          setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          loadDmConversations();
        }
      }
    } catch (_) {} finally {
      setDmSending(false);
      setDmUploadProgress(0);
      clearRecording();
    }
  };

  const sendDmMedia = async (file) => {
    if (!file || !activeDmUser) return;
    const kind = getMediaKind(file);
    setDmSending(true);
    try {
      const result = await uploadFile(file, (p) => setDmUploadProgress(p));
      if (result?.success) {
        const clientMessageId = `media-${Date.now()}`;
        const data = await dmFetch(`/${activeDmUser._id}`, {
          method: 'POST',
          body: JSON.stringify({
            content: '',
            messageType: kind,
            mediaId: result.mediaId,
            mediaUrl: result.mediaUrl,
            metadata: { mimeType: file.type, fileName: file.name, fileSize: file.size },
            clientMessageId
          })
        });
        if (data.success) {
          if (!dmMessages.some(m => m._id === data.message._id)) {
            setDmMessages(prev => [...prev, data.message]);
          }
          setTimeout(() => dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
          loadDmConversations();
        }
      }
    } catch (_) {} finally {
      setDmSending(false);
      setDmUploadProgress(0);
      setDmUploadPreview(null);
    }
  };

  const handleDmFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = getMediaKind(file);
    const url = URL.createObjectURL(file);
    setDmUploadPreview({ file, kind, url, name: file.name });
    e.target.value = '';
  };

  const handleDmTyping = (value) => {
    setDmNewMessage(value);
    if (activeDmUser && socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { recipientId: activeDmUser._id });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socketRef.current?.emit('typing:stop', { recipientId: activeDmUser._id });
      }, 2000);
    }
  };

  const reactToDm = async (messageId, emoji, action) => {
    try {
      const data = await dmFetch(`/message/${messageId}/reaction`, {
        method: 'POST',
        body: JSON.stringify({ emoji, action })
      });
      if (data.success) {
        setDmMessages(prev => prev.map(m =>
          m._id === messageId ? { ...m, metadata: { ...m.metadata, reactions: data.reactions } } : m
        ));
      }
    } catch (_) {}
    setShowDmEmojiPicker(null);
  };

  const deleteDm = async (mid) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try { await dmFetch(`/message/${mid}`, { method: 'DELETE' }); setDmMessages(prev => prev.filter(m => m._id !== mid)); } catch (_) {}
  };

  const handleMentionInput = (value) => {
    setNewMessage(value);
    const atIdx=value.lastIndexOf('@');
    if (atIdx!==-1) { const after=value.slice(atIdx+1); if (!after.includes(' ')&&after.length<=20) { setMentionQuery(after); setShowMentions(true); setMentionIndex(0); return; } }
    setShowMentions(false);
  };

  const filteredMentions = members.filter(m=>(m.name||m.email||'').toLowerCase().includes(mentionQuery.toLowerCase())).slice(0,6);

  const insertMention = (member) => {
    const atIdx=newMessage.lastIndexOf('@'); const name=member.name||member.email?.split('@')[0]||'membre';
    setNewMessage(newMessage.slice(0,atIdx)+`@${name} `); setShowMentions(false); inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showMentions&&filteredMentions.length>0) {
      if (e.key==='ArrowDown') { e.preventDefault(); setMentionIndex(i=>Math.min(i+1,filteredMentions.length-1)); return; }
      if (e.key==='ArrowUp') { e.preventDefault(); setMentionIndex(i=>Math.max(i-1,0)); return; }
      if (e.key==='Enter'||e.key==='Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
      if (e.key==='Escape') { setShowMentions(false); return; }
    }
    if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(e); }
    if (e.key==='Escape') { setReplyTo(null); setEditingId(null); }
  };

  const isOwn = (msg) => { const sid=msg.senderId?._id||msg.senderId; return sid?.toString()===user?._id?.toString(); };
  const isAdmin = ['ecom_admin','super_admin'].includes(user?.role);

  const createChannel = async (e) => {
    e.preventDefault(); if (!newChannelName.trim()||creatingChannel) return; setCreatingChannel(true);
    try { const data=await apiFetch('/channels',{method:'POST',body:JSON.stringify({name:newChannelName.trim(),emoji:newChannelEmoji,description:newChannelDesc.trim()})}); if (data.success) { setShowNewChannel(false); setNewChannelName(''); setNewChannelEmoji('💬'); setNewChannelDesc(''); await loadChannels(); setActiveChannel(data.channel.slug); } else alert(data.message||'Erreur'); }
    catch (_) {} finally { setCreatingChannel(false); }
  };

  const deleteChannel = async (slug) => {
    if (!window.confirm('Supprimer ce canal ?')) return;
    try { await apiFetch(`/channels/${slug}`,{method:'DELETE'}); await loadChannels(); if (activeChannel===slug) setActiveChannel(channels.find(c=>c.slug!==slug)?.slug||null); } catch (_) {}
  };

  const activeChannelObj = channels.find(c=>c.slug===activeChannel);
  const totalChUnread = Object.values(unreadCounts).reduce((a,b)=>a+b,0);
  const totalDmUnread = dmConversations.reduce((a,c)=>a+(c.unread||0),0);
  const filteredMembers = members.filter(m=>m._id!==user?._id&&(m.name||m.email||'').toLowerCase().includes(dmSearch.toLowerCase()));

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  return (
    <div className="flex h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] overflow-hidden relative">

      {/* ═══════ MOBILE DRAWER BACKDROP ═══════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══════ SIDEBAR ═══════ */}
      <div className={`
        fixed top-0 left-0 h-full w-[280px] bg-[#1e1f22] flex flex-col z-40 transition-transform duration-300 ease-in-out
        lg:static lg:w-64 lg:translate-x-0 lg:z-auto lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ paddingTop: sidebarOpen ? 'env(safe-area-inset-top, 0px)' : undefined }}>
        <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-bold text-sm flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            Chat Équipe
          </h2>
        </div>

        <div className="flex px-2 pt-2 gap-1 flex-shrink-0">
          <button onClick={()=>setTab('channels')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors relative ${tab==='channels'?'bg-white/15 text-white':'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
            Canaux
            {totalChUnread>0&&tab!=='channels'&&<span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">{totalChUnread}</span>}
          </button>
          <button onClick={()=>setTab('dm')} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors relative ${tab==='dm'?'bg-white/15 text-white':'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Messages
            {totalDmUnread>0&&tab!=='dm'&&<span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">{totalDmUnread}</span>}
          </button>
        </div>

        {tab==='channels' && (
          <div className="flex-1 overflow-y-auto py-2 px-1">
            <div className="flex items-center justify-between px-2 py-1 mb-0.5">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Canaux</span>
              <button onClick={()=>setShowNewChannel(true)} className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-white rounded hover:bg-white/10 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            {channels.length===0 ? (
              <div className="px-3 py-5 text-center"><p className="text-xs text-gray-500">Aucun canal</p><button onClick={()=>setShowNewChannel(true)} className="mt-1 text-xs text-blue-400 hover:text-blue-300">Créer un canal</button></div>
            ) : channels.map(ch => {
              const unread=unreadCounts[ch.slug]||0; const isActive=activeChannel===ch.slug;
              return (
                <div key={ch.slug} className="group relative">
                  <button onClick={()=>{setActiveChannel(ch.slug);setSidebarOpen(false);}} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors ${isActive?'bg-white/15 text-white':'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                    <span className="text-base leading-none flex-shrink-0">{ch.emoji}</span>
                    <span className="flex-1 text-left truncate">{ch.name}</span>
                    {unread>0&&<span className="min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold">{unread>99?'99+':unread}</span>}
                  </button>
                  {isAdmin&&<button onClick={()=>deleteChannel(ch.slug)} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 rounded transition-all"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
              );
            })}
          </div>
        )}

        {tab==='dm' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 pt-2 pb-1 flex-shrink-0">
              <button onClick={()=>setShowStartDm(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Démarrer une conversation
              </button>
            </div>
            <div className="px-3 py-1 flex-shrink-0"><span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Conversations</span></div>
            <div className="flex-1 overflow-y-auto px-1">
              {dmConversations.length===0 ? (
                <div className="px-3 py-6 text-center">
                  <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2"><svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg></div>
                  <p className="text-xs text-gray-500">Aucune conversation</p>
                  <button onClick={()=>setShowStartDm(true)} className="mt-1 text-xs text-blue-400 hover:text-blue-300">Envoyer un message</button>
                </div>
              ) : dmConversations.map(conv => {
                const other=conv.other; if (!other) return null;
                const isActive=activeDmUser?._id?.toString()===other._id?.toString();
                return (
                  <button key={conv._id||other._id} onClick={()=>{setActiveDmUser(other);setSidebarOpen(false);}} className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors mb-0.5 text-left ${isActive?'bg-white/15':'hover:bg-white/5'}`}>
                    <div className="relative flex-shrink-0">
                      <div className={`w-9 h-9 ${ROLE_COLORS[other.role]||'bg-gray-500'} rounded-full flex items-center justify-center`}><span className="text-white text-xs font-bold">{getInitial(other.name)}</span></div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1e1f22]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-[13px] font-medium truncate ${isActive?'text-white':'text-gray-300'}`}>{other.name||other.email?.split('@')[0]}</span>
                        {conv.lastMessage&&<span className="text-[10px] text-gray-500 flex-shrink-0 ml-1">{formatTime(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-500 truncate">{conv.lastMessage?.content||ROLE_LABELS[other.role]||''}</p>
                        {conv.unread>0&&<span className="min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex-shrink-0 ml-1">{conv.unread}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-t border-white/10 flex-shrink-0 flex items-center gap-2">
          <div className={`w-7 h-7 ${ROLE_COLORS[user?.role]||'bg-gray-500'} rounded-full flex items-center justify-center flex-shrink-0`}><span className="text-white text-[10px] font-bold">{getInitial(user?.name)}</span></div>
          <div className="min-w-0 flex-1"><p className="text-xs font-medium text-white truncate">{user?.name||user?.email?.split('@')[0]}</p><p className="text-[10px] text-gray-400">{ROLE_LABELS[user?.role]||user?.role}</p></div>
        </div>
      </div>

      {/* ═══════ ZONE PRINCIPALE ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-white w-full">

        {tab === 'dm' && activeDmUser ? (
          <>
            <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0 lg:px-5 lg:py-3">
              <div className="flex items-center gap-2 lg:gap-3">
                <button onClick={()=>setSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-full flex-shrink-0 -ml-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="relative">
                  <div className={`w-9 h-9 ${ROLE_COLORS[activeDmUser.role]||'bg-gray-400'} rounded-full flex items-center justify-center`}><span className="text-white text-sm font-bold">{getInitial(activeDmUser.name)}</span></div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{activeDmUser.name||activeDmUser.email?.split('@')[0]}</h3>
                  <p className="text-xs text-gray-400">{ROLE_LABELS[activeDmUser.role]||activeDmUser.role} · Message privé</p>
                </div>
              </div>
              <button onClick={()=>loadDmMessages(activeDmUser._id)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-gray-50 lg:px-6 lg:py-4">
              {dmLoading ? (
                <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              ) : dmMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className={`w-16 h-16 ${ROLE_COLORS[activeDmUser.role]||'bg-gray-300'} rounded-full flex items-center justify-center mx-auto mb-3`}><span className="text-white text-2xl font-bold">{getInitial(activeDmUser.name)}</span></div>
                    <p className="font-semibold text-gray-800">{activeDmUser.name||activeDmUser.email?.split('@')[0]}</p>
                    <p className="text-sm text-gray-400 mt-1">Démarrez la conversation</p>
                  </div>
                </div>
              ) : dmMessages.map((msg, idx) => {
                const own=(msg.senderId?._id||msg.senderId)?.toString()===user?._id?.toString();
                const prev=dmMessages[idx-1];
                const showHeader=!prev||(prev.senderId?._id||prev.senderId)?.toString()!==(msg.senderId?._id||msg.senderId)?.toString()||new Date(msg.createdAt)-new Date(prev.createdAt)>300000;
                const reactions = msg.metadata?.reactions || {};
                const hasReactions = Object.keys(reactions).length > 0;
                return (
                  <div key={msg._id} className={`flex gap-2 lg:gap-3 ${own?'flex-row-reverse':'flex-row'} ${showHeader?'mt-4':'mt-0.5'} group`}>
                    {showHeader ? <div className={`w-8 h-8 ${ROLE_COLORS[msg.senderRole]||'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}><span className="text-white text-xs font-bold">{getInitial(msg.senderName)}</span></div> : <div className="w-8 flex-shrink-0" />}
                    <div className={`max-w-[75%] lg:max-w-[65%] flex flex-col ${own?'items-end':'items-start'}`}>
                      {showHeader && <div className={`flex items-center gap-2 mb-1 ${own?'flex-row-reverse':'flex-row'}`}><span className="text-xs font-semibold text-gray-700">{own?'Vous':msg.senderName}</span><span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span></div>}

                      {/* Reply preview */}
                      {msg.replyToPreview && (
                        <div className={`mb-1 px-2.5 py-1.5 rounded-lg border-l-2 text-xs max-w-full ${own?'border-blue-300 bg-blue-500/20 text-blue-100':'border-gray-400 bg-gray-100 text-gray-600'}`}>
                          <p className={`font-semibold mb-0.5 ${own?'text-blue-200':'text-gray-700'}`}>{msg.replyToPreview.senderName}</p>
                          <p className="truncate opacity-80">
                            {msg.replyToPreview.messageType==='audio'?'🎤 Message vocal':msg.replyToPreview.messageType==='image'?'📷 Photo':msg.replyToPreview.messageType==='video'?'🎬 Vidéo':msg.replyToPreview.messageType==='document'?'📎 Document':msg.replyToPreview.content}
                          </p>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div className={`relative rounded-2xl text-[14px] leading-relaxed break-words ${own?'bg-blue-600 text-white rounded-tr-sm':'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'} ${msg.messageType!=='text'?'p-2':'px-3 py-2 lg:px-4 lg:py-2.5'}`}>
                        {msg.deleted ? (
                          <span className="italic opacity-60 text-sm">Message supprimé</span>
                        ) : msg.messageType === 'audio' ? (
                          <div className={`${own?'text-white':'text-gray-800'}`}>
                            <AudioPlayer src={msg.mediaUrl} duration={msg.metadata?.durationMs || 0} />
                          </div>
                        ) : msg.messageType === 'image' ? (
                          <ImageMessage src={msg.mediaUrl} onClick={() => setLightboxSrc(msg.mediaUrl)} />
                        ) : msg.messageType === 'video' ? (
                          <VideoMessage src={msg.mediaUrl} />
                        ) : msg.messageType === 'document' ? (
                          <DocumentMessage fileName={msg.metadata?.fileName} fileSize={msg.metadata?.fileSize} src={msg.mediaUrl} />
                        ) : (
                          <>
                            {renderContent(msg.content, own)}
                            {msg.edited && <span className={`text-[10px] ml-1.5 ${own?'text-blue-200':'text-gray-400'}`}>(modifié)</span>}
                          </>
                        )}
                        {/* Status for own messages */}
                        {own && (
                          <div className="flex justify-end mt-0.5">
                            <MessageStatus status={msg.status} />
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {hasReactions && (
                        <MessageReactions
                          reactions={reactions}
                          userId={user?._id}
                          onReact={(emoji, action) => reactToDm(msg._id, emoji, action)}
                        />
                      )}

                      {!showHeader && <span className="text-[10px] text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(msg.createdAt)}</span>}
                    </div>

                    {/* Action buttons on hover */}
                    <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center relative ${own?'flex-row':'flex-row-reverse'}`}>
                      <button onClick={() => setDmReplyTo(msg)} className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-blue-50" title="Répondre">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                      </button>
                      <div className="relative">
                        <button onClick={() => setShowDmEmojiPicker(showDmEmojiPicker === msg._id ? null : msg._id)} className="p-1.5 text-gray-400 hover:text-yellow-500 rounded-lg hover:bg-yellow-50" title="Réaction">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        {showDmEmojiPicker === msg._id && (
                          <EmojiPicker
                            onSelect={(emoji) => reactToDm(msg._id, emoji, 'add')}
                            onClose={() => setShowDmEmojiPicker(null)}
                          />
                        )}
                      </div>
                      {own && !msg.deleted && (
                        <button onClick={() => deleteDm(msg._id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Supprimer">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Typing indicator */}
              {dmTyping && <TypingIndicator userName={dmTypingName} />}
              <div ref={dmEndRef} />
            </div>

            {/* DM Input area */}
            <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex-shrink-0 lg:px-4 lg:py-3">
              {/* Load more */}
              {dmHasMore && !dmLoadingMore && (
                <button onClick={() => loadDmMessages(activeDmUser._id, dmCursor, true)} className="w-full text-xs text-blue-500 hover:text-blue-700 py-1 mb-2">
                  Charger les messages précédents
                </button>
              )}

              {/* Reply preview */}
              {dmReplyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 rounded-xl border-l-2 border-blue-400">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-600">↩ {dmReplyTo.senderName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {dmReplyTo.messageType==='audio'?'🎤 Message vocal':dmReplyTo.messageType==='image'?'📷 Photo':dmReplyTo.content?.substring(0,60)}
                    </p>
                  </div>
                  <button onClick={() => setDmReplyTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              {/* Upload preview */}
              {dmUploadPreview && (
                <div className="mb-2 p-2 bg-gray-50 rounded-xl border flex items-center gap-3">
                  {dmUploadPreview.kind === 'image' ? (
                    <img src={dmUploadPreview.url} className="w-16 h-16 object-cover rounded-lg" alt="preview" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-2xl">
                      {dmUploadPreview.kind === 'audio' ? '🎵' : dmUploadPreview.kind === 'video' ? '🎬' : '📎'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{dmUploadPreview.name}</p>
                    <p className="text-xs text-gray-400">{dmUploadPreview.kind}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendDmMedia(dmUploadPreview.file)} disabled={dmSending} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {dmSending ? 'Envoi...' : 'Envoyer'}
                    </button>
                    <button onClick={() => setDmUploadPreview(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload progress */}
              {isUploading && dmUploadProgress > 0 && (
                <div className="mb-2">
                  <UploadProgress progress={dmUploadProgress} fileName={dmUploadPreview?.name || 'Fichier'} />
                </div>
              )}

              {/* Recording indicator */}
              {isRecording ? (
                <RecordingIndicator
                  duration={formattedDuration}
                  onCancel={cancelRecording}
                  onStop={stopRecording}
                />
              ) : (
                <form onSubmit={sendDm} className="flex items-end gap-2">
                  {/* File attachment button */}
                  <input ref={fileInputRef} type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={handleDmFileSelect} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-blue-500 rounded-xl hover:bg-blue-50 transition-colors" title="Joindre un fichier">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>

                  {/* Text input */}
                  <textarea
                    ref={dmInputRef}
                    value={dmNewMessage}
                    onChange={e => handleDmTyping(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendDm(e); } }}
                    placeholder={`Message à ${activeDmUser.name?.split(' ')[0]}...`}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                    rows={1}
                    style={{ minHeight: '42px', maxHeight: '120px' }}
                    onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px'; }}
                  />

                  {/* Send or mic button */}
                  {dmNewMessage.trim() || dmUploadPreview ? (
                    <button type="submit" disabled={dmSending} className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors">
                      {dmSending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                    </button>
                  ) : (
                    <button type="button" onMouseDown={startRecording} onTouchStart={startRecording} className="flex-shrink-0 w-10 h-10 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-xl flex items-center justify-center transition-colors" title="Maintenir pour enregistrer">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        ) : tab === 'dm' ? (
          <div className="flex-1 flex flex-col bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center gap-2 flex-shrink-0 lg:hidden">
              <button onClick={()=>setSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-full flex-shrink-0 -ml-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <h3 className="font-semibold text-gray-900 text-[15px]">Messages directs</h3>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg></div>
                <h3 className="font-semibold text-gray-700 text-lg">Messages directs</h3>
                <p className="text-sm text-gray-400 mt-1 mb-4">Sélectionnez une conversation ou démarrez-en une nouvelle</p>
                <button onClick={()=>setShowStartDm(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">Démarrer une conversation</button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0 lg:px-5 lg:py-3">
              <div className="flex items-center gap-2 lg:gap-3">
                <button onClick={()=>setSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center text-gray-500 active:bg-gray-100 rounded-full flex-shrink-0 -ml-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <span className="text-xl">{activeChannelObj?.emoji||'💬'}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{activeChannelObj?.name||(activeChannel||'Aucun canal')}</h3>
                  <p className="text-xs text-gray-400 hidden lg:block">{activeChannelObj?.description||''}{activeChannelObj?.description?' · ':''}{messages.length} messages</p>
                  <p className="text-xs text-gray-400 lg:hidden">{messages.length} messages</p>
                </div>
              </div>
              <button onClick={()=>activeChannel&&loadMessages(activeChannel,1,false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 bg-gray-50 lg:px-6 lg:py-4">
              {hasMore && <div className="flex justify-center mb-4"><button onClick={()=>loadMessages(activeChannel,page+1,true)} disabled={loadingMore} className="text-sm text-blue-600 font-medium px-4 py-1.5 rounded-full border border-blue-200 hover:bg-blue-50 disabled:opacity-50">{loadingMore?'Chargement...':'Charger plus'}</button></div>}
              {loading ? (
                <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
              ) : !activeChannel ? (
                <div className="flex items-center justify-center h-full"><div className="text-center"><p className="text-gray-500 font-medium">Sélectionnez ou créez un canal</p><button onClick={()=>setShowNewChannel(true)} className="mt-2 text-sm text-blue-600 hover:underline">Créer un canal</button></div></div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full"><div className="text-center"><div className="text-4xl mb-3">{activeChannelObj?.emoji||'💬'}</div><p className="font-semibold text-gray-700">Bienvenue dans #{activeChannelObj?.name||activeChannel}</p><p className="text-sm text-gray-400 mt-1">Soyez le premier à écrire !</p></div></div>
              ) : messages.map((msg, idx) => {
                const own=isOwn(msg);
                const prev=messages[idx-1];
                const showHeader=!prev||(prev.senderId?._id||prev.senderId)?.toString()!==(msg.senderId?._id||msg.senderId)?.toString()||new Date(msg.createdAt)-new Date(prev.createdAt)>300000;
                return (
                  <div key={msg._id} className={`flex gap-2 lg:gap-3 ${own?'flex-row-reverse':'flex-row'} ${showHeader?'mt-4':'mt-0.5'} group`}>
                    {showHeader ? <div className={`w-8 h-8 ${ROLE_COLORS[msg.senderRole]||'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}><span className="text-white text-xs font-bold">{getInitial(msg.senderName)}</span></div> : <div className="w-8 flex-shrink-0" />}
                    <div className={`max-w-[78%] lg:max-w-[65%] flex flex-col ${own?'items-end':'items-start'}`}>
                      {showHeader && <div className={`flex items-center gap-1.5 lg:gap-2 mb-1 ${own?'flex-row-reverse':'flex-row'}`}><span className="text-xs font-semibold text-gray-700">{msg.senderName}</span><span className={`text-[10px] px-1.5 py-0.5 rounded-full text-white hidden lg:inline ${ROLE_COLORS[msg.senderRole]||'bg-gray-400'}`}>{ROLE_LABELS[msg.senderRole]||msg.senderRole}</span><span className="text-[10px] text-gray-400">{formatTime(msg.createdAt)}</span></div>}
                      {msg.replyToContent && <div className="mb-1 px-3 py-1.5 rounded-lg border-l-2 border-blue-400 bg-blue-50 text-xs text-gray-600 max-w-full"><p className="font-medium text-blue-600 mb-0.5">{msg.replyToSenderName}</p><p className="truncate">{msg.replyToContent}</p></div>}
                      {editingId===msg._id ? (
                        <div className="w-full min-w-[200px]">
                          <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();saveEdit(msg._id);}if(e.key==='Escape'){setEditingId(null);setEditContent('');}}} className="w-full px-3 py-2 border border-blue-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" rows={2} autoFocus />
                          <div className="flex gap-2 mt-1 justify-end"><button onClick={()=>{setEditingId(null);setEditContent('');}} className="text-xs text-gray-500 hover:text-gray-700">Annuler</button><button onClick={()=>saveEdit(msg._id)} className="text-xs text-blue-600 font-medium hover:text-blue-700">Sauvegarder</button></div>
                        </div>
                      ) : (
                        <div className={`px-3 py-2 lg:px-4 lg:py-2.5 rounded-2xl text-[14px] leading-relaxed break-words ${own?'bg-blue-600 text-white rounded-tr-sm':'bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm'}`}>{renderContent(msg.content,own)}{msg.edited&&<span className={`text-[10px] ml-1.5 ${own?'text-blue-200':'text-gray-400'}`}>(modifié)</span>}</div>
                      )}
                      {!showHeader && <span className="text-[10px] text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{formatTime(msg.createdAt)}</span>}
                    </div>
                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center ${own?'flex-row':'flex-row-reverse'}`}>
                      <button onClick={()=>setReplyTo(msg)} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                      {isOwn(msg)&&<button onClick={()=>{setEditingId(msg._id);setEditContent(msg.content);}} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
                      {(isOwn(msg)||isAdmin)&&<button onClick={()=>deleteMessage(msg._id)} className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex-shrink-0 lg:px-4 lg:py-3">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 rounded-lg border-l-2 border-blue-400">
                  <div className="flex-1 min-w-0"><p className="text-xs font-medium text-blue-600">Répondre à {replyTo.senderName}</p><p className="text-xs text-gray-600 truncate">{replyTo.content}</p></div>
                  <button onClick={()=>setReplyTo(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-end gap-2 relative">
                {showMentions&&filteredMentions.length>0&&(
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20">
                    {filteredMentions.map((m,i)=>(
                      <button key={m._id} type="button" onClick={()=>insertMention(m)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${i===mentionIndex?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-50'}`}>
                        <div className={`w-6 h-6 ${ROLE_COLORS[m.role]||'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0`}><span className="text-white text-[10px] font-bold">{getInitial(m.name||m.email)}</span></div>
                        <span className="flex-1 text-left font-medium truncate">{m.name||m.email?.split('@')[0]}</span>
                        <span className="text-[10px] text-gray-400">{ROLE_LABELS[m.role]||''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea ref={inputRef} value={newMessage} onChange={e=>handleMentionInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={`Message dans #${activeChannelObj?.name||activeChannel||'...'}  (@mention)`} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50" rows={1} style={{minHeight:'42px',maxHeight:'120px'}} onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,120)+'px';}} />
                <button type="submit" disabled={!newMessage.trim()||sending} className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors">
                  {sending?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                </button>
              </form>
              <p className="hidden lg:block text-[10px] text-gray-400 mt-1 ml-1">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · Échap pour annuler</p>
            </div>
          </>
        )}
      </div>

      {showNewChannel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowNewChannel(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nouveau canal</h3>
            <form onSubmit={createChannel} className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Emoji</label><div className="flex flex-wrap gap-1.5">{EMOJIS.map(em=><button key={em} type="button" onClick={()=>setNewChannelEmoji(em)} className={`w-8 h-8 text-lg rounded-lg flex items-center justify-center transition-colors ${newChannelEmoji===em?'bg-blue-100 ring-2 ring-blue-500':'hover:bg-gray-100'}`}>{em}</button>)}</div></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Nom du canal *</label><input type="text" value={newChannelName} onChange={e=>setNewChannelName(e.target.value)} placeholder="ex: commandes, livraisons..." className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Description (optionnel)</label><input type="text" value={newChannelDesc} onChange={e=>setNewChannelDesc(e.target.value)} placeholder="À quoi sert ce canal ?" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowNewChannel(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={!newChannelName.trim()||creatingChannel} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-medium transition-colors">{creatingChannel?'Création...':'Créer le canal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStartDm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>{setShowStartDm(false);setDmSearch('');}}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e=>e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Nouvelle conversation</h3>
            <input type="text" value={dmSearch} onChange={e=>setDmSearch(e.target.value)} placeholder="Rechercher un membre..." className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" autoFocus />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredMembers.length===0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun membre trouvé</p>
              ) : filteredMembers.map(m=>(
                <button key={m._id} onClick={()=>{setActiveDmUser(m);setTab('dm');setShowStartDm(false);setDmSearch('');}}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left">
                  <div className={`w-9 h-9 ${ROLE_COLORS[m.role]||'bg-gray-400'} rounded-full flex items-center justify-center flex-shrink-0`}><span className="text-white text-xs font-bold">{getInitial(m.name)}</span></div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.name||m.email?.split('@')[0]}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[m.role]||m.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Image lightbox */}
      {lightboxSrc && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightboxSrc(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={lightboxSrc} alt="Image" className="max-w-full max-h-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
