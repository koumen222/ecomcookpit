import React, { useState, useEffect, useCallback } from 'react';
import { Save, Loader2, Check, GripVertical, Eye, EyeOff, Plus, Trash2, ChevronUp, ChevronDown, Settings2, ShoppingCart, Smartphone, Layers, Package } from 'lucide-react';
import { storeManageApi, storeProductsApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';
import defaultConfig from '../components/productSettings/defaultConfig.js';

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const mergeWithDefaults = (stored) => ({
  ...deepClone(defaultConfig),
  ...stored,
  general: {
    ...defaultConfig.general,
    ...(stored?.general || {}),
    formType: stored?.general?.formType || defaultConfig.general.formType,
  },
  form: {
    ...defaultConfig.form,
    fields: stored?.form?.fields?.length ? stored.form.fields : deepClone(defaultConfig.form.fields),
  },
  button: { ...defaultConfig.button, ...(stored?.button || {}) },
  design: { ...defaultConfig.design, ...(stored?.design || {}) },
  conversion: {
    ...defaultConfig.conversion,
    ...(stored?.conversion || {}),
    offers: stored?.conversion?.offers?.length
      ? stored.conversion.offers
      : deepClone(defaultConfig.conversion.offers),
  },
});

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all bg-white';

// ── Section card pour les champs du formulaire ────────────────────────────────
const FieldCard = ({ field, index, total, onMove, onToggle, onChange }) => (
  <div className={`bg-white rounded-xl border-2 transition-all ${field.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
    <div className="flex items-center gap-3 px-4 py-3">
      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <input
          className="w-full text-sm font-semibold text-gray-900 border-0 p-0 bg-transparent outline-none focus:outline-none"
          value={field.label}
          onChange={e => onChange(index, 'label', e.target.value)}
          placeholder="Libellé du champ"
        />
        <p className="text-[11px] text-gray-400">{field.name}</p>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onMove(index, -1)} disabled={index === 0}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition">
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button onClick={() => onToggle(index)}
          className="p-1 rounded-lg hover:bg-gray-100 transition" title={field.enabled ? 'Masquer' : 'Afficher'}>
          {field.enabled ? <Eye className="w-3.5 h-3.5 text-gray-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      </div>
    </div>
  </div>
);

// ── Preview du formulaire ─────────────────────────────────────────────────────
const FormPreview = ({ config, offersPreview = null }) => {
  const fields = config.form?.fields?.filter(f => f.enabled) || [];
  const btn = config.button || {};
  const design = config.design || {};
  const btnColor = design.buttonColor || '#ff6600';
  const btnRadius = design.borderRadius || '8px';
  const isEmbedded = config.general?.formType === 'embedded';

  // offersPreview: { offers, offersEnabled, accentColor, basePrice, currency, selectedIdx, setSelectedIdx }
  const showOffers = offersPreview?.offersEnabled && offersPreview?.offers?.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-gray-800">
            {isEmbedded ? 'Formulaire intégré dans la page' : 'Popup de commande'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <h3 className="text-base font-bold text-gray-900">Passer commande</h3>

        {/* Offres quantité — s'affichent avant les champs */}
        {showOffers && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Choisissez votre offre</p>
            <div className="space-y-1.5">
              {offersPreview.offers.map((offer, i) => (
                <OfferPreviewCard
                  key={i}
                  offer={offer}
                  basePrice={offersPreview.basePrice}
                  currency={offersPreview.currency}
                  accentColor={offersPreview.accentColor}
                  selected={offersPreview.selectedIdx === i}
                  onClick={() => offersPreview.setSelectedIdx(i)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Champs */}
        <div className="space-y-2.5">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-2">Aucun champ activé</p>
          ) : fields.map((field, i) => (
            <div key={i}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{field.label}</label>
              <div className="w-full h-9 rounded-lg border border-gray-200 bg-gray-50" />
            </div>
          ))}
        </div>

        {/* Bouton CTA */}
        <button
          className="w-full py-3 text-white font-bold text-sm flex flex-col items-center gap-0.5"
          style={{ backgroundColor: btnColor, borderRadius: btnRadius }}
        >
          <span>{btn.text || 'Commander maintenant'}</span>
          {btn.subtext && <span className="text-[11px] font-normal opacity-80">{btn.subtext}</span>}
        </button>
      </div>
    </div>
  );
};

const fmtPrice = (n, cur = 'XAF') => n ? `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} ${cur}` : '—';

// Calcule le prix final à partir du prix produit, de la qté et du % de réduction
// À partir d'un prix réduit saisi → calcule le prix barré et le %
const computeFromReducedPrice = (basePrice, qty, reducedPrice) => {
  const comparePrice = basePrice * qty;
  const normalPrice = comparePrice; // prix sans réduction
  const finalPrice = reducedPrice > 0 ? reducedPrice : normalPrice;
  const discountPct = finalPrice < normalPrice && normalPrice > 0
    ? Math.round((1 - finalPrice / normalPrice) * 100)
    : 0;
  return {
    price: finalPrice,
    comparePrice: discountPct > 0 ? normalPrice : 0,
    discountPct,
  };
};

// ── Aperçu d'une offre (identique au rendu boutique) ─────────────────────────
const OfferPreviewCard = ({ offer, basePrice, currency, accentColor, selected, onClick }) => {
  const displayPrice = offer.price > 0 ? offer.price : basePrice * (offer.qty || 1);
  const displayCompare = offer.comparePrice > 0 ? offer.comparePrice : 0;
  const disc = displayCompare > displayPrice && displayPrice > 0
    ? Math.round((1 - displayPrice / displayCompare) * 100) : 0;
  const color = accentColor || '#0F6B4F';

  return (
    <div onClick={onClick} style={{
      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
      border: selected ? `2px solid ${color}` : '1.5px solid #E5E7EB',
      backgroundColor: selected ? `${color}0d` : '#fff',
      display: 'flex', alignItems: 'center', gap: 10,
      transition: 'all 0.15s ease', boxShadow: selected ? `0 0 0 3px ${color}22` : 'none',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        border: selected ? `5px solid ${color}` : '2px solid #D1D5DB',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}</span>
          {offer.badge && (
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', backgroundColor: color, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.02em' }}>
              {offer.badge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color }}>{fmtPrice(displayPrice, currency)}</span>
          {disc > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmtPrice(displayCompare, currency)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: '#FEE2E2', padding: '1px 5px', borderRadius: 8 }}>-{disc}%</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Offres par produit ────────────────────────────────────────────────────────
const ProductOffersEditor = ({ products = [], onOffersChange }) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [offers, setOffers] = useState([]);
  const [offersEnabled, setOffersEnabled] = useState(false);
  const [accentColor, setAccentColor] = useState('#0F6B4F');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);

  const selectedProduct = products.find(p => p._id === selectedProductId) || null;
  const basePrice = selectedProduct?.price || 0;
  const currency = selectedProduct?.currency || 'XAF';

  // Notifier le parent pour mettre à jour l'aperçu
  useEffect(() => {
    onOffersChange?.({ offers, offersEnabled, accentColor, basePrice, currency });
  }, [offers, offersEnabled, accentColor, selectedProductId]);

  // Charger les offres existantes du produit sélectionné
  useEffect(() => {
    if (!selectedProductId) { setOffers([]); setOffersEnabled(false); return; }
    setLoadingProduct(true);
    storeProductsApi.getProduct(selectedProductId)
      .then(res => {
        const p = res.data?.data || res.data;
        const conv = p?.productPageConfig?.conversion || p?.conversion || {};
        setOffersEnabled(!!conv.offersEnabled);
        setAccentColor(conv.accentColor || p?.productPageConfig?.design?.buttonColor || '#0F6B4F');
        const bp = p?.price || 0;
        if (conv.offers?.length) {
          setOffers(conv.offers);
        } else {
          setOffers([
            { qty: 1, badge: '', selected: true,  ...computeFromReducedPrice(bp, 1, bp) },
            { qty: 2, badge: 'Le plus populaire', selected: false, ...computeFromReducedPrice(bp, 2, Math.round(bp * 2 * 0.90)) },
            { qty: 3, badge: 'Meilleure offre',   selected: false, ...computeFromReducedPrice(bp, 3, Math.round(bp * 3 * 0.80)) },
          ]);
        }
      })
      .catch(() => { setOffers([]); setOffersEnabled(false); })
      .finally(() => setLoadingProduct(false));
  }, [selectedProductId]);

  const updateOffer = (i, key, val) => {
    setOffers(prev => {
      const next = prev.map((o, idx) => {
        if (idx !== i) return o;
        const updated = { ...o, [key]: val };
        // Si on change qty ou price → recalcule % et comparePrice
        if (key === 'qty' || key === 'price') {
          const qty = key === 'qty' ? val : o.qty;
          const reducedPrice = key === 'price' ? val : o.price;
          return { ...updated, ...computeFromReducedPrice(basePrice, qty, reducedPrice) };
        }
        return updated;
      });
      return next;
    });
    setSaved(false);
  };

  const setDefault = (i) => {
    setOffers(prev => prev.map((o, idx) => ({ ...o, selected: idx === i })));
    setSaved(false);
  };

  const addOffer = () => {
    const qty = (offers[offers.length - 1]?.qty || 0) + 1;
    setOffers(prev => [...prev, { qty, badge: '', selected: false, ...computeFromReducedPrice(basePrice, qty, basePrice * qty) }]);
    setSaved(false);
  };

  const removeOffer = (i) => {
    setOffers(prev => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!selectedProductId) return;
    setSaving(true);
    try {
      const res = await storeProductsApi.getProduct(selectedProductId);
      const p = res.data?.data || res.data;
      const existingPPC = p?.productPageConfig || {};
      const existingConv = existingPPC?.conversion || {};
      await storeProductsApi.updateProduct(selectedProductId, {
        productPageConfig: {
          ...existingPPC,
          conversion: { ...existingConv, offersEnabled, offers, accentColor },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sélectionner un produit */}
      <div>
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Choisir un produit
        </div>
        <select className={inputCls} value={selectedProductId}
          onChange={e => { setSelectedProductId(e.target.value); setSaved(false); }}>
          <option value="">— Sélectionner un produit —</option>
          {products.map(p => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        {selectedProduct && (
          <div className="flex items-center gap-3 mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            {selectedProduct.images?.[0]?.url || selectedProduct.image ? (
              <img src={selectedProduct.images?.[0]?.url || selectedProduct.image} alt={selectedProduct.name}
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-gray-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{selectedProduct.name}</p>
              <p className="text-xs text-emerald-600 font-semibold">{fmtPrice(basePrice, currency)} / unité</p>
            </div>
          </div>
        )}
      </div>

      {selectedProductId && (
        loadingProduct ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Activer + couleur accent */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded accent-emerald-600 w-4 h-4" checked={offersEnabled}
                  onChange={e => { setOffersEnabled(e.target.checked); setSaved(false); }} />
                <span className="text-sm font-semibold text-gray-700">Activer les offres</span>
              </label>
              {offersEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">Couleur</span>
                  <input type="color" value={accentColor}
                    onChange={e => { setAccentColor(e.target.value); setSaved(false); }}
                    className="w-7 h-7 rounded-lg border border-gray-200 cursor-pointer" />
                </div>
              )}
            </div>

            {offersEnabled && (
              <div className="space-y-2">
                {offers.map((offer, i) => (
                  <div key={i} className="bg-white rounded-xl border-2 border-gray-100 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-600">Offre #{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer select-none">
                          <input type="radio" name="default-offer" className="accent-emerald-600"
                            checked={!!offer.selected} onChange={() => setDefault(i)} />
                          Par défaut
                        </label>
                        <button onClick={() => removeOffer(i)} className="p-0.5 text-gray-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Qté + Prix réduit (saisi) */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Quantité</div>
                        <input type="number" className={inputCls} value={offer.qty} min={1}
                          onChange={e => updateOffer(i, 'qty', Number(e.target.value))} />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 mb-1">Prix avec réduction</div>
                        <input type="number" className={inputCls} value={offer.price} min={0}
                          onChange={e => updateOffer(i, 'price', Number(e.target.value))}
                          placeholder={fmtPrice(basePrice * offer.qty, '')} />
                      </div>
                    </div>
                    {/* Résultat calculé : prix barré + % */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 bg-gray-50 rounded-lg px-2.5 py-2 flex items-center gap-2">
                        <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wide">Prix barré</span>
                        <span className="text-sm font-bold text-gray-400 line-through ml-auto">
                          {offer.comparePrice > 0 ? fmtPrice(offer.comparePrice, currency) : fmtPrice(basePrice * offer.qty, currency)}
                        </span>
                      </div>
                      <div className={`rounded-lg px-2.5 py-2 text-center ${offer.discountPct > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">Remise</div>
                        <div className={`text-sm font-black ${offer.discountPct > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                          {offer.discountPct > 0 ? `-${offer.discountPct}%` : '—'}
                        </div>
                      </div>
                    </div>
                    <input className={inputCls} value={offer.badge || ''}
                      onChange={e => updateOffer(i, 'badge', e.target.value)}
                      placeholder="Badge (ex: Le plus populaire)" />
                  </div>
                ))}
                <button onClick={addOffer}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition">
                  <Plus className="w-4 h-4" /> Ajouter une offre
                </button>
              </div>
            )}

            {/* Bouton sauvegarder */}
            <button onClick={handleSave} disabled={saving}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
                saved ? 'bg-green-500' : 'bg-emerald-600 hover:bg-emerald-700'
              } disabled:opacity-50`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement…' : saved ? 'Offres enregistrées ✓' : 'Enregistrer les offres'}
            </button>
          </>
        )
      )}

      {!selectedProductId && (
        <p className="text-center text-xs text-gray-400 py-6 italic">
          Sélectionne un produit pour configurer ses offres
        </p>
      )}
    </div>
  );
};

// ── Page principale ───────────────────────────────────────────────────────────
const BoutiqueFormBuilder = () => {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('fields');
  const [offersPreviewData, setOffersPreviewData] = useState(null); // { offers, offersEnabled, accentColor, basePrice, currency }
  const [offersPreviewSelected, setOffersPreviewSelected] = useState(0);
  const { activeStore } = useStore();
  const storeSubdomain = activeStore?.subdomain || '';

  useEffect(() => {
    (async () => {
      try {
        const [configRes, productsRes] = await Promise.all([
          storeManageApi.getStoreConfig(),
          storeProductsApi.getProducts({ limit: 200 }).catch(() => null),
        ]);
        const raw = configRes.data?.data || configRes.data || {};
        const ppc = raw.storeSettings?.productPageConfig || raw.productPageConfig || null;
        setConfig(mergeWithDefaults(ppc));
        const prods = productsRes?.data?.data?.products || productsRes?.data?.data || productsRes?.data?.products || [];
        setProducts(Array.isArray(prods) ? prods : []);
      } catch {
        setConfig(mergeWithDefaults(null));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await storeManageApi.getStoreConfig();
      const raw = res.data?.data || res.data || {};
      const existing = raw.storeSettings?.productPageConfig || raw.productPageConfig || {};
      await storeManageApi.updateStoreConfig({ productPageConfig: { ...existing, ...config } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const update = useCallback((updater) => {
    setConfig(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    setSaved(false);
  }, []);

  // Champs handlers
  const moveField = (index, dir) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= config.form.fields.length) return;
    const next = [...config.form.fields];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const toggleField = (index) => {
    const next = config.form.fields.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const changeField = (index, key, val) => {
    const next = config.form.fields.map((f, i) => i === index ? { ...f, [key]: val } : f);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const addField = () => {
    const next = [...config.form.fields, { name: `champ_${Date.now()}`, label: 'Nouveau champ', enabled: true }];
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  const removeField = (index) => {
    const next = config.form.fields.filter((_, i) => i !== index);
    update(c => ({ ...c, form: { ...c.form, fields: next } }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-emerald-500" />
        </div>
        <span className="text-sm font-medium text-gray-500">Chargement…</span>
      </div>
    </div>
  );

  const TABS = [
    { id: 'fields', label: 'Champs', icon: Layers },
    { id: 'button', label: 'Bouton', icon: ShoppingCart },
    { id: 'design', label: 'Design', icon: Settings2 },
    { id: 'offers', label: 'Offres', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <ShoppingCart size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight">Formulaire de commande</h1>
                <p className="text-[11px] sm:text-xs text-gray-500 font-medium">Configure les champs et le bouton du formulaire de commande</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {storeSubdomain && (
                <a href={`https://${storeSubdomain}.scalor.net`} target="_blank" rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition">
                  <Eye size={14} /> Voir la boutique
                </a>
              )}
              <button onClick={handleSave} disabled={saving}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  saved ? 'bg-green-500 shadow-green-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
                {saving ? 'Sauvegarde…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Type de formulaire */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Type d'affichage du formulaire</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'popup', label: 'Popup', desc: 'S\'ouvre en modal au clic sur le bouton' },
              { id: 'embedded', label: 'Intégré', desc: 'Formulaire affiché directement dans la page produit' },
            ].map(opt => {
              const selected = (config.general?.formType || 'popup') === opt.id;
              return (
                <button key={opt.id} onClick={() => update(c => ({ ...c, general: { ...c.general, formType: opt.id } }))}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${selected ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="font-bold text-sm text-gray-900 mb-0.5">{opt.label}</div>
                  <div className="text-[11px] text-gray-500">{opt.desc}</div>
                  {selected && <div className="mt-2 text-[10px] text-emerald-600 font-bold">✓ Sélectionné</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel gauche: éditeur */}
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon size={13} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Contenu des tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              {/* ─── Champs ─── */}
              {activeTab === 'fields' && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-800">Champs du formulaire</h3>
                    <span className="text-xs text-gray-400">
                      {config.form.fields.filter(f => f.enabled).length}/{config.form.fields.length} actifs
                    </span>
                  </div>
                  <div className="space-y-2">
                    {config.form.fields.map((field, idx) => (
                      <FieldCard
                        key={field.name + idx}
                        field={field}
                        index={idx}
                        total={config.form.fields.length}
                        onMove={moveField}
                        onToggle={toggleField}
                        onChange={changeField}
                      />
                    ))}
                  </div>
                  <button onClick={addField}
                    className="w-full flex items-center justify-center gap-1 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-emerald-400 hover:text-emerald-600 transition mt-1">
                    <Plus size={14} /> Ajouter un champ
                  </button>
                </>
              )}

              {/* ─── Bouton ─── */}
              {activeTab === 'button' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Bouton d'action (CTA)</h3>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Texte principal</label>
                    <input className={inputCls} value={config.button?.text || ''}
                      onChange={e => update(c => ({ ...c, button: { ...c.button, text: e.target.value } }))}
                      placeholder="Commander maintenant" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Sous-texte</label>
                    <input className={inputCls} value={config.button?.subtext || ''}
                      onChange={e => update(c => ({ ...c, button: { ...c.button, subtext: e.target.value } }))}
                      placeholder="Paiement à la livraison" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Animation</label>
                    <select className={inputCls} value={config.button?.animation || 'none'}
                      onChange={e => update(c => ({ ...c, button: { ...c.button, animation: e.target.value } }))}>
                      <option value="none">Aucune</option>
                      <option value="pulse">Pulse</option>
                      <option value="bounce">Bounce</option>
                      <option value="shake">Shake</option>
                      <option value="glow">Glow</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ─── Design ─── */}
              {activeTab === 'design' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-800 mb-2">Couleurs & Style</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'buttonColor', label: 'Bouton', def: '#ff6600' },
                      { key: 'backgroundColor', label: 'Fond', def: '#ffffff' },
                      { key: 'textColor', label: 'Texte', def: '#000000' },
                      { key: 'badgeColor', label: 'Badge', def: '#EF4444' },
                    ].map(c => (
                      <div key={c.key} className="flex items-center gap-2">
                        <input type="color"
                          value={config.design?.[c.key] || c.def}
                          onChange={e => update(cfg => ({ ...cfg, design: { ...cfg.design, [c.key]: e.target.value } }))}
                          className="w-8 h-8 border border-gray-200 rounded-lg cursor-pointer flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-gray-400">{c.label}</div>
                          <input
                            value={config.design?.[c.key] || c.def}
                            onChange={e => update(cfg => ({ ...cfg, design: { ...cfg.design, [c.key]: e.target.value } }))}
                            className="w-full text-[11px] font-mono text-gray-600 border-0 p-0 bg-transparent outline-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Arrondi du bouton ({config.design?.borderRadius || '8px'})
                    </label>
                    <input type="range" min="0" max="40" className="w-full"
                      value={parseInt(config.design?.borderRadius) || 8}
                      onChange={e => update(c => ({ ...c, design: { ...c.design, borderRadius: `${e.target.value}px` } }))} />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>Carré</span><span>Arrondi</span><span>Pill</span>
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded"
                        checked={config.design?.shadow !== false}
                        onChange={e => update(c => ({ ...c, design: { ...c.design, shadow: e.target.checked } }))} />
                      <span className="text-[12px] font-medium text-gray-700">Ombre sur le bouton</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ─── Offres ─── */}
              {activeTab === 'offers' && (
                <ProductOffersEditor
                  products={products}
                  onOffersChange={data => { setOffersPreviewData(data); setOffersPreviewSelected(data.offers?.findIndex(o => o.selected) ?? 0); }}
                />
              )}
            </div>
          </div>

          {/* Panel droit: aperçu */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-600">Aperçu du formulaire</span>
            </div>
            <FormPreview
              config={config}
              offersPreview={offersPreviewData ? {
                ...offersPreviewData,
                selectedIdx: offersPreviewSelected,
                setSelectedIdx: setOffersPreviewSelected,
              } : null}
            />

            {/* Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[12px] text-amber-800">
              <p className="font-semibold mb-1">ℹ️ Comment ça fonctionne ?</p>
              <ul className="space-y-1 text-amber-700">
                <li>• En mode <strong>Popup</strong> : un bouton CTA s'affiche sur la page produit, et le formulaire s'ouvre en modal au clic.</li>
                <li>• En mode <strong>Intégré</strong> : le formulaire s'affiche directement dans la page produit sans popup.</li>
                <li>• Les champs activés ici s'appliquent à tous les produits de la boutique.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoutiqueFormBuilder;
