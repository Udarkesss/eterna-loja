import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import styles from "@/components/favorites/Favorites.module.css";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { loyaltySettings } from "@/server/loyalty";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getDictionary(await resolveLocale(params)).cart.title, robots: { index: false } };
}

/** EN: Cart page of design V3 ("Carrinho: escolher o que compra agora"). PT: Página do carrinho do V3. */
export default async function CartPage({ params }: Props) {
  const locale = await resolveLocale(params);
  // EN: Points line follows Definições · Programa de fidelidade. PT: A linha dos pontos segue o programa de fidelidade.
  const loyalty = await loyaltySettings();
  const dict = getDictionary(locale);
  return (
    <section className={`page-x ${styles.page}`}>
      <div className={styles.head}>
        <h1 className={styles.display}>{dict.cart.title}</h1>
        <span className={styles.small}>{dict.cart.intro}</span>
      </div>
      <CartView mtPerPoint={loyalty.on ? loyalty.mtPerPoint : 0} />
    </section>
  );
}
