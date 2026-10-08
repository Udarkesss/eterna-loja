import type { Metadata } from "next";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getDictionary, plural } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { listProducts } from "@/server/catalog";
import styles from "./search.module.css";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).search.title, robots: { index: false } };
}

/** EN: Search by code or name (header magnifier). PT: Pesquisa por código ou nome (lupa do cabeçalho). */
export default async function SearchPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const results = q ? await listProducts({ search: q }, locale) : [];

  return (
    <>
      <PageHead title={dict.search.title}>
        <form role="search" className={styles.form}>
          <label htmlFor="q" className="visually-hidden">
            {dict.search.placeholder}
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder={dict.search.placeholder} className={styles.input} autoFocus />
          <button type="submit" className={styles.button}>
            {dict.nav.search}
          </button>
        </form>
      </PageHead>
      <PageBody>
        {q && <p>{results.length ? plural(dict.search.results, results.length) : dict.search.empty}</p>}
        {results.length > 0 && <ProductGrid products={results} locale={locale} />}
      </PageBody>
    </>
  );
}
