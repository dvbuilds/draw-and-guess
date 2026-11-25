import { createContext, useCallback, useMemo, useState } from 'react';
import { SUPPORTED_LANGUAGES, getTranslations } from '../utils/i18n.js';

const STORAGE_KEY = 'draw_and_guess_language';

function loadInitialLanguage() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

export const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadInitialLanguage);

  const setLanguage = useCallback((nextCode) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === nextCode)) return;
    setLanguageState(nextCode);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextCode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const t = useMemo(() => getTranslations(language), [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languages: SUPPORTED_LANGUAGES,
      t,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
