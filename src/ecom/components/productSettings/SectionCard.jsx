import React from 'react';

const SectionCard = ({ icon, title, description, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-5">
      <span className="w-9 h-9 rounded-xl bg-[#E6F2ED] flex items-center justify-center text-[#0F6B4F] shrink-0">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

export default SectionCard;
