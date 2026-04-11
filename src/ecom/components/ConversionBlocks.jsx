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
export default function ConversionBlocks({ blocks = null, compact = false }) {
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
      display: 'grid',
      gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: compact ? 8 : 12,
      marginTop: compact ? 10 : 24,
      marginBottom: compact ? 12 : 24,
    }}>
      {displayBlocks.map((block, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: compact ? '10px 8px' : '16px 12px',
            backgroundColor: 'var(--ai-surface, #fff)',
            border: '2px solid var(--ai-primary, var(--s-primary))',
            borderRadius: compact ? 10 : 12,
            textAlign: 'center',
            transition: 'all 0.2s',
            boxShadow: 'var(--ai-shadow, none)',
          }}
          className="conversion-block"
        >
          <span style={{
            marginBottom: compact ? 4 : 6,
            lineHeight: 1,
          }}>
            <BlockIcon icon={block.icon} color="var(--ai-primary, var(--s-primary))" />
          </span>
          <p style={{
            fontSize: compact ? 11.5 : 13,
            fontWeight: 700,
            color: 'var(--s-text)',
            margin: 0,
            fontFamily: 'var(--s-font)',
            lineHeight: compact ? 1.2 : 1.3,
          }}>
            {block.text}
          </p>
        </div>
      ))}

      <style>{`
        .conversion-block:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}</style>
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
