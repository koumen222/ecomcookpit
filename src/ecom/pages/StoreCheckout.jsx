import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, CheckCircle, AlertCircle, Loader2, MessageCircle, User, Phone, MapPin, FileText } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { useSubdomain } from '../hooks/useSubdomain.js';

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
    notes: ''
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await publicStoreApi.getStore(subdomain);
        setStore(res.data?.data);
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

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
  const themeColor = store?.themeColor || '#0F6B4F';
  const currency = store?.currency || 'XAF';

  const total = cartProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim()) {
      setError('Nom et numéro de téléphone requis');
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
        notes: form.notes.trim(),
        products: cartProducts.map(p => ({
          productId: p.productId,
          quantity: p.quantity
        })),
        channel: 'store'
      });

      setOrderResult(res.data?.data);
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
    const whatsappMsg = `Bonjour, j'ai passé la commande *${orderResult.orderNumber}* d'un montant de ${formatPrice(orderResult.total)} ${orderResult.currency}.\n\nNom: ${form.customerName}\nTéléphone: ${form.phone}${form.city ? `\nVille: ${form.city}` : ''}${form.address ? `\nAdresse: ${form.address}` : ''}`;

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
              <span className="text-amber-600 font-medium">En attente</span>
            </div>
          </div>

          <div className="space-y-3">
            {store?.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-xl font-medium text-sm hover:bg-green-600 transition"
              >
                <MessageCircle className="w-4 h-4" />
                Confirmer via WhatsApp
              </a>
            )}

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
          <div className="pt-2 border-t border-gray-100 flex justify-between">
            <span className="text-sm font-semibold text-gray-900">Total</span>
            <span className="text-base font-bold" style={{ color: themeColor }}>
              {formatPrice(total)} {currency}
            </span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-3.5 h-3.5" /> Ville
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="Douala"
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
            disabled={submitting}
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
