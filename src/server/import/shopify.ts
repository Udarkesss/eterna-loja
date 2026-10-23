import "server-only";
import { and, eq, inArray, like, or } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { audit } from "../audit";
import { getDb } from "../db";
import { categories, productCategories, productImages, productVariants, products, stores } from "../db/schema";
import { AppError } from "../errors";
import { can, type StaffContext } from "../staff/access";
import { savePublicBuffer } from "../uploads";
import { COLOR_FAMILIES } from "@/types";

/**
 * EN: Saves products read from a Shopify export (src/lib/import/shopify.ts). The browser sends a few products at a
 *     time, so photo downloads never hit the server time limit. Safe to repeat:
 *     - new product → created with categories, sizes (stock and store chosen in the import screen) and photos;
 *     - product already imported (same Shopify handle) or with the same reference → price and missing sizes are
 *       updated, and gaps are filled (a more specific collection, missing categories, English text still equal to the
 *       Portuguese, photos if it has none); names, texts, status and photos edited by the team are kept.
 *     Photos are only downloaded from the Shopify CDN and the old eterna.co.mz storage (never any other address).
 * PT: Grava os produtos lidos de uma exportação do Shopify. O browser envia poucos produtos de cada vez, para as fotos
 *     nunca passarem o limite de tempo do servidor. Pode repetir-se:
 *     - produto novo → criado com categorias, tamanhos (stock e loja escolhidos no ecrã) e fotos;
 *     - produto já importado ou com a mesma referência → actualizam-se o preço e os tamanhos em falta e preenchem-se
 *       lacunas (colecção mais específica, categorias em falta, inglês ainda igual ao português, fotos se não tiver);
 *       nomes, textos, estado e fotos editados pela equipa ficam como estão.
 *     As fotos só se descarregam do CDN do Shopify e do armazenamento antigo do eterna.co.mz.
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
  links: z.array(z.string().max(60)).max(20),
  colors: z
    .array(z.object({ key: z.string().max(60), name: localized, hex: z.string().max(9).nullable(), family: z.enum(COLOR_FAMILIES).nullable() }))
    .max(40),
  variants: z.array(z.object({ sku: z.string().min(1).max(60), color: z.string().max(60).nullable(), size: z.string().min(1).max(40) })).min(1).max(80),
  images: z.array(z.object({ url: z.string().url().max(500), color: z.string().max(60).nullable() })).max(20),
  active: z.boolean(),
});
export const importBatchSchema = z.object({
  items: z.array(itemSchema).min(1).max(5),
  options: z.object({ publishActive: z.boolean(), stock: z.number().int().min(0).max(999), store: z.string().max(4) }),
});
export type ImportBatch = z.infer<typeof importBatchSchema>;

export interface ImportOutcome {
  code: string;
  result: "created" | "updated" | "failed";
  photos: number;
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

async function savePhotos(productId: string, slug: string, item: ImportBatch["items"][number]): Promise<number> {
  const db = await getDb();
  const saved = await Promise.all(
    item.images.map(async (img, i) => {
      try {
        const data = await fetchPhoto(img.url);
        const url = await savePublicBuffer(data, "products", `shopify-${slug}-${String(i + 1).padStart(2, "0")}.webp`, "image/webp");
        return { productId, url, color: img.color, position: i, alt: { pt: `${item.name.pt} · ${item.code}`, en: `${item.name.en} · ${item.code}` } };
      } catch {
        return null;
      }
    }),
  );
  const rows = saved.filter((r): r is NonNullable<typeof r> => !!r).map((r, position) => ({ ...r, position }));
  if (rows.length) await db.insert(productImages).values(rows);
  return rows.length;
}

export async function importShopifyBatch(staff: StaffContext, input: ImportBatch): Promise<ImportOutcome[]> {
  const { items, options } = importBatchSchema.parse(input);
  const db = await getDb();
  const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.code, options.store));
  if (!store) throw new AppError("VALIDATION_ERROR", "Loja desconhecida.", 400);
  const mayPublish = can(staff, "products.publish");
  const slugs = [...new Set(items.flatMap((i) => [i.type, i.collection, ...i.links]).filter((s): s is string => !!s))];
  const cats = slugs.length ? await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, slugs)) : [];
  const generic = cats.find((c) => c.slug === "beyond-time")?.id ?? null;
  const catId = (slug: string | null) => (slug ? (cats.find((c) => c.slug === slug)?.id ?? null) : null);

  // EN: Only pieces active on Shopify, with a price and at least one photo, go to the shop. PT: Só com preço e foto.
  const wantPublished = (item: ImportBatch["items"][number]) => item.active && options.publishActive && mayPublish && item.price > 0;
  const setStatus = async (id: string, publish: boolean, hasPhotos: boolean) => {
    if (publish && hasPhotos) await db.update(products).set({ status: "published" }).where(eq(products.id, id));
    else if (!hasPhotos) await db.update(products).set({ status: "draft" }).where(eq(products.id, id));
  };

  const out: ImportOutcome[] = [];
  for (const item of items) {
    const slug = item.code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      const [existing] = await db
        .select({ id: products.id, sourceId: products.sourceId, status: products.status, description: products.description, collectionId: products.collectionId })
        .from(products)
        .where(or(eq(products.sourceId, item.sourceId), eq(products.code, item.code), eq(products.slug, slug)));

      // EN: A product that did not come from Shopify (the design's sample pieces) is replaced by the Shopify version:
      //     texts, categories, sizes and photos. Orders keep their own copy of the line (variant links become null).
      // PT: Um produto que não veio do Shopify (as peças de exemplo do design) é substituído pela versão do Shopify:
      //     textos, categorias, tamanhos e fotos. As encomendas guardam a sua cópia da linha.
      const designPhotos = existing
        ? await db.select({ id: productImages.id }).from(productImages).where(and(eq(productImages.productId, existing.id), like(productImages.url, "/images/products/%"))).limit(1)
        : [];
      if (existing && (!existing.sourceId || designPhotos.length)) {
        await db.transaction(async (tx) => {
          await tx
            .update(products)
            .set({
              name: item.name,
              description: item.description,
              composition: null,
              price: item.price,
              salePrice: item.salePrice,
              colors: item.colors,
              typeId: catId(item.type),
              collectionId: catId(item.collection),
              sourceId: item.sourceId,
            })
            .where(eq(products.id, existing.id));
          await tx.delete(productCategories).where(eq(productCategories.productId, existing.id));
          await tx.delete(productVariants).where(eq(productVariants.productId, existing.id));
          await tx.delete(productImages).where(eq(productImages.productId, existing.id));
          const links = [...new Set([item.type, item.collection, ...item.links].map(catId).filter((x): x is string => !!x))];
          if (links.length) await tx.insert(productCategories).values(links.map((categoryId) => ({ productId: existing.id, categoryId })));
          for (const [position, v] of item.variants.entries()) {
            await tx
              .insert(productVariants)
              .values({ productId: existing.id, sku: v.sku, color: v.color, size: v.size, stock: options.stock, storeId: store.id, position })
              .onConflictDoNothing({ target: productVariants.sku });
          }
        });
        const photos = await savePhotos(existing.id, slug, item);
        await setStatus(existing.id, photos > 0 && wantPublished(item), photos > 0);
        out.push({ code: item.code, result: "updated", photos });
        continue;
      }

      if (existing) {
        // EN: Keep the team's work; refresh price and add sizes that are new on Shopify.
        // PT: Manter o trabalho da equipa; actualizar o preço e juntar tamanhos novos no Shopify.
        const betterCollection = catId(item.collection);
        await db.transaction(async (tx) => {
          await tx
            .update(products)
            .set({
              price: item.price || undefined,
              salePrice: item.salePrice,
              sourceId: existing.sourceId ?? item.sourceId,
              ...(existing.description.en === existing.description.pt ? { description: { ...existing.description, en: item.description.en } } : {}),
              ...(betterCollection && (!existing.collectionId || existing.collectionId === generic) ? { collectionId: betterCollection } : {}),
            })
            .where(eq(products.id, existing.id));
          const links = [...new Set([item.type, item.collection, ...item.links].map(catId).filter((x): x is string => !!x))];
          if (links.length) await tx.insert(productCategories).values(links.map((categoryId) => ({ productId: existing.id, categoryId }))).onConflictDoNothing();
          for (const [position, v] of item.variants.entries()) {
            await tx
              .insert(productVariants)
              .values({ productId: existing.id, sku: v.sku, color: v.color, size: v.size, stock: options.stock, storeId: store.id, position })
              .onConflictDoNothing({ target: productVariants.sku });
          }
        });
        const [hasPhoto] = await db.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, existing.id)).limit(1);
        const photos = hasPhoto ? 0 : await savePhotos(existing.id, slug, item);
        // EN: Publish drafts that are active on Shopify and have photos; never unpublish. PT: Publicar, nunca despublicar.
        if (existing.status === "draft" && wantPublished(item) && (hasPhoto || photos > 0)) await setStatus(existing.id, true, true);
        out.push({ code: item.code, result: "updated", photos });
        continue;
      }

      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(products)
          .values({
            slug,
            code: item.code,
            name: item.name,
            description: item.description,
            price: item.price,
            salePrice: item.salePrice,
            colors: item.colors,
            typeId: catId(item.type),
            collectionId: catId(item.collection),
            status: "draft",
            sourceId: item.sourceId,
          })
          .returning({ id: products.id });
        const links = [...new Set([item.type, item.collection, ...item.links].map(catId).filter((x): x is string => !!x))];
        if (links.length) await tx.insert(productCategories).values(links.map((categoryId) => ({ productId: row.id, categoryId })));
        for (const [position, v] of item.variants.entries()) {
          await tx
            .insert(productVariants)
            .values({ productId: row.id, sku: v.sku, color: v.color, size: v.size, stock: options.stock, storeId: store.id, position })
            .onConflictDoNothing({ target: productVariants.sku });
        }
        return row.id;
      });
      const photos = await savePhotos(id, slug, item);
      if (photos > 0 && wantPublished(item)) await setStatus(id, true, true);
      out.push({ code: item.code, result: "created", photos });
    } catch (e) {
      out.push({ code: item.code, result: "failed", photos: 0, message: e instanceof Error ? e.message.slice(0, 160) : "erro" });
    }
  }
  return out;
}

/** EN: One audit line per import run. PT: Uma linha de auditoria por importação. */
export async function auditImport(staff: StaffContext, summary: string) {
  await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Importação do Shopify", detail: summary.slice(0, 300) });
}
