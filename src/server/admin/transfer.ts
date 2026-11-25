import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { CategoryDetails, Localized, ProductColor } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import {
  categories,
  contentSections,
  customers,
  loyaltyEntries,
  occasionTiles,
  productCategories,
  productImages,
  products,
  productVariants,
  settings,
  stores,
} from "../db/schema";
import { AppError } from "../errors";
import type { StaffContext } from "../staff/access";
import { savePublicBuffer } from "../uploads";

/**
 * EN: Receives the file made on the team's computer by `npm run transfer:export` (owner 2026-11-25: "passa tudo para
 *     online"). The browser sends the photos one by one, then the data in small parts. Everything is matched by its
 *     natural key (category slug, product code, store code, section page+key, setting key, customer phone), so running
 *     it again updates instead of duplicating. Only the super administrator can use it.
 * PT: Recebe o ficheiro feito no computador da equipa com `npm run transfer:export`. O browser envia as fotos uma a
 *     uma e depois os dados em partes pequenas. Tudo é ligado pela sua chave natural, por isso repetir actualiza em vez
 *     de duplicar. Só o superadministrador pode usar.
 */

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

function onlySuper(staff: StaffContext) {
  if (staff.roleKey !== "super") throw new AppError("FORBIDDEN", "NO_ACCESS", 403);
}

/** EN: One photo of the file → Vercel Blob (online) or .data (local). PT: Uma foto → Vercel Blob ou .data. */
export async function receivePhoto(staff: StaffContext, localPath: string, data: Buffer, type: string): Promise<string> {
  onlySuper(staff);
  const m = localPath.match(/^\/uploads\/products\/([a-z0-9][a-z0-9-]*\.(jpg|png|webp))$/);
  if (!m) throw new AppError("VALIDATION_ERROR", "Invalid photo path", 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(type) || data.length > 2 * 1024 * 1024) throw new AppError("VALIDATION_ERROR", "Invalid photo", 400);
  return savePublicBuffer(data, "products", m[1], type);
}

type UrlMap = Record<string, string>;
const mapUrl = (url: string | null | undefined, map: UrlMap) => (url && map[url]) || url || null;

interface CategoryRow {
  slug: string;
  kind: (typeof categories.$inferInsert)["kind"];
  parent: string | null;
  name: Localized;
  singular: Localized | null;
  description: Localized | null;
  imageUrl: string | null;
  details: CategoryDetails | null;
  position: number;
}
interface StoreRow {
  code: string;
  name: string;
  location: string;
  phone: string;
  hours: Localized | null;
  lat: number | null;
  lng: number | null;
  position: number;
}
interface ProductRow {
  code: string;
  slug: string;
  name: Localized;
  description: Localized;
  composition: Localized | null;
  price: number;
  salePrice: number | null;
  colors: ProductColor[];
  type: string | null;
  collection: string | null;
  status: (typeof products.$inferInsert)["status"];
  publishAt: string | null;
  isNew: boolean;
  fitting: boolean;
  seoTitle: string | null;
  sourceId: string | null;
  createdAt: string;
  categories: string[];
  variants: { sku: string; color: string | null; size: string; store: string | null; stock: number; position: number }[];
  images: { url: string; color: string | null; alt: Localized | null; position: number; sourceUrl: string | null }[];
}
interface SectionRow {
  page: string;
  key: string;
  position: number;
  visible: boolean;
  data: Record<string, unknown>;
  publishedAt: string | null;
}
interface TileRow {
  name: Localized;
  phrase: Localized;
  imageUrl: string;
  category: string | null;
  size: (typeof occasionTiles.$inferInsert)["size"];
  position: number;
}
interface CustomerRow {
  phone: string | null;
  email: string | null;
  name: string;
  locale: "pt" | "en";
  levelOverride: string | null;
  levelOverrideYear: number | null;
  levelReason: string | null;
  loyalty: { year: number; kind: "import"; points: number; reason: string | null; actorName: string | null }[];
}

export type TransferPart =
  | { part: "categories"; rows: CategoryRow[] }
  | { part: "stores"; rows: StoreRow[] }
  | { part: "products"; rows: ProductRow[]; urls: UrlMap }
  | { part: "sections"; rows: SectionRow[] }
  | { part: "tiles"; rows: TileRow[] }
  | { part: "settings"; rows: { key: string; value: unknown }[] }
  | { part: "customers"; rows: CustomerRow[] }
  | { part: "done"; summary: string };

const date = (v: string | null) => (v ? new Date(v) : null);

/** EN: Applies one part of the file. PT: Aplica uma parte do ficheiro. */
export async function receivePart(staff: StaffContext, input: TransferPart): Promise<number> {
  onlySuper(staff);
  const db = await getDb();
  const now = new Date();

  if (input.part === "categories") {
    // EN: First every category, then the parents (a parent may come later in the list). PT: Primeiro todas, depois os pais.
    for (const c of input.rows) {
      const values = { slug: c.slug, kind: c.kind, name: c.name, singular: c.singular, description: c.description, imageUrl: c.imageUrl, details: c.details, position: c.position, updatedAt: now };
      await db.insert(categories).values(values).onConflictDoUpdate({ target: categories.slug, set: values });
    }
    const rows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
    const idOf = new Map(rows.map((r) => [r.slug, r.id]));
    for (const c of input.rows) await db.update(categories).set({ parentId: c.parent ? idOf.get(c.parent) ?? null : null }).where(eq(categories.slug, c.slug));
    return input.rows.length;
  }

  if (input.part === "stores") {
    for (const r of input.rows) {
      const values = { ...r, updatedAt: now };
      await db.insert(stores).values(values).onConflictDoUpdate({ target: stores.code, set: values });
    }
    return input.rows.length;
  }

  if (input.part === "products") {
    const cats = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
    const catId = new Map(cats.map((c) => [c.slug, c.id]));
    const storeId = new Map((await db.select({ id: stores.id, code: stores.code }).from(stores)).map((s) => [s.code, s.id]));
    for (const p of input.rows) {
      const values = {
        code: p.code,
        slug: p.slug,
        name: p.name,
        description: p.description,
        composition: p.composition,
        price: p.price,
        salePrice: p.salePrice,
        colors: p.colors,
        typeId: p.type ? catId.get(p.type) ?? null : null,
        collectionId: p.collection ? catId.get(p.collection) ?? null : null,
        status: p.status,
        publishAt: date(p.publishAt),
        isNew: p.isNew,
        fitting: p.fitting,
        seoTitle: p.seoTitle,
        sourceId: p.sourceId,
        updatedAt: now,
      };
      const [row] = await db
        .insert(products)
        .values({ ...values, createdAt: date(p.createdAt) ?? now })
        .onConflictDoUpdate({ target: products.code, set: values })
        .returning({ id: products.id });
      const id = row.id;
      // EN: Variants by SKU (orders keep pointing at the same ones). PT: Variantes pelo SKU.
      for (const v of p.variants) {
        const vv = { productId: id, sku: v.sku, color: v.color, size: v.size, storeId: v.store ? storeId.get(v.store) ?? null : null, stock: v.stock, position: v.position };
        await db.insert(productVariants).values(vv).onConflictDoUpdate({ target: productVariants.sku, set: vv });
      }
      await db.delete(productImages).where(eq(productImages.productId, id));
      if (p.images.length)
        await db.insert(productImages).values(p.images.map((i) => ({ productId: id, url: mapUrl(i.url, input.urls)!, color: i.color, alt: i.alt, position: i.position, sourceUrl: i.sourceUrl })));
      await db.delete(productCategories).where(eq(productCategories.productId, id));
      const links = [...new Set(p.categories.map((s) => catId.get(s)).filter((x): x is string => !!x))];
      if (links.length) await db.insert(productCategories).values(links.map((categoryId) => ({ productId: id, categoryId }))).onConflictDoNothing();
    }
    return input.rows.length;
  }

  if (input.part === "sections") {
    for (const r of input.rows) {
      const values = { page: r.page, key: r.key, position: r.position, visible: r.visible, data: r.data, publishedAt: date(r.publishedAt), updatedAt: now };
      await db.insert(contentSections).values(values).onConflictDoUpdate({ target: [contentSections.page, contentSections.key], set: values });
    }
    return input.rows.length;
  }

  if (input.part === "tiles") {
    const catId = new Map((await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [c.slug, c.id]));
    await db.delete(occasionTiles);
    if (input.rows.length)
      await db.insert(occasionTiles).values(input.rows.map((t) => ({ name: t.name, phrase: t.phrase, imageUrl: t.imageUrl, categoryId: t.category ? catId.get(t.category) ?? null : null, size: t.size, position: t.position })));
    return input.rows.length;
  }

  if (input.part === "settings") {
    for (const r of input.rows) {
      let value = r.value;
      if (r.key === "store.fixed") {
        // EN: Fixed single pieces come by code. PT: As peças fixas soltas vêm pelo código.
        const v = r.value as { categories?: string[]; productCodes?: string[] };
        const codes = v.productCodes ?? [];
        const ids = codes.length ? (await db.select({ id: products.id }).from(products).where(inArray(products.code, codes))).map((x) => x.id) : [];
        value = { categories: v.categories ?? [], products: ids };
      }
      await db.insert(settings).values({ key: r.key, value, updatedAt: now, updatedById: staff.id }).onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now, updatedById: staff.id } });
    }
    return input.rows.length;
  }

  if (input.part === "customers") {
    for (const c of input.rows) {
      if (!c.phone) continue;
      const [existing] = await db.select().from(customers).where(eq(customers.phone, c.phone));
      let id = existing?.id;
      // EN: A customer who already has an online account keeps her name, e-mail and password. PT: Quem já tem conta mantém-na.
      if (!existing) {
        const free = c.email ? !(await db.select({ id: customers.id }).from(customers).where(eq(customers.email, c.email))).length : false;
        [{ id }] = await db
          .insert(customers)
          .values({ name: c.name, phone: c.phone, email: free ? c.email : null, locale: c.locale, origin: "import", levelOverride: c.levelOverride, levelOverrideYear: c.levelOverrideYear, levelReason: c.levelReason })
          .returning({ id: customers.id });
      } else if (c.levelOverride && !existing.levelOverride) {
        await db.update(customers).set({ levelOverride: c.levelOverride, levelOverrideYear: c.levelOverrideYear, levelReason: c.levelReason, updatedAt: now }).where(eq(customers.id, existing.id));
      }
      for (const year of [...new Set(c.loyalty.map((e) => e.year))]) await db.delete(loyaltyEntries).where(and(eq(loyaltyEntries.customerId, id!), eq(loyaltyEntries.year, year), eq(loyaltyEntries.kind, "import")));
      if (c.loyalty.length) await db.insert(loyaltyEntries).values(c.loyalty.map((e) => ({ customerId: id!, year: e.year, kind: "import" as const, points: e.points, reason: e.reason, actorName: e.actorName })));
    }
    return input.rows.length;
  }

  await audit({ actor: actor(staff), action: "Dados trazidos do computador da equipa", detail: input.summary.slice(0, 300) });
  return 0;
}
