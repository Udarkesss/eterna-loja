import type { Locale } from "@/types";

/**
 * EN: Turns the link format used in content and navigation into a real URL:
 *     "category:ocasioes" → /pt/category/ocasioes · "product:8g1l7" → /pt/product/8g1l7 ·
 *     "#prova" → /pt/fitting (the "Agendar prova" page) · "#x" → /pt#x (a home section) · "/path" → /pt/path ·
 *     "https://…" unchanged.
 * PT: Converte o formato de ligações do conteúdo e do menu num endereço real (ver exemplos acima).
 */
export function resolveHref(href: string, locale: Locale): string {
  if (/^(https?:|mailto:|tel:)/.test(href)) return href;
  if (href.startsWith("category:")) return `/${locale}/category/${href.slice(9)}`;
  if (href.startsWith("product:")) return `/${locale}/product/${href.slice(8)}`;
  if (href === "#prova") return `/${locale}/fitting`;
  if (href.startsWith("#")) return `/${locale}${href}`;
  return `/${locale}${href.startsWith("/") ? href : `/${href}`}`;
}

export const categoryHref = (slug: string, locale: Locale) => `/${locale}/category/${slug}`;
export const productHref = (slug: string, locale: Locale) => `/${locale}/product/${slug}`;
