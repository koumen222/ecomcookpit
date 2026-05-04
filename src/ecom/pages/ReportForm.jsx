import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const inputCls = 'w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 focus:bg-white transition placeholder:text-gray-400';

const Field = ({ label, hint, required, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[13px] font-semibold text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
    {children}
  </div>
);

const Section = ({ title, children, action }) => (
  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
    <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
      <h2 className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const Skeleton = () => (
  <div className="flex flex-col min-h-full bg-[#f8f9fb] animate-pulse">
    <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
      <div className="h-4 w-4 bg-gray-200 rounded" />
      <div className="h-5 w-48 bg-gray-200 rounded" />
    </div>
    <div className="flex-1 flex items-start justify-center px-6 py-8">
      <div className="w-full max-w-2xl space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            {[...Array(2)].map((__, j) => (
              <div key={j}>
                <div className="h-2.5 w-20 bg-gray-200 rounded mb-1.5" />
                <div className="h-10 bg-gray-100 rounded-lg" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function ReportForm() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const { user }  = useEcomAuth();
  const { fmt, symbol } = useMoney();

  const [loading, setLoading]           = useState(false);
  const [initialLoading, setInit]       = useState(false);
  const [error, setError]               = useState('');
  const [products, setProducts]         = useState([]);
  const [isEditing, setIsEditing]       = useState(false);
  const [selectedProduct, setSelected]  = useState(null);

  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    productId: '',
    ordersReceived:  '',
    ordersDelivered: '',
    ordersReturned:  '0',
    adSpend:         '0',
    notes:           '',
    deliveries:      [],
    priceExceptions: [],
  });

  useEffect(() => { loadProducts(); loadReportWANumber(); }, []);
  useEffect(() => { if (id) { setIsEditing(true); loadReport(); } }, [id]);

  const loadReportWANumber = async () => {
    try {
      const res = await ecomApi.get('/orders/config/whatsapp');
      setWhatsappNumber(res.data.data?.reportNotifNumber || '');
    } catch {}
  };

  const loadProducts = async () => {
    try {
      const res = await ecomApi.get('/products', { params: { isActive: true } });
      const data = res.data?.data || [];
      setProducts(Array.isArray(data) ? data : []);
    } catch { setProducts([]); }
  };

  const loadReport = async () => {
    try {
      setInit(true);
      const { data } = await ecomApi.get(`/reports/${id}`);
      const r = data.data;
      setForm({
        date:            new Date(r.date).toISOString().split('T')[0],
        productId:       r.productId?._id || r.productId,
        ordersReceived:  r.ordersReceived?.toString()  || '',
        ordersDelivered: r.ordersDelivered?.toString() || '',
        ordersReturned:  r.ordersReturned?.toString()  || '0',
        adSpend:         r.adSpend?.toString()         || '0',
        notes:           r.notes           || '',
        deliveries:      r.deliveries      || [],
        priceExceptions: r.priceExceptions || [],
      });
    } catch (err) {
      setError(getContextualError(err, 'load_stats'));
    } finally { setInit(false); }
  };

  const handleChange = ({ target: { name, value } }) => {
    setForm(prev => ({ ...prev, [name]: value }));
    if (name === 'productId') setSelected(products.find(p => p._id === value) || null);
  };

  /* ── Price exceptions ── */
  const addException = () =>
    setForm(prev => ({ ...prev, priceExceptions: [...prev.priceExceptions, { quantity: '', unitPrice: '' }] }));
  const removeException = (i) =>
    setForm(prev => ({ ...prev, priceExceptions: prev.priceExceptions.filter((_, idx) => idx !== i) }));
  const updateException = (i, field, val) =>
    setForm(prev => ({ ...prev, priceExceptions: prev.priceExceptions.map((e, idx) => idx === i ? { ...e, [field]: val } : e) }));

  /* ── Deliveries ── */
  const addDelivery = () =>
    setForm(prev => ({ ...prev, deliveries: [...prev.deliveries, { agencyName: '', ordersDelivered: '', deliveryCost: '' }] }));
  const removeDelivery = (i) =>
    setForm(prev => ({ ...prev, deliveries: prev.deliveries.filter((_, idx) => idx !== i) }));
  const updateDelivery = (i, field, val) =>
    setForm(prev => ({ ...prev, deliveries: prev.deliveries.map((d, idx) => idx === i ? { ...d, [field]: val } : d) }));

  /* ── Calculs ── */
  const delivered  = parseInt(form.ordersDelivered) || 0;
  const received   = parseInt(form.ordersReceived)  || 0;
  const returned   = parseInt(form.ordersReturned)  || 0;
  const adSpend    = parseFloat(form.adSpend)        || 0;
  const effective  = delivered - returned;

  const calcRevenue = () => {
    const exceptions = form.priceExceptions.filter(e => e.quantity && e.unitPrice);
    if (exceptions.length === 0) return effective * (selectedProduct?.sellingPrice || 0);
    const exQty = exceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0), 0);
    const exRev = exceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0) * (parseFloat(e.unitPrice) || 0), 0);
    const normQty = Math.max(0, delivered - exQty);
    return normQty * (selectedProduct?.sellingPrice || 0) + exRev - returned * (selectedProduct?.sellingPrice || 0);
  };

  const totalDeliveryCost = form.deliveries.reduce((s, d) => s + (parseFloat(d.deliveryCost) || 0), 0);

  const calcBenefit = () => {
    const productCost = selectedProduct?.productCost || 0;
    return calcRevenue() - productCost * delivered - totalDeliveryCost - adSpend;
  };

  const deliveryRate = received > 0 ? ((delivered / received) * 100).toFixed(1) : '0.0';
  const pending      = received - delivered;
  const hasStats     = received > 0 && delivered > 0;

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        date:            form.date,
        productId:       form.productId,
        ordersReceived:  parseInt(form.ordersReceived),
        ordersDelivered: parseInt(form.ordersDelivered),
        ordersReturned:  parseInt(form.ordersReturned) || 0,
        adSpend:         parseFloat(form.adSpend) || 0,
        notes:           form.notes,
        whatsappNumber:  whatsappNumber,
        deliveries: form.deliveries.map(d => ({
          agencyName:      d.agencyName,
          ordersDelivered: parseInt(d.ordersDelivered) || 0,
          deliveryCost:    parseFloat(d.deliveryCost)  || 0,
        })),
        priceExceptions: form.priceExceptions
          .filter(e => e.quantity && e.unitPrice)
          .map(e => ({ quantity: parseInt(e.quantity), unitPrice: parseFloat(e.unitPrice) })),
      };
      if (isEditing) {
        await ecomApi.put(`/reports/${id}`, payload);
      } else {
        payload.reportedBy = user._id;
        await ecomApi.post('/reports', payload);
      }
      navigate('/ecom/reports');
    } catch (err) {
      setError(getContextualError(err, 'save_order'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <Skeleton />;

  return (
    <div className="flex flex-col min-h-full bg-[#f8f9fb]">

      {/* Topbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link to="/ecom/reports" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight leading-none">
            {isEditing ? 'Modifier le rapport' : 'Nouveau rapport'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 leading-none">
            Données quotidiennes pour un produit
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-6">
        <div className="w-full max-w-2xl">

          {error && (
            <div className="flex gap-2.5 items-start bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.25a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Identité ─────────────────────────────────── */}
            <Section title="Identification">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Date" required>
                  <input
                    type="date"
                    name="date"
                    required
                    value={form.date}
                    onChange={handleChange}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputCls}
                  />
                </Field>
                <Field label="Produit" required>
                  <select name="productId" required value={form.productId} onChange={handleChange} className={inputCls}>
                    <option value="">Sélectionner un produit</option>
                    {products.map(p => (
                      <option key={p._id} value={p._id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            {/* ── Commandes ────────────────────────────────── */}
            <Section title="Commandes">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Reçues" required>
                  <input type="number" name="ordersReceived" required min="0" value={form.ordersReceived} onChange={handleChange} placeholder="0" className={inputCls} />
                </Field>
                <Field label="Livrées" required>
                  <input type="number" name="ordersDelivered" required min="0" value={form.ordersDelivered} onChange={handleChange} placeholder="0" className={inputCls} />
                </Field>
                <Field label="Retours / remboursements" hint="impact négatif">
                  <input type="number" name="ordersReturned" min="0" value={form.ordersReturned} onChange={handleChange} placeholder="0" className={`${inputCls} focus:ring-red-400 focus:border-red-400`} />
                </Field>
              </div>

              {/* Stats inline */}
              {hasStats && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Taux livraison',  value: `${deliveryRate}%`,  color: 'text-emerald-700' },
                    { label: 'En attente',       value: pending,             color: pending > 0 ? 'text-amber-700' : 'text-gray-700' },
                    { label: 'Retours',          value: returned > 0 ? `-${returned}` : '0', color: returned > 0 ? 'text-red-600' : 'text-gray-500' },
                    ...(selectedProduct ? [{ label: 'CA estimé', value: `${calcRevenue().toLocaleString('fr-FR')} ${symbol}`, color: calcRevenue() >= 0 ? 'text-emerald-700' : 'text-red-600' }] : []),
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                      <p className={`text-sm font-bold mt-0.5 tabular-nums ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* ── Exceptions de prix ───────────────────────── */}
            <Section
              title="Exceptions de prix"
              action={
                <button type="button" onClick={addException}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Ajouter
                </button>
              }
            >
              {form.priceExceptions.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">
                  Prix standard du produit appliqué à toutes les commandes livrées.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.priceExceptions.map((ex, i) => (
                    <div key={i} className="flex gap-2 items-end bg-amber-50 border border-amber-200 rounded-xl px-3 py-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Qté</label>
                        <input type="number" value={ex.quantity} onChange={e => updateException(i, 'quantity', e.target.value)}
                          min="1" placeholder="0" className={inputCls} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Prix unitaire ({symbol})</label>
                        <input type="number" value={ex.unitPrice} onChange={e => updateException(i, 'unitPrice', e.target.value)}
                          min="0" placeholder="0" className={inputCls} />
                      </div>
                      <button type="button" onClick={() => removeException(i)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors mb-0.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {selectedProduct && form.ordersDelivered && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-0.5">
                      {(() => {
                        const exQty = form.priceExceptions.reduce((s, e) => s + (parseInt(e.quantity) || 0), 0);
                        const normQty = Math.max(0, delivered - exQty);
                        return <>
                          {normQty > 0 && <p>• <strong>{normQty}</strong> commande{normQty > 1 ? 's' : ''} au prix standard ({(selectedProduct.sellingPrice || 0).toLocaleString('fr-FR')} {symbol})</p>}
                          {form.priceExceptions.filter(e => e.quantity && e.unitPrice).map((e, i) => (
                            <p key={i}>• <strong>{e.quantity}</strong> commande{parseInt(e.quantity) > 1 ? 's' : ''} à <strong>{parseFloat(e.unitPrice || 0).toLocaleString('fr-FR')} {symbol}</strong></p>
                          ))}
                          <p className="font-bold pt-1 border-t border-amber-300 mt-1">CA estimé : {calcRevenue().toLocaleString('fr-FR')} {symbol}</p>
                        </>;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* ── Frais de livraison ───────────────────────── */}
            <Section
              title="Frais de livraison"
              action={
                <button type="button" onClick={addDelivery}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Ajouter une agence
                </button>
              }
            >
              {form.deliveries.length === 0 ? (
                <p className="text-xs text-gray-400 py-1">
                  Aucun frais de livraison — les valeurs par défaut du produit seront utilisées.
                </p>
              ) : (
                <div className="space-y-3">
                  {form.deliveries.map((d, i) => (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Agence {i + 1}</span>
                        <button type="button" onClick={() => removeDelivery(i)}
                          className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Nom de l'agence</label>
                          <input type="text" value={d.agencyName} onChange={e => updateDelivery(i, 'agencyName', e.target.value)}
                            placeholder="ex : DHL, Campost…" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Commandes livrées</label>
                          <input type="number" value={d.ordersDelivered} onChange={e => updateDelivery(i, 'ordersDelivered', e.target.value)}
                            min="0" placeholder="0" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Frais de livraison ({symbol})</label>
                          <input type="number" value={d.deliveryCost} onChange={e => updateDelivery(i, 'deliveryCost', e.target.value)}
                            min="0" step="1" placeholder="0" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Récap total livraisons */}
                  {form.deliveries.some(d => d.deliveryCost) && (
                    <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 text-xs text-emerald-700">
                        <span className="font-semibold">{form.deliveries.reduce((s, d) => s + (parseInt(d.ordersDelivered) || 0), 0)}</span>
                        <span>commandes</span>
                        <span className="text-emerald-400">·</span>
                        <span>{form.deliveries.filter(d => d.agencyName).length} agence{form.deliveries.filter(d => d.agencyName).length > 1 ? 's' : ''}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 tabular-nums">
                        {totalDeliveryCost.toLocaleString('fr-FR')} {symbol} total
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Section>

            {/* ── Finances ─────────────────────────────────── */}
            {user?.role !== 'ecom_closeuse' && (
              <Section title="Dépenses publicitaires">
                <Field label={`Montant dépensé en pub`} hint={`en ${symbol}`}>
                  <input type="number" name="adSpend" min="0" step="1" value={form.adSpend} onChange={handleChange}
                    placeholder="0" className={inputCls} />
                </Field>
              </Section>
            )}

            {/* ── Bénéfice estimé ──────────────────────────── */}
            {selectedProduct && hasStats && (
              <div className={`rounded-2xl border px-5 py-4 flex items-center gap-6 ${calcBenefit() >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-bold uppercase tracking-wide ${calcBenefit() >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Bénéfice estimé</p>
                  <p className={`text-2xl font-bold tabular-nums ${calcBenefit() >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {calcBenefit() >= 0 ? '+' : ''}{calcBenefit().toLocaleString('fr-FR')} {symbol}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-xs text-gray-500">CA : <span className="font-semibold text-gray-700">{calcRevenue().toLocaleString('fr-FR')} {symbol}</span></p>
                  <p className="text-xs text-gray-500">Livraison : <span className="font-semibold text-gray-700">{totalDeliveryCost.toLocaleString('fr-FR')} {symbol}</span></p>
                  <p className="text-xs text-gray-500">Pub : <span className="font-semibold text-gray-700">{adSpend.toLocaleString('fr-FR')} {symbol}</span></p>
                </div>
              </div>
            )}

            {/* ── Notes ───────────────────────────────────── */}
            <Section title="Informations complémentaires">
              <div className="space-y-4">
                <Field label="Notes">
                  <textarea name="notes" rows={3} value={form.notes} onChange={handleChange}
                    placeholder="Informations supplémentaires sur la journée…"
                    className={`${inputCls} resize-none`} />
                </Field>
                {whatsappNumber ? (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <p className="text-xs text-emerald-700">
                      Notification envoyée à <span className="font-bold">{whatsappNumber}</span> —{' '}
                      <Link to="/ecom/settings?tab=delivery_groups" className="underline underline-offset-2">modifier dans les réglages</Link>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p className="text-xs text-amber-700">
                      Aucun numéro WhatsApp configuré —{' '}
                      <Link to="/ecom/settings?tab=delivery_groups" className="underline underline-offset-2">configurer dans les réglages</Link>
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* ── Actions ──────────────────────────────────── */}
            <div className="flex gap-3 pt-1 pb-8">
              <button type="button" onClick={() => navigate('/ecom/reports')}
                className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm shadow-emerald-200 transition-all active:scale-95">
                {loading
                  ? (isEditing ? 'Enregistrement…' : 'Création…')
                  : (isEditing ? 'Enregistrer' : 'Créer le rapport')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
