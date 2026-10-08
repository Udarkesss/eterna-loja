import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { maskMsisdn } from "@/lib/payments/msisdn";
import type { MyOrderDTO, OrderStatusDTO, PaymentStatus } from "@/types";
import { getDb } from "./db";
import { orderEvents, orderLines, orders, productVariants, settings } from "./db/schema";
import { AppError } from "./errors";

/**
 * EN: Order storage with stock reservation. The piece is reserved while the payment is pending
 *     and given back if it fails or expires — in transactions, so two customers never buy the last piece.
 * PT: Armazenamento de encomendas com reserva de stock. A peça fica reservada enquanto o pagamento está
 *     pendente e volta ao stock se falhar ou expirar — em transacções, para duas clientes não comprarem a última peça.
 */

export type NewOrder = typeof orders.$inferInsert;
export type NewOrderLine = Omit<typeof orderLines.$inferInsert, "orderId">;
type OrderRow = typeof orders.$inferSelect;

/** EN: "ET-2026-0148": yearly counter kept in `settings`. PT: Contador anual guardado em `settings`. */
async function nextOrderNumber(): Promise<string> {
  const db = await getDb();
  const year = new Date().getFullYear();
  const key = `orders.sequence.${year}`;
  const [row] = await db
    .insert(settings)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`to_jsonb((${settings.value})::text::int + 1)` } })
    .returning({ value: settings.value });
  return `ET-${year}-${String(row.value).padStart(4, "0")}`;
}

/** EN: 4-digit code the customer gives the driver. PT: Código de 4 dígitos que a cliente dá ao entregador. */
export function newDeliveryCode(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export async function createOrderWithReservation(
  order: Omit<NewOrder, "number">,
  lines: NewOrderLine[],
  events: string[],
): Promise<OrderRow> {
  const db = await getDb();
  const number = await nextOrderNumber();

  return db.transaction(async (tx) => {
    for (const line of lines) {
      if (!line.variantId) throw new AppError("VALIDATION_ERROR", "Missing variant", 400);
      const reserved = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
        .where(and(eq(productVariants.id, line.variantId), gte(productVariants.stock, line.quantity)))
        .returning({ id: productVariants.id });
      if (!reserved.length) {
        throw new AppError("OUT_OF_STOCK", `Not enough stock for ${line.code}`, 409, { slug: line.slug, variantId: line.variantId });
      }
    }
    const [created] = await tx.insert(orders).values({ ...order, number }).returning();
    await tx.insert(orderLines).values(lines.map((l) => ({ ...l, orderId: created.id })));
    if (events.length) await tx.insert(orderEvents).values(events.map((type) => ({ orderId: created.id, type })));
    return created;
  });
}

export async function findOrder(id: string): Promise<OrderRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null; // EN: avoid invalid-UUID errors. PT: evitar erros de UUID inválido.
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row ?? null;
}

export async function updateOrder(id: string, changes: Partial<NewOrder>, event?: { type: string; detail?: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(orders).set(changes).where(eq(orders.id, id));
    if (event) await tx.insert(orderEvents).values({ orderId: id, ...event });
  });
}

/**
 * EN: Moves a pending payment to paid / failed / expired exactly once. On failed or expired the reserved
 *     stock goes back. Returns the updated order, or null if it was no longer pending.
 * PT: Passa um pagamento pendente a pago / recusado / expirado uma única vez. Em recusado ou expirado o stock
 *     volta. Devolve a encomenda actualizada, ou null se já não estava pendente.
 */
export async function settlePayment(
  where: { id: string } | { reference: string },
  status: Exclude<PaymentStatus, "pending" | "refunded">,
  responseCode?: string,
): Promise<OrderRow | null> {
  const db = await getDb();
  const match = "id" in where ? eq(orders.id, where.id) : eq(orders.paymentReference, where.reference);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ paymentStatus: status, ...(responseCode ? { paymentResponseCode: responseCode } : {}) })
      .where(and(match, eq(orders.paymentStatus, "pending")))
      .returning();
    if (!updated) return null;

    if (status !== "paid") {
      const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, updated.id));
      for (const line of lines) {
        if (!line.variantId) continue;
        await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${line.quantity}` })
          .where(eq(productVariants.id, line.variantId));
      }
      if (updated.fulfillmentStatus === "pending") {
        await tx.update(orders).set({ fulfillmentStatus: "cancelled" }).where(eq(orders.id, updated.id));
      }
    }
    await tx.insert(orderEvents).values({ orderId: updated.id, type: `payment_${status}`, detail: responseCode });
    return updated;
  });
}

export async function orderLinesOf(orderIds: string[]) {
  const db = await getDb();
  return orderIds.length ? db.select().from(orderLines).where(inArray(orderLines.orderId, orderIds)) : [];
}

export async function toOrderStatusDTO(order: OrderRow): Promise<OrderStatusDTO> {
  const db = await getDb();
  const store = order.pickupStoreId
    ? await db.query.stores.findFirst({ where: (s, { eq: e }) => e(s.id, order.pickupStoreId!) })
    : null;
  return {
    id: order.id,
    number: order.number,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    msisdnMasked: order.msisdn ? maskMsisdn(order.msisdn) : null,
    paymentExpiresAt: order.paymentExpiresAt?.toISOString() ?? null,
    fulfillmentType: order.fulfillmentType,
    fulfillmentStatus: order.fulfillmentStatus,
    pickupStore: store ? { code: store.code, name: store.name } : null,
  };
}

/** EN: "As minhas encomendas" (newest first). PT: As minhas encomendas (mais recentes primeiro). */
export async function listCustomerOrders(customerId: string): Promise<MyOrderDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  const lines = await orderLinesOf(rows.map((r) => r.id));
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    createdAt: o.createdAt.toISOString(),
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    fulfillmentType: o.fulfillmentType,
    fulfillmentStatus: o.fulfillmentStatus,
    items: lines.filter((l) => l.orderId === o.id).map((l) => ({ code: l.code, size: l.size, imageUrl: l.imageUrl })),
  }));
}
