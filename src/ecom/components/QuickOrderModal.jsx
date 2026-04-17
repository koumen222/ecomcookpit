import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, AlertCircle, Plus, Minus, Truck, ChevronDown, Mail, FileText, Hash, Calendar, Clock, Shield, Globe, Star, ShoppingBag, ArrowRight, Check } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { createMetaEventId, firePixelEvent } from '../utils/pixelTracking';
import defaultConfig from './productSettings/defaultConfig.js';
import { getDefaultPhoneCodeFromConfig, getPhoneCodeByCountryName, buildFullPhone } from '../utils/phoneCodes.js';
import {
  buildStorefrontOrderWhatsappMessage,
  getPopularCitiesForCountries,
  resolveOrderFormContext,
  resolveSelectedOrderCountry,
  resolveStoreCountry,
  findMatchingCountryOption,
} from '../utils/storeCountryConfig.js';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur === 'XAF' || cur === 'XOF' ? 'FCFA' : cur}`;
const ICON_MAP = { user: User, phone: Phone, map: MapPin, pin: MapPin, mail: Mail, cart: ShoppingCart, file: FileText, hash: Hash, calendar: Calendar, bag: ShoppingBag, arrow: ArrowRight, check: Check };
const FIELD_KEY_MAP = { fullname: 'customerName', phone: 'phone', city: 'city', address: 'address', note: 'notes' };

const getSelectedCountryValue = (fields, formState) => {
  const countryField = (fields || []).find((field) => field.type === 'country');
  if (!countryField) return '';
  return (formState[countryField.name] || '').trim();
};

const isMeaningfulPlaceholder = (value, ignoredPatterns = []) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return !ignoredPatterns.some((pattern) => pattern.test(trimmed));
};

/**
 * QuickOrderModal — Modal commande rapide depuis la page produit.
 * Collecte nom, téléphone, ville, adresse, quantité.
 * Après succès → affiche un bouton WhatsApp pré-rempli avec les détails de commande.
 * Accepts productPageConfig to apply design, field visibility, and quantity options.
 */
const QuickOrderModal = ({ isOpen, onClose, product, subdomain, store, productPageConfig }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
  const [phoneCode, setPhoneCode] = useState(() => getDefaultPhoneCodeFromConfig(productPageConfig?.general?.countries, store?.currency));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [deliveryZoneOptions, setDeliveryZoneOptions] = useState([]);
  const [countdownSecs, setCountdownSecs] = useState(null);

  const currency = product?.currency || store?.currency || 'XAF';

  // ── Resolve config with safe fallbacks ──────────────────────────────────────
  const design = productPageConfig?.design || {};
  const formConfig = productPageConfig?.form || {};
  const conversionConfig = productPageConfig?.conversion || {};

  const offerDesign = conversionConfig.offerDesign || null;
  const btnColor = design.formButtonColor || design.ctaButtonColor || design.buttonColor || '#0F6B4F';
  const offerBorderStyle = offerDesign?.border_style || 'solid';
  const urgencyConfig = {
    ...(defaultConfig.urgency || {}),
    ...(design.showCountdown ? { countdown: true } : {}),
    ...(productPageConfig?.urgency || {}),
  };
  const callScheduleConfig = productPageConfig?.callSchedule || defaultConfig.callSchedule || {};
  const btnCfg = productPageConfig?.button || {};
  const bgColor = design.formBgColor || design.backgroundColor || '#ffffff';
  const textColor = design.formTextColor || design.textColor || '#111827';
  const inputTextColor = '#111827'; // Always dark for inputs on white/light backgrounds
  const borderRadius = design.formInputRadius || design.borderRadius || '12px';
  const boxShadow = design.formShadow !== false && design.shadow !== false ? '0 24px 64px rgba(0,0,0,0.18)' : 'none';
  const showQuantitySelector = design.showQuantitySelector !== false;

  const configFields = formConfig.fields || [];
  const effectiveFields = configFields.length ? configFields : defaultConfig.form.fields;
  const generalConfig = productPageConfig?.general || {};
  const orderFormContext = useMemo(() => resolveOrderFormContext({ store, generalConfig }), [store, generalConfig]);
  const formCountries = orderFormContext.countries;
  const storeCountry = resolveStoreCountry(store);
  const selectedCountry = resolveSelectedOrderCountry({
    explicitCountry: getSelectedCountryValue(effectiveFields, form),
    configuredCountries: formCountries,
    storeCountry,
  });
  const cityOptions = useMemo(() => {
    if (deliveryZoneOptions.length > 0) {
      const matchingZones = selectedCountry
        ? deliveryZoneOptions.filter((zone) => findMatchingCountryOption(selectedCountry, [zone.country]))
        : deliveryZoneOptions;
      const source = matchingZones.length > 0 ? matchingZones : deliveryZoneOptions;
      return [...new Set(source.map((zone) => zone.city).filter(Boolean))];
    }

    return getPopularCitiesForCountries(selectedCountry ? [selectedCountry] : formCountries, orderFormContext.popularCities);
  }, [deliveryZoneOptions, selectedCountry, formCountries, orderFormContext.popularCities]);

  // Countdown timer for urgency field
  useEffect(() => {
    if (!urgencyConfig.countdown) return;
    const mins = urgencyConfig.countdownMinutes || 15;
    setCountdownSecs(mins * 60);
    const iv = setInterval(() => setCountdownSecs(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, [urgencyConfig.countdown, urgencyConfig.countdownMinutes]);

  // Fetch delivery zone cities, fallback to popularCities
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await publicStoreApi.getDeliveryZones(subdomain);
        const zones = res?.data?.data?.zones || res?.data?.zones || [];
        if (!cancelled && zones.length) {
          setDeliveryZoneOptions(zones.filter((zone) => zone?.city));
          return;
        }
      } catch (_) { /* ignore */ }
      if (!cancelled) {
        setDeliveryZoneOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [subdomain]);

  useEffect(() => {
    const defaultPhoneCode = getDefaultPhoneCodeFromConfig(formCountries, store?.currency);
    if (defaultPhoneCode && defaultPhoneCode !== phoneCode && !form.phone.trim()) {
      setPhoneCode(defaultPhoneCode);
    }
  }, [formCountries, store?.currency, phoneCode, form.phone]);

  useEffect(() => {
    const countryField = effectiveFields.find((field) => field.enabled !== false && field.type === 'country');
    if (!countryField || !selectedCountry) return;

    setForm((prev) => {
      if (String(prev[countryField.name] || '').trim()) return prev;
      return { ...prev, [countryField.name]: selectedCountry };
    });
  }, [effectiveFields, selectedCountry]);

  useEffect(() => {
    const nextPhoneCode = getPhoneCodeByCountryName(selectedCountry);
    if (nextPhoneCode && nextPhoneCode !== phoneCode) {
      setPhoneCode(nextPhoneCode);
    }
  }, [selectedCountry, phoneCode]);

  const configQuantities = conversionConfig.quantities || [];
  const useQuantityButtons = configQuantities.length > 0;
  const offersEnabled = conversionConfig.offersEnabled && conversionConfig.offers?.length > 0;
  const offers = conversionConfig.offers || [];
  const defaultOfferIdx = offers.findIndex(o => o.selected);
  const [selectedOfferIdx, setSelectedOfferIdx] = useState(Math.max(0, defaultOfferIdx));

  // Compute total: use offer price if offers enabled, else simple product.price * qty
  const getTotal = () => {
    if (offersEnabled && offers[selectedOfferIdx]?.price > 0) {
      return offers[selectedOfferIdx].price;
    }
    return (product?.price || 0) * form.quantity;
  };
  const total = getTotal();

  const set = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Dynamic validation based on enabled required fields
    for (const f of effectiveFields.filter(f => f.enabled !== false && f.required !== false)) {
      const key = FIELD_KEY_MAP[f.name] || f.name;
      if (['text', 'phone', 'email', 'number', 'city_select', 'textarea', 'select'].includes(f.type) && !(form[key] || '').trim()) {
        setError(`${f.label || f.name} est requis`); return;
      }
    }

    setSubmitting(true);
    setError('');
    try {
      // Build offer price override if applicable
      const offerPriceOverride = offersEnabled && offers[selectedOfferIdx]?.price > 0
        ? { offerPrice: offers[selectedOfferIdx].price, offerQty: offers[selectedOfferIdx].qty }
        : {};

      const fullPhone = buildFullPhone(phoneCode, form.phone);
      const purchaseEventId = createMetaEventId('purchase');
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: fullPhone,
        phoneCode,
        email: '',
        address: form.address.trim(),
        city: form.city.trim(),
        country: selectedCountry,
        notes: form.notes.trim(),
        products: [{ productId: product._id, quantity: form.quantity, ...offerPriceOverride }],
        channel: 'store',
        metaEventId: purchaseEventId,
        metaSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
      setOrderResult(res.data?.data);
      setSuccess(true);

      firePixelEvent('Purchase', {
        content_ids: [product._id || product.slug || ''],
        content_name: product.name || '',
        value: total,
        currency: currency,
        num_items: form.quantity,
        eventId: purchaseEventId,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la commande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
    setError(''); setSuccess(false); setOrderResult(null);
    onClose();
  };

  if (!isOpen) return null;

  // ── Écran de succès ──────────────────────────────────────────────────────────
  if (success && orderResult) {
    const firstName = form.customerName.split(' ')[0];
    const storeWhatsapp = (store?.whatsapp || store?.phone || '').replace(/[^0-9+]/g, '');
    const displayPhone = buildFullPhone(phoneCode, form.phone);
    const waMsg = buildStorefrontOrderWhatsappMessage({
      storeName: store?.name || '',
      orderNumber: orderResult.orderNumber,
      totalLabel: fmt(orderResult.total, orderResult.currency),
      customerName: form.customerName,
      displayPhone,
      country: selectedCountry,
      city: form.city,
      address: form.address,
      notes: form.notes,
    });
    const waLink = storeWhatsapp ? `https://wa.me/${storeWhatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(waMsg)}` : null;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: bgColor, borderRadius: design.borderRadius || 24, boxShadow, width: '100%', maxWidth: 420, overflow: 'hidden' }}>
          {/* Top gradient bar */}
          <div style={{ height: 4, background: `linear-gradient(90deg, ${btnColor}, #25D366)` }} />

          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            {/* Success icon */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px', backgroundColor: btnColor + '12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={36} color={btnColor} />
            </div>

            {/* Thank you */}
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
              Merci {firstName} !
            </h2>
            <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
              Votre commande a été enregistrée avec succès.<br/>
              Confirmez-la sur WhatsApp pour un traitement rapide.
            </p>

            {/* Order recap */}
            <div style={{ backgroundColor: '#F9FAFB', borderRadius: 16, padding: '16px 20px', marginBottom: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Référence', orderResult.orderNumber],
                ['Produit', `${product?.name} x${form.quantity}`],
                ['Total', fmt(orderResult.total, orderResult.currency)],
                ['Statut', 'En attente de confirmation'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: label === 'Statut' ? btnColor : '#111827' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '14px 20px', borderRadius: 14, backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', border: 'none', cursor: 'pointer', marginBottom: 12, boxSizing: 'border-box' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Confirmer sur WhatsApp
              </a>
            )}

            {/* Secondary actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setSuccess(false); setOrderResult(null); setForm({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 }); }}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 14, border: '1.5px solid #E5E7EB', backgroundColor: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Commander à nouveau
              </button>
              <button onClick={handleClose}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 14, border: '1.5px solid #E5E7EB', backgroundColor: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Continuer les achats
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: bgColor, borderRadius: design.borderRadius || 20, boxShadow, width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: bgColor, borderBottom: '1px solid #F3F4F6', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: `${design.borderRadius || '20px'} ${design.borderRadius || '20px'} 0 0` }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color={btnColor} /> {productPageConfig?.button?.text || 'Commander maintenant'}
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>

        {/* Récap produit */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', gap: 12 }}>
          {product?.images?.[0]?.url && (
            <img src={product.images[0].url} alt={product?.name} style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid #E5E7EB' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product?.name}</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>Qté: {form.quantity}</p>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: btnColor, flexShrink: 0 }}>{fmt(total, currency)}</span>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Dynamic fields from config */}
          {effectiveFields.filter(f => f.enabled !== false).map((field) => {
            const formKey = FIELD_KEY_MAP[field.name] || field.name;
            const IconComp = ICON_MAP[field.icon];
            const countryPlaceholders = orderFormContext.placeholders;
            const basePlaceholder = field.type === 'phone'
              ? (isMeaningfulPlaceholder(field.placeholder, [/num[eé]ro/i, /t[eé]l[eé]phone/i]) ? field.placeholder : countryPlaceholders.phone)
              : field.type === 'city_select'
                ? (isMeaningfulPlaceholder(field.placeholder, [/^ville$/i, /^ex\s*:\s*douala$/i]) ? field.placeholder : countryPlaceholders.city)
                : field.type === 'address'
                  ? (isMeaningfulPlaceholder(field.placeholder, [/adresse/i, /quartier/i, /rue/i]) ? field.placeholder : countryPlaceholders.address)
                  : (field.placeholder || field.label || '');
            const ph = basePlaceholder + (field.required !== false && !['product_info', 'shipping', 'cta_button'].includes(field.type) ? ' *' : '');
            const iconStyle = { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' };
            const inputPadLeft = IconComp ? '36px' : '14px';
            const inputStyle = { width: '100%', padding: `12px 14px 12px ${inputPadLeft}`, borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: inputTextColor, backgroundColor: '#fff', transition: 'border-color 0.15s' };

            switch (field.type) {
              case 'product_info':
                return (
                  <div key={field.name}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      {offersEnabled ? 'Choisissez votre offre' : 'Quantité'}
                    </label>
                    {offersEnabled ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {offers.map((offer, i) => {
                          const displayPrice = offer.price > 0 ? offer.price : (product?.price || 0) * (offer.qty || 1);
                          const displayCompare = offer.comparePrice > 0 ? offer.comparePrice : 0;
                          const disc = displayCompare > displayPrice && displayPrice > 0 ? Math.round((1 - displayPrice / displayCompare) * 100) : 0;
                          const sel = selectedOfferIdx === i;
                          return (
                            <div key={i} onClick={() => { setSelectedOfferIdx(i); set('quantity', offer.qty); }}
                              style={{ padding: '12px 14px', borderRadius: 12, cursor: 'pointer', borderWidth: sel ? 2 : 1.5, borderStyle: offerBorderStyle === 'flat' ? 'solid' : offerBorderStyle, borderColor: sel ? btnColor : '#E5E7EB', backgroundColor: sel ? `${btnColor}08` : '#fff', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s ease' }}>
                              <div style={{ width: 18, height: 18, borderRadius: '50%', border: sel ? `5px solid ${btnColor}` : '2px solid #D1D5DB', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}
                                  {offer.badge && <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', backgroundColor: btnColor, padding: '2px 8px', borderRadius: 20 }}>{offer.badge}</span>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                                  <span style={{ fontSize: 15, fontWeight: 800, color: btnColor }}>{fmt(displayPrice, currency)}</span>
                                  {disc > 0 && (<>
                                    <span style={{ fontSize: 12, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(displayCompare, currency)}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', backgroundColor: '#FEE2E2', padding: '1px 6px', borderRadius: 10 }}>-{disc}%</span>
                                  </>)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : !showQuantitySelector ? (
                      <div style={{ padding: '12px 14px', borderRadius, border: '1.5px solid #E5E7EB', backgroundColor: '#fff', color: '#374151', fontSize: 14, fontWeight: 600 }}>
                        1 unité
                      </div>
                    ) : useQuantityButtons ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {configQuantities.map(qty => (
                          <button key={qty} type="button" onClick={() => set('quantity', qty)} style={{ padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${form.quantity === qty ? btnColor : '#E5E7EB'}`, backgroundColor: form.quantity === qty ? btnColor : '#fff', color: form.quantity === qty ? '#fff' : '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>{qty}</button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))} style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}><Minus size={15} /></button>
                        <span style={{ fontSize: 16, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{form.quantity}</span>
                        <button type="button" onClick={() => set('quantity', Math.min(product?.stock || 99, form.quantity + 1))} style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}><Plus size={15} /></button>
                      </div>
                    )}
                  </div>
                );

              case 'text':
              case 'phone':
              case 'email':
              case 'number':
              case 'date': {
                const inputType = { phone: 'tel', email: 'email', number: 'number', date: 'date' }[field.type] || 'text';
                return (
                  <div key={field.name} style={{ position: 'relative' }}>
                    {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                    <input type={inputType} value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                      placeholder={ph} required={field.required !== false}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = btnColor}
                      onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                  </div>
                );
              }

              case 'city_select':
                return (
                  <div key={field.name} style={{ position: 'relative' }}>
                    {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                    {field.cityAuto !== false && cityOptions.length > 0 ? (<>
                      <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                        style={{ ...inputStyle, paddingRight: 34, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : '#9CA3AF' }}
                        onFocus={e => e.currentTarget.style.borderColor = btnColor}
                        onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                        <option value="" disabled>{ph}</option>
                        {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                    </>) : (
                      <input type="text" value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                        placeholder={ph} required={field.required !== false}
                        style={inputStyle}
                        onFocus={e => e.currentTarget.style.borderColor = btnColor}
                        onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                    )}
                  </div>
                );

              case 'textarea':
                return (
                  <textarea key={field.name} value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                    placeholder={ph} rows={2}
                    style={{ width: '100%', padding: '12px 14px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: inputTextColor, backgroundColor: '#fff', resize: 'none', transition: 'border-color 0.15s' }}
                    onFocus={e => e.currentTarget.style.borderColor = btnColor}
                    onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                );

              case 'select': {
                const options = field.options || [];
                return (
                  <div key={field.name} style={{ position: 'relative' }}>
                    {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                    <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                      style={{ ...inputStyle, paddingRight: 34, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : '#9CA3AF' }}
                      onFocus={e => e.currentTarget.style.borderColor = btnColor}
                      onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                      <option value="" disabled>{ph}</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                  </div>
                );
              }

              case 'shipping':
                return (
                  <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#F0FDF4', borderRadius: 10, fontSize: 13, color: '#166534' }}>
                    <Truck size={14} /> <strong>{field.label || 'Paiement à la livraison'}</strong> — vous payez à la réception
                  </div>
                );

              case 'urgency':
                return urgencyConfig.enabled !== false ? (
                  <div key={field.name} style={{ borderRadius: 12, padding: '12px 14px', backgroundColor: btnColor, color: '#fff', fontSize: 13, lineHeight: 1.5 }}>
                    <p style={{ margin: 0 }}>{urgencyConfig.text || 'Stock presque épuisé. La promotion se termine bientôt.'}</p>
                    {urgencyConfig.countdown && countdownSecs != null && (
                      <span style={{ display: 'inline-block', marginTop: 6, fontFamily: 'monospace', fontWeight: 700, fontSize: 15, backgroundColor: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 6 }}>
                        {String(Math.floor(countdownSecs / 60)).padStart(2, '0')}:{String(countdownSecs % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                ) : null;

              case 'call_schedule':
                return callScheduleConfig.enabled !== false ? (
                  <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textColor }}>
                      {callScheduleConfig.question || field.label || 'À quel moment souhaitez-vous être appelé ?'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(callScheduleConfig.options || []).map((opt, j) => (
                        <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textColor, cursor: 'pointer' }}>
                          <input type="radio" name="call_schedule" value={opt.value}
                            checked={form.call_schedule === opt.value}
                            onChange={() => set('call_schedule', opt.value)}
                            style={{ accentColor: btnColor }} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null;

              case 'title':
                return (
                  <div key={field.name} style={{ fontSize: 15, fontWeight: 700, color: textColor, padding: '4px 0' }}>
                    {field.label || ''}
                  </div>
                );

              case 'image':
                return field.imageUrl ? (
                  <img key={field.name} src={field.imageUrl} alt={field.label || 'Image'} style={{ width: '100%', borderRadius: 12, objectFit: 'contain', maxHeight: 200 }} />
                ) : null;

              case 'divider':
                return <hr key={field.name} style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />;

              case 'html':
                return (
                  <div key={field.name} style={{ fontSize: 13, color: textColor }}
                    dangerouslySetInnerHTML={{ __html: field.htmlContent || '' }} />
                );

              case 'trust_badge':
                return (
                  <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <Shield size={16} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#15803D' }}>{field.label || 'Paiement sécurisé'}</span>
                  </div>
                );

              case 'guarantee':
                return (
                  <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <CheckCircle size={16} style={{ color: '#2563EB', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8' }}>{field.label || 'Satisfait ou remboursé'}</span>
                  </div>
                );

              case 'consent':
                return (
                  <label key={field.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, cursor: 'pointer', color: textColor }}>
                    <input type="checkbox" checked={!!form[field.name]} onChange={e => set(field.name, e.target.checked)}
                      style={{ accentColor: btnColor, marginTop: 2, flexShrink: 0 }} />
                    <span>{field.label}</span>
                  </label>
                );

              case 'radio':
                return (
                  <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    {field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textColor }}>{field.label}</p>}
                    {(field.options || []).map((opt, j) => (
                      <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textColor, cursor: 'pointer' }}>
                        <input type="radio" name={field.name} value={opt}
                          checked={form[field.name] === opt}
                          onChange={() => set(field.name, opt)}
                          style={{ accentColor: btnColor }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                );

              case 'checkbox':
                return (
                  <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                    {field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textColor }}>{field.label}</p>}
                    {(field.options || []).map((opt, j) => (
                      <label key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textColor, cursor: 'pointer' }}>
                        <input type="checkbox" checked={(form[field.name] || []).includes(opt)}
                          onChange={e => {
                            const arr = form[field.name] || [];
                            set(field.name, e.target.checked ? [...arr, opt] : arr.filter(v => v !== opt));
                          }}
                          style={{ accentColor: btnColor }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                );

              case 'address':
                return (
                  <div key={field.name} style={{ position: 'relative' }}>
                    {field.showIcon !== false && <span style={iconStyle}><MapPin size={15} /></span>}
                    <input type="text" placeholder={ph} value={form[field.name] || ''}
                      onChange={e => set(field.name, e.target.value)}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = btnColor}
                      onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                  </div>
                );

              case 'country':
                return (
                  <div key={field.name} style={{ position: 'relative' }}>
                    {field.showIcon !== false && <span style={iconStyle}><Globe size={15} /></span>}
                    {formCountries.length > 0 ? (
                      <>
                        <select value={form[field.name] || selectedCountry || ''} onChange={e => set(field.name, e.target.value)}
                          style={{ ...inputStyle, paddingRight: 34, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: (form[field.name] || selectedCountry) ? inputTextColor : '#9CA3AF' }}
                          onFocus={e => e.currentTarget.style.borderColor = btnColor}
                          onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                          <option value="" disabled>{ph}</option>
                          {formCountries.map((countryName) => (
                            <option key={countryName} value={countryName}>{countryName}</option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                      </>
                    ) : (
                      <input type="text" placeholder={ph} value={form[field.name] || selectedCountry || ''}
                        onChange={e => set(field.name, e.target.value)}
                        style={inputStyle}
                        onFocus={e => e.currentTarget.style.borderColor = btnColor}
                        onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                    )}
                  </div>
                );

              case 'testimonials': {
                const testimonials = field.testimonials || [];
                return testimonials.length > 0 ? (
                  <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textColor }}>{field.label}</p>}
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {testimonials.map((t, ti) => (
                        <div key={ti} style={{ minWidth: 200, maxWidth: 220, flexShrink: 0, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={12} style={{ color: s <= (t.rating || 5) ? '#FACC15' : '#D1D5DB', fill: s <= (t.rating || 5) ? '#FACC15' : 'none' }} />
                            ))}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, color: '#4B5563', lineHeight: 1.4 }}>"{t.text}"</p>
                          <p style={{ margin: '4px 0 0', fontSize: 11, fontWeight: 600, color: '#1F2937' }}>— {t.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              }

              case 'summary':
                return (
                  <div key={field.name} style={{ fontSize: 13, color: textColor, padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>{product?.name}</span><span>x{form.quantity}</span></div>
                    <div style={{ fontWeight: 700, textAlign: 'right' }}>{fmt(total, currency)}</div>
                  </div>
                );

              case 'cta_button': {
                const ctaLabel = (field.label || 'ACHETER MAINTENANT - {total}').replace('{total}', fmt(total, currency));
                const CtaIcon = ICON_MAP[field.icon] || ShoppingCart;
                return (
                  <React.Fragment key={field.name}>
                    <button type="submit" disabled={submitting} style={{
                      width: '100%', padding: '15px 20px',
                      borderRadius: design.formBorderRadius || borderRadius,
                      border: design.formBorderWidth && parseInt(design.formBorderWidth) > 0
                        ? `${design.formBorderWidth} solid ${design.formBorderColor || 'transparent'}`
                        : 'none',
                      backgroundColor: submitting ? '#9CA3AF' : btnColor,
                      boxShadow: design.formShadow && parseInt(design.formShadow) > 0
                        ? `0 ${design.formShadow}px ${parseInt(design.formShadow)*2}px ${btnColor}40`
                        : 'none',
                      color: '#fff', fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      transition: 'opacity 0.15s', fontFamily: 'inherit',
                    }}>
                      {submitting ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...</> : <>{field.showIcon !== false && <CtaIcon size={17} />} {ctaLabel}</>}
                    </button>
                    <style>{`
                      @keyframes spin{to{transform:rotate(360deg)}}
                      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
                      @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
                      @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
                      @keyframes glow{from{box-shadow:0 0 5px ${btnColor}60}to{box-shadow:0 0 20px ${btnColor}90}}
                    `}</style>
                  </React.Fragment>
                );
              }

              default:
                return null;
            }
          })}
        </form>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default QuickOrderModal;
