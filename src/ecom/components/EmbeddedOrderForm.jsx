import React, { useState } from 'react';
import { ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, Truck, Plus, Minus, AlertCircle } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import { firePixelEvent } from '../utils/pixelTracking';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;

/**
 * EmbeddedOrderForm — Formulaire de commande intégré directement dans la page produit.
 * Remplace le bouton CTA + popup quand formType === 'embedded'.
 * Même logique que QuickOrderModal, version inline.
 */
const EmbeddedOrderForm = ({ product, subdomain, store, productPageConfig }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  const themeColor = store?.primaryColor || '#0F6B4F';
  const currency = product?.currency || store?.currency || 'XAF';
  const total = (product?.price || 0) * form.quantity;

  const design = productPageConfig?.design || {};
  const formConfig = productPageConfig?.form || {};
  const conversionConfig = productPageConfig?.conversion || {};
  const btnCfg = productPageConfig?.button || {};

  const btnColor = design.buttonColor || themeColor;
  const textColor = design.textColor || '#111827';
  const borderRadius = design.borderRadius || '12px';

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
        currency,
        num_items: form.quantity,
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
    return (
      <div style={{ borderRadius: 16, border: `2px solid ${btnColor}30`, padding: 24, textAlign: 'center', backgroundColor: '#F0FDF4' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px', backgroundColor: `${btnColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={28} color={btnColor} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: textColor, margin: '0 0 4px' }}>Commande confirmée !</h3>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>Merci {form.customerName.split(' ')[0]} 🙏</p>
        <div style={{ backgroundColor: '#fff', borderRadius: 12, padding: '12px 16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            ['Référence', orderResult.orderNumber],
            ['Produit', `${product.name} x${form.quantity}`],
            ['Total', fmt(orderResult.total, orderResult.currency)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#6B7280' }}>{label}</span>
              <span style={{ fontWeight: 700, color: textColor }}>{value}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setSuccess(false); setOrderResult(null); setForm({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 }); }}
          style={{ padding: '10px 20px', borderRadius: 40, border: '1.5px solid #E5E7EB', backgroundColor: 'transparent', color: '#6B7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Commander à nouveau
        </button>
      </div>
    );
  }

  // ── Inline form ──
  return (
    <div style={{ borderRadius: 16, border: `2px solid ${btnColor}25`, padding: '20px 18px', backgroundColor: `${btnColor}04` }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: textColor, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--s-font)' }}>
        <ShoppingCart size={18} color={btnColor} /> {btnCfg.text || 'Commander maintenant'}
      </h3>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Quantité */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Quantité</label>
          {useQuantityButtons ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {configQuantities.map(qty => (
                <button key={qty} type="button" onClick={() => set('quantity', qty)} style={{
                  padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${form.quantity === qty ? btnColor : '#E5E7EB'}`,
                  backgroundColor: form.quantity === qty ? btnColor : '#fff',
                  color: form.quantity === qty ? '#fff' : '#374151',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {qty}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))}
                style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}>
                <Minus size={14} />
              </button>
              <span style={{ fontSize: 15, fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{form.quantity}</span>
              <button type="button" onClick={() => set('quantity', Math.min(product.stock || 99, form.quantity + 1))}
                style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}>
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>

        {isFieldEnabled('fullname') && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><User size={15} /></span>
            <input type="text" value={form.customerName} onChange={e => set('customerName', e.target.value)}
              placeholder="Nom complet *" required
              style={{ width: '100%', padding: '11px 14px 11px 34px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
              onFocus={e => e.currentTarget.style.borderColor = btnColor}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
          </div>
        )}

        {isFieldEnabled('phone') && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><Phone size={15} /></span>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="Numéro de téléphone *" required
              style={{ width: '100%', padding: '11px 14px 11px 34px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
              onFocus={e => e.currentTarget.style.borderColor = btnColor}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><MapPin size={15} /></span>
          <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
            placeholder="Ville *" required
            style={{ width: '100%', padding: '11px 14px 11px 34px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
            onFocus={e => e.currentTarget.style.borderColor = btnColor}
            onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
        </div>

        {isFieldEnabled('address') && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex' }}><MapPin size={15} /></span>
            <input type="text" value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Lieu de livraison *" required
              style={{ width: '100%', padding: '11px 14px 11px 34px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, transition: 'border-color 0.15s' }}
              onFocus={e => e.currentTarget.style.borderColor = btnColor}
              onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
          </div>
        )}

        {isFieldEnabled('note') && (
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Note ou instruction…" rows={2}
            style={{ width: '100%', padding: '11px 14px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: textColor, resize: 'none', transition: 'border-color 0.15s' }}
            onFocus={e => e.currentTarget.style.borderColor = btnColor}
            onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16A34A', padding: '4px 0' }}>
          <Truck size={13} /> <strong>Paiement à la livraison</strong> — vous payez à la réception
        </div>

        <button type="submit" disabled={submitting} style={{
          width: '100%', padding: '15px 20px', borderRadius: parseInt(borderRadius) >= 20 ? 40 : borderRadius, border: 'none',
          backgroundColor: submitting ? '#9CA3AF' : btnColor,
          boxShadow: design.shadow !== false ? `0 4px 14px ${btnColor}40` : 'none',
          color: '#fff', fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'opacity 0.15s', fontFamily: 'inherit',
        }}>
          {submitting
            ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...</>
            : <><ShoppingCart size={17} /> Commander · {fmt(total, currency)}</>}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </form>
    </div>
  );
};

export default EmbeddedOrderForm;
