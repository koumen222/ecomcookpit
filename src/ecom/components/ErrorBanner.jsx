import React from 'react';

/**
 * Bannière d'erreur professionnelle avec lien vers le support.
 * Usage : <ErrorBanner message={error} />
 * Props :
 *   message  — texte de l'erreur (string). Si vide/null, le composant ne rend rien.
 *   detail   — détail technique optionnel affiché en petit (string)
 *   onDismiss — callback optionnel pour fermer la bannière (function)
 *   className — classes Tailwind supplémentaires
 */
const ErrorBanner = ({ message, detail, onDismiss, className = '' }) => {
  if (!message) return null;

  const openSupport = (e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('scalor:open-support'));
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 ${className}`}>
      {/* Icône */}
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800 leading-snug">{message}</p>
        {detail && (
          <p className="mt-0.5 text-[11px] text-red-400 font-mono truncate">{detail}</p>
        )}
        <p className="mt-1.5 text-xs text-red-600">
          Si le problème persiste,{' '}
          <button
            type="button"
            onClick={openSupport}
            className="font-semibold underline underline-offset-2 hover:text-red-800 transition-colors"
          >
            contactez le support
          </button>
          {' '}— nous répondons rapidement.
        </p>
      </div>

      {/* Bouton fermer */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg text-red-300 hover:text-red-600 hover:bg-red-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
