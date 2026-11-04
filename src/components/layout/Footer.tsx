import { waDigits } from "@/data/contacts";
import { activeCollection } from "@/server/catalog";
import { contactsView } from "@/server/contacts";
import Link from "next/link";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { mainNav, site } from "@/data/site";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveHref } from "@/lib/links";
import type { Locale } from "@/types";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./Footer.module.css";

const year = new Date().getFullYear();

/**
 * EN: Footer of design V3, the same on every store page: brand · Comprar · Ajuda · Contactos · Novidades, then the
 *     social links and payment badges. On phones the columns stack (design "Telemóvel · Início 2/2").
 * PT: Rodapé do design V3, igual em todas as páginas da loja: marca · Comprar · Ajuda · Contactos · Novidades, e depois
 *     as redes sociais e os selos de pagamento. No telemóvel as colunas empilham.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  // EN: Contacts and networks from Gestão → Contactos (place "Rodapé"). PT: Contactos e redes da gestão.
  const [active, contacts] = await Promise.all([activeCollection(locale), contactsView("footer")]);
  const dict = getDictionary(locale);
  const f = dict.footer;
  const shop = mainNav.slice(0, 5).map((item, i) => ({
    href: resolveHref(item.href, locale),
    label: i === 0 ? (active ? [active.name, active.details?.edition?.replace(/\s·\s\d{4}$/, "")].filter(Boolean).join(" · ") : f.collectionLine) : item.label[locale],
  }));
  const help = [
    { href: localizePath(locale, "/como-comprar"), label: f.howToBuy },
    { href: localizePath(locale, "/fidelidade"), label: f.loyalty },
    { href: localizePath(locale, "/info/tamanhos"), label: f.sizeGuide },
    { href: localizePath(locale, "/info/trocas-devolucoes"), label: f.exchanges },
    { href: localizePath(locale, "/info/privacidade"), label: f.privacy },
  ];

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
            {contacts.phones.map((c) => (
              <a key={c.value} href={`tel:${c.value.replace(/\s/g, "")}`}>
                {c.value}
              </a>
            ))}
            {contacts.whatsapp && (
              <a href={`https://wa.me/${waDigits(contacts.whatsapp.value)}`} target="_blank" rel="noopener noreferrer">
                WhatsApp {contacts.whatsapp.value}
              </a>
            )}
            {contacts.emails.map((c) => (
              <a key={c.value} href={`mailto:${c.value}`}>
                {c.value}
              </a>
            ))}
            <Link href={resolveHref("#contactos", locale)}>{f.storesShort}</Link>
          </div>
          <div className={styles.newsCol}>
            <h2 className={styles.heading}>{f.newsletterTitle}</h2>
            <p className={styles.small}>{f.newsletterBody}</p>
            <NewsletterForm />
          </div>
        </div>
        <div className={styles.row}>
          <nav aria-label={dict.common.social} className={styles.social}>
            {contacts.social.map((s) => (
              <a key={s.url + s.handle} href={s.url} target="_blank" rel="noopener noreferrer">
                <SocialIcon link={s} />
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
