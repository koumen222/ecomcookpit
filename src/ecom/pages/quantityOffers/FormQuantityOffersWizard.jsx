import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext.jsx';
import { storeProductsApi, quantityOffersApi } from '../../services/storeApi';
import {
  ArrowLeft, Save, Loader2, Plus, Trash2, Edit3, GripVertical,
  X, ChevronDown, ChevronUp, Package, Check, Palette, AlignLeft,
  Type, Tag, LayoutTemplate, Sliders
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
const OfferEditModal = ({ offer, index, currency, globalDesign, onSave, onClose }) => {
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

  const primaryColor = globalDesign?.colors?.primary || '#be123c';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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

        {/* ── Design par palier ── */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Design de ce palier</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Fond</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                  value={local.bg_color || '#ffffff'}
                  onChange={e => upd('bg_color', e.target.value)} />
                <span className="text-[11px] text-gray-500 font-mono">{(local.bg_color || '#ffffff').toUpperCase()}</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Bordure</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                  value={local.border_color || primaryColor}
                  onChange={e => upd('border_color', e.target.value)} />
                <span className="text-[11px] text-gray-500 font-mono">{(local.border_color || primaryColor).toUpperCase()}</span>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Badge</label>
              <div className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200"
                  value={local.badge_color || primaryColor}
                  onChange={e => upd('badge_color', e.target.value)} />
                <span className="text-[11px] text-gray-500 font-mono">{(local.badge_color || primaryColor).toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button onClick={() => { upd('bg_color', ''); upd('border_color', ''); upd('badge_color', ''); }}
            className="mt-2 text-[11px] text-purple-600 hover:underline">
            Réinitialiser (utiliser le design global)
          </button>
        </div>

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
  const primary = design?.colors?.primary || '#be123c';

  const fmt = (v) => {
    const n = Number(v);
    if (!v || isNaN(n)) return '—';
    return n.toLocaleString('fr-FR') + ' ' + curr;
  };

  const selectedOffer = offers[selected] || offers[0] || {};
  const selectedPrice = selectedOffer.price ? Number(selectedOffer.price) : 0;

  // Design tokens
  const selBg       = design.sel_bg || '#FDEBD0';
  const selBorder   = design.sel_border || primary;
  const unselBg     = design.unsel_bg || '#FFFFFF';
  const unselBorder = design.unsel_border || '#d1d1d1';
  const radioColor  = design.radio_color || selBorder;
  const borderRadius = design.border_radius ?? 12;
  const borderStyle  = design.border_style || 'solid';

  const badgeGrad   = design.badge_gradient || primary;
  const badgeTxtC   = design.badge_text_color || '#ffffff';
  const badgeFontSz = design.badge_font_size ?? 11;
  const badgeShape  = design.badge_style || 'pill';
  const badgeRad    = badgeShape === 'square' ? 4 : badgeShape === 'ribbon' ? 0 : 20;

  const labelGrad   = design.label_gradient || primary;
  const labelTxtC   = design.label_text_color || '#ffffff';
  const labelFontSz = design.label_font_size ?? 11;
  const labelStyle  = design.label_style || 'banner';

  const titleColor  = design.title_text_color || '#000000';
  const titleSize   = design.title_font_size ?? 14;
  const titleWeight = design.title_font_weight === 'black' ? 900 : design.title_font_weight === 'normal' ? 400 : 700;

  const priceColor  = design.price_text_color || primary;
  const priceSize   = design.price_font_size ?? 15;
  const priceWeight = design.price_font_weight === 'black' ? 900 : design.price_font_weight === 'normal' ? 400 : 800;
  const compareColor = design.compare_color || '#9ca3af';

  const discBg      = design.discount_bg || '#FEE2E2';
  const discTxt     = design.discount_color || '#EF4444';

  const sectionLabel = design.offerSectionLabel || 'Choisissez votre offre';
  const displayType  = design.display_type || 'radio';

  // Ribbon-style badge uses absolute positioning
  const renderBadge = (text) => {
    if (!text) return null;
    if (badgeShape === 'ribbon') {
      return (
        <div className="absolute -top-0 -right-0 overflow-hidden" style={{ width: 52, height: 52 }}>
          <div style={{
            position: 'absolute', top: 10, right: -14, width: 70, textAlign: 'center',
            transform: 'rotate(45deg)', background: badgeGrad, color: badgeTxtC,
            fontSize: badgeFontSz, fontWeight: 700, padding: '2px 0',
          }}>{text}</div>
        </div>
      );
    }
    return (
      <div className="absolute z-10"
        style={{
          top: -9, right: 10,
          background: badgeGrad,
          color: badgeTxtC,
          fontSize: badgeFontSz,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: badgeRad,
          whiteSpace: 'nowrap',
        }}>
        {text}
      </div>
    );
  };

  const renderDiscountLabel = (disc) => {
    if (!disc) return null;
    const text = `-${disc}%`;
    if (labelStyle === 'underline') {
      return (
        <span style={{ color: labelTxtC || discTxt, fontSize: labelFontSz, fontWeight: 700,
          textDecoration: 'underline', background: 'transparent' }}>
          {text}
        </span>
      );
    }
    if (labelStyle === 'chip') {
      return (
        <span style={{ background: labelGrad, color: labelTxtC, fontSize: labelFontSz, fontWeight: 700,
          padding: '1px 6px', borderRadius: 20 }}>
          {text}
        </span>
      );
    }
    // banner (default)
    return (
      <span style={{ background: labelGrad, color: labelTxtC, fontSize: labelFontSz, fontWeight: 700,
        padding: '2px 8px', borderRadius: 6, display: 'inline-block' }}>
        {text}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
        Aperçu en direct
      </div>
      {/* Phone frame */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-300 shadow-lg overflow-hidden flex flex-col text-left"
        style={{ minHeight: 0 }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <span className="text-[12px] font-bold text-gray-800 leading-tight">
            Veuillez remplir le formulaire pour commander
          </span>
          <X className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Product recap */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            {selectedProduct?.images?.[0]?.url ? (
              <img src={selectedProduct.images[0].url} alt=""
                className="w-10 h-10 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-gray-900 truncate">
                {selectedProduct?.name || 'Nom du produit'}
              </div>
              <div className="text-[10px] text-gray-500">Qté: {selectedOffer.quantity || 1}</div>
            </div>
            <span className="text-[13px] font-black flex-shrink-0" style={{ color: primary }}>
              {selectedPrice > 0 ? fmt(selectedPrice) : '—'}
            </span>
          </div>

          {/* Offers area */}
          <div className="px-3 py-3">
            <div className="text-[11px] font-bold text-gray-500 mb-2">{sectionLabel}</div>

            {/* ── Grille (colonnes) ── */}
            {displayType === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${offers.length}, 1fr)`, gap: 5 }}>
                {offers.map((off, idx) => {
                  const isSel = selected === idx;
                  const qty   = Number(off.quantity) || 1;
                  const price = Number(off.price) || 0;
                  const cmp   = Number(off.compare_price) || 0;
                  const disc  = cmp > price && price > 0 ? Math.round((1 - price / cmp) * 100) : (Number(off.discount) || 0);
                  return (
                    <button key={idx} onClick={() => setSelected(idx)} type="button"
                      style={{ borderWidth: isSel ? 2 : 1.5, borderStyle: 'solid', borderColor: isSel ? selBorder : unselBorder, borderRadius, backgroundColor: isSel ? selBg : unselBg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 10px', gap: 4, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                      {off.label && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', background: badgeGrad, color: badgeTxtC, fontSize: 8, fontWeight: 700, padding: '2px 0' }}>{off.label}</div>
                      )}
                      {selectedProduct?.images?.[0]?.url ? (
                        <img src={selectedProduct.images[0].url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', marginTop: off.label ? 12 : 0 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: off.label ? 12 : 0 }}>
                          <Package className="w-4 h-4 text-gray-300" />
                        </div>
                      )}
                      <div style={{ fontSize: titleSize - 2, fontWeight: titleWeight, color: titleColor, textAlign: 'center', lineHeight: 1.2 }}>
                        {qty} {qty > 1 ? 'Unités' : 'unité'}
                      </div>
                      {disc > 0 && (
                        <div style={{ background: discBg, padding: '1px 6px', borderRadius: 20 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: discTxt }}>Économisez {disc}%</span>
                        </div>
                      )}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: priceSize - 2, fontWeight: priceWeight, color: priceColor }}>{price > 0 ? fmt(price) : '—'}</div>
                        {cmp > price && price > 0 && <div style={{ fontSize: 9, color: compareColor, textDecoration: 'line-through' }}>{fmt(cmp)}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* ── Radio ou Image+texte ── */
              <div className="space-y-1.5">
                {offers.map((off, idx) => {
                  const isSel = selected === idx;
                  const qty   = Number(off.quantity) || 1;
                  const price = Number(off.price) || 0;
                  const cmp   = Number(off.compare_price) || 0;
                  const disc  = cmp > price && price > 0 ? Math.round((1 - price / cmp) * 100) : (Number(off.discount) || 0);

                  if (displayType === 'image-row') {
                    return (
                      <button key={idx} onClick={() => setSelected(idx)} type="button"
                        className="w-full flex items-center gap-2.5 transition text-left"
                        style={{ borderWidth: isSel ? 2 : 1.5, borderStyle: 'solid', borderColor: isSel ? selBorder : unselBorder, borderRadius, backgroundColor: isSel ? selBg : unselBg, padding: '8px 10px' }}>
                        {selectedProduct?.images?.[0]?.url ? (
                          <img src={selectedProduct.images[0].url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: '#F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: titleSize - 1, fontWeight: titleWeight, color: titleColor, lineHeight: 1.2 }}>
                            {qty} {qty > 1 ? 'Unités' : 'unité'}
                          </div>
                          {disc > 0 && (
                            <div style={{ display: 'inline-flex', marginTop: 2, background: discBg, padding: '1px 6px', borderRadius: 20 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: discTxt }}>Économisez {disc}%</span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                            <span style={{ fontSize: priceSize - 1, fontWeight: priceWeight, color: priceColor }}>{price > 0 ? fmt(price) : '—'}</span>
                            {cmp > price && price > 0 && <span style={{ fontSize: 10, color: compareColor, textDecoration: 'line-through' }}>{fmt(cmp)}</span>}
                          </div>
                        </div>
                        {off.label && (
                          <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: badgeTxtC, background: badgeGrad, padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap' }}>{off.label}</div>
                        )}
                      </button>
                    );
                  }

                  // Radio (défaut)
                  return (
                    <div key={idx} className="relative" style={{ overflow: badgeShape !== 'ribbon' ? 'visible' : 'hidden' }}>
                      {renderBadge(off.label)}
                      <button onClick={() => setSelected(idx)} type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 transition text-left"
                        style={{ borderWidth: isSel ? 2 : 1.5, borderStyle, borderColor: isSel ? selBorder : unselBorder, borderRadius, backgroundColor: isSel ? selBg : unselBg }}>
                        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: isSel ? radioColor : '#9ca3af' }}>
                          {isSel && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: radioColor }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: titleSize, fontWeight: titleWeight, color: titleColor, lineHeight: 1.2 }}>
                            {qty} {qty > 1 ? 'Unités' : 'unité'}
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                            <span style={{ fontSize: priceSize, fontWeight: priceWeight, color: priceColor }}>{price > 0 ? fmt(price) : '—'}</span>
                            {cmp > price && price > 0 && <span style={{ fontSize: 10, color: compareColor, textDecoration: 'line-through' }}>{fmt(cmp)}</span>}
                            {disc > 0 && renderDiscountLabel(disc)}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Free shipping */}
            <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200">
              <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
              Livraison gratuite
            </div>
          </div>

          {/* Form fields mockup */}
          <div className="px-3 pb-3 pt-2 space-y-1.5 border-t border-gray-100">
            {[
              { label: 'NOM *', ph: 'Nom' },
              { label: 'Téléphone *', ph: 'Téléphone' },
              { label: 'Ville *', ph: 'Ville' },
            ].map(({ label, ph }) => (
              <div key={label}>
                <div className="text-[9px] font-semibold text-gray-500 mb-0.5">{label}</div>
                <div className="px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-[11px] text-gray-400">
                  {ph}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA button */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-white flex-shrink-0">
          <button className="w-full py-2.5 rounded-xl text-white text-[12px] font-black flex items-center justify-center gap-2 shadow-sm"
            style={{ backgroundColor: primary }}>
            <Check className="w-3.5 h-3.5" />
            TERMINER — {selectedPrice > 0 ? fmt(selectedPrice) : '—'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Reusable design sub-components ───────────────────────────────────────────
const D = {
  inputCls: "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400",

  Section({ label, icon: Icon, children }) {
    return (
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          {Icon && <Icon className="w-3.5 h-3.5 text-purple-500" />}
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
        </div>
        <div className="p-3 space-y-3 bg-white">{children}</div>
      </div>
    );
  },

  Row({ label, children }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-gray-600 flex-shrink-0 w-32">{label}</label>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  },

  ColorRow({ label, value, onChange }) {
    const safe = value && value.startsWith('#') ? value : '#000000';
    return (
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-gray-600 flex-shrink-0">{label}</label>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input type="color" value={safe} onChange={e => onChange(e.target.value)}
            className="w-7 h-7 rounded-lg cursor-pointer border border-gray-200 p-0.5" />
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            className="w-24 px-2 py-1 rounded-lg border border-gray-200 text-[11px] font-mono outline-none focus:border-purple-400" />
        </div>
      </div>
    );
  },

  GradientRow({ label, value, onChange }) {
    return (
      <div>
        <label className="block text-xs text-gray-600 mb-1">{label}</label>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border border-gray-200 flex-shrink-0"
            style={{ background: value || '#be123c' }} />
          <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
            className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[11px] font-mono outline-none focus:border-purple-400"
            placeholder="ex: linear-gradient(270deg, #E67E22 0%, #D35400 100%)" />
        </div>
      </div>
    );
  },

  SliderRow({ label, value, onChange, min = 0, max = 32, unit = 'px' }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs text-gray-600 flex-shrink-0">{label}</label>
        <div className="flex items-center gap-2 flex-1">
          <input type="range" min={min} max={max} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="flex-1 h-1.5 accent-purple-500" />
          <span className="text-[11px] font-mono text-gray-500 w-10 text-right">{value}{unit}</span>
        </div>
      </div>
    );
  },

  Tabs({ value, onChange, options }) {
    return (
      <div className="flex gap-1">
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition ${
              value === o.value
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    );
  },
};

// ── Preset themes ────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'orange_fire',
    name: 'Orange Feu',
    sel_bg: '#FFF3E0', sel_border: '#E65100',
    unsel_bg: '#FFFFFF', unsel_border: '#BDBDBD',
    radio_color: '#E65100',
    badge_gradient: 'linear-gradient(135deg,#FF6D00,#E65100)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#FF6D00,#E65100)',
    label_text_color: '#ffffff', label_style: 'banner',
    title_text_color: '#1a1a1a', price_text_color: '#E65100',
    discount_bg: '#FFF3E0', discount_color: '#E65100',
    compare_color: '#9E9E9E', border_style: 'solid', border_radius: 12,
    colors: { primary: '#E65100' },
    preview: ['#FFF3E0', '#E65100', '#FF6D00'],
  },
  {
    id: 'red_bold',
    name: 'Rouge Promo',
    sel_bg: '#FFF5F5', sel_border: '#E53E3E',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#E53E3E',
    badge_gradient: 'linear-gradient(135deg,#FC8181,#E53E3E)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#FC8181,#E53E3E)',
    label_text_color: '#ffffff', label_style: 'chip',
    title_text_color: '#1A202C', price_text_color: '#E53E3E',
    discount_bg: '#FFF5F5', discount_color: '#E53E3E',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 10,
    colors: { primary: '#E53E3E' },
    preview: ['#FFF5F5', '#E53E3E', '#FC8181'],
  },
  {
    id: 'green_fresh',
    name: 'Vert Succès',
    sel_bg: '#F0FFF4', sel_border: '#38A169',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#38A169',
    badge_gradient: 'linear-gradient(135deg,#68D391,#38A169)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#68D391,#276749)',
    label_text_color: '#ffffff', label_style: 'banner',
    title_text_color: '#1A202C', price_text_color: '#276749',
    discount_bg: '#F0FFF4', discount_color: '#276749',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 12,
    colors: { primary: '#38A169' },
    preview: ['#F0FFF4', '#38A169', '#68D391'],
  },
  {
    id: 'blue_trust',
    name: 'Bleu Confiance',
    sel_bg: '#EBF8FF', sel_border: '#3182CE',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#3182CE',
    badge_gradient: 'linear-gradient(135deg,#63B3ED,#3182CE)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#63B3ED,#2B6CB0)',
    label_text_color: '#ffffff', label_style: 'chip',
    title_text_color: '#1A202C', price_text_color: '#2B6CB0',
    discount_bg: '#EBF8FF', discount_color: '#2B6CB0',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 12,
    colors: { primary: '#3182CE' },
    preview: ['#EBF8FF', '#3182CE', '#63B3ED'],
  },
  {
    id: 'purple_premium',
    name: 'Violet Premium',
    sel_bg: '#FAF5FF', sel_border: '#805AD5',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#805AD5',
    badge_gradient: 'linear-gradient(135deg,#B794F4,#805AD5)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#B794F4,#6B46C1)',
    label_text_color: '#ffffff', label_style: 'banner',
    title_text_color: '#1A202C', price_text_color: '#6B46C1',
    discount_bg: '#FAF5FF', discount_color: '#6B46C1',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 12,
    colors: { primary: '#805AD5' },
    preview: ['#FAF5FF', '#805AD5', '#B794F4'],
  },
  {
    id: 'gold_luxury',
    name: 'Or Luxe',
    sel_bg: '#FFFFF0', sel_border: '#B7791F',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#B7791F',
    badge_gradient: 'linear-gradient(135deg,#F6E05E,#B7791F)',
    badge_text_color: '#744210', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#ECC94B,#B7791F)',
    label_text_color: '#744210', label_style: 'chip',
    title_text_color: '#1A202C', price_text_color: '#B7791F',
    discount_bg: '#FFFFF0', discount_color: '#B7791F',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 8,
    colors: { primary: '#B7791F' },
    preview: ['#FFFFF0', '#B7791F', '#F6E05E'],
  },
  {
    id: 'dark_night',
    name: 'Sombre',
    sel_bg: '#2D3748', sel_border: '#4FD1C5',
    unsel_bg: '#1A202C', unsel_border: '#4A5568',
    radio_color: '#4FD1C5',
    badge_gradient: 'linear-gradient(135deg,#4FD1C5,#2C7A7B)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#4FD1C5,#2C7A7B)',
    label_text_color: '#ffffff', label_style: 'chip',
    title_text_color: '#F7FAFC', price_text_color: '#4FD1C5',
    discount_bg: '#2D3748', discount_color: '#4FD1C5',
    compare_color: '#718096', border_style: 'solid', border_radius: 12,
    colors: { primary: '#4FD1C5' },
    preview: ['#1A202C', '#4FD1C5', '#2D3748'],
  },
  {
    id: 'pink_soft',
    name: 'Rose Doux',
    sel_bg: '#FFF5F7', sel_border: '#D53F8C',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#D53F8C',
    badge_gradient: 'linear-gradient(135deg,#FBB6CE,#D53F8C)',
    badge_text_color: '#ffffff', badge_style: 'pill',
    label_gradient: 'linear-gradient(135deg,#FBB6CE,#97266D)',
    label_text_color: '#ffffff', label_style: 'banner',
    title_text_color: '#1A202C', price_text_color: '#97266D',
    discount_bg: '#FFF5F7', discount_color: '#97266D',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 14,
    colors: { primary: '#D53F8C' },
    preview: ['#FFF5F7', '#D53F8C', '#FBB6CE'],
  },
  {
    id: 'minimal_gray',
    name: 'Minimal',
    sel_bg: '#F7FAFC', sel_border: '#2D3748',
    unsel_bg: '#FFFFFF', unsel_border: '#E2E8F0',
    radio_color: '#2D3748',
    badge_gradient: '#2D3748',
    badge_text_color: '#ffffff', badge_style: 'square',
    label_gradient: '#2D3748',
    label_text_color: '#ffffff', label_style: 'chip',
    title_text_color: '#1A202C', price_text_color: '#2D3748',
    discount_bg: '#EDF2F7', discount_color: '#2D3748',
    compare_color: '#A0AEC0', border_style: 'solid', border_radius: 6,
    colors: { primary: '#2D3748' },
    preview: ['#F7FAFC', '#2D3748', '#718096'],
  },
];

// ── Design section (always visible, no accordion) ────────────────────────────
const DesignSection = ({ design, setDesign, offers }) => {
  const upd = (key, val) => setDesign(d => ({ ...d, [key]: val }));

  const applyTheme = (theme) => {
    const { id, name, preview, ...fields } = theme;
    setDesign(d => ({ ...d, ...fields, _themeId: id }));
  };

  const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-400";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-purple-600" />
        <span className="font-semibold text-gray-800 text-sm">Conception</span>
        {design._themeId && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
            {THEMES.find(t => t.id === design._themeId)?.name || ''}
          </span>
        )}
      </div>

      {/* ── Type d'affichage ── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Type d'affichage</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { val: 'radio',     label: 'Radio',         icon: '☰' },
            { val: 'image-row', label: 'Image + texte', icon: '🖼' },
            { val: 'grid',      label: 'Grille',        icon: '⊞' },
          ].map(({ val, label, icon }) => (
            <button key={val} type="button"
              onClick={() => upd('display_type', val)}
              className={`py-2 px-1 rounded-xl border text-center transition-colors ${
                (design.display_type || 'radio') === val
                  ? 'border-rose-400 bg-rose-50 text-rose-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <div className="text-base leading-none mb-0.5">{icon}</div>
              <div className="text-[10px] font-semibold">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Thèmes prédéfinis ── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Thème</p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(theme => {
            const isActive = design._themeId === theme.id;
            return (
              <button key={theme.id} onClick={() => applyTheme(theme)}
                className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition ${
                  isActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}>
                <div className="flex gap-1">
                  {theme.preview.map((c, i) => (
                    <div key={i} className="w-5 h-5 rounded-full border border-white shadow-sm"
                      style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{theme.name}</span>
                {isActive && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Ajustements fins ── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Ajustements</p>
        <div className="space-y-2.5">

          {/* Carte sélectionnée */}
          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-500">Carte sélectionnée</p>
            <D.ColorRow label="Fond" value={design.sel_bg || '#FFF3E0'} onChange={v => upd('sel_bg', v)} />
            <D.ColorRow label="Bordure" value={design.sel_border || '#E65100'} onChange={v => upd('sel_border', v)} />
          </div>

          {/* Carte non-sélectionnée */}
          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-500">Carte non-sélectionnée</p>
            <D.ColorRow label="Fond" value={design.unsel_bg || '#FFFFFF'} onChange={v => upd('unsel_bg', v)} />
            <D.ColorRow label="Bordure" value={design.unsel_border || '#BDBDBD'} onChange={v => upd('unsel_border', v)} />
          </div>

          {/* Badge & prix */}
          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-500">Badge & prix</p>
            <D.ColorRow label="Couleur badge" value={design.sel_border || '#E65100'} onChange={v => { upd('badge_gradient', v); upd('label_gradient', v); upd('sel_border', v); upd('radio_color', v); upd('price_text_color', v); }} />
            <D.ColorRow label="Couleur prix" value={design.price_text_color || design.sel_border || '#E65100'} onChange={v => upd('price_text_color', v)} />
          </div>

          {/* Typographie */}
          <div className="rounded-lg border border-gray-100 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-gray-500">Taille du texte</p>
            <D.SliderRow label="Titre (qté)" value={design.title_font_size ?? 14} onChange={v => upd('title_font_size', v)} min={10} max={24} unit="px" />
            <D.SliderRow label="Prix" value={design.price_font_size ?? 15} onChange={v => upd('price_font_size', v)} min={10} max={28} unit="px" />
            <D.SliderRow label="Badge" value={design.badge_font_size ?? 11} onChange={v => upd('badge_font_size', v)} min={8} max={20} unit="px" />
            <D.SliderRow label="Remise" value={design.label_font_size ?? 11} onChange={v => upd('label_font_size', v)} min={8} max={20} unit="px" />
          </div>

          {/* Arrondi */}
          <D.SliderRow label="Coins arrondis" value={design.border_radius ?? 12} onChange={v => upd('border_radius', v)} min={0} max={32} unit="px" />
        </div>
      </div>

      {/* ── Disposition ── */}
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Disposition</p>
        <div className="space-y-2">

          <div>
            <label className="block text-xs text-gray-600 mb-1">Offre mise en avant</label>
            <select value={design.highlight_offer ?? ''} onChange={e => upd('highlight_offer', e.target.value === '' ? null : Number(e.target.value))} className={inputCls}>
              <option value="">— Aucune —</option>
              {offers.map((off, idx) => (
                <option key={idx} value={idx}>Palier {idx + 1} — {off.quantity} {Number(off.quantity) > 1 ? 'Unités' : 'unité'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Titre de la section</label>
            <input type="text" value={design.offerSectionLabel || ''} placeholder="Choisissez votre offre"
              onChange={e => upd('offerSectionLabel', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const errorRef = React.useRef(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingOfferIdx, setEditingOfferIdx] = useState(null);

  // Form state
  const [name, setName] = useState('Nouvelle offre');
  const [isActive, setIsActive] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [offers, setOffers] = useState([
    { quantity: 1, price: '', compare_price: '', discount: 0, label: '' }
  ]);
  const [design, setDesign] = useState({
    template: 'modern',
    position: 'inside_form',
    colors: { primary: '#be123c', background: '#ffffff', border: '#e5e7eb', text: '#111827' },
    border_style: 'solid',
    border_radius: 12,
    highlight_offer: null,
    display_type: 'radio',
    offerSectionLabel: 'Choisissez votre offre',
    // Selected card
    sel_bg: '#FDEBD0',
    sel_border: '#d35400',
    // Unselected card
    unsel_bg: '#FFFFFF',
    unsel_border: '#d1d1d1',
    // Badge (tag)
    badge_gradient: 'linear-gradient(270deg, #E67E22 0%, #D35400 100%)',
    badge_text_color: '#ffffff',
    badge_font_size: 14,
    badge_style: 'pill',         // pill | square | ribbon
    // Étiquette (label sous le badge)
    label_gradient: 'linear-gradient(270deg, #E67E22 0%, #D35400 100%)',
    label_text_color: '#ffffff',
    label_font_size: 14,
    label_style: 'banner',       // banner | chip | underline
    // Title text
    title_text_color: '#000000',
    title_font_size: 16,
    title_font_weight: 'bold',   // bold | normal
    // Price
    price_text_color: '#000000',
    price_font_size: 18,
    price_font_weight: 'bold',
    // Compare price
    compare_color: '#9ca3af',
    // Discount chip
    discount_bg: '#FEE2E2',
    discount_color: '#EF4444',
    // Radio
    radio_color: '#be123c',
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
      if (data.design) {
        setDesign(prev => ({
          ...prev,
          ...data.design,
          colors: { ...prev.colors, ...(data.design.colors || {}) },
        }));
      }
      // Resolve product
      const pid = typeof data.productId === 'object' && data.productId !== null
        ? (data.productId._id || '')
        : (data.productId || '');
      setSelectedProductId(pid);
      if (data.productId && typeof data.productId === 'object') {
        setSelectedProduct(data.productId);
      } else {
        setSelectedProduct(null);
      }
      if (pid) {
        storeProductsApi.getProduct(pid)
          .then((r) => {
            const product = r.data?.data || null;
            setSelectedProduct(product);
            if (product?._id) setSelectedProductId(product._id);
          })
          .catch(() => {});
      }
    }).catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [id]);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const handleSave = async () => {
    if (!name.trim()) return showError('Le nom de l\'offre est requis.');
    const productId = selectedProduct?._id || selectedProductId;
    if (!productId) return showError('Veuillez sélectionner un produit.');
    if (offers.length === 0) return showError('Ajoutez au moins un palier.');
    for (const off of offers) {
      if (!off.quantity || !off.price) return showError('Chaque palier doit avoir une quantité et un prix.');
    }
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const normalizedOffers = offers.map((off, idx) => ({
        quantity:      Number(off.quantity) || 1,
        qty:           Number(off.quantity) || 1,
        price:         Number(off.price) || 0,
        compare_price: Number(off.compare_price) || 0,
        comparePrice:  Number(off.compare_price) || 0,
        discount:      Number(off.discount) || 0,
        label:         off.label || '',
        badge:         off.label || '',
        selected:      design.highlight_offer === idx,
        bg_color:      off.bg_color || '',
        border_color:  off.border_color || '',
        badge_color:   off.badge_color || '',
      }));

      // Compact design — only wizard fields, no duplication
      const savedDesign = {
        template:          design.template,
        position:          design.position,
        border_style:      design.border_style,
        border_radius:     design.border_radius,
        highlight_offer:   design.highlight_offer,
        display_type:      design.display_type,
        offerSectionLabel: design.offerSectionLabel,
        colors:            design.colors,
        sel_bg:            design.sel_bg,
        sel_border:        design.sel_border,
        unsel_bg:          design.unsel_bg,
        unsel_border:      design.unsel_border,
        radio_color:       design.radio_color,
        badge_gradient:    design.badge_gradient,
        badge_text_color:  design.badge_text_color,
        badge_font_size:   design.badge_font_size,
        badge_style:       design.badge_style,
        label_gradient:    design.label_gradient,
        label_text_color:  design.label_text_color,
        label_font_size:   design.label_font_size,
        label_style:       design.label_style,
        discount_bg:       design.discount_bg,
        discount_color:    design.discount_color,
        price_text_color:  design.price_text_color,
        price_font_size:   design.price_font_size,
        price_font_weight: design.price_font_weight,
        title_text_color:  design.title_text_color,
        title_font_size:   design.title_font_size,
        title_font_weight: design.title_font_weight,
        compare_color:     design.compare_color,
      };

      const payload = { name, isActive, productId, offers: normalizedOffers, design: savedDesign };
      if (id && id !== 'new') {
        await quantityOffersApi.updateOffer(id, payload);
      } else {
        const res = await quantityOffersApi.createOffer(payload);
        const newId = res.data?.data?._id;
        if (newId) navigate(`/ecom/boutique/form-builder/quantity-offers/wizard/${newId}`, { replace: true });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('[handleSave] error:', err?.response?.data || err);
      showError(err?.response?.data?.message || `Erreur (${err?.response?.status || err?.message || 'réseau'})`);
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
    setSelectedProductId(p?._id || '');
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
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Top bar: back + title + toggle + save ──────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 z-10">
        <button onClick={() => navigate('/ecom/boutique/form-builder/quantity-offers')}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 truncate">
          {id && id !== 'new' ? 'Modifier l\'offre' : 'Nouvelle offre'}
        </h1>
        <label className="relative inline-flex items-center cursor-pointer gap-2 flex-shrink-0">
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
        <button onClick={handleSave} disabled={saving || saveSuccess}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 font-bold rounded-xl text-sm transition active:scale-95 ${
            saveSuccess ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Sauvegarde...' : saveSuccess ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* ── Notifications ──────────────────────────────────────────────── */}
      {(error || saveSuccess) && (
        <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-100">
          {error && (
            <div ref={errorRef} className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              Offre sauvegardée avec succès !
            </div>
          )}
        </div>
      )}

      {/* ── 3-column body ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Col 1 — Paramètres (nom + produit + offres) */}
        <div className="w-[300px] xl:w-[320px] flex-shrink-0 overflow-y-auto bg-gray-50 border-r border-gray-200 p-4 space-y-4">

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
              Produit ({selectedProduct ? '1 sélectionné' : '0 sélectionné'})
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
                  <div className="text-[11px] text-gray-400 mt-0.5">{selectedProduct.sku || selectedProduct._id || selectedProductId}</div>
                </div>
                <button onClick={() => { setSelectedProduct(null); setSelectedProductId(''); }} className="p-1.5 hover:bg-gray-200 rounded-lg transition text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : selectedProductId ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex-shrink-0 border border-amber-200 flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-amber-900 truncate">Produit introuvable</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">{selectedProductId}</div>
                </div>
                <button onClick={() => setSelectedProductId('')} className="p-1.5 hover:bg-amber-100 rounded-lg transition text-amber-600">
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
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paliers</span>

            {offers.map((off, idx) => {
              const label = `${off.quantity} ${Number(off.quantity) > 1 ? 'Unités' : 'unité'}`;
              const hasCustomDesign = off.bg_color || off.border_color || off.badge_color;
              return (
                <div key={idx}
                  draggable
                  onDragStart={() => drag.onDragStart(idx)}
                  onDragEnter={() => drag.onDragEnter(idx)}
                  onDragEnd={drag.onDragEnd}
                  className="flex items-center gap-2 px-3 py-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 transition group"
                >
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />
                  {hasCustomDesign && (
                    <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                      style={{ backgroundColor: off.border_color || off.badge_color || off.bg_color }} title="Design personnalisé" />
                  )}
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{label}</span>
                  {off.price && (
                    <span className="text-[11px] text-gray-500">
                      {Number(off.price).toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={() => setEditingOfferIdx(idx)}
                    className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition"
                    title="Éditer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setOffers(offers.filter((_, i) => i !== idx))}
                    disabled={offers.length === 1}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={addOffer}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition font-medium"
            >
              <Plus className="w-4 h-4" /> Ajouter un palier
            </button>
          </div>
        </div>

        {/* Col 2 — Conception (always visible, scrollable) */}
        <div className="flex-1 overflow-y-auto bg-white border-r border-gray-200 p-4">
          <DesignSection design={design} setDesign={setDesign} offers={offers} />
        </div>

        {/* Col 3 — Aperçu live */}
        <div className="w-[380px] xl:w-[420px] flex-shrink-0 flex flex-col bg-gray-100">
          <div className="flex-1 p-5 min-h-0 flex flex-col">
            <CodPreview offers={offers} design={design} selectedProduct={selectedProduct} currency={currency} />
          </div>
        </div>
      </div>

      {/* ── Save button — mobile fixed bottom bar ───────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 shadow-lg">
        <button onClick={handleSave} disabled={saving || saveSuccess}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition active:scale-95 ${
            saveSuccess ? 'bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saveSuccess ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saving ? 'Sauvegarde...' : saveSuccess ? 'Sauvegardé !' : 'Sauvegarder l\'offre'}
        </button>
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
          globalDesign={design}
          onSave={saveEditedOffer}
          onClose={() => setEditingOfferIdx(null)}
        />
      )}
    </div>
  );
};

export default FormQuantityOffersWizard;
