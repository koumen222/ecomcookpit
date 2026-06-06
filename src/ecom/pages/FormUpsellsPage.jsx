import React, { useEffect, useState } from 'react';
import { ArrowUpDown, Plus, Trash2, Edit3, ChevronUp, ChevronDown, ToggleLeft, ToggleRight, CheckSquare, X, Tag, Zap, AlertTriangle, GripVertical, Check, Package } from 'lucide-react';
import { storeProductsApi } from '../services/storeApi.js';

// ── Tab IDs ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'upsells', label: '1-Click Upsells', icon: ArrowUpDown, desc: 'Offres séquentielles avant/après achat' },
  { id: 'bump', label: 'Order Bump', icon: CheckSquare, desc: 'Case à cocher au checkout' },
  { id: 'exit', label: 'Offres supplémentaires', icon: AlertTriangle, desc: 'Pop-up de sortie formulaire' },
];

// ── Shared helpers ─────────────────────────────────────────────────────────
const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} className="flex-shrink-0">
    {on
      ? <ToggleRight className="w-9 h-9 text-green-600" strokeWidth={1.5} />
      : <ToggleLeft className="w-9 h-9 text-gray-300" strokeWidth={1.5} />}
  </button>
);

const Badge = ({ children, color = 'gray' }) => {
  const cls = {
    green: 'bg-green-50 text-green-700 border-green-100',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    red: 'bg-red-50 text-red-600 border-red-100',
  }[color] || 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cls}`}>{children}</span>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle, cta, onCta }) => (
  <div className="bg-white rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
      <Icon className="w-6 h-6 text-gray-400" strokeWidth={1.5} />
    </div>
    <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
    <p className="text-xs text-gray-400 mb-5">{subtitle}</p>
    {cta && (
      <button
        onClick={onCta}
        className="inline-flex items-center gap-2 h-9 px-4 bg-gray-900 text-white rounded-xl text-xs font-medium hover:bg-gray-800 transition-colors mx-auto"
      >
        <Plus className="w-3.5 h-3.5" /> {cta}
      </button>
    )}
  </div>
);

// ── Modal base ─────────────────────────────────────────────────────────────
const Modal = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
    <div className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-3xl sm:rounded-2xl overflow-hidden">
      <div className="pt-3 pb-1 flex justify-center sm:hidden">
        <div className="w-10 h-1 bg-gray-200 rounded-full" />
      </div>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

const FormField = ({ label, hint, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    {hint && <p className="text-[10px] text-gray-400 mb-1.5">{hint}</p>}
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input
    className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all bg-white placeholder:text-gray-400"
    {...props}
  />
);

const Textarea = ({ ...props }) => (
  <textarea
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all bg-white placeholder:text-gray-400 resize-none"
    rows={3}
    {...props}
  />
);

const DiscountTypeSelector = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[
      { id: 'percent', label: '% Remise' },
      { id: 'fixed', label: 'Montant fixe' },
      { id: 'free', label: 'Gratuit' },
    ].map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`flex-1 h-9 rounded-xl text-xs font-medium border transition-all ${
          value === t.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

const readProducts = (response) => {
  const raw = response?.data?.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.products)) return raw.products;
  return [];
};

const getProductId = (product) => product?._id || product?.id || '';
const getProductName = (product) => product?.name || product?.title || 'Produit sans nom';

const normalizeUpsellOffer = (offer) => ({
  id: offer.id,
  targetProductId: offer.targetProductId,
  targetProductName: offer.targetProductName,
  title: offer.title,
  productName: offer.productName,
  originalPrice: offer.originalPrice,
  offerPrice: offer.offerPrice,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  description: offer.description,
  isActive: offer.isActive,
});

const normalizeExitOffer = (offer) => ({
  id: offer.id,
  targetProductId: offer.targetProductId,
  targetProductName: offer.targetProductName,
  title: offer.title,
  desc: offer.desc,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  couponCode: offer.couponCode,
  triggerDelay: offer.triggerDelay,
  isActive: offer.isActive,
});

const ProductTargetSelector = ({ value, onChange, products, loading, error }) => {
  const selected = products.find(product => getProductId(product) === value);

  return (
    <div className="space-y-2">
      <select
        value={value || ''}
        disabled={loading || products.length === 0}
        onChange={(event) => {
          const product = products.find(item => getProductId(item) === event.target.value);
          onChange({
            targetProductId: event.target.value,
            targetProductName: product ? getProductName(product) : '',
          });
        }}
        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">{loading ? 'Chargement des produits...' : 'Choisir le produit concerné'}</option>
        {products.map(product => (
          <option key={getProductId(product)} value={getProductId(product)}>
            {getProductName(product)}
          </option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
          <Package size={13} />
          <span className="font-medium">Cette offre s'applique à : {getProductName(selected)}</span>
        </div>
      )}
      {!loading && products.length === 0 && (
        <p className="text-[10px] text-red-500">{error || 'Aucun produit disponible. Créez un produit avant de configurer cette offre.'}</p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — 1-Click Upsells
// ═══════════════════════════════════════════════════════════════════════════
const BLANK_UPSELL = { id: null, targetProductId: '', targetProductName: '', title: '', productName: '', originalPrice: '', offerPrice: '', discountType: 'percent', discountValue: '', description: '', isActive: true };

const UpsellsTab = ({ products, loadingProducts, productError, saveProductUpsells }) => {
  const [offers, setOffers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_UPSELL);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingProducts || loaded) return;
    const existing = [];
    for (const product of products) {
      const upsells = product?.productPageConfig?.upsells;
      if (upsells?.offers?.length) {
        for (const offer of upsells.offers) {
          existing.push({ ...offer, id: offer.id || Date.now() + Math.random(), targetProductId: getProductId(product), targetProductName: getProductName(product) });
        }
      }
    }
    setOffers(existing);
    setLoaded(true);
  }, [products, loadingProducts, loaded]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK_UPSELL, id: Date.now() });
    setFormError('');
    setShowModal(true);
  };
  const openEdit = (o) => { setEditing(o.id); setForm({ ...o }); setFormError(''); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const syncUpsellsForProduct = async (productId, nextOffers) => {
    if (!productId) return;
    const productOffers = nextOffers.filter(offer => offer.targetProductId === productId).slice(0, 5);
    await saveProductUpsells(productId, (upsells = {}) => ({
      ...upsells,
      offers: productOffers.map(normalizeUpsellOffer),
    }));
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (!form.targetProductId) {
      setFormError("Choisissez le produit sur lequel cette offre va s'appliquer.");
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const previousOffer = offers.find(o => o.id === editing);
      const nextOffers = editing
        ? offers.map(o => o.id === editing ? { ...form } : o)
        : [...offers, { ...form }];

      if (!editing && offers.length >= 5) return;
      await syncUpsellsForProduct(form.targetProductId, nextOffers);
      if (previousOffer?.targetProductId && previousOffer.targetProductId !== form.targetProductId) {
        await syncUpsellsForProduct(previousOffer.targetProductId, nextOffers);
      }
      setOffers(nextOffers);
      closeModal();
    } catch {
      setFormError("Impossible d'enregistrer cette offre sur le produit choisi.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const removed = offers.find(o => o.id === id);
    const nextOffers = offers.filter(o => o.id !== id);
    setOffers(nextOffers);
    if (removed?.targetProductId) {
      await syncUpsellsForProduct(removed.targetProductId, nextOffers).catch(() => {});
    } else {
      for (const product of products) {
        const upsells = product?.productPageConfig?.upsells;
        if (upsells?.offers?.some(o => o.id === id)) {
          await syncUpsellsForProduct(getProductId(product), nextOffers).catch(() => {});
          break;
        }
      }
    }
  };
  const toggle = async (id) => {
    const nextOffers = offers.map(o => o.id === id ? { ...o, isActive: !o.isActive } : o);
    const changed = nextOffers.find(o => o.id === id);
    setOffers(nextOffers);
    if (changed?.targetProductId) await syncUpsellsForProduct(changed.targetProductId, nextOffers).catch(() => {});
  };
  const move = async (id, dir) => {
    const idx = offers.findIndex(o => o.id === id);
    const next = idx + dir;
    if (next < 0 || next >= offers.length) return;
    const arr = [...offers];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    setOffers(arr);
    const changedProductIds = [...new Set([arr[idx]?.targetProductId, arr[next]?.targetProductId].filter(Boolean))];
    await Promise.all(changedProductIds.map(productId => syncUpsellsForProduct(productId, arr).catch(() => {})));
  };

  const fmt = (n) => n ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—';

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
          <Zap size={14} className="text-gray-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800 mb-0.5">Comment ça marche</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Jusqu'à <strong>5 offres</strong> affichées en séquence. Le client accepte ou refuse — l'offre suivante apparaît. Glissez pour réordonner.
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">{offers.length} / 5 offres</span>
          {offers.length >= 5 && <Badge color="gray">Maximum atteint</Badge>}
        </div>
        <button
          onClick={openNew}
          disabled={offers.length >= 5}
          className="h-9 px-3.5 bg-gray-900 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={13} /> Ajouter une offre
        </button>
      </div>

      {/* List */}
      {offers.length === 0 ? (
        <EmptyState
          icon={ArrowUpDown}
          title="Aucune offre configurée"
          subtitle="Créez jusqu'à 5 upsells séquentiels pour maximiser la valeur de chaque commande."
          cta="Créer une offre"
          onCta={openNew}
        />
      ) : (
        <div className="space-y-3">
          {offers.map((o, i) => (
            <div key={o.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!o.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 p-4">
                {/* Drag handle + order */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button onClick={() => move(o.id, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors">
                    <ChevronUp size={14} />
                  </button>
                  <span className="text-[10px] font-bold text-gray-400 w-4 text-center">{i + 1}</span>
                  <button onClick={() => move(o.id, 1)} disabled={i === offers.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-0 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <ArrowUpDown size={16} className="text-white" strokeWidth={1.75} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{o.title}</p>
                    <Badge color={o.isActive ? 'green' : 'gray'}>{o.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Package size={10} /> {o.targetProductName || 'Produit à choisir'}</span>
                    <span className="text-gray-300">·</span>
                    <span>{o.productName || '—'}</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-medium text-green-700">{fmt(o.offerPrice)}</span>
                    {o.originalPrice && <span className="line-through text-gray-400">{fmt(o.originalPrice)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle on={o.isActive} onChange={() => toggle(o.id)} />
                  <button onClick={() => openEdit(o)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => remove(o.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {o.description && (
                <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                  <p className="text-xs text-gray-500 line-clamp-1">{o.description}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? "Modifier l'offre" : 'Nouvelle offre'}
          subtitle="1-Click Upsell"
          onClose={closeModal}
        >
          <div className="space-y-4">
            <FormField label="Titre de l'offre *">
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Protection expédition" />
            </FormField>
            <FormField label="Produit concerné *" hint="L'upsell sera affiché uniquement quand ce produit est commandé.">
              <ProductTargetSelector
                value={form.targetProductId}
                onChange={(selection) => setForm(f => ({ ...f, ...selection }))}
                products={products}
                loading={loadingProducts}
                error={productError}
              />
            </FormField>
            <FormField label="Nom du produit">
              <Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="Ex: Pack Protection Premium" />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Pourquoi le client devrait accepter cette offre…" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Prix original (FCFA)">
                <Input type="number" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))} placeholder="3000" />
              </FormField>
              <FormField label="Prix offert (FCFA)">
                <Input type="number" value={form.offerPrice} onChange={e => setForm(f => ({ ...f, offerPrice: e.target.value }))} placeholder="1500" />
              </FormField>
            </div>
            <FormField label="Type de réduction">
              <DiscountTypeSelector value={form.discountType} onChange={v => setForm(f => ({ ...f, discountType: v }))} />
            </FormField>
            {form.discountType !== 'free' && (
              <FormField label={form.discountType === 'percent' ? 'Pourcentage de remise' : 'Montant de la remise (FCFA)'}>
                <Input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} placeholder={form.discountType === 'percent' ? '30' : '1000'} />
              </FormField>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">Activer cette offre</span>
              <Toggle on={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>
            {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{formError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={closeModal} className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={saving} className="flex-1 h-11 bg-green-600 text-white rounded-2xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Enregistrer' : "Créer l'offre"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Order Bump (1-Tick)
// ═══════════════════════════════════════════════════════════════════════════
const BUMP_PRESETS = [
  { id: 'shipping', label: 'Protection expédition', desc: 'Protège contre perte ou dommage' },
  { id: 'priority', label: 'Traitement prioritaire', desc: 'Traitement de la commande en priorité' },
  { id: 'warranty', label: 'Extension de garantie', desc: 'Prolonger la garantie à 2 ans' },
  { id: 'gift', label: 'Emballage cadeau', desc: 'Emballage premium avec message' },
  { id: 'custom', label: 'Personnalisé', desc: 'Définir votre propre offre' },
];

const BLANK_BUMP = { preset: 'shipping', targetProductId: '', targetProductName: '', title: '', desc: '', price: '', isActive: false };

const OrderBumpTab = ({ products, loadingProducts, productError, saveProductUpsells }) => {
  const [bump, setBump] = useState(BLANK_BUMP);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingProducts || loaded) return;
    for (const product of products) {
      const bumpData = product?.productPageConfig?.upsells?.bump;
      if (bumpData && bumpData.title) {
        setBump({ ...BLANK_BUMP, ...bumpData, targetProductId: getProductId(product), targetProductName: getProductName(product) });
        break;
      }
    }
    setLoaded(true);
  }, [products, loadingProducts, loaded]);

  const preset = BUMP_PRESETS.find(p => p.id === bump.preset);

  const selectPreset = (p) => {
    if (p.id === 'custom') {
      setBump(b => ({ ...b, preset: 'custom' }));
    } else {
      setBump(b => ({ ...b, preset: p.id, title: p.label, desc: p.desc }));
    }
  };

  const save = async () => {
    if (!bump.targetProductId) {
      setFormError("Choisissez le produit où afficher ce Order Bump.");
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await saveProductUpsells(bump.targetProductId, (upsells = {}) => ({
        ...upsells,
        bump: { ...bump },
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setFormError("Impossible d'enregistrer ce Order Bump sur le produit choisi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
          <CheckSquare size={14} className="text-gray-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800 mb-0.5">1-Tick Upsell</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Une case à cocher affichée dans le formulaire. Le client ajoute l'option d'un seul clic — idéal pour des petits suppléments à haute valeur perçue.
          </p>
        </div>
      </div>

      {/* Activation toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Activer le Order Bump</p>
          <p className="text-xs text-gray-400 mt-0.5">Afficher la case à cocher sur le formulaire de commande</p>
        </div>
        <Toggle on={bump.isActive} onChange={v => setBump(b => ({ ...b, isActive: v }))} />
      </div>

      {/* Preset selector */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type d'offre</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BUMP_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              className={`text-left px-3 py-3 rounded-xl border-2 transition-all ${
                bump.preset === p.id ? 'border-green-600 bg-green-50' : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <p className={`text-xs font-semibold leading-tight ${bump.preset === p.id ? 'text-green-800' : 'text-gray-700'}`}>{p.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Configuration</p>
        <div className="space-y-3">
          <FormField label="Produit concerné *" hint="La case Order Bump sera visible dans le checkout de ce produit.">
            <ProductTargetSelector
              value={bump.targetProductId}
              onChange={(selection) => setBump(b => ({ ...b, ...selection }))}
              products={products}
              loading={loadingProducts}
              error={productError}
            />
          </FormField>
          <FormField label="Titre affiché *">
            <Input value={bump.title} onChange={e => setBump(b => ({ ...b, title: e.target.value }))} placeholder="Ex: Protection expédition" />
          </FormField>
          <FormField label="Description">
            <Textarea value={bump.desc} onChange={e => setBump(b => ({ ...b, desc: e.target.value }))} placeholder="Texte affiché à côté de la case…" rows={2} />
          </FormField>
          <FormField label="Prix supplémentaire (FCFA)" hint="Montant ajouté à la commande si coché">
            <Input type="number" value={bump.price} onChange={e => setBump(b => ({ ...b, price: e.target.value }))} placeholder="500" />
          </FormField>
        </div>
      </div>

      {/* Preview */}
      {bump.title && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aperçu dans le formulaire</p>
          {bump.targetProductName && (
            <p className="mb-2 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
              <Package size={11} /> Produit : {bump.targetProductName}
            </p>
          )}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded border-2 border-green-600 bg-green-600 flex items-center justify-center mt-0.5 shrink-0">
                <Check size={11} className="text-white" strokeWidth={3} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{bump.title} {bump.price && <span className="text-green-700">+{Number(bump.price).toLocaleString('fr-FR')} FCFA</span>}</p>
                {bump.desc && <p className="text-xs text-gray-500 mt-0.5">{bump.desc}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className={`w-full h-11 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
          saved ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-60'
        }`}
      >
        {saving ? 'Enregistrement...' : saved ? <><Check size={15} /> Enregistré</> : 'Enregistrer le Order Bump'}
      </button>
      {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{formError}</p>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Tab 3 — Exit-intent / Offres supplémentaires
// ═══════════════════════════════════════════════════════════════════════════
const BLANK_EXIT = { id: null, targetProductId: '', targetProductName: '', title: '', desc: '', discountType: 'percent', discountValue: '', couponCode: '', triggerDelay: '3', isActive: true };

const ExitOffersTab = ({ products, loadingProducts, productError, saveProductUpsells }) => {
  const [offers, setOffers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_EXIT);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loadingProducts || loaded) return;
    const existing = [];
    for (const product of products) {
      const exitData = product?.productPageConfig?.upsells?.exit;
      if (exitData && exitData.title) {
        existing.push({ ...exitData, id: exitData.id || Date.now() + Math.random(), targetProductId: getProductId(product), targetProductName: getProductName(product) });
      }
    }
    setOffers(existing);
    setLoaded(true);
  }, [products, loadingProducts, loaded]);

  const openNew = () => { setEditing(null); setForm({ ...BLANK_EXIT, id: Date.now() }); setFormError(''); setShowModal(true); };
  const openEdit = (o) => { setEditing(o.id); setForm({ ...o }); setFormError(''); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const save = async () => {
    if (!form.title.trim()) return;
    if (!form.targetProductId) {
      setFormError("Choisissez le produit sur lequel cette offre supplémentaire va s'appliquer.");
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await saveProductUpsells(form.targetProductId, (upsells = {}) => ({
        ...upsells,
        exit: normalizeExitOffer(form),
      }));
      if (editing) {
        setOffers(prev => prev.map(o => o.id === editing ? { ...form } : o));
      } else {
        setOffers(prev => [...prev, { ...form }]);
      }
      closeModal();
    } catch {
      setFormError("Impossible d'enregistrer cette offre sur le produit choisi.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const removed = offers.find(o => o.id === id);
    setOffers(prev => prev.filter(o => o.id !== id));
    let targetId = removed?.targetProductId;
    if (!targetId) {
      const p = products.find(pr => pr?.productPageConfig?.upsells?.exit?.id === id);
      if (p) targetId = getProductId(p);
    }
    if (targetId) {
      await saveProductUpsells(targetId, (upsells = {}) => ({
        ...upsells,
        exit: null,
      })).catch(() => {});
    }
  };
  const toggle = async (id) => {
    const nextOffers = offers.map(o => o.id === id ? { ...o, isActive: !o.isActive } : o);
    const changed = nextOffers.find(o => o.id === id);
    setOffers(nextOffers);
    if (changed?.targetProductId) {
      await saveProductUpsells(changed.targetProductId, (upsells = {}) => ({
        ...upsells,
        exit: normalizeExitOffer(changed),
      })).catch(() => {});
    }
  };

  const discountLabel = (o) => {
    if (o.discountType === 'percent') return `${o.discountValue}% de remise`;
    if (o.discountType === 'fixed') return `${Number(o.discountValue).toLocaleString('fr-FR')} FCFA`;
    return 'Gratuit';
  };

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle size={14} className="text-gray-600" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-800 mb-0.5">Comment ça marche</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Un pop-up s'affiche quand le visiteur tente de fermer le formulaire. Récupérez des ventes perdues en proposant une remise de dernière chance.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{offers.length} offre{offers.length !== 1 ? 's' : ''}</span>
        <button
          onClick={openNew}
          className="h-9 px-3.5 bg-gray-900 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-gray-800 transition-colors"
        >
          <Plus size={13} /> Ajouter une offre
        </button>
      </div>

      {/* List */}
      {offers.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Aucune offre de sortie"
          subtitle="Créez un pop-up d'exit intent pour récupérer les visiteurs qui ferment le formulaire."
          cta="Créer une offre"
          onCta={openNew}
        />
      ) : (
        <div className="space-y-3">
          {offers.map(o => (
            <div key={o.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${!o.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} className="text-white" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{o.title}</p>
                    <Badge color={o.isActive ? 'green' : 'gray'}>{o.isActive ? 'Actif' : 'Inactif'}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="font-medium text-green-700">{discountLabel(o)}</span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1"><Package size={10} /> {o.targetProductName || 'Produit à choisir'}</span>
                    {o.couponCode && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="flex items-center gap-1">
                          <Tag size={10} strokeWidth={1.75} />
                          <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{o.couponCode}</code>
                        </span>
                      </>
                    )}
                    <span className="text-gray-300">·</span>
                    <span>Délai : {o.triggerDelay}s</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle on={o.isActive} onChange={() => toggle(o.id)} />
                  <button onClick={() => openEdit(o)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => remove(o.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {o.desc && (
                <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                  <p className="text-xs text-gray-500 line-clamp-1">{o.desc}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? "Modifier l'offre" : 'Nouvelle offre'}
          subtitle="Pop-up de sortie"
          onClose={closeModal}
        >
          <div className="space-y-4">
            <FormField label="Titre du pop-up *">
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Attendez ! Voici 10% de remise" />
            </FormField>
            <FormField label="Produit concerné *" hint="Le pop-up sera rattaché uniquement à ce produit.">
              <ProductTargetSelector
                value={form.targetProductId}
                onChange={(selection) => setForm(f => ({ ...f, ...selection }))}
                products={products}
                loading={loadingProducts}
                error={productError}
              />
            </FormField>
            <FormField label="Message">
              <Textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Texte principal du pop-up…" />
            </FormField>
            <FormField label="Type de réduction">
              <DiscountTypeSelector value={form.discountType} onChange={v => setForm(f => ({ ...f, discountType: v }))} />
            </FormField>
            {form.discountType !== 'free' && (
              <FormField label={form.discountType === 'percent' ? 'Pourcentage (%)' : 'Montant (FCFA)'}>
                <Input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))} placeholder={form.discountType === 'percent' ? '10' : '2000'} />
              </FormField>
            )}
            <FormField label="Code promo" hint="Optionnel — code à appliquer automatiquement">
              <Input value={form.couponCode} onChange={e => setForm(f => ({ ...f, couponCode: e.target.value.toUpperCase() }))} placeholder="PROMO10" />
            </FormField>
            <FormField label="Délai d'affichage (secondes)" hint="Temps avant que le pop-up s'affiche après la tentative de fermeture">
              <Input type="number" value={form.triggerDelay} onChange={e => setForm(f => ({ ...f, triggerDelay: e.target.value }))} placeholder="3" min="0" max="30" />
            </FormField>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-gray-700">Activer cette offre</span>
              <Toggle on={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>
            {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{formError}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={closeModal} className="flex-1 h-11 bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium hover:bg-gray-200 transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={saving} className="flex-1 h-11 bg-green-600 text-white rounded-2xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Enregistrer' : "Créer l'offre"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════
const FormUpsellsPage = () => {
  const [activeTab, setActiveTab] = useState('upsells');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoadingProducts(true);
    storeProductsApi.getProducts({ limit: 200 })
      .then((response) => {
        if (!mounted) return;
        setProducts(readProducts(response));
        setProductError('');
      })
      .catch(() => {
        if (!mounted) return;
        setProducts([]);
        setProductError('Impossible de charger les produits.');
      })
      .finally(() => {
        if (mounted) setLoadingProducts(false);
      });
    return () => { mounted = false; };
  }, []);

  const saveProductUpsells = async (productId, updater) => {
    const localProduct = products.find(product => getProductId(product) === productId);
    const product = localProduct || (await storeProductsApi.getProduct(productId)).data?.data;
    const currentConfig = product?.productPageConfig || {};
    const currentUpsells = currentConfig.upsells || {};
    const nextUpsells = updater(currentUpsells);
    const nextConfig = {
      ...currentConfig,
      upsells: nextUpsells,
    };

    await storeProductsApi.updateProduct(productId, { productPageConfig: nextConfig });
    setProducts(prev => prev.map(item => (
      getProductId(item) === productId ? { ...item, productPageConfig: nextConfig } : item
    )));
    return nextConfig;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Upsells & Downsells</h1>
        <p className="text-sm text-gray-400 mt-0.5">Augmentez la valeur de chaque commande avec des offres ciblées</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-1.5 mb-6 flex gap-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col sm:flex-row items-center sm:justify-center gap-1 sm:gap-2 px-2 py-2.5 rounded-lg transition-all text-center sm:text-left ${
                active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={14} strokeWidth={1.75} className={active ? 'text-white' : 'text-gray-400'} />
              <span className={`text-xs font-semibold leading-tight ${active ? 'text-white' : 'text-gray-700'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'upsells' && <UpsellsTab products={products} loadingProducts={loadingProducts} productError={productError} saveProductUpsells={saveProductUpsells} />}
      {activeTab === 'bump' && <OrderBumpTab products={products} loadingProducts={loadingProducts} productError={productError} saveProductUpsells={saveProductUpsells} />}
      {activeTab === 'exit' && <ExitOffersTab products={products} loadingProducts={loadingProducts} productError={productError} saveProductUpsells={saveProductUpsells} />}
    </div>
  );
};

export default FormUpsellsPage;
