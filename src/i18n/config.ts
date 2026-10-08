import { LOCALES, type Locale } from "@/types";

/**
 * EN: Language settings. To add a language: add it to LOCALES in src/types,
 *     create src/i18n/dictionaries/<code>.ts and add it to the maps below.
 * PT: Definições de idioma. Para juntar um idioma: acrescentá-lo a LOCALES em src/types,
 *     criar src/i18n/dictionaries/<código>.ts e juntá-lo aos mapas abaixo.
 */

export { LOCALES, type Locale };

export const DEFAULT_LOCALE: Locale = "pt";

/** EN: Remembers the visitor's choice. PT: Guarda a escolha da visitante. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const HTML_LANG: Record<Locale, string> = { pt: "pt-MZ", en: "en" };

export const LOCALE_NAMES: Record<Locale, string> = { pt: "Português", en: "English" };

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** "/product/x" + "en" → "/en/product/x" */
export function localizePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
