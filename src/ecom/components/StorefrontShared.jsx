import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, ChevronRight, MessageCircle, MapPin, Phone, Mail, CreditCard,
} from 'lucide-react';
import { preloadStoreCheckoutRoute } from '../utils/routePrefetch';

// ── Shared Header (simple, clean, fast) ──────────────────────────────────────
export const StorefrontHeader = ({ store, cartCount = 0, prefix = '' }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
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
      }}>
        {/* Logo + Name */}
        <Link to={`${prefix}/`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', minWidth: 0 }}>
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
          <span style={{
            fontWeight: 700, fontSize: scrolled ? 15 : 16, color: 'var(--s-text)',
            letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'font-size 0.3s',
          }}>
            {store?.name}
          </span>
        </Link>

        {/* Nav links (desktop) + Cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link to={`${prefix}/`} className="sf-nav-link" style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
          }}>Accueil</Link>
          <Link to={`${prefix}/products`} className="sf-nav-link" style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
            color: 'var(--s-text2)', textDecoration: 'none', fontFamily: 'var(--s-font)',
          }}>Produits</Link>

          <Link
            to={`${prefix}/checkout`}
            onMouseEnter={preloadStoreCheckoutRoute}
            onFocus={preloadStoreCheckoutRoute}
            onTouchStart={preloadStoreCheckoutRoute}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 99, marginLeft: 4,
              border: '1.5px solid',
              borderColor: cartCount > 0 ? 'var(--s-primary)' : 'var(--s-border)',
              backgroundColor: cartCount > 0 ? 'var(--s-primary)' : 'transparent',
              color: cartCount > 0 ? '#fff' : 'var(--s-text)',
              textDecoration: 'none', fontWeight: 600, fontSize: 13, fontFamily: 'var(--s-font)',
              transition: 'all 0.2s',
            }}
          >
            <ShoppingCart size={16} />
            {cartCount > 0 && <span>{cartCount}</span>}
          </Link>
        </div>
      </div>
    </header>
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
