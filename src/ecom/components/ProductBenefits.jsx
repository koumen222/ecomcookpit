import React from 'react';

/**
 * Composant pour afficher les bénéfices produit avec emojis
 * Format optimisé pour mobile et marché africain
 */
export default function ProductBenefits({ benefits = [], title = "💥 Les bénéfices", compact = false }) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div style={{
      background: 'var(--ai-soft-gradient, var(--s-bg))',
      borderRadius: compact ? 14 : 16,
      padding: compact ? '10px 10px' : '24px 20px',
      marginBottom: compact ? 12 : 24,
      border: '1px solid var(--ai-soft-border, var(--s-border))',
      boxShadow: 'var(--ai-shadow, none)',
    }}>
      {title ? (
        <h3 style={{
          fontSize: compact ? 15 : 20,
          fontWeight: 800,
          color: 'var(--s-text)',
          marginBottom: compact ? 10 : 20,
          fontFamily: 'var(--s-font)',
          textAlign: compact ? 'left' : 'center',
        }}>
          {title}
        </h3>
      ) : null}
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 8 : 14,
      }}>
        {benefits.map((benefit, index) => {
          // Supprimer l'emoji de début si présent, garder uniquement le texte
          const emojiMatch = benefit.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u);
          const text = emojiMatch ? benefit.slice(emojiMatch[0].length).trim() : benefit;

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: compact ? 10 : 12,
                padding: compact ? '8px 10px' : '14px 16px',
                backgroundColor: 'var(--ai-surface, #fff)',
                borderRadius: compact ? 10 : 12,
                border: '1px solid var(--ai-soft-border, var(--s-border))',
                transition: 'all 0.2s',
              }}
              className="benefit-item"
            >
              <span style={{
                width: compact ? 18 : 22,
                height: compact ? 18 : 22,
                borderRadius: '50%',
                background: 'var(--ai-gradient, var(--s-primary))',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? 11 : 13,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: compact ? 3 : 2,
              }}>
                ✓
              </span>
              <p style={{
                fontSize: compact ? 13 : 15,
                lineHeight: compact ? 1.45 : 1.6,
                color: 'var(--s-text)',
                margin: 0,
                fontFamily: 'var(--s-font)',
                fontWeight: 500,
              }}>
                {text}
              </p>
            </div>
          );
        })}
      </div>

      <style>{`
        .benefit-item:hover {
          transform: translateX(4px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
}

/**
 * Version compacte pour affichage dans des espaces restreints
 */
export function ProductBenefitsCompact({ benefits = [] }) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {benefits.slice(0, 5).map((benefit, index) => {
        const emojiMatch = benefit.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u);
        const text = emojiMatch ? benefit.slice(emojiMatch[0].length).trim() : benefit;

        return (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: 'var(--s-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}>✓</span>
            <p style={{
              fontSize: 13,
              lineHeight: 1.4,
              color: 'var(--s-text2)',
              margin: 0,
              fontFamily: 'var(--s-font)',
            }}>
              {text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
