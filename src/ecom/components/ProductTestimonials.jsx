import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';

/**
 * Carrousel horizontal de témoignages pour pages produits
 * Autoplay + swipe mobile + navigation par boutons
 */
export default function ProductTestimonials({ testimonials = [], productImage = null, groupImage = null, socialProofImage = null, visualTheme = null }) {
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
    if (!validTestimonials || validTestimonials.length <= 1) return;
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

  // Filter out empty/invalid testimonials before rendering
  const validTestimonials = (testimonials || []).filter(t =>
    t && typeof t.text === 'string' && t.text.trim().length > 5 &&
    t.name && t.name !== 'Client vérifié'
  );

  if (!validTestimonials.length) return null;

  return (
    <div style={{
      margin: '32px 0', overflow: 'hidden', maxWidth: '100%',
      '--ai-primary': visualTheme?.primary || 'var(--s-section-social-proof, var(--s-primary))',
      '--ai-gradient': visualTheme?.gradient || 'linear-gradient(135deg, var(--s-section-social-proof, var(--s-primary)), var(--s-section-social-proof, var(--s-primary)))',
      '--ai-soft-gradient': visualTheme?.softGradient || 'var(--s-section-social-proof-soft, var(--s-bg))',
      '--ai-soft-border': visualTheme?.softBorder || 'var(--s-section-social-proof-border, var(--s-border))',
      '--ai-shadow': visualTheme?.shadow || 'var(--s-section-social-proof-shadow, 0 2px 8px rgba(0,0,0,0.06))',
      '--ai-text': visualTheme?.text || 'var(--s-text)',
      '--ai-muted': visualTheme?.mutedText || 'var(--s-text2)',
      '--ai-surface': visualTheme?.surface || 'var(--s-bg)',
    }}>

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
            {validTestimonials.length} avis vérifiés
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
        {validTestimonials.map((t, i) => {
          const initials = (t.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div
              key={i}
              style={{
                minWidth: 'min(280px, 85vw)', maxWidth: 340, flex: '0 0 auto', scrollSnapAlign: 'start',
                background: 'var(--ai-surface, #F3F4F6)',
                borderRadius: 20,
                border: '1px solid var(--ai-soft-border, transparent)',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'var(--ai-shadow, 0 2px 8px rgba(0,0,0,0.06))',
              }}
            >


              <div style={{ padding: 16 }}>
                {/* Verified badge */}
                {t.verified && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'var(--ai-soft-gradient, #D1FAE5)', borderRadius: 99, padding: '3px 10px', marginBottom: 10,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ai-primary, var(--s-primary, #059669))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style={{ fontSize: 10, color: 'var(--s-primary, #059669)', fontWeight: 700, fontFamily: 'var(--s-font, sans-serif)' }}>
                      Avis vérifié
                    </span>
                  </div>
                )}

                {/* Stars */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill={j < (t.rating || 5) ? '#F59E0B' : '#E5E7EB'} color={j < (t.rating || 5) ? '#F59E0B' : '#E5E7EB'} />
                  ))}
                </div>

                {/* Text */}
                <p style={{
                  margin: '0 0 14px', fontSize: 13, lineHeight: 1.65, color: 'var(--ai-text, #1F2937)',
                  fontFamily: 'var(--s-font, sans-serif)', fontWeight: 500,
                }}>
                  "{t.text || t.comment}"
                </p>

                {/* Avatar + Info — bottom */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'var(--ai-gradient, linear-gradient(135deg, #4F46E5, #7C3AED))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                    fontFamily: 'var(--s-font, sans-serif)',
                    border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                  }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: 'var(--ai-text, #111827)', fontFamily: 'var(--s-font, sans-serif)' }}>
                      {t.name || 'Client vérifié'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ai-muted, #6B7280)', fontFamily: 'var(--s-font, sans-serif)' }}>
                      {t.location ? `📍 ${t.location}` : ''}{t.date ? (t.location ? ` · ${t.date}` : t.date) : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
