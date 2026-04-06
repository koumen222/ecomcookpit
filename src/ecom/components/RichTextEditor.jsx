import React, { useRef, useEffect, useCallback, useState } from 'react';
import { storeProductsApi } from '../services/storeApi.js';

// ─── Toolbar button ───────────────────────────────────────────────────────────
const Btn = ({ title, onClick, active, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => { e.preventDefault(); onClick(); }}
    className={`p-1.5 rounded text-sm transition-colors select-none
      ${active
        ? 'bg-emerald-100 text-emerald-700'
        : 'hover:bg-gray-200 text-gray-700'
      }`}
  >
    {children}
  </button>
);

const Sep = () => <div className="w-px h-5 bg-gray-300 mx-0.5 self-center" />;

// ─── Link modal ───────────────────────────────────────────────────────────────
const LinkModal = ({ onConfirm, onClose }) => {
  const [url, setUrl] = useState('https://');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-80">
        <p className="text-sm font-semibold text-gray-900 mb-3">Insérer un lien</p>
        <input
          autoFocus
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://exemple.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(url); if (e.key === 'Escape') onClose(); }}
        />
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">Annuler</button>
          <button type="button" onClick={() => onConfirm(url)} className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold">OK</button>
        </div>
      </div>
    </div>
  );
};

// ─── Image modal ──────────────────────────────────────────────────────────────
const ImageModal = ({ onInsert, onClose, onUpload, uploading }) => {
  const [tab, setTab] = useState('upload'); // 'upload' | 'url'
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imageUrl = await onUpload(file);
    if (imageUrl) onInsert(imageUrl, file.name.replace(/\.[^.]+$/, ''));
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-96">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Insérer une image</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          {[['upload', 'Uploader'], ['url', 'URL']].map(([t, l]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {tab === 'upload' ? (
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition"
            >
              {uploading ? (
                <p className="text-sm text-emerald-600 font-medium">Upload en cours…</p>
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-600">Cliquer pour choisir une image</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — max 5 Mo</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://exemple.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="text"
              value={alt}
              onChange={e => setAlt(e.target.value)}
              placeholder="Texte alternatif (optionnel)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              disabled={!url.trim()}
              onClick={() => onInsert(url.trim(), alt.trim())}
              className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
            >
              Insérer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Video modal ─────────────────────────────────────────────────────────────
const VideoModal = ({ onInsert, onClose }) => {
  const [url, setUrl] = useState('');

  const buildEmbed = (raw) => {
    const trimmed = raw.trim();
    // YouTube
    const ytMatch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
    if (ytMatch) return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:12px 0;border-radius:8px"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;
    // Vimeo
    const vmMatch = trimmed.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:12px 0;border-radius:8px"><iframe src="https://player.vimeo.com/video/${vmMatch[1]}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>`;
    // Direct video URL
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(trimmed)) return `<video src="${trimmed}" controls style="max-width:100%;border-radius:8px;margin:12px 0"></video>`;
    return null;
  };

  const handleInsert = () => {
    const html = buildEmbed(url);
    if (html) onInsert(html);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-96">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">Insérer une vidéo</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="URL YouTube, Vimeo ou vidéo directe (.mp4)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400">YouTube, Vimeo, ou lien direct .mp4 / .webm</p>
          <button
            type="button"
            disabled={!url.trim() || !buildEmbed(url)}
            onClick={handleInsert}
            className="w-full py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition disabled:opacity-40"
          >
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Heading selector ────────────────────────────────────────────────────────
const HeadingSelect = ({ onSelect }) => {
  const opts = [
    { label: 'Paragraphe', tag: 'p', style: { fontSize: 14 } },
    { label: 'Titre H1', tag: 'h1', style: { fontSize: 22, fontWeight: 800 } },
    { label: 'Titre H2', tag: 'h2', style: { fontSize: 18, fontWeight: 700 } },
    { label: 'Titre H3', tag: 'h3', style: { fontSize: 15, fontWeight: 700 } },
    { label: 'Titre H4', tag: 'h4', style: { fontSize: 14, fontWeight: 600 } },
  ];
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('Paragraphe');

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-200 text-xs text-gray-700 font-medium transition"
      >
        {current}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden min-w-[140px]">
          {opts.map(o => (
            <button
              key={o.tag}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                document.execCommand('formatBlock', false, o.tag);
                setCurrent(o.label);
                setOpen(false);
                onSelect();
              }}
              style={o.style}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50 transition"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Color picker ─────────────────────────────────────────────────────────────
const COLORS = ['#000000','#374151','#6B7280','#DC2626','#D97706','#16A34A','#2563EB','#7C3AED','#DB2777'];

const ColorPicker = ({ onColor }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        title="Couleur du texte"
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
        className="p-1.5 rounded hover:bg-gray-200 transition flex items-center gap-0.5"
      >
        <span className="text-sm font-bold" style={{ color: '#374151' }}>A</span>
        <svg className="w-2.5 h-2.5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-2 flex gap-1 flex-wrap w-[120px]">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onMouseDown={e => { e.preventDefault(); document.execCommand('foreColor', false, c); setOpen(false); onColor(); }}
              style={{ background: c }}
              className="w-6 h-6 rounded-full border-2 border-white hover:scale-110 transition-transform shadow"
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Image resize toolbar ─────────────────────────────────────────────────────
const ImageResizeToolbar = ({ imageEl, onResize, onClose }) => {
  const [rect, setRect] = useState(null);
  const sizes = [
    { label: '25%', value: '25%' },
    { label: '50%', value: '50%' },
    { label: '75%', value: '75%' },
    { label: '100%', value: '100%' },
    { label: 'Auto', value: '' },
  ];

  useEffect(() => {
    if (!imageEl) return;
    const update = () => {
      const r = imageEl.getBoundingClientRect();
      setRect(r);
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [imageEl]);

  if (!rect) return null;

  const currentWidth = imageEl?.style?.width || '';

  return (
    <div
      style={{
        position: 'fixed',
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
        zIndex: 300,
      }}
    >
      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-lg px-2 py-1.5">
        {sizes.map(s => (
          <button
            key={s.label}
            type="button"
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onResize(s.value); }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              currentWidth === s.value || (!currentWidth && s.value === '')
                ? 'bg-emerald-100 text-emerald-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
          title="Fermer"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EDITOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RichTextEditor — Lightweight WYSIWYG editor built on contentEditable.
 *
 * Props:
 *   value      {string}   HTML string (controlled)
 *   onChange   {fn}       Called with new HTML string on every edit
 *   placeholder {string}  Greyed hint when empty
 *   minHeight  {number}   Min height of editor area in px (default 140)
 *   maxHeight  {number}   Max height before scroll (default 400)
 *   uploadFn   {fn}       Optional async fn(file) → url string. Falls back to storeProductsApi.
 */
const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Écrivez votre description…',
  minHeight = 140,
  maxHeight = 400,
  uploadFn,
}) => {
  const editorRef = useRef(null);
  const lastHtml = useRef(value);
  const savedRange = useRef(null);

  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // ── Init / external value sync ──────────────────────────────────────────
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (!el.hasAttribute('data-rte-init')) {
      el.innerHTML = value || '';
      lastHtml.current = value || '';
      el.setAttribute('data-rte-init', '1');
    }
  }, []); // only on mount

  // Sync if value changes externally (e.g. AI fill) after mount
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastHtml.current) {
      lastHtml.current = value;
      el.innerHTML = value || '';
    }
  }, [value]);

  // ── Save / restore caret for toolbar actions ───────────────────────────
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  // ── Input handler ──────────────────────────────────────────────────────
  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastHtml.current = html;
    onChange?.(html);
  }, [onChange]);

  // ── Paste: preserve plain text, strip scripts ──────────────────────────
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    // Try rich HTML paste first (from Word, Google Docs, etc.)
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');

    if (html) {
      // Sanitize: remove scripts, keep structure
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      tmp.querySelectorAll('script,style,meta,link').forEach(n => n.remove());
      // Strip dangerous attributes
      tmp.querySelectorAll('*').forEach(n => {
        ['onclick','onerror','onload','onmouseover','href'].forEach(attr => {
          if (attr === 'href') return; // keep real links
          n.removeAttribute(attr);
        });
      });
      document.execCommand('insertHTML', false, tmp.innerHTML);
    } else {
      document.execCommand('insertText', false, plain);
    }
    handleInput();
  }, [handleInput]);

  // ── Upload image ───────────────────────────────────────────────────────
  const handleUpload = useCallback(async (file) => {
    setUploading(true);
    try {
      if (uploadFn) {
        const url = await uploadFn(file);
        return url;
      }
      const res = await storeProductsApi.uploadImages([file]);
      const data = res.data?.data;
      // API returns array of {url} objects
      if (Array.isArray(data) && data.length > 0) return data[0].url || data[0];
      return null;
    } catch {
      return null;
    } finally {
      setUploading(false);
    }
  }, [uploadFn]);

  // ── Insert image into editor ───────────────────────────────────────────
  const insertImage = useCallback((url, alt = '') => {
    restoreSelection();
    const img = `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:6px;margin:6px 0;" loading="lazy" />`;
    document.execCommand('insertHTML', false, img);
    setShowImage(false);
    handleInput();
  }, [handleInput]);

  // ── Insert video HTML into editor ────────────────────────────────────
  const insertVideo = useCallback((html) => {
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    setShowVideo(false);
    handleInput();
  }, [handleInput]);

  // ── Insert link ────────────────────────────────────────────────────────
  const insertLink = useCallback((url) => {
    restoreSelection();
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text) {
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    }
    setShowLink(false);
    handleInput();
  }, [handleInput]);

  // ── execCommand helper ─────────────────────────────────────────────────
  const cmd = useCallback((command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value ?? null);
    handleInput();
  }, [handleInput]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      handleInput();
    }
    // Deselect image on any key
    if (selectedImage) setSelectedImage(null);
  }, [handleInput, selectedImage]);

  // ── Click handler for image selection ──────────────────────────────────
  const handleEditorClick = useCallback((e) => {
    const target = e.target;
    if (target.tagName === 'IMG' && editorRef.current?.contains(target)) {
      e.preventDefault();
      setSelectedImage(target);
      target.style.outline = '2px solid #059669';
      target.style.outlineOffset = '2px';
    } else {
      if (selectedImage) {
        selectedImage.style.outline = '';
        selectedImage.style.outlineOffset = '';
        setSelectedImage(null);
      }
    }
  }, [selectedImage]);

  // ── Resize image ──────────────────────────────────────────────────────
  const handleImageResize = useCallback((widthValue) => {
    if (!selectedImage) return;
    if (widthValue) {
      selectedImage.style.width = widthValue;
      selectedImage.style.maxWidth = '100%';
    } else {
      selectedImage.style.width = '';
      selectedImage.style.maxWidth = '100%';
    }
    selectedImage.style.height = 'auto';
    handleInput();
  }, [selectedImage, handleInput]);

  const closeImageResize = useCallback(() => {
    if (selectedImage) {
      selectedImage.style.outline = '';
      selectedImage.style.outlineOffset = '';
    }
    setSelectedImage(null);
  }, [selectedImage]);

  // ── Placeholder visibility ────────────────────────────────────────────
  const isEmpty = !value || value === '<br>' || value === '<p><br></p>';

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent transition">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <HeadingSelect onSelect={() => editorRef.current?.focus()} />
        <Sep />
        <Btn title="Gras (Ctrl+B)" onClick={() => cmd('bold')}><strong className="text-xs">B</strong></Btn>
        <Btn title="Italique (Ctrl+I)" onClick={() => cmd('italic')}><em className="text-xs">I</em></Btn>
        <Btn title="Souligné (Ctrl+U)" onClick={() => cmd('underline')}><span className="text-xs underline">U</span></Btn>
        <Btn title="Barré" onClick={() => cmd('strikeThrough')}><span className="text-xs line-through">S</span></Btn>
        <Sep />
        <ColorPicker onColor={() => handleInput()} />
        <Sep />
        <Btn title="Liste à puces" onClick={() => cmd('insertUnorderedList')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </Btn>
        <Btn title="Liste numérotée" onClick={() => cmd('insertOrderedList')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
        </Btn>
        <Btn title="Aligner à gauche" onClick={() => cmd('justifyLeft')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h10M4 14h14M4 18h10" />
          </svg>
        </Btn>
        <Btn title="Centrer" onClick={() => cmd('justifyCenter')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M4 14h16M7 18h10" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Insérer un lien" onClick={() => { saveSelection(); setShowLink(true); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </Btn>
        <Btn title="Supprimer le lien" onClick={() => cmd('unlink')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M9 9l6 6M9 15l6-6" />
          </svg>
        </Btn>
        <Btn title="Insérer une image / GIF" onClick={() => { saveSelection(); setShowImage(true); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </Btn>
        <Btn title="Insérer une vidéo" onClick={() => { saveSelection(); setShowVideo(true); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Ligne horizontale" onClick={() => { cmd('insertHorizontalRule'); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
          </svg>
        </Btn>
        <Btn title="Effacer la mise en forme" onClick={() => cmd('removeFormat')}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Btn>
      </div>

      {/* ── Editable area ── */}
      <div className="relative">
        {isEmpty && (
          <div
            className="absolute top-0 left-0 px-3 py-2 text-sm text-gray-400 pointer-events-none select-none"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          dir="ltr"
          className="px-3 py-2 focus:outline-none rte-content"
          style={{
            minHeight,
            maxHeight,
            overflowY: 'auto',
            direction: 'ltr',
            lineHeight: 1.65,
            fontSize: 14,
          }}
        />
      </div>

      {/* ── Editor styles ── */}
      <style>{`
        .rte-content h1 { font-size: 1.75em; font-weight: 800; margin: 0.5em 0 0.3em; line-height: 1.2; }
        .rte-content h2 { font-size: 1.35em; font-weight: 700; margin: 0.5em 0 0.3em; line-height: 1.25; }
        .rte-content h3 { font-size: 1.15em; font-weight: 700; margin: 0.4em 0 0.25em; line-height: 1.3; }
        .rte-content h4 { font-size: 1em; font-weight: 600; margin: 0.4em 0 0.2em; line-height: 1.35; }
        .rte-content p { margin: 0.35em 0; }
        .rte-content ul { list-style-type: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .rte-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .rte-content li { margin: 0.15em 0; display: list-item; }
        .rte-content a { color: #2563EB; text-decoration: underline; }
        .rte-content blockquote { border-left: 3px solid #D1D5DB; padding-left: 0.75em; margin: 0.5em 0; color: #6B7280; font-style: italic; }
        .rte-content hr { border: none; border-top: 1px solid #E5E7EB; margin: 0.75em 0; }
        .rte-content img { max-width: 100%; height: auto; border-radius: 6px; margin: 6px 0; }
        .rte-content [style*="text-align: center"] { text-align: center !important; }
        .rte-content [style*="text-align: right"] { text-align: right !important; }
        .rte-content div[style*="text-align"] { text-align: inherit; }
      `}</style>

      {/* ── Modals ── */}
      {selectedImage && (
        <ImageResizeToolbar
          imageEl={selectedImage}
          onResize={handleImageResize}
          onClose={closeImageResize}
        />
      )}
      {showLink && (
        <LinkModal
          onConfirm={insertLink}
          onClose={() => { setShowLink(false); restoreSelection(); }}
        />
      )}
      {showImage && (
        <ImageModal
          onInsert={insertImage}
          onClose={() => { setShowImage(false); restoreSelection(); }}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}
      {showVideo && (
        <VideoModal
          onInsert={insertVideo}
          onClose={() => { setShowVideo(false); restoreSelection(); }}
        />
      )}
    </div>
  );
};

export default RichTextEditor;
