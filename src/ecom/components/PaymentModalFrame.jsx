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
  headerClassName = 'bg-gradient-to-br from-[#0F6B4F] via-[#169168] to-[#1bb57e]',
  maxWidthClassName = 'max-w-lg',
  summary,
  footerItems = DEFAULT_FOOTER_ITEMS,
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#07130d]/72 p-3 sm:p-5 backdrop-blur-xl"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-[30px] border border-white/50 bg-[#FCFFFD] shadow-[0_36px_120px_rgba(5,18,12,0.34)] ${maxWidthClassName}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`relative overflow-hidden px-5 pb-6 pt-5 text-white sm:px-6 ${headerClassName}`}>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-24 h-44 w-44 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-black/10 blur-2xl" />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/15 text-white/90 transition hover:bg-white/25"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative z-10 pr-12">
            <div className="flex items-start gap-3.5">
              {icon ? (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/15 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-sm">
                  {icon}
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                {eyebrow ? (
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
                ) : null}
                <h2 className="mt-1 text-xl font-black tracking-tight sm:text-[1.75rem]">{title}</h2>
                {subtitle ? (
                  <p className="mt-1.5 max-w-[30rem] text-sm leading-5 text-white/72">{subtitle}</p>
                ) : null}
              </div>
            </div>

            {summary ? (
              <div className="mt-5 rounded-[24px] border border-white/15 bg-white/12 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-xl sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {summary.label ? (
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/66">{summary.label}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                      {summary.beforeValue ? (
                        <span className="text-base font-semibold text-white/35 line-through">{summary.beforeValue}</span>
                      ) : null}
                      <p className="text-[2rem] font-black leading-none tracking-tight sm:text-[2.25rem]">{summary.value}</p>
                    </div>
                    {summary.meta ? (
                      <p className="mt-2 text-xs font-medium leading-5 text-white/70">{summary.meta}</p>
                    ) : null}
                  </div>

                  {summary.badge ? (
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-900 shadow-sm">
                      {summary.badge}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,#ffffff_0%,#f6faf7_100%)] px-5 py-5 sm:px-6 sm:py-6">
          {children}
        </div>

        {footerItems?.length ? (
          <div className="border-t border-[#E4ECE6] bg-white/90 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-[#6A776F] sm:gap-3">
              {footerItems.map((item, index) => {
                const Icon = item.icon;

                return (
                  <React.Fragment key={`${item.label}-${index}`}>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F7F4] px-2.5 py-1">
                      {Icon ? <Icon className="h-3.5 w-3.5 text-[#0F6B4F]" /> : null}
                      <span>{item.label}</span>
                    </span>
                    {index < footerItems.length - 1 ? <span className="text-[#C6D1CA]">•</span> : null}
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