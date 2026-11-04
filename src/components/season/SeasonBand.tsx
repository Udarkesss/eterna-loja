import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { RichText } from "@/components/ui/RichText";
import { resolveHref } from "@/lib/links";
import type { SeasonView } from "@/server/seasons";
import type { CardPrice, Locale, ProductDTO } from "@/types";
import { SeasonSlides } from "./SeasonSlides";
import styles from "./Season.module.css";

const MONTHS = {
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** EN: "20 de novembro a 31 de dezembro". PT: Datas da época por extenso. */
function longDates(s: SeasonView, locale: Locale) {
  const [m1, d1] = s.from.split("-").map(Number);
  const [m2, d2] = s.to.split("-").map(Number);
  const m = MONTHS[locale];
  return locale === "pt" ? `${d1} de ${m[m1 - 1]} a ${d2} de ${m[m2 - 1]}` : `${m[m1 - 1]} ${d1} to ${m[m2 - 1]} ${d2}`;
}

/**
 * EN: The home section of a time of the year (design V3-Inicio-Epoca): edge-to-edge band in its colours, the image
 *     (photo, slides or video) and the text panel to the right, left, above or below, then four pieces.
 * PT: A secção da época no Início (V3-Inicio-Epoca): faixa de ponta a ponta nas suas cores, a imagem (foto, slides ou
 *     vídeo) e o texto à direita, à esquerda, em cima ou em baixo, e por baixo quatro peças.
 */
export function SeasonBand({ season, products, showPrice, locale }: { season: SeasonView; products: ProductDTO[]; showPrice: CardPrice; locale: Locale }) {
  const k = season.colors;
  const titleStyle = { color: k.title, "--season-accent": k.accent } as CSSProperties;
  return (
    <section aria-label={season.title.replace(/\*/g, "")} className={styles.band} style={{ background: k.band }} data-side={season.textSide}>
      <div className={styles.panel}>
        <div className={styles.media}>
          {season.media === "video" && season.video ? (
            <video src={season.video} poster={season.images[0]} autoPlay muted loop playsInline className={styles.video} />
          ) : season.media === "slides" ? (
            <SeasonSlides images={season.images} />
          ) : season.images[0] ? (
            <Image src={season.images[0]} alt="" fill sizes="(max-width: 767px) 100vw, 50vw" style={{ objectFit: "cover", objectPosition: "center 30%" }} />
          ) : null}
        </div>
        <div className={styles.text} style={{ background: k.desc, color: k.text }}>
          {season.badge && <span className={styles.badge}>{season.badge}</span>}
          <span className="eyebrow" style={{ color: k.accent }}>
            {longDates(season, locale)}
          </span>
          <h2 className={styles.title} style={titleStyle}>
            <RichText text={season.title} />
          </h2>
          {season.text && <p className={styles.body}>{season.text}</p>}
          {season.button && season.href && (
            <Link href={resolveHref(season.href, locale)} className={styles.btn} style={{ background: k.button, color: k.buttonText, borderColor: k.button }}>
              {season.button}
            </Link>
          )}
        </div>
      </div>
      {products.length > 0 && (
        <div className={`page-x ${styles.cards}`}>
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} showPrice={showPrice} sizes="(max-width: 767px) 50vw, 25vw" />
          ))}
        </div>
      )}
    </section>
  );
}
