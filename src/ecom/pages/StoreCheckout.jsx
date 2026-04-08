import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Loader2, User, Phone, MapPin, FileText, Truck, Package, ChevronDown } from 'lucide-react';
import { PHONE_CODES, getDefaultPhoneCode, buildFullPhone } from '../utils/phoneCodes.js';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';
import { setDocumentMeta } from '../utils/pageMeta';
import { injectPixelScripts, firePixelEvent } from '../utils/pixelTracking.js';

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

  const [store, setStore] = useState(null);
  const [pixels, setPixels] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // Determine delivery status based on country + city
  const deliveryStatus = useMemo(() => {
    if (!hasDeliveryConfig) {
      // No config → no restrictions
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
        message: `Nous ne livrons pas au/en ${country}.`,
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

  useEffect(() => {
    (async () => {
      try {
        const res = await publicStoreApi.getStore(subdomain);
        const data = res.data?.data || {};
        const storeData = data.store || data;
        setStore(storeData);
        setPhoneCode(getDefaultPhoneCode(storeData?.currency || storeData?.storeSettings?.storeCurrency));
        setPixels(data.pixels || null);
        // Inject pixels + fire InitiateCheckout
        if (data.pixels) {
          injectPixelScripts(data.pixels);
          const total = cartProducts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
          firePixelEvent('InitiateCheckout', {
            value: total,
            currency: data.store?.currency || 'XAF',
            num_items: cartProducts.length,
            content_ids: cartProducts.map(p => p._id || p.productId || ''),
          });
        }
      } catch {
        setError('Boutique introuvable');
      } finally {
        setLoading(false);
      }
    })();
  }, [subdomain]);

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
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
  const themeColor = store?.themeColor || '#0F6B4F';
  const currency = store?.currency || 'XAF';

  // Input focus ring using themeColor (CSS custom property approach)
  const [focusedField, setFocusedField] = useState(null);
  const inputStyle = (field) => ({
    outline: 'none',
    borderColor: focusedField === field ? themeColor : '',
    boxShadow: focusedField === field ? `0 0 0 2px ${themeColor}33` : '',
  });
  const inputProps = (field) => ({
    onFocus: () => setFocusedField(field),
    onBlur: () => setFocusedField(null),
    style: inputStyle(field),
  });

  const subtotal = cartProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const deliveryCost = deliveryStatus.cost || 0;
  const total = subtotal + deliveryCost;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim()) {
      setError('Nom et numéro de téléphone requis');
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
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: fullPhone,
        email: form.email.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        notes: form.notes.trim(),
        deliveryType: deliveryStatus.type === 'livraison' ? 'livraison' : deliveryStatus.type === 'expedition' ? 'expedition' : '',
        deliveryCost: deliveryCost,
        products: cartProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity
        })),
        channel: 'store'
      });

      const orderData = res.data?.data;
      setOrderResult(orderData);

      // Fire Purchase pixel event
      const orderTotal = orderData?.total ?? cartProducts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 1), 0);
      firePixelEvent('Purchase', {
        value: orderTotal,
        currency: store?.currency || 'XAF',
        content_ids: cartProducts.map(p => p._id || p.productId || ''),
        num_items: cartProducts.length,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
      </div>
    );
  }

  // Order confirmation screen
  if (orderResult) {
    const whatsappMsg = `Bonjour ! 👋\n\nJe viens de passer une commande sur votre boutique.\n\n📦 *Commande N° ${orderResult.orderNumber}*\n💰 *Montant : ${formatPrice(orderResult.total)} ${orderResult.currency}*\n\n👤 Nom : ${form.customerName}\n📞 Téléphone : ${form.phone}${form.country ? `\n🌍 Pays : ${form.country}` : ''}${form.city ? `\n📍 Ville : ${form.city}` : ''}${form.address ? `\nAdresse : ${form.address}` : ''}${form.notes ? `\n📝 Notes : ${form.notes}` : ''}${deliveryStatus.type === 'livraison' ? '\n🚚 Mode : Livraison (paiement à la réception)' : deliveryStatus.type === 'expedition' ? '\n📦 Mode : Expédition (paiement avant envoi)' : ''}\n\nMerci de confirmer ma commande ! 🙏`;

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
                    {formatPrice(orderResult.total)} {orderResult.currency}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Statut</span>
                  <span className="font-semibold" style={{ color: themeColor }}>En attente de confirmation</span>
                </div>
                {deliveryStatus.type === 'livraison' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Livraison</span>
                    <span className="text-emerald-600 font-medium">Paiement à la réception</span>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" style={{ color: themeColor }} />
            Finaliser la commande
          </h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">
        {/* Order summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Récapitulatif</h2>
          {cartProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              {p.image && (
                <img src={p.image} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-gray-100" loading="lazy" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                <p className="text-xs text-gray-500">x{p.quantity}</p>
              </div>
              <span className="text-sm font-bold text-gray-900">
                {formatPrice(p.price * p.quantity)} {currency}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-medium text-gray-900">{formatPrice(subtotal)} {currency}</span>
            </div>
            {deliveryCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Livraison</span>
                <span className="font-medium text-gray-900">{formatPrice(deliveryCost)} {currency}</span>
              </div>
            )}
            {deliveryStatus.type === 'expedition' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Expédition</span>
                <span className="text-xs text-amber-600 font-medium">À calculer</span>
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-sm font-semibold text-gray-900">Total</span>
              <span className="text-base font-bold" style={{ color: themeColor }}>
                {formatPrice(total)} {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* Checkout form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Vos informations</h2>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <User className="w-3.5 h-3.5" /> Nom complet *
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
              placeholder="Votre nom"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm transition-all"
              {...inputProps('customerName')}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-3.5 h-3.5" /> Téléphone (WhatsApp) *
            </label>
            <div className="flex gap-0">
              <div className="relative flex-shrink-0">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  className="appearance-none pl-2 pr-6 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-sm bg-gray-50 font-medium cursor-pointer"
                  style={{ minWidth: 85 }}
                >
                  {PHONE_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="6XX XXX XXX"
                required
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-r-lg text-sm transition-all"
                {...inputProps('phone')}
              />
            </div>
          </div>

          {/* Country selector — only if delivery countries are configured */}
          {hasDeliveryConfig && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-3.5 h-3.5" /> Pays *
              </label>
              <select
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white transition-all"
                {...inputProps('country')}
              >
                <option value="">Sélectionnez votre pays</option>
                {deliveryCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* Country blocked message */}
          {deliveryStatus.type === 'blocked' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {deliveryStatus.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-3.5 h-3.5" /> Ville {hasDeliveryConfig ? '*' : ''}
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Douala"
                required={hasDeliveryConfig}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm transition-all"
                {...inputProps('city')}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="optionnel"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm transition-all"
                {...inputProps('email')}
              />
            </div>
          </div>

          {/* Delivery status indicator */}
          {hasDeliveryConfig && form.country && form.city && deliveryStatus.type !== 'blocked' && deliveryStatus.type !== 'pending' && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              deliveryStatus.type === 'livraison'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border border-amber-200 text-amber-700'
            }`}>
              {deliveryStatus.type === 'livraison' ? (
                <Truck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <Package className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{deliveryStatus.type === 'livraison' ? 'Livraison' : 'Expédition'}</p>
                <p className="text-xs mt-0.5 opacity-80">{deliveryStatus.message}</p>
                {deliveryStatus.cost > 0 && (
                  <p className="text-xs font-bold mt-1">Frais : {formatPrice(deliveryStatus.cost)} {currency}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-3.5 h-3.5" /> Adresse de livraison
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Quartier, rue, repère..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm transition-all"
              {...inputProps('address')}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-3.5 h-3.5" /> Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Instructions de livraison, taille, couleur..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none transition-all"
              {...inputProps('notes')}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || (hasDeliveryConfig && !deliveryStatus.allowed)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            {submitting ? 'Traitement...' : `Passer la commande · ${formatPrice(total)} ${currency}`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default StoreCheckout;
