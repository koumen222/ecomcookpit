import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const FORM_THEMES = [
  {
    id: 'classic',
    name: 'Classic White',
    category: 'Clean',
    design: {
      formBgColor: '#ffffff',
      formTextColor: '#111827',
      formBorderColor: '#E5E7EB',
      formBorderWidth: '1px',
      formBorderRadius: '14px',
      formInputRadius: '12px',
      formShadow: '0',
      fieldBgColor: '#ffffff',
      fieldTextColor: '#111827',
      fieldBorderColor: '#E5E7EB',
      fieldIconColor: '#9CA3AF',
      fieldIconBg: '#F3F4F6',
      formButtonColor: '#0F6B4F',
      ctaButtonColor: '#0F6B4F',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#ffffff',
      inputBg: '#f9fafb',
      inputBorder: '#E5E7EB',
      inputText: '#111827',
      iconColor: '#9CA3AF',
      iconBg: '#F3F4F6',
      accent: '#0F6B4F',
      btnText: '#ffffff',
    },
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    category: 'Clean',
    design: {
      formBgColor: '#f9f9f9',
      formTextColor: '#000000',
      formBorderColor: '#000000',
      formBorderWidth: '1px',
      formBorderRadius: '4px',
      formInputRadius: '4px',
      formShadow: '0',
      fieldBgColor: '#ffffff',
      fieldTextColor: '#000000',
      fieldBorderColor: '#d1d5db',
      fieldIconColor: '#6b7280',
      fieldIconBg: '#f3f4f6',
      formButtonColor: '#000000',
      ctaButtonColor: '#000000',
      buttonTextColor: '#ffffff',
      buttonBorderColor: '#000000',
      buttonBorderWidth: '2px',
      buttonShadow: '0',
    },
    preview: {
      formBg: '#f9f9f9',
      inputBg: '#ffffff',
      inputBorder: '#d1d5db',
      inputText: '#000000',
      iconColor: '#6b7280',
      iconBg: '#f3f4f6',
      accent: '#000000',
      btnText: '#ffffff',
    },
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    category: 'Dark',
    design: {
      formBgColor: '#0f172a',
      formTextColor: '#f1f5f9',
      formBorderColor: '#334155',
      formBorderWidth: '1px',
      formBorderRadius: '16px',
      formInputRadius: '10px',
      formShadow: '8',
      fieldBgColor: '#1e293b',
      fieldTextColor: '#f1f5f9',
      fieldBorderColor: '#334155',
      fieldIconColor: '#94a3b8',
      fieldIconBg: '#1e293b',
      formButtonColor: '#6366f1',
      ctaButtonColor: '#6366f1',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '6',
    },
    preview: {
      formBg: '#0f172a',
      inputBg: '#1e293b',
      inputBorder: '#334155',
      inputText: '#f1f5f9',
      iconColor: '#94a3b8',
      iconBg: '#263346',
      accent: '#6366f1',
      btnText: '#ffffff',
    },
  },
  {
    id: 'luxury',
    name: 'Luxe Doré',
    category: 'Dark',
    design: {
      formBgColor: '#111111',
      formTextColor: '#f5e6c8',
      formBorderColor: '#2a2a2a',
      formBorderWidth: '1px',
      formBorderRadius: '12px',
      formInputRadius: '8px',
      formShadow: '12',
      fieldBgColor: '#1a1a1a',
      fieldTextColor: '#f5e6c8',
      fieldBorderColor: '#333333',
      fieldIconColor: '#c9a84c',
      fieldIconBg: '#222222',
      formButtonColor: '#c9a84c',
      ctaButtonColor: '#c9a84c',
      buttonTextColor: '#111111',
      buttonBorderColor: '#c9a84c',
      buttonBorderWidth: '1px',
      buttonShadow: '6',
    },
    preview: {
      formBg: '#111111',
      inputBg: '#1a1a1a',
      inputBorder: '#333333',
      inputText: '#f5e6c8',
      iconColor: '#c9a84c',
      iconBg: '#222222',
      accent: '#c9a84c',
      btnText: '#111111',
    },
  },
  {
    id: 'ocean',
    name: 'Arctic Frost',
    category: 'Ocean',
    design: {
      formBgColor: '#f0f7ff',
      formTextColor: '#0f172a',
      formBorderColor: '#bfdbfe',
      formBorderWidth: '1px',
      formBorderRadius: '16px',
      formInputRadius: '12px',
      formShadow: '0',
      fieldBgColor: '#ffffff',
      fieldTextColor: '#0f172a',
      fieldBorderColor: '#bfdbfe',
      fieldIconColor: '#0066ff',
      fieldIconBg: '#dbeafe',
      formButtonColor: '#0066ff',
      ctaButtonColor: '#0066ff',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#f0f7ff',
      inputBg: '#ffffff',
      inputBorder: '#bfdbfe',
      inputText: '#0f172a',
      iconColor: '#0066ff',
      iconBg: '#dbeafe',
      accent: '#0066ff',
      btnText: '#ffffff',
    },
  },
  {
    id: 'ocean2',
    name: 'Deep Ocean',
    category: 'Ocean',
    design: {
      formBgColor: '#0c1445',
      formTextColor: '#e0f2fe',
      formBorderColor: '#1e3a6e',
      formBorderWidth: '1px',
      formBorderRadius: '16px',
      formInputRadius: '10px',
      formShadow: '10',
      fieldBgColor: '#112060',
      fieldTextColor: '#e0f2fe',
      fieldBorderColor: '#1e3a6e',
      fieldIconColor: '#38bdf8',
      fieldIconBg: '#1e3a6e',
      formButtonColor: '#38bdf8',
      ctaButtonColor: '#38bdf8',
      buttonTextColor: '#0c1445',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '6',
    },
    preview: {
      formBg: '#0c1445',
      inputBg: '#112060',
      inputBorder: '#1e3a6e',
      inputText: '#e0f2fe',
      iconColor: '#38bdf8',
      iconBg: '#1e3a6e',
      accent: '#38bdf8',
      btnText: '#0c1445',
    },
  },
  {
    id: 'warm',
    name: 'Golden Hour',
    category: 'Orange',
    design: {
      formBgColor: '#fdf6ee',
      formTextColor: '#2d1a0e',
      formBorderColor: '#e8d5b7',
      formBorderWidth: '1px',
      formBorderRadius: '18px',
      formInputRadius: '14px',
      formShadow: '0',
      fieldBgColor: '#fff9f2',
      fieldTextColor: '#2d1a0e',
      fieldBorderColor: '#e8d5b7',
      fieldIconColor: '#a0785a',
      fieldIconBg: '#f5e6d3',
      formButtonColor: '#c0622a',
      ctaButtonColor: '#c0622a',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#fdf6ee',
      inputBg: '#fff9f2',
      inputBorder: '#e8d5b7',
      inputText: '#2d1a0e',
      iconColor: '#a0785a',
      iconBg: '#f5e6d3',
      accent: '#c0622a',
      btnText: '#ffffff',
    },
  },
  {
    id: 'coral',
    name: 'Coral',
    category: 'Orange',
    design: {
      formBgColor: '#fff8f5',
      formTextColor: '#2d1206',
      formBorderColor: '#fcd5bb',
      formBorderWidth: '1px',
      formBorderRadius: '14px',
      formInputRadius: '10px',
      formShadow: '0',
      fieldBgColor: '#fff3ec',
      fieldTextColor: '#2d1206',
      fieldBorderColor: '#fcd5bb',
      fieldIconColor: '#e8622a',
      fieldIconBg: '#fde8d8',
      formButtonColor: '#e8622a',
      ctaButtonColor: '#e8622a',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#fff8f5',
      inputBg: '#fff3ec',
      inputBorder: '#fcd5bb',
      inputText: '#2d1206',
      iconColor: '#e8622a',
      iconBg: '#fde8d8',
      accent: '#e8622a',
      btnText: '#ffffff',
    },
  },
  {
    id: 'soft',
    name: 'Rose Petal',
    category: 'Rose',
    design: {
      formBgColor: '#fff5f7',
      formTextColor: '#3d1a2a',
      formBorderColor: '#f0c4cf',
      formBorderWidth: '1px',
      formBorderRadius: '20px',
      formInputRadius: '16px',
      formShadow: '0',
      fieldBgColor: '#fff0f3',
      fieldTextColor: '#3d1a2a',
      fieldBorderColor: '#f0c4cf',
      fieldIconColor: '#c44569',
      fieldIconBg: '#fce7ec',
      formButtonColor: '#c44569',
      ctaButtonColor: '#c44569',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#fff5f7',
      inputBg: '#fff0f3',
      inputBorder: '#f0c4cf',
      inputText: '#3d1a2a',
      iconColor: '#c44569',
      iconBg: '#fce7ec',
      accent: '#c44569',
      btnText: '#ffffff',
    },
  },
  {
    id: 'blush',
    name: 'Blush',
    category: 'Rose',
    design: {
      formBgColor: '#fdf2f8',
      formTextColor: '#4a1942',
      formBorderColor: '#e9b8e0',
      formBorderWidth: '1px',
      formBorderRadius: '18px',
      formInputRadius: '14px',
      formShadow: '0',
      fieldBgColor: '#faeaf6',
      fieldTextColor: '#4a1942',
      fieldBorderColor: '#e9b8e0',
      fieldIconColor: '#a855f7',
      fieldIconBg: '#f3d8f0',
      formButtonColor: '#a855f7',
      ctaButtonColor: '#a855f7',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#fdf2f8',
      inputBg: '#faeaf6',
      inputBorder: '#e9b8e0',
      inputText: '#4a1942',
      iconColor: '#a855f7',
      iconBg: '#f3d8f0',
      accent: '#a855f7',
      btnText: '#ffffff',
    },
  },
  {
    id: 'nature',
    name: 'Forest Mint',
    category: 'Green',
    design: {
      formBgColor: '#f0f7f1',
      formTextColor: '#0d2b14',
      formBorderColor: '#d4e8d6',
      formBorderWidth: '1px',
      formBorderRadius: '16px',
      formInputRadius: '12px',
      formShadow: '0',
      fieldBgColor: '#ffffff',
      fieldTextColor: '#0d2b14',
      fieldBorderColor: '#b8d9bc',
      fieldIconColor: '#1a5c2a',
      fieldIconBg: '#e0f0e3',
      formButtonColor: '#1a5c2a',
      ctaButtonColor: '#1a5c2a',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#f0f7f1',
      inputBg: '#ffffff',
      inputBorder: '#b8d9bc',
      inputText: '#0d2b14',
      iconColor: '#1a5c2a',
      iconBg: '#e0f0e3',
      accent: '#1a5c2a',
      btnText: '#ffffff',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    category: 'Green',
    design: {
      formBgColor: '#f2f7f4',
      formTextColor: '#1c3a28',
      formBorderColor: '#c3daca',
      formBorderWidth: '1px',
      formBorderRadius: '14px',
      formInputRadius: '10px',
      formShadow: '0',
      fieldBgColor: '#e8f2ec',
      fieldTextColor: '#1c3a28',
      fieldBorderColor: '#c3daca',
      fieldIconColor: '#3d8b5e',
      fieldIconBg: '#d0e8d9',
      formButtonColor: '#3d8b5e',
      ctaButtonColor: '#3d8b5e',
      buttonTextColor: '#ffffff',
      buttonBorderColor: 'transparent',
      buttonBorderWidth: '0px',
      buttonShadow: '4',
    },
    preview: {
      formBg: '#f2f7f4',
      inputBg: '#e8f2ec',
      inputBorder: '#c3daca',
      inputText: '#1c3a28',
      iconColor: '#3d8b5e',
      iconBg: '#d0e8d9',
      accent: '#3d8b5e',
      btnText: '#ffffff',
    },
  },
];

const CATEGORIES = ['Tous', 'Clean', 'Dark', 'Ocean', 'Orange', 'Rose', 'Green'];

export const applyFormThemeToConfig = (config, themeId) => {
  const theme = FORM_THEMES.find(t => t.id === themeId);
  if (!theme) return config;
  const fields = (config.form?.fields || []).map(f =>
    f.type === 'cta_button'
      ? { ...f, bgColor: '', textColor: '', borderColor: '', borderWidth: null, shadow: null, borderRadius: null }
      : f
  );
  return {
    ...config,
    form: { ...config.form, formTheme: themeId, fields },
    design: { ...config.design, ...theme.design },
  };
};

// ── Mini card (carousel) ──────────────────────────────────────────────────────
const ThemeCard = ({ theme, selected, onSelect }) => {
  const p = theme.preview;
  const d = theme.design;
  const r = Math.max(2, parseInt(d.formInputRadius) * 0.45);
  const formR = Math.max(4, parseInt(d.formBorderRadius) * 0.55);

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className="flex-shrink-0 text-left transition-all duration-200 focus:outline-none"
      style={{ width: 108 }}
    >
      {/* Mini form preview */}
      <div
        style={{
          borderRadius: formR,
          overflow: 'hidden',
          border: selected ? '2px solid #10b981' : '2px solid transparent',
          boxShadow: selected
            ? '0 0 0 3px #10b98130'
            : '0 1px 6px rgba(0,0,0,0.10)',
          transform: selected ? 'scale(1.04)' : 'scale(1)',
          transition: 'all 0.18s ease',
        }}
      >
        {/* Form body */}
        <div style={{ background: p.formBg, padding: '8px 7px 7px' }}>
          {/* Header */}
          <div style={{
            height: 16, borderRadius: Math.max(2, formR - 2), marginBottom: 5,
            background: p.accent,
            display: 'flex', alignItems: 'center', paddingLeft: 5, gap: 3,
          }}>
            <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
            </svg>
            <div style={{ width: 22, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.8)' }} />
          </div>

          {/* 3 input fields */}
          {[48, 62, 52].map((w, i) => (
            <div key={i} style={{
              height: 13, borderRadius: r,
              background: p.inputBg,
              border: `1px solid ${p.inputBorder}`,
              marginBottom: 3,
              display: 'flex', alignItems: 'center', paddingLeft: 5, gap: 3,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: 2,
                background: p.iconBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: p.iconColor }} />
              </div>
              <div style={{ width: `${w}%`, height: 2.5, borderRadius: 2, background: p.inputText, opacity: 0.15 }} />
            </div>
          ))}

          {/* CTA button */}
          <div style={{
            height: 17, borderRadius: r,
            background: p.accent,
            border: d.buttonBorderWidth !== '0px' ? `${d.buttonBorderWidth} solid ${d.buttonBorderColor}` : 'none',
            marginTop: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            boxShadow: parseInt(d.buttonShadow) > 0 ? `0 2px 6px ${p.accent}55` : 'none',
          }}>
            <svg width="6" height="6" viewBox="0 0 24 24" fill={p.btnText} opacity="0.9">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <div style={{ width: '36%', height: 2.5, borderRadius: 2, background: p.btnText, opacity: 0.88 }} />
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="mt-1.5 px-0.5">
        <span className={`block text-[11px] font-semibold leading-tight truncate ${selected ? 'text-primary-700' : 'text-gray-700'}`}>
          {theme.name}
        </span>
        {selected && (
          <span className="text-[9px] font-bold text-primary-500">✓ Actif</span>
        )}
      </div>
    </button>
  );
};

// Props: config, onConfigChange
const FormThemePicker = ({ config, onConfigChange }) => {
  const currentTheme = config?.form?.formTheme || 'classic';
  const [activeCategory, setActiveCategory] = useState('Tous');
  const scrollRef = useRef(null);

  const filtered = activeCategory === 'Tous'
    ? FORM_THEMES
    : FORM_THEMES.filter(t => t.category === activeCategory);

  const handleSelect = (themeId) => {
    onConfigChange(applyFormThemeToConfig(config, themeId));
  };

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 230, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-700">Modèles</div>
        <button
          type="button"
          onClick={() => handleSelect('classic')}
          className="text-[10px] text-gray-400 hover:text-primary-600 transition-colors font-medium"
        >
          Restaurer par défaut
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
              activeCategory === cat
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Carousel */}
      <div className="relative">
        {/* Left arrow */}
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all -ml-3"
          style={{ top: '45%' }}
        >
          <ChevronLeft size={12} />
        </button>

        {/* Scrollable row */}
        <style>{`.__fts::-webkit-scrollbar{display:none}`}</style>
        <div
          ref={scrollRef}
          className="__fts flex gap-3 overflow-x-auto pb-2 px-1"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {filtered.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              selected={currentTheme === theme.id}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          onClick={() => scroll(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all -mr-3"
          style={{ top: '45%' }}
        >
          <ChevronRight size={12} />
        </button>
      </div>

      <p className="text-[10px] text-gray-400">
        Choisissez un modèle — les couleurs s'appliquent immédiatement. Ajustez ensuite via les pickers.
      </p>
    </div>
  );
};

export default FormThemePicker;
