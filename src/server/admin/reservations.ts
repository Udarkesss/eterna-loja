import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { formatMZN } from "@/lib/format";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { sizeParts } from "@/lib/sizes";
import { toMaputo, todayMaputo } from "@/lib/time";
import { audit } from "../audit";
import { getDb } from "../db";
import { customers, products, productImages, productVariants, reservations, stores } from "../db/schema";
import { AppError } from "../errors";
import { sendMessage } from "../messaging";
import {
  addReservationPoints,
  endOfDayIn,
  isBridalStore,
  longDate,
  nextReservationNumber,
  reminderLink,
  reservationSettings,
  syncReservations,
  type ReservationRow,
} from "../reservations";
import { storeScope, type StaffContext } from "../staff/access";

/**
 * EN: "Gestão · Reservas" of design V3 (online and in the store): indicators, tabs (Todas · Activas · A terminar ·
 *     Expiradas · Concluídas · Canceladas), search, store and origin filters, and the actions "Avisar" (WhatsApp),
 *     "Levantada e paga", "Prolongar", "Cancelar"; "Nova reserva na loja". Every change goes to the audit log.
 * PT: Reservas do V3 (online e na loja): indicadores, separadores, pesquisa, filtros de loja e origem, e as acções
 *     "Avisar", "Levantada e paga", "Prolongar", "Cancelar"; "Nova reserva na loja". Tudo fica na auditoria.
 */

export const RESERVATION_VIEWS = { todas: "Todas", activas: "Activas", terminar: "A terminar", expiradas: "Expiradas", concluidas: "Concluídas", canceladas: "Canceladas" } as const;
export type ReservationView = keyof typeof RESERVATION_VIEWS;

export interface AdminReservationRow {
  id: string;
  number: string;
  origin: string;
  customer: string;
  phone: string | null;
  image: string | null;
  code: string;
  desc: string;
  store: string;
  storeCode: string | null;
  paid: string;
  due: string;
  until: string;
  left: string;
  pct: number;
  tone: "ok" | "warn" | "bad";
  state: string;
  stateTone: "ok" | "warn" | "bad" | "neutral";
  extra: string | null;
  view: Exclude<ReservationView, "todas" | "terminar">;
  ending: boolean;
  open: boolean;
  canExtend: boolean;
  remindHref: string | null;
  expiresAt: string | null;
  extendTo: string | null;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const day = (d: Date) => {
  const [y, m, dd] = toMaputo(d).date.split("-");
  return `${Number(dd)} ${MONTHS[Number(m) - 1]} ${y}`;
};
const sizeLabel = (s: string) => [sizeParts(s).detail, sizeParts(s).letter].filter(Boolean).join(" · ");
const money = (v: number) => formatMZN(v, "pt").replace(/\s?MT$/, "");
const daysBetween = (a: Date) => Math.round((Date.parse(toMaputo(a).date) - Date.parse(todayMaputo())) / 86_400_000);

export async function listAdminReservations(staff: StaffContext, filter: { q?: string; view?: ReservationView; store?: string; origin?: string } = {}) {
  await syncReservations(true);
  const db = await getDb();
  const s = await reservationSettings();
  const scope = storeScope(staff, "reservations");
  const rows = await db
    .select({ r: reservations, storeCode: stores.code })
    .from(reservations)
    .leftJoin(stores, eq(stores.id, reservations.storeId))
    .orderBy(desc(reservations.createdAt));
  const list: AdminReservationRow[] = rows
    .filter(({ r }) => !scope || (r.storeId && scope.includes(r.storeId)))
    .map(({ r, storeCode }) => {
      const left = r.expiresAt ? daysBetween(r.expiresAt) : r.days;
      const total = r.days + r.extendedDays;
      const pct = r.status === "active" && r.expiresAt ? Math.min(100, Math.max(0, Math.round(((total - left) / total) * 100))) : r.status === "pending" ? 0 : 100;
      const ending = r.status === "active" && left <= s.remindDays;
      const tone: AdminReservationRow["tone"] = r.status === "active" ? (left <= 2 ? "bad" : ending ? "warn" : "ok") : r.status === "pending" ? "warn" : r.status === "completed" ? "ok" : "bad";
      const view: AdminReservationRow["view"] =
        r.status === "completed" ? "concluidas" : r.status === "expired" ? "expiradas" : r.status === "cancelled" ? "canceladas" : "activas";
      const bridal = isBridalStore(storeCode);
      const step = bridal ? s.bridalExtendDays : s.extendDays;
      const extras = [
        r.extensions ? `Prolongada ${r.extensions}× (+${r.extendedDays})` : null,
        r.moreTimeAt && r.status === "active" ? "Pediu mais tempo" : null,
        r.status === "expired" ? "Peça voltou à venda · sinal retido" : null,
        r.status === "cancelled" && r.origin === "online" && !r.startsAt ? "Sinal não pago" : null,
      ].filter(Boolean);
      return {
        id: r.id,
        number: r.number,
        origin: r.origin === "online" ? "Online" : "Na loja",
        customer: r.contact.name,
        phone: r.contact.phone ?? null,
        image: r.imageUrl,
        code: r.code,
        desc: [r.name, r.color, r.size ? sizeLabel(r.size) : null].filter(Boolean).join(" · "),
        store: `Loja ${Number(storeCode ?? "2")}`,
        storeCode,
        paid: money(r.status === "completed" ? r.total : r.deposit),
        due: r.status === "completed" || r.status === "expired" || r.status === "cancelled" ? "—" : money(r.total - r.deposit),
        until: r.expiresAt ? day(r.expiresAt) : "Ainda sem prazo",
        left:
          r.status === "active"
            ? left <= 0
              ? "Termina hoje"
              : left === 1
                ? "Falta 1 dia"
                : `Faltam ${left} dias`
            : r.status === "pending"
              ? "A confirmar o sinal"
              : r.status === "completed"
                ? `Levantada a ${day(r.completedAt ?? r.updatedAt)}`
                : r.status === "expired"
                  ? "Terminou"
                  : "Cancelada",
        pct,
        tone,
        state: r.status === "active" ? (ending ? "A terminar" : "Activa") : r.status === "pending" ? "A confirmar" : r.status === "completed" ? "Concluída" : r.status === "expired" ? "Expirada" : "Cancelada",
        stateTone: r.status === "active" ? (ending ? "warn" : "ok") : r.status === "pending" ? "warn" : r.status === "completed" ? "neutral" : "bad",
        extra: extras.join(" · ") || null,
        view,
        ending,
        open: r.status === "active",
        canExtend: r.status === "active" && s.allowExtend && r.extensions < s.maxExtensions,
        remindHref: r.status === "active" ? reminderLink(r, storeCode, s) : null,
        expiresAt: r.expiresAt ? day(r.expiresAt) : null,
        extendTo: r.expiresAt ? `+${step} dias → ${day(new Date(r.expiresAt.getTime() + step * 86_400_000))}` : null,
      };
    });

  const counts = {
    todas: list.length,
    activas: list.filter((x) => x.view === "activas").length,
    terminar: list.filter((x) => x.ending).length,
    expiradas: list.filter((x) => x.view === "expiradas").length,
    concluidas: list.filter((x) => x.view === "concluidas").length,
    canceladas: list.filter((x) => x.view === "canceladas").length,
  };
  const month = todayMaputo().slice(0, 7);
  const inMonth = (d: Date | null) => !!d && toMaputo(d).date.startsWith(month);
  const active = rows.filter(({ r }) => r.status === "active");
  const byStore = new Map<string, number>();
  for (const { storeCode } of active) byStore.set(storeCode ?? "02", (byStore.get(storeCode ?? "02") ?? 0) + 1);
  const kpis = {
    active: active.length,
    activeStores: [...byStore.entries()].map(([code, n]) => `${n} na Loja ${Number(code)}`).join(" · "),
    ending: counts.terminar,
    deposits: rows.filter(({ r }) => r.startsAt && inMonth(r.startsAt) && r.status !== "cancelled").reduce((sum, { r }) => sum + r.deposit, 0),
    expired: rows.filter(({ r }) => r.status === "expired" && inMonth(r.expiresAt)).length,
    monthName: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(month.slice(5)) - 1],
  };

  const q = (filter.q ?? "").toLowerCase().replace(/\s/g, "");
  const visible = list
    .filter((x) => !q || [x.number, x.customer, x.phone ?? "", x.code].join("").toLowerCase().replace(/\s/g, "").includes(q))
    .filter((x) => !filter.store || x.storeCode === filter.store)
    .filter((x) => !filter.origin || (filter.origin === "online" ? x.origin === "Online" : x.origin === "Na loja"))
    .filter((x) => {
      const v = filter.view ?? "todas";
      return v === "todas" || (v === "terminar" ? x.ending : x.view === v);
    });
  return { list: visible, counts, kpis, settings: s };
}

/** EN: Pieces in stock for "Nova reserva na loja". PT: Peças com stock para "Nova reserva na loja". */
export async function piecesInStock() {
  const db = await getDb();
  const rows = await db
    .select({ id: productVariants.id, code: products.code, color: productVariants.color, colors: products.colors, size: productVariants.size, stock: productVariants.stock, price: products.price, salePrice: products.salePrice, storeCode: stores.code })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(stores, eq(stores.id, productVariants.storeId))
    .where(gt(productVariants.stock, 0))
    .orderBy(asc(products.code));
  return rows.map((r) => ({
    id: r.id,
    label: [r.code, r.colors.find((c) => c.key === r.color)?.name.pt, sizeLabel(r.size)].filter(Boolean).join(" · "),
    price: r.salePrice ?? r.price,
    storeCode: r.storeCode ?? "02",
  }));
}

export async function customersForReservation() {
  const db = await getDb();
  return db.select({ id: customers.id, name: customers.name, phone: customers.phone }).from(customers).orderBy(asc(customers.name));
}

const staffActor = (staff: StaffContext) => ({ type: "staff" as const, id: staff.id, name: staff.name, role: staff.roleName });

export interface StoreReservationInput {
  customerId: string | null;
  name: string;
  phone: string;
  variantId: string;
  storeCode: string;
  deposit: number;
  method: "cash" | "mpesa" | "emola" | "mkesh" | "card" | "transfer";
}

export const STORE_METHODS: Record<StoreReservationInput["method"], string> = { cash: "Dinheiro", mpesa: "M-Pesa", emola: "e-Mola", mkesh: "mKesh", card: "Cartão", transfer: "Transferência" };

/** EN: "Registar reserva" in the store: the piece is held at once. PT: A peça fica presa logo. */
export async function createStoreReservation(staff: StaffContext, input: StoreReservationInput) {
  const db = await getDb();
  const s = await reservationSettings();
  const [store] = await db.select().from(stores).where(eq(stores.code, input.storeCode));
  if (!store) throw new AppError("VALIDATION_ERROR", "Escolha a loja.", 400);
  const scope = storeScope(staff, "reservations");
  if (scope && !scope.includes(store.id)) throw new AppError("FORBIDDEN", "Só pode registar reservas nas suas lojas.", 403);
  const [v] = await db
    .select({ variant: productVariants, product: products })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, input.variantId));
  if (!v) throw new AppError("VALIDATION_ERROR", "Escolha a peça.", 400);
  const phone = input.phone ? normalizeMsisdn(input.phone) : null;
  if (input.phone && !phone) throw new AppError("VALIDATION_ERROR", "O telefone não é válido (ex.: 84 123 4567).", 400);
  let customerId = input.customerId;
  if (!customerId && phone) {
    const [found] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
    customerId = found?.id ?? null;
  }
  const [person] = customerId ? await db.select().from(customers).where(eq(customers.id, customerId)) : [];
  const total = v.product.salePrice ?? v.product.price;
  if (input.deposit < 1 || input.deposit > total) throw new AppError("VALIDATION_ERROR", "O sinal tem de estar entre 1 MT e o preço da peça.", 400);
  const [image] = await db.select({ url: productImages.url }).from(productImages).where(eq(productImages.productId, v.product.id)).orderBy(asc(productImages.position)).limit(1);
  const days = isBridalStore(store.code) ? s.bridalDays : s.days;
  const number = await nextReservationNumber();
  await db.transaction(async (tx) => {
    const held = await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} - 1` })
      .where(and(eq(productVariants.id, v.variant.id), gt(productVariants.stock, 0)))
      .returning({ id: productVariants.id });
    if (!held.length) throw new AppError("OUT_OF_STOCK", "Esta peça já não tem stock.", 409);
    await tx.insert(reservations).values({
      number,
      customerId,
      contact: { name: person?.name ?? input.name, phone: person?.phone ?? phone ?? undefined, email: person?.email ?? undefined },
      origin: "store",
      productId: v.product.id,
      variantId: v.variant.id,
      slug: v.product.slug,
      code: v.product.code,
      name: v.product.name.pt,
      color: v.product.colors.find((c) => c.key === v.variant.color)?.name.pt ?? null,
      size: v.variant.size,
      imageUrl: image?.url ?? null,
      storeId: store.id,
      price: total,
      discount: 0,
      total,
      deposit: input.deposit,
      depositMethod: input.method,
      status: "active",
      days,
      startsAt: new Date(),
      expiresAt: endOfDayIn(days),
      createdByName: staff.name,
    });
  });
  await audit({ actor: staffActor(staff), action: "Reserva registada na loja", detail: `${number} · ${v.product.code} · sinal ${formatMZN(input.deposit, "pt")} (${STORE_METHODS[input.method]})` });
  return number;
}

async function reservationOrThrow(staff: StaffContext, id: string) {
  const db = await getDb();
  const [row] = await db.select({ r: reservations, storeCode: stores.code }).from(reservations).leftJoin(stores, eq(stores.id, reservations.storeId)).where(eq(reservations.id, id));
  if (!row) throw new AppError("NOT_FOUND", "Reserva não encontrada.", 404);
  const scope = storeScope(staff, "reservations");
  if (scope && (!row.r.storeId || !scope.includes(row.r.storeId))) throw new AppError("FORBIDDEN", "Esta reserva é de outra loja.", 403);
  return row as { r: ReservationRow; storeCode: string | null };
}

/** EN: "Prolongar e avisar por WhatsApp". PT: Prolonga o prazo e avisa a cliente. */
export async function extendReservation(staff: StaffContext, id: string) {
  const { r, storeCode } = await reservationOrThrow(staff, id);
  const s = await reservationSettings();
  if (r.status !== "active" || !r.expiresAt) throw new AppError("VALIDATION_ERROR", "Só se prolongam reservas activas.", 400);
  if (!s.allowExtend || r.extensions >= s.maxExtensions) throw new AppError("VALIDATION_ERROR", "Esta reserva já foi prolongada o máximo de vezes (Definições).", 400);
  const step = isBridalStore(storeCode) ? s.bridalExtendDays : s.extendDays;
  const until = new Date(r.expiresAt.getTime() + step * 86_400_000);
  const db = await getDb();
  await db
    .update(reservations)
    .set({ expiresAt: until, extensions: r.extensions + 1, extendedDays: r.extendedDays + step, moreTimeAt: null, remindedAt: null, updatedAt: new Date() })
    .where(eq(reservations.id, r.id));
  if (r.contact.phone) {
    const first = r.contact.name.replace(/\[[^\]]*\]\s*/g, "").split(" ")[0];
    await sendMessage("whatsapp", `+258${r.contact.phone}`, `Olá ${first}, a sua reserva da peça ${r.code} foi prolongada até ${longDate(until)}. Pode levantar na Loja ${Number(storeCode ?? "2")} do Glória Mall até lá.`);
  }
  await audit({ actor: staffActor(staff), action: "Reserva prolongada", detail: `${r.number} · +${step} dias → ${longDate(until)}` });
}

/** EN: "Levantada e paga": the rest was paid in the store; points count now. PT: O resto foi pago na loja; os pontos contam agora. */
export async function completeReservation(staff: StaffContext, id: string) {
  const { r } = await reservationOrThrow(staff, id);
  if (r.status !== "active") throw new AppError("VALIDATION_ERROR", "Só se concluem reservas activas.", 400);
  const db = await getDb();
  const [done] = await db
    .update(reservations)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reservations.id, r.id), eq(reservations.status, "active")))
    .returning();
  if (done) await addReservationPoints(done);
  await audit({ actor: staffActor(staff), action: "Reserva levantada e paga", detail: `${r.number} · ${r.code} · ${formatMZN(r.total, "pt")}` });
}

/** EN: "Cancelar": the piece goes back on sale; the deposit is kept. PT: A peça volta à venda; o sinal fica retido. */
export async function cancelReservation(staff: StaffContext, id: string) {
  const { r } = await reservationOrThrow(staff, id);
  if (r.status !== "active") throw new AppError("VALIDATION_ERROR", "Só se cancelam reservas activas.", 400);
  const db = await getDb();
  const [done] = await db
    .update(reservations)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reservations.id, r.id), eq(reservations.status, "active")))
    .returning();
  if (done?.variantId) {
    await db
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + 1` })
      .where(eq(productVariants.id, done.variantId));
  }
  await audit({ actor: staffActor(staff), action: "Reserva cancelada", detail: `${r.number} · ${r.code} · peça voltou à venda` });
}
