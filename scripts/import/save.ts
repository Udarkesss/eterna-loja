import { mkdir } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import type { Database } from "../../src/server/db/client";
import { categories, productCategories, productImages, productVariants, products, stores } from "../../src/server/db/schema";
import type { Localized, ProductColor } from "../../src/types";

/**
 * EN: Source-independent import: any adapter (Nexsory API, spreadsheet, …) produces ImportedProduct
 *     objects and this file saves them. Re-running updates products by `sourceId`, never duplicates them.
 * PT: Importação independente da origem: qualquer adaptador (API Nexsory, folha de cálculo, …) produz
 *     objectos ImportedProduct e este ficheiro grava-os. Voltar a correr actualiza pelo `sourceId`, sem duplicar.
 */

export interface ImportedProduct {
  sourceId: string; // e.g. "nexsory:895f9998-…"
  code: string; // e.g. "9J253"
  name: Localized;
  description: Localized;
  price: number;
  salePrice: number | null;
  type: string | null; // EN: type slug, e.g. "vestidos-cocktail". PT: slug do tipo.
  collection: string | null; // e.g. "beyond-time"
  occasions: string[]; // e.g. ["convidada", "gala"]
  colors: ProductColor[];
  variants: { sku: string; color: string | null; size: string; stock: number; store: string }[];
  images: { sourceUrl: string; color: string | null; alt: Localized }[];
  published: boolean;
}

const IMAGE_ROOT = path.join(process.cwd(), "public", "images", "products");
const MAX_WIDTH = 1600; // EN: enough for retina product pages. PT: suficiente para ecrãs retina.

/**
 * EN: Downloads a photo and stores it as WebP (≈10× smaller than PNG). Returns its public URL.
 * PT: Descarrega uma fotografia e guarda-a em WebP (≈10× mais leve que PNG). Devolve o endereço público.
 */
export async function downloadImage(sourceUrl: string, slug: string, index: number): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Image ${response.status}: ${sourceUrl}`);
  const input = Buffer.from(await response.arrayBuffer());

  const folder = path.join(IMAGE_ROOT, slug);
  await mkdir(folder, { recursive: true });
  const fileName = `${String(index + 1).padStart(2, "0")}.webp`;
  await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(folder, fileName));
  return `/images/products/${slug}/${fileName}`;
}

export async function saveProduct(db: Database, item: ImportedProduct, options: { downloadImages: boolean }) {
  const slug = item.code.toLowerCase();
  const wanted = [item.type, item.collection, ...item.occasions].filter((x): x is string => !!x);
  const catRows = wanted.length
    ? await db.select({ id: categories.id, slug: categories.slug }).from(categories).where(inArray(categories.slug, wanted))
    : [];
  const idOf = (s: string | null) => (s ? (catRows.find((r) => r.slug === s)?.id ?? null) : null);
  const storeRows = await db.select({ id: stores.id, code: stores.code }).from(stores);

  const values = {
    slug,
    code: item.code,
    name: item.name,
    description: item.description,
    price: item.price,
    salePrice: item.salePrice,
    colors: item.colors,
    typeId: idOf(item.type),
    collectionId: idOf(item.collection),
    status: item.published ? ("published" as const) : ("archived" as const),
    sourceId: item.sourceId,
  };
  const [row] = await db
    .insert(products)
    .values(values)
    .onConflictDoUpdate({ target: products.sourceId, set: values })
    .returning({ id: products.id });

  // EN: Replace links, keep variant ids stable (orders point to them). PT: Substituir ligações, manter ids das variantes.
  await db.delete(productCategories).where(eq(productCategories.productId, row.id));
  const links = [...new Set(wanted.map(idOf).filter((id): id is string => !!id))];
  if (links.length) await db.insert(productCategories).values(links.map((categoryId) => ({ productId: row.id, categoryId })));

  for (const [position, v] of item.variants.entries()) {
    const variant = {
      productId: row.id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      stock: v.stock,
      storeId: storeRows.find((st) => st.code === v.store)?.id ?? null,
      position,
    };
    await db.insert(productVariants).values(variant).onConflictDoUpdate({ target: productVariants.sku, set: variant });
  }

  if (options.downloadImages) {
    await db.delete(productImages).where(eq(productImages.productId, row.id));
    for (const [index, image] of item.images.entries()) {
      try {
        const url = await downloadImage(image.sourceUrl, slug, index);
        await db.insert(productImages).values({ productId: row.id, url, color: image.color, alt: image.alt, position: index });
      } catch (error) {
        console.warn(`  ! ${item.code}: ${(error as Error).message}`);
      }
    }
  }

  return { id: row.id, slug, missingCategories: wanted.filter((w) => !catRows.some((r) => r.slug === w)) };
}
