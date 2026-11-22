import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { campaignEyebrow } from "@/components/campaign/CampaignBand";
import styles from "@/components/campaign/Campaign.module.css";
import { Countdown } from "@/components/campaign/Countdown";
import { ProductCard } from "@/components/product/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { getDictionary, plural } from "@/i18n";
import { resolveLocale } from "@/i18n/params";
import { campaignBySlug } from "@/server/campaigns";
import { listProducts } from "@/server/catalog";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const c = await campaignBySlug((await params).slug, locale);
  return c ? { title: c.name, description: c.phrase ?? undefined } : {};
}

/**
 * EN: Campaign page of design V3-Campanha: dark hero (dates, name, phrase, countdown, image), the level-discount note
 *     and the campaign pieces. Only while the campaign is running.
 * PT: Página da campanha do V3: topo escuro (datas, nome, frase, contagem, imagem), a nota do desconto de nível e as
 *     peças da campanha. Só enquanto a campanha decorre.
 */
export default async function CampaignPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const campaign = await campaignBySlug((await params).slug, locale);
  if (!campaign) notFound();
  const dict = getDictionary(locale);
  const list = await listProducts({ ids: campaign.productIds }, locale);
  const products = campaign.productIds.map((id) => list.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p && p.stock > 0);

  return (
    <>
      <section className={`on-dark ${styles.hero}`}>
        <div className={`page-x ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <span className="eyebrow" style={{ color: "var(--accent)" }}>
              {campaignEyebrow(campaign, locale)}
            </span>
            <h1 className={styles.heroTitle}>{campaign.name}</h1>
            {campaign.phrase && <p className={styles.lead}>{campaign.phrase}</p>}
            {campaign.countdown && (
              <Countdown endsAt={campaign.endsAt} className={styles.heroCount} boxClassName={styles.heroCountBox} valueClassName={styles.heroCountValue} labelClassName={styles.heroCountLabel} />
            )}
          </div>
          {campaign.imageUrl && (
            <div className={styles.heroImage}>
              <Image src={campaign.imageUrl} alt="" fill priority sizes="(max-width: 1023px) 100vw, 460px" style={{ objectFit: "cover" }} />
            </div>
          )}
        </div>
      </section>
      <section className={`page-x ${styles.body}`}>
        <div className={styles.info}>
          <Icon name="info" size={18} />
          <span>{dict.campaign.levelNote}</span>
        </div>
        <span className="label">{plural(dict.campaign.pieces, products.length)}</span>
        <div className={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} showPrice sizes="(max-width: 767px) 50vw, 25vw" />
          ))}
        </div>
      </section>
    </>
  );
}
