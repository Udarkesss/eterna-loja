import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { LOYALTY_LEVELS, type LoyaltyLevel } from "@/data/help";
import { levelFor, loyaltyFrom, MT_PER_POINT, type Loyalty } from "@/lib/loyalty";
import { toMaputo } from "@/lib/time";
import { getDb } from "./db";
import { customers, loyaltyEntries, orders } from "./db/schema";

/**
 * EN: Loyalty programme of design V3 (Gestão · Clientes and the account page). 1 000 MT paid = 1 point; the points of
 *     a year set the level (and its discount) of the next year. Points come from paid, not cancelled online orders and
 *     from `loyalty_entries`: purchases in the store, hand adjustments and the points imported from the old store.
 *     A level set by hand for a year (with a reason) wins over the points.
 * PT: Programa de fidelidade do V3. 1 000 MT pagos = 1 ponto; os pontos de um ano definem o nível (e o desconto) do ano
 *     seguinte. Os pontos vêm das encomendas online pagas e não canceladas e de `loyalty_entries`: compras na loja,
 *     ajustes à mão e pontos importados da loja antiga. Um nível definido à mão para um ano (com motivo) prevalece.
 */

export interface YearPoints {
  onlineSpent: number; // EN: MT paid online. PT: MT pagos online.
  storeSpent: number; // EN: MT of store purchases. PT: MT das compras na loja.
  online: number; // EN: points from online orders. PT: pontos das encomendas online.
  store: number; // EN: points from store purchases. PT: pontos das compras na loja.
  other: number; // EN: adjustments and imported points. PT: ajustes e pontos importados.
  points: number; // EN: total. PT: total.
}

const empty = (): YearPoints => ({ onlineSpent: 0, storeSpent: 0, online: 0, store: 0, other: 0, points: 0 });
const yearOf = (d: Date) => Number(toMaputo(d).date.slice(0, 4));
export const currentYear = (now = new Date()) => yearOf(now);

/** EN: Points per customer and year. PT: Pontos por cliente e por ano. */
export async function loyaltyYears(customerIds: string[]): Promise<Map<string, Map<number, YearPoints>>> {
  const out = new Map<string, Map<number, YearPoints>>();
  if (customerIds.length === 0) return out;
  const db = await getDb();
  const [orderRows, entryRows] = await Promise.all([
    db
      .select({ customerId: orders.customerId, total: orders.total, createdAt: orders.createdAt })
      .from(orders)
      .where(and(inArray(orders.customerId, customerIds), eq(orders.paymentStatus, "paid"), ne(orders.fulfillmentStatus, "cancelled"), eq(orders.kind, "purchase"))),
    db.select().from(loyaltyEntries).where(inArray(loyaltyEntries.customerId, customerIds)),
  ]);
  const slot = (id: string, year: number) => {
    const years = out.get(id) ?? new Map<number, YearPoints>();
    out.set(id, years);
    const y = years.get(year) ?? empty();
    years.set(year, y);
    return y;
  };
  for (const o of orderRows) if (o.customerId) slot(o.customerId, yearOf(o.createdAt)).onlineSpent += o.total;
  for (const e of entryRows) {
    const y = slot(e.customerId, e.year);
    if (e.kind === "store") {
      y.store += e.points;
      y.storeSpent += e.amount ?? 0;
    } else y.other += e.points;
  }
  for (const years of out.values())
    for (const y of years.values()) {
      y.online = Math.floor(y.onlineSpent / MT_PER_POINT);
      y.points = Math.max(0, y.online + y.store + y.other);
    }
  return out;
}

type LevelSource = { levelOverride: string | null; levelOverrideYear: number | null };

/** EN: The level of a year: set by hand, else from last year's points. PT: O nível de um ano: à mão, ou pelos pontos do ano anterior. */
export function levelInYear(c: LevelSource, years: Map<number, YearPoints> | undefined, year: number): LoyaltyLevel {
  if (c.levelOverrideYear === year) {
    const set = LOYALTY_LEVELS.find((l) => l.key === c.levelOverride);
    if (set) return set;
  }
  return levelFor(years?.get(year - 1)?.points ?? 0);
}

/** EN: The account page's "O meu nível". PT: "O meu nível" da página da conta. */
export async function customerLoyalty(customerId: string, now = new Date()): Promise<Loyalty> {
  const db = await getDb();
  const [row] = await db
    .select({ levelOverride: customers.levelOverride, levelOverrideYear: customers.levelOverrideYear })
    .from(customers)
    .where(eq(customers.id, customerId));
  const years = (await loyaltyYears([customerId])).get(customerId);
  const year = currentYear(now);
  const y = years?.get(year) ?? empty();
  return loyaltyFrom(year, levelInYear(row ?? { levelOverride: null, levelOverrideYear: null }, years, year), y.onlineSpent + y.storeSpent, y.points);
}

/** EN: This year's level; the checkout applies its discount. PT: O nível deste ano; o checkout aplica o desconto. */
export async function customerLevel(customerId: string, now = new Date()): Promise<LoyaltyLevel> {
  return (await customerLoyalty(customerId, now)).level;
}
