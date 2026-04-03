import React from 'react';

/**
 * Blocs de conversion pour rassurer et pousser à l'achat
 * Optimisé pour le marché africain
 */
export default function ConversionBlocks({ blocks = null }) {
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12,
      marginTop: 24,
      marginBottom: 24,
    }}>
      {displayBlocks.map((block, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 12px',
            backgroundColor: '#fff',
            border: '2px solid var(--s-primary)',
            borderRadius: 12,
            textAlign: 'center',
            transition: 'all 0.2s',
          }}
          className="conversion-block"
        >
          <span style={{
            fontSize: 20,
            marginBottom: 6,
            lineHeight: 1,
          }}>
            {block.icon}
          </span>
          <p style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--s-text)',
            margin: 0,
            fontFamily: 'var(--s-font)',
            lineHeight: 1.3,
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
          backgroundColor: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: '#92400E',
          fontFamily: 'var(--s-font)',
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span>Stock limité - Commandez maintenant</span>
        </div>
      )}

      {socialProofCount && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#DBEAFE',
          border: '1px solid #93C5FD',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: '#1E40AF',
          fontFamily: 'var(--s-font)',
        }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <span>{socialProofCount} clients satisfaits</span>
        </div>
      )}

      {quickResult && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          backgroundColor: '#D1FAE5',
          border: '1px solid #6EE7B7',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          color: '#065F46',
          fontFamily: 'var(--s-font)',
        }}>
          <span style={{ fontSize: 18 }}>⏱️</span>
          <span>{quickResult}</span>
        </div>
      )}
    </div>
  );
}
