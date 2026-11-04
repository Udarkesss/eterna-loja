import { activeCollection } from "@/server/catalog";
import { getPageSections } from "@/server/content";
import Image from "next/image";
import { getDictionary } from "@/i18n";
import type { Locale } from "@/types";
import { HeaderActions } from "./HeaderActions";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MobileMenu } from "./MobileMenu";
import { HomeLogoLink, NavLinks } from "./NavLinks";
import styles from "./Header.module.css";
import { contactsView } from "@/server/contacts";

/**
 * EN: Store header of design V3. Computer: two rows — PT/EN · logo · icons (search, account, favourites, bag), then the
 *     menu. Phone (< 768 px): menu button · logo · search and bag; the menu opens as a drawer (MobileMenu).
 * PT: Cabeçalho da loja do design V3. Computador: duas linhas — PT/EN · logótipo · ícones, e depois o menu.
 *     Telemóvel (< 768 px): botão do menu · logótipo · pesquisa e saco; o menu abre em gaveta.
 */
export async function Header({ locale }: { locale: Locale }) {
  // EN: The first menu item is the active collection (Gestão → Colecções). PT: O primeiro item é a colecção activa.
  const [active, sections, contacts] = await Promise.all([activeCollection(locale), getPageSections("home", locale), contactsView("contacts")]);
  const collection = active?.name;
  const order = sections.map((x) => x.key);
  const dict = getDictionary(locale);

  return (
    <header className={styles.header}>
      <div className={`page-x ${styles.top}`}>
        <div className={styles.start}>
          <span className={styles.desktop}>
            <LanguageSwitcher />
          </span>
          <span className={styles.phone}>
            <MobileMenu collection={collection} order={order} email={contacts.emails[0]?.value} phone={contacts.phones[0]?.value} />
          </span>
        </div>
        <HomeLogoLink className={styles.brand} label={dict.nav.home}>
          <Image src="/images/brand/eterna-logo.svg" alt="Eterna" width={148} height={34} priority unoptimized className={styles.logo} />
        </HomeLogoLink>
        <HeaderActions />
      </div>
      <nav aria-label={dict.nav.main} className={styles.nav}>
        <ul className={`page-x ${styles.navList}`}>
          <NavLinks linkClassName={styles.navLink} collectionClassName={styles.collection} collection={collection} order={order} />
        </ul>
      </nav>
    </header>
  );
}
