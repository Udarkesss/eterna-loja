import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { LoyaltyLevel } from "@/data/help";
import { whatsappLink } from "@/data/site";
import { formatMZN } from "@/lib/format";
import { addDays, fromMaputo, toMaputo, todayMaputo } from "@/lib/time";
import type { ReservationDTO } from "@/types";
import { audit } from "./audit";
import { getDb } from "./db";
import { loyaltyEntries, orders, productVariants, reservations, settings, stores } from "./db/schema";
import { AppError } from "./errors";
import { currentYear } from "./loyalty";
import { sendMessage } from "./messaging";
import { getSetting } from "./settings";

/**
 * EN: Reservations of design V3 (V3-Checkout-Reserva, V3-Confirmacao, V3-Conta "As minhas reservas", V3-G-Reservas,
 *     V3-G-Definicoes "Reservas"). A 50% deposit keeps the piece in the customer's name for 30 days (60 for wedding
 *     dresses and Eterna Bridal pieces, i.e. Loja 22). When the time ends the reservation is cancelled by itself, the
 *     piece goes back on sale and the deposit is not refunded. Points count when the piece is fully paid.
 * PT: Reservas do V3. Um sinal de 50% guarda a peça em nome da cliente 30 dias (60 nos vestidos de noiva e peças da
 *     Eterna Bridal, ou seja a Loja 22). No fim do prazo a reserva cancela-se sozinha, a peça volta à venda e o sinal não
 *     é reembolsável. Os pontos contam quando a peça estiver paga por inteiro.
 */

export interface ReservationSettings {
  depositPct: number;
  days: number;
  bridalDays: number;
  remindDays: number;
  extendDays: number;
  bridalExtendDays: number;
  maxExtensions: number;
  allowExtend: boolean;
  askMoreTime: boolean;
  showReserved: boolean;
  notifyStaff: boolean;
  message: string;
}

export const RESERVATIONS_DEFAULT: ReservationSettings = {
  depositPct: 50,
  days: 30,
  bridalDays: 60,
  remindDays: 5,
  extendDays: 15,
  bridalExtendDays: 30,
  maxExtensions: 1,
  allowExtend: true,
  askMoreTime: true,
  showReserved: true,
  notifyStaff: true,
  message: "Olá {nome}, a sua reserva da peça {código} termina a {data}. Pode levantar na {loja} até lá. Precisa de mais tempo? Responda a esta mensagem.",
};

export const reservationSettings = () => getSetting<ReservationSettings>("reservations", RESERVATIONS_DEFAULT);

/** EN: Bridal pieces live in Loja 22. PT: As peças da Bridal estão na Loja 22. */
export const isBridalStore = (code: string | null | undefined) => code === "22";

export type ReservationRow = typeof reservations.$inferSelect;

/**
 * EN: The amounts of a reservation: the level discount applies to pieces not on sale (the larger discount wins).
 * PT: Os valores de uma reserva: o desconto de nível aplica-se a peças fora de saldo (aplica-se o maior desconto).
 */
export function reservationAmounts(piece: { price: number; salePrice: number | null }, level: LoyaltyLevel | null, s: ReservationSettings) {
  const base = piece.salePrice ?? piece.price;
  const discount = piece.salePrice == null && level ? Math.round((piece.price * level.pct) / 100) : 0;
  const total = base - discount;
  const deposit = Math.round((total * s.depositPct) / 100);
  return { price: base, discount, total, deposit, rest: total - deposit };
}

export async function nextReservationNumber(): Promise<string> {
  const db = await getDb();
  const year = currentYear();
  const key = `reservations.sequence.${year}`;
  const [row] = await db
    .insert(settings)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: settings.key, set: { value: sql`to_jsonb((${settings.value})::text::int + 1)` } })
    .returning({ value: settings.value });
  return `RS-${year}-${String(row.value).padStart(4, "0")}`;
}

/** EN: End of the last day, Maputo time. PT: Fim do último dia, hora de Maputo. */
export const endOfDayIn = (days: number, from = todayMaputo()) => new Date(fromMaputo(addDays(from, days), "23:59").getTime() + 59_000);

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const longDate = (d: Date) => {
  const [y, m, dd] = toMaputo(d).date.split("-");
  return `${Number(dd)} de ${MONTHS[Number(m) - 1]} de ${y}`;
};
const firstName = (n: string) => n.replace(/\[[^\]]*\]\s*/g, "").split(" ")[0];

/** EN: The reminder text (Gestão → Definições → Reservas). PT: O texto do aviso. */
export function reminderText(r: ReservationRow, storeName: string, s: ReservationSettings) {
  return s.message
    .replace(/\{nome\}/g, firstName(r.contact.name))
    .replace(/\{c[oó]digo\}/g, r.code)
    .replace(/\{data\}/g, r.expiresAt ? longDate(r.expiresAt) : "")
    .replace(/\{loja\}/g, storeName);
}

async function restock(variantId: string | null) {
  if (!variantId) return;
  const db = await getDb();
  await db
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} + 1` })
    .where(eq(productVariants.id, variantId));
}

let lastSync = 0;

/**
 * EN: Moves reservations along (no scheduler needed; runs when someone opens a page that shows them, at most every
 *     20 s): paid deposit → active; failed deposit → cancelled; time over → expired (piece back on sale); WhatsApp
 *     reminder N days before the end.
 * PT: Faz as reservas avançar (sem agendador; corre quando alguém abre uma página que as mostra, no máximo de 20 em
 *     20 s): sinal pago → activa; sinal falhado → cancelada; prazo terminado → expirada (peça volta à venda); aviso por
 *     WhatsApp N dias antes do fim.
 */
export async function syncReservations(force = false) {
  if (!force && Date.now() - lastSync < 20_000) return;
  lastSync = Date.now();
  const db = await getDb();
  const s = await reservationSettings();
  const now = new Date();

  const pending = await db
    .select({ r: reservations, payment: orders.paymentStatus, fulfillment: orders.fulfillmentStatus })
    .from(reservations)
    .innerJoin(orders, eq(orders.id, reservations.orderId))
    .where(eq(reservations.status, "pending"));
  for (const { r, payment, fulfillment } of pending) {
    if (payment === "paid") {
      await db
        .update(reservations)
        .set({ status: "active", startsAt: now, expiresAt: endOfDayIn(r.days), updatedAt: now })
        .where(and(eq(reservations.id, r.id), eq(reservations.status, "pending")));
      if (s.notifyStaff) await notifyStaffNew(r);
    } else if (payment === "failed" || payment === "expired" || payment === "refunded" || fulfillment === "cancelled") {
      // EN: The stock was already given back by the order. PT: O stock já foi devolvido pela encomenda.
      await db.update(reservations).set({ status: "cancelled", cancelledAt: now, updatedAt: now }).where(and(eq(reservations.id, r.id), eq(reservations.status, "pending")));
    }
  }

  const over = await db
    .update(reservations)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(reservations.status, "active"), lt(reservations.expiresAt, now)))
    .returning();
  for (const r of over) {
    await restock(r.variantId);
    await audit({ actor: { type: "system", name: "Sistema" }, action: "Reserva expirada", detail: `${r.number} · ${r.code} · peça voltou à venda · sinal retido` });
  }

  const remindBefore = new Date(now.getTime() + s.remindDays * 86_400_000);
  const due = await db
    .select({ r: reservations, storeName: stores.name, storeCode: stores.code })
    .from(reservations)
    .leftJoin(stores, eq(stores.id, reservations.storeId))
    .where(and(eq(reservations.status, "active"), lt(reservations.expiresAt, remindBefore), isNull(reservations.remindedAt)));
  for (const { r, storeCode } of due) {
    if (r.contact.phone) await sendMessage("whatsapp", `+258${r.contact.phone}`, reminderText(r, `Loja ${Number(storeCode ?? "2")} do Glória Mall`, s));
    await db.update(reservations).set({ remindedAt: now }).where(eq(reservations.id, r.id));
  }
}

async function notifyStaffNew(r: ReservationRow) {
  const db = await getDb();
  const [store] = r.storeId ? await db.select().from(stores).where(eq(stores.id, r.storeId)) : [];
  if (!store?.phone) return;
  await sendMessage("whatsapp", store.phone, `Nova reserva ${r.number}: ${r.code}${r.size ? ` · ${r.size}` : ""} para ${r.contact.name}. Sinal ${formatMZN(r.deposit, "pt")} pago.`);
}

// ── Customer side / Lado da cliente ─────────────────────────────────────

export function toReservationDTO(r: ReservationRow, storeCode: string | null, s: ReservationSettings): ReservationDTO {
  const now = Date.now();
  const daysLeft = r.expiresAt ? Math.max(0, Math.ceil((r.expiresAt.getTime() - now) / 86_400_000)) : r.days;
  return {
    number: r.number,
    token: r.token,
    code: r.code,
    name: r.name,
    color: r.color,
    size: r.size,
    imageUrl: r.imageUrl,
    storeCode,
    price: r.price,
    discount: r.discount,
    total: r.total,
    deposit: r.deposit,
    rest: r.total - r.deposit,
    status: r.status,
    days: r.days + r.extendedDays,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    daysLeft,
    ending: r.status === "active" && daysLeft <= s.remindDays,
    moreTimeAsked: !!r.moreTimeAt,
    canAskMore: s.askMoreTime && r.status === "active" && !r.moreTimeAt && r.extensions < s.maxExtensions,
    orderId: r.orderId,
  };
}

export async function reservationByToken(token: string): Promise<ReservationDTO | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  await syncReservations(true);
  const db = await getDb();
  const [row] = await db.select({ r: reservations, code: stores.code }).from(reservations).leftJoin(stores, eq(stores.id, reservations.storeId)).where(eq(reservations.token, token));
  return row ? toReservationDTO(row.r, row.code, await reservationSettings()) : null;
}

/** EN: "As minhas reservas" (active first). PT: "As minhas reservas" (activas primeiro). */
export async function customerReservations(customerId: string): Promise<ReservationDTO[]> {
  await syncReservations();
  const db = await getDb();
  const s = await reservationSettings();
  const rows = await db
    .select({ r: reservations, code: stores.code })
    .from(reservations)
    .leftJoin(stores, eq(stores.id, reservations.storeId))
    .where(and(eq(reservations.customerId, customerId), inArray(reservations.status, ["pending", "active", "completed", "expired"])))
    .orderBy(desc(reservations.createdAt));
  const rank = { active: 0, pending: 1, completed: 2, expired: 3, cancelled: 4 } as const;
  return rows.map((x) => toReservationDTO(x.r, x.code, s)).sort((a, b) => rank[a.status] - rank[b.status]);
}

/** EN: "Pedir mais tempo": the team is told and extends it in Gestão · Reservas. PT: A equipa é avisada e prolonga. */
export async function requestMoreTime(token: string, customerId: string | null) {
  const s = await reservationSettings();
  const db = await getDb();
  const [r] = await db.select().from(reservations).where(eq(reservations.token, token));
  if (!r) throw new AppError("NOT_FOUND", "Reservation not found", 404);
  if (r.customerId && r.customerId !== customerId) throw new AppError("FORBIDDEN", "Not your reservation", 403);
  if (!s.askMoreTime || r.status !== "active" || r.extensions >= s.maxExtensions) throw new AppError("VALIDATION_ERROR", "Cannot ask for more time", 400);
  if (!r.moreTimeAt) {
    await db.update(reservations).set({ moreTimeAt: new Date(), updatedAt: new Date() }).where(eq(reservations.id, r.id));
    const [store] = r.storeId ? await db.select().from(stores).where(eq(stores.id, r.storeId)) : [];
    if (store?.phone) await sendMessage("whatsapp", store.phone, `${r.contact.name} pede mais tempo para a reserva ${r.number} (${r.code}), que termina a ${r.expiresAt ? longDate(r.expiresAt) : "—"}.`);
    await audit({ actor: { type: "customer", id: customerId, name: r.contact.name }, action: "Pedido de mais tempo numa reserva", detail: r.number });
  }
  return reservationByToken(token);
}

/** EN: wa.me link with the reminder already written (button "Avisar"). PT: Link wa.me com o aviso já escrito. */
export function reminderLink(r: ReservationRow, storeCode: string | null, s: ReservationSettings) {
  return r.contact.phone ? whatsappLink(reminderText(r, `Loja ${Number(storeCode ?? "2")} do Glória Mall`, s), `258${r.contact.phone}`) : null;
}

/** EN: Points when the piece is fully paid. PT: Pontos quando a peça estiver paga por inteiro. */
export async function addReservationPoints(r: ReservationRow) {
  if (!r.customerId) return;
  const db = await getDb();
  await db.insert(loyaltyEntries).values({
    customerId: r.customerId,
    year: currentYear(),
    kind: "store",
    points: Math.floor(r.total / 1000),
    amount: r.total,
    storeId: r.storeId,
    reason: `Reserva ${r.number}`,
  });
}
