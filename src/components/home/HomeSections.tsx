import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PaymentLogos } from "@/components/ui/PaymentLogos";
import { RichText } from "@/components/ui/RichText";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { site, whatsappLink } from "@/data/site";
import { getDictionary } from "@/i18n";
import { categoryHref, resolveHref } from "@/lib/links";
import type { Locale, OccasionTileDTO, ProductDTO, StoreDTO } from "@/types";
import { OccasionsTrack } from "./OccasionsTrack";
import styles from "./Home.module.css";

/**
 * EN: The home page sections from the design, in their own components. Texts come from the database
 *     (content_sections), so the team can edit them in Gestão · 8 without touching code.
 * PT: As secções do Início do design. Os textos vêm da base de dados, para a equipa os editar na gestão.
 */

type Cta = { label: string; href: string };

// ── Manifesto ────────────────────────────────────────────────────────
export function Manifesto({ data, locale }: { data: { eyebrow: string; title: string; body: string; primaryCta: Cta; secondaryCta: Cta }; locale: Locale }) {
  return (
    <section className={`page-x ${styles.manifesto}`}>
      <div className={styles.manifestoHead}>
        <span className="eyebrow">{data.eyebrow}</span>
        <h1 className={styles.manifestoTitle}>
          <RichText text={data.title} />
        </h1>
      </div>
      <div className={styles.manifestoSide}>
        <p className={styles.bodyMuted}>{data.body}</p>
        <div className={styles.ctaRow}>
          <ButtonLink href={resolveHref(data.primaryCta.href, locale)}>{data.primaryCta.label}</ButtonLink>
          <ButtonLink href={resolveHref(data.secondaryCta.href, locale)} variant="outline">
            {data.secondaryCta.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, link, locale }: { eyebrow: string; title: string; link?: Cta; locale: Locale }) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitleBox}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className={styles.h2}>
          <RichText text={title} />
        </h2>
      </div>
      {link && (
        <Link href={resolveHref(link.href, locale)} className="link-line">
          {link.label}
        </Link>
      )}
    </div>
  );
}

// ── Ocasiões especiais ──────────────────────────────────────────────
export function Occasions({
  data,
  tiles,
  locale,
}: {
  data: { eyebrow: string; title: string; linkLabel: string; href: string };
  tiles: OccasionTileDTO[];
  locale: Locale;
}) {
  return (
    <section className={`page-x ${styles.block}`}>
      <SectionHead eyebrow={data.eyebrow} title={data.title} link={{ label: data.linkLabel, href: data.href }} locale={locale} />
      <OccasionsTrack count={tiles.length}>
        {tiles.map((tile, i) => (
          <li key={i} className={`${styles.tile} ${styles[`tile-${tile.size}`]}`}>
            <Link href={tile.href ? categoryHref(tile.href, locale) : resolveHref("category:ocasioes", locale)} className={styles.tileLink}>
              <Image
                src={tile.imageUrl}
                alt=""
                fill
                sizes={tile.size === "large" ? "(min-width: 768px) 50vw, 80vw" : "(min-width: 768px) 25vw, 80vw"}
                className={styles.tileImage}
              />
              <span className={styles.tileScrim} aria-hidden="true" />
              <span className={styles.tileText}>
                <span className={tile.size === "large" ? styles.tileNameLarge : styles.tileName}>{tile.name}</span>
                <span className={styles.tilePhrase}>{tile.phrase}</span>
              </span>
            </Link>
          </li>
        ))}
      </OccasionsTrack>
    </section>
  );
}

// ── Novidades ────────────────────────────────────────────────────────
export function NewArrivals({
  data,
  products,
  locale,
}: {
  data: { eyebrow: string; title: string; linkLabel: string; href: string };
  products: ProductDTO[];
  locale: Locale;
}) {
  if (!products.length) return null;
  return (
    <section className={`page-x ${styles.block}`}>
      <SectionHead eyebrow={data.eyebrow} title={data.title} link={{ label: data.linkLabel, href: data.href }} locale={locale} />
      <ProductGrid products={products} locale={locale} meta="full" />
    </section>
  );
}

// ── Separador Privée (parallax) ──────────────────────────────────────
export function PriveeDivider({ data }: { data: { image: string; alt: string; badge: string } }) {
  return (
    <section className={styles.divider} aria-label={data.badge}>
      {/* eslint-disable-next-line @next/next/no-img-element -- EN: parallax needs a plain image. PT: parallax precisa de <img>. */}
      <img data-parallax="" src={data.image} alt={data.alt} loading="lazy" className={styles.dividerImage} />
      <span className={styles.dividerBadge}>{data.badge}</span>
    </section>
  );
}

// ── Eterna Bridal ────────────────────────────────────────────────────
interface BridalCard {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  cta: string;
  href: string;
}

export function Bridal({ data, locale }: { data: { eyebrow: string; title: string; body: string; cards: BridalCard[] }; locale: Locale }) {
  return (
    <section id="noivas" className={`page-x ${styles.bridal}`}>
      <div className={styles.bridalHead}>
        <span className={styles.bridalEyebrow}>{data.eyebrow}</span>
        <h2 className={styles.bridalTitle}>
          <RichText text={data.title} />
        </h2>
        <p className={styles.bridalBody}>{data.body}</p>
      </div>
      <div className={styles.bridalCards}>
        {data.cards.map((card) => (
          <Link key={card.title} href={resolveHref(card.href, locale)} className={styles.bridalCard}>
            <span className={styles.bridalMedia}>
              <Image src={card.image} alt={card.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className={styles.cover} />
            </span>
            <span className={styles.bridalCardEyebrow}>{card.eyebrow}</span>
            <span className={styles.bridalCardTitle}>{card.title}</span>
            <span className={styles.bridalCta}>{card.cta}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── A experiência Eterna ─────────────────────────────────────────────
const ROMAN = ["I.", "II.", "III.", "IV.", "V.", "VI."];

export function Experience({ data }: { data: { eyebrow: string; title: string; body: string; steps: { title: string; body: string }[] } }) {
  return (
    <section id="prova" className={`page-x ${styles.experience}`}>
      <div className={styles.experienceHead}>
        <span className="eyebrow">{data.eyebrow}</span>
        <h2 className={styles.experienceTitle}>
          <RichText text={data.title} />
        </h2>
      </div>
      <p className={`${styles.bodyMuted} ${styles.experienceBody}`}>{data.body}</p>
      <ol className={styles.steps}>
        {data.steps.map((step, i) => (
          <li key={i} className={styles.step}>
            <span className={styles.roman}>{ROMAN[i]}</span>
            <span className={styles.stepTitle}>{step.title}</span>
            <span className={styles.stepBody}>{step.body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Faixa Privée ─────────────────────────────────────────────────────
export function PriveeBand({ data, locale }: { data: { eyebrow: string; title: string; body: string; cta: string; whatsapp: string }; locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <section className={`on-privee page-x ${styles.band}`}>
      <div className={styles.bandEyebrow}>
        <span className={styles.rule} aria-hidden="true" />
        <span>{data.eyebrow}</span>
        <span className={styles.rule} aria-hidden="true" />
      </div>
      <p className={styles.bandTitle}>
        <RichText text={data.title} />
      </p>
      <p className={styles.bandBody}>{data.body}</p>
      <div className={styles.ctaRow}>
        <ButtonLink href={resolveHref("#prova", locale)} variant="light">
          {data.cta}
        </ButtonLink>
        <ButtonLink href={whatsappLink(undefined, data.whatsapp)} variant="gold">
          <Icon name="whatsapp" size={18} />
          {dict.common.whatsapp}
        </ButtonLink>
      </div>
    </section>
  );
}

// ── Compra segura ────────────────────────────────────────────────────
const SECURE_ICONS: Record<string, IconName> = { phone: "device", store: "store", truck: "truck", return: "return" };

export function Secure({
  data,
  locale,
}: {
  data: { items: { icon: string; title: string; body: string; showPaymentLogos?: boolean }[] };
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  return (
    <section className={`page-x ${styles.secure}`}>
      {data.items.map((item) => (
        <div key={item.title} className={styles.secureItem}>
          <span className={styles.secureIcon}>
            <Icon name={SECURE_ICONS[item.icon] ?? "check"} />
          </span>
          <span className="label">{item.title}</span>
          <span className={styles.secureBody}>{item.body}</span>
          {item.showPaymentLogos && <PaymentLogos label={dict.common.paymentLogos} />}
        </div>
      ))}
    </section>
  );
}

// ── As nossas lojas ──────────────────────────────────────────────────
export function Stores({
  data,
  stores,
  locale,
}: {
  data: { eyebrow: string; title: string; image: string; alt: string; hoursLine: string };
  stores: StoreDTO[];
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  return (
    <section className={`page-x ${styles.stores}`}>
      <span className={styles.storesMedia}>
        <Image src={data.image} alt={data.alt} fill sizes="(min-width: 1024px) 700px, 100vw" className={styles.cover} />
      </span>
      <div className={styles.storesText}>
        <div className={styles.sectionTitleBox}>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2 className={styles.h2}>
            <RichText text={data.title} />
          </h2>
        </div>
        <div className={styles.storeList}>
          {stores.map((s) => (
            <div key={s.code} className={styles.storeRow}>
              <div className={styles.storeName}>
                <span className={styles.storeTitle}>{s.name}</span>
                <span className={styles.storeLocation}>{s.location}</span>
              </div>
              <a href={`tel:${s.phone.replace(/\s/g, "")}`} className={styles.storePhone}>
                {s.phone}
              </a>
            </div>
          ))}
        </div>
        <span className={styles.storesHours}>{data.hoursLine}</span>
        <div className={styles.ctaRow}>
          <ButtonLink href={whatsappLink()}>
            <Icon name="whatsapp" size={18} />
            {dict.common.whatsapp}
          </ButtonLink>
          <ButtonLink href="https://www.google.com/maps/search/?api=1&query=Gl%C3%B3ria+Mall+Maputo" variant="outline">
            {dict.home.howToGetThere}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

// ── Siga a Eterna ────────────────────────────────────────────────────
export function Social({ data, locale }: { data: { eyebrow: string; title: string; images: string[] }; locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <section aria-label={dict.common.social} className={`page-x ${styles.social}`}>
      <div className={styles.sectionHeadPlain}>
        <div className={styles.sectionTitleBox}>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2 className={styles.h2}>
            <RichText text={data.title} />
          </h2>
        </div>
        <SocialLinks label={dict.common.social} variant="pill" />
      </div>
      <div className={styles.socialGrid}>
        {data.images.map((src) => (
          <a key={src} href={site.social[0].url} target="_blank" rel="noopener noreferrer" aria-label={dict.home.seeOnInstagram} className={styles.socialTile}>
            <Image src={src} alt="" fill sizes="(min-width: 1024px) 200px, 33vw" className={styles.coverTop} />
            <span className={styles.socialIcon} aria-hidden="true">
              <Icon name="instagram" size={16} />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
