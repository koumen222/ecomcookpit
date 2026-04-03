import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Loader2, User, Phone, MapPin, FileText, Truck, Package } from 'lucide-react';
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
        setStore(data.store || data);
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
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
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
    const whatsappMsg = `Bonjour, j'ai passé la commande *${orderResult.orderNumber}* d'un montant de ${formatPrice(orderResult.total)} ${orderResult.currency}.\n\nNom: ${form.customerName}\nTéléphone: ${form.phone}${form.country ? `\nPays: ${form.country}` : ''}${form.city ? `\nVille: ${form.city}` : ''}${form.address ? `\nAdresse: ${form.address}` : ''}${deliveryStatus.type === 'livraison' ? '\nMode: Livraison (paiement à la réception)' : deliveryStatus.type === 'expedition' ? '\nMode: Expédition (paiement avant envoi)' : ''}`;

    const storeWhatsapp = (store?.whatsapp || store?.phone || '').replace(/[^0-9+]/g, '');
    const whatsappLink = storeWhatsapp
      ? `https://wa.me/${storeWhatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(whatsappMsg)}`
      : null;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: themeColor + '15' }}>
            <CheckCircle className="w-8 h-8" style={{ color: themeColor }} />
          </div>

          <div>
            <h1 className="text-xl font-bold text-gray-900">Commande confirmée !</h1>
            <p className="text-sm text-gray-500 mt-1">Merci pour votre commande</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">N° commande</span>
              <span className="font-bold text-gray-900">{orderResult.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-bold" style={{ color: themeColor }}>
                {formatPrice(orderResult.total)} {orderResult.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Statut</span>
              <span className="text-amber-600 font-medium">En attente de confirmation</span>
            </div>
            {deliveryStatus.type === 'livraison' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Mode</span>
                <span className="text-emerald-600 font-medium">Livraison (paiement à la réception)</span>
              </div>
            )}
            {deliveryStatus.type === 'expedition' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Mode</span>
                <span className="text-amber-600 font-medium">Expédition (paiement avant envoi)</span>
              </div>
            )}
          </div>

          {whatsappLink && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-green-800 font-medium">
                Confirmez votre commande sur WhatsApp pour un traitement rapide
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl font-bold text-sm transition shadow-md"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Confirmer sur WhatsApp
              </a>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => navigate(storePath('/'))}
              className="w-full px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
            >
              Continuer les achats
            </button>
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
              <Phone className="w-3.5 h-3.5" /> Téléphone (WhatsApp) *
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+237 6XX XXX XXX"
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                style={{ '--tw-ring-color': themeColor }}
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
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': themeColor }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="optionnel"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': themeColor }}
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
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
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
              style={{ '--tw-ring-color': themeColor }}
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
