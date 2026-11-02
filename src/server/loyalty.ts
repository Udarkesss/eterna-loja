import "server-only";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import type { LoyaltyLevel } from "@/data/help";
import { levelFor, MT_PER_POINT } from "@/lib/loyalty";
import { fromMaputo, toMaputo } from "@/lib/time";
import { getDb } from "./db";
import { orders } from "./db/schema";

/**
 * EN: The customer's loyalty level this year: points (1 000 MT paid = 1) of last year's paid, not cancelled orders.
 *     The same rule as the account page (src/lib/loyalty.ts); the checkout applies its discount.
 * PT: O nível de fidelidade da cliente este ano: pontos (1 000 MT pagos = 1) das encomendas pagas e não canceladas do
 *     ano anterior. A mesma regra da página da conta; o checkout aplica o desconto.
 */
export async function customerLevel(customerId: string, now = new Date()): Promise<LoyaltyLevel> {
  const year = Number(toMaputo(now).date.slice(0, 4));
  const db = await getDb();
  const [row] = await db
    .select({ paid: sql<number>`coalesce(sum(${orders.total}), 0)` })
    .from(orders)
    .where(
      and(
        eq(orders.customerId, customerId),
        eq(orders.paymentStatus, "paid"),
        ne(orders.fulfillmentStatus, "cancelled"),
        gte(orders.createdAt, fromMaputo(`${year - 1}-01-01`)),
        lt(orders.createdAt, fromMaputo(`${year}-01-01`)),
      ),
    );
  return levelFor(Math.floor(Number(row?.paid ?? 0) / MT_PER_POINT));
}
