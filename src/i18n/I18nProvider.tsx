"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/types";
import { getDictionary, type Dictionary } from "./index";
import { localizePath } from "./config";

interface I18nContextValue {
  locale: Locale;
  dict: Dictionary;
  /** EN: Prefixes a path with the current language. PT: Junta o idioma actual ao caminho. */
  href: (path?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * EN: Gives client components the current language and its texts.
 * PT: Dá aos componentes de cliente o idioma actual e os seus textos.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: I18nContextValue = {
    locale,
    dict: getDictionary(locale),
    href: (path) => localizePath(locale, path),
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
