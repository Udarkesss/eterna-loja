import "server-only";
import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { FITTING_KIND_LABELS, FITTING_SETTINGS_DEFAULT, type FittingSettings } from "@/data/fittings";
import { site, whatsappLink } from "@/data/site";
import type { FittingRequestInput } from "@/lib/auth-schemas";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { addDays, formatLongDate, fromMaputo, hhmm, minutes, toMaputo, todayMaputo } from "@/lib/time";
import {
  BRIDAL_FITTING_KINDS,
  type FittingKind,
  type FittingPublicDTO,
  type FittingSlotsDTO,
  type FittingStatus,
  type Locale,
} from "@/types";
import { randomToken } from "./auth/crypto";
import { getDb } from "./db";
import { fittings, productImages, products, stores } from "./db/schema";
import { AppError } from "./errors";
import { getSetting, nextCounter } from "./settings";

/**
 * EN: Fittings (design "Agendar prova" + "Gestão · 5 Provas"), agreed flow:
 *     1. The customer picks occasion, store, a free time and (optionally) pieces → status "requested", code PR-0042.
 *     2. WhatsApp opens with the message already written, including a link to the request page (photos of the pieces).
 *     3. The team talks on WhatsApp and presses "Aceitar" (confirmed) or "Propor outra hora" (pending).
 *     4. After the visit: "Realizada" (done) or "Faltou" (no_show).
 * PT: Provas, fluxo combinado: pedido no site → conversa no WhatsApp → a equipa aceita ou propõe outra hora →
 *     depois da visita marca realizada ou faltou.
 */

type FittingRow = typeof fittings.$inferSelect;
type StoreRow = typeof stores.$inferSelect;

/** EN: Statuses that hold the time slot. PT: Estados que ocupam o horário. */
const ACTIVE: FittingStatus[] = ["requested", "pending", "confirmed"];

export const fittingSchedule = () => getSetting<FittingSettings>("fittings.schedule", FITTING_SETTINGS_DEFAULT);

export function durationFor(kind: FittingKind, schedule: FittingSettings): number {
  return BRIDAL_FITTING_KINDS.includes(kind) ? schedule.bridalMinutes : schedule.defaultMinutes;
}

/** EN: Bridal → Loja 22, everything else → Loja 02. PT: Noiva → Loja 22, o resto → Loja 02. */
export function defaultStoreFor(kind: FittingKind): string {
  return BRIDAL_FITTING_KINDS.includes(kind) ? "22" : "02";
}

async function storeByCode(code: string): Promise<StoreRow> {
  const db = await getDb();
  const [row] = await db.select().from(stores).where(eq(stores.code, code));
  if (!row) throw new AppError("VALIDATION_ERROR", "Unknown store", 400);
  return row;
}

/** EN: The store's WhatsApp (digits, with 258). PT: O WhatsApp da loja (só dígitos, com 258). */
export function storeWhatsapp(store: Pick<StoreRow, "phone">): string {
  const digits = store.phone.replace(/\D/g, "");
  return digits.length >= 9 ? (digits.startsWith("258") ? digits : `258${digits.slice(-9)}`) : site.whatsapp;
}

async function busyIntervals(storeId: string, from: Date, to: Date, exceptId?: string) {
  const db = await getDb();
  const rows = await db
    .select({ startsAt: fittings.startsAt, durationMinutes: fittings.durationMinutes })
    .from(fittings)
    .where(
      and(
        eq(fittings.storeId, storeId),
        inArray(fittings.status, ACTIVE),
        gte(fittings.startsAt, new Date(from.getTime() - 4 * 3_600_000)),
        lt(fittings.startsAt, to),
        exceptId ? ne(fittings.id, exceptId) : undefined,
      ),
    );
  return rows.map((r) => ({ start: r.startsAt.getTime(), end: r.startsAt.getTime() + r.durationMinutes * 60_000 }));
}

/**
 * EN: Free start times for one store and day. One fitting at a time per store (each store has one fitting room team).
 * PT: Horas livres de uma loja num dia. Uma prova de cada vez por loja.
 */
export async function listSlots(storeCode: string, date: string, kind: FittingKind): Promise<FittingSlotsDTO> {
  const schedule = await fittingSchedule();
  const store = await storeByCode(storeCode);
  const { weekday } = toMaputo(fromMaputo(date, "12:00"));
  const today = todayMaputo();
  if (!schedule.days.includes(weekday) || date < today || date > addDays(today, schedule.maxDaysAhead)) {
    return { date, store: storeCode, times: [] };
  }
  const duration = durationFor(kind, schedule);
  const busy = await busyIntervals(store.id, fromMaputo(date), fromMaputo(addDays(date, 1)));
  const earliest = Date.now() + schedule.leadHours * 3_600_000;
  const times: string[] = [];
  for (let m = minutes(schedule.open); m + duration <= minutes(schedule.close); m += schedule.stepMinutes) {
    const start = fromMaputo(date, hhmm(m)).getTime();
    const end = start + duration * 60_000;
    if (start < earliest) continue;
    if (busy.some((b) => start < b.end && b.start < end)) continue;
    times.push(hhmm(m));
  }
  return { date, store: storeCode, times };
}

async function assertSlotFree(storeId: string, startsAt: Date, duration: number, exceptId?: string) {
  const end = startsAt.getTime() + duration * 60_000;
  const busy = await busyIntervals(storeId, new Date(startsAt.getTime() - 86_400_000), new Date(end), exceptId);
  if (busy.some((b) => startsAt.getTime() < b.end && b.start < end)) throw new AppError("SLOT_TAKEN", "Slot taken", 409);
}

async function nextFittingCode(): Promise<string> {
  return `PR-${String(await nextCounter("fittings.sequence")).padStart(4, "0")}`;
}

// ── Messages / Mensagens ──────────────────────────────────────────────

export function publicFittingUrl(token: string, locale: Locale): string {
  return `${site.url}/${locale}/fitting/${token}`;
}

/** EN: Customer → store, sent from the customer's WhatsApp. PT: Cliente → loja, enviada do WhatsApp da cliente. */
export function requestMessage(f: Pick<FittingRow, "kind" | "startsAt" | "code" | "publicToken" | "locale">, store: StoreRow, codes: string[]) {
  const { date, time } = toMaputo(f.startsAt);
  const kind = FITTING_KIND_LABELS[f.kind as FittingKind][f.locale];
  const when = `${formatLongDate(date, f.locale)}, ${time}`;
  const storeName = `Loja ${store.code}`;
  const pieces = codes.length ? (f.locale === "pt" ? `\nPeças: ${codes.join(", ")}` : `\nPieces: ${codes.join(", ")}`) : "";
  const link = publicFittingUrl(f.publicToken, f.locale);
  return f.locale === "pt"
    ? `Olá, pedi uma prova de ${kind} na ${storeName}, ${when}. Código ${f.code}.${pieces}\nVer o pedido: ${link}`
    : `Hello, I requested a ${kind} fitting at ${storeName}, ${when}. Code ${f.code}.${pieces}\nSee the request: ${link}`;
}

/** EN: "[Cliente 1] Ana Machava" → "Ana". PT: Primeiro nome, sem o marcador dos exemplos. */
const firstName = (name: string) => name.replace(/^\[[^\]]*\]\s*/, "").split(" ")[0] || name;

/** EN: Store → customer, after "Aceitar". PT: Loja → cliente, depois de "Aceitar". */
export function confirmationMessage(f: Pick<FittingRow, "kind" | "startsAt" | "code" | "clientName" | "locale">, store: StoreRow) {
  const { date, time } = toMaputo(f.startsAt);
  const first = firstName(f.clientName);
  return f.locale === "pt"
    ? `Olá ${first}, a sua prova na Eterna está confirmada: ${formatLongDate(date, "pt")}, às ${time}, na ${store.location}. Código ${f.code}. Até breve!`
    : `Hello ${first}, your Eterna fitting is confirmed: ${formatLongDate(date, "en")} at ${time}, ${store.location}. Code ${f.code}. See you soon!`;
}

export function proposalMessage(f: Pick<FittingRow, "startsAt" | "code" | "clientName" | "locale">, store: StoreRow) {
  const { date, time } = toMaputo(f.startsAt);
  const first = firstName(f.clientName);
  return f.locale === "pt"
    ? `Olá ${first}, a hora que pediu já não está livre. Podemos receber-lhe ${formatLongDate(date, "pt")}, às ${time}, na Loja ${store.code}? Código ${f.code}.`
    : `Hello ${first}, the time you asked for is no longer free. Could we see you ${formatLongDate(date, "en")} at ${time}, Loja ${store.code}? Code ${f.code}.`;
}

export function reminderMessage(f: Pick<FittingRow, "startsAt" | "code" | "clientName" | "locale">, store: StoreRow) {
  const { date, time } = toMaputo(f.startsAt);
  const first = firstName(f.clientName);
  return f.locale === "pt"
    ? `Olá ${first}, lembramos a sua prova na Eterna ${formatLongDate(date, "pt")}, às ${time}, na ${store.location}. Até breve!`
    : `Hello ${first}, a reminder of your Eterna fitting ${formatLongDate(date, "en")} at ${time}, ${store.location}. See you soon!`;
}

/** EN: wa.me link to the customer's number. PT: Link wa.me para o número da cliente. */
export function customerWhatsapp(phone: string, text: string) {
  return whatsappLink(text, `258${phone}`);
}

// ── Public / Público ──────────────────────────────────────────────────

async function productsFor(ids: string[], locale: Locale) {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(products).where(inArray(products.id, ids));
  const images = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, ids))
    .orderBy(asc(productImages.position));
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => ({
      slug: r.slug,
      code: r.code,
      name: r.name[locale],
      imageUrl: images.find((i) => i.productId === r.id)?.url ?? null,
    }));
}

export async function toFittingPublicDTO(f: FittingRow, locale: Locale = f.locale): Promise<FittingPublicDTO> {
  const db = await getDb();
  const [store] = await db.select().from(stores).where(eq(stores.id, f.storeId));
  const items = await productsFor(f.productIds, locale);
  return {
    code: f.code,
    token: f.publicToken,
    kind: f.kind as FittingKind,
    status: f.status,
    startsAt: f.startsAt.toISOString(),
    durationMinutes: f.durationMinutes,
    store: { code: store.code, name: store.name, location: store.location },
    products: items,
    whatsappUrl: whatsappLink(requestMessage(f, store, items.map((p) => p.code)), storeWhatsapp(store)),
  };
}

export async function createFittingRequest(input: FittingRequestInput & { phone: string }, customerId: string | null) {
  const schedule = await fittingSchedule();
  const store = await storeByCode(input.storeCode);
  const duration = durationFor(input.kind, schedule);
  const free = await listSlots(input.storeCode, input.date, input.kind);
  if (!free.times.includes(input.time)) throw new AppError("SLOT_TAKEN", "Slot taken", 409);
  const startsAt = fromMaputo(input.date, input.time);
  await assertSlotFree(store.id, startsAt, duration);

  const db = await getDb();
  const slugs = [...new Set(input.productSlugs ?? [])];
  const productRows = slugs.length
    ? await db.select({ id: products.id, slug: products.slug }).from(products).where(inArray(products.slug, slugs))
    : [];
  const productIds = slugs.map((s) => productRows.find((p) => p.slug === s)?.id).filter((id): id is string => !!id);

  const [row] = await db
    .insert(fittings)
    .values({
      code: await nextFittingCode(),
      publicToken: randomToken(18),
      customerId,
      clientName: input.name,
      phone: input.phone,
      locale: input.locale ?? "pt",
      storeId: store.id,
      startsAt,
      durationMinutes: duration,
      kind: input.kind,
      status: "requested",
      source: "site",
      notes: input.notes || null,
      productIds,
    })
    .returning();
  console.info(`[fittings] ${row.code} ${input.kind} · Loja ${store.code} · ${input.date} ${input.time} · ${formatMsisdn(input.phone)}`);
  return toFittingPublicDTO(row);
}

export async function findFittingByToken(token: string): Promise<FittingRow | null> {
  const db = await getDb();
  const [row] = await db.select().from(fittings).where(eq(fittings.publicToken, token));
  return row ?? null;
}

export async function listCustomerFittings(customerId: string, locale: Locale) {
  const db = await getDb();
  const rows = await db.select().from(fittings).where(eq(fittings.customerId, customerId)).orderBy(asc(fittings.startsAt));
  return Promise.all(rows.map((r) => toFittingPublicDTO(r, locale)));
}

// ── Team / Equipa (Gestão · 5 Provas) ────────────────────────────────

export async function getFitting(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(fittings).where(eq(fittings.id, id));
  if (!row) throw new AppError("NOT_FOUND", "Fitting not found", 404);
  const [store] = await db.select().from(stores).where(eq(stores.id, row.storeId));
  return { fitting: row, store };
}

export async function setFittingStatus(id: string, status: FittingStatus, staffUserId: string) {
  const db = await getDb();
  const patch: Partial<FittingRow> = { status };
  if (status === "confirmed") Object.assign(patch, { confirmedById: staffUserId, confirmedAt: new Date() });
  const [row] = await db.update(fittings).set(patch).where(eq(fittings.id, id)).returning();
  return row;
}

/** EN: "Propor outra hora" / "Remarcar". PT: Muda a hora e fica "Por confirmar". */
export async function rescheduleFitting(id: string, date: string, time: string) {
  const { fitting } = await getFitting(id);
  const startsAt = fromMaputo(date, time);
  await assertSlotFree(fitting.storeId, startsAt, fitting.durationMinutes, id);
  const db = await getDb();
  const [row] = await db.update(fittings).set({ startsAt, status: "pending" }).where(eq(fittings.id, id)).returning();
  return row;
}

/** EN: "Nova prova" — for requests that come by WhatsApp, phone or in store. PT: Pedidos que chegam por outros meios. */
export async function createFittingByStaff(
  input: { name: string; phone: string; kind: FittingKind; storeCode: string; date: string; time: string; notes?: string; source: "store" | "whatsapp"; locale: Locale },
  staffUserId: string,
) {
  const schedule = await fittingSchedule();
  const store = await storeByCode(input.storeCode);
  const duration = durationFor(input.kind, schedule);
  const startsAt = fromMaputo(input.date, input.time);
  await assertSlotFree(store.id, startsAt, duration);
  const db = await getDb();
  const [row] = await db
    .insert(fittings)
    .values({
      code: await nextFittingCode(),
      publicToken: randomToken(18),
      clientName: input.name,
      phone: input.phone,
      locale: input.locale,
      storeId: store.id,
      startsAt,
      durationMinutes: duration,
      kind: input.kind,
      status: "confirmed",
      source: input.source,
      internalNotes: input.notes || null,
      confirmedById: staffUserId,
      confirmedAt: new Date(),
    })
    .returning();
  return row;
}

export async function updateFittingNotes(id: string, internalNotes: string) {
  const db = await getDb();
  await db.update(fittings).set({ internalNotes }).where(eq(fittings.id, id));
}

/** EN: Fittings between two Maputo dates, optionally for some stores. PT: Provas entre duas datas. */
export async function listFittingsBetween(from: string, to: string, storeIds?: string[] | null) {
  const db = await getDb();
  return db
    .select()
    .from(fittings)
    .where(
      and(
        gte(fittings.startsAt, fromMaputo(from)),
        lt(fittings.startsAt, fromMaputo(to)),
        storeIds ? inArray(fittings.storeId, storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"]) : undefined,
      ),
    )
    .orderBy(asc(fittings.startsAt));
}
