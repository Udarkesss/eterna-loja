import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { mainNav, site } from "@/data/site";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveHref } from "@/lib/links";
import type { Locale } from "@/types";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./Footer.module.css";

const year = new Date().getFullYear();

const SOCIAL_ICON: Record<(typeof site.social)[number]["key"], IconName> = {
  instagram: "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  whatsapp: "whatsapp",
};

/**
 * EN: Footer of design V3, the same on every store page: brand · Comprar · Ajuda · Contactos · Novidades, then the
 *     social links and payment badges. On phones the columns stack (design "Telemóvel · Início 2/2").
 * PT: Rodapé do design V3, igual em todas as páginas da loja: marca · Comprar · Ajuda · Contactos · Novidades, e depois
 *     as redes sociais e os selos de pagamento. No telemóvel as colunas empilham.
 */
export function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const f = dict.footer;
  const shop = mainNav.slice(0, 5).map((item, i) => ({
    href: resolveHref(item.href, locale),
    label: i === 0 ? f.collectionLine : item.label[locale],
  }));
  const help = [
    { href: localizePath(locale, "/como-comprar"), label: f.howToBuy },
    { href: localizePath(locale, "/fidelidade"), label: f.loyalty },
    { href: localizePath(locale, "/info/tamanhos"), label: f.sizeGuide },
    { href: localizePath(locale, "/info/trocas-devolucoes"), label: f.exchanges },
    { href: localizePath(locale, "/info/privacidade"), label: f.privacy },
  ];
  const whatsapp = `+${site.whatsapp.slice(0, 3)} ${site.whatsapp.slice(3, 5)} ${site.whatsapp.slice(5, 8)} ${site.whatsapp.slice(8)}`;

  return (
    <footer className={`on-privee ${styles.footer}`}>
      <div className={`page-x ${styles.inner}`}>
        <div className={styles.columns}>
          <div className={styles.brandCol}>
            <span className={styles.brand}>ETERNA</span>
            <p className={styles.tagline}>{t(f.tagline, { year: site.foundedYear })}</p>
          </div>
          <nav aria-label={f.shop} className={styles.col}>
            <h2 className={styles.heading}>{f.shop}</h2>
            {shop.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label={f.help} className={styles.col}>
            <h2 className={styles.heading}>{f.help}</h2>
            {help.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className={styles.col}>
            <h2 className={styles.heading}>{f.contacts}</h2>
            <a href={`tel:${site.supportPhone.replace(/\s/g, "")}`}>{site.phonesLine}</a>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer">
              WhatsApp {whatsapp}
            </a>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <Link href={localizePath(locale, "/contact")}>{f.storesShort}</Link>
          </div>
          <div className={styles.newsCol}>
            <h2 className={styles.heading}>{f.newsletterTitle}</h2>
            <p className={styles.small}>{f.newsletterBody}</p>
            <NewsletterForm />
          </div>
        </div>
        <div className={styles.row}>
          <nav aria-label={dict.common.social} className={styles.social}>
            {site.social.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">
                <Icon name={SOCIAL_ICON[s.key]} size={16} />
                {s.handle}
              </a>
            ))}
          </nav>
          <PaymentLogos label={dict.common.paymentLogos} />
        </div>
        <div className={styles.bottom}>
          <span>{t(f.copyright, { from: site.foundedYear, to: year })}</span>
          <span>PT · EN</span>
        </div>
      </div>
    </footer>
  );
}
