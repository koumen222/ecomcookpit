import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

/**
 * Carrousel horizontal de témoignages pour pages produits
 * Autoplay + swipe mobile + navigation par boutons
 */
export default function ProductTestimonials({ testimonials = [], productImage = null }) {
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
                minWidth: 300, maxWidth: 340, flex: '0 0 auto', scrollSnapAlign: 'start',
                background: '#F3F4F6',
                borderRadius: 20,
                border: 'none',
                padding: 20,
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* Verified badge — top right */}
              {t.verified && (
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#D1FAE5', borderRadius: 99,
                  padding: '3px 10px',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, fontFamily: 'var(--s-font, sans-serif)', letterSpacing: '0.02em' }}>
                    Avis vérifié
                  </span>
                </div>
              )}

              {/* Stars */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={15} fill={j < (t.rating || 5) ? '#F59E0B' : '#E5E7EB'} color={j < (t.rating || 5) ? '#F59E0B' : '#E5E7EB'} />
                ))}
              </div>

              {/* Text */}
              <p style={{
                margin: '0 0 16px', fontSize: 14, lineHeight: 1.65, color: '#1F2937',
                fontFamily: 'var(--s-font, sans-serif)', fontStyle: 'normal', fontWeight: 500,
              }}>
                "{t.text || t.comment}"
              </p>

              {/* Avatar + Info — bottom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {(productImage && i < 2) ? (
                  <img
                    src={productImage}
                    alt={t.name}
                    loading="lazy"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                  />
                ) : t.image ? (
                  <img
                    src={t.image}
                    alt={t.name}
                    loading="lazy"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
                    fontFamily: 'var(--s-font, sans-serif)',
                    border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                  }}>
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontWeight: 700, fontSize: 14, color: '#111827',
                    fontFamily: 'var(--s-font, sans-serif)',
                  }}>
                    {t.name || 'Client vérifié'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6B7280', fontFamily: 'var(--s-font, sans-serif)' }}>
                    {t.location ? `📍 ${t.location}` : ''}{t.date ? (t.location ? ` · ${t.date}` : t.date) : ''}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
