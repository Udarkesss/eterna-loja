import "server-only";
import { and, asc, eq, inArray, notInArray, or } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import type { OldProduct } from "@/lib/import/shopify";
import { COLOR_FAMILIES } from "@/types";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productCategories, productImages, productVariants, products, stores } from "../db/schema";
import { AppError } from "../errors";
import { can, type StaffContext } from "../staff/access";
import { deletePublicFile, savePublicBuffer } from "../uploads";

/**
 * EN: Saves products read from the Shopify export and the old site (src/lib/import/shopify.ts). The browser sends a few
 *     products at a time, so photo downloads never hit the server time limit. Safe to repeat, never duplicates:
 *     a product is matched by its Shopify handle, its reference or its address, and then OVERWRITTEN with the source
 *     (names, texts, price, colours, categories, sizes, stock, status, photos), as agreed for the migration.
 *     - Status mirrors the old site: published there with a photo and a price → published here; otherwise a draft.
 *     - Photos are only downloaded again when the list of photos changed (their original address is kept).
 *     - Photos come only from the Shopify CDN and the old eterna.co.mz storage (never any other address).
 * PT: Grava os produtos lidos do CSV do Shopify e do site antigo. O browser envia poucos produtos de cada vez, para as
 *     fotos nunca passarem o limite de tempo do servidor. Pode repetir-se sem duplicar: o produto é encontrado pelo
 *     handle do Shopify, pela referência ou pelo endereço, e SUBSTITUÍDO pela origem (nomes, textos, preço, cores,
 *     categorias, tamanhos, stock, estado, fotos), como combinado para a migração.
 *     - O estado espelha o site antigo: publicado lá, com foto e preço → publicado aqui; senão, rascunho.
 *     - As fotos só se descarregam outra vez quando a lista de fotos mudou (guarda-se o endereço de origem).
 *     - As fotos só vêm do CDN do Shopify e do armazenamento antigo do eterna.co.mz.
 */

const localized = z.object({ pt: z.string().max(5000), en: z.string().max(5000) });
const itemSchema = z.object({
  sourceId: z.string().regex(/^shopify:[a-z0-9-]{1,120}$/),
  code: z.string().trim().min(1).max(40),
  name: localized,
  description: localized,
  price: z.number().int().min(0).max(10_000_000),
  salePrice: z.number().int().min(0).nullable(),
  type: z.string().max(60).nullable(),
  collection: z.string().max(60).nullable(),
  links: z.array(z.string().max(60)).max(30),
  colors: z
    .array(z.object({ key: z.string().max(60), name: localized, hex: z.string().max(9).nullable(), family: z.enum(COLOR_FAMILIES).nullable() }))
    .max(40),
  variants: z
    .array(z.object({ sku: z.string().min(1).max(60), color: z.string().max(60).nullable(), size: z.string().min(1).max(40), available: z.boolean().nullable() }))
    .min(1)
    .max(80),
  images: z.array(z.object({ url: z.string().url().max(500), color: z.string().max(60).nullable() })).max(20),
  publish: z.boolean(),
  origin: z.enum(["csv", "site", "both"]),
});
export const importBatchSchema = z.object({
  items: z.array(itemSchema).min(1).max(5),
  options: z.object({ stock: z.number().int().min(0).max(999), store: z.string().max(4) }),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;
type Item = ImportBatch["items"][number];

export interface ImportOutcome {
  code: string;
  result: "created" | "updated" | "failed";
  photos: number; // EN: photos downloaded now. PT: fotos descarregadas agora.
  published: boolean;
  message?: string;
}

const PHOTO_HOSTS = ["cdn.shopify.com", "eterna.co.mz"];
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/** EN: Downloads one photo, converts it to WebP (max 1200 px, ≈140 KB). PT: Descarrega uma foto e converte para WebP. */
async function fetchPhoto(url: string): Promise<Buffer> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !PHOTO_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
    throw new Error(`endereço não permitido (${u.hostname})`);
  }
  const res = await fetch(u, { signal: AbortSignal.timeout(25_000), redirect: "error" });
  if (!res.ok) throw new Error(`foto ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error("foto grande demais");
  return sharp(bytes).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
}

/** EN: Short stable hash, so a changed photo gets a new file name (no stale cache). PT: Resumo curto do endereço. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * EN: Keeps the product's photos when the source list is unchanged; otherwise downloads the new list and replaces them
 *     (the old imported files are deleted). If no new photo could be downloaded, the old ones stay.
 * PT: Mantém as fotos se a lista de origem não mudou; senão descarrega a nova e substitui (apaga os ficheiros importados
 *     antigos). Se nenhuma foto nova descarregar, ficam as antigas.
 */
async function syncPhotos(productId: string, slug: string, item: Item): Promise<{ downloaded: number; total: number }> {
  const db = await getDb();
  const current = await db
    .select({ id: productImages.id, url: productImages.url, sourceUrl: productImages.sourceUrl })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position));
  const same = current.length === item.images.length && current.every((c, i) => c.sourceUrl === item.images[i].url);
  // EN: Photos imported from Eterna's own folder ("pasta:…") win over Shopify's. PT: As fotos da pasta da Eterna ficam.
  const fromFolder = current.some((c) => c.sourceUrl?.startsWith("pasta:"));
  if (same || fromFolder || !item.images.length) return { downloaded: 0, total: current.length };

  const saved = await Promise.all(
    item.images.map(async (img, i) => {
      try {
        const data = await fetchPhoto(img.url);
        const name = `shopify-${slug}-${String(i + 1).padStart(2, "0")}-${shortHash(img.url)}.webp`;
        const url = await savePublicBuffer(data, "products", name, "image/webp");
        return { productId, url, sourceUrl: img.url, color: img.color, alt: { pt: `${item.name.pt} · ${item.code}`, en: `${item.name.en} · ${item.code}` } };
      } catch {
        return null;
      }
    }),
  );
  const rows = saved.filter((r): r is NonNullable<typeof r> => !!r).map((r, position) => ({ ...r, position }));
  if (!rows.length) return { downloaded: 0, total: current.length };
  await db.transaction(async (tx) => {
    await tx.delete(productImages).where(eq(productImages.productId, productId));
    await tx.insert(productImages).values(rows);
  });
  const kept = new Set(rows.map((r) => r.url));
  for (const old of current) if (!kept.has(old.url) && old.url.includes("/shopify-")) await deletePublicFile(old.url).catch(() => undefined);
  return { downloaded: rows.length, total: rows.length };
}

export async function importShopifyBatch(staff: StaffContext, input: ImportBatch): Promise<ImportOutcome[]> {
  const { items, options } = importBatchSchema.parse(input);
  const db = await getDb();
  const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.code, options.store));
  if (!store) throw new AppError("VALIDATION_ERROR", "Loja desconhecida.", 400);
  const mayPublish = can(staff, "products.publish");
  const slugs = [...new Set(items.flatMap((i) => [i.type, i.collection, ...i.links]).filter((s): s is string => !!s))];
  const cats = slugs.length ? await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, slugs)) : [];
  const catId = (slug: string | null) => (slug ? (cats.find((c) => c.slug === slug)?.id ?? null) : null);

  const out: ImportOutcome[] = [];
  for (const item of items) {
    const slug = item.code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(or(eq(products.sourceId, item.sourceId), eq(products.code, item.code), eq(products.slug, slug)))
        .limit(1);
      const values = {
        name: item.name,
        description: item.description,
        price: item.price,
        salePrice: item.salePrice,
        colors: item.colors,
        typeId: catId(item.type),
        collectionId: catId(item.collection),
        sourceId: item.sourceId,
      };
      const id = await db.transaction(async (tx) => {
        const productId = existing
          ? (await tx.update(products).set(values).where(eq(products.id, existing.id)).returning({ id: products.id }))[0].id
          : (await tx.insert(products).values({ ...values, slug, code: item.code, status: "draft" }).returning({ id: products.id }))[0].id;
        await tx.delete(productCategories).where(eq(productCategories.productId, productId));
        const links = [...new Set([item.type, item.collection, ...item.links].map(catId).filter((x): x is string => !!x))];
        if (links.length) await tx.insert(productCategories).values(links.map((categoryId) => ({ productId, categoryId })));
        for (const [position, v] of item.variants.entries()) {
          const variant = { productId, sku: v.sku, color: v.color, size: v.size, stock: v.available === false ? 0 : options.stock, storeId: store.id, position };
          await tx.insert(productVariants).values(variant).onConflictDoUpdate({ target: productVariants.sku, set: variant });
        }
        await tx.delete(productVariants).where(and(eq(productVariants.productId, productId), notInArray(productVariants.sku, item.variants.map((v) => v.sku))));
        return productId;
      });
      const photos = await syncPhotos(id, slug, item);
      const published = item.publish && mayPublish && photos.total > 0;
      await db.update(products).set({ status: published ? "published" : "draft" }).where(eq(products.id, id));
      out.push({ code: item.code, result: existing ? "updated" : "created", photos: photos.downloaded, published });
    } catch (e) {
      out.push({ code: item.code, result: "failed", photos: 0, published: false, message: e instanceof Error ? e.message.slice(0, 160) : "erro" });
    }
  }
  return out;
}

/** EN: One audit line per import run. PT: Uma linha de auditoria por importação. */
export async function auditImport(staff: StaffContext, summary: string) {
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Importação do Shopify", detail: summary.slice(0, 300) });
}

// ── Old site / Site antigo ────────────────────────────────────────────

/**
 * EN: Reads one page of the old site's public storefront data (Shopify: /products.json, /collections.json,
 *     /collections/<handle>/products.json). The browser asks page by page; the server does the request (the old site does
 *     not allow it from another address). Only the fixed old-site address is used (OLD_SITE_URL, default eterna.co.mz).
 * PT: Lê uma página dos dados públicos da loja antiga. O browser pede página a página; o servidor faz o pedido (o site
 *     antigo não o permite de outro endereço). Só se usa o endereço fixo do site antigo (OLD_SITE_URL).
 */
export const oldSiteRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("products"), page: z.number().int().min(1).max(40) }),
  z.object({ kind: z.literal("collections"), page: z.number().int().min(1).max(10) }),
  z.object({ kind: z.literal("members"), handle: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/), page: z.number().int().min(1).max(40) }),
]);
export type OldSiteRequest = z.infer<typeof oldSiteRequestSchema>;

async function oldSiteJson(path: string): Promise<Record<string, unknown>> {
  const base = (process.env.OLD_SITE_URL || "https://eterna.co.mz").replace(/\/$/, "");
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(25_000), headers: { Accept: "application/json" }, cache: "no-store" });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new AppError("INTERNAL_ERROR", `O site antigo respondeu ${res.status}.`, 502);
    return (await res.json()) as Record<string, unknown>;
  }
  throw new AppError("INTERNAL_ERROR", "O site antigo está ocupado. Tente outra vez daqui a um minuto.", 502);
}

export async function readOldSite(input: OldSiteRequest) {
  const req = oldSiteRequestSchema.parse(input);
  if (req.kind === "collections") {
    const d = await oldSiteJson(`/collections.json?limit=250&page=${req.page}`);
    return { collections: ((d.collections as { handle: string; title: string }[]) ?? []).map((c) => ({ handle: c.handle, title: c.title })) };
  }
  if (req.kind === "members") {
    const d = await oldSiteJson(`/collections/${req.handle}/products.json?limit=250&page=${req.page}`);
    return { handles: ((d.products as { handle: string }[]) ?? []).map((p) => p.handle) };
  }
  const d = await oldSiteJson(`/products.json?limit=250&page=${req.page}`);
  const list = (d.products as OldProduct[]) ?? [];
  // EN: Only the fields the import uses. PT: Só os campos que a importação usa.
  return {
    products: list.map((p) => ({
      handle: p.handle,
      title: p.title,
      body_html: p.body_html,
      product_type: p.product_type,
      tags: p.tags,
      options: p.options.map((o) => ({ name: o.name, position: o.position })),
      variants: p.variants.map((v) => ({
        id: v.id,
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        available: v.available,
      })),
      images: p.images.map((i) => ({ src: i.src, position: i.position, variant_ids: i.variant_ids })),
    })),
  };
}
