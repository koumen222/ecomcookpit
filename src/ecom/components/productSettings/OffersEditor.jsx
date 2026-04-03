import React from 'react';
import { Plus, X, Tag, Flame, Check, Wand2 } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';

const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n);

const OffersEditor = ({ config, onChange, basePrice = 0 }) => {
  const { offersEnabled, offers } = config;

  const update = (key, val) => onChange({ ...config, [key]: val });

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
          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-emerald-300 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
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
          {offers.map((offer, idx) => {
            const discount = offer.comparePrice > offer.price && offer.price > 0
              ? Math.round((1 - offer.price / offer.comparePrice) * 100) : 0;

            return (
              <div
                key={idx}
                className={`relative rounded-2xl border-2 p-4 transition-all ${
                  offer.selected
                    ? 'border-emerald-400 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-200/50'
                    : 'border-gray-150 bg-white hover:border-gray-200'
                }`}
              >
                {offer.selected && (
                  <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1">
                    <Check size={9} /> Par défaut
                  </div>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${
                      offer.selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
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
                        className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prix</label>
                    <input
                      type="number" min="0"
                      value={offer.price || ''}
                      onChange={e => updateOffer(idx, 'price', parseInt(e.target.value) || 0)}
                      placeholder="Prix net"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prix barré</label>
                    <input
                      type="number" min="0"
                      value={offer.comparePrice || ''}
                      onChange={e => updateOffer(idx, 'comparePrice', parseInt(e.target.value) || 0)}
                      placeholder="Ancien prix"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
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
            className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Ajouter une offre
          </button>
        </div>
      )}
    </div>
  );
};

export default OffersEditor;
