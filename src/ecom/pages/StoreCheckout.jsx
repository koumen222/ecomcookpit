import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Loader2, User, Phone, MapPin, FileText, Truck, Package, ChevronDown } from 'lucide-react';
import { PHONE_CODES, getDefaultPhoneCodeFromConfig, getPhoneCodeByCountryName, buildFullPhone } from '../utils/phoneCodes.js';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { setDocumentMeta } from '../utils/pageMeta';
import { createMetaEventId, injectPixelScripts, safeFirePixelEvent, trackStorefrontEvent } from '../utils/pixelTracking.js';
import { formatMoney } from '../utils/currency.js';
import { captureAffiliateAttributionFromSearch, getAffiliateAttribution } from '../utils/affiliateAttribution.js';
import {
  buildStorefrontOrderWhatsappMessage,
  findMatchingCountryOption,
  getCountryFormPlaceholders,
  resolveFormCountries,
  resolveOrderFormContext,
  resolveSelectedOrderCountry,
} from '../utils/storeCountryConfig.js';

// Cache sessionStorage SUPPRIMÉ — checkout lit toujours frais depuis l'API.
// (cf. useStoreData.js : on a eu trop de bugs "modif pas visible")
function _coRead(_key) { return null; }

const CO_SKEL_CSS = `
@keyframes _coskel { 0%{background-position:-200% center} 100%{background-position:200% center} }
.co-sk { background:linear-gradient(90deg,#efefef 25%,#e2e2e2 50%,#efefef 75%);background-size:200% 100%;animation:_coskel 1.4s ease infinite;border-radius:8px; }
`;

/**
 * Normalize a city name for fuzzy matching.
 * Removes accents, lowercases, trims, collapses spaces.
 */
const normalizeCity = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // keep only alphanumeric + spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if customerCity matches a delivery zone (city name or aliases).
 * Returns the matching zone or null.
 */
const findMatchingZone = (customerCity, zones) => {
  if (!customerCity || !zones?.length) return null;
  const normalized = normalizeCity(customerCity);
  if (!normalized) return null;

  for (const zone of zones) {
    // Check main city name
    if (normalizeCity(zone.city) === normalized) return zone;
    // Check aliases
    if (zone.aliases?.some(a => normalizeCity(a) === normalized)) return zone;
    // Fuzzy: check if normalized starts with or contains zone city
    const zoneNorm = normalizeCity(zone.city);
    if (zoneNorm && (normalized.includes(zoneNorm) || zoneNorm.includes(normalized))) return zone;
  }
  return null;
};

/**
 * StoreCheckout — Public guest checkout page.
 * Mobile-first, no account required (WhatsApp-first markets).
 * Collects: name, phone, address, city, optional notes.
 * Places order via public API and shows confirmation + WhatsApp link.
 */
const StoreCheckout = () => {
  const { subdomain: paramSubdomain } = useParams();
  const { subdomain: hostSubdomain, isStoreDomain } = useSubdomain();
  const subdomain = hostSubdomain || paramSubdomain;
  const navigate = useNavigate();
  const location = useLocation();

  // Build store-relative paths (subdomain: /path, root: /store/sub/path)
  const storePath = (path) => isStoreDomain ? path : `/store/${subdomain}${path}`;

  const _coCacheKey = subdomain ? `sf_${subdomain}` : null;
  const _coCache = _coCacheKey ? _coRead(_coCacheKey) : null;

  const [store, setStore] = useState(_coCache?.store || null);
  const [pixels, setPixels] = useState(_coCache?.pixels || null);
  const [loading, setLoading] = useState(!_coCache?.store);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState(null);

  // Products passed from product page via location state
  const cartProducts = location.state?.products || [];

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    notes: ''
  });
  const [phoneCode, setPhoneCode] = useState('+237');

  // Delivery zones data from store
  const deliveryCountries = store?.deliveryCountries || [];
  const deliveryZones = store?.deliveryZones || [];
  const hasDeliveryConfig = deliveryCountries.length > 0;

  // Flat shipping fee from store config
  const flatShippingEnabled = store?.flatShippingEnabled === true;
  const flatShippingFee = Math.max(0, Number(store?.flatShippingFee) || 0);
  const freeShippingThreshold = Math.max(0, Number(store?.freeShippingThreshold) || 0);

  // Determine delivery status based on country + city
  const deliveryStatus = useMemo(() => {
    if (!hasDeliveryConfig) {
      // No per-zone config → no restrictions
      return { type: 'none', message: '', allowed: true, cost: 0 };
    }

    const country = form.country.trim();
    const city = form.city.trim();

    // No country selected yet
    if (!country) {
      return { type: 'pending', message: '', allowed: false, cost: 0 };
    }

    // Country not in the list
    if (!deliveryCountries.some(c => c.toLowerCase() === country.toLowerCase())) {
      return {
        type: 'blocked',
        message: `Nous ne livrons pas encore au ${country}.`,
        allowed: false,
        cost: 0
      };
    }

    // Country OK — check city
    const countryZones = deliveryZones.filter(z => z.country.toLowerCase() === country.toLowerCase());

    if (countryZones.length === 0) {
      // Country defined but no zones → all cities in this country get expedition
      return {
        type: 'expedition',
        message: 'Expédition disponible — paiement requis avant envoi.',
        allowed: true,
        cost: 0
      };
    }

    if (!city) {
      return { type: 'pending', message: 'Entrez votre ville pour voir les options de livraison.', allowed: false, cost: 0 };
    }

    // Try to match city to a zone
    const matchedZone = findMatchingZone(city, countryZones);

    if (matchedZone) {
      return {
        type: 'livraison',
        message: `Livraison disponible à ${matchedZone.city} — paiement à la réception.`,
        allowed: true,
        cost: matchedZone.cost || 0,
        zone: matchedZone
      };
    }

    // City not in any zone → expedition
    return {
      type: 'expedition',
      message: `${city} est hors zone de livraison — expédition avec paiement avant envoi.`,
      allowed: true,
      cost: 0
    };
  }, [form.country, form.city, hasDeliveryConfig, deliveryCountries, deliveryZones]);

  const cityOptions = useMemo(() => {
    if (!hasDeliveryConfig || !form.country) return [];
    const countryZones = deliveryZones.filter(z => z.country.toLowerCase() === form.country.trim().toLowerCase());
    return [...new Set(countryZones.map(z => z.city).filter(Boolean))];
  }, [hasDeliveryConfig, form.country, deliveryZones]);

  useEffect(() => {
    captureAffiliateAttributionFromSearch(location.search);
  }, [location.search]);

  const _pixelsFiredRef = useRef(false);

  useEffect(() => {
    if (!subdomain) return;
    const hasCached = !!(_coCacheKey ? _coRead(_coCacheKey) : null);

    const fireCheckoutPixels = (pixelsData, storeData) => {
      if (_pixelsFiredRef.current) return;
      _pixelsFiredRef.current = true;
      const total = cartProducts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
      const cartCurrs = [...new Set(cartProducts.map((p) => String(p.currency || '').trim().toUpperCase()).filter(Boolean))];
      const checkoutCur = cartCurrs.length === 1 ? cartCurrs[0] : (storeData?.currency || 'XAF');
      trackStorefrontEvent({
        subdomain,
        pixels: pixelsData,
        eventName: 'InitiateCheckout',
        params: {
          value: total,
          currency: checkoutCur,
          num_items: cartProducts.length,
          content_ids: cartProducts.map(p => p._id || p.productId || ''),
        },
      });
    };

    // If we have cached store, fire pixels immediately and set phone code
    if (hasCached && store) {
      const ppc = store?.productPageConfig;
      const storeCountries = resolveFormCountries(ppc?.general?.countries, store?.country || store?.storeCountry || '');
      const cartCurrs = [...new Set(cartProducts.map((p) => String(p.currency || '').trim().toUpperCase()).filter(Boolean))];
      const checkoutCur = cartCurrs.length === 1 ? cartCurrs[0] : (store?.currency || 'XAF');
      setPhoneCode(getDefaultPhoneCodeFromConfig(storeCountries, checkoutCur));
      if (pixels) fireCheckoutPixels(pixels, store);
    }

    (async () => {
      try {
        const res = await publicStoreApi.getStore(subdomain);
        const data = res.data?.data || {};
        const storeData = data.store || data;
        setStore(storeData);
        const ppc = storeData?.productPageConfig;
        const storeCountries = resolveFormCountries(ppc?.general?.countries, storeData?.country || storeData?.storeCountry || '');
        const cartCurrs = [...new Set(cartProducts.map((p) => String(p.currency || '').trim().toUpperCase()).filter(Boolean))];
        const checkoutCur = cartCurrs.length === 1 ? cartCurrs[0] : (storeData?.currency || storeData?.storeSettings?.storeCurrency || 'XAF');
        setPhoneCode(getDefaultPhoneCodeFromConfig(storeCountries, checkoutCur));
        setPixels(data.pixels || null);
        if (data.pixels) fireCheckoutPixels(data.pixels, storeData);
      } catch {
        if (!hasCached) setError('Boutique introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [subdomain]);

  const orderFormContext = useMemo(
    () => resolveOrderFormContext({ store, generalConfig: store?.productPageConfig?.general || {} }),
    [store]
  );
  const preferredCheckoutCountry = useMemo(() => {
    if (hasDeliveryConfig) {
      const storeCountryMatch = findMatchingCountryOption(orderFormContext.storeCountry, deliveryCountries);
      if (storeCountryMatch) return storeCountryMatch;

      const configCountryMatch = orderFormContext.countries
        .map((country) => findMatchingCountryOption(country, deliveryCountries))
        .find(Boolean);
      if (configCountryMatch) return configCountryMatch;

      if (deliveryCountries.length === 1) return deliveryCountries[0];
      return '';
    }

    return orderFormContext.primaryCountry;
  }, [hasDeliveryConfig, orderFormContext.storeCountry, orderFormContext.countries, orderFormContext.primaryCountry, deliveryCountries]);
  const resolvedOrderCountry = resolveSelectedOrderCountry({
    explicitCountry: form.country,
    configuredCountries: orderFormContext.countries,
    storeCountry: orderFormContext.storeCountry,
  });
  const activePlaceholders = getCountryFormPlaceholders(form.country || preferredCheckoutCountry || orderFormContext.primaryCountry);

  useEffect(() => {
    const defaultCountry = preferredCheckoutCountry || orderFormContext.primaryCountry;
    if (!defaultCountry) return;

    setForm((prev) => {
      if (String(prev.country || '').trim()) return prev;
      return { ...prev, country: defaultCountry };
    });
  }, [preferredCheckoutCountry, orderFormContext.primaryCountry]);

  useEffect(() => {
    const nextPhoneCode = getPhoneCodeByCountryName(form.country || preferredCheckoutCountry || orderFormContext.primaryCountry);
    if (nextPhoneCode && nextPhoneCode !== phoneCode) {
      setPhoneCode(nextPhoneCode);
    }
  }, [form.country, preferredCheckoutCountry, orderFormContext.primaryCountry, phoneCode]);

  // Redirect if no products
  useEffect(() => {
    if (!loading && cartProducts.length === 0) {
      navigate(storePath('/'), { replace: true });
    }
  }, [loading, cartProducts, navigate, subdomain]);

  useEffect(() => {
    if (!store?.name) return;
    const visual = store.logo || store.banner || '/icon.png';
    setDocumentMeta({
      title: orderResult?.orderNumber ? `Commande confirmée — ${store.name}` : `Finaliser la commande — ${store.name}`,
      description: orderResult?.orderNumber
        ? `Votre commande ${orderResult.orderNumber} a bien été enregistrée chez ${store.name}.`
        : `Finalisez votre commande sur la boutique ${store.name}.`,
      image: visual,
      icon: visual,
      siteName: store.name,
      appTitle: store.name,
      type: 'website',
    });
  }, [store, orderResult]);

  const handleChange = (field, value) => {
    const sanitized = field === 'phone' ? value.replace(/[^0-9\s\-+()]/g, '') : value;
    setForm(prev => ({ ...prev, [field]: sanitized }));
    setError('');
  };

  const formatPrice = (price, cur) => formatMoney(price, cur);
  const themeColor = store?.themeColor || '#0F6B4F';
  const cartCurrencies = [...new Set(cartProducts.map((p) => String(p.currency || '').trim().toUpperCase()).filter(Boolean))];
  const currency = cartCurrencies.length === 1 ? cartCurrencies[0] : (store?.currency || 'XAF');

  // ── Design config from form builder ──────────────────────────────────────
  const fd = store?.productPageConfig?.design || {};
  const formBgColor       = fd.formBgColor       || '#ffffff';
  const formBorderColor   = fd.formBorderColor   || '#e5e7eb';
  const formBorderWidth   = fd.formBorderWidth   || '1px';
  const formBorderRadius  = fd.formBorderRadius  || '12px';
  const formShadowVal     = parseInt(fd.formShadow) || 0;
  const formShadow        = formShadowVal > 0
    ? `0 ${formShadowVal}px ${formShadowVal * 2}px rgba(0,0,0,${Math.min(formShadowVal * 0.02, 0.3).toFixed(2)})`
    : 'none';
  const formTextColor     = fd.formTextColor     || '#1F2937';
  const formFontSize      = fd.fontSize          ? parseInt(fd.fontSize)   : 14;
  const formBold          = fd.formBold          || false;
  const formItalic        = fd.formItalic        || false;
  const labelAlign        = fd.labelAlign        || 'left';
  const fieldBgColor      = fd.fieldBgColor      || '#ffffff';
  const fieldTextColor    = fd.fieldTextColor    || '#1F2937';
  const fieldIconColor    = fd.fieldIconColor    || '#9b9b9b';
  const fieldIconBg       = fd.fieldIconBg       || '#f3f4f6';
  const btnColor          = fd.formButtonColor   || themeColor;
  const inputRadius       = fd.formInputRadius   || formBorderRadius;

  const formContainerStyle = {
    backgroundColor: formBgColor,
    border: `${formBorderWidth} solid ${formBorderColor}`,
    borderRadius: formBorderRadius,
    boxShadow: formShadow,
    color: formTextColor,
    fontSize: formFontSize,
    fontWeight: formBold ? 700 : 400,
    fontStyle: formItalic ? 'italic' : 'normal',
  };

  const labelStyle = { textAlign: labelAlign, color: formTextColor };

  const fieldStyle = {
    backgroundColor: fieldBgColor,
    color: fieldTextColor,
    borderColor: formBorderColor,
    borderRadius: inputRadius,
    fontSize: formFontSize,
  };

  // Input focus ring
  const [focusedField, setFocusedField] = useState(null);
  const inputStyle = (field) => ({
    ...fieldStyle,
    outline: 'none',
    borderColor: focusedField === field ? btnColor : formBorderColor,
    boxShadow: focusedField === field ? `0 0 0 2px ${btnColor}33` : 'none',
  });
  const inputProps = (field) => ({
    onFocus: () => setFocusedField(field),
    onBlur: () => setFocusedField(null),
    style: inputStyle(field),
  });

  const subtotal = cartProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  // Zone cost takes priority; flat fee is the fallback when no per-zone cost applies
  const zoneCost = deliveryStatus.cost || 0;
  const flatCostApplies = flatShippingEnabled && flatShippingFee > 0 && zoneCost === 0;
  const flatCostEffective = flatCostApplies
    ? (freeShippingThreshold > 0 && subtotal >= freeShippingThreshold ? 0 : flatShippingFee)
    : 0;
  const deliveryCost = zoneCost > 0 ? zoneCost : flatCostEffective;
  const total = subtotal + deliveryCost;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim()) {
      setError('Nom et numéro de téléphone requis');
      return;
    }
    const phoneDigits = form.phone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError('Numéro de téléphone invalide (7-15 chiffres)');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      setError('Adresse e-mail invalide');
      return;
    }

    // Validate delivery zone
    if (hasDeliveryConfig && !deliveryStatus.allowed) {
      if (deliveryStatus.type === 'blocked') {
        setError(deliveryStatus.message);
      } else {
        setError('Veuillez remplir le pays et la ville pour continuer.');
      }
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const fullPhone = buildFullPhone(phoneCode, form.phone);
      const purchaseEventId = createMetaEventId('purchase');
      const affiliateAttribution = getAffiliateAttribution();
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: fullPhone,
        phoneCode: phoneCode,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: resolvedOrderCountry,
        notes: form.notes.trim(),
        deliveryType: deliveryStatus.type === 'livraison' ? 'livraison' : deliveryStatus.type === 'expedition' ? 'expedition' : '',
        deliveryCost: deliveryCost,
        products: cartProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity
        })),
        channel: 'store',
        metaEventId: purchaseEventId,
        metaSourceUrl: typeof window !== 'undefined' ? window.location.href : '',
        affiliateCode: affiliateAttribution?.affiliateCode || '',
        affiliateLinkCode: affiliateAttribution?.affiliateLinkCode || '',
      });

      const orderData = res.data?.data;
      setOrderResult(orderData);

      // Fire Purchase pixel event — ensure scripts are loaded first
      const orderTotal = orderData?.total ?? cartProducts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
      safeFirePixelEvent(pixels, 'Purchase', {
        value: orderTotal,
        currency,
        content_ids: cartProducts.map(p => p._id || p.productId || ''),
        num_items: cartProducts.length,
        eventId: purchaseEventId,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f8f9fb' }}>
        <style>{CO_SKEL_CSS}</style>
        {/* Header skeleton */}
        <div className="bg-white sticky top-0 z-40 px-4 py-3" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.07)' }}>
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="co-sk w-8 h-8 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="co-sk h-3.5 w-36" />
              <div className="co-sk h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-3">
          {/* Order summary card skeleton */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div className="co-sk h-1" style={{ borderRadius: 0 }} />
            <div className="p-4 space-y-3">
              <div className="co-sk h-4 w-32" />
              {[...Array(2)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="co-sk w-11 h-11 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="co-sk h-3.5 w-3/4" />
                    <div className="co-sk h-3 w-1/4" />
                  </div>
                  <div className="co-sk h-4 w-16 flex-shrink-0" />
                </div>
              ))}
              <div className="pt-2 space-y-2" style={{ borderTop: '1px dashed #e5e7eb' }}>
                <div className="flex justify-between"><div className="co-sk h-3 w-20" /><div className="co-sk h-3 w-16" /></div>
                <div className="flex justify-between items-center pt-1"><div className="co-sk h-4 w-24" /><div className="co-sk h-5 w-20" /></div>
              </div>
            </div>
          </div>
          {/* Form skeleton */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div className="co-sk h-1" style={{ borderRadius: 0 }} />
            <div className="p-4 space-y-4">
              <div className="co-sk h-4 w-48" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="co-sk h-3 w-28" />
                  <div className="co-sk h-11 rounded-xl" />
                </div>
              ))}
              <div className="co-sk h-12 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Order confirmation screen
  if (orderResult) {
    const displayPhone = buildFullPhone(phoneCode, form.phone);
    const whatsappMsg = buildStorefrontOrderWhatsappMessage({
      storeName: store?.name || '',
      orderNumber: orderResult.orderNumber,
      totalLabel: formatPrice(orderResult.total, orderResult.currency),
      customerName: form.customerName,
      displayPhone,
      country: resolvedOrderCountry,
      city: form.city,
      address: form.address,
      notes: form.notes,
      deliveryType: deliveryStatus.type,
    });

    const storeWhatsapp = (store?.whatsapp || store?.phone || '').replace(/[^0-9+]/g, '');
    const whatsappLink = storeWhatsapp
      ? `https://wa.me/${storeWhatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(whatsappMsg)}`
      : null;

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${themeColor}08 0%, ${themeColor}15 100%)` }}>
        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
          }
          @keyframes pop-in {
            0% { transform: scale(0.5); opacity: 0; }
            70% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes slide-up {
            0% { transform: translateY(20px); opacity: 0; }
            100% { transform: translateY(0); opacity: 1; }
          }
          @keyframes wa-pulse {
            0%, 100% { box-shadow: 0 0 0 0 #25D36655; }
            50% { box-shadow: 0 0 0 10px #25D36600; }
          }
          .pop-in { animation: pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          .slide-up-1 { animation: slide-up 0.4s ease forwards 0.2s; opacity: 0; }
          .slide-up-2 { animation: slide-up 0.4s ease forwards 0.35s; opacity: 0; }
          .slide-up-3 { animation: slide-up 0.4s ease forwards 0.5s; opacity: 0; }
          .wa-pulse { animation: wa-pulse 2s ease-in-out infinite; }
          .confetti { position: absolute; width: 8px; height: 8px; border-radius: 2px; animation: confetti-fall 1.2s ease-out forwards; }
        `}</style>

        <div className="max-w-md w-full relative">
          {/* Confetti particles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${8 + i * 8}%`,
                top: '0',
                backgroundColor: [themeColor, '#25D366', '#FFD700', '#FF6B6B', '#4ECDC4'][i % 5],
                animationDelay: `${i * 0.08}s`,
                animationDuration: `${0.9 + (i % 3) * 0.2}s`,
              }}
            />
          ))}

          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Top colored banner */}
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${themeColor}, #25D366)` }} />

            <div className="p-6 text-center space-y-5">
              {/* Animated success icon */}
              <div className="pop-in mx-auto w-20 h-20 rounded-full flex items-center justify-center relative" style={{ backgroundColor: themeColor + '18' }}>
                <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${themeColor}30 0%, transparent 70%)` }} />
                <CheckCircle className="w-10 h-10 relative z-10" style={{ color: themeColor }} />
              </div>

              {/* Thank you message */}
              <div className="slide-up-1">
                <h1 className="text-2xl font-extrabold text-gray-900">Merci {form.customerName.split(' ')[0]} !</h1>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                  Votre commande a été enregistrée avec succès.<br/>
                  Confirmez-la sur WhatsApp pour accélérer le traitement.
                </p>
              </div>

              {/* Order recap */}
              <div className="slide-up-2 rounded-2xl p-4 space-y-2 text-left" style={{ backgroundColor: themeColor + '08', border: `1px solid ${themeColor}25` }}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">N° commande</span>
                  <span className="font-bold text-gray-900">{orderResult.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-lg" style={{ color: themeColor }}>
                    {formatPrice(orderResult.total, orderResult.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Statut</span>
                  <span className="font-semibold" style={{ color: themeColor }}>En attente de confirmation</span>
                </div>
                {deliveryStatus.type === 'livraison' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Livraison</span>
                    <span className="text-primary-600 font-medium">Paiement à la réception</span>
                  </div>
                )}
                {deliveryStatus.type === 'expedition' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mode</span>
                    <span className="text-amber-600 font-medium">Paiement avant envoi</span>
                  </div>
                )}
              </div>

              {/* WhatsApp CTA — main action */}
              <div className="slide-up-3 space-y-3">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wa-pulse w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-white font-bold text-base transition-all active:scale-95"
                    style={{ backgroundColor: '#25D366' }}
                  >
                    <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>Confirmer sur WhatsApp</span>
                  </a>
                ) : (
                  <p className="text-xs text-gray-400 text-center">Nous vous contacterons bientôt.</p>
                )}

                <button
                  onClick={() => navigate(storePath('/'))}
                  className="w-full px-4 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition"
                >
                  Continuer les achats
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8f9fb' }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up { animation: fadeInUp 0.35s ease forwards; }
        .fade-in-up-2 { animation: fadeInUp 0.35s ease forwards 0.08s; opacity: 0; }
        .fade-in-up-3 { animation: fadeInUp 0.35s ease forwards 0.16s; opacity: 0; }
        .checkout-input:focus { outline: none; }
        .field-row { position: relative; }
        .field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          z-index: 1;
        }
        .field-icon-top {
          position: absolute;
          left: 12px;
          top: 14px;
          pointer-events: none;
          z-index: 1;
        }
        .has-icon input, .has-icon select, .has-icon textarea {
          padding-left: 36px !important;
        }
        .has-icon-textarea textarea {
          padding-left: 36px !important;
        }
        .submit-btn:not(:disabled):hover { filter: brightness(1.06); }
        .submit-btn:not(:disabled):active { transform: scale(0.985); }
      `}</style>

      {/* Header */}
      <header className="bg-white sticky top-0 z-40 px-4 py-3" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.07)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">Finaliser la commande</h1>
            {store?.name && <p className="text-xs text-gray-400 truncate">{store.name}</p>}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: btnColor + '15', color: btnColor }}>
            <Package className="w-3 h-3" />
            <span>COD</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-3">

        {/* Order summary card */}
        <div className="fade-in-up bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {/* Colored top bar */}
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${btnColor}, ${btnColor}99)` }} />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" style={{ color: btnColor }} />
                Récapitulatif
              </h2>
              <span className="text-xs text-gray-400">{cartProducts.length} article{cartProducts.length > 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2.5">
              {cartProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" style={{ border: `1px solid ${formBorderColor}` }} loading="lazy" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: btnColor + '15' }}>
                      <Package className="w-5 h-5" style={{ color: btnColor }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">Qté : {p.quantity}</p>
                  </div>
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: formTextColor }}>
                    {formatPrice(p.price * p.quantity, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2.5 space-y-1.5" style={{ borderTop: `1px dashed ${formBorderColor}` }}>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Sous-total</span>
                <span className="font-medium">{formatPrice(subtotal, currency)}</span>
              </div>
              {deliveryCost > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Frais de livraison
                  </span>
                  <span className="font-medium text-primary-600">{formatPrice(deliveryCost, currency)}</span>
                </div>
              )}
              {/* Free shipping indicator */}
              {flatShippingEnabled && flatShippingFee > 0 && freeShippingThreshold > 0 && subtotal < freeShippingThreshold && (
                <div className="text-[10px] text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg">
                  Plus que <strong>{formatPrice(freeShippingThreshold - subtotal, currency)}</strong> pour la livraison gratuite !
                </div>
              )}
              {flatShippingEnabled && flatShippingFee > 0 && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold && deliveryCost === 0 && (
                <div className="flex justify-between text-xs text-green-600 bg-green-50 px-2.5 py-1.5 rounded-lg">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Livraison gratuite
                  </span>
                  <span className="font-bold">0 {currency}</span>
                </div>
              )}
              {deliveryStatus.type === 'expedition' && deliveryCost === 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Expédition</span>
                  <span className="font-medium text-amber-600">À calculer</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5" style={{ borderTop: `1px solid ${formBorderColor}` }}>
                <span className="text-sm font-bold text-gray-800">Total à payer</span>
                <span className="text-lg font-extrabold" style={{ color: btnColor }}>
                  {formatPrice(total, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* COD badge */}
          <div className="mx-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Paiement à la livraison — Payez en recevant votre colis
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Checkout form */}
        <form onSubmit={handleSubmit} className="fade-in-up-2 bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${btnColor}60, ${btnColor}20)` }} />
          <div className="p-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" style={{ color: btnColor }} />
              Vos informations de livraison
            </h2>

            {/* Nom */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nom complet *</label>
              <div className="field-row has-icon">
                <span className="field-icon"><User className="w-3.5 h-3.5" style={{ color: fieldIconColor }} /></span>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => handleChange('customerName', e.target.value)}
                  placeholder="Votre nom et prénom"
                  required
                  className="checkout-input w-full py-3 border text-sm font-medium transition-all"
                  style={{ ...inputStyle('customerName'), borderRadius: '12px' }}
                  onFocus={() => setFocusedField('customerName')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Téléphone WhatsApp *</label>
              <div className="flex gap-0">
                <div className="relative flex-shrink-0">
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    className="checkout-input appearance-none pl-3 pr-7 py-3 border border-r-0 text-sm font-semibold cursor-pointer transition-all"
                    style={{ ...fieldStyle, minWidth: 90, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}
                  >
                    {PHONE_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: fieldIconColor }} />
                </div>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={activePlaceholders.phone}
                  required
                  className="checkout-input flex-1 min-w-0 px-3 py-3 border text-sm font-medium transition-all"
                  style={{ ...inputStyle('phone'), borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Pays */}
            {hasDeliveryConfig && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pays *</label>
                <div className="field-row has-icon">
                  <span className="field-icon"><MapPin className="w-3.5 h-3.5" style={{ color: fieldIconColor }} /></span>
                  <select
                    value={form.country}
                    onChange={(e) => handleChange('country', e.target.value)}
                    required
                    className="checkout-input w-full py-3 border text-sm font-medium transition-all appearance-none"
                    style={{ ...inputStyle('country'), borderRadius: '12px', paddingRight: '32px' }}
                    onFocus={() => setFocusedField('country')}
                    onBlur={() => setFocusedField(null)}
                  >
                    <option value="">Sélectionnez votre pays</option>
                    {deliveryCountries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: fieldIconColor }} />
                </div>
              </div>
            )}

            {/* Blocked */}
            {deliveryStatus.type === 'blocked' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {deliveryStatus.message}
              </div>
            )}

            {/* Ville + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ville {hasDeliveryConfig ? '*' : ''}</label>
                <div className="field-row has-icon">
                  <span className="field-icon"><MapPin className="w-3.5 h-3.5" style={{ color: fieldIconColor }} /></span>
                  {cityOptions.length > 0 ? (
                    <div className="relative w-full">
                      <select
                        value={form.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        required={hasDeliveryConfig}
                        className="checkout-input w-full py-3 border text-sm font-medium transition-all appearance-none"
                        style={{ ...inputStyle('city'), borderRadius: '12px', paddingRight: '32px' }}
                        onFocus={() => setFocusedField('city')}
                        onBlur={() => setFocusedField(null)}
                      >
                        <option value="">{activePlaceholders.city || 'Sélectionnez votre ville'}</option>
                        {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: fieldIconColor }} />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder={activePlaceholders.city}
                      required={hasDeliveryConfig}
                      className="checkout-input w-full py-3 border text-sm font-medium transition-all"
                      style={{ ...inputStyle('city'), borderRadius: '12px' }}
                      onFocus={() => setFocusedField('city')}
                      onBlur={() => setFocusedField(null)}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="optionnel"
                  className="checkout-input w-full px-3 py-3 border text-sm font-medium transition-all"
                  style={{ ...inputStyle('email'), borderRadius: '12px' }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Delivery status indicator */}
            {hasDeliveryConfig && form.country && form.city && deliveryStatus.type !== 'blocked' && deliveryStatus.type !== 'pending' && (
              <div className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${
                deliveryStatus.type === 'livraison'
                  ? 'bg-primary-50 border border-primary-200 text-primary-700'
                  : 'bg-amber-50 border border-amber-200 text-amber-700'
              }`}>
                {deliveryStatus.type === 'livraison' ? (
                  <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <Package className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-xs">{deliveryStatus.type === 'livraison' ? 'Livraison disponible' : 'Expédition'}</p>
                  <p className="text-xs mt-0.5 opacity-80">{deliveryStatus.message}</p>
                  {deliveryStatus.cost > 0 && (
                    <p className="text-xs font-bold mt-1">Frais : {formatPrice(deliveryStatus.cost, currency)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Adresse */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adresse de livraison</label>
              <div className="field-row has-icon">
                <span className="field-icon"><MapPin className="w-3.5 h-3.5" style={{ color: fieldIconColor }} /></span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder={activePlaceholders.address}
                  className="checkout-input w-full py-3 border text-sm font-medium transition-all"
                  style={{ ...inputStyle('address'), borderRadius: '12px' }}
                  onFocus={() => setFocusedField('address')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Instructions / Notes</label>
              <div className="field-row has-icon-textarea relative">
                <span className="field-icon-top"><FileText className="w-3.5 h-3.5" style={{ color: fieldIconColor }} /></span>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Taille, couleur, instructions de livraison..."
                  rows={2}
                  className="checkout-input w-full pl-9 pr-3 py-3 border text-sm font-medium resize-none transition-all"
                  style={{ ...inputStyle('notes'), borderRadius: '12px' }}
                  onFocus={() => setFocusedField('notes')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || (hasDeliveryConfig && !deliveryStatus.allowed)}
              className="submit-btn w-full inline-flex items-center justify-center gap-2.5 px-4 py-3.5 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: submitting || (hasDeliveryConfig && !deliveryStatus.allowed)
                  ? '#9ca3af'
                  : `linear-gradient(135deg, ${btnColor} 0%, ${btnColor}cc 100%)`,
                borderRadius: '14px',
                boxShadow: submitting || (hasDeliveryConfig && !deliveryStatus.allowed) ? 'none' : `0 4px 15px ${btnColor}40`,
              }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              <span>
                {submitting ? 'Traitement en cours...' : `Commander · ${formatPrice(total, currency)}`}
              </span>
            </button>

            <p className="text-center text-xs text-gray-400">
              En commandant, vous acceptez d'être contacté pour confirmer votre livraison
            </p>
          </div>
        </form>

        {/* Trust row */}
        <div className="fade-in-up-3 grid grid-cols-3 gap-2">
          {[
            { icon: '🔒', label: 'Paiement sécurisé' },
            { icon: '📦', label: 'Livraison rapide' },
            { icon: '✅', label: 'Satisfaction garantie' },
          ].map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-2.5 text-center" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <div className="text-lg mb-0.5">{t.icon}</div>
              <p className="text-xs text-gray-500 leading-tight">{t.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StoreCheckout;
