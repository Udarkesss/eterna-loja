import "server-only";
import { eq } from "drizzle-orm";
import { fittingPrice, type BridalSettings } from "@/data/bridal";
import type { BridalBookingInput } from "@/lib/auth-schemas";
import { methodFromMsisdn, normalizeMsisdn } from "@/lib/payments/msisdn";
import { addDays, fromMaputo, toMaputo, todayMaputo } from "@/lib/time";
import type { Locale } from "@/types";
import { randomToken } from "./auth/crypto";
import { enabledPaymentMethods } from "./content";
import { getDb } from "./db";
import { fittings, products } from "./db/schema";
import { AppError } from "./errors";
import { assertSlotFree, bridalSettings, busyIntervals, nextFittingCode, storeByCode, toFittingPublicDTO } from "./fittings";
import { getPaymentGateway } from "./payments";

/**
 * EN: Paid Eterna Bridal fittings of design V3 ("Agendar prova de noiva"). The fitting is held while the payment is
 *     pending and stays "Pedido pelo site · paga" for the team to confirm; a failed payment frees the time again.
 * PT: Provas pagas da Eterna Bridal do V3. A prova fica reservada enquanto o pagamento está pendente e fica "pedido
 *     pelo site · paga" para a equipa confirmar; um pagamento recusado liberta a hora.
 */

const BRIDAL_STORE = "22";
const DAYS_SHOWN = 14;
/** EN: Payment methods of the fitting (design: "M-Pesa, e-Mola ou cartão"). PT: Métodos da prova. */
export const FITTING_METHODS = ["mpesa", "emola", "mkesh", "card", "test"] as const;

const isoWeekday = (date: string) => toMaputo(fromMaputo(date, "12:00")).weekday || 7;

export interface BridalDay {
  date: string;
  open: boolean;
  times: { time: string; free: boolean }[];
}

/** EN: The next days with their start times, free or taken. PT: Os próximos dias com as horas, livres ou ocupadas. */
export async function bridalAvailability(settings: BridalSettings): Promise<BridalDay[]> {
  const store = await storeByCode(BRIDAL_STORE);
  const first = todayMaputo();
  const last = addDays(first, DAYS_SHOWN);
  const busy = await busyIntervals(store.id, fromMaputo(first), fromMaputo(last));
  const earliest = Date.now() + settings.advanceHours * 3_600_000;
  const shortest = Math.min(...settings.packages.filter((p) => p.status === "active").map((p) => p.minutes), 60);
  return Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(first, i)).map((date) => {
    const open = settings.enabled && settings.days.includes(isoWeekday(date));
    const times = open
      ? settings.hours.map((time) => {
          const start = fromMaputo(date, time).getTime();
          const end = start + shortest * 60_000;
          return { time, free: start >= earliest && !busy.some((b) => start < b.end && b.start < end) };
        })
      : [];
    return { date, open: open && times.some((t) => t.free), times };
  });
}

export async function createBridalBooking(input: BridalBookingInput & { phone: string }, customerId: string | null) {
  const settings = await bridalSettings();
  if (!settings.enabled) throw new AppError("METHOD_UNAVAILABLE", "Fittings are switched off", 400);
  if (settings.requireTerms && !input.acceptTerms) throw new AppError("VALIDATION_ERROR", "Terms not accepted", 400, { field: "acceptTerms" });
  const pkg = settings.packages.find((p) => p.key === input.packageKey && p.status === "active");
  const extras = input.extras ?? 0;
  const amount = fittingPrice(settings, input.packageKey, extras);
  if (!pkg || amount === null) throw new AppError("VALIDATION_ERROR", "Unknown package", 400, { field: "packageKey" });
  if (input.productSlugs.length > pkg.dresses + extras) throw new AppError("VALIDATION_ERROR", "Too many dresses", 400, { field: "productSlugs" });
  if (!settings.days.includes(isoWeekday(input.date)) || !settings.hours.includes(input.time)) throw new AppError("SLOT_TAKEN", "Slot taken", 409);
  const startsAt = fromMaputo(input.date, input.time);
  if (startsAt.getTime() < Date.now() + settings.advanceHours * 3_600_000) throw new AppError("SLOT_TAKEN", "Slot taken", 409);

  const methods = await enabledPaymentMethods();
  if (!methods.includes(input.method)) throw new AppError("METHOD_UNAVAILABLE", "Payment method switched off", 400, { field: "method" });
  const mobile = input.method === "mpesa" || input.method === "emola" || input.method === "mkesh";
  const msisdn = mobile ? normalizeMsisdn(input.msisdn ?? "") : null;
  if (mobile && (!msisdn || methodFromMsisdn(msisdn) !== input.method)) throw new AppError("VALIDATION_ERROR", "Invalid number", 400, { field: "msisdn" });

  const store = await storeByCode(BRIDAL_STORE);
  await assertSlotFree(store.id, startsAt, pkg.minutes);
  const db = await getDb();
  const rows = await db.select({ id: products.id, slug: products.slug, collectionId: products.collectionId }).from(products);
  const chosen = input.productSlugs.map((slug) => rows.find((r) => r.slug === slug)).filter((r): r is NonNullable<typeof r> => !!r);
  const privee = (await db.query.categories.findFirst({ where: (c, { eq: e }) => e(c.slug, "eterna-privee") }))?.id;
  const kind = privee && chosen.some((p) => p.collectionId === privee) ? "bride_privee" : "bride_white";
  const notes = [input.weddingDate ? `Casamento: ${input.weddingDate}` : "", input.email ? `E-mail: ${input.email}` : "", input.notes ?? ""].filter(Boolean).join(" · ");

  const [row] = await db
    .insert(fittings)
    .values({
      code: await nextFittingCode(),
      publicToken: randomToken(18),
      customerId,
      clientName: input.name,
      phone: input.phone,
      email: input.email || null,
      locale: (input.locale ?? "pt") as Locale,
      storeId: store.id,
      startsAt,
      durationMinutes: pkg.minutes,
      kind,
      status: "requested",
      source: "site",
      notes: notes || null,
      productIds: chosen.map((p) => p.id),
      packageKey: pkg.key,
      extraDresses: extras,
      amount,
      paymentMethod: input.method,
      paymentStatus: input.method === "test" ? "paid" : "pending",
      paidAt: input.method === "test" ? new Date() : null,
    })
    .returning();

  if (input.method !== "test") {
    try {
      const charge = await getPaymentGateway(input.method).charge({
        orderNumber: row.code,
        amount,
        msisdn: msisdn ?? undefined,
        idempotencyKey: row.publicToken,
      });
      await db.update(fittings).set({ paymentReference: charge.reference, ...(charge.status === "paid" ? { paymentStatus: "paid", paidAt: new Date() } : {}) }).where(eq(fittings.id, row.id));
    } catch (e) {
      await db.update(fittings).set({ paymentStatus: "failed", status: "cancelled" }).where(eq(fittings.id, row.id));
      throw e;
    }
  }
  return bookingStatus(row.publicToken);
}

/**
 * EN: The booking and its payment; a pending payment is checked with the provider (the page asks every few seconds).
 * PT: A marcação e o pagamento; um pagamento pendente é consultado no fornecedor (a página pergunta de segundos a segundos).
 */
export async function bookingStatus(token: string) {
  const db = await getDb();
  let [row] = await db.select().from(fittings).where(eq(fittings.publicToken, token));
  if (!row) throw new AppError("NOT_FOUND", "Fitting not found", 404);
  if (row.paymentStatus === "pending" && row.paymentReference && row.paymentMethod && row.paymentMethod !== "test") {
    const result = await getPaymentGateway(row.paymentMethod as (typeof FITTING_METHODS)[number] & ("mpesa" | "emola" | "mkesh" | "card")).checkStatus(row.paymentReference);
    if (result.status === "paid") {
      [row] = await db.update(fittings).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(fittings.id, row.id)).returning();
    } else if (result.status === "failed" || result.status === "expired") {
      // EN: The time is freed again. PT: A hora fica livre outra vez.
      [row] = await db.update(fittings).set({ paymentStatus: "failed", status: "cancelled" }).where(eq(fittings.id, row.id)).returning();
    }
  }
  return { ...(await toFittingPublicDTO(row)), paymentStatus: row.paymentStatus, amount: row.amount, packageKey: row.packageKey, extraDresses: row.extraDresses };
}
