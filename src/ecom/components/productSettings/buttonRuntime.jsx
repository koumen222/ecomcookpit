import React from 'react';
import {
  ShoppingCart, CreditCard, Rocket, Gift, Sparkles, Zap,
  Truck, Heart, ArrowRight, Check, Flame, Crown, Star, Gem,
  Trophy, Lock, ShoppingBag, BadgeCheck, Tag, Send, Bell,
  ThumbsUp, Wallet, Package,
} from 'lucide-react';

export const ICONS = [
  { id: 'cart',      label: 'Panier',     Icon: ShoppingCart },
  { id: 'bag',       label: 'Sac',        Icon: ShoppingBag },
  { id: 'credit',    label: 'Paiement',   Icon: CreditCard },
  { id: 'wallet',    label: 'Portefeuille', Icon: Wallet },
  { id: 'rocket',    label: 'Fusee',      Icon: Rocket },
  { id: 'gift',      label: 'Cadeau',     Icon: Gift },
  { id: 'sparkles',  label: 'Etoiles',    Icon: Sparkles },
  { id: 'zap',       label: 'Eclair',     Icon: Zap },
  { id: 'flame',     label: 'Flamme',     Icon: Flame },
  { id: 'star',      label: 'Etoile',     Icon: Star },
  { id: 'crown',     label: 'Couronne',   Icon: Crown },
  { id: 'gem',       label: 'Diamant',    Icon: Gem },
  { id: 'trophy',    label: 'Trophee',    Icon: Trophy },
  { id: 'truck',     label: 'Livraison',  Icon: Truck },
  { id: 'package',   label: 'Colis',      Icon: Package },
  { id: 'send',      label: 'Envoyer',    Icon: Send },
  { id: 'heart',     label: 'Coeur',      Icon: Heart },
  { id: 'thumbs',    label: 'Pouce',      Icon: ThumbsUp },
  { id: 'tag',       label: 'Etiquette',  Icon: Tag },
  { id: 'lock',      label: 'Securise',   Icon: Lock },
  { id: 'badge',     label: 'Verifie',    Icon: BadgeCheck },
  { id: 'bell',      label: 'Cloche',     Icon: Bell },
  { id: 'arrow',     label: 'Fleche',     Icon: ArrowRight },
  { id: 'check',     label: 'Valider',    Icon: Check },
];

export const ANIMATIONS = [
  { id: 'none',          label: 'Aucune' },
  { id: 'pulse',         label: 'Pulsation' },
  { id: 'bounce',        label: 'Rebond' },
  { id: 'shake',         label: 'Vibration' },
  { id: 'glow',          label: 'Halo lumineux' },
  { id: 'breathe',       label: 'Respiration' },
  { id: 'wobble',        label: 'Balancement' },
  { id: 'heartbeat',     label: 'Battement coeur' },
  { id: 'jelly',         label: 'Gelatine' },
  { id: 'swing',         label: 'Pendule' },
  { id: 'tada',          label: 'Tada' },
  { id: 'neon',          label: 'Neon' },
  { id: 'gradient-shift', label: 'Degrade anime' },
  { id: 'shimmer',       label: 'Reflet' },
  { id: 'rubber',        label: 'Elastique' },
  { id: 'flash',         label: 'Flash' },
];

export const ANIMATION_CSS = `
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

export const getAnimationClass = (animId) => {
  if (!animId || animId === 'none') return '';
  if (!ANIMATIONS.find(a => a.id === animId)) return '';
  return `sf-anim-${animId}`;
};

export const getIconComponent = (iconId) => {
  return ICONS.find(i => i.id === iconId)?.Icon || ShoppingCart;
};

export const ButtonAnimationStyles = () => (
  <style>{ANIMATION_CSS}</style>
);
