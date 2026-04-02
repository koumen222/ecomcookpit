import React from 'react';
import { Palette } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';

const ColorField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-xl border border-gray-200 cursor-pointer appearance-none bg-transparent p-0.5"
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-xs font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
      />
    </div>
  </div>
);

const DesignSettings = ({ config, onChange }) => {
  const update = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* Colors */}
      <div>
        <div className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
          <Palette size={14} className="text-emerald-600" />
          Couleurs
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorField label="Bouton / Accent" value={config.buttonColor} onChange={(v) => update('buttonColor', v)} />
          <ColorField label="Arrière-plan" value={config.backgroundColor} onChange={(v) => update('backgroundColor', v)} />
          <ColorField label="Texte" value={config.textColor} onChange={(v) => update('textColor', v)} />
          <ColorField label="Badge promo" value={config.badgeColor || '#EF4444'} onChange={(v) => update('badgeColor', v)} />
        </div>
      </div>

      {/* Typography */}
      <div className="pt-4 border-t border-gray-100">
        <div className="text-xs font-bold text-gray-700 mb-3">Typographie</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Taille de base</label>
            <div className="flex items-center gap-2">
              <input
                type="range" min="12" max="18"
                value={config.fontBase || 14}
                onChange={(e) => update('fontBase', parseInt(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
              <span className="text-xs font-mono text-gray-500 w-8 text-right">{config.fontBase || 14}px</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Épaisseur</label>
            <select
              value={config.fontWeight || '600'}
              onChange={(e) => update('fontWeight', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
            >
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi-bold</option>
              <option value="700">Bold</option>
              <option value="800">Extra-bold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Border radius */}
      <div className="pt-4 border-t border-gray-100">
        <div className="text-xs font-bold text-gray-700 mb-3">Bordure & Ombre</div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Rayon des coins</label>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="24"
              value={parseInt(config.borderRadius, 10) || 0}
              onChange={(e) => update('borderRadius', `${e.target.value}px`)}
              className="flex-1 accent-emerald-500"
            />
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 border-2 border-emerald-300 bg-emerald-50"
                style={{ borderRadius: config.borderRadius }}
              />
              <span className="text-xs font-mono text-gray-500 w-10 text-right">{config.borderRadius}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <ToggleSwitch
            label="Ombre portée"
            description="Ajoute une ombre subtile aux cartes et boutons"
            checked={config.shadow}
            onChange={(v) => update('shadow', v)}
          />
        </div>
      </div>
    </div>
  );
};

export default DesignSettings;
