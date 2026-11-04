import { LOYALTY_LEVELS, type LoyaltyLevel } from "@/data/help";

/**
 * EN: Loyalty programme of design V3: 1 000 MT paid = 1 point; the points of a year set the level (and its discount)
 *     of the next year. The points are counted on the server (src/server/loyalty.ts): online and in the store.
 * PT: Programa de fidelidade do V3: 1 000 MT pagos = 1 ponto; os pontos de um ano definem o nível (e o desconto) do ano
 *     seguinte. Os pontos são contados no servidor (src/server/loyalty.ts): online e na loja.
 */
export const MT_PER_POINT = 1000;
/** EN: Points shown at the end of the progress bar. PT: Pontos no fim da barra de progresso. */
export const BAR_POINTS = 140;

export function levelFor(points: number): LoyaltyLevel {
  return [...LOYALTY_LEVELS].reverse().find((l) => points >= l.min) ?? LOYALTY_LEVELS[0];
}

export interface Loyalty {
  year: number;
  level: LoyaltyLevel; // EN: this year's level. PT: nível deste ano.
  spent: number; // EN: MT paid this year, online and in the store. PT: MT pagos este ano, online e na loja.
  points: number; // EN: points this year. PT: pontos deste ano.
  nextLevel: LoyaltyLevel; // EN: next year's level with today's points. PT: nível do próximo ano com os pontos de hoje.
  upcoming: LoyaltyLevel | null; // EN: the next level up, if any. PT: o nível seguinte, se houver.
  missing: number; // EN: points still missing for it. PT: pontos que faltam.
}

export function loyaltyFrom(year: number, level: LoyaltyLevel, spent: number, points: number): Loyalty {
  const upcoming = LOYALTY_LEVELS.find((l) => l.min > points) ?? null;
  return { year, level, spent, points, nextLevel: levelFor(points), upcoming, missing: upcoming ? upcoming.min - points : 0 };
}
