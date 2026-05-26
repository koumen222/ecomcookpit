import React, { useState } from 'react';
import { Plus, X, Tag, Flame, Check, Wand2, ChevronDown, ChevronUp, Palette } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);

const inputCls = 'w-full px-2.5 py-2 rounded-xl border border-gray-200 text-[12px] focus:outline-none focus:border-primary-400';

const DEFAULT_OFFER_DESIGN = {
  displayType: 'radio',
  borderRadius: 10,
  borderStyle: 'solid',
  borderColorSelected: '',
  borderColorUnselected: '#E5E7EB',
  bgColorSelected: '',
  bgColorUnselected: '#ffffff',
  radioColor: '',
  badgeBg: '',
  badgeTextColor: '#ffffff',
  badgeRadius: 20,
  priceColor: '',
  priceFontSize: 14,
  discountBg: '#FEE2E2',
  discountTextColor: '#EF4444',
  sectionLabel: '',
};

// ── Small reusable sub-components ──────────────────────────────────────────────

const ColorRow = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <label className="text-[11px] text-gray-600 flex-1 truncate">{label}</label>
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value || '#000000'}
        onChange={e => onChange(e.target.value)}
        className="w-7 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="auto"
        className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-[11px] focus:outline-none focus:border-primary-400 font-mono"
      />
      {value && (
        <button onClick={() => onChange('')} className="text-gray-300 hover:text-red-400 transition-colors text-[10px]">✕</button>
      )}
    </div>
  </div>
);

const SliderRow = ({ label, value, onChange, min = 0, max = 24, unit = 'px' }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[11px] text-gray-600">{label}</label>
      <span className="text-[11px] font-mono text-gray-500">{value}{unit}</span>
    </div>
    <input
      type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full h-1.5 appearance-none rounded-full bg-gray-200 accent-primary-500"
    />
  </div>
);

// ── Live preview card ───────────────────────────────────────────────────────────

const PreviewCard = ({ selected, offer, od, accentColor }) => {
  const borderRadius = od.borderRadius ?? 10;
  const borderStyle = od.borderStyle || 'solid';
  const borderColorSel = od.borderColorSelected || accentColor;
  const borderColorUnsel = od.borderColorUnselected || '#E5E7EB';
  const bgSel = od.bgColorSelected || `${accentColor}08`;
  const bgUnsel = od.bgColorUnselected || '#ffffff';
  const radioColor = od.radioColor || accentColor;
  const badgeBg = od.badgeBg || accentColor;
  const badgeText = od.badgeTextColor || '#ffffff';
  const badgeRadius = od.badgeRadius ?? 20;
  const priceColor = od.priceColor || accentColor;
  const priceFontSize = od.priceFontSize || 14;
  const discBg = od.discountBg || '#FEE2E2';
  const discText = od.discountTextColor || '#EF4444';

  const disc = offer.comparePrice > offer.price && offer.price > 0
    ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius,
        borderWidth: selected ? 2 : 1.5,
        borderStyle: borderStyle === 'flat' ? 'solid' : borderStyle,
        borderColor: selected ? borderColorSel : borderColorUnsel,
        backgroundColor: selected ? bgSel : bgUnsel,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'default',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        border: selected ? `4px solid ${radioColor}` : '2px solid #D1D5DB',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}
          {offer.badge && (
            <span style={{ fontSize: 9, fontWeight: 700, color: badgeText, backgroundColor: badgeBg, padding: '1px 6px', borderRadius: badgeRadius }}>
              {offer.badge}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 2 }}>
          <span style={{ fontSize: priceFontSize, fontWeight: 800, color: priceColor }}>
            {fmt(offer.price)} F
          </span>
          {disc > 0 && (<>
            <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(offer.comparePrice)} F</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: discText, backgroundColor: discBg, padding: '1px 5px', borderRadius: 10 }}>-{disc}%</span>
          </>)}
        </div>
      </div>
    </div>
  );
};

// ── Image-row style preview (liste avec image) ──────────────────────────────────

const PreviewCardImage = ({ selected, offer, od, accentColor }) => {
  const borderRadius = od.borderRadius ?? 10;
  const borderColorSel = od.borderColorSelected || accentColor;
  const borderColorUnsel = od.borderColorUnselected || '#E5E7EB';
  const bgSel = od.bgColorSelected || `${accentColor}08`;
  const bgUnsel = od.bgColorUnselected || '#ffffff';
  const badgeBg = od.badgeBg || accentColor;
  const badgeText = od.badgeTextColor || '#ffffff';
  const priceColor = od.priceColor || accentColor;
  const priceFontSize = od.priceFontSize || 14;
  const discBg = od.discountBg || '#FEE2E2';
  const discText = od.discountTextColor || '#EF4444';
  const disc = offer.comparePrice > offer.price && offer.price > 0
    ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;

  return (
    <div style={{ borderRadius, borderWidth: selected ? 2 : 1.5, borderStyle: 'solid', borderColor: selected ? borderColorSel : borderColorUnsel, backgroundColor: selected ? bgSel : bgUnsel, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'default' }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: 4, background: 'linear-gradient(135deg,#e5e7eb,#d1d5db)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}</div>
        {disc > 0 && (
          <div style={{ display: 'inline-flex', marginTop: 2, background: discBg, padding: '1px 7px', borderRadius: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: discText }}>Économisez {disc}%</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 3 }}>
          <span style={{ fontSize: priceFontSize, fontWeight: 800, color: priceColor }}>{fmt(offer.price)} F</span>
          {disc > 0 && <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(offer.comparePrice)} F</span>}
        </div>
      </div>
      {offer.badge && (
        <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: badgeText, backgroundColor: badgeBg, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap' }}>
          {offer.badge}
        </div>
      )}
    </div>
  );
};

// ── Grid (colonnes) style preview ───────────────────────────────────────────────

const PreviewCardGrid = ({ selected, offer, od, accentColor }) => {
  const borderRadius = od.borderRadius ?? 10;
  const borderColorSel = od.borderColorSelected || accentColor;
  const borderColorUnsel = od.borderColorUnselected || '#E5E7EB';
  const bgSel = od.bgColorSelected || `${accentColor}08`;
  const bgUnsel = od.bgColorUnselected || '#ffffff';
  const badgeBg = od.badgeBg || accentColor;
  const badgeText = od.badgeTextColor || '#ffffff';
  const priceColor = od.priceColor || accentColor;
  const priceFontSize = od.priceFontSize || 13;
  const discBg = od.discountBg || '#FEE2E2';
  const discText = od.discountTextColor || '#EF4444';
  const disc = offer.comparePrice > offer.price && offer.price > 0
    ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;

  return (
    <div style={{ borderRadius, borderWidth: selected ? 2 : 1.5, borderStyle: 'solid', borderColor: selected ? borderColorSel : borderColorUnsel, backgroundColor: selected ? bgSel : bgUnsel, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 8px 12px', gap: 6, cursor: 'default', position: 'relative', overflow: 'hidden' }}>
      {offer.badge && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center', background: badgeBg, color: badgeText, fontSize: 8, fontWeight: 700, padding: '2px 0' }}>{offer.badge}</div>
      )}
      <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#F3F4F6', marginTop: offer.badge ? 10 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 26, height: 26, borderRadius: 4, background: 'linear-gradient(135deg,#e5e7eb,#d1d5db)' }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#111827', textAlign: 'center' }}>{offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}</div>
      {disc > 0 && (
        <div style={{ background: discBg, padding: '2px 8px', borderRadius: 20 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: discText }}>Économisez {disc}%</span>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: priceFontSize, fontWeight: 800, color: priceColor }}>{fmt(offer.price)} F</div>
        {disc > 0 && <div style={{ fontSize: 10, color: '#9CA3AF', textDecoration: 'line-through' }}>{fmt(offer.comparePrice)} F</div>}
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────────

const OffersEditor = ({ config, onChange, basePrice = 0 }) => {
  const { offersEnabled, offers } = config;
  const [designOpen, setDesignOpen] = useState(false);

  const od = { ...DEFAULT_OFFER_DESIGN, ...(config.offerDesign || {}) };
  const accentColor = '#D94A1F';

  const update = (key, val) => onChange({ ...config, [key]: val });
  const updateOD = (key, val) => update('offerDesign', { ...od, [key]: val });

  const autofillPrices = () => {
    if (!basePrice) return;
    const discounts = [0, 0.05, 0.10];
    const filled = offers.map((o, i) => {
      const disc = discounts[i] ?? 0.10;
      const unitPrice = Math.round(basePrice * (1 - disc) / 100) * 100;
      return { ...o, price: unitPrice * o.qty, comparePrice: basePrice * o.qty };
    });
    update('offers', filled);
  };

  const updateOffer = (idx, key, val) => {
    update('offers', offers.map((o, i) => i === idx ? { ...o, [key]: val } : o));
  };

  const addOffer = () => {
    const maxQty = offers.reduce((m, o) => Math.max(m, o.qty), 0);
    update('offers', [...offers, { qty: maxQty + 1, price: 0, comparePrice: 0, badge: '', selected: false }]);
  };

  const removeOffer = (idx) => {
    if (offers.length <= 1) return;
    const next = offers.filter((_, i) => i !== idx);
    if (!next.some(o => o.selected)) next[0].selected = true;
    update('offers', next);
  };

  const selectOffer = (idx) => {
    update('offers', offers.map((o, i) => ({ ...o, selected: i === idx })));
  };

  // Mock offers for preview
  const previewOffers = [
    { qty: 2, price: 19900, comparePrice: 24900, badge: 'Populaire' },
    { qty: 1, price: 11900, comparePrice: 0, badge: '' },
  ];

  return (
    <div>
      <ToggleSwitch
        label="Activer les offres quantité"
        description="Proposer des réductions pour les achats en lot"
        checked={offersEnabled}
        onChange={(v) => update('offersEnabled', v)}
      />

      {offersEnabled && basePrice > 0 && (
        <button
          onClick={autofillPrices}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-primary-300 text-[12px] font-semibold text-primary-700 hover:bg-primary-50 transition-colors"
        >
          <Wand2 size={13} />
          Pré-remplir depuis le prix du produit ({fmt(basePrice)} F)
        </button>
      )}

      {offersEnabled && basePrice === 0 && (
        <p className="mt-2 text-[10px] text-gray-400 italic px-1">
          Sélectionnez un produit en haut pour activer le pré-remplissage automatique des prix.
        </p>
      )}

      {offersEnabled && (
        <div className="mt-4 space-y-3">

          {/* ── Type d'affichage des offres ── */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Type d'affichage</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'radio', label: 'Radio', desc: 'Liste avec bouton radio', icon: '☰' },
                { val: 'image-row', label: 'Image + texte', desc: 'Liste avec miniature', icon: '🖼' },
                { val: 'grid', label: 'Grille', desc: 'Colonnes avec grande image', icon: '⊞' },
              ].map(({ val, label, icon }) => (
                <button
                  key={val}
                  onClick={() => updateOD('displayType', val)}
                  className={`py-2 px-1 rounded-xl border text-center transition-colors ${
                    (od.displayType || 'radio') === val
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="text-base leading-none mb-1">{icon}</div>
                  <div className="text-[10px] font-semibold">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {offers.map((offer, idx) => {
            const discount = offer.comparePrice > offer.price && offer.price > 0
              ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;

            return (
              <div
                key={idx}
                className={`relative rounded-2xl border-2 p-4 transition-all ${
                  offer.selected
                    ? 'border-primary-400 bg-primary-50/50 shadow-sm ring-1 ring-primary-200/50'
                    : 'border-gray-150 bg-white hover:border-gray-200'
                }`}
              >
                {offer.selected && (
                  <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center gap-1">
                    <Check size={9} /> Par défaut
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                      offer.selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {offer.qty}×
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800">
                        {offer.qty} {offer.qty === 1 ? 'unité' : 'unités'}
                      </div>
                      {discount > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Flame size={10} className="text-red-500" />
                          <span className="text-[11px] font-bold text-red-500">-{discount}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!offer.selected && (
                      <button
                        onClick={() => selectOffer(idx)}
                        className="text-[10px] font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        Sélectionner
                      </button>
                    )}
                    {offers.length > 1 && (
                      <button
                        onClick={() => removeOffer(idx)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Quantité</label>
                    <input
                      type="number" min="1"
                      value={offer.qty}
                      onChange={e => updateOffer(idx, 'qty', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prix</label>
                    <input
                      type="number" min="0"
                      value={offer.price || ''}
                      onChange={e => updateOffer(idx, 'price', parseInt(e.target.value) || 0)}
                      placeholder="Prix net"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prix barré</label>
                    <input
                      type="number" min="0"
                      value={offer.comparePrice || ''}
                      onChange={e => updateOffer(idx, 'comparePrice', parseInt(e.target.value) || 0)}
                      placeholder="Ancien prix"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Badge</label>
                    <div className="relative">
                      <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        type="text"
                        value={offer.badge}
                        onChange={e => updateOffer(idx, 'badge', e.target.value)}
                        placeholder="Ex: Populaire"
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                      />
                    </div>
                  </div>
                </div>

                {offer.price > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-gray-900">{fmt(offer.price)} F</span>
                      {offer.comparePrice > offer.price && (
                        <span className="text-xs text-gray-400 line-through">{fmt(offer.comparePrice)} F</span>
                      )}
                    </div>
                    {offer.qty > 1 && (
                      <span className="text-[10px] font-medium text-gray-400">
                        {fmt(Math.round(offer.price / offer.qty))} F/unité
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={addOffer}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Ajouter une offre
          </button>

          {/* ── Design des cartes ── */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setDesignOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
                <Palette size={14} className="text-primary-500" />
                Design des cartes
              </div>
              {designOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>

            {designOpen && (
              <div className="p-4 space-y-5 bg-white">

                {/* Couleurs de carte */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Couleurs de carte</p>
                  <div className="space-y-2.5">
                    <ColorRow label="Bordure sélectionnée" value={od.borderColorSelected} onChange={v => updateOD('borderColorSelected', v)} />
                    <ColorRow label="Bordure non-sélectionnée" value={od.borderColorUnselected} onChange={v => updateOD('borderColorUnselected', v)} />
                    <ColorRow label="Fond sélectionné" value={od.bgColorSelected} onChange={v => updateOD('bgColorSelected', v)} />
                    <ColorRow label="Fond non-sélectionné" value={od.bgColorUnselected} onChange={v => updateOD('bgColorUnselected', v)} />
                  </div>
                </div>

                {/* Style de bordure */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Style de bordure</p>
                  <div className="flex gap-2">
                    {[
                      { val: 'solid', label: 'Plein' },
                      { val: 'dashed', label: 'Tirets' },
                      { val: 'dotted', label: 'Pointillés' },
                    ].map(({ val, label }) => (
                      <button
                        key={val}
                        onClick={() => updateOD('borderStyle', val)}
                        className={`flex-1 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                          od.borderStyle === val
                            ? 'border-primary-400 bg-primary-50 text-primary-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border radius */}
                <SliderRow label="Arrondi des cartes" value={od.borderRadius} onChange={v => updateOD('borderRadius', v)} min={0} max={24} unit="px" />

                {/* Radio dot */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Point radio</p>
                  <ColorRow label="Couleur du point" value={od.radioColor} onChange={v => updateOD('radioColor', v)} />
                </div>

                {/* Badge */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Badge</p>
                  <div className="space-y-2.5">
                    <ColorRow label="Fond du badge" value={od.badgeBg} onChange={v => updateOD('badgeBg', v)} />
                    <ColorRow label="Texte du badge" value={od.badgeTextColor} onChange={v => updateOD('badgeTextColor', v)} />
                    <SliderRow label="Arrondi du badge" value={od.badgeRadius} onChange={v => updateOD('badgeRadius', v)} min={0} max={24} unit="px" />
                  </div>
                </div>

                {/* Prix */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Prix</p>
                  <div className="space-y-2.5">
                    <ColorRow label="Couleur du prix" value={od.priceColor} onChange={v => updateOD('priceColor', v)} />
                    <SliderRow label="Taille du prix" value={od.priceFontSize} onChange={v => updateOD('priceFontSize', v)} min={10} max={22} unit="px" />
                  </div>
                </div>

                {/* Badge remise */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Badge remise</p>
                  <div className="space-y-2.5">
                    <ColorRow label="Fond remise" value={od.discountBg} onChange={v => updateOD('discountBg', v)} />
                    <ColorRow label="Texte remise" value={od.discountTextColor} onChange={v => updateOD('discountTextColor', v)} />
                  </div>
                </div>

                {/* Section label */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Titre de la section</p>
                  <input
                    type="text"
                    value={od.sectionLabel}
                    onChange={e => updateOD('sectionLabel', e.target.value)}
                    placeholder="Choisissez votre offre"
                    className={inputCls}
                  />
                </div>

                {/* Live preview */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Aperçu</p>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold text-gray-600 mb-2">
                      {od.sectionLabel || 'Choisissez votre offre'}
                    </p>
                    {(od.displayType || 'radio') === 'grid' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${previewOffers.length}, 1fr)`, gap: 6 }}>
                        {previewOffers.map((offer, i) => (
                          <PreviewCardGrid key={i} selected={i === 0} offer={offer} od={od} accentColor={accentColor} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {previewOffers.map((offer, i) =>
                          (od.displayType || 'radio') === 'image-row'
                            ? <PreviewCardImage key={i} selected={i === 0} offer={offer} od={od} accentColor={accentColor} />
                            : <PreviewCard key={i} selected={i === 0} offer={offer} od={od} accentColor={accentColor} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OffersEditor;
