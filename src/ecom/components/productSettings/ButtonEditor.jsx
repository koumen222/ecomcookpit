import React from 'react';
import {
  ShoppingCart, CreditCard, Rocket, Gift, Sparkles, Zap,
  Truck, Heart, ArrowRight, Check, Flame, Crown, Star, Gem,
  Trophy, Lock, ShoppingBag, BadgeCheck, Tag, Send, Bell,
  ThumbsUp, Wallet, Package,
} from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';

// ── Catalogue d'icônes partagé (form builder + page produit publique) ────────
const ICONS = [
  { id: 'cart',      label: 'Panier',     Icon: ShoppingCart },
  { id: 'bag',       label: 'Sac',        Icon: ShoppingBag },
  { id: 'credit',    label: 'Paiement',   Icon: CreditCard },
  { id: 'wallet',    label: 'Portefeuille', Icon: Wallet },
  { id: 'rocket',    label: 'Fusée',      Icon: Rocket },
  { id: 'gift',      label: 'Cadeau',     Icon: Gift },
  { id: 'sparkles',  label: 'Étoiles',    Icon: Sparkles },
  { id: 'zap',       label: 'Éclair',     Icon: Zap },
  { id: 'flame',     label: 'Flamme',     Icon: Flame },
  { id: 'star',      label: 'Étoile',     Icon: Star },
  { id: 'crown',     label: 'Couronne',   Icon: Crown },
  { id: 'gem',       label: 'Diamant',    Icon: Gem },
  { id: 'trophy',    label: 'Trophée',    Icon: Trophy },
  { id: 'truck',     label: 'Livraison',  Icon: Truck },
  { id: 'package',   label: 'Colis',      Icon: Package },
  { id: 'send',      label: 'Envoyer',    Icon: Send },
  { id: 'heart',     label: 'Cœur',       Icon: Heart },
  { id: 'thumbs',    label: 'Pouce',      Icon: ThumbsUp },
  { id: 'tag',       label: 'Étiquette',  Icon: Tag },
  { id: 'lock',      label: 'Sécurisé',   Icon: Lock },
  { id: 'badge',     label: 'Vérifié',    Icon: BadgeCheck },
  { id: 'bell',      label: 'Cloche',     Icon: Bell },
  { id: 'arrow',     label: 'Flèche',     Icon: ArrowRight },
  { id: 'check',     label: 'Valider',    Icon: Check },
];

// ── Catalogue d'animations partagé ───────────────────────────────────────────
// Chaque animation a un `id` (stocké en config) et un `keyframes` CSS.
// La couleur du bouton est injectée via `{{color}}` pour les animations
// type "glow"/"neon" qui doivent suivre la couleur choisie par l'utilisateur.
const ANIMATIONS = [
  { id: 'none',          label: 'Aucune' },
  { id: 'pulse',         label: 'Pulsation' },
  { id: 'bounce',        label: 'Rebond' },
  { id: 'shake',         label: 'Vibration' },
  { id: 'glow',          label: 'Halo lumineux' },
  { id: 'breathe',       label: 'Respiration' },
  { id: 'wobble',        label: 'Balancement' },
  { id: 'heartbeat',     label: 'Battement cœur' },
  { id: 'jelly',         label: 'Gélatine' },
  { id: 'swing',         label: 'Pendule' },
  { id: 'tada',          label: 'Tada' },
  { id: 'neon',          label: 'Néon' },
  { id: 'gradient-shift', label: 'Dégradé animé' },
  { id: 'shimmer',       label: 'Reflet' },
  { id: 'rubber',        label: 'Élastique' },
  { id: 'flash',         label: 'Flash' },
];

// CSS injecté une fois sur la page — partagé entre l'aperçu du form builder
// et la page produit publique pour garantir un rendu identique.
const ANIMATION_CSS = `
@keyframes sf-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
@keyframes sf-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes sf-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
@keyframes sf-glow { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0)} 50%{box-shadow:0 0 24px 4px currentColor} }
@keyframes sf-breathe { 0%,100%{transform:scale(1); opacity:1} 50%{transform:scale(1.02); opacity:.92} }
@keyframes sf-wobble { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(-2deg)} 75%{transform:rotate(2deg)} }
@keyframes sf-heartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.08)} 28%{transform:scale(1)} 42%{transform:scale(1.08)} 70%{transform:scale(1)} }
@keyframes sf-jelly { 0%,100%{transform:scale(1,1)} 30%{transform:scale(1.12,.88)} 40%{transform:scale(.92,1.08)} 50%{transform:scale(1.05,.95)} 65%{transform:scale(.98,1.02)} }
@keyframes sf-swing { 0%,100%{transform:rotate(0deg)} 20%{transform:rotate(8deg)} 60%{transform:rotate(-6deg)} 80%{transform:rotate(4deg)} }
@keyframes sf-tada { 0%,100%{transform:scale(1) rotate(0)} 10%,20%{transform:scale(.9) rotate(-3deg)} 30%,50%,70%,90%{transform:scale(1.08) rotate(3deg)} 40%,60%,80%{transform:scale(1.08) rotate(-3deg)} }
@keyframes sf-neon { 0%,100%{filter:brightness(1) saturate(1); box-shadow:0 0 8px currentColor} 50%{filter:brightness(1.2) saturate(1.4); box-shadow:0 0 28px currentColor, 0 0 8px currentColor inset} }
@keyframes sf-gradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes sf-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes sf-rubber { 0%,100%{transform:scale(1,1)} 30%{transform:scale(1.25,.75)} 40%{transform:scale(.75,1.25)} 50%{transform:scale(1.15,.85)} 65%{transform:scale(.95,1.05)} 75%{transform:scale(1.05,.95)} }
@keyframes sf-flash { 0%,50%,100%{opacity:1} 25%,75%{opacity:.45} }
.sf-anim-pulse { animation: sf-pulse 1.8s ease-in-out infinite; }
.sf-anim-bounce { animation: sf-bounce 1.2s ease-in-out infinite; }
.sf-anim-shake { animation: sf-shake 0.8s ease-in-out infinite; }
.sf-anim-glow { animation: sf-glow 2s ease-in-out infinite; }
.sf-anim-breathe { animation: sf-breathe 2.4s ease-in-out infinite; }
.sf-anim-wobble { animation: sf-wobble 1.4s ease-in-out infinite; }
.sf-anim-heartbeat { animation: sf-heartbeat 1.4s ease-in-out infinite; }
.sf-anim-jelly { animation: sf-jelly 1.4s ease-in-out infinite; }
.sf-anim-swing { animation: sf-swing 1.6s ease-in-out infinite; transform-origin: top center; }
.sf-anim-tada { animation: sf-tada 1.6s ease-in-out infinite; }
.sf-anim-neon { animation: sf-neon 1.8s ease-in-out infinite; }
.sf-anim-gradient-shift { background-size: 200% 200% !important; animation: sf-gradient 3s ease-in-out infinite; }
.sf-anim-shimmer { background-image: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%); background-size: 200% 100%; animation: sf-shimmer 2.4s linear infinite; }
.sf-anim-rubber { animation: sf-rubber 1.4s ease-in-out infinite; }
.sf-anim-flash { animation: sf-flash 1.2s ease-in-out infinite; }
`;

// Retourne la classe CSS à appliquer pour une animation donnée.
const getAnimationClass = (animId) => {
  if (!animId || animId === 'none') return '';
  // Vérifie que l'id est dans le catalogue connu (sécurité)
  if (!ANIMATIONS.find(a => a.id === animId)) return '';
  return `sf-anim-${animId}`;
};

const getIconComponent = (iconId) => {
  return ICONS.find(i => i.id === iconId)?.Icon || ShoppingCart;
};

// Composant utilitaire à monter une fois en haut d'arbre pour injecter les
// keyframes (le form builder l'inclut dans son aperçu, la page produit publique
// peut aussi le réutiliser).
const ButtonAnimationStyles = () => (
  <style>{ANIMATION_CSS}</style>
);

const ButtonEditor = ({ config, designConfig, onChange }) => {
  const update = (key, val) => onChange({ ...config, [key]: val });
  const btnColor = designConfig.buttonColor || '#ff6600';
  const radius = parseInt(designConfig.borderRadius) || 8;
  const hasShadow = designConfig.shadow !== false;
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
            className={`flex flex-col items-center justify-center gap-0.5 px-8 py-3.5 font-bold text-white transition-all ${animClass}`}
            style={{
              backgroundColor: btnColor,
              borderRadius: radius >= 16 ? '999px' : `${radius}px`,
              boxShadow: hasShadow ? `0 4px 16px ${btnColor}50` : 'none',
              minWidth: 220,
              // currentColor pilote sf-glow / sf-neon → suit la couleur de fond
              color: '#fff',
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
        <div className="grid grid-cols-6 gap-1.5">
          {ICONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => update('icon', id)}
              title={label}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                config.icon === id
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-transparent bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Icon size={16} />
              <span className="text-[9px] font-medium leading-tight truncate w-full text-center">{label}</span>
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

export { getIconComponent, getAnimationClass, ButtonAnimationStyles, ANIMATION_CSS, ICONS, ANIMATIONS };
export default ButtonEditor;
