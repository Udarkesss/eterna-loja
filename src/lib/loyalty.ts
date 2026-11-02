import { LOYALTY_LEVELS, type LoyaltyLevel } from "@/data/help";
import { toMaputo } from "@/lib/time";
import type { MyOrderDTO } from "@/types";

/**
 * EN: Loyalty programme of design V3: 1 000 MT paid = 1 point; the points of a year set the level (and its discount)
 *     of the next year. Online orders only for now: paid, not cancelled.
 * PT: Programa de fidelidade do V3: 1 000 MT pagos = 1 ponto; os pontos de um ano definem o nível (e o desconto) do ano
 *     seguinte. Por agora só as encomendas online: pagas e não canceladas.
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
  spent: number; // EN: MT paid this year. PT: MT pagos este ano.
  points: number; // EN: points this year. PT: pontos deste ano.
  nextLevel: LoyaltyLevel; // EN: next year's level with today's points. PT: nível do próximo ano com os pontos de hoje.
  upcoming: LoyaltyLevel | null; // EN: the next level up, if any. PT: o nível seguinte, se houver.
  missing: number; // EN: points still missing for it. PT: pontos que faltam.
}

export function loyaltyOf(orders: Pick<MyOrderDTO, "createdAt" | "total" | "paymentStatus" | "fulfillmentStatus">[], now = new Date()): Loyalty {
  const yearOf = (d: Date | string) => Number(toMaputo(d).date.slice(0, 4));
  const year = yearOf(now);
  const paidIn = (y: number) =>
    orders.filter((o) => o.paymentStatus === "paid" && o.fulfillmentStatus !== "cancelled" && yearOf(o.createdAt) === y).reduce((sum, o) => sum + o.total, 0);
  const spent = paidIn(year);
  const points = Math.floor(spent / MT_PER_POINT);
  const upcoming = LOYALTY_LEVELS.find((l) => l.min > points) ?? null;
  return {
    year,
    level: levelFor(Math.floor(paidIn(year - 1) / MT_PER_POINT)),
    spent,
    points,
    nextLevel: levelFor(points),
    upcoming,
    missing: upcoming ? upcoming.min - points : 0,
  };
}
