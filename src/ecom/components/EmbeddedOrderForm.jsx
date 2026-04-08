import React, { useState, useEffect } from 'react';
import { ShoppingCart, User, Phone, MapPin, Loader2, CheckCircle, Truck, Plus, Minus, AlertCircle, ChevronDown, Mail, FileText, Hash, Calendar, Clock } from 'lucide-react';
import { publicStoreApi } from '../services/storeApi.js';
import defaultConfig from './productSettings/defaultConfig.js';
import { firePixelEvent } from '../utils/pixelTracking';
import { PHONE_CODES, getDefaultPhoneCode, buildFullPhone } from '../utils/phoneCodes.js';

const fmt = (n, cur = 'XAF') => `${new Intl.NumberFormat('fr-FR').format(n)} ${cur}`;
const ICON_MAP = { user: User, phone: Phone, map: MapPin, pin: MapPin, mail: Mail, cart: ShoppingCart, file: FileText, hash: Hash, calendar: Calendar };
const FIELD_KEY_MAP = { fullname: 'customerName', phone: 'phone', city: 'city', address: 'address', note: 'notes' };

/**
 * EmbeddedOrderForm — Formulaire de commande intégré directement dans la page produit.
 * Remplace le bouton CTA + popup quand formType === 'embedded'.
 * Même logique que QuickOrderModal, version inline.
 */
const EmbeddedOrderForm = ({ product, subdomain, store, productPageConfig }) => {
  const [form, setForm] = useState({ customerName: '', phone: '', city: '', address: '', notes: '', quantity: 1 });
  const [phoneCode, setPhoneCode] = useState(() => getDefaultPhoneCode(store?.currency));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [cityOptions, setCityOptions] = useState([]);
  const [countdownSecs, setCountdownSecs] = useState(null);

  const themeColor = store?.primaryColor || '#0F6B4F';
  const currency = product?.currency || store?.currency || 'XAF';

  const design = productPageConfig?.design || {};
  const formConfig = productPageConfig?.form || {};
  const conversionConfig = productPageConfig?.conversion || {};
  const btnCfg = productPageConfig?.button || {};

  const offerDesign = conversionConfig.offerDesign || null;
  const btnColor = offerDesign?.colors?.primary || conversionConfig.accentColor || design.buttonColor || themeColor;
  const offerBorderStyle = offerDesign?.border_style || 'solid';
  const urgencyConfig = productPageConfig?.urgency || defaultConfig.urgency || {};
  const callScheduleConfig = productPageConfig?.callSchedule || defaultConfig.callSchedule || {};
  const textColor = design.textColor || '#111827';
  const inputTextColor = '#111827'; // Always dark for inputs on white/light backgrounds
  const borderRadius = design.borderRadius || '12px';

  const configFields = formConfig.fields || [];
  const effectiveFields = configFields.length ? configFields : defaultConfig.form.fields;

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
          const cities = [...new Set(zones.map(z => z.city).filter(Boolean))];
          if (cities.length) { setCityOptions(cities); return; }
        }
      } catch (_) { /* ignore */ }
      if (cancelled) return;
      // Fallback: popularCities from config or defaultConfig
      const generalCfg = productPageConfig?.general || {};
      const countries = generalCfg.countries || ['Cameroon'];
      const popCities = generalCfg.popularCities || defaultConfig.general.popularCities;
      const allCities = countries.flatMap(c => popCities[c] || []);
      if (allCities.length) setCityOptions(allCities);
    })();
    return () => { cancelled = true; };
  }, [subdomain]);

  const configQuantities = conversionConfig.quantities || [];
  const useQuantityButtons = configQuantities.length > 0;
  const offersEnabled = conversionConfig.offersEnabled && conversionConfig.offers?.length > 0;
  const offers = conversionConfig.offers || [];
  const defaultOfferIdx = offers.findIndex(o => o.selected);
  const [selectedOfferIdx, setSelectedOfferIdx] = useState(Math.max(0, defaultOfferIdx));

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
      const offerPriceOverride = offersEnabled && offers[selectedOfferIdx]?.price > 0
        ? { offerPrice: offers[selectedOfferIdx].price, offerQty: offers[selectedOfferIdx].qty }
        : {};

      const fullPhone = buildFullPhone(phoneCode, form.phone);
      const res = await publicStoreApi.placeOrder(subdomain, {
        customerName: form.customerName.trim(),
        phone: fullPhone,
        email: '',
        address: form.address.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        products: [{ productId: product._id, quantity: form.quantity, ...offerPriceOverride }],
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
    const firstName = form.customerName.split(' ')[0];
    const storeWhatsapp = (store?.whatsapp || store?.phone || '').replace(/[^0-9+]/g, '');
    const waMsg = `Bonjour ! 👋\n\nJe viens de passer une commande sur votre boutique.\n\n📦 *Commande N° ${orderResult.orderNumber}*\n💰 *Montant : ${fmt(orderResult.total, orderResult.currency)}*\n👤 Nom : ${form.customerName}\n📞 Téléphone : ${form.phone}\n\nMerci de confirmer ma commande ! 🙏`;
    const waLink = storeWhatsapp ? `https://wa.me/${storeWhatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(waMsg)}` : null;

    return (
      <div style={{ borderRadius: 20, overflow: 'hidden', border: `2px solid ${btnColor}20`, backgroundColor: '#fff' }}>
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

        {/* Dynamic fields from config */}
        {effectiveFields.filter(f => f.enabled !== false).map((field) => {
          const formKey = FIELD_KEY_MAP[field.name] || field.name;
          const IconComp = ICON_MAP[field.icon];
          const ph = (field.placeholder || field.label || '') + (field.required !== false && !['product_info', 'shipping', 'cta_button'].includes(field.type) ? ' *' : '');
          const iconStyle = { position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' };
          const inputPadLeft = IconComp ? '34px' : '14px';
          const inputStyle = { width: '100%', padding: `11px 14px 11px ${inputPadLeft}`, borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: inputTextColor, backgroundColor: '#fff', transition: 'border-color 0.15s' };

          switch (field.type) {
            case 'product_info':
              return (
                <div key={field.name}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    {offersEnabled ? 'Choisissez votre offre' : 'Quantité'}
                  </label>
                  {offersEnabled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {offers.map((offer, i) => {
                        const displayPrice = offer.price > 0 ? offer.price : (product?.price || 0) * (offer.qty || 1);
                        const displayCompare = offer.comparePrice > 0 ? offer.comparePrice : 0;
                        const disc = displayCompare > displayPrice && displayPrice > 0 ? Math.round((1 - displayPrice / displayCompare) * 100) : 0;
                        const sel = selectedOfferIdx === i;
                        return (
                          <div key={i} onClick={() => { setSelectedOfferIdx(i); set('quantity', offer.qty); }}
                            style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', borderWidth: sel ? 2 : 1.5, borderStyle: offerBorderStyle === 'flat' ? 'solid' : offerBorderStyle, borderColor: sel ? btnColor : '#E5E7EB', backgroundColor: sel ? `${btnColor}08` : '#fff', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s ease' }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: sel ? `4px solid ${btnColor}` : '2px solid #D1D5DB', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}
                                {offer.badge && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', backgroundColor: btnColor, padding: '1px 6px', borderRadius: 20 }}>{offer.badge}</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: btnColor }}>{fmt(displayPrice, currency)}</span>
                                {disc > 0 && (<>
                                  <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(displayCompare, currency)}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', backgroundColor: '#FEE2E2', padding: '1px 5px', borderRadius: 10 }}>-{disc}%</span>
                                </>)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : useQuantityButtons ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {configQuantities.map(qty => (
                        <button key={qty} type="button" onClick={() => set('quantity', qty)} style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${form.quantity === qty ? btnColor : '#E5E7EB'}`, backgroundColor: form.quantity === qty ? btnColor : '#fff', color: form.quantity === qty ? '#fff' : '#374151', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>{qty}</button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button type="button" onClick={() => set('quantity', Math.max(1, form.quantity - 1))} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}><Minus size={14} /></button>
                      <span style={{ fontSize: 15, fontWeight: 800, minWidth: 28, textAlign: 'center' }}>{form.quantity}</span>
                      <button type="button" onClick={() => set('quantity', Math.min(product.stock || 99, form.quantity + 1))} style={{ width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${btnColor}`, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: btnColor }}><Plus size={14} /></button>
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
              if (field.type === 'phone') {
                return (
                  <div key={field.name} style={{ display: 'flex', gap: 0 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <select value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                        style={{ appearance: 'none', WebkitAppearance: 'none', padding: '11px 22px 11px 8px', borderRadius: `${borderRadius} 0 0 ${borderRadius}`, border: '1.5px solid #E5E7EB', borderRight: 'none', fontSize: 13, fontWeight: 600, background: '#F9FAFB', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', color: inputTextColor, minWidth: 80 }}>
                        {PHONE_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <ChevronDown size={12} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} />
                    </div>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                      {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                      <input type="tel" value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)}
                        placeholder={ph || '6XX XXX XXX'} required={field.required !== false}
                        style={{ ...inputStyle, borderRadius: `0 ${borderRadius} ${borderRadius} 0` }}
                        onFocus={e => e.currentTarget.style.borderColor = btnColor}
                        onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
                    </div>
                  </div>
                );
              }
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
                  {cityOptions.length > 0 ? (<>
                    <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                      style={{ ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : '#9CA3AF' }}
                      onFocus={e => e.currentTarget.style.borderColor = btnColor}
                      onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                      <option value="" disabled>{ph}</option>
                      {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
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
                  style={{ width: '100%', padding: '11px 14px', borderRadius, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: inputTextColor, backgroundColor: '#fff', resize: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.currentTarget.style.borderColor = btnColor}
                  onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'} />
              );

            case 'select': {
              const options = field.options || [];
              return (
                <div key={field.name} style={{ position: 'relative' }}>
                  {IconComp && <span style={iconStyle}><IconComp size={15} /></span>}
                  <select value={form[formKey] || ''} onChange={e => set(formKey, e.target.value)} required={field.required !== false}
                    style={{ ...inputStyle, paddingRight: 32, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: form[formKey] ? inputTextColor : '#9CA3AF' }}
                    onFocus={e => e.currentTarget.style.borderColor = btnColor}
                    onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                    <option value="" disabled>{ph}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', display: 'flex', pointerEvents: 'none' }}><ChevronDown size={15} /></span>
                </div>
              );
            }

            case 'shipping':
              return (
                <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16A34A', padding: '4px 0' }}>
                  <Truck size={13} /> <strong>{field.label || 'Paiement à la livraison'}</strong> — vous payez à la réception
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
                    width: '100%', padding: '15px 20px', borderRadius: parseInt(borderRadius) >= 20 ? 40 : borderRadius, border: 'none',
                    backgroundColor: submitting ? '#9CA3AF' : btnColor,
                    boxShadow: design.shadow !== false ? `0 4px 14px ${btnColor}40` : 'none',
                    color: '#fff', fontWeight: 700, fontSize: 15, cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'opacity 0.15s', fontFamily: 'inherit',
                  }}>
                    {submitting
                      ? <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Traitement...</>
                      : <>{field.showIcon !== false && <CtaIcon size={17} />} {ctaLabel}</>}
                  </button>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </React.Fragment>
              );
            }

            default:
              return null;
          }
        })}
      </form>
    </div>
  );
};

export default EmbeddedOrderForm;
