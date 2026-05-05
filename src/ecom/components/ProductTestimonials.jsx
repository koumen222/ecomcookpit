import { useState } from 'react';
import { Quote, Star } from 'lucide-react';

const AVATAR_COLORS = ['#111827', '#F97316', '#0F766E', '#7C2D12', '#1D4ED8', '#9A3412', '#4F46E5'];
const DEFAULT_VISIBLE_COUNT = 6;

const getInitials = (name = 'C') => String(name)
  .split(' ')
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

export default function ProductTestimonials({ testimonials = [], visualTheme = null }) {
  const [showAll, setShowAll] = useState(false);

  const validTestimonials = (testimonials || []).filter((testimonial) => {
    const message = testimonial?.text || testimonial?.comment || '';
    return testimonial
      && typeof message === 'string'
      && message.trim().length > 5
      && testimonial.name
      && testimonial.name !== 'Client vérifié';
  });

  if (!validTestimonials.length) return null;

  const primary = visualTheme?.primary || 'var(--s-section-social-proof, var(--s-primary))';
  const socialProofVisual = visualTheme?.socialProofImage || visualTheme?.generatedPosterImage || null;
  const averageRating = (
    validTestimonials.reduce((sum, testimonial) => sum + Number(testimonial.rating || 5), 0) / validTestimonials.length
  ).toFixed(1);
  const displayedTestimonials = showAll ? validTestimonials : validTestimonials.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreTestimonials = validTestimonials.length > DEFAULT_VISIBLE_COUNT;

  return (
    <section style={{ margin: '48px 0 56px' }}>
      <style>{`
        .product-testimonials-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        @media (min-width: 920px) {
          .product-testimonials-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--s-text2)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'var(--s-font)',
          }}
        >
          <span style={{ width: 28, height: 2, background: primary, borderRadius: 999 }} />
          Avis clients
        </div>

        <h2
          style={{
            margin: '14px 0 10px',
            fontSize: 'clamp(28px, 4vw, 42px)',
            lineHeight: 1.1,
            fontWeight: 900,
            color: 'var(--s-text)',
            fontFamily: 'var(--s-font)',
          }}
        >
          Ce Que Nos <span style={{ color: primary }}>Clients Disent</span>
        </h2>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            borderRadius: 999,
            background: '#fff',
            border: '1px solid var(--s-border)',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)',
            fontFamily: 'var(--s-font)',
          }}
        >
          <div style={{ display: 'flex', gap: 2 }}>
            {[...Array(5)].map((_, index) => (
              <Star
                key={index}
                size={15}
                fill={index < Math.round(Number(averageRating)) ? '#F97316' : '#E5E7EB'}
                color={index < Math.round(Number(averageRating)) ? '#F97316' : '#E5E7EB'}
              />
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--s-text)' }}>{averageRating}</span>
          <span style={{ fontSize: 13, color: 'var(--s-text2)' }}>{validTestimonials.length} avis vérifiés</span>
        </div>
      </div>

      {socialProofVisual && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 32px' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 760,
              padding: 12,
              borderRadius: 34,
              background: 'linear-gradient(180deg, #FFF8DB 0%, #FFFDF3 100%)',
              border: '1px solid rgba(249, 115, 22, 0.18)',
              boxShadow: '0 24px 60px rgba(249, 115, 22, 0.14)',
            }}
          >
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 26,
                aspectRatio: '3 / 4',
                background: 'radial-gradient(circle at top, rgba(255, 224, 132, 0.55), rgba(255,255,255,0.92) 55%, #fff 100%)',
              }}
            >
              <img
                src={socialProofVisual}
                alt="Visuel témoignages généré pour ce produit"
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'contain',
                  background: 'transparent',
                }}
              />

              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  right: 18,
                  bottom: 18,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'rgba(255, 255, 255, 0.88)',
                    color: '#111827',
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: 'var(--s-font)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {validTestimonials.length} avis clients
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="product-testimonials-grid">
        {displayedTestimonials.map((testimonial, index) => {
          const rating = Math.max(1, Math.min(5, Number(testimonial.rating || 5)));
          const avatarBackground = AVATAR_COLORS[index % AVATAR_COLORS.length];
          const initials = getInitials(testimonial.name);

          return (
            <article
              key={`${testimonial.name}-${index}`}
              style={{
                position: 'relative',
                minHeight: '100%',
                padding: '24px 24px 22px',
                borderRadius: 24,
                border: '1px solid var(--s-border)',
                background: '#fff',
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 24,
                  background: `linear-gradient(180deg, color-mix(in srgb, ${primary} 7%, white) 0%, rgba(255,255,255,0) 120px)`,
                  pointerEvents: 'none',
                }}
              />

              <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      background: avatarBackground,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 19,
                      fontWeight: 800,
                      flexShrink: 0,
                      fontFamily: 'var(--s-font)',
                      boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.92)',
                    }}
                  >
                    {initials}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        margin: 0,
                        fontSize: 20,
                        lineHeight: 1.2,
                        fontWeight: 800,
                        color: 'var(--s-text)',
                        fontFamily: 'var(--s-font)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {testimonial.name}
                    </div>

                    {(testimonial.location || testimonial.date) && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: 'var(--s-text2)',
                          fontFamily: 'var(--s-font)',
                        }}
                      >
                        {testimonial.location || 'Client vérifié'}
                        {testimonial.date ? ` · ${testimonial.date}` : ''}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {[...Array(5)].map((_, starIndex) => (
                          <Star
                            key={starIndex}
                            size={15}
                            fill={starIndex < rating ? '#F97316' : '#E5E7EB'}
                            color={starIndex < rating ? '#F97316' : '#E5E7EB'}
                          />
                        ))}
                      </div>

                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--s-text)', fontFamily: 'var(--s-font)' }}>
                        {rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#fff',
                    border: '1px solid color-mix(in srgb, var(--s-border) 65%, white)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: primary,
                    flexShrink: 0,
                    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.06)',
                  }}
                >
                  <Quote size={20} />
                </div>
              </div>

              <p
                style={{
                  position: 'relative',
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 1.75,
                  color: 'var(--s-text2)',
                  fontFamily: 'var(--s-font)',
                }}
              >
                {testimonial.text || testimonial.comment}
              </p>

              <div style={{ position: 'relative', marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--s-border)' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'rgba(249, 115, 22, 0.08)',
                    color: '#C2410C',
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontFamily: 'var(--s-font)',
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>★</span>
                  {testimonial.verified === false ? 'Avis client' : 'Avis vérifié'}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {hasMoreTestimonials && !showAll && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              border: 'none',
              borderRadius: 999,
              background: primary,
              color: '#fff',
              padding: '14px 28px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'var(--s-font)',
              boxShadow: '0 16px 32px rgba(249, 115, 22, 0.22)',
            }}
          >
            Voir plus d'avis
          </button>
        </div>
      )}
    </section>
  );
}
