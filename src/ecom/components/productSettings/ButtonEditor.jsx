import React from 'react';
import {
  ShoppingCart, CreditCard, Rocket, Gift, Sparkles, Zap,
  Truck, Heart, ArrowRight, Check,
} from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';

const ICONS = [
  { id: 'cart', label: 'Panier', Icon: ShoppingCart },
  { id: 'credit', label: 'Paiement', Icon: CreditCard },
  { id: 'rocket', label: 'Fusée', Icon: Rocket },
  { id: 'gift', label: 'Cadeau', Icon: Gift },
  { id: 'sparkles', label: 'Étoiles', Icon: Sparkles },
  { id: 'zap', label: 'Éclair', Icon: Zap },
  { id: 'truck', label: 'Livraison', Icon: Truck },
  { id: 'heart', label: 'Cœur', Icon: Heart },
  { id: 'arrow', label: 'Flèche', Icon: ArrowRight },
  { id: 'check', label: 'Valider', Icon: Check },
];

const ANIMATIONS = [
  { id: 'none', label: 'Aucune' },
  { id: 'pulse', label: 'Pulsation' },
  { id: 'bounce', label: 'Rebond' },
  { id: 'shake', label: 'Vibration' },
  { id: 'glow', label: 'Halo lumineux' },
];

const getIconComponent = (iconId) => {
  return ICONS.find(i => i.id === iconId)?.Icon || ShoppingCart;
};

const ButtonEditor = ({ config, designConfig, onChange }) => {
  const update = (key, val) => onChange({ ...config, [key]: val });
  const btnColor = designConfig.buttonColor || '#ff6600';
  const radius = parseInt(designConfig.borderRadius) || 8;
  const hasShadow = designConfig.shadow !== false;
  const BtnIcon = getIconComponent(config.icon);

  const animClass =
    config.animation === 'pulse'  ? 'animate-pulse'  :
    config.animation === 'bounce' ? 'animate-bounce'  :
    config.animation === 'shake'  ? 'animate-[shake_0.5s_ease-in-out_infinite]' : '';

  return (
    <div className="space-y-5">
      {/* Live button preview */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100 p-5">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 text-center">
          Aperçu du bouton
        </div>
        <div className="flex justify-center">
          <button
            className={`flex flex-col items-center justify-center gap-0.5 px-8 py-3.5 font-bold text-white transition-all ${animClass}`}
            style={{
              backgroundColor: btnColor,
              borderRadius: radius >= 16 ? '999px' : `${radius}px`,
              boxShadow: hasShadow ? `0 4px 16px ${btnColor}50` : 'none',
              minWidth: 220,
            }}
          >
            <span className="flex items-center gap-2 text-sm font-extrabold">
              <BtnIcon size={16} />
              {config.text || 'Commander'}
            </span>
            {config.subtext && (
              <span className="text-[10px] font-medium opacity-80">{config.subtext}</span>
            )}
          </button>
        </div>
      </div>

      {/* Text inputs */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Texte principal</label>
          <input
            type="text"
            value={config.text}
            onChange={e => update('text', e.target.value)}
            placeholder="Ex: Commander maintenant"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sous-texte</label>
          <input
            type="text"
            value={config.subtext}
            onChange={e => update('subtext', e.target.value)}
            placeholder="Ex: Paiement à la livraison"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* Icon selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Icône</label>
        <div className="grid grid-cols-5 gap-1.5">
          {ICONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => update('icon', id)}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                config.icon === id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Icon size={16} />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Animation selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">Animation</label>
        <div className="grid grid-cols-3 gap-1.5">
          {ANIMATIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => update('animation', id)}
              className={`px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                config.animation === id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export { getIconComponent, ICONS, ANIMATIONS };
export default ButtonEditor;
