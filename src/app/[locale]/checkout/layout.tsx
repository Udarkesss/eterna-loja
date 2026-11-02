import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/data/site";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/i18n/params";
import styles from "./checkout.module.css";

/**
 * EN: The checkout has its own quiet frame in design V3: "Voltar ao carrinho" · logo · "Pagamento seguro", no menu.
 * PT: O checkout tem a sua moldura calma no V3: "Voltar ao carrinho" · logótipo · "Pagamento seguro", sem menu.
 */
export default async function CheckoutLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);

  return (
    <>
      <header className={`page-x ${styles.header}`}>
        <Link href={localizePath(locale, "/cart")} className={styles.back}>
          <Icon name="arrowLeft" size={18} />
          <span className={styles.label}>{dict.checkout.backToStore}</span>
        </Link>
        <Link href={localizePath(locale)} className={styles.brand} aria-label={dict.nav.home}>
          <Image src="/images/brand/eterna-logo.svg" alt="Eterna" width={130} height={30} unoptimized />
        </Link>
        <span className={styles.secure}>
          <Icon name="lock" size={18} />
          <span className={styles.label}>{dict.checkout.secure}</span>
        </span>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
      <footer className={`page-x ${styles.footer}`}>
        <span>
          © {site.foundedYear}–{new Date().getFullYear()} Eterna · Glória Mall, Maputo
        </span>
        <span className={styles.links}>
          <Link href={localizePath(locale, "/info/termos")}>{dict.checkout.termsLink}</Link>
          <Link href={localizePath(locale, "/info/privacidade")}>{dict.checkout.privacy}</Link>
          <Link href={localizePath(locale, "/info/pagamentos")}>{dict.checkout.payments}</Link>
        </span>
      </footer>
    </>
  );
}
