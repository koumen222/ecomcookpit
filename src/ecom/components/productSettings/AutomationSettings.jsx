import React from 'react';
import { MessageSquare, Info } from 'lucide-react';
import SectionCard from './SectionCard';
import ToggleSwitch from './ToggleSwitch';

const VARIABLES = ['{{name}}', '{{phone}}', '{{product}}', '{{total}}', '{{order_id}}'];

const AutomationSettings = ({ config, onChange }) => {
  const wa = config.whatsapp;

  const updateWa = (key, value) => {
    onChange({ ...config, whatsapp: { ...wa, [key]: value } });
  };

  const insertVariable = (variable) => {
    updateWa('message', wa.message + ' ' + variable);
  };

  return (
    <div className="space-y-5">
      <SectionCard icon={<MessageSquare size={18} />} title="WhatsApp Automation" description="Send automatic order confirmations via WhatsApp.">
        <ToggleSwitch
          label="Enable WhatsApp Confirmation"
          description="Automatically send a message when an order is placed"
          checked={wa.enabled}
          onChange={(v) => updateWa('enabled', v)}
        />

        {wa.enabled && (
          <div className="space-y-4 pt-3 border-t border-gray-100 mt-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">WhatsApp Number</label>
              <input
                type="tel"
                value={wa.number}
                onChange={(e) => updateWa('number', e.target.value)}
                placeholder="+225 07 XX XX XX XX"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F6B4F] focus:ring-1 focus:ring-[#0F6B4F]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message Template</label>
              <textarea
                rows={4}
                value={wa.message}
                onChange={(e) => updateWa('message', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#0F6B4F] focus:ring-1 focus:ring-[#0F6B4F]/20 resize-none"
              />
              <div className="mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Info size={12} className="text-gray-400" />
                  <span className="text-[11px] text-gray-400">Click to insert a variable</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-1 rounded-lg bg-gray-100 text-xs font-mono text-gray-600 hover:bg-[#E6F2ED] hover:text-[#0F6B4F] transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default AutomationSettings;
