import { LOYALTY_LEVELS, type LoyaltyLevel } from "./help";

/**
 * EN: Loyalty programme settings of design V3 (Gestão → Definições · Programa de fidelidade): on/off, how many MT make
 *     one point, each level's points and discount, store purchases, whether the discount applies to reservations and
 *     wedding dresses, and how it meets sales and campaigns (the larger, or both together). Setting "loyalty".
 * PT: Definições do programa de fidelidade do V3: ligado/desligado, quantos MT valem um ponto, os pontos e o desconto
 *     de cada nível, compras na loja, se o desconto vale para reservas e vestidos de noiva e como se junta a saldos e
 *     campanhas (o maior, ou os dois). Definição "loyalty".
 */

export interface LoyaltySettings {
  on: boolean;
  mtPerPoint: number;
  levels: { key: LoyaltyLevel["key"]; min: number; max: number | null; pct: number }[];
  storePoints: boolean;
  onReservations: boolean;
  withSales: "max" | "stack";
}

export const LOYALTY_SETTINGS_DEFAULT: LoyaltySettings = {
  on: true,
  mtPerPoint: 1000,
  levels: LOYALTY_LEVELS.map((l) => ({ key: l.key, min: l.min, max: l.max, pct: l.pct })),
  storePoints: true,
  onReservations: true,
  withSales: "max",
};

/** EN: The levels with the points and discounts of the settings. PT: Os níveis com os pontos e descontos definidos. */
export function levelsFrom(s: LoyaltySettings): LoyaltyLevel[] {
  return LOYALTY_LEVELS.map((base) => {
    const x = s.levels.find((l) => l.key === base.key);
    return x ? { ...base, min: x.min, max: x.max, pct: s.on ? x.pct : 0 } : base;
  });
}

export function levelIn(levels: LoyaltyLevel[], points: number): LoyaltyLevel {
  return [...levels].reverse().find((l) => points >= l.min) ?? levels[0];
}
