import React from 'react';
import { ListChecks, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import SectionCard from './SectionCard';
import ToggleSwitch from './ToggleSwitch';

const FormBuilder = ({ config, onChange }) => {
  const fields = config.fields;

  const toggleField = (index) => {
    const updated = fields.map((f, i) =>
      i === index ? { ...f, enabled: !f.enabled } : f
    );
    onChange({ ...config, fields: updated });
  };

  const moveField = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange({ ...config, fields: updated });
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={<ListChecks size={18} />} title="Form Builder" description="Choose which fields appear on the order form and reorder them.">
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.name}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                field.enabled
                  ? 'border-[#0F6B4F]/20 bg-[#F0FAF5]'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              <GripVertical size={16} className="text-gray-300 shrink-0" />

              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${field.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {field.label}
                </span>
                <span className="text-[11px] text-gray-400 ml-2 font-mono">{field.name}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => moveField(index, -1)}
                  disabled={index === 0}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move up"
                >
                  <ChevronUp size={14} className="text-gray-500" />
                </button>
                <button
                  onClick={() => moveField(index, 1)}
                  disabled={index === fields.length - 1}
                  className="p-1 rounded-lg hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move down"
                >
                  <ChevronDown size={14} className="text-gray-500" />
                </button>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={field.enabled}
                onClick={() => toggleField(index)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  field.enabled ? 'bg-[#0F6B4F]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    field.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};

export default FormBuilder;
