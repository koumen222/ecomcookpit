import React from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket,
  Zap,
  X,
  ArrowRight,
  Check,
  Package,
  FileText,
  ShoppingCart,
  Target,
} from 'lucide-react';

// Mappe une clé d'étape vers son icône Lucide.
const STEP_ICONS = {
  product: Package,
  report: FileText,
  order: ShoppingCart,
  goal: Target,
};

/**
 * Carte d'étape du guide de démarrage.
 * - done   : étape complétée (checkmark vert, style discret)
 * - active : prochaine étape à faire (mise en avant, CTA "Commencer")
 * - todo   : étape restante non prioritaire
 */
const StepCard = ({ step, isActive }) => {
  const Icon = STEP_ICONS[step.key] || Package;

  if (step.done) {
    return (
      <Link
        to={step.link}
        className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">
          <Check className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-500 line-through decoration-gray-300">
            {step.title}
          </p>
          <p className="truncate text-xs text-primary-600">Terminé</p>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={step.link}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
        isActive
          ? 'border-primary-500 bg-primary-50/50 ring-1 ring-inset ring-primary-500/20 hover:bg-primary-50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          isActive ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{step.title}</p>
        <p className="truncate text-xs text-gray-500">{step.description}</p>
      </div>
      <span
        className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold ${
          isActive ? 'text-primary-700' : 'text-gray-400 group-hover:text-gray-600'
        }`}
      >
        {isActive && <span className="hidden sm:inline">Commencer</span>}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
};

/**
 * Bloc "passer à l'action" du dashboard.
 *
 * variant="guide"    → grand guide de démarrage (compte neuf, non opérationnel)
 * variant="reminder" → rappel léger (marchand établi, période sans vente)
 */
const DashboardActivation = ({
  variant = 'guide',
  steps = [],
  completedCount = 0,
  totalCount = 0,
  onDismiss,
}) => {
  if (variant === 'reminder') {
    // Deux premières étapes non complétées = actions à proposer (fallback : 2 premières).
    const suggested = (steps.filter((s) => !s.done).length ? steps.filter((s) => !s.done) : steps).slice(0, 2);
    return (
      <section className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Zap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Aucune vente sur cette période</p>
              <p className="text-xs text-gray-500">Gardez le rythme : mettez à jour vos données ou lancez une action.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {suggested.map((s, i) => (
              <Link
                key={s.key}
                to={s.link}
                className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  i === 0
                    ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s.title}
              </Link>
            ))}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Masquer ce rappel pour aujourd'hui"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // variant === 'guide'
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const activeKey = steps.find((s) => !s.done)?.key;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-sm">
      {/* Bandeau d'en-tête avec léger dégradé de marque */}
      <div className="relative bg-gradient-to-br from-primary-50 via-white to-white px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm shadow-primary-600/30">
              <Rocket className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-gray-900 sm:text-lg">
                Faites décoller votre boutique 🚀
              </h2>
              <p className="mt-0.5 text-sm text-gray-600">
                Complétez ces étapes pour activer vos statistiques et suivre vos ventes.
              </p>
            </div>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Masquer le guide de démarrage"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/70 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Progression */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200/70">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-gray-600">
            {completedCount}/{totalCount} étapes
          </span>
        </div>
      </div>

      {/* Grille des étapes */}
      <div className="grid grid-cols-1 gap-2.5 px-5 pb-5 pt-4 sm:grid-cols-2 sm:px-6">
        {steps.map((step) => (
          <StepCard key={step.key} step={step} isActive={step.key === activeKey} />
        ))}
      </div>
    </section>
  );
};

export default DashboardActivation;
