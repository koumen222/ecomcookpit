import React from 'react';
import { Lock, ShieldCheck, X } from 'lucide-react';

const DEFAULT_FOOTER_ITEMS = [
  { icon: Lock, label: 'Paiement securise' },
  { icon: ShieldCheck, label: 'Activation instantanee' },
  { label: 'MoneyFusion' },
];

export default function PaymentModalFrame({
  onClose,
  eyebrow,
  title,
  subtitle,
  icon,
  // headerClassName kept for API compat but unused in flat design
  headerClassName,
  maxWidthClassName = 'max-w-md',
  summary,
  footerItems = DEFAULT_FOOTER_ITEMS,
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-3 sm:p-5 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${maxWidthClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-5 sm:px-6">
          {icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-scalor-green p-2 text-white">
              {icon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">{eyebrow}</p>
            ) : null}
            <h2 className="text-base font-bold text-gray-900 sm:text-lg">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs leading-5 text-gray-500">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary strip */}
        {summary ? (
          <div className="flex items-center justify-between gap-3 bg-gray-50 px-5 py-3 sm:px-6">
            <div className="min-w-0">
              {summary.label ? (
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">{summary.label}</p>
              ) : null}
              <div className="mt-0.5 flex items-baseline gap-2">
                {summary.beforeValue ? (
                  <span className="text-sm text-gray-400 line-through">{summary.beforeValue}</span>
                ) : null}
                <p className="text-xl font-black text-gray-900">{summary.value}</p>
              </div>
              {summary.meta ? (
                <p className="mt-0.5 text-xs text-gray-500">{summary.meta}</p>
              ) : null}
            </div>
            {summary.badge ? (
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-bold text-gray-700 shadow-sm">
                {summary.badge}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Body */}
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {children}
        </div>

        {/* Footer */}
        {footerItems?.length ? (
          <div className="border-t border-gray-100 px-5 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
              {footerItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <React.Fragment key={`${item.label}-${index}`}>
                    <span className="inline-flex items-center gap-1">
                      {Icon ? <Icon className="h-3 w-3" /> : null}
                      {item.label}
                    </span>
                    {index < footerItems.length - 1 ? <span>·</span> : null}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}