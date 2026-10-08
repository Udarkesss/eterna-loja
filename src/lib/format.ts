import type { Locale } from "@/types";

/**
 * EN: Formats meticais. Done by hand (not Intl) so server and browser always match.
 *     pt → "18 500,00 MT"   en → "18,500.00 MT"
 * PT: Formata meticais. Feito à mão (sem Intl) para o servidor e o browser darem sempre o mesmo.
 */
export function formatMZN(value: number, locale: Locale = "pt"): string {
  const [integer, decimals] = Math.abs(value).toFixed(2).split(".");
  const { group, decimal } = locale === "pt" ? { group: " ", decimal: "," } : { group: ",", decimal: "." };
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${value < 0 ? "-" : ""}${grouped}${decimal}${decimals} MT`;
}
