import type { MobileMethod } from "@/types";

/**
 * EN: Mozambican mobile numbers (MSISDN) and which mobile-money service each one uses.
 * PT: Números de telemóvel moçambicanos (MSISDN) e o serviço de dinheiro móvel de cada um.
 */

const PREFIXES: Record<MobileMethod, string[]> = {
  mpesa: ["84", "85"], // Vodacom
  emola: ["86", "87"], // Movitel
  mkesh: ["82", "83"], // Tmcel
};

export const OPERATOR_NAMES: Record<MobileMethod, string> = {
  mpesa: "Vodacom",
  emola: "Movitel",
  mkesh: "Tmcel",
};

/**
 * EN: Accepts "84 123 4567", "+258 84 123 4567" or "258841234567". Returns 9 digits, or null.
 * PT: Aceita "84 123 4567", "+258 84 123 4567" ou "258841234567". Devolve 9 dígitos, ou null.
 */
export function normalizeMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^258(?=\d{9}$)/, "");
  return /^8[2-7]\d{7}$/.test(digits) ? digits : null;
}

export function methodFromMsisdn(input: string): MobileMethod | null {
  const number = normalizeMsisdn(input);
  if (!number) return null;
  const prefix = number.slice(0, 2);
  return (Object.keys(PREFIXES) as MobileMethod[]).find((m) => PREFIXES[m].includes(prefix)) ?? null;
}

export function validateMsisdn(input: string, method: MobileMethod): boolean {
  return methodFromMsisdn(input) === method;
}

/** "841234567" → "84 123 4567" */
export function formatMsisdn(input: string): string {
  const n = normalizeMsisdn(input);
  return n ? `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}` : input;
}

/** EN: "841234567" → "84 ••• 67" (never log or show full numbers). PT: nunca mostrar o número completo. */
export function maskMsisdn(input: string): string {
  const n = normalizeMsisdn(input);
  return n ? `${n.slice(0, 2)} ••• ${n.slice(7)}` : "•••";
}
