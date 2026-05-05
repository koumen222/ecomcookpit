import React from 'react';
import { Truck, Zap, Phone, ShieldCheck, Star, Clock, Package } from 'lucide-react';

const ICON_MAP = {
  '✅': Package,
  '🚚': Truck,
  '📞': Phone,
  '🔒': ShieldCheck,
  '⚡': Zap,
  '⭐': Star,
  '⏱️': Clock,
};

function BlockIcon({ icon, color }) {
  const LucideIcon = ICON_MAP[icon];
  if (LucideIcon) {
    return <LucideIcon size={22} color={color} strokeWidth={2.2} />;
  }
  return <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>;
}

/**
 * Blocs de conversion pour rassurer et pousser à l'achat
 * Optimisé pour le marché africain
 */
export default function ConversionBlocks({ blocks = null, compact = false, iconColor = 'var(--s-section-trust, var(--s-primary))', borderColor = 'var(--s-section-trust-border, var(--s-border))', backgroundColor = 'var(--s-section-trust-soft, var(--s-bg))', textColor = 'var(--s-text)' }) {
  const defaultBlocks = [
    { icon: '✅', text: 'Paiement à la livraison' },
    { icon: '🚚', text: 'Livraison rapide' },
    { icon: '📞', text: 'Support WhatsApp' },
    { icon: '🔒', text: 'Garantie satisfaction' },
  ];

  const displayBlocks = blocks && blocks.length > 0 ? blocks : defaultBlocks;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 6 }}>
      {displayBlocks.map((block, index) => (
        <div key={index} title={block.text} style={{
          width: 34, height: 34, borderRadius: '50%',
          border: `1px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{block.icon}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Badge d'urgence pour créer la pression psychologique
 */
export function UrgencyBadge({ stockLimited = false, socialProofCount = null, quickResult = null }) {
  if (!stockLimited && !socialProofCount && !quickResult) return null;

  const items = [
    stockLimited && { icon: <Zap size={11} />, text: 'Stock limité — commandez vite' },
    socialProofCount && { icon: <Star size={11} />, text: `${socialProofCount} clients satisfaits` },
    quickResult && { icon: <Clock size={11} />, text: quickResult },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 5, marginTop: 8, marginBottom: 6, overflowX: 'auto' }}>
      {items.map((item, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 999,
          background: 'var(--ai-soft-gradient, #FEF3C7)',
          border: '1px solid var(--ai-soft-border, #FCD34D)',
          fontSize: 11, fontWeight: 600,
          color: 'var(--ai-text, #92400E)', fontFamily: 'var(--s-font)',
        }}>
          {item.icon}{item.text}
        </span>
      ))}
    </div>
  );
}
