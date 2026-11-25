// English / Spanish. The app is written in English; `t('English text')` returns
// the Spanish version when Spanish is on. Unknown strings fall back to English.
// The choice is kept in this browser (Profile › Settings › Language).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ES } from './i18n-es';

export type Lang = 'en' | 'es';
const KEY = 'gemfm:lang';

function startLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch { /* private mode */ }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let current: Lang = startLang();
document.documentElement.lang = current;

export const getLang = () => current;
export const locale = () => (current === 'es' ? 'es-MX' : 'en-US');

type Vars = Record<string, string | number>;

export function t(text: string, vars?: Vars) {
  const s = current === 'es' ? ES[text] ?? text : text;
  return vars ? s.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: current, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Lang>(current);
  const setLang = useCallback((l: Lang) => {
    current = l;
    document.documentElement.lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
    setState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** `t`, plus a re-render when the language changes. Call it in every component that shows text. */
export function useT() {
  useContext(LangContext);
  return t;
}
