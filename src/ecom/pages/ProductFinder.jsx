import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi.js';

const SectionCard = ({ icon, color, title, badge, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div className={`px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5 ${color}`}>
      <span className="text-base">{icon}</span>
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {badge && <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{badge}</span>}
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

const Label = ({ children, required }) => (
  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

const TextInput = (props) => (
  <input
    {...props}
    className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none transition placeholder-gray-300"
  />
);

const Chips = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(({ v, l }) => (
      <button key={v} type="button" onClick={() => onChange(v)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
          value === v
            ? 'bg-[#0F6B4F] text-white border-[#0F6B4F] shadow-sm'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        }`}>
        {l}
      </button>
    ))}
  </div>
);

const KpiPill = ({ label, value, sub, color = 'text-gray-900' }) => (
  <div className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3.5 py-3 text-center border border-gray-100">
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest truncate">{label}</p>
    <p className={`text-base font-bold mt-0.5 ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const defaultState = {
  name: '', imageUrl: '', creative: '', alibabaLink: '', researchLink: '', websiteUrl: '',
  sourcingType: 'local', sourcingPrice: '', weight: '', pricePerKg: '',
  shippingUnitCost: '', cogs: '', sellingPrice: '',
  demand: 'medium', competition: 'medium', trend: 'stable',
  supplierCount: '', supplierReliability: 'medium',
  notes: '', pros: [''], cons: [''],
  opportunityScore: 3, monthlyEstimate: '', status: 'research',
};

const ProductFinder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [product, setProduct] = useState(defaultState);

  const set = (field, value) => {
    setProduct(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'sourcingType') {
        if (value === 'local') { next.weight = ''; next.pricePerKg = ''; next.shippingUnitCost = '0'; }
        if (value === 'china') { next.shippingUnitCost = ''; }
      }
      if (next.sourcingType === 'china') {
        const w = parseFloat(next.weight) || 0, ppk = parseFloat(next.pricePerKg) || 0;
        if (w > 0 && ppk > 0) next.shippingUnitCost = (w * ppk).toFixed(0);
      } else {
        next.shippingUnitCost = '0';
      }
      if (['sourcingPrice','weight','pricePerKg','sourcingType'].includes(field)) {
        const s = parseFloat(next.sourcingPrice) || 0, sh = parseFloat(next.shippingUnitCost) || 0;
        if (next.sourcingPrice !== '') next.cogs = (s + sh).toFixed(0);
      }
      return next;
    });
    setError(''); setSuccess('');
  };

  const updateList   = (f, i, v) => setProduct(p => { const a = [...p[f]]; a[i] = v; return { ...p, [f]: a }; });
  const addItem      = (f)    => setProduct(p => ({ ...p, [f]: [...p[f], ''] }));
  const removeItem   = (f, i) => setProduct(p => { const a = p[f].filter((_,j) => j !== i); return { ...p, [f]: a.length ? a : [''] }; });

  const cogs      = parseFloat(product.cogs) || 0;
  const sell      = parseFloat(product.sellingPrice) || 0;
  const margin    = sell > 0 ? Math.max(0, ((sell - cogs) / sell) * 100).toFixed(1) : null;
  const profit    = sell > 0 ? Math.max(0, sell - cogs).toFixed(0) : null;
  const roi       = cogs > 0 && profit > 0 ? ((profit / cogs) * 100).toFixed(1) : null;
  const calcCOGS  = () => ((parseFloat(product.sourcingPrice)||0) + (parseFloat(product.shippingUnitCost)||0)).toFixed(0);
  const suggested = () => {
    const sp = parseFloat(product.sourcingPrice) || 0;
    return Math.max(10000, Math.ceil((sp < 10000 ? sp * 3 : sp * 2.25) / 50) * 50);
  };
  const marginColor = margin === null ? '' : parseFloat(margin) >= 60 ? 'text-emerald-600' : parseFloat(margin) >= 40 ? 'text-amber-500' : 'text-red-500';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!product.name.trim()) return setError('Le nom du produit est requis');
    if (!product.sourcingPrice || parseFloat(product.sourcingPrice) <= 0) return setError('Le prix sourcing doit être supérieur à 0');
    if (product.sourcingType === 'china' && (!product.weight || parseFloat(product.weight) <= 0)) return setError('Le poids est requis pour un sourcing Chine');
    if (!product.sellingPrice || parseFloat(product.sellingPrice) <= 0) return setError('Le prix de vente est requis');

    setLoading(true); setError('');
    try {
      const payload = {
        ...product,
        sourcingPrice:    parseFloat(product.sourcingPrice),
        weight:           parseFloat(product.weight) || 0,
        pricePerKg:       parseFloat(product.pricePerKg) || 0,
        shippingUnitCost: parseFloat(product.shippingUnitCost) || 0,
        cogs:             parseFloat(product.cogs || calcCOGS()) || 0,
        sellingPrice:     parseFloat(product.sellingPrice),
        opportunityScore: parseInt(product.opportunityScore),
        monthlyEstimate:  parseInt(product.monthlyEstimate) || 0,
        supplierCount:    parseInt(product.supplierCount) || 0,
        margin:           parseFloat(margin) || 0,
        profit:           parseFloat(profit) || 0,
        pros: product.pros.filter(p => p.trim()),
        cons: product.cons.filter(c => c.trim()),
        researchDate: new Date().toISOString(),
      };
      const res = await ecomApi.post('/products-research/research', payload);
      if (res.data.success) {
        setSuccess('Produit sauvegardé !');
        setProduct(defaultState);
        setTimeout(() => navigate('/ecom/product-research'), 1500);
      }
    } catch { setError('Erreur lors de la sauvegarde.'); }
    setLoading(false);
  };

  const isCN = product.sourcingType === 'china';
  const showKpis = product.sourcingPrice && product.sellingPrice;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/ecom/product-research')}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">Nouveau produit</h1>
            <p className="text-[11px] text-gray-400">Veille produit</p>
          </div>
          <button type="submit" form="product-form" disabled={loading}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex-shrink-0">
            {loading
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sauvegarde…</>
              : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Sauvegarder</>
            }
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            {success}
          </div>
        )}

        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">

          {/* ── Produit ── */}
          <SectionCard icon="📦" color="" title="Informations produit" badge="Veille">
            <div>
              <Label required>Nom du produit</Label>
              <TextInput type="text" value={product.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Drain Stick, Correcteur Blancheur…" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Image apparente</Label>
                <TextInput type="url" value={product.imageUrl} onChange={e => set('imageUrl', e.target.value)}
                  placeholder="https://drive.google.com/…" />
              </div>
              <div>
                <Label>Creative (Ads / Vidéo)</Label>
                <TextInput type="url" value={product.creative} onChange={e => set('creative', e.target.value)}
                  placeholder="Lien vers la publicité" />
              </div>
              <div>
                <Label>Lien Alibaba</Label>
                <TextInput type="url" value={product.alibabaLink} onChange={e => set('alibabaLink', e.target.value)}
                  placeholder="https://www.alibaba.com/…" />
              </div>
              <div>
                <Label>Lien Recherche</Label>
                <TextInput type="url" value={product.researchLink} onChange={e => set('researchLink', e.target.value)}
                  placeholder="Facebook Ads, TikTok…" />
              </div>
              <div className="sm:col-span-2">
                <Label>Site web concurrent</Label>
                <TextInput type="url" value={product.websiteUrl} onChange={e => set('websiteUrl', e.target.value)}
                  placeholder="https://example.com/…" />
              </div>
            </div>
          </SectionCard>

          {/* ── Finances ── */}
          <SectionCard icon="💰" color="" title="Analyse financière" badge="Excel">

            {/* Sourcing toggle */}
            <div>
              <Label>Type de sourcing</Label>
              <div className="flex gap-2">
                {[{ v:'local', l:'🏠 Local' }, { v:'china', l:'🇨🇳 Chine' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => set('sourcingType', v)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                      product.sourcingType === v
                        ? 'bg-[#0F6B4F] text-white border-[#0F6B4F]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Prix sourcing */}
            <div>
              <Label required>Prix sourcing brut (FCFA)</Label>
              <TextInput type="number" value={product.sourcingPrice} onChange={e => set('sourcingPrice', e.target.value)}
                placeholder="Ex: 360" min="0" step="any" />
            </div>

            {/* Chine fields */}
            {isCN && (
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-sky-50/60 rounded-xl border border-sky-100">
                <div>
                  <Label>Poids (kg)</Label>
                  <TextInput type="number" value={product.weight} onChange={e => set('weight', e.target.value)}
                    placeholder="0.10" min="0" step="0.01" />
                </div>
                <div>
                  <Label>Prix du kilo (FCFA)</Label>
                  <TextInput type="number" value={product.pricePerKg} onChange={e => set('pricePerKg', e.target.value)}
                    placeholder="12 000" min="0" step="any" />
                </div>
                {product.shippingUnitCost && (
                  <div className="col-span-2 flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-sky-100 text-xs">
                    <span className="text-gray-500">Frais de livraison calculés</span>
                    <span className="font-bold text-sky-700">{parseInt(product.shippingUnitCost).toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
              </div>
            )}

            {/* COGS */}
            <div>
              <Label>Coût d'achat final (FCFA)</Label>
              <div className="relative">
                <input type="number" value={product.cogs} onChange={e => set('cogs', e.target.value)}
                  placeholder={calcCOGS() || '0'} min="0" step="any"
                  className="w-full px-3.5 py-2.5 pr-16 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none transition"
                />
                <button type="button" onClick={() => set('cogs', calcCOGS())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition">
                  Auto
                </button>
              </div>
            </div>

            {/* Prix de vente */}
            <div>
              <Label required>Prix de vente (FCFA)</Label>
              <div className="relative">
                <input type="number" value={product.sellingPrice} onChange={e => set('sellingPrice', e.target.value)}
                  placeholder="Ex: 1 560" min="0" step="any" required
                  className="w-full px-3.5 py-2.5 pr-24 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none transition"
                />
                <button type="button" onClick={() => set('sellingPrice', suggested())}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold bg-[#0F6B4F]/10 text-[#0F6B4F] rounded-lg hover:bg-[#0F6B4F]/20 transition">
                  Suggérer
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                {product.sourcingPrice && parseFloat(product.sourcingPrice) > 0
                  ? `Prix suggéré : ${suggested().toLocaleString('fr-FR')} FCFA`
                  : 'Saisissez un prix sourcing pour voir la suggestion'}
              </p>
            </div>

            {/* KPIs */}
            {showKpis && (
              <div className="flex gap-2 pt-1">
                <KpiPill label="Marge" value={`${margin}%`} color={marginColor} />
                <KpiPill label="Bénéfice" value={`${parseInt(profit).toLocaleString('fr-FR')} F`} color="text-emerald-600" />
                <KpiPill label="ROI" value={roi ? `${roi}%` : '—'} color="text-[#0F6B4F]" />
                <div className="flex-1 min-w-0 bg-gray-50 rounded-xl px-3 py-3 border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center">Ventes/mois</p>
                  <input type="number" value={product.monthlyEstimate} onChange={e => set('monthlyEstimate', e.target.value)}
                    className="w-full mt-0.5 text-sm font-bold text-center bg-transparent outline-none border-0 focus:ring-0 placeholder-gray-300"
                    placeholder="0" min="0"
                  />
                </div>
              </div>
            )}
          </SectionCard>

          {/* ── Marché ── */}
          <SectionCard icon="📊" color="" title="Analyse marché">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Demande</span>
                <Chips value={product.demand} onChange={v => set('demand', v)}
                  options={[{v:'low',l:'Faible'},{v:'medium',l:'Moyenne'},{v:'high',l:'Élevée'}]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Concurrence</span>
                <Chips value={product.competition} onChange={v => set('competition', v)}
                  options={[{v:'low',l:'Faible'},{v:'medium',l:'Moyenne'},{v:'high',l:'Élevée'}]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Tendance</span>
                <Chips value={product.trend} onChange={v => set('trend', v)}
                  options={[{v:'rising',l:'📈'},{v:'stable',l:'➡️'},{v:'falling',l:'📉'}]} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Fiabilité fourn.</span>
                <Chips value={product.supplierReliability} onChange={v => set('supplierReliability', v)}
                  options={[{v:'low',l:'Faible'},{v:'medium',l:'Moyenne'},{v:'high',l:'Élevée'}]} />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-semibold text-gray-500 flex-shrink-0">Nb fournisseurs</span>
                <input type="number" value={product.supplierCount} onChange={e => set('supplierCount', e.target.value)}
                  placeholder="0" min="0"
                  className="w-20 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Score d'opportunité</p>
              <div className="flex items-center gap-1.5">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => set('opportunityScore', n)}
                    className={`w-9 h-9 rounded-xl text-sm font-bold border transition-all ${
                      product.opportunityScore >= n
                        ? 'bg-amber-400 text-white border-amber-400'
                        : 'bg-white text-gray-300 border-gray-200 hover:border-amber-300'
                    }`}>
                    {n}
                  </button>
                ))}
                <span className="text-sm font-semibold text-gray-500 ml-1">{product.opportunityScore}/5</span>
              </div>
            </div>
          </SectionCard>

          {/* ── SWOT ── */}
          <SectionCard icon="⚡" color="" title="Forces & Faiblesses">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">✓ Avantages</p>
                {product.pros.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input type="text" value={p} onChange={e => updateList('pros', i, e.target.value)}
                      placeholder="Ex: Forte marge…"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition placeholder-gray-300"
                    />
                    {product.pros.length > 1 && (
                      <button type="button" onClick={() => removeItem('pros', i)}
                        className="p-1 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addItem('pros')}
                  className="text-xs font-semibold text-[#0F6B4F] hover:text-[#0a5740] flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg> Ajouter
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest">✗ Inconvénients</p>
                {product.cons.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input type="text" value={c} onChange={e => updateList('cons', i, e.target.value)}
                      placeholder="Ex: Forte concurrence…"
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none transition placeholder-gray-300"
                    />
                    {product.cons.length > 1 && (
                      <button type="button" onClick={() => removeItem('cons', i)}
                        className="p-1 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addItem('cons')}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg> Ajouter
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ── Notes ── */}
          <SectionCard icon="📝" color="" title="Notes">
            <textarea value={product.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Observations, idées marketing, notes importantes…"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/60 focus:bg-white focus:ring-2 focus:ring-[#0F6B4F]/20 focus:border-[#0F6B4F] outline-none transition resize-none placeholder-gray-300"
            />
          </SectionCard>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between gap-3 pb-8">
            <button type="button" onClick={() => navigate('/ecom/product-research')}
              className="px-5 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#0F6B4F] hover:bg-[#0a5740] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-sm">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sauvegarde…</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Sauvegarder</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFinder;
