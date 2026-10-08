import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { site, whatsappLink } from "@/data/site";
import { etaMinutes, STORE_ORIGIN } from "@/lib/delivery";
import { formatMZN } from "@/lib/format";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { fromMaputo, toMaputo, todayMaputo, addDays } from "@/lib/time";
import { audit } from "./audit";
import { getDb } from "./db";
import { deliveryZones, driverLocations, driverPayouts, orderEvents, orderLines, orders, staffUsers } from "./db/schema";
import { AppError } from "./errors";
import { sendMessage } from "./messaging";
import { settlePayment } from "./orders";
import { getSetting } from "./settings";
import type { StaffContext } from "./staff/access";

/**
 * EN: Deliveries (phase 5; design "Entregador · As minhas entregas", "Entrega, GPS e código", "Acompanhar entrega",
 *     "Gestão · 4 Entregas"). States: pending → assigned → in_transit → delivered (no code, waits for the customer)
 *     → confirmed (code given, or the customer confirmed). Cash on delivery is marked paid when the code is accepted.
 * PT: Entregas (fase 5). Estados: pendente → atribuída → em trânsito → entregue (sem código, à espera da cliente)
 *     → confirmada (código certo, ou a cliente confirmou). O pagamento na entrega fica pago quando o código é aceite.
 */

type OrderRow = typeof orders.$inferSelect;
const ACTIVE = ["assigned", "in_transit"] as const;
const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

export const trackingUrl = (o: Pick<OrderRow, "id" | "locale">) => `${site.url}/${o.locale}/order/${o.id}`;

/** EN: Driver commission % (own value or the general one). PT: Comissão do entregador (própria ou geral). */
export async function commissionPctFor(driver: { commissionPct: number | null }) {
  return driver.commissionPct ?? (await getSetting<number>("delivery.commissionPct", 70));
}

export const commissionOf = (fee: number, pct: number) => Math.round((fee * pct) / 100);

async function loadDriver(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, id));
  if (!row) throw new AppError("NOT_FOUND", "Driver not found", 404);
  return row;
}

/** EN: "Cobrar 35 000,00 MT" or "Já pago · M-Pesa". PT: O que o entregador vê sobre o pagamento. */
export function paymentLine(o: OrderRow) {
  const METHOD: Record<string, string> = { card: "cartão", mpesa: "M-Pesa", emola: "e-Mola", mkesh: "mKesh", transfer: "transferência", cod: "dinheiro" };
  if (o.paymentMethod === "cod" && o.paymentStatus === "pending") return { collect: true, text: `Cobrar ${formatMZN(o.total, "pt")}` };
  return { collect: false, text: `Já pago · ${METHOD[o.paymentMethod]}` };
}

// ── Driver app / App do entregador ────────────────────────────────────

export async function driverDashboard(driver: StaffContext) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.driverId, driver.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);
  const today = todayMaputo();
  const start = fromMaputo(today);
  const isDone = (o: OrderRow) => o.fulfillmentStatus === "delivered" || o.fulfillmentStatus === "confirmed";
  const doneToday = rows.filter((o) => isDone(o) && o.deliveredAt && o.deliveredAt >= start);
  const pct = await commissionPctFor(await loadDriver(driver.id));
  const active = rows.filter((o) => (ACTIVE as readonly string[]).includes(o.fulfillmentStatus));
  return {
    pct,
    todayCount: active.length + doneToday.length,
    toDo: active.length,
    earningsToday: doneToday.reduce((n, o) => n + commissionOf(o.shippingFee, pct), 0),
    active: active.sort((a, b) => (a.fulfillmentStatus === "in_transit" ? -1 : 1) - (b.fulfillmentStatus === "in_transit" ? -1 : 1)),
    history: rows.filter(isDone).slice(0, 50),
    weekEarnings: rows
      .filter((o) => isDone(o) && o.deliveredAt && o.deliveredAt >= fromMaputo(addDays(today, -6)))
      .reduce((n, o) => n + commissionOf(o.shippingFee, pct), 0),
    newest: active.find((o) => o.fulfillmentStatus === "assigned") ?? null,
  };
}

export async function driverDelivery(driver: StaffContext, orderId: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.driverId, driver.id)));
  if (!o) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, orderId));
  const pct = await commissionPctFor(await loadDriver(driver.id));
  return { order: o, pieces: lines.reduce((n, l) => n + l.quantity, 0), commission: commissionOf(o.shippingFee, pct) };
}

async function ownActive(driver: StaffContext, orderId: string): Promise<OrderRow> {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.driverId, driver.id)));
  if (!o) throw new AppError("NOT_FOUND", "Delivery not found", 404);
  return o;
}

/** EN: "Iniciar entrega": in transit, expected arrival, message to the customer. PT: Iniciar entrega. */
export async function startDelivery(driver: StaffContext, orderId: string) {
  const o = await ownActive(driver, orderId);
  if (o.fulfillmentStatus !== "assigned") throw new AppError("VALIDATION_ERROR", "Not assigned", 400);
  const db = await getDb();
  const zone = o.deliveryZoneId ? (await db.select().from(deliveryZones).where(eq(deliveryZones.id, o.deliveryZoneId)))[0] : null;
  const eta = new Date(Date.now() + etaMinutes(zone?.eta.pt) * 60_000);
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ fulfillmentStatus: "in_transit", deliveryStartedAt: new Date(), deliveryEtaAt: eta }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, type: "in_transit", actorName: driver.name });
  });
  const me = await loadDriver(driver.id);
  const phone = o.contact.phone ?? o.msisdn;
  const text = [
    `A sua encomenda Eterna ${o.number} saiu para entrega.`,
    `Entregador: ${me.name}${me.phone ? ` · +258 ${formatMsisdn(me.phone)}` : ""}`,
    me.vehicleType ? `Veículo: ${me.vehicleType.toLowerCase()} ${me.vehiclePlate ?? ""}`.trim() : null,
    `Chegada prevista: ${toMaputo(eta).time}`,
    `Código de recepção: ${o.deliveryCode} (dê-o só ao receber)`,
    `Acompanhe: ${trackingUrl(o)}`,
  ]
    .filter(Boolean)
    .join("\n");
  if (phone) await sendMessage("whatsapp", phone, text);
  await audit({ actor: actor(driver), action: "Entrega iniciada", detail: o.number });
}

/**
 * EN: "Confirmar entrega" with the customer's 4-digit code → confirmed (cash on delivery becomes paid).
 *     Without the code ("A cliente não tem o código") → delivered, waiting for the customer to confirm.
 * PT: Com o código de 4 dígitos → confirmada (o pagamento na entrega fica pago). Sem código → entregue, à espera da cliente.
 */
export async function finishDelivery(driver: StaffContext, orderId: string, code: string | null) {
  const o = await ownActive(driver, orderId);
  if (o.fulfillmentStatus !== "in_transit") throw new AppError("VALIDATION_ERROR", "Not in transit", 400);
  const db = await getDb();
  if (code !== null) {
    if (code.trim() !== o.deliveryCode) {
      await audit({ actor: actor(driver), action: "Código de entrega errado", detail: o.number, result: "warning" });
      throw new AppError("VALIDATION_ERROR", "WRONG_CODE", 400);
    }
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({ fulfillmentStatus: "confirmed", deliveredAt: new Date(), deliveryConfirmedAt: new Date(), deliveredWithCode: true })
        .where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values([
        { orderId, type: "delivered", actorName: driver.name },
        { orderId, type: "confirmed", detail: "Código de recepção certo", actorName: driver.name },
      ]);
    });
    if (o.paymentMethod === "cod" && o.paymentStatus === "pending") await settlePayment({ id: orderId }, "paid", "COD_RECEIVED");
    await audit({ actor: actor(driver), action: "Entrega confirmada com código", detail: o.number });
  } else {
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ fulfillmentStatus: "delivered", deliveredAt: new Date(), deliveredWithCode: false }).where(eq(orders.id, orderId));
      await tx.insert(orderEvents).values({ orderId, type: "delivered", detail: "Sem código · a aguardar a cliente", actorName: driver.name });
    });
    const phone = o.contact.phone ?? o.msisdn;
    if (phone) await sendMessage("whatsapp", phone, `Eterna: o entregador marcou a encomenda ${o.number} como entregue. Confirme que recebeu: ${trackingUrl(o)}`);
    await audit({ actor: actor(driver), action: "Entrega registada sem código", detail: o.number, result: "warning" });
  }
}

/** EN: GPS position while in transit (the phone sends it every ~15 s). PT: Posição GPS enquanto em trânsito. */
export async function recordPosition(driver: StaffContext, orderId: string, lat: number, lng: number) {
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new AppError("VALIDATION_ERROR", "Bad position", 400);
  const o = await ownActive(driver, orderId);
  if (o.fulfillmentStatus !== "in_transit") return;
  const db = await getDb();
  await db.insert(driverLocations).values({ driverId: driver.id, orderId, lat, lng });
}

// ── Customer tracking / Acompanhar (cliente) ──────────────────────────

export interface TrackingDTO {
  status: string;
  driver: { name: string; phone: string | null; vehicle: string | null; initials: string } | null;
  position: { lat: number; lng: number; at: string } | null;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number } | null;
  etaAt: string | null;
  startedAt: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  storeWhatsapp: string;
}

export async function trackingFor(order: OrderRow): Promise<TrackingDTO> {
  const db = await getDb();
  const driver = order.driverId ? (await db.select().from(staffUsers).where(eq(staffUsers.id, order.driverId)))[0] : null;
  // EN: Position only while on the way (design). PT: Posição só enquanto está a caminho.
  const [pos] =
    order.fulfillmentStatus === "in_transit"
      ? await db.select().from(driverLocations).where(eq(driverLocations.orderId, order.id)).orderBy(desc(driverLocations.at)).limit(1)
      : [];
  const name = driver?.name.replace(/^\[[^\]]*\]\s*/, "") ?? "";
  return {
    status: order.fulfillmentStatus,
    driver: driver
      ? {
          name,
          phone: driver.phone,
          vehicle: driver.vehicleType ? `${driver.vehicleType}${driver.vehiclePlate ? ` · ${driver.vehiclePlate}` : ""}` : null,
          initials: name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
        }
      : null,
    position: pos ? { lat: pos.lat, lng: pos.lng, at: pos.at.toISOString() } : null,
    origin: STORE_ORIGIN,
    destination: order.deliveryLat != null && order.deliveryLng != null ? { lat: order.deliveryLat, lng: order.deliveryLng } : null,
    etaAt: order.deliveryEtaAt?.toISOString() ?? null,
    startedAt: order.deliveryStartedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    confirmedAt: order.deliveryConfirmedAt?.toISOString() ?? null,
    storeWhatsapp: site.whatsapp,
  };
}

/** EN: "Confirmo que recebi" (customer). PT: A cliente confirma a recepção. */
export async function confirmReceipt(order: OrderRow) {
  if (order.fulfillmentStatus !== "delivered") throw new AppError("VALIDATION_ERROR", "Not delivered", 400);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ fulfillmentStatus: "confirmed", deliveryConfirmedAt: new Date() }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({ orderId: order.id, type: "confirmed", detail: "Confirmada pela cliente", actorName: order.contact.name });
  });
}

// ── Back-office / Gestão · 4 Entregas ─────────────────────────────────

/** EN: WhatsApp message to the driver with everything for the trip. PT: Mensagem ao entregador com tudo. */
export function driverMessage(o: OrderRow, driverPhone: string | null) {
  const pay = paymentLine(o);
  const phone = o.contact.phone ?? o.msisdn;
  const text = [
    `Eterna · entrega ${o.number}`,
    `Cliente: ${o.contact.name}${phone ? ` · +258 ${formatMsisdn(phone)}` : ""}`,
    `Morada: ${[o.deliveryAddress, o.deliveryNeighbourhood, o.deliveryCity].filter(Boolean).join(", ")}`,
    pay.text,
    `Abrir: ${site.url}/gestao/entregador/${o.id}`,
  ].join("\n");
  return driverPhone ? whatsappLink(text, `258${driverPhone}`) : null;
}

/** EN: Latest position of each driver on the way. PT: Última posição de cada entregador a caminho. */
export async function livePositions(orderIds: string[]) {
  if (!orderIds.length) return [];
  const db = await getDb();
  const rows = await db
    .select()
    .from(driverLocations)
    .where(and(inArray(driverLocations.orderId, orderIds), gte(driverLocations.at, new Date(Date.now() - 2 * 3_600_000))))
    .orderBy(desc(driverLocations.at));
  const seen = new Set<string>();
  return rows.filter((r) => r.orderId && !seen.has(r.orderId) && seen.add(r.orderId));
}

export type Period = "week" | "month" | "lastMonth";
export function periodRange(period: Period): { from: Date; to: Date; label: string } {
  const today = todayMaputo();
  if (period === "week") {
    const d = toMaputo(fromMaputo(today, "12:00")).weekday;
    const monday = addDays(today, d === 0 ? -6 : 1 - d);
    return { from: fromMaputo(monday), to: fromMaputo(addDays(monday, 7)), label: "Esta semana" };
  }
  const [y, m] = today.split("-").map(Number);
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}-01`;
  if (period === "month") {
    const next = m === 12 ? first(y + 1, 1) : first(y, m + 1);
    return { from: fromMaputo(first(y, m)), to: fromMaputo(next), label: "Este mês" };
  }
  const prev = m === 1 ? first(y - 1, 12) : first(y, m - 1);
  return { from: fromMaputo(prev), to: fromMaputo(first(y, m)), label: "Mês passado" };
}

/** EN: "Relatório de ganhos" per driver for a period. PT: Relatório de ganhos por entregador. */
export async function earningsReport(period: Period) {
  const db = await getDb();
  const { from, to } = periodRange(period);
  const drivers = await db.select().from(staffUsers);
  const done = await db
    .select()
    .from(orders)
    .where(and(gte(orders.deliveredAt, from), lt(orders.deliveredAt, to), or(eq(orders.fulfillmentStatus, "delivered"), eq(orders.fulfillmentStatus, "confirmed"))));
  const payouts = await db.select().from(driverPayouts).where(and(eq(driverPayouts.periodStart, from), eq(driverPayouts.periodEnd, to)));
  const general = await getSetting<number>("delivery.commissionPct", 70);
  return drivers
    .filter((d) => done.some((o) => o.driverId === d.id))
    .map((d) => {
      const mine = done.filter((o) => o.driverId === d.id);
      const value = mine.reduce((n, o) => n + o.shippingFee, 0);
      const pct = d.commissionPct ?? general;
      const payout = payouts.find((p) => p.driverId === d.id);
      return { id: d.id, name: d.name, count: mine.length, value, pct, amount: commissionOf(value, pct), paid: payout?.status === "paid" };
    });
}

export async function markPayoutPaid(staff: StaffContext, driverId: string, period: Period) {
  const report = await earningsReport(period);
  const row = report.find((r) => r.id === driverId);
  if (!row) throw new AppError("NOT_FOUND", "Nothing to pay", 404);
  const { from, to, label } = periodRange(period);
  const db = await getDb();
  await db.insert(driverPayouts).values({
    driverId,
    periodStart: from,
    periodEnd: to,
    deliveries: row.count,
    deliveryValue: row.value,
    commissionPct: row.pct,
    amount: row.amount,
    status: "paid",
    paidAt: new Date(),
    paidById: staff.id,
  });
  await audit({ actor: actor(staff), action: "Comissão marcada como paga", detail: `${row.name} · ${label} · ${formatMZN(row.amount, "pt")}` });
}

export async function deliveryOrdersToday() {
  const db = await getDb();
  const since = fromMaputo(addDays(todayMaputo(), -2));
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.fulfillmentType, "delivery"), or(gte(orders.createdAt, since), inArray(orders.fulfillmentStatus, ["pending", "assigned", "in_transit", "delivered"]))))
    .orderBy(asc(orders.createdAt));
}
