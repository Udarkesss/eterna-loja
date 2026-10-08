import "server-only";
import { and, asc, desc, eq, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import type { CategoryDTO, CategorySummary, ColorFamily, Locale, ProductDTO } from "@/types";
import { getDb } from "./db";
import { categories, productCategories, products, productVariants } from "./db/schema";

/**
 * EN: Catalog reads. Pages and the API only use the functions here, never the tables directly,
 *     so caching or a search engine can be added later without touching the pages.
 * PT: Leituras do catálogo. As páginas e a API só usam estas funções, nunca as tabelas,
 *     por isso uma cache ou um motor de pesquisa podem ser juntados mais tarde sem mexer nas páginas.
 */

type CategoryRow = typeof categories.$inferSelect;

// ── Categories / Categorias ──────────────────────────────────────────

/** EN: All categories, read once per request. PT: Todas as categorias, lidas uma vez por pedido. */
const loadCategories = cache(async (): Promise<CategoryRow[]> => {
  const db = await getDb();
  return db.select().from(categories).orderBy(asc(categories.position));
});

function toCategoryDTO(row: CategoryRow, rows: CategoryRow[], locale: Locale): CategoryDTO {
  const parent = row.parentId ? rows.find((r) => r.id === row.parentId) : undefined;
  return {
    slug: row.slug,
    kind: row.kind,
    name: row.name[locale],
    description: row.description?.[locale] ?? null,
    parent: parent ? { slug: parent.slug, name: parent.name[locale] } : null,
    children: rows.filter((r) => r.parentId === row.id).map((child) => toCategoryDTO(child, rows, locale)),
  };
}

export async function getCategoryTree(locale: Locale): Promise<CategoryDTO[]> {
  const rows = await loadCategories();
  return rows.filter((r) => !r.parentId).map((r) => toCategoryDTO(r, rows, locale));
}

export async function findCategory(slug: string, locale: Locale): Promise<CategoryDTO | null> {
  const rows = await loadCategories();
  const row = rows.find((r) => r.slug === slug);
  return row ? toCategoryDTO(row, rows, locale) : null;
}

/** EN: Occasion categories (footer, product editor). PT: Categorias de ocasião (rodapé, editor de produto). */
export async function listOccasions(locale: Locale): Promise<CategorySummary[]> {
  const rows = await loadCategories();
  return rows.filter((r) => r.kind === "occasion").map((r) => ({ slug: r.slug, name: r.name[locale] }));
}

function withDescendants(rootId: string, rows: CategoryRow[]): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) for (const r of rows) if (r.parentId === ids[i]) ids.push(r.id);
  return ids;
}

// ── Products / Produtos ──────────────────────────────────────────────

export type ProductSort = "recommended" | "price_asc" | "price_desc";

export interface ProductFilter {
  category?: string; // EN: includes sub-categories. PT: inclui subcategorias.
  types?: string[]; // EN: type slugs (chips "Vestidos longos", "Cocktail"). PT: slugs de tipo.
  sizes?: string[];
  colors?: ColorFamily[];
  priceMax?: number;
  priceMin?: number;
  slugs?: string[];
  isNew?: boolean;
  search?: string;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
}

/**
 * EN: Published (or scheduled with the date reached) and with at least one photo (design: products without a photo
 *     do not appear in the store).
 * PT: Publicado (ou agendado com a data atingida) e com pelo menos uma fotografia (design: sem foto não aparece).
 */
function visibleCondition(): SQL {
  return and(
    or(eq(products.status, "published"), and(eq(products.status, "scheduled"), lte(products.publishAt, new Date()))),
    sql`exists (select 1 from product_images pi where pi.product_id = ${products.id})`,
  )!;
}

async function queryProducts(where: SQL | undefined, sort: ProductSort = "recommended", limit?: number, offset?: number) {
  const db = await getDb();
  const orderBy =
    sort === "price_asc"
      ? [asc(products.price)]
      : sort === "price_desc"
        ? [desc(products.price)]
        : [desc(products.isNew), desc(products.createdAt)];
  return db.query.products.findMany({
    where,
    limit,
    offset,
    orderBy,
    with: {
      type: true,
      collection: true,
      categories: { with: { category: true } },
      variants: { orderBy: (v, o) => [o.asc(v.position)], with: { store: true } },
      images: { orderBy: (i, o) => [o.asc(i.position)] },
    },
  });
}

type ProductRow = Awaited<ReturnType<typeof queryProducts>>[number];

export function toProductDTO(row: ProductRow, locale: Locale): ProductDTO {
  const name = row.name[locale];
  return {
    id: row.id,
    slug: row.slug,
    code: row.code,
    name,
    description: row.description[locale],
    composition: row.composition?.[locale] ?? null,
    price: row.price,
    salePrice: row.salePrice,
    isNew: row.isNew,
    type: row.type ? { slug: row.type.slug, name: (row.type.singular ?? row.type.name)[locale] } : null,
    collection: row.collection ? { slug: row.collection.slug, name: row.collection.name[locale] } : null,
    occasions: row.categories
      .filter((pc) => pc.category.kind === "occasion")
      .map((pc) => ({ slug: pc.category.slug, name: pc.category.name[locale] })),
    colors: row.colors.map((c) => ({ key: c.key, name: c.name[locale], hex: c.hex, family: c.family })),
    images: row.images.map((img) => ({ url: img.url, alt: img.alt?.[locale] ?? name, color: img.color })),
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      stock: v.stock,
      store: v.store ? { code: v.store.code, name: v.store.name } : null,
    })),
    stock: row.variants.reduce((sum, v) => sum + v.stock, 0),
  };
}

export async function listProducts(filter: ProductFilter, locale: Locale): Promise<ProductDTO[]> {
  const db = await getDb();
  const rows = await loadCategories();
  const conditions: SQL[] = [visibleCondition()];

  const inCategories = (ids: string[]) =>
    inArray(
      products.id,
      db.select({ id: productCategories.productId }).from(productCategories).where(inArray(productCategories.categoryId, ids)),
    );

  if (filter.category) {
    const root = rows.find((r) => r.slug === filter.category);
    if (!root) return [];
    conditions.push(inCategories(withDescendants(root.id, rows)));
  }
  if (filter.types?.length) {
    const ids = rows.filter((r) => filter.types!.includes(r.slug)).map((r) => r.id);
    if (!ids.length) return [];
    conditions.push(inArray(products.typeId, ids));
  }
  if (filter.sizes?.length) {
    conditions.push(
      inArray(products.id, db.select({ id: productVariants.productId }).from(productVariants).where(inArray(productVariants.size, filter.sizes))),
    );
  }
  if (filter.slugs) {
    if (!filter.slugs.length) return [];
    conditions.push(inArray(products.slug, filter.slugs));
  }
  if (filter.isNew !== undefined) conditions.push(eq(products.isNew, filter.isNew));
  if (filter.search) {
    const q = `%${filter.search.trim()}%`;
    // EN: Code or name in any language. PT: Código ou nome em qualquer idioma.
    conditions.push(or(ilike(products.code, q), ilike(sql`${products.name}->>'pt'`, q), ilike(sql`${products.name}->>'en'`, q))!);
  }

  let list = (await queryProducts(and(...conditions), filter.sort, filter.limit, filter.offset)).map((r) =>
    toProductDTO(r, locale),
  );

  // EN: Filters on jsonb/derived values are applied here. PT: Filtros sobre jsonb/valores derivados aplicados aqui.
  if (filter.colors?.length) list = list.filter((p) => p.colors.some((c) => c.family && filter.colors!.includes(c.family)));
  if (filter.priceMin !== undefined) list = list.filter((p) => (p.salePrice ?? p.price) >= filter.priceMin!);
  if (filter.priceMax !== undefined) list = list.filter((p) => (p.salePrice ?? p.price) <= filter.priceMax!);
  return list;
}

/** EN: Slugs are lower-case codes; "8G1L7" and "8g1l7" find the same product. PT: O mesmo produto nos dois casos. */
export async function findProduct(slug: string, locale: Locale): Promise<ProductDTO | null> {
  const [row] = await queryProducts(and(eq(products.slug, slug.toLowerCase()), visibleCondition()), "recommended", 1);
  return row ? toProductDTO(row, locale) : null;
}

/** EN: "Também pode gostar": same occasion first, then the rest. PT: Mesma ocasião primeiro. */
export async function relatedProducts(product: ProductDTO, locale: Locale, limit = 4): Promise<ProductDTO[]> {
  const occasion = product.occasions[0]?.slug;
  const pool = await listProducts({ category: occasion }, locale);
  return pool.filter((p) => p.id !== product.id).slice(0, limit);
}

export function effectivePrice(product: Pick<ProductDTO, "price" | "salePrice">): number {
  return product.salePrice ?? product.price;
}
