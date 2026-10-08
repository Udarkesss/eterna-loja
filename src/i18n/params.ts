import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import type { Locale } from "@/types";

/**
 * EN: Reads and checks the [locale] route segment. Every page uses this helper.
 * PT: Lê e verifica o segmento [locale] da rota. Todas as páginas usam esta função.
 */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
