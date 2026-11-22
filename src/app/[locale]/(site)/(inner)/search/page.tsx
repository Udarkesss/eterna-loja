import type { Metadata } from "next";
import { CategoryFilters, CategoryToolbar, HelpBox } from "@/components/category/CategoryControls";
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
 * EN: Search page of design V3 ("Loja · Pesquisa com sugestões"): the search field with suggestions, "12
 *     resultados para “8G1”", the type bar of the results, side filters and a 3-column grid like every piece list. Code, name, colour, type or
 *     occasion, ignoring accents (src/server/catalog.ts).
 * PT: Página de pesquisa do V3: o campo com sugestões, "12 resultados para “8G1”", a barra de tipos dos
 *     resultados, filtros laterais e grelha de 3 colunas como todas as listas de peças. Código, nome, cor, tipo ou ocasião, sem contar acentos.
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
        <SearchBox initial={q} />
        {found > 0 ? (
          <h1 className={search.title}>
            {plural(dict.search.resultsFor, found)} <em>“{q}”</em>
          </h1>
        ) : (
          <h1 className="visually-hidden">{dict.search.title}</h1>
        )}
        {listing && <TypeBar tiles={listing.tiles} label={dict.catalog.types} min={2} />}
      </section>

      {/* EN: Same presentation as every piece list (owner 2026-11-22): side filters and 3 columns once there are results.
          PT: A mesma apresentação de todas as listas de peças (dona 22-11-2026): filtros laterais e 3 colunas. */}
      {listing && found > 0 && <CategoryToolbar total={listing.filtered.length} types={listing.types} />}

      {listing && (
        <section className={`page-x ${styles.body} ${found > 0 ? "" : styles.bodyFull}`}>
          {found > 0 && <CategoryFilters types={listing.types} />}
          <div className={styles.results}>
            <Results
              listing={listing}
              locale={locale}
              columns={3}
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
            {/* EN: Phones (V3-M-Pesquisa): help after the results. PT: Telemóvel: ajuda depois dos resultados. */}
            {found > 0 && (
              <div className={styles.phoneHelp}>
                <HelpBox />
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
