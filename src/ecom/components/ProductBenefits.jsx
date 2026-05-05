import React from 'react';

/**
 * Composant pour afficher les bénéfices produit avec emojis
 * Format optimisé pour mobile et marché africain
 */
export default function ProductBenefits({ benefits = [], title = "", compact = false, accentColor = 'var(--s-section-benefits, var(--s-primary))', borderColor = 'var(--s-section-benefits-border, var(--s-border))', surfaceColor = 'var(--s-section-benefits-soft, var(--s-bg))', textColor = 'var(--s-text)' }) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      {title ? (
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--s-text2)', marginBottom: 6, fontFamily: 'var(--s-font)' }}>
          {title}
        </p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {benefits.map((benefit, index) => {
          const emojiMatch = benefit.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u);
          const text = emojiMatch ? benefit.slice(emojiMatch[0].length).trim() : benefit;
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                background: accentColor, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>✓</span>
              <p style={{ fontSize: 12.5, lineHeight: 1.4, color: textColor, margin: 0, fontFamily: 'var(--s-font)', fontWeight: 500 }}>
                {text}
              </p>
            </div>
          );
        })}
      </div>
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
