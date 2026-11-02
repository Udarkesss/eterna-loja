import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryEmpty, CategoryFilters, CategoryToolbar, HelpBox } from "@/components/category/CategoryControls";
import styles from "@/components/category/Category.module.css";
import { TypeBar, type TypeTile } from "@/components/category/TypeBar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import { PRICE_RANGES, SIZE_LETTERS, type PriceRange } from "@/lib/filters";
import { categoryHref } from "@/lib/links";
import { findCategory, listProducts, type ProductSort } from "@/server/catalog";
import { cardPriceVisible } from "@/server/content";
import { COLOR_FAMILIES, type CategoryDTO, type ColorFamily, type Locale, type ProductDTO } from "@/types";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
type Query = Record<string, string | string[] | undefined>;

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ["recommended", "newest", "price_asc", "price_desc"];

const list = (v: string | string[] | undefined) => (typeof v === "string" ? v.split(",").filter(Boolean) : []);

/** EN: Price checkboxes are OR-ed together. PT: As caixas de preço combinam-se com "ou". */
function inPriceRanges(product: ProductDTO, ranges: PriceRange[]): boolean {
  if (!ranges.length) return true;
  const price = product.salePrice ?? product.price;
  return ranges.some((r) => (r === "upTo15" ? price <= 15000 : r === "from15to30" ? price > 15000 && price <= 30000 : price > 30000));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const category = await findCategory((await params).slug, locale);
  return category ? { title: category.name, description: category.description ?? undefined } : {};
}

/**
 * EN: Products of a category (or of one line of a collection) with the filters from the address, and the type bar.
 * PT: Produtos de uma categoria (ou de uma linha de uma colecção) com os filtros do endereço, e a barra de tipos.
 */
async function loadListing(slug: string, query: Query, locale: Locale, allowedTypes?: string[]) {
  const dict = getDictionary(locale);
  const sizeLetters = list(query.size).filter((s) => (SIZE_LETTERS as readonly string[]).includes(s));
  const colors = list(query.color).filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c));
  const prices = list(query.price).filter((p): p is PriceRange => (PRICE_RANGES as readonly string[]).includes(p));
  const onSale = query.sale === "1";
  const type = typeof query.type === "string" && (!allowedTypes || allowedTypes.includes(query.type)) ? query.type : undefined;
  const sort = SORTS.find((s) => s === query.sort) ?? "recommended";
  const shown = Math.max(PAGE_SIZE, Number(query.n) || PAGE_SIZE);
  const types = type ? [type] : allowedTypes;

  const [all, showPrice] = await Promise.all([listProducts({ category: slug, types: allowedTypes }, locale), cardPriceVisible()]);
  const filtered = (await listProducts({ category: slug, types, sizeLetters, colors, onSale, sort }, locale)).filter((p) => inPriceRanges(p, prices));

  // EN: Type bar: "Todos" + the types that have pieces here. PT: "Todos" + os tipos com peças aqui.
  const keep = (q: URLSearchParams) => {
    for (const k of ["linha"]) if (typeof query[k] === "string") q.set(k, query[k] as string);
    return q;
  };
  const typeLink = (s?: string) => {
    const q = keep(new URLSearchParams());
    if (s) q.set("type", s);
    return `${categoryHref(slug, locale)}${q.size ? `?${q}` : ""}`;
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
    return `${categoryHref(slug, locale)}?${q}`;
  };
  return { all, filtered, shown, tiles, moreLink, showPrice };
}

function Results({
  listing,
  locale,
  columns,
}: {
  listing: Awaited<ReturnType<typeof loadListing>>;
  locale: Locale;
  columns: 3 | 4;
}) {
  const dict = getDictionary(locale);
  const { all, filtered, shown, moreLink, showPrice } = listing;
  if (filtered.length === 0) return all.length === 0 ? <p className={styles.description}>{dict.catalog.noProducts}</p> : <CategoryEmpty />;
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

/**
 * EN: Category page of design V3 ("Loja · Categoria com barra de tipos"): crumbs, title, circular type bar, filters
 *     bar, side filters and a 3-column grid. A collection with lines (Essenza) uses the collection page instead.
 * PT: Página de categoria do V3: caminho, título, barra de tipos em círculo, barra de filtros, filtros laterais e
 *     grelha de 3 colunas. Uma colecção com linhas (Essenza) usa a página da colecção.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const query = await searchParams;
  const category = await findCategory(slug, locale);
  if (!category) notFound();
  if (category.kind === "collection" && category.details?.lines.length) return <CollectionPage category={category} query={query} locale={locale} />;
  const dict = getDictionary(locale);
  const listing = await loadListing(slug, query, locale);

  return (
    <>
      <section className={`page-x ${styles.head}`}>
        <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
          <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
          {category.parent && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={categoryHref(category.parent.slug, locale)}>{category.parent.name}</Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{category.name}</span>
        </nav>
        <div className={styles.titleBox}>
          {category.parent && <span className="eyebrow">{category.parent.name}</span>}
          <h1 className={styles.title}>{category.name}</h1>
          {category.description && <p className={styles.description}>{category.description}</p>}
        </div>
        <TypeBar tiles={listing.tiles} label={dict.catalog.types} />
      </section>

      <CategoryToolbar total={listing.filtered.length} />

      <section className={`page-x ${styles.body}`}>
        <CategoryFilters />
        <div className={styles.results}>
          <Results listing={listing} locale={locale} columns={3} />
          <div className={styles.phoneHelp}>
            <HelpBox />
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * EN: Collection page of design V3 ("Loja · Colecção Essenza (Festa / Executiva)"): cover, edition and season,
 *     the lines as tabs (?linha=), the line's type bar, inline filters and a 4-column grid.
 * PT: Página da colecção do V3: capa, edição e época, as linhas em separadores (?linha=), a barra de tipos da linha,
 *     filtros em linha e grelha de 4 colunas.
 */
async function CollectionPage({ category, query, locale }: { category: CategoryDTO; query: Query; locale: Locale }) {
  const dict = getDictionary(locale);
  const lines = (await Promise.all(category.details!.lines.map((s) => findCategory(s, locale)))).filter((c): c is CategoryDTO => !!c);
  const current = lines.find((l) => l.slug === query.linha) ?? lines[0];
  const lineTypes = current ? current.children.filter((c) => c.kind === "type").map((c) => c.slug) : undefined;
  const listing = await loadListing(category.slug, query, locale, lineTypes);
  const lineLink = (s: string) => `${categoryHref(category.slug, locale)}?linha=${s}`;

  return (
    <>
      {category.imageUrl && (
        <div className={styles.cover}>
          <Image src={category.imageUrl} alt={category.name} fill priority sizes="100vw" />
        </div>
      )}
      <section className={`page-x ${styles.collectionHead}`}>
        <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
          <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
          <span aria-hidden="true">/</span>
          <span>{dict.catalog.collections}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{category.name}</span>
        </nav>
        <div className={styles.collectionTitle}>
          {category.details?.edition && <span className={styles.edition}>{category.details.edition}</span>}
          <h1 className={styles.title}>{category.name}</h1>
          {category.description && <p className={styles.collectionText}>{category.description}</p>}
          {category.details?.season && <span className={styles.season}>{category.details.season}</span>}
        </div>
        {lines.length > 1 && (
          <nav aria-label={dict.catalog.lines} className={styles.lines}>
            {lines.map((l) => (
              <Link key={l.slug} href={lineLink(l.slug)} className={styles.line} aria-current={l.slug === current?.slug ? "page" : undefined} scroll={false}>
                {l.name}
              </Link>
            ))}
          </nav>
        )}
        <TypeBar tiles={listing.tiles} label={dict.catalog.types} />
      </section>

      <CategoryToolbar total={listing.filtered.length} inline />

      <section className={`page-x ${styles.body} ${styles.bodyFull}`}>
        <div className={styles.results}>
          <Results listing={listing} locale={locale} columns={4} />
        </div>
      </section>
    </>
  );
}
