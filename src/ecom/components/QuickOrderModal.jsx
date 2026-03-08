import React, { useState } from 'react';
import { X, ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';

/**
 * QuickOrderModal - Modal de commande rapide
 * S'ouvre directement depuis la page produit
 * Collecte: nom, téléphone, ville, lieu de livraison
 */
const QuickOrderModal = ({ isOpen, onClose, product, quantity, subdomain, store }) => {
  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    city: '',
    address: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  // Utiliser la couleur primaire du store (celle configurée dans les paramètres)
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--s-primary').trim() || store?.primaryColor || '#0066CC';
  const currency = product?.currency || store?.storeSettings?.storeCurrency || 'XAF';

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price);
  const total = product?.price * quantity || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customerName.trim() || !form.phone.trim()) {
      setError('Nom et numéro de téléphone requis');
      return;
    }

    if (!form.city.trim() || !form.address.trim()) {
      setError('Ville et lieu de livraison requis');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        email: '',
        address: form.address.trim(),
        city: form.city.trim(),
        notes: '',
        products: [{
          productId: product._id,
          quantity: quantity
        }],
        channel: 'store'
      });

      setOrderResult(res.data?.data);
      setSuccess(true);
    } catch (err) {
      console.error('Erreur commande:', err);
      setError(err.response?.data?.message || 'Erreur lors de la commande. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ customerName: '', phone: '', city: '', address: '' });
    setError('');
    setSuccess(false);
    setOrderResult(null);
    onClose();
  };

  if (!isOpen) return null;

  // Écran de succès
  if (success && orderResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: themeColor + '15' }}>
            <CheckCircle className="w-8 h-8" style={{ color: themeColor }} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900">Commande confirmée !</h2>
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

          <button
            onClick={handleClose}
            className="w-full px-4 py-3 text-white rounded-xl font-medium text-sm transition hover:opacity-90"
            style={{ backgroundColor: themeColor }}
          >
            Continuer les achats
          </button>
        </div>
      </div>
    );
  }

  // Formulaire de commande
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" style={{ color: themeColor }} />
            Finaliser la commande
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Récapitulatif produit */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {product?.images?.[0]?.url && (
              <img 
                src={product.images[0].url} 
                alt={product.name} 
                className="w-16 h-16 rounded-lg object-cover border border-gray-200"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{product?.name}</p>
              <p className="text-xs text-gray-500">Quantité: {quantity}</p>
            </div>
            <span className="text-base font-bold" style={{ color: themeColor }}>
              {formatPrice(total)} {currency}
            </span>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <User className="w-4 h-4" /> Nom complet *
            </label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
              placeholder="Votre nom complet"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Phone className="w-4 h-4" /> Numéro de téléphone *
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+237 6XX XXX XXX"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4" /> Ville *
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Ex: Douala, Yaoundé..."
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-4 h-4" /> Lieu de livraison *
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Quartier, rue, repère précis..."
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': themeColor }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 text-white rounded-xl font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Commander · {formatPrice(total)} {currency}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default QuickOrderModal;
