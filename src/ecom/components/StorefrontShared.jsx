import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, ChevronRight, MessageCircle, MapPin, Phone, Mail, CreditCard, Menu, X,
} from 'lucide-react';
import { preloadStoreCheckoutRoute } from '../utils/routePrefetch';

// ── Shared Header (mobile: hamburger | logo center | cart) ──────────────────
export const StorefrontHeader = ({ store, cartCount = 0, prefix = '' }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <style>{`
        .sfh-desktop-links { display: flex; }
        .sfh-hamburger { display: none; }
        .sfh-store-name { display: inline; }
        .sfh-logo-link { }
        .sfh-cart-text { display: inline; }
        @media (max-width: 768px) {
          .sfh-desktop-links { display: none !important; }
          .sfh-hamburger { display: flex !important; }
          .sfh-store-name { display: none !important; }
          .sfh-logo-link { position: absolute !important; left: 50% !important; transform: translateX(-50%) !important; }
          .sfh-cart-text { display: none !important; }
        }
        @media (min-width: 769px) {
          .sfh-mobile-drawer, .sfh-mobile-overlay { display: none !important; }
        }
      `}</style>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        fontFamily: 'var(--s-font)',
        transition: 'all 0.3s ease',
        backgroundColor: scrolled ? 'rgba(255,255,255,0.92)' : 'var(--s-bg)',
        backdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(180%)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid var(--s-border)',
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 16px',
          height: scrolled ? 52 : 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'height 0.3s ease',
          position: 'relative',
        }}>
          {/* Left: Hamburger (mobile) + desktop nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '1 1 0', minWidth: 0 }}>
            <button
              className="sfh-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                padding: 8, borderRadius: 8, border: 'none',
                backgroundColor: mobileMenuOpen ? '#F3F4F6' : 'transparent', cursor: 'pointer',
                alignItems: 'center', justifyContent: 'center',
              }}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} color="var(--s-text)" /> : <Menu size={20} color="var(--s-text)" />}
            </button>

            <div className="sfh-desktop-links" style={{ alignItems: 'center', gap: 4 }}>
              <Link to={`${prefix}/`} className="sf-nav-link" style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
              }}>Accueil</Link>
              <Link to={`${prefix}/products`} className="sf-nav-link" style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
              }}>Produits</Link>
            </div>
          </div>

          {/* Center: Logo */}
          <Link to={`${prefix}/`} className="sfh-logo-link" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            {store?.logo ? (
              <img
                src={store.logo} alt={store?.name}
                style={{ height: scrolled ? 28 : 32, width: 'auto', maxWidth: 100, objectFit: 'contain', transition: 'height 0.3s' }}
              />
            ) : (
              <span style={{
                width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--s-primary)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, flexShrink: 0,
              }}>
                {(store?.name || 'S')[0].toUpperCase()}
              </span>
            )}
            <span className="sfh-store-name" style={{
              fontWeight: 700, fontSize: scrolled ? 15 : 16, color: 'var(--s-text)',
              letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'font-size 0.3s',
            }}>
              {store?.name}
            </span>
          </Link>

          {/* Right: Cart */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 0', minWidth: 0 }}>
            <Link
              to={`${prefix}/checkout`}
              onMouseEnter={preloadStoreCheckoutRoute}
              onFocus={preloadStoreCheckoutRoute}
              onTouchStart={preloadStoreCheckoutRoute}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 99,
                border: '1.5px solid',
                borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
                backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
                color: cartCount > 0 ? '#fff' : 'var(--s-text)',
                textDecoration: 'none', fontWeight: 600, fontSize: 13, fontFamily: 'var(--s-font)',
                transition: 'all 0.2s',
              }}
            >
              <ShoppingCart size={16} />
              {cartCount > 0 && <span className="sfh-cart-text">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="sfh-mobile-overlay"
          style={{
            position: 'fixed', inset: 0, top: scrolled ? 52 : 58,
            backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 40,
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <div
        className="sfh-mobile-drawer"
        style={{
          position: 'fixed', top: scrolled ? 52 : 58, left: 0,
          width: 280, maxWidth: '80vw',
          height: `calc(100vh - ${scrolled ? 52 : 58}px)`,
          backgroundColor: '#fff', boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
          zIndex: 45,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
          padding: 24, display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {[
          { label: 'Accueil', href: `${prefix}/` },
          { label: 'Produits', href: `${prefix}/products` },
        ].map(link => (
          <Link
            key={link.label} to={link.href}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              padding: '14px 16px', borderRadius: 12, fontSize: 16, fontWeight: 600,
              color: 'var(--s-text)', textDecoration: 'none', fontFamily: 'var(--s-font)',
              backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 12,
            }}
          >{link.label}</Link>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #E5E7EB' }}>
          <Link
            to={`${prefix}/checkout`}
            onClick={() => setMobileMenuOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '14px 20px', borderRadius: 40,
              backgroundColor: 'var(--s-primary)', color: '#fff', textDecoration: 'none',
              fontWeight: 700, fontSize: 15, fontFamily: 'var(--s-font)',
            }}
          >
            <ShoppingCart size={18} />
            Voir mon panier {cartCount > 0 && `(${cartCount})`}
          </Link>
        </div>
      </div>
    </>
  );
};

// ── Shared Footer (full, professional) ──────────────────────────────────────
export const StorefrontFooter = ({ store, prefix = '' }) => {
  const whatsapp = store?.whatsapp?.replace(/\D/g, '');
  const waLink = whatsapp ? `https://wa.me/${whatsapp}` : null;

  return (
    <footer style={{
      backgroundColor: '#1F2937', color: 'rgba(255,255,255,0.7)',
      fontFamily: 'var(--s-font)', marginTop: 0,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(40px, 6vw, 64px) 16px clamp(32px, 5vw, 48px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '32px 40px',
      }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {store?.logo ? (
              <img src={store.logo} alt={store?.name} style={{
                height: 36, width: 'auto', objectFit: 'contain',
                filter: 'brightness(0) invert(1)', opacity: 0.9,
              }} />
            ) : (
              <span style={{
                width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--s-primary)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16,
              }}>
                {(store?.name || 'S')[0]}
              </span>
            )}
            <span style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>{store?.name}</span>
          </div>
          {store?.description && (
            <p style={{ fontSize: 13, lineHeight: 1.65, margin: '0 0 16px', maxWidth: 340, color: 'rgba(255,255,255,0.55)' }}>
              {store.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { icon: <CreditCard size={14} />, label: 'Carte' },
              { icon: <MessageCircle size={14} />, label: 'Mobile Money' },
            ].map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 5, fontSize: 11, color: 'rgba(255,255,255,0.6)',
              }}>
                {m.icon}<span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, color: '#fff', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Navigation
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Accueil', href: `${prefix}/` },
              { label: 'Tous nos produits', href: `${prefix}/products` },
            ].map(link => (
              <Link key={link.label} to={link.href} style={{
                fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <ChevronRight size={13} />{link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <p style={{ fontWeight: 700, fontSize: 12, color: '#fff', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Contact
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {store?.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                <MapPin size={14} style={{ flexShrink: 0 }} />
                {store.city}{store.country ? `, ${store.country}` : ''}
              </span>
            )}
            {store?.phone && (
              <a href={`tel:${store.phone.replace(/\s/g, '')}`} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
              }}>
                <Phone size={14} style={{ flexShrink: 0 }} />{store.phone}
              </a>
            )}
            {store?.email && (
              <a href={`mailto:${store.email}`} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                color: 'rgba(255,255,255,0.6)', textDecoration: 'none', wordBreak: 'break-all',
              }}>
                <Mail size={14} style={{ flexShrink: 0 }} />{store.email}
              </a>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 13, color: '#fff', textDecoration: 'none',
                backgroundColor: '#25D366', padding: '8px 14px', borderRadius: 7,
                fontWeight: 600, marginTop: 4, width: 'fit-content',
              }}>
                <MessageCircle size={14} />WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '18px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)',
        }}>
          <span>© {new Date().getFullYear()} {store?.name}</span>
          <span>
            Propulsé par{' '}
            <a href="https://scalor.net" target="_blank" rel="noreferrer" style={{
              color: 'var(--s-primary)', fontWeight: 700, textDecoration: 'none',
            }}>Scalor</a>
          </span>
        </div>
      </div>
    </footer>
  );
};
