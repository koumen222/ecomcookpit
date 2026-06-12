import React from 'react';
import {
  getIconComponent,
  getAnimationClass,
  ButtonAnimationStyles,
  ANIMATION_CSS,
  ICONS,
  ANIMATIONS,
} from './buttonRuntime.jsx';

// ── Shared color field ────────────────────────────────────────────────────────
const ColorRow = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="flex items-center gap-2">
      <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)}
        className="w-9 h-9 rounded-xl border border-gray-200 cursor-pointer p-0.5" />
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200" />
    </div>
  </div>
);

// ── Main ButtonEditor ─────────────────────────────────────────────────────────
const ButtonEditor = ({ config, designConfig, onChange }) => {
  const update = (key, val) => onChange({ ...config, [key]: val });

  // Read visual params from config.* with fallback to designConfig.*
  const bgColor = config.bgColor || designConfig.buttonColor || '#ff6600';
  const textColor = config.textColor || '#ffffff';
  const fontSize = config.fontSize || 16;
  const bold = config.bold !== false;
  const italic = !!config.italic;
  const borderColor = config.borderColor || '';
  const borderWidth = config.borderWidth ?? 0;
  const borderRadius = config.borderRadius ?? (parseInt(designConfig.borderRadius) || 8);
  const shadowVal = config.shadow ?? 4;
  const shadow = shadowVal > 0
    ? `0 ${shadowVal}px ${shadowVal * 2}px rgba(0,0,0,${Math.min(shadowVal * 0.06, 0.5).toFixed(2)})`
    : 'none';

  const BtnIcon = getIconComponent(config.icon);
  const animClass = getAnimationClass(config.animation);

  return (
    <div className="space-y-5">
      <ButtonAnimationStyles />

      {/* Live button preview */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-5">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
          Aperçu du bouton
        </div>
        <div className="flex justify-center">
          <button
            className={`flex flex-col items-center justify-center gap-0.5 px-8 py-3.5 transition-all pointer-events-none ${animClass}`}
            style={{
              backgroundColor: bgColor,
              color: textColor,
              fontSize,
              fontWeight: bold ? 700 : 400,
              fontStyle: italic ? 'italic' : 'normal',
              borderRadius: borderRadius >= 16 ? '999px' : `${borderRadius}px`,
              border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor || 'transparent'}` : 'none',
              boxShadow: shadow,
              minWidth: 220,
            }}
          >
            <span className="flex items-center gap-2">
              <BtnIcon size={16} />
              {config.text || 'Commander'}
            </span>
            {config.subtext && (
              <span style={{ fontSize: Math.max(10, fontSize - 4), fontWeight: 500, opacity: 0.8 }}>{config.subtext}</span>
            )}
          </button>
        </div>
      </div>

      {/* Text */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Texte principal</label>
          <input type="text" value={config.text} onChange={e => update('text', e.target.value)}
            placeholder="Ex: Commander maintenant"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sous-titre</label>
          <input type="text" value={config.subtext} onChange={e => update('subtext', e.target.value)}
            placeholder="Ex: Paiement à la livraison"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200" />
        </div>
      </div>

      {/* Visual params — 3-col row */}
      <div className="pt-4 border-t border-gray-100 space-y-4">
        <div className="text-xs font-bold text-gray-700">Style visuel</div>

        <div className="grid grid-cols-2 gap-3">
          <ColorRow label="Couleur du bouton" value={bgColor} onChange={v => update('bgColor', v)} />
          <ColorRow label="Couleur du texte" value={textColor} onChange={v => update('textColor', v)} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Taille du texte
            </label>
            <div className="flex items-center gap-1.5">
              <input type="number" min="10" max="30"
                value={fontSize}
                onChange={e => update('fontSize', parseInt(e.target.value) || 16)}
                className="w-14 px-2 py-2 rounded-xl border border-gray-200 text-center text-sm focus:outline-none focus:border-primary-400" />
              <span className="text-xs text-gray-400">px</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Style</label>
            <div className="flex gap-1">
              <button type="button"
                className={`px-3 py-2 rounded-lg border text-xs font-bold transition ${bold ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                onClick={() => update('bold', !bold)}>B</button>
              <button type="button"
                className={`px-3 py-2 rounded-lg border text-xs italic transition ${italic ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                onClick={() => update('italic', !italic)}>I</button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Coins — {borderRadius}px
            </label>
            <input type="range" min="0" max="40" value={borderRadius}
              onChange={e => update('borderRadius', parseInt(e.target.value))}
              className="w-full accent-primary-500 mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ColorRow label="Couleur de la bordure" value={borderColor || '#ffffff'} onChange={v => update('borderColor', v)} />
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
              Épaisseur bordure — {borderWidth}px
            </label>
            <input type="range" min="0" max="6" value={borderWidth}
              onChange={e => update('borderWidth', parseInt(e.target.value))}
              className="w-full accent-primary-500 mt-2" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
            Ombre — {shadowVal}
          </label>
          <input type="range" min="0" max="30" value={shadowVal}
            onChange={e => update('shadow', parseInt(e.target.value))}
            className="w-full accent-primary-500" />
        </div>
      </div>

      {/* Icon selector */}
      <div className="pt-4 border-t border-gray-100">
        <label className="block text-xs font-semibold text-gray-700 mb-2">Icône</label>
        <div className="grid grid-cols-6 gap-1.5">
          {ICONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => update('icon', id)} title={label}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                config.icon === id
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}>
              <Icon size={16} />
              <span className="text-[9px] font-medium leading-tight truncate w-full text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animation selector */}
      <div className="pt-4 border-t border-gray-100">
        <label className="block text-xs font-semibold text-gray-700 mb-2">Animation</label>
        <div className="grid grid-cols-3 gap-1.5">
          {ANIMATIONS.map(({ id, label }) => (
            <button key={id} onClick={() => update('animation', id)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                config.animation === id
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { getIconComponent, getAnimationClass, ButtonAnimationStyles, ANIMATION_CSS, ICONS, ANIMATIONS };
export default ButtonEditor;
