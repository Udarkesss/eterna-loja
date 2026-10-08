import Link from "next/link";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { infoPages, site } from "@/data/site";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { categoryHref } from "@/lib/links";
import { listOccasions } from "@/server/catalog";
import type { Locale } from "@/types";
import { NewsletterForm } from "./NewsletterForm";
import { SocialLinks } from "./SocialLinks";
import styles from "./Footer.module.css";

const year = new Date().getFullYear();

/**
 * EN: Full footer of the design's Início: brand + social · Ocasiões · Informações · newsletter, then payments.
 * PT: Rodapé completo do Início do design: marca + redes · Ocasiões · Informações · novidades, e pagamentos.
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const occasions = await listOccasions(locale);

  return (
    <footer className={`on-privee ${styles.footer}`}>
      <div className={`page-x ${styles.inner}`}>
        <div className={styles.columns}>
          <div className={styles.brandCol}>
            <span className={styles.brand}>ETERNA</span>
            <p className={styles.tagline}>{t(dict.footer.tagline, { year: site.foundedYear })}</p>
            <SocialLinks label={dict.common.social} />
          </div>
          <div className={styles.col}>
            <span className={styles.heading}>{dict.footer.occasions}</span>
            {occasions.map((o) => (
              <Link key={o.slug} href={categoryHref(o.slug, locale)}>
                {o.name}
              </Link>
            ))}
          </div>
          <div className={styles.col}>
            <span className={styles.heading}>{dict.footer.info}</span>
            {infoPages.map((slug) => (
              <Link key={slug} href={localizePath(locale, `/info/${slug}`)}>
                {dict.footer.infoPages[slug]}
              </Link>
            ))}
          </div>
          <div className={styles.newsCol}>
            <span className={styles.heading}>{dict.footer.newsletterTitle}</span>
            <p className={styles.small}>{dict.footer.newsletterBody}</p>
            <NewsletterForm />
            <span className={styles.address}>
              {dict.footer.stores}
              <br />
              +258 82 487 6300 · +258 84 073 3688
              <br />
              {site.email}
            </span>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>
            © {site.foundedYear}–{year} Eterna. {dict.footer.rights} · {dict.footer.city}
          </span>
          <div className={styles.payments}>
            <span className={styles.paymentsLabel}>{dict.footer.payments}</span>
            <PaymentLogos label={dict.common.paymentLogos} />
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * EN: Compact footer of the design's Categoria / Produto pages.
 * PT: Rodapé compacto das páginas Categoria / Produto do design.
 */
export function CompactFooter({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const links = [
    ...(["tamanhos", "trocas-devolucoes", "reservas", "pagamentos", "envios"] as const).map((slug) => ({
      href: localizePath(locale, `/info/${slug}`),
      label: dict.footer.infoPages[slug],
    })),
    { href: localizePath(locale, "/contact"), label: dict.footer.contacts },
  ];

  return (
    <footer className={`on-privee ${styles.compact}`}>
      <div className={`page-x ${styles.compactInner}`}>
        <div className={styles.compactTop}>
          <span className={styles.brandSmall}>ETERNA</span>
          <nav aria-label={dict.footer.info} className={styles.compactNav}>
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <SocialLinks label={dict.common.social} />
        </div>
        <div className={styles.bottom}>
          <span>
            © {site.foundedYear}–{year} Eterna · Glória Mall, Maputo · {site.email}
          </span>
          <PaymentLogos label={dict.common.paymentLogos} />
        </div>
      </div>
    </footer>
  );
}
