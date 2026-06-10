import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

function BuilderAIChatWidget({ productPageConfig, theme, onApplyChanges, onApplyTheme, productName = '' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Salut ! Je suis ton assistant IA pour personnaliser ta page produit et ton thème. Dis-moi ce que tu veux modifier.\n\nExemples :\n- "Change la couleur principale en bleu"\n- "Ajoute un témoignage client"\n- "Rends le titre plus accrocheur"\n- "Mets la police en Poppins"\n- "Cache la section FAQ"` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await ecomApi.post('/builder-ai/chat', {
        message: text,
        productPageConfig,
        theme,
        productName,
        history: messages.slice(-6),
      });

      if (data.success) {
        const applied = [];
        if (data.pageConfigPatch && onApplyChanges) {
          onApplyChanges(data.pageConfigPatch);
          applied.push('page');
        }
        if (data.themePatch && onApplyTheme) {
          onApplyTheme(data.themePatch);
          applied.push('design');
        }
        const suffix = applied.length > 0 ? '\n\n✅ Modification appliquée.' : '';
        setMessages(prev => [...prev, { role: 'assistant', content: (data.reply || '') + suffix }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Désolé, une erreur est survenue.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessaie.' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, productPageConfig, theme, productName, onApplyChanges, onApplyTheme]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-4rem)] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-bold">Assistant Builder IA</span>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: Change la couleur en bleu..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 rounded-lg bg-indigo-600 p-1.5 text-white transition hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuilderAIChatWidget;
