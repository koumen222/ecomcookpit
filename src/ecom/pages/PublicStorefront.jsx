import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSubdomain, useStorefront } from '../hooks/useStorefront';
import { useThemeSocket } from '../hooks/useThemeSocket';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const FONTS = {
  inter: 'Inter, system-ui, sans-serif',
  poppins: 'Poppins, sans-serif',
  'dm-sans': '"DM Sans", sans-serif',
  montserrat: 'Montserrat, sans-serif',
  playfair: '"Playfair Display", serif',
  'space-grotesk': '"Space Grotesk", sans-serif',
  satoshi: 'Satoshi, Inter, system-ui, sans-serif',
};

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FaqSection = ({ config, t }) => {
  const { title = 'Questions fréquentes', items = [] } = config || {};
  const faqItems = items.length > 0
    ? items
    : [
      { question: 'Quels sont les délais de livraison ?', answer: 'Les livraisons prennent généralement entre 24h et 72h selon votre zone.' },
      { question: 'Comment passer commande ?', answer: 'Ajoutez vos produits puis finalisez via WhatsApp ou le checkout selon la boutique.' },
      { question: 'Puis-je retourner un produit ?', answer: 'Oui, selon les conditions de retour indiquées par la boutique.' },
    ];

  return (
    <section id="faq" className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-8" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <details key={i} className="bg-white border border-gray-100 p-4" style={{ borderRadius: t.radius }}>
              <summary className="cursor-pointer font-semibold text-gray-800">{item.question}</summary>
              <p className="text-sm text-gray-600 mt-2">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── CTA ──────────────────────────────────────────────────────────────────────
const CtaSection = ({ config, t }) => {
  const { title, buttonText = 'Commander', buttonUrl } = config || {};
  if (!title && !buttonUrl) return null;

  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto text-center p-8 md:p-10 border border-gray-100 bg-white" style={{ borderRadius: t.radius }}>
        {title && <h2 className="text-2xl md:text-3xl font-black mb-4" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>}
        <a
          href={buttonUrl || '#products'}
          className="inline-block px-8 py-3.5 text-sm md:text-base font-bold text-white"
          style={{ backgroundColor: t.cta, borderRadius: t.radius }}
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
};
const RADII = { none: '0', sm: '0.375rem', md: '0.75rem', lg: '1rem', xl: '1.5rem', full: '9999px' };
const font = (id) => FONTS[id] || FONTS.inter;
const radius = (id) => RADII[id] || RADII.lg;
const fmt = (n, cur) => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur || 'XAF'}`;

// ═══════════════════════════════════════════════════════════════════════════════
// PIXEL INJECTION — injects Meta, TikTok, Google, Snap pixels into <head>
// ═══════════════════════════════════════════════════════════════════════════════
const usePixelInjection = (pixels) => {
  useEffect(() => {
    if (!pixels) return;
    const scripts = [];

    // Meta Pixel
    if (pixels.metaPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixels.metaPixelId}');fbq('track','PageView');`;
      document.head.appendChild(s);
      scripts.push(s);
    }

    // TikTok Pixel
    if (pixels.tiktokPixelId) {
      const s = document.createElement('script');
      s.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixels.tiktokPixelId}');ttq.page()}(window,document,'ttq');`;
      document.head.appendChild(s);
      scripts.push(s);
    }

    // Google Tag
    if (pixels.googleTagId) {
      const s1 = document.createElement('script');
      s1.async = true;
      s1.src = `https://www.googletagmanager.com/gtag/js?id=${pixels.googleTagId}`;
      document.head.appendChild(s1);
      const s2 = document.createElement('script');
      s2.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${pixels.googleTagId}');`;
      document.head.appendChild(s2);
      scripts.push(s1, s2);
    }

    return () => scripts.forEach(s => s.parentNode?.removeChild(s));
  }, [pixels]);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Announcement Bar ─────────────────────────────────────────────────────────
const AnnouncementBar = ({ store, t }) => {
  if (!store.announcementEnabled || !store.announcement) return null;
  return (
    <div className="py-2.5 px-4 text-center text-sm font-semibold text-white" style={{ backgroundColor: t.cta }}>
      {store.announcement}
    </div>
  );
};

// ── Header ───────────────────────────────────────────────────────────────────
const StoreHeader = ({ store, t, categories, sections }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';

  const navLinks = useMemo(() => {
    const links = [{ label: 'Accueil', href: '#home' }];
    const hasType = (type) => sections?.some((s) => s.enabled && s.type === type);
    if (hasType('featured_products')) links.push({ label: 'Produits', href: '#products' });
    if (hasType('reviews') || hasType('testimonials')) links.push({ label: 'Avis', href: '#reviews' });
    if (hasType('faq')) links.push({ label: 'FAQ', href: '#faq' });
    if (hasType('footer')) links.push({ label: 'Contact', href: '#footer' });
    return links;
  }, [sections]);

  const logoEl = store.logo
    ? <img src={store.logo} alt={store.name} className={`object-contain ${isPremium ? 'h-12' : 'h-8'}`} />
    : (
      <div className={`${isPremium ? 'w-10 h-10' : 'w-8 h-8'} flex items-center justify-center`}
        style={{ backgroundColor: t.cta + '18', borderRadius: t.radius }}>
        <svg className={isPremium ? 'w-5 h-5' : 'w-4 h-4'} style={{ color: t.cta }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
    );

  return (
    <header
      className={`sticky top-0 z-50 transition-shadow ${
        isPremium
          ? 'bg-white shadow-lg border-b-2'
          : isMinimal
          ? 'bg-white border-b border-gray-100'
          : 'bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm'
      }`}
      style={isPremium ? { borderBottomColor: t.cta } : {}}
    >
      <div className={`${isMinimal ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-4 sm:px-6`}>
        <div className={`flex items-center justify-between gap-3 ${isPremium ? 'h-20' : isMinimal ? 'h-12' : 'h-16'}`}>

          {/* Logo */}
          <a href="#home" className="flex items-center gap-2.5 min-w-0 shrink-0">
            {logoEl}
            <span
              className={`font-bold truncate ${isPremium ? 'text-xl tracking-tight' : isMinimal ? 'text-sm tracking-widest uppercase' : 'text-lg'}`}
              style={{ color: t.text, fontFamily: t.font }}>
              {store.name}
            </span>
          </a>

          {/* Desktop nav */}
          {!isMinimal && (
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href}
                  className={`text-sm font-medium transition hover:opacity-100 ${
                    isPremium ? 'font-semibold opacity-70 hover:opacity-100' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  style={isPremium ? { color: t.text, fontFamily: t.font } : {}}>
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {store.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className={`hidden sm:inline-flex items-center gap-1.5 font-bold text-white text-xs transition hover:opacity-90 ${
                  isPremium ? 'px-6 py-3 text-sm shadow-lg' : isMinimal ? 'px-3 py-1.5 text-xs border' : 'px-5 py-2'
                }`}
                style={isMinimal
                  ? { color: t.cta, borderColor: t.cta + '50', borderRadius: t.radius, background: 'transparent' }
                  : { backgroundColor: t.cta, borderRadius: t.radius, fontFamily: t.font }}
              >
                {isPremium && <span className="text-white/80">&#10022;</span>}
                {isMinimal ? 'Boutique' : 'Commander'}
              </a>
            )}
            <button type="button"
              className={`md:hidden p-2 ${ isMinimal ? '' : 'rounded-lg border border-gray-200'}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden pb-4 pt-1 flex flex-col gap-0.5 border-t border-gray-100">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">
                {link.label}
              </a>
            ))}
            {store.whatsapp && (
              <a href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-2 px-4 py-3 text-center text-sm font-bold text-white"
                style={{ backgroundColor: t.cta, borderRadius: t.radius }}>
                Commander sur WhatsApp
              </a>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

// ── Hero ─────────────────────────────────────────────────────────────────────
const HeroSection = ({ config, t, store }) => {
  const { title, subtitle, ctaText, bgImage } = config || {};
  const hasBg = !!(bgImage || store.banner);
  const bg = bgImage || store.banner;
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';

  /* ── MINIMAL: pure typographic hero, no colour fills ── */
  if (isMinimal) {
    return (
      <section id="home" className="py-20 md:py-32 px-6" style={{ backgroundColor: t.bg }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-black uppercase tracking-[0.25em] mb-5 opacity-50" style={{ color: t.cta, fontFamily: t.font }}>
            {store.name}
          </p>
          <h1 className="text-5xl md:text-6xl font-black leading-[1.05] mb-6 tracking-tight"
            style={{ color: t.text, fontFamily: t.font }}>
            {title || store.name || 'Bienvenue'}
          </h1>
          {(subtitle || store.description) && (
            <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-xl leading-relaxed">
              {subtitle || store.description}
            </p>
          )}
          {ctaText && (
            <a href="#products"
              className="inline-flex items-center gap-2 text-sm font-bold transition-all group"
              style={{ color: t.cta, fontFamily: t.font }}>
              {ctaText}
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          )}
        </div>
      </section>
    );
  }

  /* ── PREMIUM: left-aligned, large editorial, full-bleed gradient/image ── */
  if (isPremium) {
    return (
      <section id="home" className="relative overflow-hidden"
        style={hasBg
          ? { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: `linear-gradient(135deg, ${t.bg} 0%, ${t.cta}14 50%, ${t.bg} 100%)` }
        }>
        {hasBg && <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />}
        <div className="relative max-w-7xl mx-auto px-6 py-32 md:py-44">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white mb-8"
              style={{ backgroundColor: t.cta, borderRadius: t.radius }}>
              &#10022; {store.name}
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-none mb-7 tracking-tight"
              style={{ color: hasBg ? '#fff' : t.text, fontFamily: t.font }}>
              {title || store.name}
            </h1>
            {(subtitle || store.description) && (
              <p className="text-lg md:text-xl mb-10 leading-relaxed"
                style={{ color: hasBg ? 'rgba(255,255,255,0.85)' : t.text + 'cc', fontFamily: t.font }}>
                {subtitle || store.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {ctaText && (
                <a href="#products"
                  className="inline-flex items-center gap-2 px-8 py-4 font-bold text-white text-sm shadow-2xl hover:opacity-90 transition-all hover:scale-105"
                  style={{ backgroundColor: t.cta, borderRadius: t.radius, fontFamily: t.font }}>
                  {ctaText}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              )}
              {store.whatsapp && (
                <a href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 font-bold text-sm border-2 transition hover:bg-white/10"
                  style={{
                    color: hasBg ? '#fff' : t.text,
                    borderColor: hasBg ? 'rgba(255,255,255,0.4)' : t.text + '30',
                    borderRadius: t.radius,
                    fontFamily: t.font,
                  }}>
                  WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* ── CLASSIC: centered hero with colour/image background ── */
  return (
    <section id="home" className="relative overflow-hidden"
      style={{
        backgroundColor: hasBg ? '#000' : t.cta + '0d',
        backgroundImage: hasBg ? `url(${bg})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
      {hasBg && <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />}
      <div className="relative max-w-5xl mx-auto px-4 py-24 md:py-36 text-center">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-tight mb-6"
          style={{ color: hasBg ? '#fff' : t.text, fontFamily: t.font }}>
          {title || store.name || 'Bienvenue'}
        </h1>
        {(subtitle || store.description) && (
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: hasBg ? 'rgba(255,255,255,0.88)' : t.text + 'cc', fontFamily: t.font }}>
            {subtitle || store.description}
          </p>
        )}
        {ctaText && (
          <a href="#products"
            className="inline-flex items-center gap-2 px-10 py-4 font-bold text-white text-base shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            style={{ backgroundColor: t.cta, borderRadius: t.radius, fontFamily: t.font }}>
            {ctaText}
          </a>
        )}
      </div>
    </section>
  );
};

// ── Featured Products ─────────────────────────────────────────────────────────
const ProductCard = ({ product, currency, t, href }) => {
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  const lowStock = product.stock !== undefined && product.stock > 0 && product.stock < 10;
  const Placeholder = () => (
    <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );

  if (isMinimal) return (
    <a href={href} className="block group">
      <div className="aspect-square bg-gray-50 overflow-hidden mb-3" style={{ borderRadius: t.radius }}>
        {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Placeholder /></div>}
      </div>
      <p className="text-sm font-semibold line-clamp-1 mb-0.5" style={{ color: t.text, fontFamily: t.font }}>{product.name}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold" style={{ color: t.cta, fontFamily: t.font }}>{fmt(product.price, currency)}</span>
        {hasDiscount && <span className="text-xs text-gray-400 line-through">{fmt(product.compareAtPrice, currency)}</span>}
      </div>
    </a>
  );

  if (isPremium) return (
    <a href={href} className="block group relative overflow-hidden" style={{ borderRadius: t.radius, boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
      <div className="aspect-[3/4] bg-gray-50 overflow-hidden relative">
        {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: t.cta + '08' }}><Placeholder /></div>}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="w-full py-2.5 text-center text-xs font-bold text-white" style={{ backgroundColor: t.cta, borderRadius: t.radius }}>Voir le produit</div>
        </div>
        {hasDiscount && <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: t.cta, borderRadius: t.radius }}>-{discountPct}%</span>}
      </div>
      <div className="p-3 bg-white">
        <h3 className="font-bold text-xs mb-1.5 line-clamp-1" style={{ color: t.text, fontFamily: t.font }}>{product.name}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black" style={{ color: t.cta, fontFamily: t.font }}>{fmt(product.price, currency)}</span>
          {hasDiscount && <span className="text-xs text-gray-400 line-through">{fmt(product.compareAtPrice, currency)}</span>}
        </div>
        {lowStock && <p className="text-[10px] text-orange-500 mt-1 font-semibold">⚡ Plus que {product.stock} en stock</p>}
      </div>
    </a>
  );

  return (
    <a href={href} className="block bg-white border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300" style={{ borderRadius: t.radius }}>
      <div className="aspect-square bg-gray-50 overflow-hidden relative">
        {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Placeholder /></div>}
        {hasDiscount && <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold text-white rounded-full" style={{ backgroundColor: '#EF4444' }}>-{discountPct}%</span>}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-sm mb-2 line-clamp-2" style={{ color: t.text, fontFamily: t.font }}>{product.name}</h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-base font-black" style={{ color: t.cta, fontFamily: t.font }}>{fmt(product.price, currency)}</span>
          {hasDiscount && <span className="text-xs text-gray-400 line-through">{fmt(product.compareAtPrice, currency)}</span>}
        </div>
        {lowStock && <p className="text-[11px] text-orange-500 mb-2 font-medium">Plus que {product.stock} en stock</p>}
        <div className="w-full py-2 text-center text-xs font-bold text-white transition group-hover:opacity-90" style={{ backgroundColor: t.cta, borderRadius: t.radius, fontFamily: t.font }}>Voir le produit</div>
      </div>
    </a>
  );
};

const FeaturedProducts = ({ config, products, currency, t, getProductHref }) => {
  const { count = 8, title = 'Nos Produits' } = config || {};
  const [activeCategory, setActiveCategory] = useState('all');
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';
  const cats = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const filtered = activeCategory === 'all' ? products.slice(0, count) : products.filter(p => p.category === activeCategory).slice(0, count);

  if (products.length === 0) return null;

  const CategoryPills = () => cats.length < 2 ? null : (
    <div className="flex flex-wrap gap-2">
      {['Tous', ...cats].map((c, i) => {
        const active = i === 0 ? activeCategory === 'all' : activeCategory === c;
        return (
          <button key={c} onClick={() => setActiveCategory(i === 0 ? 'all' : c)}
            className="px-4 py-1.5 text-xs font-bold transition border"
            style={{ backgroundColor: active ? t.cta : 'transparent', color: active ? '#fff' : t.text + '80', borderColor: active ? t.cta : t.text + '20', borderRadius: t.radius, fontFamily: t.font }}>
            {c}
          </button>
        );
      })}
    </div>
  );

  return (
    <section id="products" className={`px-4 sm:px-6 ${isPremium ? 'py-20 md:py-28' : isMinimal ? 'py-16' : 'py-16 md:py-24'}`}
      style={{ backgroundColor: t.bg }}>
      <div className={`${isMinimal ? 'max-w-5xl' : 'max-w-7xl'} mx-auto`}>
        {isPremium ? (
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 pb-6 border-b" style={{ borderColor: t.text + '12' }}>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 opacity-50" style={{ color: t.cta, fontFamily: t.font }}>Collection</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
            </div>
            <CategoryPills />
          </div>
        ) : isMinimal ? (
          <div className="mb-10">
            <h2 className="text-2xl font-black mb-2" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
            <div className="w-8 h-0.5 mb-5" style={{ backgroundColor: t.cta }} />
            <CategoryPills />
          </div>
        ) : (
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black mb-6" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
            <div className="flex flex-wrap justify-center gap-2"><CategoryPills /></div>
          </div>
        )}
        <div className={`grid grid-cols-2 gap-4 ${isPremium ? 'md:grid-cols-3 lg:grid-cols-4 md:gap-5' : isMinimal ? 'md:grid-cols-3 lg:grid-cols-4 md:gap-8' : 'md:grid-cols-3 lg:grid-cols-4 md:gap-6'}`}>
          {filtered.map((p) => (
            <ProductCard key={p._id} product={p} currency={currency} t={t} href={getProductHref(p.slug)} />
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Promo Banner ─────────────────────────────────────────────────────────────
const PromoBanner = ({ config, t }) => {
  const { text, bgColor } = config || {};
  if (!text) return null;
  return (
    <div className="py-8 px-4 text-center" style={{ backgroundColor: bgColor || t.cta }}>
      <p className="text-white font-bold text-lg md:text-2xl" style={{ fontFamily: t.font }}>{text}</p>
    </div>
  );
};

// ── Trust Badges / Benefits ──────────────────────────────────────────────────
const TrustBadges = ({ t }) => {
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';
  const badges = [
    { icon: 'M5 13l4 4L19 7', label: 'Qualité garantie' },
    { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Livraison rapide' },
    { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'Paiement sécurisé' },
    { icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z', label: 'Support client' },
  ];

  if (isMinimal) return (
    <section className="py-10 px-6 border-t border-gray-100" style={{ backgroundColor: t.bg }}>
      <div className="max-w-5xl mx-auto flex flex-wrap gap-8 items-center">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" style={{ color: t.cta }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
            </svg>
            <span className="text-xs font-semibold" style={{ color: t.text + 'aa', fontFamily: t.font }}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );

  if (isPremium) return (
    <section className="py-12 px-6" style={{ backgroundColor: t.text + '06' }}>
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white" style={{ borderRadius: t.radius }}>
            <div className="w-10 h-10 shrink-0 flex items-center justify-center" style={{ backgroundColor: t.cta + '14', borderRadius: t.radius }}>
              <svg className="w-5 h-5" style={{ color: t.cta }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
              </svg>
            </div>
            <p className="text-xs font-bold" style={{ color: t.text, fontFamily: t.font }}>{b.label}</p>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <section className="py-12 px-4 border-t border-gray-100">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {badges.map((b, i) => (
          <div key={i} className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: t.cta + '12', borderRadius: t.radius }}>
              <svg className="w-6 h-6" style={{ color: t.cta }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={b.icon} />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: t.text, fontFamily: t.font }}>{b.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Testimonials ─────────────────────────────────────────────────────────────
const Stars = ({ rating, cta }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, j) => (
      <svg key={j} className="w-3.5 h-3.5" fill={j < (rating || 5) ? cta : '#E5E7EB'} viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const Testimonials = ({ config, t }) => {
  const isPremium = t.tpl === 'premium';
  const isMinimal = t.tpl === 'minimal';
  const { title = 'Ce que disent nos clients', items = [] } = config || {};
  const defaults = [
    { name: 'Client satisfait', text: 'Livraison rapide et produit de qualité. Je recommande !', rating: 5 },
    { name: 'Acheteur fidèle', text: 'Le service client est excellent, toujours disponible sur WhatsApp.', rating: 5 },
    { name: 'Nouveau client', text: 'Première commande et je suis agréablement surpris !', rating: 4 },
  ];
  const reviews = items.length > 0 ? items : defaults;

  if (isMinimal) return (
    <section id="reviews" className="py-16 px-6" style={{ backgroundColor: t.bg }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-black mb-10" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((r, i) => (
            <div key={i} className="border-t-2 pt-5" style={{ borderColor: t.cta }}>
              <Stars rating={r.rating} cta={t.cta} />
              <p className="text-sm text-gray-600 mt-3 mb-4 leading-relaxed">&ldquo;{r.text}&rdquo;</p>
              <p className="text-xs font-bold" style={{ color: t.text, fontFamily: t.font }}>{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  if (isPremium) return (
    <section id="reviews" className="py-20 px-6" style={{ backgroundColor: t.cta + '06' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12 pb-6 border-b" style={{ borderColor: t.text + '12' }}>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] mb-2 opacity-50" style={{ color: t.cta, fontFamily: t.font }}>Témoignages</p>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white p-7" style={{ borderRadius: t.radius }}>
              <Stars rating={r.rating} cta={t.cta} />
              <p className="text-sm leading-relaxed mt-4 mb-5" style={{ color: t.text + 'cc', fontFamily: t.font }}>&ldquo;{r.text}&rdquo;</p>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: t.text, fontFamily: t.font }}>{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <section id="reviews" className="py-16 px-4" style={{ backgroundColor: t.cta + '06' }}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-10" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white p-6 shadow-sm border border-gray-100" style={{ borderRadius: t.radius }}>
              <Stars rating={r.rating} cta={t.cta} />
              <p className="text-sm text-gray-700 mt-3 mb-3 italic">&ldquo;{r.text}&rdquo;</p>
              <p className="text-xs font-bold text-gray-900" style={{ fontFamily: t.font }}>{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── Newsletter ───────────────────────────────────────────────────────────────
const Newsletter = ({ config, t }) => {
  const { title = 'Restez informé', subtitle = 'Recevez nos offres exclusives' } = config || {};
  return (
    <section id="newsletter" className="py-16 px-4">
      <div className="max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-black mb-2" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>
        <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
        <div className="flex gap-2">
          <input type="email" placeholder="votre@email.com"
            className="flex-1 px-4 py-3 text-sm border border-gray-200 bg-white focus:outline-none"
            style={{ borderRadius: t.radius }} />
          <button className="px-6 py-3 text-sm font-bold text-white" style={{ backgroundColor: t.cta, borderRadius: t.radius }}>
            S'inscrire
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Custom Section ───────────────────────────────────────────────────────────
const CustomSection = ({ config, t }) => {
  const { title, content } = config || {};
  if (!title && !content) return null;
  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {title && <h2 className="text-2xl font-black mb-4" style={{ color: t.text, fontFamily: t.font }}>{title}</h2>}
        {content && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }} />}
      </div>
    </section>
  );
};

// ── Footer ───────────────────────────────────────────────────────────────────
const StoreFooter = ({ store, t }) => {
  const year = new Date().getFullYear();
  return (
    <footer id="footer" className="py-12 px-4 border-t border-gray-200" style={{ backgroundColor: '#f9fafb' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-3" style={{ color: t.text, fontFamily: t.font }}>{store.name}</h3>
            {store.description && <p className="text-sm text-gray-600 mb-3">{store.description}</p>}
            {store.address && <p className="text-sm text-gray-500">{store.address}</p>}
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3 text-gray-900">Contact</h4>
            {store.whatsapp && <a href={`https://wa.me/${store.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="block text-sm mb-1 hover:underline" style={{ color: t.cta }}>WhatsApp: {store.whatsapp}</a>}
            {store.email && <a href={`mailto:${store.email}`} className="block text-sm mb-1 hover:underline" style={{ color: t.cta }}>{store.email}</a>}
            {store.phone && <p className="text-sm text-gray-500">{store.phone}</p>}
          </div>
          <div>
            <h4 className="font-bold text-sm mb-3 text-gray-900">Suivez-nous</h4>
            <div className="flex gap-3">
              {store.facebook && <a href={store.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition"><svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>}
              {store.instagram && <a href={store.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition"><svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>}
              {store.tiktok && <a href={store.tiktok} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition"><svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.15V11.7a4.79 4.79 0 01-3.77-1.78V6.69h3.77z"/></svg></a>}
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
          <p>&copy; {year} {store.name}. Tous droits r&eacute;serv&eacute;s.</p>
          <p className="mt-1">Propuls&eacute; par <a href="https://scalor.net" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: t.cta }}>Scalor</a></p>
        </div>
      </div>
    </footer>
  );
};

// ── WhatsApp Floating Button ─────────────────────────────────────────────────
const WhatsAppFloat = ({ whatsapp }) => {
  if (!whatsapp) return null;
  return (
    <a href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const PublicStorefront = () => {
  const { subdomain: paramSubdomain } = useParams();
  const hostSubdomain = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const { store, products, categories, sections: apiSections, pixels, loading, error } = useStorefront(subdomain);

  const getProductHref = (slug) => {
    if (!slug) return '#products';
    if (hostSubdomain) return `/product/${slug}`;
    if (subdomain) return `/store/${subdomain}/product/${slug}`;
    return `/product/${slug}`;
  };

  // Inject tracking pixels
  usePixelInjection(pixels);

  // Apply theme to document
  useEffect(() => {
    if (!store) return;
    document.title = store.seoTitle || store.name || 'Boutique';
    if (store.seoDescription) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
      meta.content = store.seoDescription;
    }
    document.body.style.fontFamily = font(store.font);
    // Load Google Font
    const fontId = store.font || 'inter';
    if (fontId !== 'inter' && fontId !== 'satoshi') {
      const name = fontId === 'dm-sans' ? 'DM+Sans' : fontId === 'space-grotesk' ? 'Space+Grotesk' : fontId === 'playfair' ? 'Playfair+Display' : fontId.charAt(0).toUpperCase() + fontId.slice(1);
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${name}:wght@400;500;600;700;800;900&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, [store]);

  // Live theme override from builder (Socket.io)
  // Must stay before any early return to keep hook order stable across renders.
  const [liveTheme, setLiveTheme] = useState(null);
  const [liveSections, setLiveSections] = useState(null);
  useThemeSocket(subdomain, (incoming) => {
    if (incoming._pages) setLiveSections(incoming._pages);
    setLiveTheme(prev => ({ ...prev, ...incoming }));
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-[#0F6B4F] rounded-full animate-spin mx-auto mb-4" style={{ borderWidth: 3 }} />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !store) {
    const slug = subdomain || paramSubdomain || 'votre-boutique';
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-100 flex items-center px-6">
          <span className="font-black text-lg text-[#0F6B4F] tracking-tight">scalor</span>
        </header>

        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
          {/* Animated store icon */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-[#0F6B4F]/10 rounded-3xl animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-[#0F6B4F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>

          {/* Subdomain badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-mono text-gray-500 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            {slug}.scalor.store
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
            Cette boutique n'existe<br className="hidden sm:block" /> pas encore
          </h1>
          <p className="text-gray-500 text-base max-w-sm mx-auto mb-10 leading-relaxed">
            Vous êtes propriétaire de ce lien ? Créez votre boutique en ligne en quelques minutes sur <span className="font-semibold text-[#0F6B4F]">Scalor</span> et commencez à vendre dès aujourd'hui.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://scalor.net"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#0F6B4F] text-white font-bold text-sm rounded-2xl hover:bg-[#0A5740] transition-all hover:scale-105 shadow-lg shadow-[#0F6B4F]/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Créer ma boutique gratuitement
            </a>
            <a
              href="https://scalor.net"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm rounded-2xl hover:border-gray-300 transition-all"
            >
              En savoir plus
            </a>
          </div>

          {/* Features strip */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto text-left">
            {[
              { icon: '🛍️', title: 'Boutique en ligne', desc: 'Votre propre site e-commerce avec vos produits' },
              { icon: '💬', title: 'Commandes WhatsApp', desc: 'Recevez les commandes directement sur WhatsApp' },
              { icon: '📊', title: 'Tableau de bord', desc: 'Gérez produits, commandes et clients facilement' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="font-bold text-sm text-gray-900">{f.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-xs text-gray-400 border-t border-gray-100">
          Propulsé par{' '}
          <a href="https://scalor.net" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#0F6B4F] hover:underline">
            Scalor
          </a>
          {' '}— Créez votre boutique en ligne
        </div>
      </div>
    );
  }

  // Build theme object — live overrides from builder win
  const merged = liveTheme ? { ...store, ...liveTheme } : store;
  const t = {
    cta:    merged.ctaColor || merged.primaryColor || merged.themeColor || '#0F6B4F',
    text:   merged.textColor || '#111827',
    bg:     merged.backgroundColor || '#FFFFFF',
    font:   font(merged.font || store.font),
    radius: radius(merged.borderRadius || store.borderRadius),
    tpl:    merged.template || 'classic',
  };

  // Sections: live socket override > API > defaults
  const sections = liveSections || (apiSections && apiSections.length > 0) ? (liveSections || apiSections) : [
    { type: 'hero', enabled: true, config: { title: '', subtitle: '', ctaText: 'Voir nos produits' } },
    { type: 'featured_products', enabled: true, config: { count: 8, title: 'Nos Produits' } },
    { type: 'promo_banner', enabled: true, config: { text: '', bgColor: '#EF4444' } },
    { type: 'trust_badges', enabled: true, config: {} },
    { type: 'reviews', enabled: true, config: {} },
    { type: 'faq', enabled: true, config: {} },
    { type: 'cta', enabled: false, config: { title: '', buttonText: 'Commander', buttonUrl: '' } },
    { type: 'footer', enabled: true, config: {} },
  ];

  // Section renderer
  const renderSection = (section, idx) => {
    if (!section.enabled) return null;
    const key = `${section.type}-${idx}`;
    switch (section.type) {
      case 'hero': return <HeroSection key={key} config={section.config} t={t} store={store} />;
      case 'featured_products': return <FeaturedProducts key={key} config={section.config} products={products} currency={store.currency} t={t} getProductHref={getProductHref} />;
      case 'promo_banner': return <PromoBanner key={key} config={section.config} t={t} />;
      case 'trust_badges': return <TrustBadges key={key} t={t} />;
      case 'testimonials':
      case 'reviews': return <Testimonials key={key} config={section.config} t={t} />;
      case 'faq': return <FaqSection key={key} config={section.config} t={t} />;
      case 'cta': return <CtaSection key={key} config={section.config} t={t} />;
      case 'newsletter': return <Newsletter key={key} config={section.config} t={t} />;
      case 'custom': return <CustomSection key={key} config={section.config} t={t} />;
      case 'footer': return <StoreFooter key={key} store={store} t={t} />;
      default: return null;
    }
  };

  // Section toggles: live theme wins over store DB values
  const sectionToggles = liveTheme?.sections || merged.sectionToggles || {};

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg, fontFamily: t.font }}>
      <AnnouncementBar store={store} t={t} />
      <StoreHeader store={store} t={t} categories={categories || []} sections={sections} />
      {sections.map(renderSection)}
      {/* Always render footer if not in sections */}
      {!sections.some(s => s.type === 'footer' && s.enabled) && <StoreFooter store={store} t={t} />}
      {/* WhatsApp floating button */}
      {sectionToggles?.showWhatsappButton !== false && <WhatsAppFloat whatsapp={store.whatsapp} />}
    </div>
  );
};

export default PublicStorefront;
