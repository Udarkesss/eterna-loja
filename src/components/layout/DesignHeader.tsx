"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";
import { HeaderActions } from "./HeaderActions";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavLinks } from "./NavLinks";
import styles from "./DesignHeader.module.css";

/**
 * EN: The design's navbar (Início · 88px, one row): menu left · ETERNA centre · "Agendar prova" + icons right.
 *     On phones (Telemóvel · Início): menu + search left · ETERNA · favourites + bag, with a slide-in menu.
 *     NOT in use yet — it is commented out in src/app/[locale]/(site)/layout.tsx until the client decides.
 * PT: A barra de navegação do design. AINDA NÃO está em uso — fica comentada no layout até a cliente decidir.
 */
export function DesignHeader() {
  const { dict, href, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={styles.header}>
      <div className={`page-x ${styles.row}`}>
        <div className={styles.left}>
          <button type="button" className={styles.menuButton} aria-label={dict.common.openMenu} aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <Link href={href("/search")} aria-label={dict.nav.search} className={styles.mobileOnly}>
            <Icon name="search" />
          </Link>
          <nav aria-label={dict.nav.main} className={styles.desktopNav}>
            <ul className={styles.navList}>
              <NavLinks linkClassName={styles.navLink} />
            </ul>
          </nav>
        </div>
        <Link href={href("/")} className={styles.brand} aria-label={dict.nav.home}>
          ETERNA
        </Link>
        <div className={styles.right}>
          <Link href={resolveHref("#prova", locale)} className={styles.fitting}>
            {dict.nav.bookFitting}
          </Link>
          <HeaderActions />
        </div>
      </div>

      {open && (
        <div className={styles.drawer} role="dialog" aria-modal="true" aria-label={dict.nav.main}>
          <div className={styles.drawerHead}>
            <LanguageSwitcher />
            <button type="button" className={styles.menuButton} aria-label={dict.common.close} onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <ul className={styles.drawerList}>
            <NavLinks linkClassName={styles.drawerLink} withFitting fittingClassName={`${styles.drawerLink} ${styles.fitting}`} />
          </ul>
        </div>
      )}
    </header>
  );
}
