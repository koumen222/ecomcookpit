import React, { useState } from 'react';
import { X, ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, AlertCircle, Plus, Minus, Truck } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { firePixelEvent } from '../utils/pixelTracking';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

// ── field name mapping: config key → form state key ─────────────────────────
const FIELD_MAP = {
  fullname: 'customerName',
  phone: 'phone',
  address: 'address',
  note: 'notes',
};

/**
 * QuickOrderModal — Modal commande rapide depuis la page produit.
 * Collecte nom, téléphone, ville, adresse, quantité.
 * Après succès → affiche un bouton WhatsApp pré-rempli avec les détails de commande.
 * Accepts productPageConfig to apply design, field visibility, and quantity options.
 */
const QuickOrderModal = ({ isOpen, onClose, product, subdomain, store, productPageConfig }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--s-primary').trim() || store?.primaryColor || '#0F6B4F';
  const currency = product?.currency || 'XAF';
  const total = (product?.price || 0) * form.quantity;

  // ── Resolve config with safe fallbacks ──────────────────────────────────────
  const design = productPageConfig?.design || {};
  const formConfig = productPageConfig?.form || {};
  const conversionConfig = productPageConfig?.conversion || {};

  const btnColor = design.buttonColor || themeColor;
  const bgColor = design.backgroundColor || '#ffffff';
  const textColor = design.textColor || '#111827';
  const borderRadius = design.borderRadius || '12px';
  const boxShadow = design.shadow !== false ? '0 24px 64px rgba(0,0,0,0.18)' : 'none';

  const configFields = formConfig.fields || [];
  const isFieldEnabled = (name) => {
    if (!configFields.length) return true;
    const f = configFields.find(f => f.name === name);
    return f ? f.enabled : true;
  };

  const configQuantities = conversionConfig.quantities || [];
  const useQuantityButtons = configQuantities.length > 0;

  const set = (field, value) => { setForm(prev => ({ ...prev, [field]: value })); setError(''); };

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
        notes: form.notes.trim(),
        products: [{ productId: product._id, quantity: form.quantity }],
        channel: 'store',
      });
      setOrderResult(res.data?.data);
      setSuccess(true);

      firePixelEvent('Purchase', {
        content_ids: [product._id || product.slug || ''],
        content_name: product.name || '',
        value: total,
        currency: currency,
        num_items: form.quantity,
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
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
        <div style={{ backgroundColor: bgColor, borderRadius: 20, boxShadow, width: '100%', maxWidth: 420, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px', backgroundColor: btnColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={32} color={btnColor} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: textColor, margin: '0 0 6px' }}>Commande confirmée !</h2>
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
                <span style={{ fontWeight: 700, color: textColor }}>{value}</span>
              </div>
            ))}
          </div>

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
      <div style={{ backgroundColor: bgColor, borderRadius: 20, boxShadow, width: '100%', maxWidth: 440, maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, backgroundColor: bgColor, borderBottom: '1px solid #F3F4F6', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '20px 20px 0 0' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: textColor, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={18} color={btnColor} /> Commander maintenant
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
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product?.name}</p>
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

          {/* Quantité */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Quantité</label>
            {useQuantityButtons ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {configQuantities.map(qty => (
                  <button key={qty} type="button" onClick={() => set('quantity', qty)} style={{
                    padding: '8px 18px', borderRadius: 10, border: `1.5px solid ${form.quantity === qty ? btnColor : '#E5E7EB'}`,
                    backgroundColor: form.quantity === qty ? btnColor : '#fff',
                    color: form.quantity === qty ? '#fff' : '#374151',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {qty}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
                  style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}>
                  <Minus size={15} />
                </button>
                <span style={{ fontSize: 16, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{form.quantity}</span>
                <button type="button" onClick={() => set('quantity', Math.min(product?.stock || 99, form.quantity + 1))}
                  style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}>
                  <Plus size={15} />
                </button>
              </div>
            )}
          </div>

          {/* Champs contrôlés par la config */}
          {isFieldEnabled('fullname') && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><User size={15} /></span>
              <input type="text" value={form.customerName} onChange={e => set('customerName', e.target.value)}
                placeholder="Nom complet *" required
                style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
                onFocus={e => e.currentTarget.style.borderColor = btnColor}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
            </div>
          )}

          {isFieldEnabled('phone') && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><Phone size={15} /></span>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="Numéro de téléphone *" required
                style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
                onFocus={e => e.currentTarget.style.borderColor = btnColor}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
            </div>
          )}

          {/* City — always shown (needed for delivery) */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><MapPin size={15} /></span>
            <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
              placeholder="Ville *" required
              style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
              onFocus={e => e.currentTarget.style.borderColor = btnColor}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
          </div>

          {isFieldEnabled('address') && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><MapPin size={15} /></span>
              <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
                placeholder="Lieu de livraison *" required
                style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
                onFocus={e => e.currentTarget.style.borderColor = btnColor}
                onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
            </div>
          )}

          {isFieldEnabled('note') && (
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Note ou instruction particulière…" rows={2}
              style={{ width: '100%', padding: '12px 14px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, resize: 'none', transition: 'border-color 0.15s' }}
              onFocus={e => e.currentTarget.style.borderColor = btnColor}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
          )}

          {/* Badge livraison */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#F0FDF4', borderRadius: 10, fontSize: 13, color: '#166534' }}>
            <Truck size={14} /> <strong>Paiement à la livraison</strong> — vous payez à la réception
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: '15px 20px', borderRadius: parseInt(borderRadius) >= 20 ? 40 : borderRadius, border: 'none',
            backgroundColor: submitting ? '#9CA3AF' : btnColor,
            boxShadow: design.shadow !== false ? `0 4px 14px ${btnColor}40` : 'none',
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
