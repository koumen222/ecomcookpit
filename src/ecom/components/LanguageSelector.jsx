import { useLanguage } from '../contexts/LanguageContext.jsx';

// Sélecteur de langue compact. Se branche sur LanguageContext (langue mémorisée).
const LanguageSelector = ({ className = '' }) => {
  const { lang, setLang, languages } = useLanguage();

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white p-0.5 ${className}`}>
      {languages.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            title={l.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span aria-hidden="true">{l.flag}</span>
            <span className="uppercase tracking-wide">{l.code}</span>
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSelector;
