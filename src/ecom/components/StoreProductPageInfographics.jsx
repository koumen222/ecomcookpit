import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Shield, RotateCcw, Truck } from 'lucide-react';
import EmbeddedOrderForm from './EmbeddedOrderForm';
import { formatMoney } from '../utils/currency.js';

const DEFAULT_BADGES = [
  { icon: 'shield', title: 'Paiement sécurisé', text: 'Le paiement est sécurisé dès réception.' },
  { icon: 'rotate', title: 'Remboursé', text: 'Nous vous donnons jusqu\'à 7 jours pour retourner votre article s\'il ne vous convient pas.' },
  { icon: 'truck', title: 'Livraison rapide', text: 'Livraison rapide à votre porte et sans frais supplémentaire.' },
];

const DEFAULT_FORM_TEXTS = {
  headline: 'Remplissez le formulaire, on vous appelle pour valider votre commande',
  reassurance: 'Livraison gratuite et paiement après réception',
  ctaLabel: 'CLIQUE POUR CONFIRMER TA COMMANDE',
  stickyLabel: 'COMMANDEZ',
  placeholders: {
    fullname: 'Saisir votre nom complet',
    phone: 'Saisir un numero joignable',
    address: 'Saisir votre adresse',
    city: 'Saisir votre ville',
  },
};

const BADGE_ICONS = { shield: Shield, rotate: RotateCcw, truck: Truck };

const StoreProductPageInfographics = ({ product, store, productPageConfig, subdomain }) => {
  const formRef = useRef(null);
  const [showSticky, setShowSticky] = useState(true);

  const cfg = productPageConfig?.infographicsForm || {};
  const badges = cfg.badges || DEFAULT_BADGES;
  const formTexts = { ...DEFAULT_FORM_TEXTS, ...cfg, placeholders: { ...DEFAULT_FORM_TEXTS.placeholders, ...(cfg.placeholders || {}) } };

  const infographics = useMemo(() => {
    const list = Array.isArray(productPageConfig?.infographics) ? productPageConfig.infographics : [];
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter(item => item?.url);
  }, [productPageConfig?.infographics]);

  const fallbackImages = useMemo(() => {
    if (infographics.length > 0) return [];
    const arr = Array.isArray(product?.images) ? product.images : [];
    return arr.map(img => ({ url: img.url || img, type: 'product' }));
  }, [infographics.length, product?.images]);

  const displayImages = infographics.length > 0 ? infographics : fallbackImages;

  const currency = product?.currency || store?.currency || 'XAF';
  const hasDiscount = product?.compareAtPrice && product.compareAtPrice > product.price;

  const design = productPageConfig?.design || {};
  const accent = cfg.accentColor || design.ctaButtonColor || design.buttonColor || '#1E3A8A';
  const ctaColor = cfg.ctaColor || design.ctaButtonColor || '#84CC16';
  const stickyColor = cfg.stickyColor || '#3B82F6';

  useEffect(() => {
    const onScroll = () => {
      if (!formRef.current) return;
      const rect = formRef.current.getBoundingClientRect();
      setShowSticky(rect.top > window.innerHeight * 0.5);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToForm = () => {
    if (!formRef.current) return;
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fff',
      color: accent,
      fontFamily: 'var(--s-font, system-ui, -apple-system, sans-serif)',
      overflowX: 'hidden',
      width: '100%',
      maxWidth: '100vw',
      paddingBottom: 120,
    }}>
      {/* Badges réassurance top */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${badges.length}, 1fr)`,
        gap: 0,
        background: accent,
        color: '#fff',
        padding: '14px 8px',
        textAlign: 'center',
      }}>
        {badges.map((badge, idx) => {
          const Icon = BADGE_ICONS[badge.icon] || Shield;
          return (
            <div key={idx} style={{ padding: '0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, borderLeft: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.2)' }}>
              <Icon size={18} style={{ marginBottom: 2 }} />
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.3 }}>{badge.title}</div>
              <div style={{ fontSize: 10, fontWeight: 500, lineHeight: 1.3, opacity: 0.95 }}>{badge.text}</div>
            </div>
          );
        })}
      </div>

      {/* Stack d'infographies 9:16 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
        {displayImages.length === 0 ? (
          <div style={{ aspectRatio: '9 / 16', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14, fontWeight: 600, padding: 24, textAlign: 'center' }}>
            Aucune infographie générée pour ce produit.
          </div>
        ) : (
          displayImages.map((img, idx) => (
            <div key={`${img.url}-${idx}`} style={{ width: '100%', aspectRatio: '9 / 16', overflow: 'hidden', background: '#F9FAFB' }}>
              <img
                src={img.url}
                alt={img.alt || `Infographie ${idx + 1}`}
                loading={idx < 2 ? 'eager' : 'lazy'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
          ))
        )}
      </div>

      {/* Formulaire minimal */}
      <div ref={formRef} style={{ padding: '32px 20px 24px', background: '#fff' }}>
        <h2 style={{
          fontSize: 26,
          fontWeight: 900,
          color: accent,
          textAlign: 'center',
          lineHeight: 1.25,
          margin: '0 0 28px',
        }}>
          {formTexts.headline}
        </h2>

        {/* Prix */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14, marginBottom: 28 }}>
          <span style={{ fontSize: 34, fontWeight: 900, color: ctaColor }}>{formatMoney(product?.price ?? 0, currency)}</span>
          {hasDiscount && (
            <span style={{ fontSize: 28, fontWeight: 800, color: '#DC2626', textDecoration: 'line-through' }}>
              {formatMoney(product.compareAtPrice, currency)}
            </span>
          )}
        </div>

        {/* Form */}
        <InfographicsFormOverride
          product={product}
          subdomain={subdomain}
          store={store}
          productPageConfig={productPageConfig}
          placeholders={formTexts.placeholders}
          ctaLabel={formTexts.ctaLabel}
          ctaColor={ctaColor}
          reassurance={formTexts.reassurance}
          accent={accent}
        />
      </div>

      {/* Bouton sticky */}
      {showSticky && displayImages.length > 0 && (
        <button
          type="button"
          onClick={scrollToForm}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            background: stickyColor,
            color: '#fff',
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            padding: '14px 40px',
            border: 'none',
            borderRadius: 8,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            cursor: 'pointer',
            zIndex: 50,
          }}
        >
          {formTexts.stickyLabel}
        </button>
      )}
    </div>
  );
};

const InfographicsFormOverride = ({ product, subdomain, store, productPageConfig, placeholders, ctaLabel, ctaColor, reassurance, accent }) => {
  const overrideConfig = useMemo(() => {
    const general = productPageConfig?.general || {};
    const existingFields = Array.isArray(general.formFields) && general.formFields.length > 0
      ? general.formFields
      : [
        { type: 'text', name: 'fullname', label: '', placeholder: placeholders.fullname, required: true },
        { type: 'phone', name: 'phone', label: '', placeholder: placeholders.phone, required: true },
        { type: 'text', name: 'address', label: '', placeholder: placeholders.address, required: true },
        { type: 'text', name: 'city', label: '', placeholder: placeholders.city, required: true },
      ];
    const mappedFields = existingFields.map((field) => {
      const next = { ...field, label: '' };
      if (field.name === 'fullname' || field.type === 'fullname') next.placeholder = placeholders.fullname;
      if (field.name === 'phone' || field.type === 'phone') next.placeholder = placeholders.phone;
      if (field.name === 'address') next.placeholder = placeholders.address;
      if (field.name === 'city') next.placeholder = placeholders.city;
      return next;
    });
    return {
      ...productPageConfig,
      general: { ...general, formFields: mappedFields, formType: 'embedded' },
      design: {
        ...(productPageConfig?.design || {}),
        formButtonColor: ctaColor,
        buttonTextColor: '#fff',
        ctaBorderRadius: '10px',
      },
      button: {
        ...(productPageConfig?.button || {}),
        text: ctaLabel,
        subtext: '',
      },
    };
  }, [productPageConfig, placeholders, ctaLabel, ctaColor]);

  return (
    <div className="infographics-minimal-form">
      <style>{`
        .infographics-minimal-form input,
        .infographics-minimal-form select,
        .infographics-minimal-form textarea {
          border: 1px solid #E5E7EB !important;
          border-radius: 6px !important;
          padding: 16px 14px !important;
          font-size: 15px !important;
          color: #6B7280 !important;
          background: #fff !important;
        }
        .infographics-minimal-form label { display: none !important; }
      `}</style>
      <EmbeddedOrderForm
        product={product}
        subdomain={subdomain}
        store={store}
        productPageConfig={overrideConfig}
      />
      <p style={{
        textAlign: 'center',
        color: accent,
        fontSize: 20,
        fontWeight: 800,
        marginTop: 20,
        lineHeight: 1.35,
      }}>
        {reassurance}
      </p>
    </div>
  );
};

export default StoreProductPageInfographics;
