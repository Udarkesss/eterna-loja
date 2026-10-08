import { Fragment } from "react";
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
