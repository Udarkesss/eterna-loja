import Link from "next/link";
import { ProductCard } from "@/components/product/ProductCard";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import type { CampaignView } from "@/server/campaigns";
import type { CardPrice, Locale, ProductDTO } from "@/types";
import { Countdown } from "./Countdown";
import styles from "./Campaign.module.css";

/** EN: "27 a 30 de novembro" / "27 November to 3 December". PT: Datas da campanha. */
export function campaignDates(c: CampaignView, locale: Locale) {
  const fmt = (iso: string, withMonth: boolean) =>
    new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", ...(withMonth ? { month: "long" } : {}), timeZone: "Africa/Maputo" }).format(new Date(iso));
  const sameMonth = new Date(c.startsAt).getUTCMonth() === new Date(c.endsAt).getUTCMonth();
  return `${fmt(c.startsAt, !sameMonth)} ${locale === "pt" ? "a" : "to"} ${fmt(c.endsAt, true)}`;
}

export function campaignEyebrow(c: CampaignView, locale: Locale) {
  const dict = getDictionary(locale);
  if (c.kind === "flash") {
    const time = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" }).format(new Date(c.endsAt));
    return t(dict.campaign.flashEyebrow, { time });
  }
  return t(dict.campaign.eyebrow, { dates: campaignDates(c, locale) });
}

/**
 * EN: The campaign band of the home page (design V3-Inicio-Campanha), before or after the collection: eyebrow, name,
 *     phrase, countdown, "Ver a campanha" and four pieces, in the campaign's colours.
 * PT: A faixa da campanha no Início (V3-Inicio-Campanha), antes ou depois da colecção, nas cores da campanha.
 */
export function CampaignBand({ campaign, products, showPrice, locale }: { campaign: CampaignView; products: ProductDTO[]; showPrice: CardPrice; locale: Locale }) {
  const dict = getDictionary(locale);
  const k = campaign.colors;
  return (
    <section aria-label={campaign.name} className={styles.band} style={{ background: k.band, color: k.text }}>
      <div className={`page-x ${styles.bandInner}`}>
        <div className={styles.bandHead}>
          <div className={styles.bandTitles}>
            <span className="eyebrow" style={{ color: k.accent }}>
              {campaignEyebrow(campaign, locale)}
            </span>
            <h2 className={styles.deco} style={{ color: k.title }}>
              {campaign.name}
            </h2>
            {campaign.phrase && <p className={styles.lead}>{campaign.phrase}</p>}
          </div>
          <div className={styles.bandSide}>
            {campaign.countdown && <Countdown endsAt={campaign.endsAt} className={styles.count} boxClassName={styles.countBox} valueClassName={styles.countValue} labelClassName={styles.countLabel} />}
            {campaign.ownPage && (
              <Link href={localizePath(locale, `/campanha/${campaign.slug}`)} className={styles.btn} style={{ background: k.button, color: k.buttonText, borderColor: k.button }}>
                {dict.campaign.seeThe}
              </Link>
            )}
          </div>
        </div>
        {products.length > 0 && (
          <div className={styles.cards}>
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} locale={locale} showPrice={showPrice} sizes="(max-width: 767px) 50vw, 25vw" />
            ))}
          </div>
        )}
        <span className={styles.note}>{dict.campaign.endsAlone}</span>
      </div>
    </section>
  );
}
