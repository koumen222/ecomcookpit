import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi';
import ecomApi from '../services/ecommApi.js';

/**
 * Props:
 *  - mode: 'storepage' | 'product' | 'premium'
 *  - context: object passed to the backend (sections, productPageConfig, theme, productName, etc.)
 *  - onPatch: function called with { pageConfigPatch, themePatch, sectionsPatch } when AI responds
 *  - welcomeMessage: optional custom welcome string
 */
export default function BuilderAiChat({ mode = 'product', context = {}, onPatch, welcomeMessage }) {
  const defaultWelcome = mode === 'storepage'
    ? 'Salut ! Je suis ton assistant IA pour la page boutique.\n\nExemples :\n- "Ajoute une section hero avec fond vert"\n- "Change le titre du hero en Nos Meilleures Ventes"\n- "Ajoute une section témoignages"\n- "Cache la section FAQ"'
    : 'Salut ! Je suis ton assistant IA pour la page produit.\n\nExemples :\n- "Mets le bouton en orange"\n- "Ajoute 10 avantages dans le hero"\n- "Change l\'image hero"\n- "Cache la section FAQ"\n- "Ajoute un timer de 15 minutes"';

  const [open, setOpen] = useState(false);
  const [model, setModel] = useState('claude-sonnet');
  const [messages, setMessages] = useState([{ role: 'assistant', content: welcomeMessage || defaultWelcome }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [medias, setMedias] = useState([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const handleFileAdd = useCallback(async (files) => {
    const toAdd = [];
    for (const file of Array.from(files)) {
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isAudio && !isVideo && !isImage) continue;
      let uploadedUrl = null;
      try {
        const res = await storeProductsApi.uploadImages([file]);
        uploadedUrl = res?.data?.urls?.[0] || res?.data?.data?.[0]?.url || null;
      } catch {}
      const localUrl = URL.createObjectURL(file);
      toAdd.push({ file, localUrl, uploadedUrl, type: isAudio ? 'audio' : isVideo ? 'video' : 'image', name: file.name, placement: '' });
    }
    setMedias(prev => [...prev, ...toAdd]);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) { recorderRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 16000, channelCount: 1 },
      });
      const mimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
          const form = new FormData();
          form.append('audio', blob, `voice.${ext}`);
          const { data } = await ecomApi.post('/builder-ai/transcribe', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
          if (data.success && data.text) {
            setInput(prev => prev ? prev + ' ' + data.text : data.text);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        } catch (err) {
          console.error('[Transcription]', err?.response?.data || err.message);
        }
        setTranscribing(false);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch (err) { console.error('Mic error:', err); }
  }, [recording]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && medias.length === 0) || loading) return;

    const mediaDesc = medias.map(m => `[${m.type}: ${m.name}${m.placement ? ` → "${m.placement}"` : ''}]`).join(' ');
    const displayContent = [text, mediaDesc].filter(Boolean).join('\n');
    setMessages(prev => [...prev, { role: 'user', content: displayContent, medias }]);

    const imageMedias = medias.filter(m => m.type === 'image' && m.uploadedUrl);
    const otherMedias = medias.filter(m => m.type !== 'image' || !m.uploadedUrl);
    let mediaContext = '';
    if (imageMedias.length > 0) {
      mediaContext += '\n\nImages jointes (URLs hébergées) :\n' + imageMedias.map(m =>
        `- URL: ${m.uploadedUrl}${m.placement ? ` → emplacement: "${m.placement}"` : ' (emplacement non précisé — utilise comme image principale)'}`
      ).join('\n');
      mediaContext += '\nPour chaque image, applique-la dans pageConfigPatch.premiumImages en utilisant l\'emplacement indiqué comme clé.';
    }
    if (otherMedias.length > 0) {
      mediaContext += '\n\nAutres médias joints:\n' + otherMedias.map(m =>
        `- ${m.type}: ${m.uploadedUrl || m.localUrl}${m.placement ? ` (emplacement: "${m.placement}")` : ''}`
      ).join('\n');
    }

    const fullMessage = (text || (imageMedias.length > 0 ? 'Intègre cette image sur la page' : 'Analyse ce média')) + mediaContext;
    setInput('');
    setMedias([]);
    setLoading(true);

    try {
      const { data } = await ecomApi.post('/builder-ai/chat', {
        message: fullMessage,
        model,
        history: messages.slice(-6),
        // pass context fields depending on mode
        ...(mode === 'storepage' ? { sections: context.sections } : {
          productPageConfig: context.productPageConfig,
          theme: context.theme,
          productName: context.productName,
        }),
      }, { timeout: 180000 });

      if (data.success) {
        onPatch?.({
          pageConfigPatch: data.pageConfigPatch || null,
          themePatch: data.themePatch || null,
          sectionsPatch: data.sectionsPatch || null,
        });
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: (data.reply || 'Fait !') + (data.sectionsPatch ? '\n\n✅ Sections mises à jour.' : ''),
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Erreur.' }]);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur de connexion.';
      setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, model, medias, mode, context, onPatch]);

  const isGpt = model === 'gpt-5.4';
  const accentBtn = isGpt ? 'bg-[#10a37f] hover:bg-[#0d8c6d]' : 'bg-[#C96442] hover:bg-[#b05538]';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white shadow-2xl transition-all hover:scale-105 hover:shadow-purple-500/30"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold hidden sm:inline">Assistant IA</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-4rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-bold">Assistant Builder IA</span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Model selector */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        {isGpt ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-[#10a37f]" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.4 14.069a4.504 4.504 0 0 1-2.059-6.173zm16.597 3.855-5.843-3.372 2.02-1.168a.076.076 0 0 1 .072 0l4.42 2.556a4.494 4.494 0 0 1-.676 8.105v-5.678a.795.795 0 0 0-.393-.443zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.419-2.549a4.494 4.494 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057v-5.57a4.494 4.494 0 0 1 7.375-3.453l-.142.08L8.704 9.93a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5Z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 text-[#C96442]" fill="currentColor">
            <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0H10.172L16.744 20.48H13.14L11.705 16.4H5.719l-1.435 4.08H.68L6.57 3.52zm4.132 9.959L8.719 7.582l-1.917 5.897h3.899z"/>
          </svg>
        )}
        <select
          value={model}
          onChange={e => setModel(e.target.value)}
          className="flex-1 text-xs font-semibold text-gray-700 bg-transparent outline-none cursor-pointer"
        >
          <optgroup label="— Claude (Anthropic)">
            <option value="claude-sonnet">Claude Sonnet — rapide</option>
            <option value="claude-opus">Claude Opus — plus puissant</option>
          </optgroup>
          <optgroup label="— OpenAI">
            <option value="gpt-5.4">GPT-5.4</option>
          </optgroup>
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.medias?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                {msg.medias.map((m, mi) => (
                  <div key={mi} className="relative rounded-xl overflow-hidden border border-white/20 bg-indigo-500">
                    {m.type === 'image' && <img src={m.localUrl} alt={m.name} className="w-20 h-20 object-cover" />}
                    {m.type === 'audio' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-2 text-white text-[10px]">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm-1 13V8l6 4-6 4z"/></svg>
                        <span className="truncate max-w-[80px]">{m.name}</span>
                      </div>
                    )}
                    {m.type === 'video' && (
                      <div className="flex items-center gap-1.5 px-2.5 py-2 text-white text-[10px]">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                        <span className="truncate max-w-[80px]">{m.name}</span>
                      </div>
                    )}
                    {m.placement && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1.5 py-0.5 truncate">→ {m.placement}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span className="text-xs text-gray-400">Génération en cours...</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Médias en attente */}
      {medias.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {medias.map((m, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white flex-shrink-0">
                {m.type === 'image' ? (
                  <img src={m.localUrl} alt={m.name} className="w-14 h-14 object-cover" />
                ) : (
                  <div className="w-14 h-14 flex flex-col items-center justify-center bg-indigo-50 text-indigo-600">
                    {m.type === 'audio'
                      ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3zm-1 13V8l6 4-6 4z"/></svg>
                      : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                    }
                    <span className="text-[9px] mt-0.5 px-1 truncate w-full text-center">{m.name.slice(0, 8)}</span>
                  </div>
                )}
                <input
                  type="text"
                  value={m.placement}
                  onChange={e => setMedias(prev => prev.map((x, xi) => xi === i ? { ...x, placement: e.target.value } : x))}
                  placeholder="où ?"
                  className="absolute bottom-0 left-0 right-0 text-[9px] bg-black/60 text-white placeholder:text-white/60 border-0 outline-none px-1 py-0.5 w-full"
                />
                <button
                  onClick={() => setMedias(prev => prev.filter((_, xi) => xi !== i))}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] leading-none"
                >×</button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">Cliquez sur "où ?" pour indiquer l'emplacement de chaque média</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3 flex-shrink-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          className="hidden"
          onChange={e => { handleFileAdd(e.target.files); e.target.value = ''; }}
        />
        <div className={`flex items-end gap-2 rounded-xl border bg-gray-50 px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-100 transition ${recording ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-200 focus-within:border-indigo-400'}`}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 mb-0.5 text-gray-400 hover:text-indigo-500 transition"
            title="Joindre image, audio ou vidéo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={transcribing ? '⏳ Transcription en cours...' : input}
            readOnly={transcribing}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            onPaste={e => {
              const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/'));
              if (files.length > 0) { e.preventDefault(); handleFileAdd(files); }
            }}
            placeholder={recording ? '🔴 Enregistrement vocal...' : 'Décris ce que tu veux créer ou modifier...'}
            rows={1}
            style={{ maxHeight: 80 }}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none overflow-y-auto"
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={transcribing}
            className={`flex-shrink-0 mb-0.5 rounded-lg p-1.5 transition disabled:opacity-40 ${recording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-red-500'}`}
            title={recording ? 'Arrêter et transcrire' : 'Note vocale'}
          >
            <svg className="w-4 h-4" fill={recording ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
            </svg>
          </button>
          <button
            onClick={send}
            disabled={(!input.trim() && medias.length === 0) || loading || recording || transcribing}
            className={`flex-shrink-0 mb-0.5 rounded-lg p-1.5 text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${accentBtn}`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
