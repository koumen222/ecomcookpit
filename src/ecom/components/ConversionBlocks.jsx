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
  // Blocs par défaut si non fournis
  const defaultBlocks = [
    { icon: '✅', text: 'Paiement à la livraison' },
    { icon: '🚚', text: 'Livraison rapide' },
    { icon: '📞', text: 'Support WhatsApp' },
    { icon: '🔒', text: 'Garantie satisfaction' },
  ];

  const displayBlocks = blocks && blocks.length > 0 ? blocks : defaultBlocks;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: compact ? 6 : 8,
      marginTop: compact ? 10 : 16,
      marginBottom: compact ? 12 : 16,
    }}>
      {displayBlocks.map((block, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: compact ? '6px 10px' : '8px 12px',
            backgroundColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 999,
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            overflow: 'hidden',
          }}
        >
          <BlockIcon icon={block.icon} color={iconColor} />
          <span style={{
            fontSize: compact ? 11.5 : 12.5,
            fontWeight: 600,
            color: textColor,
            fontFamily: 'var(--s-font)',
          }}>
            {block.text}
          </span>
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 16,
      marginBottom: 16,
    }}>
      {stockLimited && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: 'var(--ai-soft-gradient, #FEF3C7)',
          border: '1px solid var(--ai-soft-border, #FCD34D)',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ai-text, #92400E)',
          fontFamily: 'var(--s-font)',
        }}>
          <Zap size={18} color="var(--ai-primary, #92400E)" />
          <span>Stock limité - Commandez maintenant</span>
        </div>
      )}

      {socialProofCount && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: 'var(--ai-soft-gradient, #DBEAFE)',
          border: '1px solid var(--ai-soft-border, #93C5FD)',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ai-text, #1E40AF)',
          fontFamily: 'var(--s-font)',
        }}>
          <Star size={18} color="var(--ai-primary, #1E40AF)" />
          <span>{socialProofCount} clients satisfaits</span>
        </div>
      )}

      {quickResult && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: 'var(--ai-soft-gradient, #D1FAE5)',
          border: '1px solid var(--ai-soft-border, #6EE7B7)',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ai-text, #065F46)',
          fontFamily: 'var(--s-font)',
        }}>
          <Clock size={18} color="var(--ai-primary, #065F46)" />
          <span>{quickResult}</span>
        </div>
      )}
    </div>
  );
}
