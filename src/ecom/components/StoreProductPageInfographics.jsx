import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Truck } from 'lucide-react';
import EmbeddedOrderForm from './EmbeddedOrderForm';
import { formatMoney } from '../utils/currency.js';

const DEFAULT_FORM_TEXTS = {
  headline: 'Remplissez le formulaire, on vous appelle pour valider votre commande',
  reassurance: 'Livraison gratuite. Paiement à la livraison.',
  ctaLabel: 'CLIQUE POUR CONFIRMER TA COMMANDE',
  stickyLabel: 'COMMANDEZ',
  placeholders: {
    fullname: 'Saisir votre nom complet',
    phone: 'Saisir un numero joignable',
    address: 'Saisir votre adresse',
    city: 'Saisir votre ville',
  },
};

const hexToRgb = (hex = '') => {
  const cleaned = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
};

const getReadableTextColor = (hex = '') => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? '#111827' : '#FFFFFF';
};

const StoreProductPageInfographics = ({ product, store, productPageConfig, subdomain }) => {
  const formRef = useRef(null);
  const [showSticky, setShowSticky] = useState(true);

  const cfg = productPageConfig?.infographicsForm || {};
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
  const brandColor = cfg.brandColor || cfg.accentColor || design.ctaButtonColor || design.buttonColor || '#1E3A8A';
  const accent = brandColor;
  const ctaColor = brandColor;
  const stickyColor = brandColor;
  const headerTextColor = cfg.headerTextColor || getReadableTextColor(brandColor);

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
      <style>{`
        @keyframes infographicStickyPulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.04); }
        }
      `}</style>

      {/* Badges réassurance top */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        background: accent,
        color: headerTextColor,
        padding: '14px 16px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          columnGap: 10,
          rowGap: 6,
          fontSize: 14,
          fontWeight: 800,
          lineHeight: 1.4,
        }}>
          <Truck size={18} />
          <span>Livraison gratuite</span>
          <span style={{ opacity: 0.45 }}>•</span>
          <CreditCard size={18} />
          <span>Paiement à la livraison</span>
        </div>
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

      {/* Formulaire premium */}
      <div ref={formRef} style={{ background: '#fff', padding: 0, overflow: 'hidden' }}>
        {/* Header coloré */}
        <div style={{
          background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}CC 100%)`,
          color: headerTextColor,
          padding: '28px 20px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: headerTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.10)',
            borderRadius: 20,
            padding: '5px 14px',
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 14 }}>🛒</span>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Commande en ligne
            </span>
          </div>
          <h2 style={{
            fontSize: 21,
            fontWeight: 900,
            lineHeight: 1.3,
            margin: '0 auto',
            maxWidth: 320,
          }}>
            {formTexts.headline}
          </h2>
        </div>

        <div style={{ padding: '24px 20px 32px' }}>
          {/* Prix card */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 24,
            background: `${brandColor}0C`,
            borderRadius: 14,
            padding: '18px 20px',
            border: `1.5px solid ${brandColor}22`,
          }}>
            <span style={{ fontSize: 40, fontWeight: 900, color: brandColor, letterSpacing: -1 }}>
              {formatMoney(product?.price ?? 0, currency)}
            </span>
            {hasDiscount && (
              <span style={{ fontSize: 24, fontWeight: 700, color: '#9CA3AF', textDecoration: 'line-through' }}>
                {formatMoney(product.compareAtPrice, currency)}
              </span>
            )}
          </div>

          {/* Formulaire */}
          <InfographicsFormOverride
            product={product}
            subdomain={subdomain}
            store={store}
            productPageConfig={productPageConfig}
            placeholders={formTexts.placeholders}
            ctaLabel={formTexts.ctaLabel}
            ctaColor={ctaColor}
            brandColor={brandColor}
            accent={brandColor}
          />
        </div>
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
            animation: 'infographicStickyPulse 1.8s ease-in-out infinite',
            willChange: 'transform',
          }}
        >
          {formTexts.stickyLabel}
        </button>
      )}
    </div>
  );
};

const InfographicsFormOverride = ({ product, subdomain, store, productPageConfig, placeholders, ctaLabel, ctaColor, brandColor = '#1E3A8A', accent }) => {
  const formClass = `iform-${(brandColor || '#1E3A8A').replace('#', '')}`;
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
        formButtonColor: brandColor,
        buttonTextColor: '#fff',
        ctaBorderRadius: '12px',
      },
      button: {
        ...(productPageConfig?.button || {}),
        text: ctaLabel,
        subtext: '',
      },
    };
  }, [productPageConfig, placeholders, ctaLabel, ctaColor, brandColor]);

  return (
    <div className={formClass}>
      <style>{`
        .${formClass} input,
        .${formClass} select,
        .${formClass} textarea {
          border: 1.5px solid #E5E7EB !important;
          border-radius: 10px !important;
          font-size: 15px !important;
          color: #111827 !important;
          background: #fff !important;
          transition: border-color 0.15s, box-shadow 0.15s !important;
        }
        .${formClass} input:focus,
        .${formClass} select:focus,
        .${formClass} textarea:focus {
          border-color: ${brandColor} !important;
          outline: none !important;
          box-shadow: 0 0 0 3px ${brandColor}33 !important;
        }
        .${formClass} label { display: none !important; }
      `}</style>
      <EmbeddedOrderForm
        product={product}
        subdomain={subdomain}
        store={store}
        productPageConfig={overrideConfig}
      />
    </div>
  );
};

export default StoreProductPageInfographics;
