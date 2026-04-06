import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext.jsx';
import { storeProductsApi, quantityOffersApi } from '../../services/storeApi';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Edit3, GripVertical,
  X, ChevronDown, ChevronUp, Package, Check, Palette
} from 'lucide-react';

// ── Drag-to-reorder hook ──────────────────────────────────────────────────────
function useDraggableList(list, setList) {
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const onDragStart = (idx) => { dragItem.current = idx; };
  const onDragEnter = (idx) => { dragOverItem.current = idx; };
  const onDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const next = [...list];
    const [removed] = next.splice(dragItem.current, 1);
    next.splice(dragOverItem.current, 0, removed);
    dragItem.current = null;
    dragOverItem.current = null;
    setList(next);
  };

  return { onDragStart, onDragEnter, onDragEnd };
}

// ── Offer edit modal ──────────────────────────────────────────────────────────
const OfferEditModal = ({ offer, index, currency, onSave, onClose }) => {
  const [local, setLocal] = useState({ ...offer });

  const upd = (field, val) => {
    const next = { ...local, [field]: val };
    if (field === 'price' || field === 'compare_price') {
      const p = parseFloat(next.price) || 0;
      const cp = parseFloat(next.compare_price) || 0;
      next.discount = p > 0 && cp > p ? Math.round(((cp - p) / cp) * 100) : 0;
    }
    setLocal(next);
  };

  const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 focus:bg-white transition outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Éditer le palier {index + 1}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
            <input type="number" min="1" className={inputCls} value={local.quantity}
              onChange={e => upd('quantity', e.target.value)} placeholder="1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prix ({currency})</label>
            <input type="number" min="0" className={inputCls} value={local.price}
              onChange={e => upd('price', e.target.value)} placeholder="13000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prix barré (optionnel)</label>
            <input type="number" min="0" className={inputCls} value={local.compare_price}
              onChange={e => upd('compare_price', e.target.value)} placeholder="20000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Badge populaire (opt)</label>
            <input type="text" className={inputCls} value={local.label}
              onChange={e => upd('label', e.target.value)} placeholder="Le plus populaire" />
          </div>
        </div>

        {local.discount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
            <Check className="w-4 h-4" />
            Économie calculée : {local.discount}%
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => onSave(local)} className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Product selector modal — receives pre-fetched products as props ──────────────────
const ProductSelectorModal = ({ products = [], loadingProducts = false, fetchError = null, onSelect, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = Array.isArray(products)
    ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Choisir un produit</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="overflow-y-auto flex-1">
          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : fetchError ? (
            <div className="text-center py-10 text-red-500 text-sm">{fetchError}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Aucun produit trouvé</div>
          ) : filtered.map(p => (
            <button key={p._id} onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition text-left">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                {p.images?.[0]?.url
                  ? <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" />
                  : <Package className="w-5 h-5 text-gray-300 m-auto mt-2.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 text-sm truncate">{p.name}</div>
                {p.sku && <div className="text-[11px] text-gray-400">{p.sku}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── COD Live Preview ──────────────────────────────────────────────────────────
const CodPreview = ({ offers, design, selectedProduct, currency }) => {
  const [selected, setSelected] = useState(0);
  const curr = currency || 'FCFA';

  const fmt = (v) => {
    const n = Number(v);
    if (!v || isNaN(n)) return '—';
    return n.toLocaleString('fr-FR') + curr;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
        Aperçu en direct:
      </div>
      {/* Phone frame */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-300 shadow-lg overflow-hidden flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Veuillez remplir le formulaire pour commander</span>
          <X className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </div>

        {/* Offers */}
        <div className="px-4 py-3 space-y-2.5 overflow-y-auto">
          {offers.map((off, idx) => {
            const isSel = selected === idx;
            const isHighlight = idx === design.highlight_offer;
            const hasCompare = off.compare_price && Number(off.compare_price) > Number(off.price);
            const discpct = off.discount > 0 ? off.discount : 0;

            return (
              <div key={idx} className="relative">
                {/* Badge */}
                {off.label && (
                  <div className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold text-white rounded-full z-10"
                    style={{ backgroundColor: design.colors.primary || '#be123c' }}>
                    {off.label}
                  </div>
                )}

                <button onClick={() => setSelected(idx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition"
                  style={{
                    borderColor: isSel ? (design.colors.primary || '#be123c') : '#e5e7eb',
                    backgroundColor: isSel ? `${design.colors.primary || '#be123c'}10` : '#fff'
                  }}
                >
                  {/* Radio */}
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: isSel ? design.colors.primary || '#be123c' : '#9ca3af' }}>
                    {isSel && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: design.colors.primary || '#be123c' }} />}
                  </div>

                  {/* Qty */}
                  <div className="text-left flex-1">
                    <span className="text-sm font-bold text-gray-800">
                      {off.quantity} {off.quantity > 1 ? 'Unités' : 'unité'}
                    </span>
                  </div>

                  {/* Badge économie */}
                  <div className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                    style={{ backgroundColor: design.colors.primary || '#be123c' }}>
                    Économisez {discpct}%
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="font-bold text-sm text-gray-900 whitespace-nowrap">{fmt(off.price)}</div>
                    {hasCompare && (
                      <div className="text-[11px] text-gray-400 line-through whitespace-nowrap">{fmt(off.compare_price)}</div>
                    )}
                  </div>
                </button>
              </div>
            );
          })}

          {/* Add offer row hint */}
          <button className="mx-auto flex items-center justify-center w-full text-xs text-purple-600 font-semibold py-1 gap-1 hover:underline opacity-70">
            <Plus className="w-3 h-3" /> Ajouter une offre
          </button>
        </div>

        {/* Form fields mockup */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {['Nom *', 'Téléphone *', 'Ville'].map(label => (
            <div key={label}>
              <div className="text-[11px] text-gray-500 mb-0.5">{label}</div>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-400">
                <span>{label.replace(' *', '')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Design section (inside left panel) ───────────────────────────────────────
const DesignSection = ({ design, setDesign, offers }) => {
  const [open, setOpen] = useState(false);
  const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400";

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-gray-800 text-sm">Conception</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-5 pt-2 bg-white border-t border-gray-100 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Modèle</label>
            <select className={inputCls} value={design.template}
              onChange={e => setDesign({ ...design, template: e.target.value })}>
              <option value="modern">Moderne</option>
              <option value="classic">Classique</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Offre mise en avant</label>
            <select className={inputCls} value={design.highlight_offer ?? ''}
              onChange={e => setDesign({ ...design, highlight_offer: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">— Aucune —</option>
              {offers.map((off, idx) => (
                <option key={idx} value={idx}>
                  Palier {idx + 1} — {off.quantity} {Number(off.quantity) > 1 ? 'Unités' : 'unité'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Style des bordures</label>
            <select className={inputCls} value={design.border_style}
              onChange={e => setDesign({ ...design, border_style: e.target.value })}>
              <option value="solid">Solide</option>
              <option value="dashed">Pointillés</option>
              <option value="flat">Minimaliste</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Couleur principale</label>
            <div className="flex items-center gap-3">
              <input type="color" className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200"
                value={design.colors.primary}
                onChange={e => setDesign({ ...design, colors: { ...design.colors, primary: e.target.value } })} />
              <span className="text-sm text-gray-700 font-mono uppercase">{design.colors.primary}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const FormQuantityOffersWizard = () => {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const { id } = useParams();
  const currency = activeStore?.currency || 'FCFA';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingOfferIdx, setEditingOfferIdx] = useState(null);

  // Form state
  const [name, setName] = useState('Nouvelle offre');
  const [isActive, setIsActive] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [offers, setOffers] = useState([
    { quantity: 1, price: '', compare_price: '', discount: 0, label: '' }
  ]);
  const [design, setDesign] = useState({
    template: 'modern',
    colors: { primary: '#be123c', background: '#ffffff', border: '#e5e7eb', text: '#111827' },
    border_style: 'solid',
    highlight_offer: null
  });

  const drag = useDraggableList(offers, setOffers);

  // Pre-fetch products silently in background as soon as the page mounts
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productFetchError, setProductFetchError] = useState(null);
  useEffect(() => {
    storeProductsApi.getProducts({ limit: 200 })
      .then(res => {
        const raw = res.data?.data;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.items) ? raw.items
          : Array.isArray(raw?.products) ? raw.products
          : [];
        setProducts(list);
      })
      .catch(() => setProductFetchError('Impossible de charger les produits.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  // Load existing offer if editing
  useEffect(() => {
    if (!id || id === 'new') return;
    setLoading(true);
    quantityOffersApi.getOffer(id).then(res => {
      const data = res.data.data;
      setName(data.name || 'Nouvelle offre');
      setIsActive(data.isActive !== false);
      setOffers(data.offers?.length > 0 ? data.offers : [{ quantity: 1, price: '', compare_price: '', discount: 0, label: '' }]);
      if (data.design) setDesign(prev => ({ ...prev, ...data.design, colors: { ...prev.colors, ...data.design.colors } }));
      // Resolve product
      const pid = data.productId?._id || data.productId;
      if (pid) {
        storeProductsApi.getProduct(pid).then(r => setSelectedProduct(r.data?.data || null)).catch(() => {});
      }
    }).catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) return setError('Le nom de l\'offre est requis.');
    if (!selectedProduct) return setError('Veuillez sélectionner un produit.');
    if (offers.length === 0) return setError('Ajoutez au moins un palier.');
    for (const off of offers) {
      if (!off.quantity || !off.price) return setError('Chaque palier doit avoir une quantité et un prix.');
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { name, isActive, productId: selectedProduct._id, offers, design };
      if (id && id !== 'new') {
        await quantityOffersApi.updateOffer(id, payload);
      } else {
        await quantityOffersApi.createOffer(payload);
      }
      navigate('/ecom/boutique/form-builder/quantity-offers');
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const generateDefaultOffers = (product) => {
    const base = parseFloat(product.price) || parseFloat(product.finalPrice) || 0;
    if (!base) return; // no price, don't override
    const round = (v) => Math.round(v / 100) * 100; // round to nearest 100
    setOffers([
      {
        quantity: 1,
        price: base,
        compare_price: '',
        discount: 0,
        label: ''
      },
      {
        quantity: 2,
        price: round(base * 2 * 0.8),
        compare_price: base * 2,
        discount: 20,
        label: 'Le plus populaire'
      },
      {
        quantity: 3,
        price: round(base * 3 * 0.7),
        compare_price: base * 3,
        discount: 30,
        label: 'Le plus populaire'
      },
    ]);
  };

  const handleSelectProduct = (p) => {
    setSelectedProduct(p);
    setShowProductModal(false);
    // Only auto-generate if offers are still at initial empty state
    const isFreshOffers = offers.length === 1 && !offers[0].price;
    if (isFreshOffers) generateDefaultOffers(p);
  };

  const addOffer = () => {
    const lastQty = offers.length > 0 ? Math.max(...offers.map(o => Number(o.quantity) || 0)) : 0;
    setOffers([...offers, { quantity: lastQty + 1, price: '', compare_price: '', discount: 0, label: '' }]);
  };

  const saveEditedOffer = (updated) => {
    const next = [...offers];
    next[editingOfferIdx] = updated;
    setOffers(next);
    setEditingOfferIdx(null);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 pb-24 lg:pb-0">
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* Back + title + toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/ecom/boutique/form-builder/quantity-offers')}
              className="p-2 rounded-lg hover:bg-gray-200 transition text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 flex-1">
              {id && id !== 'new' ? 'Modifier l\'offre' : 'Nouvelle offre'}
            </h1>
            <label className="relative inline-flex items-center cursor-pointer gap-2">
              <input type="checkbox" className="sr-only peer" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer
                peer-checked:after:translate-x-full peer-checked:after:border-white
                after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                after:bg-white after:border-gray-300 after:border after:rounded-full
                after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Nom */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Nom</label>
            <input
              className="w-full text-sm text-gray-900 bg-transparent outline-none placeholder-gray-300"
              placeholder="Nouvelle offre"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Product selector */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Créez des offres pour ces produits. ({selectedProduct ? '1 sélectionné' : '0 sélectionné'})
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition mb-3"
            >
              Changer le produit
            </button>
            {selectedProduct ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                  {selectedProduct.images?.[0]?.url
                    ? <img src={selectedProduct.images[0].url} alt="" className="w-full h-full object-cover" />
                    : <Package className="w-5 h-5 text-gray-300 m-auto mt-2.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{selectedProduct.name}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedProduct.sku || selectedProduct._id}</div>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-1.5 hover:bg-gray-200 rounded-lg transition text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400">
                <Package className="w-4 h-4" /> Aucun produit sélectionné
              </div>
            )}
          </div>

          {/* Offers list */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Offres</span>
            </div>

            {offers.map((off, idx) => {
              const label = `${off.quantity} ${Number(off.quantity) > 1 ? 'Unités' : 'unité'}`;
              return (
                <div key={idx}
                  draggable
                  onDragStart={() => drag.onDragStart(idx)}
                  onDragEnter={() => drag.onDragEnter(idx)}
                  onDragEnd={drag.onDragEnd}
                  className="flex items-center gap-2 px-3 py-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition group"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
                  {off.price && (
                    <span className="text-xs text-gray-500 mr-1">
                      {Number(off.price).toLocaleString()} {currency}
                    </span>
                  )}
                  <button
                    onClick={() => setEditingOfferIdx(idx)}
                    className="px-2.5 py-1 text-xs font-semibold border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Éditer
                  </button>
                  <button
                    onClick={() => setOffers(offers.filter((_, i) => i !== idx))}
                    disabled={offers.length === 1}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={addOffer}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition font-medium"
            >
              <Plus className="w-4 h-4" /> Ajouter une offre
            </button>
          </div>

          {/* Design accordion */}
          <DesignSection design={design} setDesign={setDesign} offers={offers} />

          {/* Save button (mobile) */}
          <div className="lg:hidden">
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Sauvegarder l'offre
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel — Live Preview ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[420px] flex-shrink-0 bg-gray-100 border-l border-gray-200 p-6">
        <div className="flex-1 flex flex-col">
          <CodPreview offers={offers} design={design} selectedProduct={selectedProduct} currency={currency} />
        </div>

        {/* Save button (desktop) */}
        <div className="pt-4 border-t border-gray-200 mt-4">
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-sm active:scale-95">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Sauvegarder l'offre
          </button>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showProductModal && (
        <ProductSelectorModal
          products={products}
          loadingProducts={loadingProducts}
          fetchError={productFetchError}
          onSelect={handleSelectProduct}
          onClose={() => setShowProductModal(false)}
        />
      )}
      {editingOfferIdx !== null && (
        <OfferEditModal
          offer={offers[editingOfferIdx]}
          index={editingOfferIdx}
          currency={currency}
          onSave={saveEditedOffer}
          onClose={() => setEditingOfferIdx(null)}
        />
      )}
    </div>
  );
};

export default FormQuantityOffersWizard;
