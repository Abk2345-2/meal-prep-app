import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { LANGUAGES, LangCode, TranslationKey, t as translate } from './i18n';

const LANG_KEY = 'ptp_language';

interface LanguageContextValue {
  lang: LangCode;
  setLang: (code: LangCode) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY).then((stored) => {
      if (stored) setLangState(stored as LangCode);
    });
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    SecureStore.setItemAsync(LANG_KEY, code);
  }, []);

  const tFn = useCallback((key: TranslationKey) => translate(key, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

export { LANGUAGES };
export type { LangCode };
