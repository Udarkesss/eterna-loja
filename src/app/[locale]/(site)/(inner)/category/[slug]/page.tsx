import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryFilters, CategoryToolbar, HelpBox } from "@/components/category/CategoryControls";
import styles from "@/components/category/Category.module.css";
import { loadListing, Results, type Query } from "@/components/category/Listing";
import { TypeBar } from "@/components/category/TypeBar";
import { Parallax } from "@/components/home/Parallax";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { categoryHref } from "@/lib/links";
import { formatLongDate, todayMaputo } from "@/lib/time";
import { findCategory } from "@/server/catalog";
import type { CategoryDTO, Locale } from "@/types";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Query>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const category = await findCategory((await params).slug, locale);
  return category ? { title: category.name, description: category.description ?? undefined } : {};
}

/**
 * EN: Category page of design V3 ("Loja · Categoria com barra de tipos"): title, circular type bar, filters
 *     bar, side filters and a 3-column grid. A collection with lines (Essenza) uses the collection page instead.
 * PT: Página de categoria do V3: título, barra de tipos em círculo, barra de filtros, filtros laterais e
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
  const listing = await loadListing({ filter: { category: slug }, path: categoryHref(slug, locale), settings: category.listing }, query, locale);
  const shown = { color: true, price: true, types: true, ...(category.listing?.filters ?? {}) };

  return (
    <>
      <section className={`page-x ${styles.head}`}>
        <div className={styles.titleBox}>
          {category.parent && <span className="eyebrow">{category.parent.name}</span>}
          <h1 className={styles.title}>{category.name}</h1>
          {category.description && <p className={styles.description}>{category.description}</p>}
        </div>
        {shown.types && <TypeBar tiles={listing.tiles} label={dict.catalog.types} />}
      </section>

      <CategoryToolbar total={listing.filtered.length} types={listing.types} />

      <section className={`page-x ${styles.body}`}>
        <CategoryFilters types={listing.types} color={shown.color} price={shown.price} reserved={shown.reserved !== false} />
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
 *     the lines as tabs (?linha=), the line's type bar, side filters and a 3-column grid like every piece list.
 * PT: Página da colecção do V3: capa, edição e época, as linhas em separadores (?linha=), a barra de tipos da linha,
 *     filtros laterais e grelha de 3 colunas como todas as listas de peças.
 */
async function CollectionPage({ category, query, locale }: { category: CategoryDTO; query: Query; locale: Locale }) {
  const dict = getDictionary(locale);
  const lines = (await Promise.all(category.details!.lines.map((s) => findCategory(s, locale)))).filter((c): c is CategoryDTO => !!c);
  const current = lines.find((l) => l.slug === query.linha) ?? lines[0];
  const lineTypes = current ? current.children.filter((c) => c.kind === "type").map((c) => c.slug) : undefined;
  const listing = await loadListing(
    { filter: { category: category.slug }, path: categoryHref(category.slug, locale), keep: ["linha"], types: lineTypes, settings: category.listing },
    query,
    locale,
  );
  const lineLink = (s: string) => `${categoryHref(category.slug, locale)}?linha=${s}`;
  // EN: The active special edition (drafts stay private until activated). PT: A edição especial activa (rascunhos não aparecem).
  const today = todayMaputo();
  const special = category.children
    .filter((c) => c.kind === "collection" && c.details && !c.details.history && c.details.status === "active" && (!c.details.endsOn || c.details.endsOn >= today))
    .sort((a, b) => Number(b.details?.status === "active") - Number(a.details?.status === "active") || (a.details?.startsOn ?? "").localeCompare(b.details?.startsOn ?? ""))[0];
  const dayMonth = (d: string) => formatLongDate(d, locale).replace(/^[^,]+,\s*/, "");
  const specialDates = special?.details?.startsOn && special.details.endsOn ? dict.catalog.specialDates.replace("{from}", dayMonth(special.details.startsOn)).replace("{to}", dayMonth(special.details.endsOn)) : "";

  return (
    <>
      {category.imageUrl && (
        // EN: Cover photo with the home page's effect (owner 2026-11-22): it settles in slowly on arrival and moves slower
        //     than the page while scrolling. PT: Foto de capa com o efeito do Início (dona 22-11-2026): assenta devagar
        //     ao chegar e move-se mais devagar do que a página ao descer.
        <div className={styles.cover}>
          <div className={styles.coverLayer} data-parallax="">
            <Image src={category.imageUrl} alt={category.name} fill priority sizes="100vw" />
          </div>
          <Parallax />
        </div>
      )}
      <section className={`page-x ${styles.collectionHead}`}>
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

      {/* EN: Same presentation as every piece list (owner 2026-11-22): side filters with "Tipos de peça" and 3 columns.
          PT: A mesma apresentação de todas as listas de peças (dona 22-11-2026): filtros laterais e 3 colunas. */}
      <CategoryToolbar total={listing.filtered.length} types={listing.types} />

      <section className={`page-x ${styles.body}`}>
        <CategoryFilters types={listing.types} reserved={category.listing?.filters?.reserved !== false} />
        <div className={styles.results}>
          <Results listing={listing} locale={locale} columns={3} />
          <div className={styles.phoneHelp}>
            <HelpBox />
          </div>
        </div>
      </section>

      {/* EN: Special edition inside this collection (design V3-Colecao "Edição especial · dentro da Essenza").
          PT: Edição especial dentro desta colecção (V3). */}
      {special && (
        <section className={styles.special} data-theme="bridal">
          <div className={styles.specialImage}>{special.imageUrl && <Image src={special.imageUrl} alt={special.name} fill sizes="(max-width: 767px) 100vw, 50vw" />}</div>
          <div className={styles.specialText}>
            <span className={styles.specialBadge}>{dict.catalog.specialWithin.replace("{name}", category.name)}</span>
            <h2 className={styles.specialTitle}>{special.name}</h2>
            {(special.description || specialDates) && (
              <p className={styles.specialBody}>
                {special.description}
                {special.description && specialDates ? " " : ""}
                {specialDates}
              </p>
            )}
            <Link href={categoryHref(special.slug, locale)} className={styles.specialCta}>
              {special.details?.buttonText || dict.catalog.specialCta}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
