import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

// Langues supportées (extensible). L'ordre définit l'affichage du sélecteur.
export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LANG_CODES = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = 'ecomLang';
const DEFAULT_LANG = 'fr';

// Dictionnaire de traductions. Clés à plat "namespace.key".
// Pour l'instant seule la salutation du dashboard est traduite — ajouter au fur et à mesure.
const translations = {
  fr: {
    'greeting.morning': 'Bonjour',
    'greeting.afternoon': 'Bon après-midi',
    'greeting.evening': 'Bonsoir',
    'dashboard.subtitle': "Voici un aperçu de votre activité aujourd'hui.",
  },
  en: {
    'greeting.morning': 'Good morning',
    'greeting.afternoon': 'Good afternoon',
    'greeting.evening': 'Good evening',
    'dashboard.subtitle': "Here's an overview of your activity today.",
  },
  es: {
    'greeting.morning': 'Buenos días',
    'greeting.afternoon': 'Buenas tardes',
    'greeting.evening': 'Buenas noches',
    'dashboard.subtitle': 'Aquí tienes un resumen de tu actividad de hoy.',
  },
};

// Détecte la langue du navigateur (ex: "en-US" -> "en"). Repli sur le français.
const detectBrowserLang = () => {
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const code = nav.toLowerCase().split('-')[0];
    if (LANG_CODES.includes(code)) return code;
  } catch {
    // navigator indisponible (SSR, etc.)
  }
  return DEFAULT_LANG;
};

const readStoredLang = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Un choix manuel déjà mémorisé a toujours priorité.
    if (stored && LANG_CODES.includes(stored)) return stored;
  } catch {
    // localStorage indisponible (mode privé, etc.)
  }
  // Premier chargement, aucun choix : on suit la langue du navigateur.
  return detectBrowserLang();
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(readStoredLang);

  const setLang = useCallback((next) => {
    if (!LANG_CODES.includes(next)) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignorer si le stockage échoue.
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // noop
    }
  }, [lang]);

  // t(key) -> traduction dans la langue courante, avec repli sur le français puis la clé brute.
  const t = useCallback(
    (key) => (translations[lang] && translations[lang][key]) || translations[DEFAULT_LANG][key] || key,
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// Sûr même hors provider : retombe sur le français statique.
export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      t: (key) => translations[DEFAULT_LANG][key] || key,
      languages: LANGUAGES,
    };
  }
  return ctx;
};
