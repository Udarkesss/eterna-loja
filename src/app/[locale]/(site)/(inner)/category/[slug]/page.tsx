import type { Metadata } from "next";
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
import { COLOR_FAMILIES, type ColorFamily, type ProductDTO } from "@/types";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
 * EN: Category page of design V3 ("Loja · Categoria com barra de tipos"): crumbs, title, circular type bar, filters
 *     bar, side filters and a 3-column grid with "Mostrar mais peças". Includes the products of all sub-categories.
 * PT: Página de categoria do V3: caminho, título, barra de tipos em círculo, barra de filtros, filtros laterais e
 *     grelha de 3 colunas com "Mostrar mais peças". Inclui os produtos de todas as subcategorias.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const query = await searchParams;
  const category = await findCategory(slug, locale);
  if (!category) notFound();
  const dict = getDictionary(locale);

  const sizeLetters = list(query.size).filter((s) => (SIZE_LETTERS as readonly string[]).includes(s));
  const colors = list(query.color).filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c));
  const prices = list(query.price).filter((p): p is PriceRange => (PRICE_RANGES as readonly string[]).includes(p));
  const onSale = query.sale === "1";
  const type = typeof query.type === "string" ? query.type : undefined;
  const sort = SORTS.find((s) => s === query.sort) ?? "recommended";
  const shown = Math.max(PAGE_SIZE, Number(query.n) || PAGE_SIZE);

  // EN: All products of the category (for the type bar), then the filtered list.
  // PT: Todos os produtos da categoria (para a barra de tipos), e depois a lista filtrada.
  const [all, showPrice] = await Promise.all([listProducts({ category: slug }, locale), cardPriceVisible()]);
  const filtered = (
    await listProducts({ category: slug, types: type ? [type] : undefined, sizeLetters, colors, onSale, sort }, locale)
  ).filter((p) => inPriceRanges(p, prices));

  const typeLink = (s?: string) => {
    const q = new URLSearchParams();
    if (s) q.set("type", s);
    return `${categoryHref(slug, locale)}${q.size ? `?${q}` : ""}`;
  };
  const byType = new Map<string, { name: string; image: string | undefined }>();
  for (const p of all) {
    if (p.type && !byType.has(p.type.slug)) byType.set(p.type.slug, { name: p.type.name, image: p.images[0]?.url });
  }
  const typeNames = await Promise.all([...byType.keys()].map((s) => findCategory(s, locale)));
  const tiles: TypeTile[] = [
    { href: typeLink(), label: dict.catalog.all, images: all.slice(0, 4).flatMap((p) => (p.images[0] ? [p.images[0].url] : [])), current: !type },
    ...[...byType.entries()].map(([s, v], i) => ({
      href: typeLink(s),
      label: typeNames[i]?.name ?? v.name,
      images: v.image ? [v.image] : [],
      current: type === s,
    })),
  ];
  const moreLink = () => {
    const q = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"));
    q.set("n", String(shown + PAGE_SIZE));
    return `${categoryHref(slug, locale)}?${q}`;
  };

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
        <TypeBar tiles={tiles} label={dict.catalog.types} />
      </section>

      <CategoryToolbar total={filtered.length} />

      <section className={`page-x ${styles.body}`}>
        <CategoryFilters />
        <div className={styles.results}>
          {filtered.length === 0 ? (
            all.length === 0 ? (
              <p className={styles.description}>{dict.catalog.noProducts}</p>
            ) : (
              <CategoryEmpty />
            )
          ) : (
            <>
              <ProductGrid products={filtered.slice(0, shown)} locale={locale} columns={3} showPrice={showPrice} />
              <div className={styles.more}>
                <span className={styles.count}>
                  {t(dict.catalog.showing, { shown: Math.min(shown, filtered.length), total: filtered.length })}
                </span>
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
          )}
          <div className={styles.phoneHelp}>
            <HelpBox />
          </div>
        </div>
      </section>
    </>
  );
}
