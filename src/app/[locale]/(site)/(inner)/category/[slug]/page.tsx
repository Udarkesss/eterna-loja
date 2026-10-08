import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryEmpty, CategoryFilters, CategoryToolbar, type PriceRange } from "@/components/category/CategoryControls";
import styles from "@/components/category/Category.module.css";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import { categoryHref } from "@/lib/links";
import { findCategory, listProducts, type ProductSort } from "@/server/catalog";
import { COLOR_FAMILIES, type ColorFamily, type ProductDTO } from "@/types";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ["recommended", "price_asc", "price_desc"];

const list = (v: string | string[] | undefined) => (typeof v === "string" ? v.split(",").filter(Boolean) : []);

/** EN: Price checkboxes are OR-ed together. PT: As caixas de preço combinam-se com "ou". */
function inPriceRanges(product: ProductDTO, ranges: PriceRange[]): boolean {
  if (!ranges.length) return true;
  const price = product.salePrice ?? product.price;
  return ranges.some((r) => (r === "upTo20" ? price <= 20000 : r === "from20to30" ? price > 20000 && price <= 30000 : price > 30000));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const category = await findCategory((await params).slug, locale);
  return category ? { title: category.name, description: category.description ?? undefined } : {};
}

/**
 * EN: Category page ("Categoria · Convidada" in the design). Includes all sub-categories' products.
 * PT: Página de categoria. Inclui os produtos de todas as subcategorias.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const query = await searchParams;
  const category = await findCategory(slug, locale);
  if (!category) notFound();
  const dict = getDictionary(locale);

  const sizes = list(query.size);
  const colors = list(query.color).filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c));
  const prices = list(query.price) as PriceRange[];
  const type = typeof query.type === "string" ? query.type : undefined;
  const sort = SORTS.find((s) => s === query.sort) ?? "recommended";
  const shown = Math.max(PAGE_SIZE, Number(query.n) || PAGE_SIZE);

  // EN: All products of the category (for the type chips), then the filtered list.
  // PT: Todos os produtos da categoria (para os tipos), e depois a lista filtrada.
  const all = await listProducts({ category: slug }, locale);
  const filtered = (
    await listProducts({ category: slug, types: type ? [type] : undefined, sizes, colors, sort }, locale)
  ).filter((p) => inPriceRanges(p, prices));

  const typeSlugs = [...new Set(all.map((p) => p.type?.slug).filter((s): s is string => !!s))];
  const types = (await Promise.all(typeSlugs.map((s) => findCategory(s, locale)))).filter((c) => !!c);
  const collections = [...new Set(all.map((p) => p.collection?.name).filter(Boolean))];
  const eyebrow = [collections.length === 1 ? collections[0] : null, category.parent?.name ?? dict.nav.homeCrumb]
    .filter(Boolean)
    .join(" · ");

  const typeLink = (s?: string) => {
    const q = new URLSearchParams();
    if (s) q.set("type", s);
    return `${categoryHref(slug, locale)}${q.size ? `?${q}` : ""}`;
  };
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
        <div className={styles.titleRow}>
          <div className={styles.titleBox}>
            <span className="eyebrow">{eyebrow}</span>
            <h1 className={styles.title}>{category.name}</h1>
            {category.description && <p className={styles.description}>{category.description}</p>}
          </div>
          {types.length > 1 && (
            <div className={styles.types}>
              <Link href={typeLink()} className={styles.type} aria-current={!type}>
                {dict.catalog.all}
              </Link>
              {types.map((ty) => (
                <Link key={ty.slug} href={typeLink(ty.slug)} className={styles.type} aria-current={type === ty.slug}>
                  {ty.name}
                </Link>
              ))}
            </div>
          )}
        </div>
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
              <ProductGrid products={filtered.slice(0, shown)} locale={locale} columns={3} />
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
        </div>
      </section>
    </>
  );
}
