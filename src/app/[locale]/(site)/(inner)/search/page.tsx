import type { Metadata } from "next";
import Link from "next/link";
import { CategoryToolbar, HelpBox } from "@/components/category/CategoryControls";
import styles from "@/components/category/Category.module.css";
import { loadListing, Results, type Query } from "@/components/category/Listing";
import { TypeBar } from "@/components/category/TypeBar";
import { SearchBox } from "@/components/search/SearchBox";
import search from "@/components/search/Search.module.css";
import { getDictionary, plural } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).search.title, robots: { index: false } };
}

/**
 * EN: Search page of design V3 ("Loja · Pesquisa com sugestões"): crumbs, the search field with suggestions, "12
 *     resultados para “8G1”", the type bar of the results, filters and a 4-column grid. Code, name, colour, type or
 *     occasion, ignoring accents (src/server/catalog.ts).
 * PT: Página de pesquisa do V3: caminho, o campo com sugestões, "12 resultados para “8G1”", a barra de tipos dos
 *     resultados, filtros e grelha de 4 colunas. Código, nome, cor, tipo ou ocasião, sem contar acentos.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const query = await searchParams;
  const q = (typeof query.q === "string" ? query.q : "").trim().slice(0, 60);
  const listing = q ? await loadListing({ filter: { search: q }, path: localizePath(locale, "/search"), keep: ["q"] }, query, locale) : null;
  const found = listing?.all.length ?? 0;

  return (
    <>
      <section className={`page-x ${styles.head} ${listing ? "" : search.idle}`}>
        <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
          <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{dict.search.title}</span>
        </nav>
        <SearchBox initial={q} />
        {found > 0 ? (
          <h1 className={search.title}>
            {plural(dict.search.resultsFor, found)} <em>“{q}”</em>
          </h1>
        ) : (
          <h1 className="visually-hidden">{dict.search.title}</h1>
        )}
        {listing && <TypeBar tiles={listing.tiles} label={dict.catalog.types} />}
      </section>

      {listing && found > 0 && <CategoryToolbar total={listing.filtered.length} inline />}

      {listing && (
        <section className={`page-x ${styles.body} ${styles.bodyFull}`}>
          <div className={styles.results}>
            <Results
              listing={listing}
              locale={locale}
              columns={4}
              empty={
                <div className={search.empty}>
                  <h2 className={search.title}>
                    {dict.search.emptyTitle} <em>“{q}”</em>
                  </h2>
                  <p className={search.emptyBody}>{dict.search.emptyBody}</p>
                  <HelpBox />
                </div>
              }
            />
          </div>
        </section>
      )}
    </>
  );
}
