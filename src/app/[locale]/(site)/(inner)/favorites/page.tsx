import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/favorites/Favorites.module.css";
import { FavoritesView } from "@/components/favorites/FavoritesView";
import { ProductGrid } from "@/components/product/ProductGrid";
import { RichText } from "@/components/ui/RichText";
import { mainNav } from "@/data/site";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import { categoryHref, resolveHref } from "@/lib/links";
import { findCategory, listProducts } from "@/server/catalog";
import { cardPriceVisible } from "@/server/content";

type Props = { params: Promise<{ locale: string }> };

/** EN: Occasion suggested next to bridal favourites. PT: Ocasião sugerida ao lado dos favoritos de noiva. */
const COMPANIONS = "madrinha-mae-noiva";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).nav.favorites, robots: { index: false } };
}

/**
 * EN: Favourites page of design V3. The saved pieces live in the browser or the account (client side); the server adds
 *     the "Para madrinhas e mães da noiva" row, shown when there are Eterna Bridal pieces among them.
 * PT: Página de favoritos do V3. As peças guardadas vivem no browser ou na conta (no cliente); o servidor junta a fila
 *     "Para madrinhas e mães da noiva", mostrada quando há peças da Eterna Bridal.
 */
export default async function FavoritesPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const f = dict.favorites;
  const [occasion, suggestions, showPrice] = await Promise.all([
    findCategory(COMPANIONS, locale),
    listProducts({ category: COMPANIONS, limit: 4 }, locale),
    cardPriceVisible(),
  ]);

  const companions =
    occasion && suggestions.length ? (
      <section className={styles.companions}>
        <div className={styles.secHead}>
          <div className={styles.secTitle}>
            <span className="eyebrow">{t(f.occasion, { name: occasion.name })}</span>
            <h2 className={styles.title}>
              <RichText text={f.companionsTitle} />
            </h2>
            <p className={styles.small}>{f.companionsBody}</p>
          </div>
          <Link href={categoryHref(occasion.slug, locale)} className={styles.ulink}>
            {f.seeOccasion}
          </Link>
        </div>
        <ProductGrid products={suggestions} locale={locale} showPrice={showPrice} />
      </section>
    ) : null;

  return (
    <section className={`page-x ${styles.page}`}>
      <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
        <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{dict.nav.favorites}</span>
      </nav>
      <FavoritesView showPrice={showPrice} companions={companions} exploreHref={resolveHref(mainNav[0].href, locale)} />
    </section>
  );
}
