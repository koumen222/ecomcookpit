import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

/**
 * Carrousel horizontal de témoignages pour pages produits
 * Autoplay + swipe mobile + navigation par boutons
 */
export default function ProductTestimonials({ testimonials = [] }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const autoplayRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  // Autoplay
  useEffect(() => {
    if (!testimonials || testimonials.length <= 1) return;
    const el = scrollRef.current;
    if (!el) return;

    autoplayRef.current = setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(autoplayRef.current);
  }, [testimonials]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const pauseAutoplay = () => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  };

  const scroll = (dir) => {
    pauseAutoplay();
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  // Swipe mobile
  const onTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };
  const onTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      pauseAutoplay();
      scrollRef.current?.scrollBy({ left: diff > 0 ? 300 : -300, behavior: 'smooth' });
    }
  };

  if (!testimonials || testimonials.length === 0) return null;

  // Generate deterministic avatar colors based on name
  const avatarColors = [
    ['#4F46E5', '#7C3AED'], ['#059669', '#0D9488'], ['#D97706', '#DC2626'],
    ['#2563EB', '#7C3AED'], ['#DC2626', '#F59E0B'], ['#7C3AED', '#EC4899'],
    ['#0891B2', '#0284C7'], ['#16A34A', '#65A30D'],
  ];

  return (
    <div style={{ margin: '32px 0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '0 4px' }}>
        <div>
          <h3 style={{
            fontSize: 'clamp(18px, 3vw, 22px)', fontWeight: 800, color: 'var(--s-text, #111)',
            margin: 0, fontFamily: 'var(--s-font, sans-serif)',
          }}>
            💬 Avis de nos clients
          </h3>
          <p style={{ fontSize: 13, color: 'var(--s-text2, #666)', margin: '4px 0 0', fontFamily: 'var(--s-font, sans-serif)' }}>
            {testimonials.length} avis vérifiés
          </p>
        </div>

        {/* Navigation buttons - desktop */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--s-border, #e5e7eb)',
              background: 'var(--s-bg, #fff)', cursor: canScrollLeft ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: canScrollLeft ? 1 : 0.3, transition: 'opacity 0.2s',
            }}
            aria-label="Précédent"
          >
            <ChevronLeft size={18} color="var(--s-text, #333)" />
          </button>
          <button
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--s-border, #e5e7eb)',
              background: 'var(--s-bg, #fff)', cursor: canScrollRight ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: canScrollRight ? 1 : 0.3, transition: 'opacity 0.2s',
            }}
            aria-label="Suivant"
          >
            <ChevronRight size={18} color="var(--s-text, #333)" />
          </button>
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
          paddingBottom: 8,
        }}
      >
        <style>{`
          .testimonials-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {testimonials.map((t, i) => {
          const colors = avatarColors[i % avatarColors.length];
          const initials = (t.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div
              key={i}
              style={{
                minWidth: 280, maxWidth: 320, flex: '0 0 auto', scrollSnapAlign: 'start',
                background: 'var(--s-bg, #fff)', borderRadius: 16,
                border: '1px solid var(--s-border, #e5e7eb)',
                padding: 20, position: 'relative',
              }}
            >
              {/* Avatar + Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {t.image ? (
                  <img
                    src={t.image}
                    alt={t.name}
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
                    fontFamily: 'var(--s-font, sans-serif)',
                  }}>
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--s-text, #111)',
                    fontFamily: 'var(--s-font, sans-serif)',
                  }}>
                    {t.name || 'Client vérifié'}
                  </p>
                  {t.location && (
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--s-text2, #888)', fontFamily: 'var(--s-font, sans-serif)' }}>
                      📍 {t.location}
                    </p>
                  )}
                </div>
              </div>

              {/* Stars */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
                {[...Array(t.rating || 5)].map((_, j) => (
                  <Star key={j} size={16} fill="#F59E0B" color="#F59E0B" />
                ))}
              </div>

              {/* Text */}
              <p style={{
                margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--s-text, #333)',
                fontFamily: 'var(--s-font, sans-serif)', fontStyle: 'italic',
              }}>
                "{t.text || t.comment}"
              </p>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                {t.date && (
                  <span style={{ fontSize: 11, color: 'var(--s-text2, #999)', fontFamily: 'var(--s-font, sans-serif)' }}>
                    {t.date}
                  </span>
                )}
                {t.verified && (
                  <span style={{
                    fontSize: 11, color: '#059669', background: '#ECFDF5',
                    padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                    fontFamily: 'var(--s-font, sans-serif)',
                  }}>
                    ✓ Vérifié
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
