import "server-only";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import type { CheckoutOptionsDTO, DeliveryZoneDTO, Locale, OccasionTileDTO, StoreDTO } from "@/types";
import { getDb } from "./db";
import { contentSections, deliveryZones, occasionTiles, paymentMethodSettings, stores } from "./db/schema";

/**
 * EN: Editable site content (Gestão · 8/9) and store data, resolved to one language.
 * PT: Conteúdo editável do site (Gestão · 8/9) e dados das lojas, num só idioma.
 */

/**
 * EN: Replaces every { pt, en } object inside `value` with the text for `locale`.
 * PT: Troca cada objecto { pt, en } dentro de `value` pelo texto do `locale`.
 */
export function resolveLocalized<T = unknown>(value: unknown, locale: Locale): T {
  if (Array.isArray(value)) return value.map((v) => resolveLocalized(v, locale)) as T;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 2 && "pt" in obj && "en" in obj) return obj[locale] as T;
    return Object.fromEntries(keys.map((k) => [k, resolveLocalized(obj[k], locale)])) as T;
  }
  return value as T;
}

export interface PageSection<T = Record<string, unknown>> {
  key: string;
  data: T;
}

/** EN: Visible sections of a page, in order. PT: Secções visíveis de uma página, por ordem. */
export const getPageSections = cache(async (page: string, locale: Locale): Promise<PageSection[]> => {
  const db = await getDb();
  const rows = await db
    .select()
    .from(contentSections)
    .where(eq(contentSections.page, page))
    .orderBy(asc(contentSections.position));
  return rows.filter((r) => r.visible).map((r) => ({ key: r.key, data: resolveLocalized(r.data, locale) }));
});

/** EN: One section's data, or null when hidden/missing. PT: Dados de uma secção, ou null se escondida. */
export async function getSection<T>(page: string, key: string, locale: Locale): Promise<T | null> {
  const section = (await getPageSections(page, locale)).find((s) => s.key === key);
  return (section?.data as T) ?? null;
}

export async function getOccasionTiles(locale: Locale): Promise<OccasionTileDTO[]> {
  const db = await getDb();
  const rows = await db.query.occasionTiles.findMany({
    orderBy: [asc(occasionTiles.position)],
    with: { category: true },
  });
  return rows.map((t) => ({
    name: t.name[locale],
    phrase: t.phrase[locale],
    imageUrl: t.imageUrl,
    href: t.category?.slug ?? null,
    size: t.size,
  }));
}

export const listStores = cache(async (locale: Locale): Promise<StoreDTO[]> => {
  const db = await getDb();
  const rows = await db.select().from(stores).orderBy(asc(stores.position));
  return rows.map((s) => ({ code: s.code, name: s.name, location: s.location, phone: s.phone, hours: s.hours?.[locale] ?? null }));
});

export async function listDeliveryZones(locale: Locale): Promise<DeliveryZoneDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.position));
  return rows.map((z) => ({ id: z.id, name: z.name, neighbourhoods: z.neighbourhoods, fee: z.fee, eta: z.eta[locale] }));
}

/** EN: Methods switched on in Gestão · 10, in checkout order. PT: Métodos ligados na gestão, pela ordem do checkout. */
export async function enabledPaymentMethods() {
  const db = await getDb();
  const rows = await db.select().from(paymentMethodSettings).orderBy(asc(paymentMethodSettings.position));
  return rows.filter((r) => r.enabled).map((r) => r.method);
}

export async function getCheckoutOptions(locale: Locale): Promise<CheckoutOptionsDTO> {
  const [methods, allStores, zones] = await Promise.all([
    enabledPaymentMethods(),
    listStores(locale),
    listDeliveryZones(locale),
  ]);
  return { methods, pickupStores: allStores, zones };
}
