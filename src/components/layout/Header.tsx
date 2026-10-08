import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import type { Locale } from "@/types";
import { HeaderActions } from "./HeaderActions";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NavLinks } from "./NavLinks";
import styles from "./Header.module.css";

/**
 * EN: ACTIVE navbar (the client's choice): two rows — language · ETERNA · icons, then the menu.
 *     The menu items and icons follow the design exactly. The design's own one-row navbar is DesignHeader.tsx.
 * PT: Barra de navegação ACTIVA (escolha da cliente): duas linhas — idioma · ETERNA · ícones, e depois o menu.
 *     Os itens do menu e os ícones seguem o design à risca. A barra de uma linha do design está em DesignHeader.tsx.
 */
export function Header({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);

  return (
    <header className={styles.header}>
      <div className={`page-x ${styles.top}`}>
        <LanguageSwitcher />
        <Link href={localizePath(locale)} className={styles.brand} aria-label={dict.nav.home}>
          ETERNA
        </Link>
        <HeaderActions mobileMinimal />
      </div>
      <nav aria-label={dict.nav.main} className={styles.nav}>
        <ul className={`page-x ${styles.navList}`}>
          <NavLinks linkClassName={styles.navLink} withFitting fittingClassName={`${styles.navLink} ${styles.fitting}`} />
          {/* EN: phones: search + account move here. PT: telemóvel: pesquisa + conta vêm para aqui. */}
          <li className={styles.mobileOnly}>
            <Link href={localizePath(locale, "/search")} aria-label={dict.nav.search} className={styles.navLink}>
              <Icon name="search" size={20} />
            </Link>
          </li>
          <li className={styles.mobileOnly}>
            <Link href={localizePath(locale, "/account")} aria-label={dict.nav.account} className={styles.navLink}>
              <Icon name="user" size={20} />
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
