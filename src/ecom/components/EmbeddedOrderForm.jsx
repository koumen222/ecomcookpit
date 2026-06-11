import React, { useState, useEffect, useMemo, useRef } from 'react';
import { safeHtml } from '../utils/sanitize';
import { ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, Truck, Plus, Minus, AlertCircle, ChevronDown, Mail, FileText, Hash, Calendar, Clock, Shield, Globe, Star, ShoppingBag, ArrowRight, Check, CreditCard, Rocket, Gift, Sparkles, Zap, Flame, Crown, Gem, Trophy, Lock, BadgeCheck, Tag, Send, Bell, ThumbsUp, Wallet, Package } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import defaultConfig from './productSettings/defaultConfig.js';
import { createMetaEventId, injectPixelScripts, safeFirePixelEvent } from '../utils/pixelTracking';
import { PHONE_CODES, getDefaultPhoneCodeFromConfig, getPhoneCodeByCountryName, buildFullPhone, getCurrencyByPhoneCode, getPhoneLength } from '../utils/phoneCodes.js';
import {
  buildStorefrontOrderWhatsappMessage,
  getPopularCitiesForCountries,
  resolveOrderFormContext,
  resolveSelectedOrderCountry,
  resolveStoreCountry,
  findMatchingCountryOption,
} from '../utils/storeCountryConfig.js';
import { getIconComponent, getAnimationClass, ANIMATION_CSS } from './productSettings/ButtonEditor.jsx';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur === 'XAF' || cur === 'XOF' ? 'FCFA' : cur}`;
const getImgSrc = (img) => (img && typeof img === 'object' ? img.url : img) || null;
const ICON_MAP = { user: User, phone: Phone, map: MapPin, pin: MapPin, mail: Mail, cart: ShoppingCart, file: FileText, hash: Hash, calendar: Calendar, bag: ShoppingBag, arrow: ArrowRight, check: Check, credit: CreditCard, wallet: Wallet, rocket: Rocket, gift: Gift, sparkles: Sparkles, zap: Zap, flame: Flame, star: Star, crown: Crown, gem: Gem, trophy: Trophy, truck: Truck, package: Package, send: Send, heart: ShoppingBag, thumbs: ThumbsUp, tag: Tag, lock: Lock, badge: BadgeCheck, bell: Bell };
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
 * EmbeddedOrderForm — Formulaire de commande intégré directement dans la page produit.
 * Remplace le bouton CTA + popup quand formType === 'embedded'.
 * Même logique que QuickOrderModal, version inline.
 */
const EmbeddedOrderForm = ({ product, subdomain, store, pixels, productPageConfig }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
  const [phoneCode, setPhoneCode] = useState(() => getDefaultPhoneCodeFromConfig(productPageConfig?.general?.countries, store?.currency));
  const phoneCodeUserSet = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [deliveryZoneOptions, setDeliveryZoneOptions] = useState([]);
  const [countdownSecs, setCountdownSecs] = useState(null);

  const baseCurrency = product?.currency || store?.currency || 'XAF';
  const [displayCurrency, setDisplayCurrency] = useState(baseCurrency);
  const currency = displayCurrency;

  const design = productPageConfig?.design || {};
  const formConfig = productPageConfig?.form || {};
  const conversionConfig = productPageConfig?.conversion || {};
  const btnCfg = productPageConfig?.button || {};

  const offerDesign = conversionConfig.offerDesign || null;
  const btnColor = design.formButtonColor || design.ctaButtonColor || design.buttonColor || '#0F6B4F';
  const od = offerDesign || {};
  const accentColor = btnColor;
  const offerBorderRadius = od.borderRadius ?? 10;
  const offerBorderStyle = od.borderStyle || od.border_style || 'solid';
  const offerBorderSel = od.borderColorSelected || accentColor;
  const offerBorderUnsel = od.borderColorUnselected || '#E5E7EB';
  const offerBgSel = od.bgColorSelected || `${accentColor}08`;
  const offerBgUnsel = od.bgColorUnselected || '#ffffff';
  const offerRadioColor = od.radioColor || accentColor;
  const offerBadgeBg = od.badgeBg || accentColor;
  const offerBadgeTextColor = od.badgeTextColor || '#ffffff';
  const offerBadgeRadius = od.badgeRadius ?? 20;
  const offerBadgeFontSize = od.badgeFontSize ?? 10;
  const offerBadgeStyle = od.badgeStyle || 'pill';
  const offerLabelGradient = od.labelGradient || od.badgeBg || accentColor;
  const offerLabelTextColor = od.labelTextColor || od.badgeTextColor || '#ffffff';
  const offerLabelFontSize = od.labelFontSize ?? 11;
  const offerLabelStyle = od.labelStyle || 'banner';
  const offerPriceColor = od.priceColor || accentColor;
  const offerPriceFontSize = od.priceFontSize ?? 14;
  const offerPriceFontWeight = od.priceFontWeight === 'black' ? 900 : od.priceFontWeight === 'normal' ? 400 : 800;
  const offerTitleColor = od.titleTextColor || '#111827';
  const offerTitleFontSize = od.titleFontSize ?? 14;
  const offerTitleFontWeight = od.titleFontWeight === 'black' ? 900 : od.titleFontWeight === 'normal' ? 400 : 700;
  const offerCompareColor = od.compareColor || '#9CA3AF';
  const offerDiscBg = od.discountBg || '#FEE2E2';
  const offerDiscText = od.discountTextColor || '#EF4444';
  const offerSectionLabel = od.sectionLabel || 'Choisissez votre offre';
  const offerDisplayType = od.displayType || 'radio';
  const urgencyConfig = {
    ...(defaultConfig.urgency || {}),
    ...(design.showCountdown ? {
      countdown: true,
      countdownDays: design.countdownDays ?? 0,
      countdownHours: design.countdownHours ?? 0,
      countdownMinutes: design.countdownMinutes ?? 15,
      countdownSeconds: design.countdownSeconds ?? 0,
    } : {}),
    ...(productPageConfig?.urgency || {}),
  };
  const callScheduleConfig = productPageConfig?.callSchedule || defaultConfig.callSchedule || {};

  const isPremiumTheme = store?.template === 'magazine';

  const textColor = design.formTextColor || '#111827';
  const inputTextColor = design.fieldTextColor || '#111827';
  const borderRadius = design.formInputRadius || (isPremiumTheme ? '14px' : '12px');
  const formBgResolved = design.formBgColor || '#ffffff';
  const formShadowVal = parseInt(design.formShadow) || 0;
  const formBoxShadow = formShadowVal > 0
    ? `0 ${formShadowVal}px ${formShadowVal * 2}px rgba(0,0,0,${Math.min(0.06 + formShadowVal * 0.015, 0.45).toFixed(2)})`
    : isPremiumTheme ? '0 2px 24px rgba(15,23,42,0.08)' : 'none';
  const inputBorderColor = design.fieldBorderColor || design.formBorderColor || '#E5E7EB';
  const inputBgColor = design.fieldBgColor || '#ffffff';
  const labelColorResolved = design.fieldIconColor || '#9CA3AF';
  const effectiveBtnColor = btnColor;

  const showQuantitySelector = design.showQuantitySelector !== false;

  const configFields = formConfig.fields || [];
  const effectiveFields = configFields.length ? configFields : defaultConfig.form.fields;
  const generalConfig = productPageConfig?.general || {};
  const orderFormContext = useMemo(() => resolveOrderFormContext({ store, generalConfig }), [store, generalConfig]);
  const formCountries = orderFormContext.countries;
  const storeCountry = resolveStoreCountry(store);
  const phoneCountry = useMemo(() => {
    const entry = PHONE_CODES.find(c => c.code === phoneCode);
    return entry ? entry.name : '';
  }, [phoneCode]);
  const selectedCountry = resolveSelectedOrderCountry({
    explicitCountry: getSelectedCountryValue(effectiveFields, form) || phoneCountry,
    configuredCountries: formCountries,
    storeCountry,
  });
  const cityOptions = useMemo(() => {
    if (deliveryZoneOptions.length > 0) {
      const matchingZones = selectedCountry
        ? deliveryZoneOptions.filter((zone) => findMatchingCountryOption(selectedCountry, [zone.country]))
        : deliveryZoneOptions;
      const source = matchingZones.length > 0 ? matchingZones : deliveryZoneOptions;
      const cities = source.flatMap((zone) => {
        const raw = zone.city || '';
        if (raw.includes(',')) return [raw.split(',')[0].trim()];
        return [raw];
      }).filter(Boolean);
      return [...new Set(cities)];
    }

    return getPopularCitiesForCountries(selectedCountry ? [selectedCountry] : formCountries, orderFormContext.popularCities);
  }, [deliveryZoneOptions, selectedCountry, formCountries, orderFormContext.popularCities]);

  // Countdown timer for urgency field
  // Inject pixel scripts at mount so Purchase always fires, even if the
  // product page ViewContent effect hasn't run yet (slow API, race condition).
  useEffect(() => {
    if (pixels) injectPixelScripts(pixels);
  }, [pixels]);

  useEffect(() => {
    if (!urgencyConfig.countdown) return;
    const total =
      (urgencyConfig.countdownDays || 0) * 86400 +
      (urgencyConfig.countdownHours || 0) * 3600 +
      (urgencyConfig.countdownMinutes || 15) * 60 +
      (urgencyConfig.countdownSeconds || 0);
    setCountdownSecs(total);
    const iv = setInterval(() => setCountdownSecs(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, [urgencyConfig.countdown, urgencyConfig.countdownDays, urgencyConfig.countdownHours, urgencyConfig.countdownMinutes, urgencyConfig.countdownSeconds]);

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
    if (phoneCodeUserSet.current) return;
    const defaultPhoneCode = getDefaultPhoneCodeFromConfig(formCountries, store?.currency);
    if (defaultPhoneCode) setPhoneCode(defaultPhoneCode);
  }, [formCountries, store?.currency]);

  useEffect(() => {
    const countryField = effectiveFields.find((field) => field.enabled !== false && field.type === 'country');
    if (!countryField || !selectedCountry) return;

    setForm((prev) => {
      if (String(prev[countryField.name] || '').trim()) return prev;
      return { ...prev, [countryField.name]: selectedCountry };
    });
  }, [effectiveFields, selectedCountry]);

  useEffect(() => {
    if (phoneCodeUserSet.current) return;
    const nextPhoneCode = getPhoneCodeByCountryName(selectedCountry);
    if (nextPhoneCode) setPhoneCode(nextPhoneCode);
  }, [selectedCountry]);

  const availablePhoneCodes = useMemo(() => {
    if (!formCountries.length) return PHONE_CODES;
    const configCodes = formCountries.map(c => getPhoneCodeByCountryName(c)).filter(Boolean);
    if (!configCodes.length) return PHONE_CODES;
    const filtered = PHONE_CODES.filter(c => configCodes.includes(c.code));
    return filtered.length > 0 ? filtered : PHONE_CODES;
  }, [formCountries]);

  useEffect(() => {
    if (availablePhoneCodes.length > 0 && !availablePhoneCodes.find(c => c.code === phoneCode)) {
      phoneCodeUserSet.current = false;
      setPhoneCode(availablePhoneCodes[0].code);
    }
  }, [availablePhoneCodes, phoneCode]);

  useEffect(() => {
    if (phoneCountry && form.city) {
      const cityField = effectiveFields.find(f => f.type === 'city_select' && f.enabled !== false);
      if (cityField) {
        const key = FIELD_KEY_MAP[cityField.name] || cityField.name;
        if (form[key] && !cityOptions.includes(form[key])) {
          setForm(prev => ({ ...prev, [key]: '' }));
        }
      }
    }
  }, [cityOptions]);

  const configQuantities = conversionConfig.quantities || [];
  const useQuantityButtons = configQuantities.length > 0;
  const offersEnabled = conversionConfig.offersEnabled && conversionConfig.offers?.length > 0;
  const offers = conversionConfig.offers || [];
  const defaultOfferIdx = offers.findIndex(o => o.selected);
  const [selectedOfferIdx, setSelectedOfferIdx] = useState(Math.max(0, defaultOfferIdx));

  // Shipping fee calculation: per-zone cost > flat fee
  const flatShippingEnabled = store?.flatShippingEnabled === true;
  const flatShippingFee = Math.max(0, Number(store?.flatShippingFee) || 0);
  const freeShippingThreshold = Math.max(0, Number(store?.freeShippingThreshold) || 0);

  const getTotal = () => {
    if (offersEnabled && offers[selectedOfferIdx]?.price > 0) {
      return offers[selectedOfferIdx].price;
    }
    return (product?.price || 0) * form.quantity;
  };
  const subtotal = getTotal();
  const flatCostEffective = flatShippingEnabled && flatShippingFee > 0
    ? (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold ? 0 : flatShippingFee)
    : 0;
  // Zone cost from selected city (takes priority over flat fee)
  const selectedCityZone = deliveryZoneOptions.find(z =>
    z.city === form.city && (!selectedCountry || findMatchingCountryOption(selectedCountry, [z.country]))
  );
  const zoneCost = selectedCityZone?.cost > 0 ? Number(selectedCityZone.cost) : 0;
  const deliveryCost = zoneCost > 0 ? zoneCost : flatCostEffective;
  const total = subtotal + deliveryCost;

  const set = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Dynamic validation based on enabled required fields
    for (const f of effectiveFields.filter(f => f.enabled !== false && f.required !== false)) {
      const key = FIELD_KEY_MAP[f.name] || f.name;
      const val = (form[key] || '').trim();
      if (['text', 'phone', 'email', 'number', 'city_select', 'textarea', 'select'].includes(f.type) && !val) {
        setError(`${f.label || f.name} est requis`); return;
      }
      if (f.type === 'phone' && val) {
        const digits = val.replace(/[^0-9]/g, '');
        const expected = getPhoneLength(phoneCode);
        if (digits.length !== expected) { setError(`Numéro invalide — ${expected} chiffres requis pour ${phoneCode}`); return; }
      }
      if (f.type === 'email' && val) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) { setError('Adresse e-mail invalide'); return; }
      }
    }

    setSubmitting(true);
    setError('');
    try {
      const offerPriceOverride = offersEnabled && offers[selectedOfferIdx]?.price > 0
        ? { offerPrice: offers[selectedOfferIdx].price, offerQty: offers[selectedOfferIdx].qty || offers[selectedOfferIdx].quantity || 1 }
        : {};

      const getFieldValue = (knownKey, fallbackTypes) => {
        if ((form[knownKey] || '').trim()) return form[knownKey].trim();
        const fallbackField = effectiveFields.find(f => f.enabled !== false && fallbackTypes.includes(f.type));
        if (fallbackField) {
          const stateKey = FIELD_KEY_MAP[fallbackField.name] || fallbackField.name;
          if ((form[stateKey] || '').trim()) return form[stateKey].trim();
        }
        return '';
      };

      const finalCustomerName = getFieldValue('customerName', ['text']);
      const finalPhone = getFieldValue('phone', ['phone', 'number']);
      const finalCity = getFieldValue('city', ['city_select', 'text']);
      const finalAddress = getFieldValue('address', ['address', 'text']);
      const finalNotes = getFieldValue('notes', ['textarea', 'text']);

      const fullPhone = buildFullPhone(phoneCode, finalPhone);
      const purchaseEventId = createMetaEventId('purchase');
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: finalCustomerName,
        phone: fullPhone,
        phoneCode,
        email: '',
        address: finalAddress,
        city: finalCity,
        country: selectedCountry,
        notes: finalNotes,
        deliveryCost: deliveryCost,
        deliveryType: deliveryCost > 0 ? 'livraison' : '',
        deliveryZone: selectedCityZone ? selectedCityZone.city : '',
        callSchedule: form.call_schedule || '',
        products: [{ productId: product._id, quantity: form.quantity, ...offerPriceOverride }],
        channel: 'store',
        metaEventId: purchaseEventId,
        metaSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
      });
      setOrderResult(res.data?.data);
      setSuccess(true);

      safeFirePixelEvent(pixels, 'Purchase', {
        content_ids: [product._id || product.slug || ''],
        content_name: product.name || '',
        value: total,
        currency,
        num_items: form.quantity,
        eventId: purchaseEventId,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la commande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;

  // ── Success state ──
  if (success && orderResult) {
    const storeWhatsapp = (store?.whatsapp || store?.phone || '').replace(/[^0-9+]/g, '');

    const getFieldValue = (knownKey, fallbackTypes) => {
      if ((form[knownKey] || '').trim()) return form[knownKey].trim();
      const fallbackField = effectiveFields.find(f => f.enabled !== false && fallbackTypes.includes(f.type));
      if (fallbackField) {
        const stateKey = FIELD_KEY_MAP[fallbackField.name] || fallbackField.name;
        if ((form[stateKey] || '').trim()) return form[stateKey].trim();
      }
      return '';
    };

    const finalCustomerName = getFieldValue('customerName', ['text']);
    const finalPhone = getFieldValue('phone', ['phone', 'number']);
    const finalCity = getFieldValue('city', ['city_select', 'text']);
    const finalAddress = getFieldValue('address', ['address', 'text']);
    const finalNotes = getFieldValue('notes', ['textarea', 'text']);

    const firstName = finalCustomerName.split(' ')[0] || 'Client';
    const displayPhone = buildFullPhone(phoneCode, finalPhone);
    const waMsg = buildStorefrontOrderWhatsappMessage({
      storeName: store?.name || '',
      orderNumber: orderResult.orderNumber,
      totalLabel: fmt(orderResult.total, orderResult.currency),
      customerName: finalCustomerName,
      displayPhone,
      country: selectedCountry,
      city: finalCity,
      address: finalAddress,
      notes: finalNotes,
    });
    const waLink = storeWhatsapp ? `https://wa.me/${storeWhatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(waMsg)}` : null;

    return (
      <div style={{ borderRadius: design.formBorderRadius || 20, overflow: 'hidden', border: `2px solid ${btnColor}20`, backgroundColor: design.formBgColor || '#fff' }}>
        {/* Top gradient bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${btnColor}, #25D366)` }} />

        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          {/* Success icon */}
          <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px', backgroundColor: `${btnColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color={btnColor} />
          </div>

          {/* Thank you */}
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
            Merci {firstName} !
          </h3>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>
            Votre commande a été enregistrée avec succès.<br/>
            Confirmez-la sur WhatsApp pour accélérer le traitement.
          </p>

          {/* Order recap card */}
          <div style={{ backgroundColor: '#F9FAFB', borderRadius: 14, padding: '14px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {[
              ['Référence', orderResult.orderNumber],
              ['Produit', `${product.name} x${form.quantity}`],
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
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: '13px 20px', borderRadius: 14, backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', border: 'none', cursor: 'pointer', marginBottom: 10, boxSizing: 'border-box' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Confirmer sur WhatsApp
            </a>
          )}

          {/* Secondary action */}
          <button onClick={() => { setSuccess(false); setOrderResult(null); setForm({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 }); }}
            style={{ width: '100%', padding: '11px 20px', borderRadius: 14, border: '1.5px solid #E5E7EB', backgroundColor: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Commander à nouveau
          </button>
        </div>
      </div>
    );
  }

  // ── Inline form ──
  return (
    <div style={isPremiumTheme ? {
      borderRadius: 20,
      border: `1.5px solid ${effectiveBtnColor}22`,
      backgroundColor: formBgResolved,
      boxShadow: formBoxShadow,
      overflow: 'hidden',
    } : {
      borderRadius: design.formBorderRadius || 0,
      border: 'none',
      borderTop: `3px solid ${effectiveBtnColor}`,
      padding: '24px 16px',
      margin: '0 8px',
      backgroundColor: formBgResolved,
      boxShadow: formBoxShadow,
    }}>
      {isPremiumTheme && (
        <div style={{ height: 4, background: `linear-gradient(90deg, ${effectiveBtnColor}, color-mix(in srgb, ${effectiveBtnColor} 60%, #fff))` }} />
      )}
      <div style={isPremiumTheme ? { padding: '22px 20px' } : {}}>
      <h3 style={isPremiumTheme ? {
        fontSize: 17,
        fontWeight: 900,
        color: textColor,
        margin: '0 0 6px',
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
        fontFamily: 'var(--s-font)',
      } : {
        fontSize: 16,
        fontWeight: 800,
        color: textColor,
        margin: '0 0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--s-font)',
      }}>
        {isPremiumTheme ? (btnCfg.text || 'Commander maintenant') : (
          <><ShoppingCart size={18} color={effectiveBtnColor} /> {btnCfg.text || 'Commander maintenant'}</>
        )}
      </h3>
      {isPremiumTheme && (
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px', fontFamily: 'var(--s-font)' }}>
          Remplissez le formulaire ci-dessous — paiement à la livraison.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          const fIconColor = field.iconColor || labelColorResolved;
          const iconStyle = { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: fIconColor, display: 'flex', pointerEvents: 'none' };
          const inputPadLeft = IconComp ? '34px' : '14px';
          const fieldBorderColor = field.borderColor || inputBorderColor;
          const fieldBgColor = field.bgColor || inputBgColor;
          const fieldTxtColor = field.textColor || inputTextColor;
          const inputStyle = { width: '100%', padding: `${isPremiumTheme ? '12px' : '11px'} 14px 11px ${inputPadLeft}`, borderRadius, border: `1.5px solid ${fieldBorderColor}`, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: fieldTxtColor, backgroundColor: isPremiumTheme ? '#F9FAFB' : fieldBgColor, transition: 'border-color 0.15s' };

          switch (field.type) {
            case 'product_info':
              return (
                <div key={field.name}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 5 }}>
                    {offersEnabled ? offerSectionLabel : 'Quantité'}
                  </label>
                  {offersEnabled ? (
                    <div style={offerDisplayType === 'grid' ? { display: 'grid', gridTemplateColumns: `repeat(${offers.length}, 1fr)`, gap: 6 } : { display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {offers.map((offer, i) => {
                        const offerQty = offer.qty || offer.quantity || 1;
                        const offerTitle = offer.title || `${offerQty} ${offerQty === 1 ? 'unité' : 'unités'}`;
                        const offerSubtitle = offer.subtitle || offer.digitalProductBonus?.title || '';
                        const displayPrice = offer.price > 0 ? offer.price : (product?.price || 0) * offerQty;
                        const displayCompare = offer.comparePrice > 0 ? offer.comparePrice : 0;
                        const disc = displayCompare > displayPrice && displayPrice > 0 ? Math.round((1 - displayPrice / displayCompare) * 100) : 0;
                        const sel = selectedOfferIdx === i;
                        const badgeRad = offerBadgeStyle === 'square' ? 4 : 20;
                        const renderDiscLabel = () => {
                          if (!disc) return null;
                          const txt = `-${disc}%`;
                          if (offerLabelStyle === 'underline') return <span style={{ color: offerLabelTextColor, fontSize: offerLabelFontSize, fontWeight: 700, textDecoration: 'underline' }}>{txt}</span>;
                          if (offerLabelStyle === 'chip') return <span style={{ background: offerLabelGradient, color: offerLabelTextColor, fontSize: offerLabelFontSize, fontWeight: 700, padding: '1px 5px', borderRadius: 20 }}>{txt}</span>;
                          return <span style={{ background: offerLabelGradient, color: offerLabelTextColor, fontSize: offerLabelFontSize, fontWeight: 700, padding: '1px 6px', borderRadius: 6 }}>{txt}</span>;
                        };

                        // ── Grille (colonnes) ──
                        if (offerDisplayType === 'grid') {
                          return (
                            <div key={i} onClick={() => { setSelectedOfferIdx(i); set('quantity', offerQty); }}
                              style={{ borderRadius: offerBorderRadius, cursor: 'pointer', borderWidth: sel ? 2 : 1.5, borderStyle: 'solid', borderColor: sel ? offerBorderSel : offerBorderUnsel, backgroundColor: sel ? offerBgSel : offerBgUnsel, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px 12px', gap: 5, position: 'relative', overflow: 'hidden', transition: 'all 0.15s ease' }}>
                              {offer.badge && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', background: offerBadgeBg, color: offerBadgeTextColor, fontSize: offerBadgeFontSize, fontWeight: 700, padding: '2px 0' }}>{offer.badge}</div>
                              )}
                              <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: offer.badge ? 14 : 0 }}>
                                {getImgSrc(product?.images?.[0])
                                  ? <img src={getImgSrc(product.images[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <Package size={22} color="#D1D5DB" />
                                }
                              </div>
                              <div style={{ fontSize: offerTitleFontSize - 1, fontWeight: offerTitleFontWeight, color: offerTitleColor, textAlign: 'center' }}>
                                {offerTitle}
                              </div>
                              {offerSubtitle && <div style={{ fontSize: 10.5, color: '#6B7280', textAlign: 'center', lineHeight: 1.25 }}>{offerSubtitle}</div>}
                              {disc > 0 && (
                                <div style={{ background: offerDiscBg, padding: '2px 8px', borderRadius: 20 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: offerDiscText }}>Économisez {disc}%</span>
                                </div>
                              )}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: offerPriceFontSize - 1, fontWeight: offerPriceFontWeight, color: offerPriceColor }}>{fmt(displayPrice, currency)}</div>
                                {displayCompare > displayPrice && displayPrice > 0 && (
                                  <div style={{ fontSize: 10, color: offerCompareColor, textDecoration: 'line-through' }}>{fmt(displayCompare, currency)}</div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // ── Image + texte (liste) ──
                        if (offerDisplayType === 'image-row') {
                          return (
                            <div key={i} onClick={() => { setSelectedOfferIdx(i); set('quantity', offerQty); }}
                              style={{ padding: '10px 12px', borderRadius: offerBorderRadius, cursor: 'pointer', borderWidth: sel ? 2 : 1.5, borderStyle: 'solid', borderColor: sel ? offerBorderSel : offerBorderUnsel, backgroundColor: sel ? offerBgSel : offerBgUnsel, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s ease' }}>
                              <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {getImgSrc(product?.images?.[0])
                                  ? <img src={getImgSrc(product.images[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <Package size={22} color="#D1D5DB" />
                                }
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: offerTitleFontSize, fontWeight: offerTitleFontWeight, color: offerTitleColor }}>
                                  {offerTitle}
                                </div>
                                {offerSubtitle && <div style={{ marginTop: 2, fontSize: 11, lineHeight: 1.25, color: '#6B7280' }}>{offerSubtitle}</div>}
                                {disc > 0 && (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', background: offerDiscBg, padding: '1px 7px', borderRadius: 20, marginTop: 2 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: offerDiscText }}>Économisez {disc}%</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: offerPriceFontSize, fontWeight: offerPriceFontWeight, color: offerPriceColor }}>{fmt(displayPrice, currency)}</span>
                                  {displayCompare > displayPrice && displayPrice > 0 && (
                                    <span style={{ fontSize: 11, color: offerCompareColor, textDecoration: 'line-through' }}>{fmt(displayCompare, currency)}</span>
                                  )}
                                </div>
                              </div>
                              {offer.badge && (
                                <div style={{ flexShrink: 0, fontSize: offerBadgeFontSize, fontWeight: 700, color: offerBadgeTextColor, backgroundColor: offerBadgeBg, padding: '2px 7px', borderRadius: offerBadgeRadius, whiteSpace: 'nowrap' }}>
                                  {offer.badge}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // ── Radio classique (défaut) ──
                        return (
                          <div key={i} style={{ position: 'relative', overflow: offerBadgeStyle === 'ribbon' ? 'hidden' : 'visible' }}>
                            {offer.badge && offerBadgeStyle !== 'ribbon' && (
                              <div style={{ position: 'absolute', top: -8, right: 8, background: offerBadgeBg, color: offerBadgeTextColor, fontSize: offerBadgeFontSize, fontWeight: 700, padding: '1px 7px', borderRadius: badgeRad, zIndex: 2, whiteSpace: 'nowrap' }}>
                                {offer.badge}
                              </div>
                            )}
                            {offer.badge && offerBadgeStyle === 'ribbon' && (
                              <div style={{ position: 'absolute', top: 0, right: 0, width: 48, height: 48, overflow: 'hidden', zIndex: 2 }}>
                                <div style={{ position: 'absolute', top: 9, right: -13, width: 65, textAlign: 'center', transform: 'rotate(45deg)', background: offerBadgeBg, color: offerBadgeTextColor, fontSize: offerBadgeFontSize, fontWeight: 700, padding: '2px 0' }}>{offer.badge}</div>
                              </div>
                            )}
                            <div onClick={() => { setSelectedOfferIdx(i); set('quantity', offerQty); }}
                              style={{ padding: '10px 12px', borderRadius: offerBorderRadius, cursor: 'pointer', borderWidth: sel ? 2 : 1.5, borderStyle: offerBorderStyle === 'flat' ? 'solid' : offerBorderStyle, borderColor: sel ? offerBorderSel : offerBorderUnsel, backgroundColor: sel ? offerBgSel : offerBgUnsel, display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s ease' }}>
                              <div style={{ width: 16, height: 16, borderRadius: '50%', border: sel ? `4px solid ${offerRadioColor}` : '2px solid #D1D5DB', flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: offerTitleFontSize, fontWeight: offerTitleFontWeight, color: offerTitleColor }}>
                                  {offerTitle}
                                </div>
                                {offerSubtitle && <div style={{ marginTop: 2, fontSize: 11, lineHeight: 1.25, color: '#6B7280' }}>{offerSubtitle}</div>}
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: offerPriceFontSize, fontWeight: offerPriceFontWeight, color: offerPriceColor }}>{fmt(displayPrice, currency)}</span>
                                  {displayCompare > displayPrice && displayPrice > 0 && (
                                    <span style={{ fontSize: 11, color: offerCompareColor, textDecoration: 'line-through' }}>{fmt(displayCompare, currency)}</span>
                                  )}
                                  {renderDiscLabel()}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : !showQuantitySelector ? (
                    <div style={{ padding: '11px 14px', borderRadius, border: `1.5px solid ${inputBorderColor}`, backgroundColor: inputBgColor, color: inputTextColor, fontSize: 14, fontWeight: 600 }}>
                      1 unité
                    </div>
                  ) : useQuantityButtons ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {configQuantities.map(qty => (
                        <button key={qty} type="button" onClick={() => set('quantity', qty)} style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${form.quantity === qty ? effectiveBtnColor : inputBorderColor}`, backgroundColor: form.quantity === qty ? effectiveBtnColor : inputBgColor, color: form.quantity === qty ? '#fff' : inputTextColor, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>{qty}</button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${effectiveBtnColor}`, background: inputBgColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: effectiveBtnColor }}><Minus size={14} /></button>
                      <span style={{ fontSize: 15, fontWeight: 800, minWidth: 28, textAlign: 'center', color: inputTextColor }}>{form.quantity}</span>
                      <button type="button" onClick={() => set('quantity', Math.min(product.stock || 99, form.quantity + 1))} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${effectiveBtnColor}`, background: inputBgColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: effectiveBtnColor }}><Plus size={14} /></button>
                    </div>
                  )}
                </div>
              );

            case 'phone': {
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ display: 'flex', gap: 0 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <select value={phoneCode} onChange={e => { phoneCodeUserSet.current = true; setPhoneCode(e.target.value); setDisplayCurrency(getCurrencyByPhoneCode(e.target.value) || baseCurrency); }}
                      style={{ appearance: 'none', WebkitAppearance: 'none', padding: '11px 28px 11px 10px', borderRadius: `${borderRadius} 0 0 ${borderRadius}`, border: `1.5px solid ${fieldBorderColor}`, borderRight: 'none', backgroundColor: inputBgColor, fontSize: 13, fontWeight: 700, color: inputTextColor, cursor: 'pointer', outline: 'none', minWidth: 90 }}>
                      {availablePhoneCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: labelColorResolved, display: 'flex' }}><ChevronDown size={13} /></span>
                  </div>
                  <input type="tel" inputMode="tel" value={form[formKey] || ''}
                    onChange={e => set(formKey, e.target.value.replace(/[^0-9]/g, '').slice(0, getPhoneLength(phoneCode)))}
                    maxLength={getPhoneLength(phoneCode)}
                    placeholder={ph} required={field.required !== false}
                    style={{ ...inputStyle, paddingLeft: '14px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }}
                    onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                    onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                  </div>
                </div>
              );
            }

            case 'text':
            case 'email':
            case 'number':
            case 'date': {
              const inputType = { email: 'email', number: 'number', date: 'date' }[field.type] || 'text';
              const inputMode = field.type === 'email' ? 'email' : undefined;
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ position: 'relative' }}>
                    {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                    <input type={inputType} value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                      inputMode={inputMode} placeholder={ph} required={field.required !== false}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                      onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                  </div>
                </div>
              );
            }

            case 'city_select': {
              const showCitySelect = deliveryZoneOptions.length > 0 || (field.cityAuto !== false && cityOptions.length > 0);
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ position: 'relative' }}>
                  {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                  {showCitySelect && cityOptions.length > 0 ? (<>
                    <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                      style={{ ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : labelColorResolved }}
                      onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                      onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor}>
                      <option value="" disabled>{ph}</option>
                      {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: labelColorResolved, display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                  </>) : (
                    <input type="text" value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                      placeholder={ph} required={field.required !== false}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                      onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                  )}
                  </div>
                </div>
              );
            }

            case 'textarea':
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <textarea value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                    placeholder={ph} rows={2}
                    style={{ width: '100%', padding: '11px 14px', borderRadius, border: `1.5px solid ${fieldBorderColor}`, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: fieldTxtColor, backgroundColor: fieldBgColor, resize: 'none', transition: 'border-color 0.15s' }}
                    onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                    onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                </div>
              );

            case 'select': {
              const options = field.options || [];
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ position: 'relative' }}>
                    {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                    <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                      style={{ ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : labelColorResolved }}
                      onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                      onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor}>
                      <option value="" disabled>{ph}</option>
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: labelColorResolved, display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                  </div>
                </div>
              );
            }

            case 'shipping':
              return deliveryCost > 0 ? (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: field.textColor || '#059669', padding: '10px 14px', backgroundColor: field.bgColor || '#F0FDF4', borderRadius: 10, border: `1px solid ${field.borderColor || '#BBF7D0'}` }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Truck size={14} style={{ color: field.iconColor || field.textColor || '#059669' }} /> <strong>Frais de livraison</strong></span>
                  <strong>{fmt(deliveryCost, currency)}</strong>
                </div>
              ) : flatShippingEnabled && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold ? (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: field.textColor || '#059669', padding: '10px 14px', backgroundColor: field.bgColor || '#F0FDF4', borderRadius: 10, border: `1px solid ${field.borderColor || '#BBF7D0'}` }}>
                  <Truck size={14} style={{ color: field.iconColor || field.textColor || '#059669' }} /> <strong>Livraison gratuite 🎉</strong>
                </div>
              ) : (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: field.textColor || '#16A34A', padding: '4px 0' }}>
                  <Truck size={13} style={{ color: field.iconColor || field.textColor || '#16A34A' }} />
                  <strong>{field.label || 'Paiement à la livraison'}</strong>
                  <span style={{ color: field.subtextColor || '#6b7280' }}>— {field.shippingNote || 'vous payez à la réception'}</span>
                </div>
              );

            case 'urgency': {
              const fieldTotal = field.showCountdown !== false
                ? (field.countdownDays ?? 0) * 86400 + (field.countdownHours ?? 0) * 3600 + (field.countdownMinutes ?? 0) * 60 + (field.countdownSeconds ?? 0)
                : 0;
              const displaySecs = fieldTotal > 0 ? fieldTotal : countdownSecs;
              const showCd = (urgencyConfig.countdown || (field.showCountdown !== false && fieldTotal > 0)) && displaySecs != null;
              const urgBg = field.urgencyBgColor || effectiveBtnColor;
              const urgColor = field.urgencyTextColor || '#fff';
              const urgRadius = field.urgencyRadius || '12px';
              const urgStyle = field.urgencyStyle || 'banner';
              const urgAnim = field.urgencyAnimation || 'none';
              const urgIconMap = { fire: '🔥', warning: '⚠️', clock: '⏰', bolt: '⚡', none: '' };
              const urgIconEmoji = urgIconMap[field.urgencyIcon || 'fire'] || '';
              const urgAnimStyle = urgAnim === 'pulse'
                ? { animation: 'urgPulse 1.5s ease-in-out infinite' }
                : urgAnim === 'shake'
                  ? { animation: 'urgShake 0.5s ease-in-out infinite' }
                  : urgAnim === 'glow'
                    ? { animation: `urgGlow 1.5s ease-in-out infinite alternate` }
                    : {};
              return urgencyConfig.enabled !== false ? (
                <>
                  <style>{`
                    @keyframes urgPulse{0%,100%{opacity:1}50%{opacity:.6}}
                    @keyframes urgShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
                    @keyframes urgGlow{from{box-shadow:0 0 4px ${urgBg}80}to{box-shadow:0 0 16px ${urgBg}}}
                  `}</style>
                  <div key={field.name} style={{
                    borderRadius: urgRadius, padding: '12px 14px',
                    backgroundColor: urgBg, color: urgColor, fontSize: 13, lineHeight: 1.5,
                    boxShadow: urgStyle === 'floating' ? '0 4px 16px rgba(0,0,0,0.18)' : 'none',
                    ...urgAnimStyle,
                  }}>
                    <p style={{ margin: 0 }}>
                      {urgIconEmoji && <span style={{ marginRight: 5 }}>{urgIconEmoji}</span>}
                      {field.urgencyText || urgencyConfig.text || 'Stock presque épuisé. La promotion se termine bientôt.'}
                    </p>
                    {showCd && (() => {
                      const d = Math.floor(displaySecs / 86400);
                      const h = Math.floor((displaySecs % 86400) / 3600);
                      const m = Math.floor((displaySecs % 3600) / 60);
                      const s = displaySecs % 60;
                      const parts = d > 0
                        ? `${String(d).padStart(2,'0')}j ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                        : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 10 }}>
                          {field.countdownText && <span style={{ fontSize: 12, opacity: 0.9 }}>{field.countdownText}</span>}
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 28, backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: 8, letterSpacing: 2 }}>
                            {parts}
                          </span>
                        </div>
                      );
                    })()}
                    {field.showProgressBar && (
                      <div style={{ marginTop: 8, width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '65%', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 99 }} />
                      </div>
                    )}
                  </div>
                </>
              ) : null;
            }

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
                  dangerouslySetInnerHTML={safeHtml(field.htmlContent || '')} />
              );

            case 'trust_badge':
              return (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: field.bgColor || '#F0FDF4', border: `1px solid ${field.borderColor || '#BBF7D0'}` }}>
                  <Shield size={16} style={{ color: field.iconColor || '#16A34A', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: field.textColor || '#15803D' }}>{field.label || 'Paiement sécurisé'}</span>
                </div>
              );

            case 'guarantee':
              return (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, backgroundColor: field.bgColor || '#EFF6FF', border: `1px solid ${field.borderColor || '#BFDBFE'}` }}>
                  <CheckCircle size={16} style={{ color: field.iconColor || '#2563EB', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: field.textColor || '#1D4ED8' }}>{field.label || 'Satisfait ou remboursé'}</span>
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
                  {design.showFieldLabels !== false && field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textColor }}>{field.label}</p>}
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
                  {design.showFieldLabels !== false && field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: textColor }}>{field.label}</p>}
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
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ position: 'relative' }}>
                    {field.showIcon !== false && <span style={iconStyle}><MapPin size={15} /></span>}
                    <input type="text" placeholder={ph} value={form[field.name] || ''}
                      onChange={e => set(field.name, e.target.value)}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                      onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                  </div>
                </div>
              );

            case 'country':
              return (
                <div key={field.name}>
                  {field.showLabel === true && field.label && <label style={{ fontSize: 12, fontWeight: 600, color: labelColorResolved, display: 'block', marginBottom: 4 }}>{field.label}</label>}
                  <div style={{ position: 'relative' }}>
                    {field.showIcon !== false && <span style={iconStyle}><Globe size={15} /></span>}
                    {formCountries.length > 0 ? (
                      <>
                        <select value={form[field.name] || selectedCountry || ''} onChange={e => set(field.name, e.target.value)}
                          style={{ ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: (form[field.name] || selectedCountry) ? inputTextColor : labelColorResolved }}
                          onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                          onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor}>
                          <option value="" disabled>{ph}</option>
                          {formCountries.map((countryName) => (
                            <option key={countryName} value={countryName}>{countryName}</option>
                          ))}
                        </select>
                        <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: labelColorResolved, display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                      </>
                    ) : (
                      <input type="text" placeholder={ph} value={form[field.name] || selectedCountry || ''}
                        onChange={e => set(field.name, e.target.value)}
                        style={inputStyle}
                        onFocus={e => e.currentTarget.style.borderColor = effectiveBtnColor}
                        onBlur={e => e.currentTarget.style.borderColor = fieldBorderColor} />
                    )}
                  </div>
                </div>
              );

            case 'testimonials': {
              const testimonials = field.testimonials || [];
              return testimonials.length > 0 ? (
                <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {design.showFieldLabels !== false && field.showLabel !== false && <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: textColor }}>{field.label}</p>}
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
                <div key={field.name} style={{ fontSize: 13, color: field.textColor || textColor, padding: '8px 12px', backgroundColor: field.bgColor || '#F9FAFB', borderRadius: 10, border: `1px solid ${field.borderColor || '#E5E7EB'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>{product?.name}</span><span>x{form.quantity}</span></div>
                  {deliveryCost > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                      <span>Frais de livraison{selectedCityZone ? ` — ${selectedCityZone.city}` : ''}</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>{fmt(deliveryCost, currency)}</span>
                    </div>
                  )}
                  {flatShippingEnabled && freeShippingThreshold > 0 && subtotal < freeShippingThreshold && deliveryCost === 0 && flatShippingFee > 0 && (
                    <div style={{ fontSize: 11, color: '#D97706', marginBottom: 4 }}>
                      + {fmt(freeShippingThreshold - subtotal, currency)} pour la livraison gratuite
                    </div>
                  )}
                  <div style={{ fontWeight: 700, textAlign: 'right' }}>{fmt(total, currency)}</div>
                </div>
              );

            case 'cta_button': {
              const ctaLabel = (field.label || 'ACHETER MAINTENANT - {total}').replace('{total}', fmt(total, currency));
              const CtaIcon = getIconComponent(field.icon) || ICON_MAP[field.icon] || ShoppingCart;
              // formButtonColor owns the form CTA; field.bgColor only used when neither is set
              const ctaBgColor = design.formButtonColor || field.bgColor || effectiveBtnColor;
              const ctaTextColor = design.buttonTextColor || field.textColor || '#fff';
              const ctaFontSize = field.fontSize || parseInt(design.buttonFontSize) || (isPremiumTheme ? 17 : 15);
              const ctaFontWeight = isPremiumTheme ? 900 : (field.bold !== false && design.buttonBold !== false ? 700 : 400);
              const ctaFontStyle = (field.italic || design.buttonItalic) ? 'italic' : 'normal';
              const ctaBorderW = field.borderWidth ?? parseInt(design.buttonBorderWidth) ?? 0;
              const ctaBorderColor = field.borderColor || design.buttonBorderColor || 'transparent';
              const ctaRadius = `${field.borderRadius ?? parseInt(design.ctaBorderRadius) ?? 14}px`;
              const ctaShadowVal = field.shadow ?? parseInt(design.buttonShadow) ?? 0;
              const ctaShadow = submitting ? 'none'
                : ctaShadowVal > 0
                  ? `0 ${ctaShadowVal}px ${ctaShadowVal * 2}px rgba(0,0,0,${Math.min(ctaShadowVal * 0.06, 0.5).toFixed(2)})`
                  : `0 4px 16px ${ctaBgColor}50`;
              const hasCustomAnim = field.animation && field.animation !== 'none';
              const ctaAnimClass = !submitting && hasCustomAnim ? getAnimationClass(field.animation) : '';
              const ctaInlineAnim = !submitting && !hasCustomAnim
                ? 'pulse 1.9s ease-in-out infinite, glow 1.9s ease-in-out infinite alternate'
                : undefined;
              return (
                <React.Fragment key={field.name}>
                  {hasCustomAnim && <style>{ANIMATION_CSS}</style>}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}@keyframes glow{from{box-shadow:0 0 5px ${ctaBgColor}60}to{box-shadow:0 0 20px ${ctaBgColor}90}}`}</style>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <button type="submit" disabled={submitting}
                      className={ctaAnimClass}
                      style={{
                        width: '100%', padding: '15px 20px',
                        borderRadius: ctaRadius,
                        border: ctaBorderW > 0 ? `${ctaBorderW}px solid ${ctaBorderColor}` : 'none',
                        backgroundColor: submitting ? '#9CA3AF' : ctaBgColor,
                        boxShadow: ctaShadow,
                        color: ctaTextColor, fontWeight: ctaFontWeight, fontSize: ctaFontSize,
                        fontStyle: ctaFontStyle, cursor: submitting ? 'not-allowed' : 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        transition: 'opacity 0.15s', fontFamily: 'inherit',
                        animation: submitting ? 'none' : ctaInlineAnim,
                        willChange: 'opacity, box-shadow',
                      }}>
                      {submitting ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...
                        </span>
                      ) : (
                        <>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {field.showIcon !== false && <CtaIcon size={17} />} {ctaLabel}
                          </span>
                          {field.subtext && (
                            <span style={{ fontSize: Math.max(10, ctaFontSize - 4), fontWeight: 500, opacity: 0.82 }}>
                              {field.subtext}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </React.Fragment>
              );
            }

            default:
              return null;
          }
        })}
      </form>
      </div>
    </div>
  );
};

export default EmbeddedOrderForm;
