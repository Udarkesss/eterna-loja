import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { maskMsisdn } from "@/lib/payments/msisdn";
import { fromMaputo } from "@/lib/time";
import type { FulfillmentStatus, PaymentMethod, PaymentStatus } from "@/types";
import { audit } from "../audit";
import { getOrderStatus } from "../checkout";
import { getDb } from "../db";
import { customers, orderEvents, orderLines, orders, products, refunds, staffUsers, stores } from "../db/schema";
import { AppError } from "../errors";
import { orderLinesOf, settlePayment, updateOrder } from "../orders";
import { accessOf, assertStoreAllowed, storeScope, type StaffContext } from "../staff/access";

/**
 * EN: Orders in the back-office (design "Gestão · 2 Encomendas por cliente" and "3 Detalhe da encomenda").
 *     An order belongs to the pickup store, or to the store of its first piece for home delivery;
 *     staff with "L" access only see their stores' orders.
 * PT: Encomendas na gestão. Uma encomenda pertence à loja de levantamento, ou à loja da primeira peça na entrega
 *     ao domicílio; quem tem acesso "L" só vê as encomendas das suas lojas.
 */

export type OrderRow = typeof orders.$inferSelect;
export type LineRow = typeof orderLines.$inferSelect;

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: "Cartão",
  mpesa: "M-Pesa",
  emola: "e-Mola",
  mkesh: "mKesh",
  transfer: "Transferência",
  cod: "Dinheiro",
};

export const PAYMENT_LABEL: Record<PaymentStatus, { label: string; tone: "ok" | "warn" | "bad" | "" }> = {
  pending: { label: "Pendente", tone: "warn" },
  paid: { label: "Paga", tone: "ok" },
  failed: { label: "Recusada", tone: "bad" },
  expired: { label: "Expirada", tone: "" },
  refunded: { label: "Reembolsada", tone: "" },
};

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  pending: "Por preparar",
  ready: "Pronta",
  collected: "Levantada",
  assigned: "Entregador atribuído",
  in_transit: "Em trânsito",
  delivered: "Entregue",
  confirmed: "Recepção confirmada",
  cancelled: "Cancelada",
};

const EVENT_LABEL: Record<string, string> = {
  created: "Encomenda criada",
  payment_requested: "Pedido de pagamento enviado",
  payment_paid: "Pagamento confirmado",
  payment_failed: "Pagamento recusado",
  payment_expired: "Pagamento expirado",
  payment_refunded: "Reembolso registado",
  transfer_proof: "Comprovativo de transferência recebido",
  transfer_approved: "Comprovativo validado",
  transfer_rejected: "Comprovativo recusado",
  ready: "Pronta para levantamento",
  collected: "Levantada pela cliente",
  assigned: "Entregador atribuído",
  in_transit: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Encomenda cancelada",
  refund_requested: "Devolução pedida (a aguardar aprovação)",
  refund_approved: "Devolução aprovada",
  note: "Nota interna actualizada",
};

export const eventLabel = (type: string) => EVENT_LABEL[type] ?? type;

export function orderStoreId(order: OrderRow, lines: LineRow[]): string | null {
  return order.pickupStoreId ?? lines.find((l) => l.orderId === order.id)?.storeId ?? null;
}

const actor = (staff: StaffContext) => ({ type: "staff" as const, id: staff.id, name: staff.name, role: staff.roleName });

export interface OrderListFilter {
  q?: string;
  status?: PaymentStatus | "all";
  from?: string; // YYYY-MM-DD
  to?: string;
  customerKey?: string;
  limit?: number;
}

/** EN: Orders the person may see, newest first, with their lines. PT: Encomendas visíveis, mais recentes primeiro. */
export async function listOrdersFor(staff: StaffContext, filter: OrderListFilter = {}) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        filter.status && filter.status !== "all" ? eq(orders.paymentStatus, filter.status) : undefined,
        filter.from ? gte(orders.createdAt, fromMaputo(filter.from)) : undefined,
        filter.to ? lt(orders.createdAt, new Date(fromMaputo(filter.to).getTime() + 86_400_000)) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1000);
  const lines = await orderLinesOf(rows.map((r) => r.id));
  const scope = storeScope(staff, "orders.view");
  const q = (filter.q ?? "").toLowerCase().replace(/\s/g, "");
  return rows
    .filter((o) => !scope || scope.includes(orderStoreId(o, lines) ?? ""))
    .filter((o) => {
      if (!q) return true;
      const hay = [o.number, o.contact.name, o.contact.phone ?? "", o.contact.email ?? "", o.msisdn ?? ""].join("").toLowerCase().replace(/\s/g, "");
      return hay.includes(q);
    })
    .filter((o) => !filter.customerKey || customerKeyOf(o) === filter.customerKey)
    .slice(0, filter.limit ?? 1000)
    .map((o) => ({ order: o, lines: lines.filter((l) => l.orderId === o.id) }));
}

/** EN: Groups guest and account orders of the same person. PT: Junta encomendas da mesma pessoa. */
export function customerKeyOf(o: OrderRow): string {
  if (o.customerId) return `c:${o.customerId}`;
  const phone = o.contact.phone ?? o.msisdn;
  if (phone) return `p:${phone}`;
  if (o.contact.email) return `e:${o.contact.email.toLowerCase()}`;
  return `n:${o.contact.name.toLowerCase()}`;
}

export async function getOrderDetail(staff: StaffContext, id: string) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  assertStoreAllowed(staff, "orders.view", orderStoreId(order, lines));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(asc(orderEvents.at));
  const store = order.pickupStoreId ? (await db.select().from(stores).where(eq(stores.id, order.pickupStoreId)))[0] : null;
  const lineStoreIds = [...new Set(lines.map((l) => l.storeId).filter((s): s is string => !!s))];
  const lineStores = lineStoreIds.length ? await db.select().from(stores).where(inArray(stores.id, lineStoreIds)) : [];
  const orderRefunds = await db.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(desc(refunds.createdAt));
  const driver = order.driverId ? (await db.select().from(staffUsers).where(eq(staffUsers.id, order.driverId)))[0] : null;
  const account = order.customerId ? (await db.select().from(customers).where(eq(customers.id, order.customerId)))[0] : null;
  // EN: Colour keys → names ("off_white" → "Off-white"). PT: Chaves de cor → nomes.
  const productIds = [...new Set(lines.map((l) => l.productId).filter((p): p is string => !!p))];
  const productRows = productIds.length ? await db.select({ id: products.id, colors: products.colors }).from(products).where(inArray(products.id, productIds)) : [];
  const colorName = (l: LineRow) => productRows.find((p) => p.id === l.productId)?.colors.find((c) => c.key === l.color)?.name.pt ?? l.color;
  const key = customerKeyOf(order);
  const history = (await listOrdersFor(staff)).filter((r) => customerKeyOf(r.order) === key);
  return {
    order,
    lines: lines.map((l) => ({ ...l, color: colorName(l) })),
    events,
    store,
    lineStores,
    refunds: orderRefunds,
    driver,
    account,
    customerOrderCount: history.length,
    customerIndex: history.length - history.findIndex((r) => r.order.id === id),
    msisdnMasked: order.msisdn ? maskMsisdn(order.msisdn) : null,
  };
}

// ── Actions / Acções ──────────────────────────────────────────────────

async function loadForEdit(staff: StaffContext, id: string, area = "orders.edit") {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new AppError("NOT_FOUND", "Order not found", 404);
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
  assertStoreAllowed(staff, area, orderStoreId(order, lines));
  return order;
}

/** EN: "Marcar como pronta" / "Confirmar levantamento" / delivery steps. PT: Próximo passo da encomenda. */
export async function setFulfillment(staff: StaffContext, id: string, status: FulfillmentStatus) {
  const order = await loadForEdit(staff, id);
  if (order.paymentStatus !== "paid" && !(order.paymentMethod === "cod" && order.paymentStatus === "pending")) {
    throw new AppError("VALIDATION_ERROR", "Payment not confirmed", 400);
  }
  await updateOrder(id, { fulfillmentStatus: status }, { type: status, detail: undefined });
  await audit({ actor: actor(staff), action: `Encomenda: ${FULFILLMENT_LABEL[status].toLowerCase()}`, detail: order.number });
  // TODO (fase 6): SMS à cliente ("Pronta para levantamento").
}

/** EN: Transfer proof: approve (paid) or reject (stock back). PT: Validar ou recusar o comprovativo. */
export async function reviewTransfer(staff: StaffContext, id: string, approve: boolean) {
  const order = await loadForEdit(staff, id, "transfers.validate");
  if (accessOf(staff, "transfers.validate") === "—") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  if (order.paymentMethod !== "transfer" || order.paymentStatus !== "pending") throw new AppError("VALIDATION_ERROR", "Not a pending transfer", 400);
  await settlePayment({ id }, approve ? "paid" : "failed", approve ? "TRANSFER_OK" : "TRANSFER_REJECTED");
  const db = await getDb();
  await db.insert(orderEvents).values({ orderId: id, type: approve ? "transfer_approved" : "transfer_rejected", actorName: staff.name });
  await audit({ actor: actor(staff), action: approve ? "Comprovativo validado" : "Comprovativo recusado", detail: order.number });
}

/** EN: Cash on delivery received. PT: Dinheiro recebido na entrega. */
export async function confirmCashReceived(staff: StaffContext, id: string) {
  const order = await loadForEdit(staff, id);
  if (order.paymentMethod !== "cod" || order.paymentStatus !== "pending") throw new AppError("VALIDATION_ERROR", "Not a pending COD", 400);
  await settlePayment({ id }, "paid", "COD_RECEIVED");
  await audit({ actor: actor(staff), action: "Pagamento na entrega recebido", detail: order.number });
}

/** EN: "Verificar estado na operadora". PT: Pergunta à operadora e actualiza. */
export async function checkWithOperator(staff: StaffContext, id: string) {
  const order = await loadForEdit(staff, id, "orders.view");
  const status = await getOrderStatus(id);
  await audit({ actor: actor(staff), action: "Estado verificado na operadora", detail: `${order.number} · ${status?.paymentStatus}` });
  return status;
}

export async function cancelOrder(staff: StaffContext, id: string) {
  if (accessOf(staff, "orders.cancel") === "—") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const order = await loadForEdit(staff, id, "orders.cancel");
  if (order.paymentStatus === "paid") throw new AppError("VALIDATION_ERROR", "Paid: register a refund instead", 400);
  if (order.paymentStatus === "pending") await settlePayment({ id }, "failed", "CANCELLED_BY_STAFF");
  await updateOrder(id, { fulfillmentStatus: "cancelled" }, { type: "cancelled" });
  await audit({ actor: actor(staff), action: "Encomenda cancelada", detail: order.number });
}

/**
 * EN: "Registar devolução". Access T → approved at once; Pd (store manager) → waits for an administrator.
 * PT: Acesso T → aprovada logo; Pd (gestora) → fica à espera de um administrador.
 */
export async function registerRefund(staff: StaffContext, id: string, amount: number, reason: string) {
  const access = accessOf(staff, "refunds");
  if (access === "—") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const order = await loadForEdit(staff, id, "refunds");
  if (order.paymentStatus !== "paid") throw new AppError("VALIDATION_ERROR", "Only paid orders", 400);
  if (!(amount > 0 && amount <= order.total)) throw new AppError("VALIDATION_ERROR", "Invalid amount", 400);
  const db = await getDb();
  const approved = access === "T";
  await db.insert(refunds).values({
    orderId: id,
    amount,
    reason,
    status: approved ? "approved" : "requested",
    requestedById: staff.id,
    approvedById: approved ? staff.id : null,
  });
  if (approved && amount === order.total) {
    await db.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, id));
  }
  await db.insert(orderEvents).values({ orderId: id, type: approved ? "refund_approved" : "refund_requested", detail: `${amount} MT`, actorName: staff.name });
  await audit({ actor: actor(staff), action: approved ? "Reembolso aprovado" : "Reembolso pedido", detail: `${order.number} · ${amount} MT` });
}

export async function approveRefund(staff: StaffContext, refundId: string) {
  if (accessOf(staff, "refunds") !== "T") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const db = await getDb();
  const [refund] = await db.update(refunds).set({ status: "approved", approvedById: staff.id }).where(eq(refunds.id, refundId)).returning();
  if (!refund) throw new AppError("NOT_FOUND", "Refund not found", 404);
  const [order] = await db.select().from(orders).where(eq(orders.id, refund.orderId));
  if (refund.amount === order.total) await db.update(orders).set({ paymentStatus: "refunded" }).where(eq(orders.id, order.id));
  await db.insert(orderEvents).values({ orderId: order.id, type: "refund_approved", detail: `${refund.amount} MT`, actorName: staff.name });
  await audit({ actor: actor(staff), action: "Reembolso aprovado", detail: `${order.number} · ${refund.amount} MT` });
}

export async function saveInternalNotes(staff: StaffContext, id: string, notes: string) {
  await loadForEdit(staff, id);
  const db = await getDb();
  await db.update(orders).set({ internalNotes: notes.slice(0, 2000) }).where(eq(orders.id, id));
}

export async function assignDriver(staff: StaffContext, id: string, driverId: string | null) {
  if (accessOf(staff, "deliveries.assign") === "—") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
  const order = await loadForEdit(staff, id, "deliveries.assign");
  if (order.fulfillmentType !== "delivery") throw new AppError("VALIDATION_ERROR", "Not a delivery", 400);
  const db = await getDb();
  const driver = driverId ? (await db.select().from(staffUsers).where(eq(staffUsers.id, driverId)))[0] : null;
  await updateOrder(
    id,
    { driverId: driver?.id ?? null, fulfillmentStatus: driver ? "assigned" : "pending" },
    { type: "assigned", detail: driver?.name ?? "—" },
  );
  await audit({ actor: actor(staff), action: "Entregador atribuído", detail: `${order.number} → ${driver?.name ?? "—"}` });
}
