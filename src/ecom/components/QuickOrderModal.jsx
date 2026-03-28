import React, { useState } from 'react';
import { X, ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, AlertCircle, Plus, Minus, Truck, MessageCircle } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

/**
 * QuickOrderModal — Modal commande rapide depuis la page produit.
 * Collecte nom, téléphone, ville, adresse, quantité.
 * Après succès → affiche un bouton WhatsApp pré-rempli avec les détails de commande.
 */
const QuickOrderModal = ({ isOpen, onClose, product, subdomain, store }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', quantity: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--s-primary').trim() || store?.primaryColor || '#0F6B4F';
  const currency = product?.currency || 'XAF';
  const total = (product?.price || 0) * form.quantity;

  const set = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setError(''); };

  const buildWhatsAppMessage = (order) => {
    const lines = [
      `🛍️ *Nouvelle commande* — ${store?.name || 'Boutique'}`,
      `📦 *Produit :* ${product?.name} x${form.quantity}`,
      `💰 *Total :* ${fmt(order.total, order.currency)}`,
      `👤 *Client :* ${form.customerName}`,
      `📞 *Téléphone :* ${form.phone}`,
      `📍 *Ville :* ${form.city}`,
      `🏠 *Adresse :* ${form.address}`,
      `🔖 *Référence :* ${order.orderNumber}`,
      ``,
      `Paiement à la livraison ✅`,
    ];
    return encodeURIComponent(lines.join('\n'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName.trim() || !form.phone.trim()) { setError('Nom et téléphone requis'); return; }
    if (!form.city.trim() || !form.address.trim()) { setError('Ville et lieu de livraison requis'); return; }

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
        products: [{ productId: product._id, quantity: form.quantity }],
        channel: 'store',
      });
      setOrderResult(res.data?.data);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la commande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ customerName: '', phone: '', city: '', address: '', quantity: 1 });
    setError(''); setSuccess(false); setOrderResult(null);
    onClose();
  };

  if (!isOpen) return null;

  // ── Écran de succès ──────────────────────────────────────────────────────────
  if (success && orderResult) {
    const waNumber = (store?.whatsapp || '').replace(/\D/g, '');
    const waLink = waNumber
      ? `https://wa.me/${waNumber}?text=${buildWhatsAppMessage(orderResult)}`
      : null;

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: '100%', maxWidth: 420, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px', backgroundColor: themeColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color={themeColor} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>Commande confirmée !</h2>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 24px' }}>Merci {form.customerName.split(' ')[0]} 🙏</p>

          <div style={{ backgroundColor: '#F9FAFB', borderRadius: 14, padding: '16px 20px', marginBottom: 24, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Référence', orderResult.orderNumber],
              ['Produit', `${product?.name} x${form.quantity}`],
              ['Total', fmt(orderResult.total, orderResult.currency)],
              ['Statut', 'En attente de livraison'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#6B7280' }}>{label}</span>
                <span style={{ fontWeight: 700, color: '#111827' }}>{value}</span>
              </div>
            ))}
          </div>

          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', padding: '14px 20px', borderRadius: 40,
              backgroundColor: '#25D366', color: '#fff',
              fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 12,
              boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
            }}>
              <MessageCircle size={18} /> Confirmer via WhatsApp
            </a>
          )}

          <button onClick={handleClose} style={{
            width: '100%', padding: '12px 20px', borderRadius: 40,
            border: '1.5px solid #E5E7EB', backgroundColor: 'transparent',
            color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer',
          }}>
            Continuer les achats
          </button>
        </div>
      </div>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: '#fff', borderBottom: '1px solid #F3F4F6', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '20px 20px 0 0' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color={themeColor} /> Commander maintenant
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
          <span style={{ fontSize: 15, fontWeight: 800, color: themeColor, flexShrink: 0 }}>{fmt(total, currency)}</span>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Quantité */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Quantité</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
                style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${themeColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColor }}>
                <Minus size={15} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{form.quantity}</span>
              <button type="button" onClick={() => set('quantity', Math.min(product?.stock || 99, form.quantity + 1))}
                style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${themeColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColor }}>
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Champs */}
          {[
            { field: 'customerName', placeholder: 'Nom complet *', icon: <User size={15} />, type: 'text' },
            { field: 'phone', placeholder: 'Numéro de téléphone *', icon: <Phone size={15} />, type: 'tel' },
            { field: 'city', placeholder: 'Ville *', icon: <MapPin size={15} />, type: 'text' },
            { field: 'address', placeholder: 'Lieu de livraison *', icon: <MapPin size={15} />, type: 'text' },
          ].map(({ field, placeholder, icon, type }) => (
            <div key={field} style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}>{icon}</span>
              <input
                type={type}
                value={form[field]}
                onChange={e => set(field, e.target.value)}
                placeholder={placeholder}
                required
                style={{
                  width: '100%', padding: '12px 14px 12px 36px', borderRadius: 12,
                  border: `1.5px solid #E5E7EB`, fontSize: 14, outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box', color: '#111827',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = themeColor}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
              />
            </div>
          ))}

          {/* Badge livraison */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#F0FDF4', borderRadius: 10, fontSize: 13, color: '#166534' }}>
            <Truck size={14} /> <strong>Paiement à la livraison</strong> — vous payez à la réception
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '15px 20px', borderRadius: 40, border: 'none',
            backgroundColor: submitting ? '#9CA3AF' : themeColor,
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.15s', fontFamily: 'inherit',
          }}>
            {submitting ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...</> : <><ShoppingCart size={17} /> Commander · {fmt(total, currency)}</>}
          </button>
        </form>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default QuickOrderModal;
