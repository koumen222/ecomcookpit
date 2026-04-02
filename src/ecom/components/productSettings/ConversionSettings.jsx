import React, { useState } from 'react';
import { TrendingUp, Plus, X } from 'lucide-react';
import SectionCard from './SectionCard';
import ToggleSwitch from './ToggleSwitch';

const ConversionSettings = ({ config, onChange }) => {
  const [newQty, setNewQty] = useState('');

  const update = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  const addQuantity = () => {
    const num = parseInt(newQty, 10);
    if (!num || num < 1 || config.quantities.includes(num)) return;
    update('quantities', [...config.quantities, num].sort((a, b) => a - b));
    setNewQty('');
  };

  const removeQuantity = (qty) => {
    update('quantities', config.quantities.filter((q) => q !== qty));
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={<TrendingUp size={18} />} title="Conversion Settings" description="Boost your conversion rate with upsells and order bumps.">
        <ToggleSwitch
          label="Upsell"
          description="Suggest a higher-value product at checkout"
          checked={config.upsell}
          onChange={(v) => update('upsell', v)}
        />
        <ToggleSwitch
          label="Order Bump"
          description="Add a complementary product on the checkout form"
          checked={config.orderBump}
          onChange={(v) => update('orderBump', v)}
        />

        <div className="pt-3 border-t border-gray-100 mt-3">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Available Quantities</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {config.quantities.map((qty) => (
              <span
                key={qty}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E6F2ED] text-[#0F6B4F] text-sm font-medium"
              >
                {qty}
                <button
                  onClick={() => removeQuantity(qty)}
                  className="hover:text-red-500 transition-colors"
                  aria-label={`Remove quantity ${qty}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {config.quantities.length === 0 && (
              <span className="text-xs text-gray-400 italic">No quantities set</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addQuantity()}
              placeholder="Add qty..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F6B4F] focus:ring-1 focus:ring-[#0F6B4F]/20"
            />
            <button
              onClick={addQuantity}
              className="px-3 py-2 rounded-xl bg-[#0F6B4F] text-white text-sm font-medium hover:bg-[#0d5a42] transition-colors flex items-center gap-1"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default ConversionSettings;
