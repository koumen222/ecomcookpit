import React from 'react';
import { Settings } from 'lucide-react';
import SectionCard from './SectionCard';
import ToggleSwitch from './ToggleSwitch';

const GeneralSettings = ({ config, onChange }) => {
  const update = (key, value) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={<Settings size={18} />} title="General Settings" description="Control which sections appear on your product page.">
        <ToggleSwitch
          label="Customer Reviews"
          description="Show a reviews section on the product page"
          checked={config.reviews}
          onChange={(v) => update('reviews', v)}
        />
        <ToggleSwitch
          label="FAQ Section"
          description="Display frequently asked questions"
          checked={config.faq}
          onChange={(v) => update('faq', v)}
        />
        <ToggleSwitch
          label="Stock Counter"
          description="Show remaining stock to create urgency"
          checked={config.stockCounter}
          onChange={(v) => update('stockCounter', v)}
        />

        <div className="pt-3 border-t border-gray-100 mt-3">
          <label className="block text-xs font-semibold text-gray-700 mb-2">Form Display Type</label>
          <div className="flex gap-3">
            {['embedded', 'popup'].map((type) => (
              <button
                key={type}
                onClick={() => update('formType', type)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  config.formType === type
                    ? 'border-[#0F6B4F] bg-[#E6F2ED] text-[#0F6B4F]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                {type === 'embedded' ? 'Embedded' : 'Popup'}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default GeneralSettings;
