'use client';

import { useCallback, useEffect, useState } from 'react';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'ur', label: 'اردو' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'as', label: 'অসমীয়া' },
  { code: 'mai', label: 'मैथिली' },
  { code: 'ne', label: 'नेपाली' },
  { code: 'kok', label: 'कोंकणी' },
  { code: 'doi', label: 'डोगरी' },
  { code: 'bho', label: 'भोजपुरी' },
  { code: 'sd', label: 'سنڌي' },
  { code: 'ks', label: 'كَشميري' },
  { code: 'mni', label: 'মেইতেই' },
  { code: 'sat', label: 'ᱥᱟᱱᱛᱟᱲᱤ' },
] as const;

export type LangCode = typeof LANGUAGES[number]['code'];

const KEY = 'nuskhaa_lang';

export function useLanguage() {
  const [lang, setLangState] = useState<LangCode>('en');

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as LangCode | null;
    if (stored) setLangState(stored);
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem(KEY, code);
  }, []);

  return { lang, setLang, languages: LANGUAGES };
}
