import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { whatsappLink } from "@/data/site";
import { getDictionary } from "@/i18n";
import { resolveHref } from "@/lib/links";
import type { CardPrice, CategoryDTO, Locale, OccasionTileDTO, ProductDTO, StoreDTO } from "@/types";
import { AccessoriesTabs, Carousel, MoreOccasions, VideoBand, type AccessoryTab } from "./HomeInteractive";
import styles from "./HomeV3.module.css";
import type { ContactsView, SocialLink } from "@/data/contacts";
import { SocialIcon } from "@/components/ui/SocialIcon";

/**
 * EN: Sections of the V3 home page ("Loja · Início 1/2 e 2/2"), drawn from the content of Gestão → Conteúdo do site.
 * PT: Secções do Início V3, a partir do conteúdo de Gestão → Conteúdo do site.
 */

type Cta = { label: string; href: string };

// ── Entrada ───────────────────────────────────────────────────────────
export function Entrada({ data, locale }: { data: { eyebrow: string; title: string; body: string; cta: Cta }; locale: Locale }) {
  return (
    <section className={`page-x ${styles.entrada}`} aria-label="Eterna">
      <div className={styles.entradaTitle}>
        <span className="eyebrow">{data.eyebrow}</span>
        <h2 className={styles.display92}>
          <RichText text={data.title} />
        </h2>
      </div>
      <div className={styles.entradaText}>
        <p className={styles.muted}>
          <RichText text={data.body} />
        </p>
        <Link href={resolveHref(data.cta.href, locale)} className={styles.btnDark}>
          {data.cta.label}
        </Link>
      </div>
    </section>
  );
}

// ── Colecção activa ───────────────────────────────────────────────────
interface Line {
  eyebrow: string;
  title: string;
  image: string;
  position: string;
  links: Cta[];
}
export function Colecao({ data, collection, locale }: { data: { cue: string; lines: Line[] }; collection: CategoryDTO | null; locale: Locale }) {
  if (!collection) return null;
  return (
    <section id="colecao" className={styles.colecao}>
      {/* EN: Design V3 reveal: the two lines stay pinned under the header while the cover slides up over them (on
          scroll, or on a click on the cover). PT: As duas linhas ficam presas por baixo do cabeçalho enquanto a capa
          sobe por cima delas (ao descer ou ao clicar na capa). */}
      <div className={styles.stage}>
      {collection.imageUrl && (
        <a href="#colecao-linhas" className={styles.cover} aria-label={data.cue}>
          <div className={styles.parallaxLayer} data-parallax="">
            <Image src={collection.imageUrl} alt={collection.name} fill sizes="100vw" style={{ objectPosition: "center 45%" }} />
          </div>
          <span className={styles.scrim} aria-hidden="true" />
          <div className={styles.coverText}>
            <div className={styles.coverMeta}>
              {collection.details?.edition && <span className={styles.eyebrowLight}>{collection.details.edition}</span>}
              {collection.details?.season && <span className={styles.coverSeason}>{collection.details.season}</span>}
            </div>
            <span className={styles.cue}>
              {data.cue}
              <Icon name="chevronDown" size={18} />
            </span>
          </div>
        </a>
      )}
      <div className={styles.duoSticky}>
      <div className={styles.duo}>
        {data.lines.map((line) => (
          <div key={line.eyebrow} className={styles.duoPanel}>
            <Image src={line.image} alt={line.eyebrow} fill sizes="(min-width: 768px) 50vw, 100vw" style={{ objectPosition: line.position }} />
            <span className={styles.scrim} aria-hidden="true" />
            <div className={styles.duoText}>
              <span className={styles.eyebrowLight}>{line.eyebrow}</span>
              <span className={styles.duoTitle}>{line.title}</span>
              <div className={styles.duoLinks}>
                {line.links.map((l) => (
                  <Link key={l.href} href={resolveHref(l.href, locale)} className={styles.btnLine}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
      <span id="colecao-linhas" className={styles.stageMark} aria-hidden="true" />
      </div>
    </section>
  );
}

// ── Ocasiões ──────────────────────────────────────────────────────────
function OccasionTile({ tile, locale, big }: { tile: OccasionTileDTO; locale: Locale; big?: "large" | "tall" }) {
  return (
    <Link
      href={tile.href ? resolveHref(`category:${tile.href}`, locale) : resolveHref("category:ocasioes", locale)}
      className={`${styles.occTile} ${big === "large" ? styles.occLarge : big === "tall" ? styles.occTall : ""}`}
    >
      <Image src={tile.imageUrl} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" style={{ objectPosition: "center 22%" }} />
      <span className={styles.scrim} aria-hidden="true" />
      <span className={styles.occText}>
        <span className={styles.occName}>{tile.name}</span>
        <span className={styles.occPhrase}>{tile.phrase}</span>
      </span>
    </Link>
  );
}

export function Ocasioes({
  data,
  tiles,
  locale,
}: {
  data: { eyebrow: string; title: string; linkLabel: string; href: string; visible?: number };
  tiles: OccasionTileDTO[];
  locale: Locale;
}) {
  const first = tiles.slice(0, data.visible ?? 8);
  const more = tiles.slice(data.visible ?? 8);
  return (
    <section id="ocasioes" className={`page-x ${styles.section}`}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitles}>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2 className={styles.title44}>
            <RichText text={data.title} />
          </h2>
        </div>
        <Link href={resolveHref(data.href, locale)} className={styles.ulink}>
          {data.linkLabel}
        </Link>
      </div>
      <div className={styles.occGrid}>
        {first.map((t) => (
          <OccasionTile key={t.name} tile={t} locale={locale} big={t.size === "large" ? "large" : t.size === "tall" ? "tall" : undefined} />
        ))}
      </div>
      {more.length > 0 && (
        <MoreOccasions>
          <div className={styles.occGrid}>
            {more.map((t) => (
              <OccasionTile key={t.name} tile={t} locale={locale} />
            ))}
          </div>
        </MoreOccasions>
      )}
    </section>
  );
}

// ── Acabadas de chegar ────────────────────────────────────────────────
export function Novidades({
  data,
  products,
  showPrice,
  locale,
}: {
  data: { title: string; subtitle: string; linkLabel: string; href: string };
  products: ProductDTO[];
  showPrice: CardPrice;
  locale: Locale;
}) {
  if (!products.length) return null;
  return (
    <section className={`page-x ${styles.novidades}`}>
      <Carousel
        head={
          <div className={styles.novidadesTitles}>
            <h3 className={styles.subtitle}>{data.title}</h3>
            <span className={styles.small}>{data.subtitle}</span>
            <Link href={resolveHref(data.href, locale)} className={styles.ulink}>
              {data.linkLabel}
            </Link>
          </div>
        }
      >
        {products.map((p) => (
          <div key={p.id} className={styles.slideCard}>
            <ProductCard product={p} locale={locale} showPrice={showPrice} sizes="232px" />
          </div>
        ))}
      </Carousel>
    </section>
  );
}

// ── Noivas ────────────────────────────────────────────────────────────
interface BridalData {
  video: string;
  poster: string;
  videoLabel: string;
  pill: string;
  title: string;
  body: string;
  cards: { eyebrow: string; title: string; image: string; position: string; cta: string; href: string }[];
  experience: { eyebrow: string; title: string; body: string; steps: { title: string; body: string }[] };
  band: { eyebrow: string; title: string; body: string; note: string };
}
const ROMAN = ["I.", "II.", "III.", "IV.", "V.", "VI.", "VII.", "VIII."];

export function Noivas({ data, locale }: { data: BridalData; locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <section id="noivas">
      <VideoBand src={data.video} poster={data.poster} label={data.videoLabel} pill={data.pill} />
      <div data-theme="bridal" className={`page-x ${styles.bridal}`}>
        <div className={styles.bridalHead}>
          <Image src="/images/brand/eterna-bridal-logo.svg" alt="Eterna Bridal" width={160} height={60} unoptimized className={styles.bridalLogo} />
          <h2 className={styles.display64}>
            <RichText text={data.title} />
          </h2>
          <p className={styles.muted}>{data.body}</p>
        </div>
        <div className={styles.bridalCards}>
          {data.cards.map((c) => (
            <Link key={c.title} href={resolveHref(c.href, locale)} className={styles.bridalCard}>
              <span className={styles.bridalImage}>
                <Image src={c.image} alt={c.title} fill sizes="(min-width: 1024px) 33vw, 260px" style={{ objectPosition: c.position }} />
              </span>
              <span className="eyebrow">{c.eyebrow}</span>
              <span className={styles.bridalTitle}>{c.title}</span>
              <span className={styles.ulink}>{c.cta}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className={`page-x ${styles.experience}`}>
        <div className={styles.experienceTitle}>
          <span className="eyebrow">{data.experience.eyebrow}</span>
          <h2 className={styles.display56}>
            <RichText text={data.experience.title} />
          </h2>
        </div>
        <p className={`${styles.muted} ${styles.experienceBody}`}>{data.experience.body}</p>
        <ol className={styles.steps}>
          {data.experience.steps.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <span className={styles.roman}>{ROMAN[i]}</span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.small}>{s.body}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.darkBand}>
        <div className={styles.darkEyebrow}>
          <span className={styles.rule} aria-hidden="true" />
          <span>{data.band.eyebrow}</span>
          <span className={styles.rule} aria-hidden="true" />
        </div>
        <p className={styles.darkTitle}>
          <RichText text={data.band.title} />
        </p>
        <p className={styles.darkBody}>{data.band.body}</p>
        <div className={styles.darkButtons}>
          <Link href={resolveHref("#prova", locale)} className={styles.btnLight}>
            <Icon name="calendar" size={16} />
            {dict.home.bookFitting}
          </Link>
          <a href={whatsappLink(dict.home.fittingMessage)} target="_blank" rel="noopener noreferrer" className={styles.btnGold}>
            <Icon name="whatsapp" size={16} />
            {dict.common.whatsapp}
          </a>
        </div>
        <span className={styles.darkNote}>{data.band.note}</span>
      </div>
    </section>
  );
}

// ── Acessórios / Modeladores ──────────────────────────────────────────
export function Acessorios({ data }: { data: { eyebrow: string; title: string; seconds?: number; tabs: AccessoryTab[] } }) {
  return <AccessoriesTabs eyebrow={data.eyebrow} title={data.title} tabs={data.tabs} seconds={data.seconds ?? 10} />;
}

export function Modeladores({ data, locale }: { data: { eyebrow: string; title: string; body: string; linkLabel: string; href: string; image: string }; locale: Locale }) {
  return (
    <section id="modeladores" className={`${styles.split} ${styles.splitAlt}`}>
      <div className={styles.splitText}>
        <span className="eyebrow">{data.eyebrow}</span>
        <h2 className={styles.title44}>
          <RichText text={data.title} />
        </h2>
        <p className={styles.muted}>{data.body}</p>
        <Link href={resolveHref(data.href, locale)} className={styles.ulink}>
          {data.linkLabel}
        </Link>
      </div>
      <div className={styles.splitImage}>
        <div className={styles.parallaxLayer} data-parallax="">
          <Image src={data.image} alt={data.eyebrow} fill sizes="(min-width: 768px) 50vw, 100vw" style={{ objectPosition: "center 30%" }} />
        </div>
      </div>
    </section>
  );
}

// ── Sobre nós ─────────────────────────────────────────────────────────
interface AboutData {
  eyebrow: string;
  title: string;
  body: string;
  quote: string;
  founder: string;
  founderCaption: string;
  founderLabel: string;
  signature: string;
  figures: { value: string; label: string }[];
  values: { icon: IconName; title: string; body: string }[];
  team: string;
  teamTitle: string;
  teamCaption: string;
  socialEyebrow: string;
  socialTitle: string;
  socialImages: string[];
}

export function Sobre({ data, social }: { data: AboutData; social: SocialLink[] }) {
  const instagram = social.find((s) => s.network === "instagram")?.url ?? "#";
  return (
    <section id="sobre" className={`page-x ${styles.section} ${styles.sobre}`}>
      <div className={styles.founder}>
        <figure className={styles.founderFigure}>
          <div className={styles.founderImage}>
            <Image src={data.founder} alt={data.founderLabel} fill sizes="(min-width: 1024px) 500px, 100vw" style={{ objectPosition: "center 12%" }} />
          </div>
          <figcaption className={styles.small}>{data.founderCaption}</figcaption>
        </figure>
        <div className={styles.founderText}>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2 className={styles.display60}>
            <RichText text={data.title} />
          </h2>
          <p className={styles.muted}>{data.body}</p>
          <blockquote className={styles.quote}>
            <p>{data.quote}</p>
            <div className={styles.signature}>
              <Image src={data.signature} alt="" width={240} height={80} className={styles.signatureImage} />
              <span className={styles.small}>{data.founderLabel}</span>
            </div>
          </blockquote>
        </div>
      </div>

      <div className={styles.three}>
        {data.figures.map((f) => (
          <div key={f.value} className={styles.ruleTop}>
            <span className={styles.roman}>{f.value}</span>
            <p className={styles.small}>{f.label}</p>
          </div>
        ))}
      </div>

      <div className={styles.three}>
        {data.values.map((v) => (
          <div key={v.title} className={`${styles.ruleTop} ${styles.value}`}>
            <span className={styles.iconCircle}>
              <Icon name={v.icon} size={20} />
            </span>
            <span className={styles.subtitle}>{v.title}</span>
            <p className={styles.muted}>{v.body}</p>
          </div>
        ))}
      </div>

      <figure className={styles.team}>
        <div className={styles.teamImage}>
          <div className={styles.parallaxLayer} data-parallax="">
            <Image src={data.team} alt={data.teamTitle} fill sizes="100vw" style={{ objectPosition: "center 40%" }} />
          </div>
        </div>
        <figcaption className={styles.teamCaption}>
          <span className={styles.subtitle}>{data.teamTitle}</span>
          <span className={styles.small}>{data.teamCaption}</span>
        </figcaption>
      </figure>

      <div>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitles}>
            <span className="eyebrow">{data.socialEyebrow}</span>
            <h3 className={styles.title36}>
              <RichText text={data.socialTitle} />
            </h3>
          </div>
          <div className={styles.socialButtons}>
            {social.map((s) => (
              <a key={s.url + s.handle} href={s.url} target="_blank" rel="noopener noreferrer" className={styles.btnSmall}>
                <SocialIcon link={s} />
                {s.handle}
              </a>
            ))}
          </div>
        </div>
        <div className={styles.socialGrid}>
          {data.socialImages.map((src) => (
            <a key={src} href={instagram} target="_blank" rel="noopener noreferrer" className={styles.socialImage}>
              <Image src={src} alt="" fill sizes="(min-width: 1024px) 16vw, 33vw" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Contacte-nos ──────────────────────────────────────────────────────
interface ContactData {
  eyebrow: string;
  title: string;
  stores: { code: string; image: string; eyebrow: string; name: string; description: string; action: "whatsapp" | "call" | "fitting"; showHours?: boolean }[];
  mapsUrl: string;
}

export function Contactos({ data, stores, contacts, locale }: { data: ContactData; stores: StoreDTO[]; contacts: ContactsView; locale: Locale }) {
  const dict = getDictionary(locale);
  return (
    <section id="contactos" className={`page-x ${styles.section}`}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionTitles}>
          <span className="eyebrow">{data.eyebrow}</span>
          <h2 className={styles.title44}>
            <RichText text={data.title} />
          </h2>
        </div>
      </div>
      <div className={styles.storeGrid}>
        {data.stores.map((card) => {
          const store = stores.find((s) => s.code === card.code);
          const phone = store?.phone ?? contacts.phones[0]?.value ?? "";
          // EN: Bridal is by appointment only: no hours unless switched on. PT: A Bridal é só por marcação.
          const showHours = card.showHours ?? card.action !== "fitting";
          const wa = (
            <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={card.action === "whatsapp" ? styles.btnDarkSmall : styles.btnSmall}>
              <Icon name="whatsapp" size={16} />
              WhatsApp
            </a>
          );
          const call = (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className={card.action === "call" ? styles.btnDarkSmall : styles.btnSmall}>
              <Icon name="phone" size={16} />
              {dict.nav.call}
            </a>
          );
          return (
            <article key={card.code} className={styles.storeCard}>
              <div className={styles.storeImage}>
                <Image src={card.image} alt={card.name} fill sizes="(min-width: 768px) 50vw, 100vw" style={{ objectPosition: "center top" }} />
              </div>
              <div className={styles.storeBody}>
                <span className="eyebrow">{card.eyebrow}</span>
                <h3 className={styles.title36}>{card.name}</h3>
                <p className={styles.small}>{card.description}</p>
                <ul className={styles.storeRows}>
                  <li>
                    <Icon name="pin" size={18} />
                    {store?.location ?? "Glória Mall, Maputo"}
                  </li>
                  {showHours && store?.hours && (
                    <li>
                      <Icon name="clock" size={18} />
                      {store.hours}
                    </li>
                  )}
                  <li>
                    <Icon name="phone" size={18} />
                    {phone}
                  </li>
                </ul>
                <div className={styles.storeButtons}>
                  {card.action === "fitting" ? (
                    <>
                      <Link href={resolveHref("#prova", locale)} className={styles.btnDarkSmall}>
                        <Icon name="calendar" size={16} />
                        {dict.home.bookFittingShort}
                      </Link>
                      {call}
                    </>
                  ) : card.action === "call" ? (
                    <>
                      {call}
                      {wa}
                    </>
                  ) : (
                    <>
                      {wa}
                      {call}
                    </>
                  )}
                  <a href={data.mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.btnText}>
                    <Icon name="pin" size={16} />
                    {dict.home.howToGetThere}
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className={styles.channels}>
        {contacts.whatsapp && (
          <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className={styles.channel}>
            <span className={styles.iconCircleSmall}>
              <Icon name="whatsapp" size={18} />
            </span>
            <span>
              <span className={styles.label}>WhatsApp</span>
              <span className={styles.small}>{contacts.whatsapp.value}</span>
            </span>
          </a>
        )}
        {contacts.phones.length > 0 && (
          <a href={`tel:${contacts.phones[0].value.replace(/\s/g, "")}`} className={styles.channel}>
            <span className={styles.iconCircleSmall}>
              <Icon name="phone" size={18} />
            </span>
            <span>
              <span className={styles.label}>{dict.home.phone}</span>
              <span className={styles.small}>{contacts.phones.map((c) => c.value).join(" · ")}</span>
            </span>
          </a>
        )}
        {contacts.emails.length > 0 && (
          <a href={`mailto:${contacts.emails[0].value}`} className={styles.channel}>
            <span className={styles.iconCircleSmall}>
              <Icon name="mail" size={18} />
            </span>
            <span>
              <span className={styles.label}>E-mail</span>
              <span className={styles.small}>{contacts.emails.map((c) => c.value).join(" · ")}</span>
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
