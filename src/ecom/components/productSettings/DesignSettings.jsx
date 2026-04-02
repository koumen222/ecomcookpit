import React from 'react';
import { Palette } from 'lucide-react';
import SectionCard from './SectionCard';
import ToggleSwitch from './ToggleSwitch';

const ColorField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer appearance-none bg-transparent p-0.5"
        />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-[#0F6B4F] focus:ring-1 focus:ring-[#0F6B4F]/20"
      />
    </div>
  </div>
);

const DesignSettings = ({ config, onChange }) => {
  const update = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={<Palette size={18} />} title="Design Settings" description="Customize the look and feel of your product page.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorField label="Button Color" value={config.buttonColor} onChange={(v) => update('buttonColor', v)} />
          <ColorField label="Background Color" value={config.backgroundColor} onChange={(v) => update('backgroundColor', v)} />
          <ColorField label="Text Color" value={config.textColor} onChange={(v) => update('textColor', v)} />
        </div>

        <div className="pt-4 border-t border-gray-100 mt-4">
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Border Radius</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="24"
              value={parseInt(config.borderRadius, 10) || 0}
              onChange={(e) => update('borderRadius', `${e.target.value}px`)}
              className="flex-1 accent-[#0F6B4F]"
            />
            <span className="text-sm font-mono text-gray-600 w-12 text-right">{config.borderRadius}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 mt-3">
          <ToggleSwitch
            label="Box Shadow"
            description="Add a subtle shadow to the order form card"
            checked={config.shadow}
            onChange={(v) => update('shadow', v)}
          />
        </div>
      </SectionCard>
    </div>
  );
};

export default DesignSettings;
