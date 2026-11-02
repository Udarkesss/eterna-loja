import type { ReactNode } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary, t } from "@/i18n";
import { PRICE_RANGES, SIZE_LETTERS, type PriceRange } from "@/lib/filters";
import { findCategory, listProducts, type ProductFilter, type ProductSort } from "@/server/catalog";
import { cardPriceVisible } from "@/server/content";
import { COLOR_FAMILIES, type ColorFamily, type Locale, type ProductDTO } from "@/types";
import { CategoryEmpty } from "./CategoryControls";
import type { TypeTile } from "./TypeBar";
import styles from "./Category.module.css";

export type Query = Record<string, string | string[] | undefined>;

/** EN: What a listing shows and where its links go. PT: O que uma listagem mostra e para onde vão as ligações. */
export interface ListingSource {
  filter: Pick<ProductFilter, "category" | "search">; // EN: a category (with sub-categories) or a search. PT: categoria ou pesquisa.
  path: string; // EN: page address without parameters. PT: endereço da página sem parâmetros.
  keep?: string[]; // EN: parameters the type links keep (?linha=, ?q=). PT: parâmetros mantidos nas ligações dos tipos.
  types?: string[]; // EN: only these types (one line of a collection). PT: só estes tipos (linha de uma colecção).
}

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ["recommended", "newest", "price_asc", "price_desc"];

const list = (v: string | string[] | undefined) => (typeof v === "string" ? v.split(",").filter(Boolean) : []);

/** EN: Price checkboxes are OR-ed together. PT: As caixas de preço combinam-se com "ou". */
function inPriceRanges(product: ProductDTO, ranges: PriceRange[]): boolean {
  if (!ranges.length) return true;
  const price = product.salePrice ?? product.price;
  return ranges.some((r) => (r === "upTo15" ? price <= 15000 : r === "from15to30" ? price > 15000 && price <= 30000 : price > 30000));
}

/**
 * EN: Products of a category or a search with the filters from the address, and the type bar ("Todos" + the types
 *     that have pieces here). Used by the category, collection and search pages.
 * PT: Produtos de uma categoria ou de uma pesquisa com os filtros do endereço, e a barra de tipos ("Todos" + os tipos
 *     com peças aqui). Usado nas páginas de categoria, colecção e pesquisa.
 */
export async function loadListing(source: ListingSource, query: Query, locale: Locale) {
  const dict = getDictionary(locale);
  const allowedTypes = source.types;
  const sizeLetters = list(query.size).filter((s) => (SIZE_LETTERS as readonly string[]).includes(s));
  const colors = list(query.color).filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c));
  const prices = list(query.price).filter((p): p is PriceRange => (PRICE_RANGES as readonly string[]).includes(p));
  const onSale = query.sale === "1";
  const type = typeof query.type === "string" && (!allowedTypes || allowedTypes.includes(query.type)) ? query.type : undefined;
  const sort = SORTS.find((s) => s === query.sort) ?? "recommended";
  const shown = Math.max(PAGE_SIZE, Number(query.n) || PAGE_SIZE);
  const types = type ? [type] : allowedTypes;

  const [all, showPrice] = await Promise.all([listProducts({ ...source.filter, types: allowedTypes }, locale), cardPriceVisible()]);
  // EN: Without filters the list is the same: no second read. PT: Sem filtros a lista é a mesma: sem segunda leitura.
  const plain = !type && !sizeLetters.length && !colors.length && !onSale && sort === "recommended";
  const filtered = (plain ? all : await listProducts({ ...source.filter, types, sizeLetters, colors, onSale, sort }, locale)).filter((p) =>
    inPriceRanges(p, prices),
  );

  const link = (q: URLSearchParams) => `${source.path}${q.size ? `?${q}` : ""}`;
  const typeLink = (s?: string) => {
    const q = new URLSearchParams();
    for (const k of source.keep ?? []) if (typeof query[k] === "string") q.set(k, query[k] as string);
    if (s) q.set("type", s);
    return link(q);
  };
  const byType = new Map<string, string | undefined>();
  for (const p of all) if (p.type && !byType.has(p.type.slug)) byType.set(p.type.slug, p.images[0]?.url);
  const typeCats = await Promise.all([...byType.keys()].map((s) => findCategory(s, locale)));
  const tiles: TypeTile[] = [
    { href: typeLink(), label: dict.catalog.all, images: all.slice(0, 4).flatMap((p) => (p.images[0] ? [p.images[0].url] : [])), current: !type },
    ...[...byType.entries()].map(([s, image], i) => {
      const c = typeCats[i];
      const photo = c?.imageUrl ?? image;
      return { href: typeLink(s), label: c?.name ?? s, images: photo ? [photo] : [], current: type === s };
    }),
  ];
  const moreLink = () => {
    const q = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"));
    q.set("n", String(shown + PAGE_SIZE));
    return link(q);
  };
  return { all, filtered, shown, tiles, moreLink, showPrice };
}

/**
 * EN: The grid, "A ver 12 de 51 peças" with its progress line and "Mostrar mais peças". `empty` replaces the default
 *     text when there are no pieces at all (not just none with the chosen filters).
 * PT: A grelha, "A ver 12 de 51 peças" com a linha de progresso e "Mostrar mais peças". `empty` substitui o texto
 *     quando não há peças nenhumas (e não só com os filtros escolhidos).
 */
export function Results({
  listing,
  locale,
  columns,
  empty,
}: {
  listing: Awaited<ReturnType<typeof loadListing>>;
  locale: Locale;
  columns: 3 | 4;
  empty?: ReactNode;
}) {
  const dict = getDictionary(locale);
  const { all, filtered, shown, moreLink, showPrice } = listing;
  if (filtered.length === 0) return all.length === 0 ? (empty ?? <p className={styles.description}>{dict.catalog.noProducts}</p>) : <CategoryEmpty />;
  return (
    <>
      <ProductGrid products={filtered.slice(0, shown)} locale={locale} columns={columns} showPrice={showPrice} />
      <div className={styles.more}>
        <span className={styles.count}>{t(dict.catalog.showing, { shown: Math.min(shown, filtered.length), total: filtered.length })}</span>
        <span className={styles.progress} aria-hidden="true">
          <span style={{ width: `${Math.round((Math.min(shown, filtered.length) / filtered.length) * 100)}%` }} />
        </span>
        {shown < filtered.length && (
          <ButtonLink href={moreLink()} variant="outline" scroll={false}>
            {dict.catalog.showMore}
          </ButtonLink>
        )}
      </div>
    </>
  );
}
