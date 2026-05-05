import React, { useEffect, useRef } from 'react';

export default function ProductBenefits({ benefits = [], title = "", accentColor = 'var(--s-section-benefits, var(--s-primary))', textColor = 'var(--s-text)' }) {
  if (!benefits || benefits.length === 0) return null;

  return (
    <div style={{ margin: '0 calc(var(--pp-current-info-padding, 16px) * -1)', padding: '32px 28px', borderRadius: 0, background: accentColor, overflow: 'hidden' }}>
      <style>{`
        @keyframes pb-slide-in {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pb-check-pop {
          0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.3) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .pb-row {
          opacity: 0;
          animation: pb-slide-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .pb-check {
          animation: pb-check-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          animation-delay: inherit;
        }
      `}</style>

      {title ? (
        <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 10, fontFamily: 'var(--s-font)' }}>
          {title}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {benefits.map((benefit, index) => {
          const emojiMatch = benefit.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u);
          const text = emojiMatch ? benefit.slice(emojiMatch[0].length).trim() : benefit;
          const delay = `${index * 0.1}s`;
          return (
            <div key={index} className="pb-row" style={{ display: 'flex', alignItems: 'center', gap: 12, animationDelay: delay }}>
              <span className="pb-check" style={{
                width: 26, height: 26, borderRadius: '50%',
                background: '#fff', color: accentColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900, flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                animationDelay: delay,
              }}>✓</span>
              <p style={{ fontSize: 'inherit', lineHeight: 1.5, color: '#fff', margin: 0, fontFamily: 'var(--s-font)', fontWeight: 600 }}>
                {text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductBenefitsCompact({ benefits = [] }) {
  if (!benefits || benefits.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {benefits.slice(0, 5).map((benefit, index) => {
        const emojiMatch = benefit.match(/^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u);
        const text = emojiMatch ? benefit.slice(emojiMatch[0].length).trim() : benefit;
        return (
          <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', color: 'var(--s-primary)', border: '1.5px solid var(--s-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
            <p style={{ fontSize: 'inherit', lineHeight: 1.5, color: 'var(--s-text2)', margin: 0, fontFamily: 'var(--s-font)' }}>{text}</p>
          </div>
        );
      })}
    </div>
  );
}
