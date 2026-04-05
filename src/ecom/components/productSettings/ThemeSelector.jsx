import React from 'react';

const THEMES = [
  {
    id: 'classic',
    name: 'Classique',
    emoji: '🛍️',
    desc: 'Fond blanc, couleur primaire verte — polyvalent et professionnel',
    preview: {
      bg: '#ffffff',
      text: '#111827',
      text2: '#6b7280',
      primary: '#0F6B4F',
      accent: '#10b981',
      border: '#e5e7eb',
      cardBg: '#f9fafb',
    },
  },
  {
    id: 'dark-tech',
    name: 'Tech Sombre',
    emoji: '⚡',
    desc: 'Fond dark noir-bleu, accent bleu électrique — gadgets, électronique, audio',
    preview: {
      bg: '#0a0f1e',
      text: '#ffffff',
      text2: '#a0aec0',
      primary: '#0066ff',
      accent: '#3385ff',
      border: '#1e2a3a',
      cardBg: '#111827',
    },
  },
  {
    id: 'luxury-gold',
    name: 'Luxe Doré',
    emoji: '👑',
    desc: 'Fond crème chaud, accents or — mode, bijoux, accessoires premium',
    preview: {
      bg: '#faf7f2',
      text: '#2d1f0e',
      text2: '#7a6a52',
      primary: '#c9a84c',
      accent: '#d4b46e',
      border: '#e8e0d0',
      cardBg: '#f5f0e8',
    },
  },
  {
    id: 'nature',
    name: 'Nature & Beauté',
    emoji: '🌿',
    desc: 'Fond ivoire doux, vert profond — cosmétique, soins, bien-être',
    preview: {
      bg: '#fffdf9',
      text: '#0d2b14',
      text2: '#5a7a60',
      primary: '#1a5c2a',
      accent: '#2e7d32',
      border: '#d4e8d6',
      cardBg: '#f0f7f1',
    },
  },
  {
    id: 'health-energy',
    name: 'Santé & Énergie',
    emoji: '💪',
    desc: 'Fond blanc frais, vert émeraude + orange — nutrition, compléments, sport',
    preview: {
      bg: '#ffffff',
      text: '#1a2e1b',
      text2: '#5a7a5e',
      primary: '#2e7d32',
      accent: '#e65100',
      border: '#c8e6c9',
      cardBg: '#f1f8e9',
    },
  },
  {
    id: 'warm-home',
    name: 'Maison Chaleureux',
    emoji: '🏠',
    desc: 'Fond beige, terracotta — décoration, cuisine, maison',
    preview: {
      bg: '#f5f0e8',
      text: '#2d1a0e',
      text2: '#7a6252',
      primary: '#c0622a',
      accent: '#d4845a',
      border: '#e0d0c0',
      cardBg: '#faf5eb',
    },
  },
  {
    id: 'rose-beauty',
    name: 'Rose Premium',
    emoji: '💄',
    desc: 'Fond rose doux, rose gold — maquillage, parfum, beauté premium',
    preview: {
      bg: '#fff5f5',
      text: '#3d1a2a',
      text2: '#8b6b7a',
      primary: '#c44569',
      accent: '#e55d87',
      border: '#f0d0d8',
      cardBg: '#fff0f2',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimaliste Noir',
    emoji: '◼️',
    desc: 'Noir et blanc pur, élégant et épuré — tout type de produit',
    preview: {
      bg: '#ffffff',
      text: '#000000',
      text2: '#555555',
      primary: '#000000',
      accent: '#333333',
      border: '#e0e0e0',
      cardBg: '#f5f5f5',
    },
  },
];

// ── Mini preview card ───────────────────────────────────────────────────────
const ThemeCard = ({ theme, selected, onSelect }) => {
  const p = theme.preview;
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={`text-left rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
        selected
          ? 'border-emerald-500 shadow-lg shadow-emerald-100 scale-[1.02]'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}
      style={{ background: '#fff' }}
    >
      {/* Mini product page preview */}
      <div
        style={{
          background: p.bg,
          padding: '12px 10px 10px',
          minHeight: 140,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Nav bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${p.border}`,
        }}>
          <div style={{ width: 28, height: 5, borderRadius: 3, background: p.primary }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.text2, opacity: 0.4 }} />
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.text2, opacity: 0.4 }} />
          </div>
        </div>

        {/* Image placeholder */}
        <div style={{
          width: '100%', paddingBottom: '55%', borderRadius: 8,
          background: `linear-gradient(135deg, ${p.cardBg}, ${p.border})`,
          marginBottom: 8, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 22, opacity: 0.5,
          }}>
            {theme.emoji}
          </div>
        </div>

        {/* Title */}
        <div style={{ width: '75%', height: 6, borderRadius: 3, background: p.text, marginBottom: 5, opacity: 0.8 }} />
        <div style={{ width: '50%', height: 4, borderRadius: 2, background: p.text2, marginBottom: 8, opacity: 0.5 }} />

        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 40, height: 7, borderRadius: 3, background: p.primary, opacity: 0.9 }} />
          <div style={{ width: 25, height: 5, borderRadius: 2, background: p.text2, opacity: 0.3, textDecoration: 'line-through' }} />
        </div>

        {/* CTA Button */}
        <div style={{
          width: '100%', height: 20, borderRadius: 6,
          background: p.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: '40%', height: 4, borderRadius: 2, background: '#fff', opacity: 0.9 }} />
        </div>
      </div>

      {/* Label */}
      <div style={{ padding: '10px 12px', background: '#fff' }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 16 }}>{theme.emoji}</span>
          <span className={`text-[13px] font-bold ${selected ? 'text-emerald-700' : 'text-gray-800'}`}>
            {theme.name}
          </span>
          {selected && (
            <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Actif
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-500 leading-snug m-0">{theme.desc}</p>
      </div>
    </button>
  );
};

// ── Main ThemeSelector component ────────────────────────────────────────────
const ThemeSelector = ({ config, onChange }) => {
  const currentTheme = config.theme || 'classic';

  const handleSelect = (themeId) => {
    // Update theme AND auto-set matching design colors
    const themeData = THEMES.find(t => t.id === themeId);
    const newConfig = {
      ...config,
      theme: themeId,
    };

    // Optionally sync design colors with theme
    if (themeData) {
      newConfig.design = {
        ...config.design,
        buttonColor: themeData.preview.primary,
        backgroundColor: themeData.preview.bg,
        textColor: themeData.preview.text,
      };
    }

    onChange(newConfig);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-bold text-gray-700 mb-1">Choisis un thème pour ta page produit</div>
        <p className="text-[10px] text-gray-400 mb-3">
          Le thème détermine les couleurs, le fond et l'ambiance de ta page produit. Tu peux ajuster les détails dans "Design & Styles".
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={currentTheme === theme.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Current theme info */}
      {(() => {
        const current = THEMES.find(t => t.id === currentTheme);
        if (!current) return null;
        return (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-2xl">{current.emoji}</span>
            <div>
              <div className="text-[13px] font-bold text-emerald-800">{current.name}</div>
              <div className="text-[10px] text-emerald-600">{current.desc}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export { THEMES };
export default ThemeSelector;
