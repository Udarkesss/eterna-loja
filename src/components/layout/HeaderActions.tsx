"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { plural } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./HeaderActions.module.css";

/**
 * EN: Header icons from the design: search · account · favourites · bag (with count). Shared by both navbars.
 * PT: Ícones do cabeçalho do design: pesquisa · conta · favoritos · carrinho (com contador). Comum às duas barras.
 */
export function HeaderActions({ compact, mobileMinimal }: { compact?: boolean; mobileMinimal?: boolean }) {
  const { dict, href } = useI18n();
  const { count } = useCart();

  return (
    <div className={styles.actions}>
      {!compact && (
        <>
          <Link href={href("/search")} aria-label={dict.nav.search} className={`${styles.icon} ${mobileMinimal ? styles.desktopOnly : ""}`}>
            <Icon name="search" />
          </Link>
          <Link href={href("/account")} aria-label={dict.nav.account} className={`${styles.icon} ${mobileMinimal ? styles.desktopOnly : ""}`}>
            <Icon name="user" />
          </Link>
        </>
      )}
      <Link href={href("/favorites")} aria-label={dict.nav.favorites} className={styles.icon}>
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
