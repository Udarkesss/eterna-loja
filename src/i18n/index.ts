import type { Locale } from "@/types";
import { en } from "./dictionaries/en";
import { pt, type Dictionary } from "./dictionaries/pt";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { pt, en };

/** EN: All texts for one language. PT: Todos os textos de um idioma. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * EN: Picks singular or plural and fills {count}: plural({ one: "1 piece", other: "{count} pieces" }, 3) → "3 pieces".
 * PT: Escolhe singular ou plural e preenche {count}: plural({ one: "1 peça", other: "{count} peças" }, 3) → "3 peças".
 */
export function plural(forms: { one: string; other: string }, count: number): string {
  return t(count === 1 ? forms.one : forms.other, { count });
}

/**
 * EN: Fills {placeholders}: t("Pay {amount}", { amount: "10 MT" }) → "Pay 10 MT".
 * PT: Preenche {marcadores}: t("Pagar {amount}", { amount: "10 MT" }) → "Pagar 10 MT".
 */
export function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
