import type { Metadata } from "next";
import Link from "next/link";
import { CartView } from "@/components/cart/CartView";
import styles from "@/components/favorites/Favorites.module.css";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).cart.title, robots: { index: false } };
}

/** EN: Cart page of design V3 ("Carrinho: escolher o que compra agora"). PT: Página do carrinho do V3. */
export default async function CartPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  return (
    <section className={`page-x ${styles.page}`}>
      <nav aria-label={dict.nav.breadcrumb} className={styles.breadcrumb}>
        <Link href={localizePath(locale)}>{dict.nav.homeCrumb}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{dict.cart.title}</span>
      </nav>
      <div className={styles.head}>
        <h1 className={styles.display}>{dict.cart.title}</h1>
        <span className={styles.small}>{dict.cart.intro}</span>
      </div>
      <CartView />
    </section>
  );
}
