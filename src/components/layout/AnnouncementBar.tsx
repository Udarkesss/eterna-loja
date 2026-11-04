import { Fragment } from "react";
import Link from "next/link";
import { TimeLeft } from "@/components/campaign/Countdown";
import { getDictionary, t } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveHref } from "@/lib/links";
import { siteCampaign } from "@/server/campaigns";
import { activeSeason } from "@/server/seasons";
import { getSection } from "@/server/content";
import type { Locale } from "@/types";
import styles from "./AnnouncementBar.module.css";

interface AnnouncementData {
  messages: string[];
  startsAt: string | null;
  endsAt: string | null;
}

/**
 * EN: "Faixa de anúncio": up to 3 messages separated by a gold dot, editable in Gestão · 8 (with optional dates
 *     for campaigns such as Saldos). On phones only the first message is shown, as in the design.
 * PT: "Faixa de anúncio": até 3 mensagens separadas por um ponto dourado, editáveis na gestão (com datas
 *     opcionais para campanhas como Saldos). No telemóvel aparece só a primeira, como no design.
 */
export async function AnnouncementBar({ locale }: { locale: Locale }) {
  // EN: A running campaign takes the bar (design V3: "Black Friday · até −30% … · Ver campanha"). PT: A campanha ocupa a faixa.
  const campaign = await siteCampaign(locale);
  if (campaign?.topBar) {
    const dict = getDictionary(locale);
    const end = new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Maputo" }).format(new Date(campaign.endsAt));
    return (
      <div className={`on-privee ${styles.bar}`}>
        {campaign.kind === "flash" ? (
          <span>
            {t(dict.campaign.flashBar, { percent: campaign.maxPercent, time: end })} · {dict.campaign.left} <TimeLeft endsAt={campaign.endsAt} />
          </span>
        ) : (
          <span>{[campaign.name, campaign.phrase?.replace(/\.\s.*$/, "")].filter(Boolean).join(" · ")}</span>
        )}
        {campaign.ownPage && (
          <>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <Link href={localizePath(locale, `/campanha/${campaign.slug}`)} className={styles.link}>
              {dict.campaign.see}
            </Link>
          </>
        )}
      </div>
    );
  }
  // EN: A time of the year changes the bar too ("✦ Natal & Réveillon · … · Descobrir ✦"). PT: A época também muda a faixa.
  const season = await activeSeason(locale);
  if (season?.bar) {
    const dict = getDictionary(locale);
    return (
      <div className={`on-privee ${styles.bar}`}>
        <span style={{ color: "#D8B45A" }} aria-hidden="true">
          ✦
        </span>
        <span>{season.bar}</span>
        {season.href && (
          <>
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            <Link href={resolveHref(season.href, locale)} className={styles.link}>
              {dict.campaign.discover}
            </Link>
          </>
        )}
        <span style={{ color: "#D8B45A" }} aria-hidden="true">
          ✦
        </span>
      </div>
    );
  }
  const data = await getSection<AnnouncementData>("home", "announcement", locale);
  if (!data?.messages?.length) return null;
  const now = Date.now();
  if ((data.startsAt && Date.parse(data.startsAt) > now) || (data.endsAt && Date.parse(data.endsAt) < now)) return null;

  return (
    <div className={`on-privee ${styles.bar}`}>
      {data.messages.map((message, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
          )}
          <span className={i > 0 ? styles.extra : undefined}>{message}</span>
        </Fragment>
      ))}
    </div>
  );
}
