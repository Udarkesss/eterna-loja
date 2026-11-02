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
 * EN: Store header of design V3: two rows — language · ETERNA · icons (search, account, favourites, bag), then the menu.
 * PT: Cabeçalho da loja do design V3: duas linhas — idioma · ETERNA · ícones (pesquisa, conta, favoritos, saco), e o menu.
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
          <NavLinks linkClassName={styles.navLink} />
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
