"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { plural } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./HeaderActions.module.css";

/**
 * EN: Header icons of design V3: search · account · favourites · bag (with count). Below 1024 px account and favourites
 *     move into the menu drawer, so only search and bag stay.
 * PT: Ícones do cabeçalho do V3: pesquisa · conta · favoritos · saco (com contador). Abaixo de 1024 px a conta e os
 *     favoritos passam para a gaveta do menu; ficam só a pesquisa e o saco.
 */
export function HeaderActions() {
  const { dict, href } = useI18n();
  const { count } = useCart();

  return (
    <div className={styles.actions}>
      <Link href={href("/search")} aria-label={dict.nav.search} className={styles.icon}>
        <Icon name="search" />
      </Link>
      <Link href={href("/account")} aria-label={dict.nav.account} className={`${styles.icon} ${styles.wide}`}>
        <Icon name="user" />
      </Link>
      <Link href={href("/favorites")} aria-label={dict.nav.favorites} className={`${styles.icon} ${styles.wide}`}>
        <Icon name="heart" />
      </Link>
      <Link href={href("/cart")} aria-label={plural(dict.nav.cart, count)} className={styles.icon}>
        <Icon name="bag" />
        {count > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}
