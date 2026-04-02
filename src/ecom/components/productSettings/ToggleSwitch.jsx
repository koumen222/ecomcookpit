import React from 'react';

const ToggleSwitch = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex-1 min-w-0 mr-3">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4F]/40 ${
        checked ? 'bg-[#0F6B4F]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export default ToggleSwitch;
