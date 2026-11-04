import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { sizeParts } from "@/lib/sizes";
import type { CategoryDTO, CategorySummary, ColorFamily, Locale, ProductDTO, SearchSuggestionsDTO } from "@/types";
import { getDb } from "./db";
import { campaignPercents, campaignPrice } from "./campaigns";
import { discountSettings } from "./discounts";
import { categories, orderLines, orders, productCategories, productImages, products, productVariants } from "./db/schema";

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
    imageUrl: row.imageUrl,
    details: row.details
      ? {
          edition: row.details.edition?.[locale] ?? null,
          season: row.details.season?.[locale] ?? null,
          lines: row.details.lines ?? [],
          active: row.details.active ?? false,
        }
      : null,
    listing: row.details?.listing ?? null,
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

/**
 * EN: A category and everything under it. Bridal accessory types follow "onde aparecem" (Gestão · Tipos de peça):
 *     only in Noivas (default), only in Acessórios, or in both.
 * PT: Uma categoria e tudo o que está por baixo. Os acessórios de noiva seguem "onde aparecem": só Noivas (por
 *     defeito), só Acessórios, ou nos dois.
 */
function withDescendants(rootId: string, rows: CategoryRow[]): string[] {
  const root = rows.find((r) => r.id === rootId);
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++)
    for (const r of rows) if (r.parentId === ids[i] && !(r.kind === "type" && r.details?.showIn === "acessorios" && root?.slug !== r.slug)) ids.push(r.id);
  if (root?.slug === "acessorios") {
    for (const r of rows) if (r.kind === "type" && (r.details?.showIn === "acessorios" || r.details?.showIn === "both") && !ids.includes(r.id)) ids.push(r.id);
  }
  return ids;
}

// ── Products / Produtos ──────────────────────────────────────────────

export type ProductSort = "recommended" | "newest" | "price_asc" | "price_desc";

export interface ProductFilter {
  category?: string; // EN: includes sub-categories. PT: inclui subcategorias.
  types?: string[]; // EN: type slugs (chips "Vestidos longos", "Cocktail"). PT: slugs de tipo.
  sizes?: string[];
  sizeLetters?: string[]; // EN: "S", "M"… of sizes in stock (design V3 filter). PT: letras dos tamanhos em stock.
  onSale?: boolean; // EN: "Em campanha": with a sale price. PT: com preço de saldo/campanha.
  colors?: ColorFamily[];
  priceMax?: number;
  priceMin?: number;
  slugs?: string[];
  ids?: string[]; // EN: campaign pieces. PT: peças da campanha.
  isNew?: boolean;
  /** EN: Only pieces that can go to a bridal fitting (Gestão · Editar produto). PT: Só peças que podem ir a prova. */
  fitting?: boolean;
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

// ── Search / Pesquisa ────────────────────────────────────────────────

// EN: Lower case without accents, in SQL and in JS, so "cerimonia" finds "Cerimónia" and "8g1" finds "8G1".
// PT: Minúsculas sem acentos, em SQL e em JS, para "cerimonia" encontrar "Cerimónia" e "8g1" encontrar "8G1".
const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ";
const PLAIN = "aaaaaeeeeiiiiooooouuuuc".repeat(2);
const fold = (value: SQL) => sql`translate(lower(${value}), ${ACCENTED}, ${PLAIN})`;
const foldText = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOP_WORDS = new Set(["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "com", "para", "the", "and", "of", "for", "with"]);

/** EN: Words of a search, without small linking words, at most five. PT: Palavras de uma pesquisa, até cinco. */
function searchWords(search: string): string[] {
  const words = foldText(search.slice(0, 60)).split(/[\s,;/]+/).filter(Boolean);
  const kept = words.filter((w) => !STOP_WORDS.has(w));
  return (kept.length ? kept : words).slice(0, 5);
}

/**
 * EN: Search of design V3 ("Código, nome, cor ou ocasião"): every word must be in the code, the name, a colour, the
 *     type or a category of the piece (collection, occasion, department, with their sub-categories), in either
 *     language and ignoring accents. Undefined when there is nothing to look for.
 * PT: Pesquisa do V3: cada palavra tem de estar no código, no nome, numa cor, no tipo ou numa categoria da peça (com as
 *     subcategorias), em qualquer idioma e sem contar acentos. Indefinido quando não há nada para procurar.
 */
function searchCondition(search: string, rows: CategoryRow[]): SQL | undefined {
  const words = searchWords(search);
  if (!words.length) return undefined;
  const named = (r: CategoryRow) => foldText(`${r.name.pt} ${r.name.en} ${r.singular?.pt ?? ""} ${r.singular?.en ?? ""}`);
  return and(
    ...words.map((word) => {
      const like = `%${word.replace(/[%_\\]/g, "\\$&")}%`;
      const ids = [...new Set(rows.filter((r) => named(r).includes(word)).flatMap((r) => withDescendants(r.id, rows)))];
      const idList = sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      );
      const inName = (lang: "pt" | "en") => sql`${fold(sql`${products.name}->>${sql.raw(`'${lang}'`)}`)} like ${like}`;
      const inColor = sql`exists (select 1 from jsonb_array_elements(${products.colors}) c where ${fold(sql`c->'name'->>'pt'`)} like ${like} or ${fold(sql`c->'name'->>'en'`)} like ${like})`;
      return or(
        sql`${fold(sql`${products.code}`)} like ${like}`,
        inName("pt"),
        inName("en"),
        inColor,
        ...(ids.length
          ? [
              inArray(products.typeId, ids),
              sql`exists (select 1 from product_categories pc where pc.product_id = ${products.id} and pc.category_id in (${idList}))`,
            ]
          : []),
      )!;
    }),
  );
}

/** EN: The piece with that exact code first, then codes that start with it. PT: O código exacto primeiro. */
function byRelevance<T extends { code: string }>(list: T[], search: string): T[] {
  const q = foldText(search.trim());
  const score = (p: T) => (foldText(p.code) === q ? 0 : foldText(p.code).startsWith(q) ? 1 : 2);
  return list.map((p, i) => ({ p, i, s: score(p) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.p);
}

async function queryProducts(where: SQL | undefined, sort: ProductSort = "recommended", limit?: number, offset?: number) {
  const db = await getDb();
  const orderBy =
    sort === "price_asc"
      ? [asc(products.price)]
      : sort === "price_desc"
        ? [desc(products.price)]
        : sort === "newest"
          ? [desc(products.createdAt)]
          : [desc(products.isNew), desc(products.createdAt)];
  const rows = await db.query.products.findMany({
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
  // EN: "Saldo numa peça" switched off (Gestão · Descontos): no struck-through prices. PT: Saldo desligado: sem preço riscado.
  // EN: Running campaigns: the larger discount of sale and campaign. PT: Campanhas a decorrer: o maior entre saldo e campanha.
  const [{ sale }, percents] = await Promise.all([discountSettings(), campaignPercents()]);
  return rows.map((r) => {
    const own = sale ? r.salePrice : null;
    const pct = percents.get(r.id);
    const camp = pct ? campaignPrice(r.price, pct) : null;
    const best = own != null && camp != null ? Math.min(own, camp) : (own ?? camp);
    return best === r.salePrice ? r : { ...r, salePrice: best };
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
    // EN: Bridal accessory types set to "Só Acessórios" leave the bridal pages (also pieces linked there directly).
    // PT: Acessórios de noiva em "Só Acessórios" saem das páginas de noivas (também peças ligadas lá directamente).
    const under = (r: CategoryRow) => {
      for (let p = r.parentId; p; p = rows.find((x) => x.id === p)?.parentId ?? null) if (p === root.id) return true;
      return false;
    };
    const away = rows.filter((r) => r.kind === "type" && r.details?.showIn === "acessorios" && r.id !== root.id && under(r)).map((r) => r.id);
    if (away.length) conditions.push(or(isNull(products.typeId), notInArray(products.typeId, away))!);
  }
  if (filter.fitting) conditions.push(eq(products.fitting, true));
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
  if (filter.ids) {
    if (!filter.ids.length) return [];
    conditions.push(inArray(products.id, filter.ids));
  }
  if (filter.slugs) {
    if (!filter.slugs.length) return [];
    conditions.push(inArray(products.slug, filter.slugs));
  }
  if (filter.isNew !== undefined) conditions.push(eq(products.isNew, filter.isNew));
  if (filter.search !== undefined) {
    const found = searchCondition(filter.search, rows);
    if (!found) return [];
    conditions.push(found);
  }

  let list = (await queryProducts(and(...conditions), filter.sort, filter.limit, filter.offset)).map((r) =>
    toProductDTO(r, locale),
  );
  if (filter.search && (filter.sort ?? "recommended") === "recommended") list = byRelevance(list, filter.search);

  // EN: Filters on jsonb/derived values are applied here. PT: Filtros sobre jsonb/valores derivados aplicados aqui.
  if (filter.colors?.length) list = list.filter((p) => p.colors.some((c) => c.family && filter.colors!.includes(c.family)));
  if (filter.sizeLetters?.length) {
    list = list.filter((p) => p.variants.some((v) => v.stock > 0 && filter.sizeLetters!.includes(sizeParts(v.size).letter)));
  }
  if (filter.onSale) list = list.filter((p) => p.salePrice != null && p.salePrice < p.price);
  if (filter.priceMin !== undefined) list = list.filter((p) => (p.salePrice ?? p.price) >= filter.priceMin!);
  if (filter.priceMax !== undefined) list = list.filter((p) => (p.salePrice ?? p.price) <= filter.priceMax!);
  return list;
}

/**
 * EN: Suggestions while typing (design V3 "Pesquisa"): collections and occasions, piece types with how many pieces and
 *     the first three pieces, from the same search as the results page but without loading every piece.
 * PT: Sugestões enquanto escreve: colecções e ocasiões, tipos de peça com o número de peças e as três primeiras peças,
 *     com a mesma pesquisa da página de resultados mas sem carregar as peças todas.
 */
export async function searchSuggestions(search: string, locale: Locale): Promise<SearchSuggestionsDTO> {
  const rows = await loadCategories();
  const where = searchCondition(search, rows);
  if (!where) return { total: 0, places: [], types: [], products: [] };
  const db = await getDb();
  const [{ sale }, percents] = await Promise.all([discountSettings(), campaignPercents()]);
  const found = byRelevance(
    await db
      .select({
        id: products.id,
        slug: products.slug,
        code: products.code,
        typeId: products.typeId,
        collectionId: products.collectionId,
        price: products.price,
        salePrice: products.salePrice,
      })
      .from(products)
      .where(and(visibleCondition(), where))
      .orderBy(desc(products.isNew), desc(products.createdAt)),
    search,
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ranked = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1]);
  const add = (counts: Map<string, number>, id: string | null) => id && counts.set(id, (counts.get(id) ?? 0) + 1);

  const typeCounts = new Map<string, number>();
  for (const p of found) add(typeCounts, p.typeId);
  const types = ranked(typeCounts)
    .slice(0, 4)
    .flatMap(([id, count]) => {
      const r = byId.get(id);
      return r ? [{ slug: r.slug, name: r.name[locale], count }] : [];
    });

  // EN: Collections and occasions of the pieces; categories named like the search come first.
  // PT: Colecções e ocasiões das peças; as categorias com o nome pesquisado vêm primeiro.
  const links = found.length
    ? await db
        .select({ productId: productCategories.productId, categoryId: productCategories.categoryId })
        .from(productCategories)
        .where(inArray(productCategories.productId, found.map((p) => p.id)))
    : [];
  const placeCounts = new Map<string, number>();
  for (const p of found) {
    const ids = new Set([p.collectionId, ...links.filter((l) => l.productId === p.id).map((l) => l.categoryId)]);
    for (const id of ids) add(placeCounts, id);
  }
  const words = searchWords(search);
  const named = rows.filter((r) => r.kind !== "type" && words.every((w) => foldText(`${r.name.pt} ${r.name.en}`).includes(w)));
  const counted = ranked(placeCounts).flatMap(([id]) => {
    const r = byId.get(id);
    return r && (r.kind === "collection" || r.kind === "occasion") ? [r] : [];
  });
  const places = [...new Map([...named, ...counted].map((r) => [r.id, r])).values()]
    .slice(0, 4)
    .map((r) => ({ slug: r.slug, name: r.name[locale] }));

  const first = found.slice(0, 3);
  const images = first.length
    ? await db
        .select({ productId: productImages.productId, url: productImages.url })
        .from(productImages)
        .where(inArray(productImages.productId, first.map((p) => p.id)))
        .orderBy(asc(productImages.position))
    : [];

  return {
    total: found.length,
    places,
    types,
    products: first.map((p) => {
      const type = p.typeId ? byId.get(p.typeId) : undefined;
      return {
        slug: p.slug,
        code: p.code,
        type: type ? (type.singular ?? type.name)[locale] : null,
        price: p.price,
        salePrice: (() => {
          const own = sale ? p.salePrice : null;
          const camp = percents.get(p.id) ? campaignPrice(p.price, percents.get(p.id)!) : null;
          return own != null && camp != null ? Math.min(own, camp) : (own ?? camp);
        })(),
        image: images.find((i) => i.productId === p.id)?.url ?? null,
      };
    }),
  };
}

/** EN: Slugs are lower-case codes; "8G1L7" and "8g1l7" find the same product. PT: O mesmo produto nos dois casos. */
export async function findProduct(slug: string, locale: Locale): Promise<ProductDTO | null> {
  const [row] = await queryProducts(and(eq(products.slug, slug.toLowerCase()), visibleCondition()), "recommended", 1);
  return row ? toProductDTO(row, locale) : null;
}

/**
 * EN: "Complete o look" (design V3): other pieces of the same line (the type's group), same collection first and other
 *     types before the same type, so the suggestions complete the outfit.
 * PT: "Complete o look": outras peças da mesma linha, primeiro da mesma colecção e de outros tipos.
 */
export async function relatedProducts(product: ProductDTO, locale: Locale, limit = 4): Promise<ProductDTO[]> {
  const rows = await loadCategories();
  const type = product.type ? rows.find((r) => r.slug === product.type!.slug) : undefined;
  const line = type?.parentId ? rows.find((r) => r.id === type.parentId)?.slug : undefined;
  const pool = (await listProducts({ category: line ?? product.occasions[0]?.slug }, locale)).filter((p) => p.id !== product.id);
  const score = (p: ProductDTO) => (p.collection?.slug === product.collection?.slug ? 0 : 2) + (p.type?.slug === product.type?.slug ? 1 : 0);
  return pool.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

export function effectivePrice(product: Pick<ProductDTO, "price" | "salePrice">): number {
  return product.salePrice ?? product.price;
}

/**
 * EN: The active seasonal collection (Gestão → Colecções → "Activar"): menu label, hero button, home "Colecção"
 *     section and "entrada" message follow it.
 * PT: A colecção sazonal activa (Gestão → Colecções → "Activar"): o menu, o botão do hero, a secção "Colecção" e a
 *     mensagem da entrada seguem-na.
 */
export async function activeCollection(locale: Locale): Promise<(CategoryDTO & { message: string | null; buttonText: string | null; buttonLink: string | null }) | null> {
  const rows = await loadCategories();
  const row = rows.find((r) => r.kind === "collection" && !r.parentId && r.details?.active && !r.details?.history);
  if (!row) return null;
  return {
    ...toCategoryDTO(row, rows, locale),
    message: row.details?.message?.[locale] ?? null,
    buttonText: row.details?.buttonText?.[locale] ?? null,
    buttonLink: row.details?.buttonLink && row.details.buttonLink !== "auto" ? row.details.buttonLink : null,
  };
}

/** EN: Every seasonal collection slug (to swap old links for the active one). PT: Slugs das colecções sazonais. */
export async function seasonalSlugs(): Promise<string[]> {
  const rows = await loadCategories();
  return rows.filter((r) => r.kind === "collection" && (!r.parentId || rows.find((x) => x.id === r.parentId)?.kind === "collection")).map((r) => r.slug);
}

/** EN: Units sold per product (paid, not cancelled orders). PT: Unidades vendidas por peça. */
export async function bestsellerCounts(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ id: orderLines.productId, n: sql<number>`sum(${orderLines.quantity})` })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .where(and(eq(orders.paymentStatus, "paid"), eq(orders.kind, "purchase")))
    .groupBy(orderLines.productId);
  return new Map(rows.filter((r) => r.id).map((r) => [r.id!, Number(r.n)]));
}
